import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch,
  Timestamp,
  serverTimestamp,
  increment,
  query,
  where,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { mapDocs } from '../lib/firestoreHelpers';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type {
  Producto,
  ProductoFormData,
  InvestigacionMercado,
  InvestigacionFormData,
  InvestigacionResumen,
  HistorialPrecio,
  AlertaInvestigacion,
  PuntoEquilibrio
} from '../types/producto.types';
import type { TipoProductoSnapshot } from '../types/tipoProducto.types';
import type { CategoriaSnapshot } from '../types/categoria.types';
import type { EtiquetaSnapshot } from '../types/etiqueta.types';
import { competidorService } from './competidor.service';
import { proveedorService } from './proveedor.service';
import { lineaNegocioService } from './lineaNegocio.service';
import { metricasService } from './metricas.service';
import { tipoProductoService } from './tipoProducto.service';
import { categoriaService } from './categoria.service';
import { etiquetaService } from './etiqueta.service';
import { logger } from '../lib/logger';

/**
 * Normaliza campos legacy de variantes al modelo grupoVarianteId.
 * Llamar al leer cualquier producto de Firestore.
 */
function normalizeProductoVariantes(p: Producto): Producto {
  // grupoVarianteId: usa el nuevo campo, o deriva del legacy
  const grupoVarianteId = p.grupoVarianteId
    ?? p.grupoId
    ?? p.parentId
    ?? (p.esPadre ? p.id : undefined); // Si es padre, su propio ID es el grupo

  // esPrincipalGrupo: el "representante" del grupo
  const esPrincipalGrupo = p.esPrincipalGrupo ?? p.esPadre ?? false;

  // Legacy compat
  const esAgrupador = p.esAgrupador ?? p.esPadre ?? false;
  const grupoId = p.grupoId ?? p.parentId;

  return {
    ...p,
    grupoVarianteId,
    esPrincipalGrupo,
    esAgrupador,
    grupoId,
  };
}

const COLLECTION_NAME = COLLECTIONS.PRODUCTOS;

export class ProductoService {
  /**
   * Obtener todos los productos activos
   * @param incluirInactivos - Si es true, incluye productos con estado 'inactivo'
   */
  /**
   * @param maxResults - Límite de documentos (default 300). Pasar Infinity para batch/CTRU.
   */
  static async getAll(incluirInactivos: boolean = false, maxResults: number = 300): Promise<Producto[]> {
    try {
      const col = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(
        isFinite(maxResults) ? query(col, limit(maxResults)) : col
      );

      const productosRaw = mapDocs<Producto>(snapshot);

      // Normalizar campos legacy → modelo grupoVarianteId
      const productos = productosRaw.map(p => normalizeProductoVariantes(p));

      // Siempre excluir productos en papelera (estado='eliminado')
      // Por defecto, también excluir inactivos
      const filtrados = productos
        .filter(p => p.estado !== 'eliminado')
        .filter(p => incluirInactivos ? true : p.estado !== 'inactivo');

      // Ordenar por fecha de creación (creadoEn o fechaCreacion para compatibilidad)
      return filtrados.sort((a, b) => {
        const fechaA = (a as any).creadoEn?.toDate?.() || (a as any).fechaCreacion?.toDate?.() || new Date(0);
        const fechaB = (b as any).creadoEn?.toDate?.() || (b as any).fechaCreacion?.toDate?.() || new Date(0);
        return fechaB.getTime() - fechaA.getTime();
      });
    } catch (error: any) {
      logger.error('Error al obtener productos:', error);
      throw new Error('Error al cargar productos');
    }
  }

