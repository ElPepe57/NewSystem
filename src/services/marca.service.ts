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
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Marca,
  MarcaFormData,
  MarcaFiltros,
  MarcaSnapshot,
  MarcaStats,
  DuplicadoEncontrado
} from '../types/entidadesMaestras.types';

const COLLECTION_NAME = 'marcas';

/**
 * Normalizar texto para búsqueda y comparación
 * Remueve acentos, convierte a minúsculas, elimina caracteres especiales
 */
const normalizarTexto = (texto: string): string => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s]/g, '')     // Solo alfanuméricos
    .trim();
};

/**
 * Calcular similitud entre dos strings (0-100)
 */
const calcularSimilitud = (str1: string, str2: string): number => {
  const s1 = normalizarTexto(str1);
  const s2 = normalizarTexto(str2);

  if (s1 === s2) return 100;
  if (s1.includes(s2) || s2.includes(s1)) return 85;

  // Verificar tokens comunes
  const tokens1 = s1.split(/\s+/);
  const tokens2 = s2.split(/\s+/);
  const comunes = tokens1.filter(t => tokens2.includes(t));

  if (comunes.length > 0) {
    return Math.round((comunes.length / Math.max(tokens1.length, tokens2.length)) * 100);
  }

  // Distancia de Levenshtein simplificada
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 100;

  const editDistance = levenshteinDistance(longer, shorter);
  return Math.round((1 - editDistance / longer.length) * 100);
};

const levenshteinDistance = (s1: string, s2: string): number => {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
};

/**
 * Genera el siguiente código de marca automáticamente
 * Formato: MRC-001, MRC-002, etc.
 */
async function generarCodigoMarca(): Promise<string> {
  const prefix = 'MRC';

  const snapshot = await getDocs(collection(db, COLLECTION_NAME));

  let maxNumber = 0;
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const codigo = data.codigo as string;

    if (codigo && codigo.startsWith(prefix)) {
      const match = codigo.match(/-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  });

  return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
}

