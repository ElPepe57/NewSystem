import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import type {
  Etiqueta,
  EtiquetaFormData,
  EtiquetaFiltros,
  EtiquetaSnapshot,
  EtiquetaStats,
  EtiquetasAgrupadas,
  TipoEtiqueta,
  EstadoEtiqueta
} from '../types/etiqueta.types';

const COLLECTION_NAME = COLLECTIONS.ETIQUETAS;

/**
 * Normalizar texto para busqueda y slug
 */
const normalizarTexto = (texto: string): string => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s-]/g, '')    // Solo alfanumericos y guiones
    .trim();
};

/**
 * Generar slug URL-friendly
 */
const generarSlug = (texto: string): string => {
  return normalizarTexto(texto).replace(/\s+/g, '-');
};

/**
 * Genera el siguiente codigo automaticamente
 * Formato: ETQ-001, ETQ-002, etc.
 */
async function generarCodigo(): Promise<string> {
  return getNextSequenceNumber('ETQ', 3);
}

/**
 * Obtener siguiente orden display
 */
async function getSiguienteOrdenDisplay(): Promise<number> {
  const todas = await etiquetaService.getAll();
  if (todas.length === 0) return 1;
  return Math.max(...todas.map(e => e.ordenDisplay || 0)) + 1;
}