  /**
   * Obtener producto por ID
   */
  static async getById(id: string): Promise<Producto | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const raw = { id: docSnap.id, ...docSnap.data() } as Producto;
        return normalizeProductoVariantes(raw);
      }
      
      return null;
    } catch (error: any) {
      logger.error('Error al obtener producto:', error);
      throw new Error('Error al cargar producto');
    }
  }

  /**
   * Buscar producto por codigo UPC/EAN (para escaner de codigo de barras)
   */
  static async getByCodigoUPC(codigoUPC: string): Promise<Producto | null> {
    try {
      if (!codigoUPC || codigoUPC.trim() === '') return null;

      const q = query(
        collection(db, COLLECTION_NAME),
        where('codigoUPC', '==', codigoUPC.trim())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const docSnap = snapshot.docs[0];
      const raw = { id: docSnap.id, ...docSnap.data() } as Producto;
      return normalizeProductoVariantes(raw);
    } catch (error: any) {
      logger.error('Error buscando producto por UPC:', error);
      throw new Error('Error al buscar producto por codigo de barras');
    }
  }

  /**
   * Crear nuevo producto
   */
  static async create(data: ProductoFormData, userId: string): Promise<Producto> {
    try {
      // Determinar prefijo SKU basado en línea de negocio
      let skuPrefix = 'BMN';
      let lineaNegocioNombre: string | undefined;
      if (data.lineaNegocioId) {
        try {
          const linea = await lineaNegocioService.getById(data.lineaNegocioId);
          if (linea) {
            skuPrefix = linea.codigo;
            lineaNegocioNombre = linea.nombre;
          }
        } catch (lineaError) {
          logger.warn('Error al obtener línea de negocio para SKU, usando BMN:', lineaError);
        }
      }

      // Generar SKU automático con prefijo de línea
      const sku = await this.generateSKU(skuPrefix);

      // Obtener snapshots de clasificacion si se proporcionaron IDs
      let tipoProducto: TipoProductoSnapshot | undefined;
      let categorias: CategoriaSnapshot[] = [];
      let etiquetasData: EtiquetaSnapshot[] = [];

      if (data.tipoProductoId) {
        tipoProducto = await tipoProductoService.getSnapshot(data.tipoProductoId) || undefined;
      }

      if (data.categoriaIds && data.categoriaIds.length > 0) {
        categorias = await categoriaService.getSnapshots(data.categoriaIds);
      }

      if (data.etiquetaIds && data.etiquetaIds.length > 0) {
        etiquetasData = await etiquetaService.getSnapshots(data.etiquetaIds);
      }

      const newProducto: Record<string, any> = {
        sku,
        marca: data.marca || '',
        nombreComercial: data.nombreComercial || '',
        presentacion: data.presentacion || '',
        dosaje: data.dosaje || '',
        contenido: data.contenido || '',

        // Clasificacion legacy (mantener para compatibilidad)
        grupo: data.grupo || '',
        subgrupo: data.subgrupo || '',

        codigoUPC: data.codigoUPC || '',

        estado: 'activo' as const,
        etiquetas: [], // Campo legacy para etiquetas de texto

        ctruPromedio: 0,

        stockUSA: 0,
        stockPeru: 0,
        stockTransito: 0,
        stockReservado: 0,
        stockDisponible: 0,

        stockMinimo: data.stockMinimo || 10,
        stockMaximo: data.stockMaximo || 100,

        rotacionPromedio: 0,
        diasParaQuiebre: 0,

        esPadre: false,

        creadoPor: userId,
        fechaCreacion: serverTimestamp(),
      };

      // Agregar campos opcionales solo si tienen valor (evitar undefined en Firestore)
      if (data.marcaId) {
        newProducto.marcaId = data.marcaId;
      }
      if (data.tipoProductoId) {
        newProducto.tipoProductoId = data.tipoProductoId;
      }
      if (tipoProducto) {
        newProducto.tipoProducto = tipoProducto;
      }
      if (data.categoriaIds && data.categoriaIds.length > 0) {
        newProducto.categoriaIds = data.categoriaIds;
      }
      if (categorias.length > 0) {
        newProducto.categorias = categorias;
      }
      if (data.categoriaPrincipalId) {
        newProducto.categoriaPrincipalId = data.categoriaPrincipalId;
      }
      if (data.etiquetaIds && data.etiquetaIds.length > 0) {
        newProducto.etiquetaIds = data.etiquetaIds;
      }
      if (etiquetasData.length > 0) {
        newProducto.etiquetasData = etiquetasData;
      }
      if (data.sabor) {
        newProducto.sabor = data.sabor;
      }
      if (data.servingsPerDay !== undefined && data.servingsPerDay !== null) {
        newProducto.servingsPerDay = data.servingsPerDay;
      }
      if (data.cicloRecompraDias !== undefined && data.cicloRecompraDias !== null) {
        newProducto.cicloRecompraDias = data.cicloRecompraDias;
      }
      if (data.lineaNegocioId) {
        newProducto.lineaNegocioId = data.lineaNegocioId;
        if (lineaNegocioNombre) {
          newProducto.lineaNegocioNombre = lineaNegocioNombre;
        }
      }
      if (data.paisOrigen) {
        newProducto.paisOrigen = data.paisOrigen;
      }

      // Atributos Skincare + sync legacy
      if (data.atributosSkincare) {
        newProducto.atributosSkincare = data.atributosSkincare;
        // Sync campos legacy para compatibilidad con módulos existentes
        const skc = data.atributosSkincare;
        newProducto.presentacion = skc.tipoProductoSKC || '';
        newProducto.contenido = skc.volumen || '';
        newProducto.dosaje = skc.ingredienteClave || '';
        newProducto.sabor = skc.tipoPiel?.[0] || '';
      }

      // Variantes — modelo grupoVarianteId + legacy compat
      if (data.grupoVarianteId) {
        newProducto.grupoVarianteId = data.grupoVarianteId;
      }
      if (data.esPrincipalGrupo !== undefined) {
        newProducto.esPrincipalGrupo = data.esPrincipalGrupo;
      }
      if (data.parentId) {
        newProducto.parentId = data.parentId;
        newProducto.esVariante = true;
        newProducto.esPadre = false;
        // Ensure grupoVarianteId is set from parentId if not explicitly provided
        if (!newProducto.grupoVarianteId) {
          newProducto.grupoVarianteId = data.parentId;
        }
      }
      if (data.varianteLabel) {
        newProducto.varianteLabel = data.varianteLabel;
      }

      // Limpiar cualquier valor undefined restante antes de enviar a Firestore
      const cleanedProducto = this.removeUndefined(newProducto);

      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedProducto);

      // Si es variante, marcar el padre con ambos modelos
      if (data.parentId) {
        try {
          const padreRef = doc(db, COLLECTION_NAME, data.parentId);
          await updateDoc(padreRef, {
            esPadre: true,
            esAgrupador: true,
            grupoVarianteId: data.parentId,
            esPrincipalGrupo: true,
          });
        } catch (e) {
          logger.warn('Error al marcar padre:', e);
        }
      }

      // Incrementar contador de productos activos en la marca (Gestor Maestro)
      if (data.marcaId) {
        try {
          await metricasService.incrementarProductosMarca(data.marcaId);
        } catch (metricasError) {
          logger.warn('Error al actualizar métricas de marca:', metricasError);
        }
      }

      // Actualizar metricas de tipo de producto
      if (data.tipoProductoId) {
        try {
          await tipoProductoService.actualizarMetricas(data.tipoProductoId, { productosActivos: 1 });
        } catch (metricasError) {
          logger.warn('Error al actualizar métricas de tipo:', metricasError);
        }
      }

      // Actualizar metricas de categorias
      if (data.categoriaIds && data.categoriaIds.length > 0) {
        for (const catId of data.categoriaIds) {
          try {
            await categoriaService.actualizarMetricas(catId, 1);
          } catch (metricasError) {
            logger.warn('Error al actualizar métricas de categoria:', metricasError);
          }
        }
      }

      return {
        id: docRef.id,
        ...newProducto,
        fechaCreacion: Timestamp.now()
      } as Producto;
    } catch (error: any) {
      logger.error('Error al crear producto:', error);
      throw new Error('Error al crear producto');
    }
  }

  /**
   * Actualizar producto
   */
  static async update(id: string, data: Partial<ProductoFormData>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);

      // Preparar datos de actualizacion - limpiar valores undefined
      const cleanData = this.removeUndefined(data);
      const updateData: Record<string, any> = {
        ...cleanData,
        ultimaEdicion: serverTimestamp()
      };

      // Si se actualiza el tipo de producto, obtener snapshot
      if (data.tipoProductoId !== undefined) {
        if (data.tipoProductoId) {
          const tipoProducto = await tipoProductoService.getSnapshot(data.tipoProductoId);
          if (tipoProducto) {
            updateData.tipoProducto = tipoProducto;
          }
        } else {
          // Si se elimina el tipo, limpiar el snapshot
          updateData.tipoProducto = null;
          updateData.tipoProductoId = null;
        }
      }

      // Si se actualizan las categorias, obtener snapshots
      if (data.categoriaIds !== undefined) {
        if (data.categoriaIds && data.categoriaIds.length > 0) {
          const categorias = await categoriaService.getSnapshots(data.categoriaIds);
          updateData.categorias = categorias;
        } else {
          updateData.categorias = [];
          updateData.categoriaIds = [];
        }
      }

      // Si se actualiza la categoria principal
      if (data.categoriaPrincipalId !== undefined) {
        updateData.categoriaPrincipalId = data.categoriaPrincipalId || null;
      }

      // Si se actualizan las etiquetas, obtener snapshots
      if (data.etiquetaIds !== undefined) {
        if (data.etiquetaIds && data.etiquetaIds.length > 0) {
          const etiquetasData = await etiquetaService.getSnapshots(data.etiquetaIds);
          updateData.etiquetasData = etiquetasData;
        } else {
          updateData.etiquetasData = [];
          updateData.etiquetaIds = [];
        }
      }

      // Si se actualiza el pais de origen
      if (data.paisOrigen !== undefined) {
        updateData.paisOrigen = data.paisOrigen || null;
      }

      // Si se actualizan atributos skincare + sync legacy
      if (data.atributosSkincare !== undefined) {
        updateData.atributosSkincare = data.atributosSkincare;
        if (data.atributosSkincare) {
          const skc = data.atributosSkincare;
          updateData.presentacion = skc.tipoProductoSKC || '';
          updateData.contenido = skc.volumen || '';
          updateData.dosaje = skc.ingredienteClave || '';
          updateData.sabor = skc.tipoPiel?.[0] || '';
        }
      }

      // Limpiar el objeto final de valores undefined (por si quedaron de los snapshots)
      const finalUpdateData = this.removeUndefined(updateData);

      await updateDoc(docRef, finalUpdateData);
    } catch (error: any) {
      logger.error('Error al actualizar producto:', error);
      throw new Error(`Error al actualizar producto: ${error.message || 'Error desconocido'}`);
    }
  }

  /**
   * Eliminar producto (soft delete)
   */
  static async delete(id: string, userId?: string): Promise<void> {
    try {
      // Obtener el producto para saber su marcaId
      const producto = await this.getById(id);

      const docRef = doc(db, COLLECTION_NAME, id);

      await updateDoc(docRef, {
        estado: 'eliminado',
        fechaEliminacion: serverTimestamp(),
        eliminadoPor: userId || null,
        ultimaEdicion: serverTimestamp()
      });

      // Decrementar contador de productos activos en la marca (Gestor Maestro)
      if (producto?.marcaId) {
        try {
          await metricasService.decrementarProductosMarca(producto.marcaId);
        } catch (metricasError) {
          logger.warn('Error al actualizar métricas de marca:', metricasError);
        }
      }
    } catch (error: any) {
      logger.error('Error al eliminar producto:', error);
      throw new Error('Error al eliminar producto');
    }
  }

  /**
   * Reactivar producto (revertir soft delete)
   */
  static async reactivar(id: string): Promise<void> {
    try {
      const producto = await this.getById(id);
      const docRef = doc(db, COLLECTION_NAME, id);

      await updateDoc(docRef, {
        estado: 'activo',
        fechaEliminacion: deleteField(),
        eliminadoPor: deleteField(),
        ultimaEdicion: serverTimestamp()
      });

      // Incrementar contador de productos activos en la marca
      if (producto?.marcaId) {
        try {
          await metricasService.incrementarProductosMarca(producto.marcaId);
        } catch (metricasError) {
          logger.warn('Error al actualizar métricas de marca:', metricasError);
        }
      }
    } catch (error: any) {
      logger.error('Error al reactivar producto:', error);
      throw new Error('Error al reactivar producto');
    }
  }

  /**
   * Obtener variantes de un producto padre
   */
  static async getVariantes(grupoId: string): Promise<Producto[]> {
    try {
      // Buscar por grupoVarianteId (nuevo) con fallback a parentId (legacy)
      let snapshot = await getDocs(query(
        collection(db, COLLECTION_NAME),
        where('grupoVarianteId', '==', grupoId),
        where('estado', '==', 'activo')
      ));

      // Fallback: si no hay resultados con grupoVarianteId, buscar con parentId legacy
      if (snapshot.empty) {
        snapshot = await getDocs(query(
          collection(db, COLLECTION_NAME),
          where('parentId', '==', grupoId),
          where('estado', '==', 'activo')
        ));
      }

      return mapDocs<Producto>(snapshot).map(p => normalizeProductoVariantes(p));
    } catch (error: any) {
      logger.error('Error al obtener variantes:', error);
      return [];
    }
  }

  /**
   * Vincular un producto existente como variante de un padre
   */
  static async vincularComoVariante(productoId: string, parentId: string, varianteLabel: string): Promise<void> {
    try {
      const productoRef = doc(db, COLLECTION_NAME, productoId);
      await updateDoc(productoRef, {
        // Legacy fields (maintain during transition)
        parentId,
        esVariante: true,
        esPadre: false,
        // New model fields
        grupoVarianteId: parentId,
        esPrincipalGrupo: false,
        varianteLabel,
        ultimaEdicion: serverTimestamp(),
      });
      // Marcar padre con ambos modelos
      const padreRef = doc(db, COLLECTION_NAME, parentId);
      await updateDoc(padreRef, {
        esPadre: true,
        esAgrupador: true,
        grupoVarianteId: parentId,
        esPrincipalGrupo: true,
      });
    } catch (error: any) {
      logger.error('Error al vincular variante:', error);
      throw new Error('Error al vincular variante');
    }
  }

  /**
   * Crear producto con múltiples variantes en un solo paso atómico.
   * Genera grupoVarianteId compartido, SKUs secuenciales, batch write.
   */
  static async createConVariantes(
    datosComunes: {
      marca: string;
      marcaId?: string;
      nombreComercial: string;
      presentacion?: string;
      dosaje?: string;
      grupo?: string;
      subgrupo?: string;
      paisOrigen?: string;
      lineaNegocioId: string;
      tipoProductoId?: string;
      categoriaIds?: string[];
      categoriaPrincipalId?: string;
      etiquetaIds?: string[];
      stockMinimo?: number;
      stockMaximo?: number;
    },
    variantes: {
      contenido: string;
      sabor?: string;
      dosaje?: string;
      volumen?: string;
      varianteLabel: string;
    }[],
    userId: string
  ): Promise<Producto[]> {
    if (!variantes || variantes.length < 2) {
      throw new Error('Se requieren al menos 2 variantes para crear un grupo.');
    }

    // 1. Resolve line of business prefix
    let skuPrefix = 'BMN';
    let lineaNegocioNombre: string | undefined;
    try {
      const linea = await lineaNegocioService.getById(datosComunes.lineaNegocioId);
      if (linea) {
        skuPrefix = linea.codigo;
        lineaNegocioNombre = linea.nombre;
      }
    } catch (e) {
      logger.warn('createConVariantes: error getting linea:', e);
    }

    // 2. Generate SKUs sequentially (guarantees order)
    const skus: string[] = [];
    for (let i = 0; i < variantes.length; i++) {
      const sku = await this.generateSKU(skuPrefix);
      skus.push(sku);
    }

    // 3. Resolve snapshots for classification (like create() does)
    let tipoProductoSnapshot: any = undefined;
    let categoriasSnapshots: any[] = [];
    let etiquetasSnapshots: any[] = [];
    try {
      if (datosComunes.tipoProductoId) {
        tipoProductoSnapshot = await tipoProductoService.getSnapshot(datosComunes.tipoProductoId);
      }
      if (datosComunes.categoriaIds?.length) {
        categoriasSnapshots = await categoriaService.getSnapshots(datosComunes.categoriaIds);
      }
      if (datosComunes.etiquetaIds?.length) {
        etiquetasSnapshots = await etiquetaService.getSnapshots(datosComunes.etiquetaIds);
      }
    } catch (e) {
      logger.warn('createConVariantes: error getting snapshots:', e);
    }

    // 4. Generate shared group ID
    const grupoVarianteId = crypto.randomUUID();

    // 5. Pre-assign document refs for batch
    const col = collection(db, COLLECTION_NAME);
    const docRefs = variantes.map(() => doc(col));

    // 5. Build batch
    const batch = writeBatch(db);
    const ahora = Timestamp.now();
    const productosCreados: Producto[] = [];

    for (let i = 0; i < variantes.length; i++) {
      const v = variantes[i];
      const esPrincipalGrupo = i === 0;

      const docData: Record<string, any> = {
        sku: skus[i],
        marca: datosComunes.marca || '',
        marcaId: datosComunes.marcaId || undefined,
        nombreComercial: datosComunes.nombreComercial || '',
        presentacion: datosComunes.presentacion || '',
        grupo: datosComunes.grupo || '',
        subgrupo: datosComunes.subgrupo || '',
        contenido: v.contenido || '',
        dosaje: v.dosaje || datosComunes.dosaje || '',
        sabor: v.sabor || '',
        varianteLabel: v.varianteLabel || '',
        grupoVarianteId,
        esPrincipalGrupo,
        // Legacy compat
        esPadre: esPrincipalGrupo,
        parentId: esPrincipalGrupo ? undefined : docRefs[0].id,
        esVariante: true,
        // Stock
        stockUSA: 0, stockPeru: 0, stockTransito: 0, stockReservado: 0, stockDisponible: 0,
        stockMinimo: datosComunes.stockMinimo ?? 10,
        stockMaximo: datosComunes.stockMaximo ?? 100,
        ctruPromedio: 0, rotacionPromedio: 0, diasParaQuiebre: 0,
        // State
        estado: 'activo',
        etiquetas: [],
        creadoPor: userId,
        fechaCreacion: serverTimestamp(),
      };

      // Optional fields
      if (datosComunes.paisOrigen) docData.paisOrigen = datosComunes.paisOrigen;
      if (datosComunes.lineaNegocioId) {
        docData.lineaNegocioId = datosComunes.lineaNegocioId;
        if (lineaNegocioNombre) docData.lineaNegocioNombre = lineaNegocioNombre;
      }
      if (datosComunes.tipoProductoId) {
        docData.tipoProductoId = datosComunes.tipoProductoId;
        if (tipoProductoSnapshot) docData.tipoProducto = tipoProductoSnapshot;
      }
      if (datosComunes.categoriaIds?.length) {
        docData.categoriaIds = datosComunes.categoriaIds;
        if (categoriasSnapshots.length) docData.categorias = categoriasSnapshots;
      }
      if (datosComunes.categoriaPrincipalId) docData.categoriaPrincipalId = datosComunes.categoriaPrincipalId;
      if (datosComunes.etiquetaIds?.length) {
        docData.etiquetaIds = datosComunes.etiquetaIds;
        if (etiquetasSnapshots.length) docData.etiquetasData = etiquetasSnapshots;
      }

      batch.set(docRefs[i], docData);
      productosCreados.push({ id: docRefs[i].id, ...docData, fechaCreacion: ahora } as Producto);
    }

    // 6. Atomic commit
    await batch.commit();

    // Update metrics for brand, type, and categories
    const numVariantes = variantes.length;
    if (datosComunes.marcaId) {
      for (let i = 0; i < numVariantes; i++) {
        metricasService.incrementarProductosMarca(datosComunes.marcaId).catch(() => {});
      }
    }
    if (datosComunes.tipoProductoId) {
      tipoProductoService.actualizarMetricas(datosComunes.tipoProductoId, { productosActivos: numVariantes }).catch(() => {});
    }
    if (datosComunes.categoriaIds?.length) {
      for (const catId of datosComunes.categoriaIds) {
        categoriaService.actualizarMetricas(catId, numVariantes).catch(() => {});
      }
    }

    logger.info(`createConVariantes: grupo ${grupoVarianteId} con ${variantes.length} variantes. SKUs: ${skus.join(', ')}`);
    return productosCreados;
  }

  /**
   * Obtener productos archivados (estado='eliminado')
   */
  static async getArchivados(): Promise<Producto[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estado', '==', 'eliminado')
      );
      const snapshot = await getDocs(q);
      const productos = mapDocs<Producto>(snapshot).map(p => normalizeProductoVariantes(p));

      // Ordenar por fecha de archivo (más reciente primero)
      return productos.sort((a, b) => {
        const fechaA = a.fechaEliminacion?.toDate?.() || new Date(0);
        const fechaB = b.fechaEliminacion?.toDate?.() || new Date(0);
        return fechaB.getTime() - fechaA.getTime();
      });
    } catch (error: any) {
      logger.error('Error al obtener productos archivados:', error);
      throw new Error('Error al obtener productos archivados');
    }
  }

  /**
   * Incrementar stock de un producto
   * @param id ID del producto
   * @param cantidad Cantidad a incrementar
   * @param pais 'USA' o 'Peru' o 'transito'
   */
  static async incrementarStock(id: string, cantidad: number, pais: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData: Record<string, unknown> = {
        ultimaEdicion: serverTimestamp()
      };

      switch (pais) {
        case 'USA':
          updateData.stockUSA = increment(cantidad);
          break;
        case 'Peru':
          updateData.stockPeru = increment(cantidad);
          break;
        case 'transito':
          updateData.stockTransito = increment(cantidad);
          break;
      }

      await updateDoc(docRef, updateData);
    } catch (error: any) {
      logger.error('Error al incrementar stock:', error);
      throw new Error('Error al incrementar stock');
    }
  }

  /**
   * Decrementar stock de un producto
   * @param id ID del producto
   * @param cantidad Cantidad a decrementar (positiva)
   * @param pais 'USA' o 'Peru' o 'transito'
   */
  static async decrementarStock(id: string, cantidad: number, pais: string): Promise<void> {
    return this.incrementarStock(id, -cantidad, pais);
  }

  /**
   * Generar SKU automático con prefijo de línea de negocio
   * Ejemplos: SUP-0001, SKC-0001, BMN-0001 (fallback)
   */
  private static async generateSKU(prefix: string = 'BMN'): Promise<string> {
    return getNextSequenceNumber(prefix, 4);
  }

  /**
   * Obtener el próximo SKU que se generará (para mostrar en UI)
   * Solo lectura — NO incrementa el contador
   * @param lineaCodigo - Código de la línea de negocio (ej: 'SUP', 'SKC')
   */
  static async getProximoSKU(lineaCodigo?: string): Promise<string> {
    const { peekNextSequenceNumber } = await import('../lib/sequenceGenerator');
    return peekNextSequenceNumber(lineaCodigo || 'BMN', 4);
  }

  /**
   * Buscar productos por texto
   */
  static async search(searchTerm: string): Promise<Producto[]> {
    try {
      const allProducts = await this.getAll();

      const term = searchTerm.toLowerCase();

      return allProducts.filter(p =>
        p.sku.toLowerCase().includes(term) ||
        p.marca.toLowerCase().includes(term) ||
        p.nombreComercial.toLowerCase().includes(term) ||
        p.grupo.toLowerCase().includes(term) ||
        p.subgrupo.toLowerCase().includes(term)
      );
    } catch (error: any) {
      logger.error('Error al buscar productos:', error);
      throw new Error('Error al buscar productos');
    }
  }

  // ============================================
  // INVESTIGACIÓN DE MERCADO
  // ============================================

  /**
   * Elimina propiedades con valor undefined de un objeto (recursivo)
   * Firestore no acepta valores undefined
   */
  private static removeUndefined<T extends Record<string, any>>(obj: T): T {
    const cleaned = {} as T;
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value === undefined) {
        // Saltar valores undefined
        continue;
      } else if (value === null) {
        // Mantener null (Firestore lo acepta)
        cleaned[key as keyof T] = value;
      } else if (Array.isArray(value)) {
        // Limpiar arrays recursivamente
        cleaned[key as keyof T] = value.map(item => {
          if (item && typeof item === 'object' && !this.isTimestamp(item)) {
            return this.removeUndefined(item);
          }
          return item;
        }) as any;
      } else if (typeof value === 'object' && !this.isTimestamp(value)) {
        // Limpiar objetos recursivamente (pero no Timestamps de Firestore)
        cleaned[key as keyof T] = this.removeUndefined(value);
      } else {
        cleaned[key as keyof T] = value;
      }
    }
    return cleaned;
  }

  /**
   * Verifica si un objeto es un Timestamp de Firestore
   */
  private static isTimestamp(obj: any): boolean {
    return obj && (
      obj instanceof Timestamp ||
      (typeof obj.toDate === 'function' && typeof obj.seconds === 'number')
    );
  }

  /**
   * Crear o actualizar investigación de mercado de un producto
   */
  static async guardarInvestigacion(
    productoId: string,
    data: InvestigacionFormData,
    userId: string,
    tipoCambio?: number
  ): Promise<InvestigacionMercado> {
    try {
      // Si no se provee TC, resolver del servicio centralizado
      if (!tipoCambio) {
        const { tipoCambioService } = await import('./tipoCambio.service');
        tipoCambio = await tipoCambioService.resolverTCVenta();
      }

      const producto = await this.getById(productoId);
      if (!producto) {
        throw new Error('Producto no encontrado');
      }

      // Convertir proveedores al formato con Timestamp (limpiando undefined)
      const proveedoresUSA = (data.proveedoresUSA || []).map(p => this.removeUndefined({
        id: p.id,
        nombre: p.nombre || '',
        precio: p.precio || 0,
        impuesto: p.impuesto || 0,  // Sales tax del estado USA (%)
        url: p.url || null,
        disponibilidad: p.disponibilidad || 'desconocido',
        envioEstimado: p.envioEstimado || null,
        notas: p.notas || null,
        fechaConsulta: Timestamp.now()
      }));

      // Convertir competidores al formato con Timestamp (limpiando undefined)
      let competidoresPeru = (data.competidoresPeru || []).map(c => this.removeUndefined({
        id: c.id,
        competidorId: c.competidorId || null,  // Vínculo con Gestor Maestro
        nombre: c.nombre || '',
        plataforma: c.plataforma || 'mercado_libre',
        precio: c.precio || 0,
        url: c.url || null,
        ventas: c.ventas || null,
        reputacion: c.reputacion || 'desconocida',
        esLiderCategoria: c.esLiderCategoria || false,
        notas: c.notas || null,
        fechaConsulta: Timestamp.now()
      }));

      // === AUTO-CREAR PROVEEDORES NO VINCULADOS EN GESTOR MAESTRO ===
      for (let i = 0; i < proveedoresUSA.length; i++) {
        const prov = proveedoresUSA[i];
        const provExtended = prov as any;

        // Si tiene nombre pero no está vinculado a Maestro, crear automáticamente
        if (prov.nombre && prov.nombre.trim() && !provExtended.proveedorId) {
          try {
            // Usar getOrCreate para evitar duplicados
            const { proveedor, esNuevo } = await proveedorService.getOrCreate(
              prov.nombre.trim(),
              'USA',
              'distribuidor',
              userId
            );

            // Vincular el ID del proveedor creado/encontrado
            proveedoresUSA[i] = {
              ...prov,
              proveedorId: proveedor.id
            } as any;

          } catch (error) {
            logger.warn(`No se pudo auto-crear proveedor "${prov.nombre}":`, error);
          }
        }
      }

      // === AUTO-CREAR COMPETIDORES NO VINCULADOS EN GESTOR MAESTRO ===
      for (let i = 0; i < competidoresPeru.length; i++) {
        const comp = competidoresPeru[i];

        // Si tiene nombre pero no está vinculado a Maestro, crear automáticamente
        if (comp.nombre && comp.nombre.trim() && !comp.competidorId) {
          try {
            // Verificar si ya existe un competidor con ese nombre
            const existente = await competidorService.buscarPorNombreExacto(comp.nombre.trim());

            if (existente) {
              // Vincular al competidor existente
              competidoresPeru[i] = {
                ...comp,
                competidorId: existente.id
              };
            } else {
              // Crear nuevo competidor en Gestor Maestro
              const nuevoCompetidorId = await competidorService.create({
                nombre: comp.nombre.trim(),
                plataformaPrincipal: comp.plataforma || 'mercado_libre',
                reputacion: comp.reputacion || 'desconocida',
                nivelAmenaza: 'medio',
                esLiderCategoria: comp.esLiderCategoria || false
              }, userId);

              // Vincular el ID del competidor creado
              competidoresPeru[i] = {
                ...comp,
                competidorId: nuevoCompetidorId
              };

            }
          } catch (error) {
            logger.warn(`No se pudo auto-crear competidor "${comp.nombre}":`, error);
          }
        }
      }

      // Calcular precios desde proveedores INCLUYENDO IMPUESTO
      const preciosUSAConImpuesto = proveedoresUSA.map(p => {
        const impuestoDecimal = (p.impuesto || 0) / 100;
        return p.precio * (1 + impuestoDecimal);
      }).filter(p => p > 0);

      const precioUSAMin = preciosUSAConImpuesto.length > 0
        ? Math.min(...preciosUSAConImpuesto)
        : (data.precioUSAMin || 0);
      const precioUSAMax = preciosUSAConImpuesto.length > 0
        ? Math.max(...preciosUSAConImpuesto)
        : (data.precioUSAMax || 0);
      const precioUSAPromedio = preciosUSAConImpuesto.length > 0
        ? preciosUSAConImpuesto.reduce((a, b) => a + b, 0) / preciosUSAConImpuesto.length
        : (data.precioUSAPromedio || 0);

      // Encontrar mejor proveedor (el que tiene menor precio CON impuesto)
      const mejorProveedor = proveedoresUSA.find(p => {
        const impuestoDecimal = (p.impuesto || 0) / 100;
        const precioConImpuesto = p.precio * (1 + impuestoDecimal);
        return precioConImpuesto === precioUSAMin && precioConImpuesto > 0;
      });

      // Calcular precios desde competidores
      const preciosPeru = competidoresPeru.map(c => c.precio).filter(p => p > 0);
      const precioPERUMin = preciosPeru.length > 0 ? Math.min(...preciosPeru) : (data.precioPERUMin || 0);
      const precioPERUMax = preciosPeru.length > 0 ? Math.max(...preciosPeru) : (data.precioPERUMax || 0);
      const precioPERUPromedio = preciosPeru.length > 0
        ? preciosPeru.reduce((a, b) => a + b, 0) / preciosPeru.length
        : (data.precioPERUPromedio || 0);

      // Encontrar competidor principal (el de más ventas o marcado como líder)
      const competidorPrincipal = competidoresPeru.find(c => c.esLiderCategoria) ||
        competidoresPeru.sort((a, b) => (b.ventas || 0) - (a.ventas || 0))[0];

      // Calcular estimaciones con el mejor precio USA
      const logisticaEstimada = data.logisticaEstimada || 5;
      const mejorPrecioUSA = precioUSAMin > 0 ? precioUSAMin : precioUSAPromedio;
      const costoTotalUSD = mejorPrecioUSA + logisticaEstimada;
      const ctruEstimado = costoTotalUSD * tipoCambio;

      // Calcular precio sugerido con margen objetivo
      const categoriaPrincipal = producto.categorias?.find((c: any) => c.id === producto.categoriaPrincipalId) || producto.categorias?.[0];
      const margenObjetivo = categoriaPrincipal?.margenObjetivo ?? 30;
      const precioSugeridoCalculado = ctruEstimado > 0
        ? ctruEstimado / (1 - margenObjetivo / 100)
        : 0;

      // Calcular margen estimado basado en precio Perú promedio
      const margenEstimado = precioPERUPromedio > 0 && ctruEstimado > 0
        ? ((precioPERUPromedio - ctruEstimado) / precioPERUPromedio) * 100
        : 0;

      // Precio de entrada competitivo (5% menos que el más bajo)
      const precioEntrada = precioPERUMin > 0 ? precioPERUMin * 0.95 : precioSugeridoCalculado;

      // Detectar presencia en ML
      const presenciaML = data.presenciaML || competidoresPeru.some(c => c.plataforma === 'mercado_libre');
      const numeroCompetidores = competidoresPeru.length;

      // Calcular puntuación de viabilidad
      let puntuacionViabilidad = 0;
      if (margenEstimado >= 30) puntuacionViabilidad += 30;
      else if (margenEstimado >= 20) puntuacionViabilidad += 20;
      else if (margenEstimado >= 15) puntuacionViabilidad += 10;

      if (data.demandaEstimada === 'alta') puntuacionViabilidad += 25;
      else if (data.demandaEstimada === 'media') puntuacionViabilidad += 15;
      else puntuacionViabilidad += 5;

      if (data.tendencia === 'subiendo') puntuacionViabilidad += 20;
      else if (data.tendencia === 'estable') puntuacionViabilidad += 10;

      if (data.nivelCompetencia === 'baja') puntuacionViabilidad += 25;
      else if (data.nivelCompetencia === 'media') puntuacionViabilidad += 15;
      else if (data.nivelCompetencia === 'alta') puntuacionViabilidad += 5;

      // Fechas de vigencia (+60 días)
      const ahora = new Date();
      const vigenciaHasta = new Date(ahora);
      vigenciaHasta.setDate(vigenciaHasta.getDate() + 60);

      // === HISTORIAL DE PRECIOS ===
      // Obtener historial existente o crear uno nuevo
      const historialExistente = producto.investigacion?.historialPrecios || [];

      // Crear nuevo registro de historial
      const nuevoRegistroHistorial: HistorialPrecio = {
        fecha: Timestamp.now(),
        precioUSAPromedio,
        precioUSAMin,
        precioPERUPromedio,
        precioPERUMin,
        margenEstimado,
        tipoCambio
      };

      // Agregar al historial (mantener máximo 20 registros)
      const historialPrecios = [...historialExistente, nuevoRegistroHistorial].slice(-20);

      // === ALERTAS AUTOMÁTICAS ===
      const alertasExistentes = producto.investigacion?.alertas || [];
      const nuevasAlertas: AlertaInvestigacion[] = [];

      // Alerta: Margen bajo
      if (margenEstimado > 0 && margenEstimado < 15) {
        nuevasAlertas.push({
          id: `alerta-margen-${Date.now()}`,
          tipo: 'margen_bajo',
          mensaje: `Margen estimado muy bajo (${margenEstimado.toFixed(1)}%). Revisar viabilidad del producto.`,
          severidad: margenEstimado < 10 ? 'danger' : 'warning',
          fecha: Timestamp.now(),
          leida: false,
          datos: { margenEstimado }
        });
      }

      // Alerta: Precio de competidor más bajo que nuestro costo
      if (precioPERUMin > 0 && ctruEstimado > 0 && precioPERUMin < ctruEstimado) {
        nuevasAlertas.push({
          id: `alerta-precio-${Date.now()}`,
          tipo: 'precio_competidor',
          mensaje: `El precio más bajo del mercado (S/${precioPERUMin.toFixed(2)}) es menor que tu CTRU estimado (S/${ctruEstimado.toFixed(2)}).`,
          severidad: 'danger',
          fecha: Timestamp.now(),
          leida: false,
          datos: { precioPERUMin, ctruEstimado }
        });
      }

      // Alerta: Sin stock en proveedores USA
      const proveedoresSinStock = proveedoresUSA.filter(p => p.disponibilidad === 'sin_stock');
      if (proveedoresSinStock.length > 0 && proveedoresSinStock.length === proveedoresUSA.length) {
        nuevasAlertas.push({
          id: `alerta-stock-${Date.now()}`,
          tipo: 'sin_stock',
          mensaje: `Ningún proveedor USA tiene stock disponible.`,
          severidad: 'warning',
          fecha: Timestamp.now(),
          leida: false,
          datos: { proveedoresSinStock: proveedoresSinStock.map(p => p.nombre) }
        });
      }

      // Combinar alertas (mantener las no leídas antiguas + nuevas)
      const alertasNoLeidas = alertasExistentes.filter(a => !a.leida);
      const alertas = [...alertasNoLeidas, ...nuevasAlertas].slice(-10);

      // Construir objeto de investigación limpiando valores undefined
      const investigacion = this.removeUndefined({
        id: `INV-${productoId}-${Date.now()}`,
        productoId,

        // Proveedores USA
        proveedoresUSA,
        precioUSAMin,
        precioUSAMax,
        precioUSAPromedio,
        proveedorRecomendado: mejorProveedor?.id || null,

        // Competidores Perú
        competidoresPeru,
        precioPERUMin,
        precioPERUMax,
        precioPERUPromedio,
        competidorPrincipal: competidorPrincipal?.id || null,

        // Análisis de competencia
        presenciaML,
        numeroCompetidores,
        nivelCompetencia: data.nivelCompetencia,
        ventajasCompetitivas: data.ventajasCompetitivas || null,

        // Estimaciones calculadas
        ctruEstimado,
        logisticaEstimada,
        precioSugeridoCalculado,
        margenEstimado,
        precioEntrada,

        // Demanda
        demandaEstimada: data.demandaEstimada,
        tendencia: data.tendencia,
        volumenMercadoEstimado: data.volumenMercadoEstimado || null,

        // Recomendación
        recomendacion: data.recomendacion,
        razonamiento: data.razonamiento || null,
        puntuacionViabilidad: Math.min(100, puntuacionViabilidad),

        // Vigencia
        fechaInvestigacion: Timestamp.now(),
        vigenciaHasta: Timestamp.fromDate(vigenciaHasta),
        estaVigente: true,

        // Notas
        notas: data.notas || null,

        // Historial y Alertas
        historialPrecios,
        alertas,

        // Auditoría
        realizadoPor: userId,
        fechaCreacion: producto.investigacion?.fechaCreacion || Timestamp.now(),
        ultimaActualizacion: Timestamp.now()
      }) as InvestigacionMercado;

      // Actualizar el producto con la investigación
      const docRef = doc(db, COLLECTION_NAME, productoId);
      await updateDoc(docRef, {
        investigacion,
        ultimaEdicion: serverTimestamp()
      });

      // === ACTUALIZAR MÉTRICAS DE COMPETIDORES EN GESTOR MAESTRO ===
      // Obtener competidorIds que ya existían en la investigación anterior
      const competidorIdsAnteriores = new Set(
        (producto.investigacion?.competidoresPeru || [])
          .map((c: any) => c.competidorId)
          .filter(Boolean)
      );

      // Agrupar precios por competidorId para calcular promedio
      const metricasPorCompetidor = new Map<string, { precios: number[]; esNuevo: boolean }>();

      for (const comp of competidoresPeru) {
        if (comp.competidorId) {
          const existing = metricasPorCompetidor.get(comp.competidorId) || {
            precios: [],
            esNuevo: !competidorIdsAnteriores.has(comp.competidorId)
          };
          if (comp.precio > 0) {
            existing.precios.push(comp.precio);
          }
          metricasPorCompetidor.set(comp.competidorId, existing);
        }
      }

      // Actualizar métricas de cada competidor vinculado
      for (const [competidorId, metricas] of metricasPorCompetidor) {
        try {
          const precioPromedio = metricas.precios.length > 0
            ? metricas.precios.reduce((a, b) => a + b, 0) / metricas.precios.length
            : 0;

          // Solo incrementar contador si es un vínculo NUEVO (no existía antes)
          if (metricas.esNuevo) {
            const competidorActual = await competidorService.getById(competidorId);
            const productosActuales = competidorActual?.metricas?.productosAnalizados || 0;

            // Actualizar métricas del competidor
            await updateDoc(doc(db, COLLECTIONS.COMPETIDORES, competidorId), {
              'metricas.productosAnalizados': productosActuales + 1,
              'metricas.precioPromedio': precioPromedio,
              'metricas.ultimaInvestigacion': serverTimestamp()
            });
          } else {
            // Solo actualizar precio promedio, sin incrementar contador
            await updateDoc(doc(db, COLLECTIONS.COMPETIDORES, competidorId), {
              'metricas.precioPromedio': precioPromedio,
              'metricas.ultimaInvestigacion': serverTimestamp()
            });
          }
        } catch (error) {
          logger.warn(`No se pudo actualizar métricas del competidor ${competidorId}:`, error);
        }
      }

      // === ACTUALIZAR MÉTRICAS DE PROVEEDORES EN GESTOR MAESTRO ===
      // Obtener proveedorIds que ya existían en la investigación anterior
      const proveedorIdsAnteriores = new Set(
        (producto.investigacion?.proveedoresUSA || [])
          .map((p: any) => p.proveedorId)
          .filter(Boolean)
      );

      // Agrupar precios por proveedorId para calcular promedio
      const metricasPorProveedor = new Map<string, { precios: number[]; esNuevo: boolean }>();

      for (const prov of proveedoresUSA) {
        const provExtended = prov as any;
        if (provExtended.proveedorId) {
          const existing = metricasPorProveedor.get(provExtended.proveedorId) || {
            precios: [],
            esNuevo: !proveedorIdsAnteriores.has(provExtended.proveedorId)
          };
          if (prov.precio > 0) {
            existing.precios.push(prov.precio);
          }
          metricasPorProveedor.set(provExtended.proveedorId, existing);
        }
      }

      // Actualizar métricas de cada proveedor vinculado
      for (const [proveedorId, metricas] of metricasPorProveedor) {
        try {
          const precioPromedio = metricas.precios.length > 0
            ? metricas.precios.reduce((a, b) => a + b, 0) / metricas.precios.length
            : 0;

          // Solo incrementar contador si es un vínculo NUEVO (no existía antes)
          if (metricas.esNuevo) {
            const proveedorActual = await proveedorService.getById(proveedorId);
            const productosActuales = proveedorActual?.metricas?.productosAnalizados || 0;

            await proveedorService.actualizarMetricasInvestigacion(proveedorId, {
              productosAnalizados: productosActuales + 1,
              precioPromedio
            });
          } else {
            // Solo actualizar precio promedio, sin incrementar contador
            await proveedorService.actualizarMetricasInvestigacion(proveedorId, {
              precioPromedio
            });
          }
        } catch (error) {
          logger.warn(`No se pudo actualizar métricas del proveedor ${proveedorId}:`, error);
        }
      }

      return investigacion;
    } catch (error: any) {
      logger.error('Error al guardar investigación:', error);
      throw new Error(`Error al guardar investigación: ${error.message}`);
    }
  }

  /**
   * Obtener resumen de investigación de un producto
   */
  static getResumenInvestigacion(producto: Producto): InvestigacionResumen {
    if (!producto.investigacion) {
      return {
        tieneInvestigacion: false,
        estaVigente: false
      };
    }

    const inv = producto.investigacion;
    const ahora = new Date();
    const vigenciaHasta = inv.vigenciaHasta?.toDate?.() || new Date();
    const estaVigente = vigenciaHasta > ahora;
    const diasRestantes = Math.ceil((vigenciaHasta.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

    // Calcular alertas no leídas
    const alertasActivas = (inv.alertas || []).filter(a => !a.leida).length;

    // Calcular tendencia de precios basada en historial
    let tendenciaPrecio: 'subiendo' | 'bajando' | 'estable' | undefined;
    if (inv.historialPrecios && inv.historialPrecios.length >= 2) {
      const ultimos = inv.historialPrecios.slice(-3);
      const primero = ultimos[0].margenEstimado;
      const ultimo = ultimos[ultimos.length - 1].margenEstimado;
      const diferencia = ultimo - primero;

      if (diferencia > 2) tendenciaPrecio = 'subiendo';
      else if (diferencia < -2) tendenciaPrecio = 'bajando';
      else tendenciaPrecio = 'estable';
    }

    return {
      tieneInvestigacion: true,
      estaVigente,
      diasRestantes: estaVigente ? diasRestantes : 0,
      precioUSAPromedio: inv.precioUSAPromedio,
      precioPERUPromedio: inv.precioPERUPromedio,
      margenEstimado: inv.margenEstimado,
      recomendacion: inv.recomendacion,
      fechaInvestigacion: inv.fechaInvestigacion?.toDate?.(),
      alertasActivas,
      tendenciaPrecio
    };
  }

  /**
   * Calcular punto de equilibrio de inversión
   *
   * Métricas clave:
   * - Recuperación de Capital: ¿Cuántas unidades vender para que los INGRESOS cubran la INVERSIÓN?
   *   Formula: unidades = inversión / precioVenta
   *   Ejemplo: S/1775 inversión / S/140 precio = 12.68 ≈ 13 unidades
   *
   * - ROI 100%: ¿Cuántas unidades vender para que la GANANCIA ACUMULADA = INVERSIÓN?
   *   Formula: unidades = inversión / gananciaUnitaria
   *   Ejemplo: S/1775 inversión / S/66 ganancia = 26.9 unidades (pero limitado a unidades compradas)
   */
  static calcularPuntoEquilibrio(
    ctruEstimado: number,
    precioVenta: number,
    inversionInicial: number = 500,
    ventasMensualesEstimadas: number = 20,
    unidadesCompradas?: number
  ): PuntoEquilibrio {
    const gananciaUnitaria = precioVenta - ctruEstimado;

    // Calcular unidades compradas si no se proporciona
    const unidadesTotales = unidadesCompradas ?? (ctruEstimado > 0
      ? Math.round(inversionInicial / ctruEstimado)
      : 0);

    // Si no hay ganancia, retornar valores de advertencia
    if (gananciaUnitaria <= 0 || precioVenta <= 0) {
      return {
        unidadesParaRecuperarCapital: Infinity,
        unidadesParaROI100: Infinity,
        inversionTotal: inversionInicial,
        gananciaUnitaria: gananciaUnitaria,
        tiempoRecuperacionCapital: Infinity,
        tiempoROI100: Infinity,
        rentabilidadMensual: 0,
        gananciaTotalPotencial: unidadesTotales * gananciaUnitaria,
        roiTotalPotencial: 0,
        // Deprecados - mantener para compatibilidad
        unidadesNecesarias: Infinity,
        tiempoRecuperacion: Infinity
      };
    }

    // RECUPERACIÓN DE CAPITAL: ¿Cuándo los ingresos cubren la inversión?
    // ingresos = n × precioVenta >= inversión
    // n = inversión / precioVenta
    const unidadesParaRecuperarCapital = Math.ceil(inversionInicial / precioVenta);

    // ROI 100%: ¿Cuándo la ganancia acumulada = inversión?
    // gananciaAcumulada = n × gananciaUnitaria >= inversión
    // n = inversión / gananciaUnitaria
    const unidadesParaROI100Raw = Math.ceil(inversionInicial / gananciaUnitaria);
    // Limitar a unidades disponibles (no puedes vender más de lo que compraste)
    const unidadesParaROI100 = Math.min(unidadesParaROI100Raw, unidadesTotales);

    // Tiempos de recuperación
    const tiempoRecuperacionCapital = ventasMensualesEstimadas > 0
      ? unidadesParaRecuperarCapital / ventasMensualesEstimadas
      : Infinity;

    const tiempoROI100 = ventasMensualesEstimadas > 0
      ? unidadesParaROI100Raw / ventasMensualesEstimadas
      : Infinity;

    // Rentabilidad mensual estimada
    const gananciaMensual = ventasMensualesEstimadas * gananciaUnitaria;
    const rentabilidadMensual = inversionInicial > 0
      ? (gananciaMensual / inversionInicial) * 100
      : 0;

    // Ganancia total potencial si se vende todo el inventario
    const gananciaTotalPotencial = unidadesTotales * gananciaUnitaria;
    const roiTotalPotencial = inversionInicial > 0
      ? (gananciaTotalPotencial / inversionInicial) * 100
      : 0;

    return {
      unidadesParaRecuperarCapital,
      unidadesParaROI100,
      inversionTotal: inversionInicial,
      gananciaUnitaria,
      tiempoRecuperacionCapital: Math.round(tiempoRecuperacionCapital * 10) / 10,
      tiempoROI100: Math.round(tiempoROI100 * 10) / 10,
      rentabilidadMensual: Math.round(rentabilidadMensual * 10) / 10,
      gananciaTotalPotencial: Math.round(gananciaTotalPotencial * 100) / 100,
      roiTotalPotencial: Math.round(roiTotalPotencial * 10) / 10,
      // Deprecados - mantener para compatibilidad
      unidadesNecesarias: unidadesParaRecuperarCapital,
      tiempoRecuperacion: Math.round(tiempoRecuperacionCapital * 10) / 10
    };
  }

  /**
   * Marcar alertas como leídas
   */
  static async marcarAlertasLeidas(productoId: string, alertaIds?: string[]): Promise<void> {
    try {
      const producto = await this.getById(productoId);
      if (!producto?.investigacion?.alertas) return;

      const alertasActualizadas = producto.investigacion.alertas.map(a => {
        if (!alertaIds || alertaIds.includes(a.id)) {
          return { ...a, leida: true };
        }
        return a;
      });

      const docRef = doc(db, COLLECTION_NAME, productoId);
      await updateDoc(docRef, {
        'investigacion.alertas': alertasActualizadas
      });
    } catch (error: any) {
      logger.error('Error al marcar alertas como leídas:', error);
    }
  }

  /**
   * Eliminar investigación de un producto
   */
  static async eliminarInvestigacion(productoId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, productoId);
      await updateDoc(docRef, {
        investigacion: null,
        ultimaEdicion: serverTimestamp()
      });
    } catch (error: any) {
      logger.error('Error al eliminar investigación:', error);
      throw new Error('Error al eliminar investigación');
    }
  }

  /**
   * Verificar y actualizar vigencia de investigaciones
   * (Puede llamarse periódicamente o al cargar productos)
   */
  static async actualizarVigenciaInvestigaciones(): Promise<number> {
    try {
      const productos = await this.getAll();
      let actualizados = 0;
      const ahora = new Date();

      for (const producto of productos) {
        if (producto.investigacion) {
          const vigenciaHasta = producto.investigacion.vigenciaHasta?.toDate?.();
          const estaVigente = vigenciaHasta && vigenciaHasta > ahora;

          if (producto.investigacion.estaVigente !== estaVigente) {
            const docRef = doc(db, COLLECTION_NAME, producto.id);
            await updateDoc(docRef, {
              'investigacion.estaVigente': estaVigente
            });
            actualizados++;
          }
        }
      }

      return actualizados;
    } catch (error: any) {
      logger.error('Error al actualizar vigencias:', error);
      return 0;
    }
  }

  /**
   * Obtener productos con investigación vencida
   */
  static async getProductosInvestigacionVencida(): Promise<Producto[]> {
    try {
      const productos = await this.getAll();
      const ahora = new Date();

      return productos.filter(p => {
        if (!p.investigacion) return false;
        const vigenciaHasta = p.investigacion.vigenciaHasta?.toDate?.();
        return vigenciaHasta && vigenciaHasta <= ahora;
      });
    } catch (error: any) {
      logger.error('Error al obtener productos con investigación vencida:', error);
      return [];
    }
  }

  /**
   * Obtener productos sin investigación
   */
  static async getProductosSinInvestigacion(): Promise<Producto[]> {
    try {
      const productos = await this.getAll();
      return productos.filter(p => !p.investigacion);
    } catch (error: any) {
      logger.error('Error al obtener productos sin investigación:', error);
      return [];
    }
  }

  /**
   * Obtener valores únicos de un campo específico
   * Útil para autocompletado de campos como marca, grupo, subgrupo, etc.
   */
  static async getUniqueValues(field: 'marca' | 'nombreComercial' | 'grupo' | 'subgrupo' | 'presentacion' | 'dosaje' | 'contenido'): Promise<string[]> {
    try {
      const allProducts = await this.getAll();

      const values = new Set<string>();

      allProducts.forEach(p => {
        const value = p[field];
        if (value && typeof value === 'string' && value.trim()) {
          values.add(value.trim());
        }
      });

      return Array.from(values).sort((a, b) => a.localeCompare(b, 'es'));
    } catch (error: any) {
      logger.error(`Error al obtener valores únicos de ${field}:`, error);
      return [];
    }
  }

  /**
   * Obtener nombres únicos de proveedores USA y competidores Perú
   * de las investigaciones existentes para autocompletado inteligente
   */
  static async getUniqueInvestigacionValues(): Promise<{
    proveedoresUSA: string[];
    competidoresPeru: string[];
    plataformas: string[];
  }> {
    try {
      const allProducts = await this.getAll();

      const proveedoresUSA = new Set<string>();
      const competidoresPeru = new Set<string>();
      const plataformas = new Set<string>();

      allProducts.forEach(p => {
        if (p.investigacion) {
          // Extraer nombres de proveedores USA
          p.investigacion.proveedoresUSA?.forEach(prov => {
            if (prov.nombre?.trim()) {
              proveedoresUSA.add(prov.nombre.trim());
            }
          });

          // Extraer nombres de competidores Perú
          p.investigacion.competidoresPeru?.forEach(comp => {
            if (comp.nombre?.trim()) {
              competidoresPeru.add(comp.nombre.trim());
            }
            if (comp.plataforma?.trim()) {
              plataformas.add(comp.plataforma.trim());
            }
          });
        }
      });

      const sortFn = (a: string, b: string) => a.localeCompare(b, 'es');

      return {
        proveedoresUSA: Array.from(proveedoresUSA).sort(sortFn),
        competidoresPeru: Array.from(competidoresPeru).sort(sortFn),
        plataformas: Array.from(plataformas).sort(sortFn),
      };
    } catch (error: any) {
      logger.error('Error al obtener valores únicos de investigación:', error);
      return {
        proveedoresUSA: [],
        competidoresPeru: [],
        plataformas: [],
      };
    }
  }

  /**
   * Obtener todos los valores únicos para autocompletado
   * Devuelve un objeto con todos los campos relevantes
   */
  static async getAllUniqueValues(): Promise<{
    marcas: string[];
    nombresComerciales: string[];
    grupos: string[];
    subgrupos: string[];
    presentaciones: string[];
    dosajes: string[];
    contenidos: string[];
  }> {
    try {
      const allProducts = await this.getAll();

      const marcas = new Set<string>();
      const nombresComerciales = new Set<string>();
      const grupos = new Set<string>();
      const subgrupos = new Set<string>();
      const presentaciones = new Set<string>();
      const dosajes = new Set<string>();
      const contenidos = new Set<string>();

      allProducts.forEach(p => {
        if (p.marca?.trim()) marcas.add(p.marca.trim());
        if (p.nombreComercial?.trim()) nombresComerciales.add(p.nombreComercial.trim());
        if (p.grupo?.trim()) grupos.add(p.grupo.trim());
        if (p.subgrupo?.trim()) subgrupos.add(p.subgrupo.trim());
        if (p.presentacion?.trim()) presentaciones.add(p.presentacion.trim());
        if (p.dosaje?.trim()) dosajes.add(p.dosaje.trim());
        if (p.contenido?.trim()) contenidos.add(p.contenido.trim());
      });

      const sortFn = (a: string, b: string) => a.localeCompare(b, 'es');

      return {
        marcas: Array.from(marcas).sort(sortFn),
        nombresComerciales: Array.from(nombresComerciales).sort(sortFn),
        grupos: Array.from(grupos).sort(sortFn),
        subgrupos: Array.from(subgrupos).sort(sortFn),
        presentaciones: Array.from(presentaciones).sort(sortFn),
        dosajes: Array.from(dosajes).sort(sortFn),
        contenidos: Array.from(contenidos).sort(sortFn),
      };
    } catch (error: any) {
      logger.error('Error al obtener valores únicos:', error);
      return {
        marcas: [],
        nombresComerciales: [],
        grupos: [],
        subgrupos: [],
        presentaciones: [],
        dosajes: [],
        contenidos: [],
      };
    }
  }
}