export const marcaService = {
  /**
   * Obtener todas las marcas
   */
  async getAll(): Promise<Marca[]> {
    try {
      // Sin orderBy para evitar requerir índices compuestos
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const marcas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Marca[];
      // Ordenar en cliente
      return marcas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (error: any) {
      console.error('Error al obtener marcas:', error);
      throw new Error('Error al cargar marcas');
    }
  },

  /**
   * Obtener marcas activas (para selects)
   */
  async getActivas(): Promise<Marca[]> {
    try {
      // Solo filtrar por estado, ordenar en cliente
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estado', '==', 'activa')
      );
      const snapshot = await getDocs(q);
      const marcas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Marca[];
      // Ordenar en cliente
      return marcas.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (error: any) {
      console.error('Error al obtener marcas activas:', error);
      throw new Error('Error al cargar marcas');
    }
  },

  /**
   * Obtener marca por ID
   */
  async getById(id: string): Promise<Marca | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Marca;
    } catch (error: any) {
      console.error('Error al obtener marca:', error);
      throw new Error('Error al cargar marca');
    }
  },

  /**
   * Buscar marcas por nombre (con fuzzy matching)
   */
  async buscar(termino: string, limite: number = 10): Promise<Marca[]> {
    try {
      const terminoNormalizado = normalizarTexto(termino);

      // Obtener todas las marcas para búsqueda local
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estado', '==', 'activa'),
        limit(200)
      );

      const snapshot = await getDocs(q);
      const marcas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Marca[];

      // Filtrar y ordenar por relevancia
      const resultados = marcas
        .map(marca => {
          let score = 0;

          // Match exacto en nombre normalizado
          if (marca.nombreNormalizado === terminoNormalizado) {
            score = 100;
          }
          // Match parcial en nombre normalizado
          else if (marca.nombreNormalizado.includes(terminoNormalizado)) {
            score = 90;
          }
          // Match en alias
          else if (marca.alias?.some(a => normalizarTexto(a).includes(terminoNormalizado))) {
            score = 85;
          }
          // Match en nombre original (con acentos)
          else if (marca.nombre.toLowerCase().includes(termino.toLowerCase())) {
            score = 80;
          }
          // Similitud fuzzy
          else {
            score = calcularSimilitud(marca.nombre, termino);
            if (score < 50) score = 0;
          }

          return { marca, score };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limite)
        .map(r => r.marca);

      return resultados;
    } catch (error: any) {
      console.error('Error al buscar marcas:', error);
      throw new Error('Error en búsqueda de marcas');
    }
  },

  /**
   * Buscar marca por nombre exacto (normalizado)
   */
  async buscarPorNombreExacto(nombre: string): Promise<Marca | null> {
    try {
      const nombreNormalizado = normalizarTexto(nombre);

      const q = query(
        collection(db, COLLECTION_NAME),
        where('nombreNormalizado', '==', nombreNormalizado),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      } as Marca;
    } catch (error: any) {
      console.error('Error al buscar por nombre exacto:', error);
      throw new Error('Error en búsqueda');
    }
  },

  /**
   * Detectar posibles duplicados antes de crear
   */
  async detectarDuplicados(nombre: string): Promise<DuplicadoEncontrado<Marca>[]> {
    const duplicados: DuplicadoEncontrado<Marca>[] = [];

    try {
      // Buscar por nombre exacto
      const porNombreExacto = await this.buscarPorNombreExacto(nombre);
      if (porNombreExacto) {
        duplicados.push({
          entidad: porNombreExacto,
          campo: 'nombreNormalizado',
          valorCoincidente: porNombreExacto.nombre,
          similitud: 100
        });
      }

      // Buscar similares
      const similares = await this.buscar(nombre, 5);
      for (const marca of similares) {
        if (!duplicados.find(d => d.entidad.id === marca.id)) {
          const similitud = calcularSimilitud(nombre, marca.nombre);
          if (similitud >= 70) {
            duplicados.push({
              entidad: marca,
              campo: 'nombre',
              valorCoincidente: marca.nombre,
              similitud
            });
          }
        }
      }

      return duplicados;
    } catch (error: any) {
      console.error('Error al detectar duplicados:', error);
      return [];
    }
  },

  /**
   * Crear nueva marca
   */
  async create(data: MarcaFormData, userId: string): Promise<string> {
    try {
      // Verificar duplicado exacto
      const existente = await this.buscarPorNombreExacto(data.nombre);
      if (existente) {
        throw new Error(`Ya existe una marca con nombre similar: "${existente.nombre}"`);
      }

      // Generar código automático
      const codigo = await generarCodigoMarca();

      // Construir objeto sin valores undefined (Firestore no los acepta)
      const nuevaMarca: any = {
        codigo,
        nombre: data.nombre.trim(),
        nombreNormalizado: normalizarTexto(data.nombre),
        tipoMarca: data.tipoMarca,
        estado: 'activa',
        metricas: {
          productosActivos: 0,
          unidadesVendidas: 0,
          ventasTotalPEN: 0,
          margenPromedio: 0
        },
        proveedoresPreferidos: data.proveedoresPreferidos || [],
        creadoPor: userId,
        fechaCreacion: serverTimestamp()
      };

      // Solo agregar campos opcionales si tienen valor
      const alias = data.alias?.map(a => a.trim()).filter(Boolean);
      if (alias && alias.length > 0) nuevaMarca.alias = alias;
      if (data.descripcion?.trim()) nuevaMarca.descripcion = data.descripcion.trim();
      if (data.paisOrigen?.trim()) nuevaMarca.paisOrigen = data.paisOrigen.trim();
      if (data.sitioWeb?.trim()) nuevaMarca.sitioWeb = data.sitioWeb.trim();
      if (data.logoUrl?.trim()) nuevaMarca.logoUrl = data.logoUrl.trim();
      if (data.colorPrimario) nuevaMarca.colorPrimario = data.colorPrimario;
      if (data.notas?.trim()) nuevaMarca.notas = data.notas.trim();

      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevaMarca);
      return docRef.id;
    } catch (error: any) {
      console.error('Error al crear marca:', error);
      throw new Error(error.message || 'Error al crear marca');
    }
  },

  /**
   * Actualizar marca
   */
  async update(id: string, data: Partial<MarcaFormData>, userId: string): Promise<void> {
    try {
      const updates: any = {
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      };

      if (data.nombre !== undefined) {
        updates.nombre = data.nombre.trim();
        updates.nombreNormalizado = normalizarTexto(data.nombre);
      }
      if (data.alias !== undefined) {
        updates.alias = data.alias.map(a => a.trim()).filter(Boolean);
      }
      if (data.descripcion !== undefined) updates.descripcion = data.descripcion?.trim();
      if (data.paisOrigen !== undefined) updates.paisOrigen = data.paisOrigen?.trim();
      if (data.tipoMarca !== undefined) updates.tipoMarca = data.tipoMarca;
      if (data.sitioWeb !== undefined) updates.sitioWeb = data.sitioWeb?.trim();
      if (data.logoUrl !== undefined) updates.logoUrl = data.logoUrl?.trim();
      if (data.colorPrimario !== undefined) updates.colorPrimario = data.colorPrimario;
      if (data.proveedoresPreferidos !== undefined) updates.proveedoresPreferidos = data.proveedoresPreferidos;
      if (data.notas !== undefined) updates.notas = data.notas?.trim();

      await updateDoc(doc(db, COLLECTION_NAME, id), updates);
    } catch (error: any) {
      console.error('Error al actualizar marca:', error);
      throw new Error('Error al actualizar marca');
    }
  },

  /**
   * Cambiar estado de la marca
   */
  async cambiarEstado(id: string, estado: 'activa' | 'inactiva' | 'descontinuada', userId: string): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        estado,
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al cambiar estado:', error);
      throw new Error('Error al cambiar estado');
    }
  },

  /**
   * Actualizar métricas de la marca (llamado después de ventas)
   */
  async actualizarMetricas(
    marcaId: string,
    unidadesVendidas: number,
    montoVentaPEN: number,
    margen: number
  ): Promise<void> {
    try {
      const marca = await this.getById(marcaId);
      if (!marca) return;

      const metricas = marca.metricas || {
        productosActivos: 0,
        unidadesVendidas: 0,
        ventasTotalPEN: 0,
        margenPromedio: 0
      };

      // Calcular nuevo margen promedio ponderado
      const totalUnidadesAnteriores = metricas.unidadesVendidas;
      const nuevoTotalUnidades = totalUnidadesAnteriores + unidadesVendidas;
      const nuevoMargenPromedio = nuevoTotalUnidades > 0
        ? ((metricas.margenPromedio * totalUnidadesAnteriores) + (margen * unidadesVendidas)) / nuevoTotalUnidades
        : margen;

      await updateDoc(doc(db, COLLECTION_NAME, marcaId), {
        metricas: {
          ...metricas,
          unidadesVendidas: nuevoTotalUnidades,
          ventasTotalPEN: metricas.ventasTotalPEN + montoVentaPEN,
          margenPromedio: nuevoMargenPromedio,
          ultimaVenta: serverTimestamp()
        }
      });
    } catch (error: any) {
      console.error('Error al actualizar métricas:', error);
    }
  },

  /**
   * Incrementar contador de productos activos
   */
  async incrementarProductos(marcaId: string, cantidad: number = 1): Promise<void> {
    try {
      const marca = await this.getById(marcaId);
      if (!marca) return;

      const productosActivos = (marca.metricas?.productosActivos || 0) + cantidad;

      await updateDoc(doc(db, COLLECTION_NAME, marcaId), {
        'metricas.productosActivos': Math.max(0, productosActivos)
      });
    } catch (error: any) {
      console.error('Error al incrementar productos:', error);
    }
  },

  /**
   * Obtener o crear marca
   * Si existe por nombre similar, retorna existente. Si no, crea nueva.
   */
  async getOrCreate(nombre: string, tipoMarca: 'farmaceutica' | 'suplementos' | 'cosmetica' | 'tecnologia' | 'otro', userId: string): Promise<{ marca: Marca; esNueva: boolean }> {
    try {
      // Buscar por nombre exacto
      const existente = await this.buscarPorNombreExacto(nombre);
      if (existente) {
        return { marca: existente, esNueva: false };
      }

      // Buscar muy similar (>85%)
      const similares = await this.buscar(nombre, 1);
      if (similares.length > 0) {
        const similitud = calcularSimilitud(nombre, similares[0].nombre);
        if (similitud >= 85) {
          return { marca: similares[0], esNueva: false };
        }
      }

      // Crear nueva
      const nuevoId = await this.create({
        nombre,
        tipoMarca
      }, userId);
      const nuevaMarca = await this.getById(nuevoId);

      return { marca: nuevaMarca!, esNueva: true };
    } catch (error: any) {
      console.error('Error en getOrCreate:', error);
      throw new Error('Error al obtener/crear marca');
    }
  },

  /**
   * Obtener snapshot para desnormalizar en producto/venta
   */
  getSnapshot(marca: Marca): MarcaSnapshot {
    return {
      marcaId: marca.id,
      nombre: marca.nombre
    };
  },

  /**
   * Obtener estadísticas de marcas
   */
  async getStats(): Promise<MarcaStats> {
    try {
      const marcas = await this.getAll();

      const marcasActivas = marcas.filter(m => m.estado === 'activa');
      const marcasConProductos = marcas.filter(m => m.metricas.productosActivos > 0);

      // Top marcas por ventas
      const topMarcasPorVentas = [...marcasConProductos]
        .sort((a, b) => b.metricas.ventasTotalPEN - a.metricas.ventasTotalPEN)
        .slice(0, 10)
        .map(m => ({
          marcaId: m.id,
          nombre: m.nombre,
          ventasTotalPEN: m.metricas.ventasTotalPEN,
          margenPromedio: m.metricas.margenPromedio
        }));

      // Top marcas por margen
      const topMarcasPorMargen = [...marcasConProductos]
        .filter(m => m.metricas.unidadesVendidas > 10) // Mínimo 10 unidades para ser significativo
        .sort((a, b) => b.metricas.margenPromedio - a.metricas.margenPromedio)
        .slice(0, 10)
        .map(m => ({
          marcaId: m.id,
          nombre: m.nombre,
          margenPromedio: m.metricas.margenPromedio,
          ventasTotalPEN: m.metricas.ventasTotalPEN
        }));

      // Por tipo
      const marcasPorTipo: Record<string, number> = {};
      for (const marca of marcas) {
        marcasPorTipo[marca.tipoMarca] = (marcasPorTipo[marca.tipoMarca] || 0) + 1;
      }

      return {
        totalMarcas: marcas.length,
        marcasActivas: marcasActivas.length,
        marcasConProductos: marcasConProductos.length,
        topMarcasPorVentas,
        topMarcasPorMargen,
        marcasPorTipo: marcasPorTipo as any
      };
    } catch (error: any) {
      console.error('Error al obtener stats:', error);
      throw new Error('Error al obtener estadísticas');
    }
  },

  /**
   * Agregar alias a marca existente
   */
  async agregarAlias(marcaId: string, alias: string, userId: string): Promise<void> {
    try {
      const marca = await this.getById(marcaId);
      if (!marca) throw new Error('Marca no encontrada');

      const aliasActuales = marca.alias || [];
      const aliasNormalizado = normalizarTexto(alias);

      // Verificar que no exista ya
      if (aliasActuales.some(a => normalizarTexto(a) === aliasNormalizado)) {
        return; // Ya existe, no hacer nada
      }

      await updateDoc(doc(db, COLLECTION_NAME, marcaId), {
        alias: [...aliasActuales, alias.trim()],
        actualizadoPor: userId,
        fechaActualizacion: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error al agregar alias:', error);
      throw new Error('Error al agregar alias');
    }
  },

  /**
   * Eliminar marca (solo si no tiene productos)
   */
  async delete(id: string): Promise<void> {
    try {
      const marca = await this.getById(id);
      if (!marca) throw new Error('Marca no encontrada');

      if (marca.metricas.productosActivos > 0) {
        throw new Error('No se puede eliminar una marca con productos asociados. Márquela como inactiva.');
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.error('Error al eliminar marca:', error);
      throw new Error(error.message || 'Error al eliminar marca');
    }
  },

  /**
   * Migrar marcas existentes desde productos
   * Utilidad para migración inicial
   */
  async migrarDesdeProductos(userId: string): Promise<{ migradas: number; errores: string[] }> {
    try {
      // Obtener todos los productos para extraer marcas únicas
      const productosSnapshot = await getDocs(collection(db, 'productos'));
      const marcasExistentes = new Set<string>();
      const errores: string[] = [];
      let migradas = 0;

      // Extraer marcas únicas
      for (const doc of productosSnapshot.docs) {
        const marca = doc.data().marca as string;
        if (marca && marca.trim()) {
          marcasExistentes.add(marca.trim());
        }
      }

      // Crear marcas que no existan
      for (const nombreMarca of marcasExistentes) {
        try {
          const existente = await this.buscarPorNombreExacto(nombreMarca);
          if (!existente) {
            await this.create({
              nombre: nombreMarca,
              tipoMarca: 'farmaceutica' // Default, ajustar manualmente después
            }, userId);
            migradas++;
          }
        } catch (error: any) {
          errores.push(`Error migrando "${nombreMarca}": ${error.message}`);
        }
      }

      return { migradas, errores };
    } catch (error: any) {
      console.error('Error en migración:', error);
      throw new Error('Error al migrar marcas');
    }
  },

  /**
   * Obtiene el próximo código que se generará
   * Útil para mostrar al usuario antes de crear
   */
  async getProximoCodigo(): Promise<string> {
    return generarCodigoMarca();
  }
};

// Alias para compatibilidad
export const MarcaService = marcaService;