export const etiquetaService = {
  /**
   * Obtener todas las etiquetas
   */
  async getAll(): Promise<Etiqueta[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const etiquetas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Etiqueta[];
      return etiquetas.sort((a, b) => (a.ordenDisplay || 0) - (b.ordenDisplay || 0));
    } catch (error: any) {
      console.error('Error al obtener etiquetas:', error);
      throw new Error('Error al cargar etiquetas');
    }
  },

  /**
   * Obtener etiquetas activas
   */
  async getActivas(): Promise<Etiqueta[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estado', '==', 'activa')
      );
      const snapshot = await getDocs(q);
      const etiquetas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Etiqueta[];
      return etiquetas.sort((a, b) => (a.ordenDisplay || 0) - (b.ordenDisplay || 0));
    } catch (error: any) {
      console.error('Error al obtener etiquetas activas:', error);
      throw new Error('Error al cargar etiquetas');
    }
  },

  /**
   * Obtener etiquetas agrupadas por tipo
   */
  async getAgrupadas(): Promise<EtiquetasAgrupadas> {
    const activas = await this.getActivas();

    return {
      atributo: activas.filter(e => e.tipo === 'atributo'),
      marketing: activas.filter(e => e.tipo === 'marketing'),
      origen: activas.filter(e => e.tipo === 'origen')
    };
  },

  /**
   * Obtener etiquetas por tipo
   */
  async getByTipo(tipo: TipoEtiqueta): Promise<Etiqueta[]> {
    const activas = await this.getActivas();
    return activas.filter(e => e.tipo === tipo);
  },

  /**
   * Obtener etiquetas que se muestran en filtros
   */
  async getParaFiltros(): Promise<Etiqueta[]> {
    const activas = await this.getActivas();
    return activas.filter(e => e.mostrarEnFiltros);
  },

  /**
   * Obtener etiquetas filtradas por linea de negocio
   * Retorna etiquetas que no tienen lineaNegocioIds (globales) o que incluyen esta linea
   */
  async getByLineaNegocio(lineaNegocioId: string): Promise<Etiqueta[]> {
    const todas = await this.getActivas();
    return todas.filter(e =>
      !e.lineaNegocioIds?.length || e.lineaNegocioIds.includes(lineaNegocioId)
    );
  },

  /**
   * Obtener una etiqueta por ID
   */
  async getById(id: string): Promise<Etiqueta | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Etiqueta;
    } catch (error: any) {
      console.error('Error al obtener etiqueta:', error);
      throw new Error('Error al cargar etiqueta');
    }
  },

  /**
   * Buscar etiqueta por nombre
   */
  async buscarPorNombre(nombre: string): Promise<Etiqueta | null> {
    try {
      const nombreNorm = normalizarTexto(nombre);
      const todas = await this.getAll();
      return todas.find(e => e.nombreNormalizado === nombreNorm) || null;
    } catch (error: any) {
      console.error('Error al buscar etiqueta:', error);
      return null;
    }
  },

  /**
   * Crear nueva etiqueta
   */
  async create(data: EtiquetaFormData, userId: string): Promise<Etiqueta> {
    try {
      // Verificar duplicados
      const existente = await this.buscarPorNombre(data.nombre);
      if (existente) {
        throw new Error(`Ya existe una etiqueta con el nombre "${existente.nombre}"`);
      }

      const codigo = await generarCodigo();
      const nombreNormalizado = normalizarTexto(data.nombre);
      const slug = generarSlug(data.nombre);
      const ordenDisplay = data.ordenDisplay || await getSiguienteOrdenDisplay();

      const nuevaEtiqueta: Omit<Etiqueta, 'id'> = {
        codigo,
        nombre: data.nombre.trim(),
        nombreNormalizado,
        slug,
        tipo: data.tipo,
        grupo: data.grupo || '',
        icono: data.icono || '',
        colorFondo: data.colorFondo || '#F3F4F6',
        colorTexto: data.colorTexto || '#4B5563',
        colorBorde: data.colorBorde || '#D1D5DB',
        ...(data.lineaNegocioIds?.length ? { lineaNegocioIds: data.lineaNegocioIds } : {}),
        estado: 'activa',
        mostrarEnFiltros: data.mostrarEnFiltros ?? true,
        ordenDisplay,
        productosActivos: 0,
        creadoPor: userId,
        fechaCreacion: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevaEtiqueta);
      return { id: docRef.id, ...nuevaEtiqueta };
    } catch (error: any) {
      console.error('Error al crear etiqueta:', error);
      throw new Error(error.message || 'Error al crear etiqueta');
    }
  },

  /**
   * Crear etiqueta rapida (desde selector)
   */
  async crearRapida(nombre: string, tipo: TipoEtiqueta, userId: string): Promise<Etiqueta> {
    return this.create({ nombre, tipo }, userId);
  },

  /**
   * Actualizar etiqueta
   */
  async update(id: string, data: Partial<EtiquetaFormData>, userId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);

      // Obtener etiqueta actual para detectar cambio de nombre
      const etiquetaActual = await this.getById(id);
      const nombreAnterior = etiquetaActual?.nombre;

      const updateData: Record<string, any> = {
        actualizadoPor: userId,
        fechaActualizacion: Timestamp.now()
      };

      if (data.nombre !== undefined) {
        const existente = await this.buscarPorNombre(data.nombre);
        if (existente && existente.id !== id) {
          throw new Error(`Ya existe una etiqueta con el nombre "${existente.nombre}"`);
        }
        updateData.nombre = data.nombre.trim();
        updateData.nombreNormalizado = normalizarTexto(data.nombre);
        updateData.slug = generarSlug(data.nombre);
      }

      if (data.tipo !== undefined) updateData.tipo = data.tipo;
      if (data.grupo !== undefined) updateData.grupo = data.grupo;
      if (data.icono !== undefined) updateData.icono = data.icono;
      if (data.colorFondo !== undefined) updateData.colorFondo = data.colorFondo;
      if (data.colorTexto !== undefined) updateData.colorTexto = data.colorTexto;
      if (data.colorBorde !== undefined) updateData.colorBorde = data.colorBorde;
      if (data.mostrarEnFiltros !== undefined) updateData.mostrarEnFiltros = data.mostrarEnFiltros;
      if (data.ordenDisplay !== undefined) updateData.ordenDisplay = data.ordenDisplay;
      if (data.lineaNegocioIds !== undefined) updateData.lineaNegocioIds = data.lineaNegocioIds;

      await updateDoc(docRef, updateData);

      // Propagar cambio de nombre a clientes
      if (data.nombre !== undefined && nombreAnterior && nombreAnterior !== data.nombre.trim()) {
        await this.propagarCambiosAClientes(nombreAnterior, data.nombre.trim());
      }

      // Propagar cambios (nombre, colores, icono) a productos
      const camposProducto = ['nombre', 'colorFondo', 'colorTexto', 'colorBorde', 'icono', 'tipo'];
      const cambioAfectaProductos = camposProducto.some(campo => (data as any)[campo] !== undefined);
      if (cambioAfectaProductos) {
        await this.propagarCambiosAProductos(id);
      }
    } catch (error: any) {
      console.error('Error al actualizar etiqueta:', error);
      throw new Error(error.message || 'Error al actualizar etiqueta');
    }
  },

  /**
   * Cambiar estado de la etiqueta
   */
  async cambiarEstado(id: string, estado: EstadoEtiqueta, userId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        estado,
        actualizadoPor: userId,
        fechaActualizacion: Timestamp.now()
      });
    } catch (error: any) {
      console.error('Error al cambiar estado:', error);
      throw new Error('Error al cambiar estado de la etiqueta');
    }
  },

  /**
   * Eliminar etiqueta (solo si no tiene productos asociados)
   */
  async delete(id: string): Promise<void> {
    try {
      const etiqueta = await this.getById(id);
      if (!etiqueta) throw new Error('Etiqueta no encontrada');

      if (etiqueta.productosActivos > 0) {
        throw new Error('No se puede eliminar: tiene productos asociados');
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.error('Error al eliminar etiqueta:', error);
      throw new Error(error.message || 'Error al eliminar etiqueta');
    }
  },

  /**
   * Obtener snapshot para desnormalizar en producto
   */
  async getSnapshot(id: string): Promise<EtiquetaSnapshot | null> {
    const etiqueta = await this.getById(id);
    if (!etiqueta) return null;

    return {
      etiquetaId: etiqueta.id,
      codigo: etiqueta.codigo,
      nombre: etiqueta.nombre,
      slug: etiqueta.slug,
      tipo: etiqueta.tipo,
      icono: etiqueta.icono,
      colorFondo: etiqueta.colorFondo,
      colorTexto: etiqueta.colorTexto,
      colorBorde: etiqueta.colorBorde
    };
  },

  /**
   * Obtener multiples snapshots
   */
  async getSnapshots(ids: string[]): Promise<EtiquetaSnapshot[]> {
    const snapshots: EtiquetaSnapshot[] = [];
    for (const id of ids) {
      const snap = await this.getSnapshot(id);
      if (snap) snapshots.push(snap);
    }
    return snapshots;
  },

  /**
   * Buscar etiquetas con filtros
   */
  async buscar(filtros: EtiquetaFiltros): Promise<Etiqueta[]> {
    try {
      let resultado = await this.getAll();

      if (filtros.busqueda) {
        const term = filtros.busqueda.toLowerCase();
        resultado = resultado.filter(e =>
          e.nombre.toLowerCase().includes(term) ||
          e.codigo.toLowerCase().includes(term) ||
          e.grupo?.toLowerCase().includes(term)
        );
      }

      if (filtros.tipo) {
        resultado = resultado.filter(e => e.tipo === filtros.tipo);
      }

      if (filtros.estado) {
        resultado = resultado.filter(e => e.estado === filtros.estado);
      }

      if (filtros.mostrarEnFiltros !== undefined) {
        resultado = resultado.filter(e => e.mostrarEnFiltros === filtros.mostrarEnFiltros);
      }

      if (filtros.conProductos === true) {
        resultado = resultado.filter(e => e.productosActivos > 0);
      } else if (filtros.conProductos === false) {
        resultado = resultado.filter(e => e.productosActivos === 0);
      }

      if (filtros.ordenarPor) {
        const orden = filtros.orden === 'desc' ? -1 : 1;
        resultado.sort((a, b) => {
          switch (filtros.ordenarPor) {
            case 'nombre':
              return a.nombre.localeCompare(b.nombre, 'es') * orden;
            case 'tipo':
              return a.tipo.localeCompare(b.tipo) * orden;
            case 'productosActivos':
              return (a.productosActivos - b.productosActivos) * orden;
            case 'ordenDisplay':
              return ((a.ordenDisplay || 0) - (b.ordenDisplay || 0)) * orden;
            case 'fechaCreacion':
              return (a.fechaCreacion.toMillis() - b.fechaCreacion.toMillis()) * orden;
            default:
              return 0;
          }
        });
      }

      return resultado;
    } catch (error: any) {
      console.error('Error al buscar etiquetas:', error);
      throw new Error('Error al buscar etiquetas');
    }
  },

  /**
   * Actualizar contador de productos
   */
  async actualizarContadorProductos(id: string, productosActivos: number): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, { productosActivos });
    } catch (error: any) {
      console.error('Error al actualizar contador:', error);
    }
  },

  /**
   * Obtener estadisticas
   */
  async getStats(): Promise<EtiquetaStats> {
    try {
      const todas = await this.getAll();
      const activas = todas.filter(e => e.estado === 'activa');

      const porTipo: Record<TipoEtiqueta, number> = {
        atributo: todas.filter(e => e.tipo === 'atributo').length,
        marketing: todas.filter(e => e.tipo === 'marketing').length,
        origen: todas.filter(e => e.tipo === 'origen').length
      };

      const topUso = [...todas]
        .sort((a, b) => b.productosActivos - a.productosActivos)
        .slice(0, 10)
        .map(e => ({
          etiquetaId: e.id,
          nombre: e.nombre,
          tipo: e.tipo,
          productosActivos: e.productosActivos
        }));

      return {
        totalEtiquetas: todas.length,
        etiquetasActivas: activas.length,
        etiquetasPorTipo: porTipo,
        topEtiquetasPorUso: topUso
      };
    } catch (error: any) {
      console.error('Error al obtener estadisticas:', error);
      throw new Error('Error al obtener estadisticas');
    }
  },

  /**
   * Propagar cambio de nombre a clientes cuando cambia la etiqueta
   */
  async propagarCambiosAClientes(nombreAnterior: string, nombreNuevo: string): Promise<number> {
    try {
      if (nombreAnterior === nombreNuevo) return 0;

      const clientesRef = collection(db, COLLECTIONS.CLIENTES);
      const q = query(clientesRef, where('etiquetas', 'array-contains', nombreAnterior));
      const clientesSnap = await getDocs(q);

      if (clientesSnap.empty) return 0;

      let batch = writeBatch(db);
      let actualizados = 0;
      let enBatch = 0;

      for (const docSnap of clientesSnap.docs) {
        const data = docSnap.data();
        const etiquetas = (data.etiquetas || []) as string[];
        const nuevasEtiquetas = etiquetas.map(e =>
          e === nombreAnterior ? nombreNuevo : e
        );
        batch.update(docSnap.ref, { etiquetas: nuevasEtiquetas });
        actualizados++;
        enBatch++;

        if (enBatch >= 499) {
          await batch.commit();
          batch = writeBatch(db);
          enBatch = 0;
        }
      }

      if (enBatch > 0) {
        await batch.commit();
      }

      return actualizados;
    } catch (error: any) {
      console.error('Error al propagar cambios a clientes:', error);
      return 0;
    }
  },

  /**
   * Propagar cambios a productos cuando cambia la etiqueta
   */
  async propagarCambiosAProductos(etiquetaId: string): Promise<number> {
    try {
      const etiqueta = await this.getById(etiquetaId);
      if (!etiqueta) return 0;

      const snapshot: EtiquetaSnapshot = {
        etiquetaId: etiqueta.id,
        codigo: etiqueta.codigo,
        nombre: etiqueta.nombre,
        slug: etiqueta.slug,
        tipo: etiqueta.tipo,
        icono: etiqueta.icono,
        colorFondo: etiqueta.colorFondo,
        colorTexto: etiqueta.colorTexto,
        colorBorde: etiqueta.colorBorde
      };

      // Buscar productos que tengan esta etiqueta
      const productosRef = collection(db, COLLECTIONS.PRODUCTOS);
      const q = query(productosRef, where('etiquetaIds', 'array-contains', etiquetaId));
      const productosSnap = await getDocs(q);

      if (productosSnap.empty) return 0;

      let actualizados = 0;
      for (const docSnap of productosSnap.docs) {
        const data = docSnap.data();
        const etiquetas = (data.etiquetasData || []) as EtiquetaSnapshot[];
        const nuevasEtiquetas = etiquetas.map(e =>
          e.etiquetaId === etiquetaId ? snapshot : e
        );

        await updateDoc(docSnap.ref, { etiquetasData: nuevasEtiquetas });
        actualizados++;
      }

      return actualizados;
    } catch (error: any) {
      console.error('Error al propagar cambios:', error);
      return 0;
    }
  },

  /**
   * Crear etiquetas predefinidas (para inicializar el sistema)
   */
  async crearPresets(userId: string): Promise<number> {
    const { ETIQUETAS_PRESET } = await import('../types/etiqueta.types');
    let creadas = 0;

    for (let i = 0; i < ETIQUETAS_PRESET.length; i++) {
      const preset = ETIQUETAS_PRESET[i];
      try {
        const existente = await this.buscarPorNombre(preset.nombre);
        if (!existente) {
          await this.create({
            ...preset,
            ordenDisplay: i + 1
          }, userId);
          creadas++;
        }
      } catch (error) {
        console.error(`Error al crear preset ${preset.nombre}:`, error);
      }
    }

    return creadas;
  }
};
