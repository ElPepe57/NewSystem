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
import type {
  TipoProducto,
  TipoProductoFormData,
  TipoProductoFiltros,
  TipoProductoSnapshot,
  TipoProductoStats,
  EstadoTipoProducto
} from '../types/tipoProducto.types';

const COLLECTION_NAME = 'tiposProducto';

/**
 * Normalizar texto para busqueda y slug
 */
const normalizarTexto = (texto: string): string => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s-]/g, '')    // Solo alfanumericos y guiones
    .replace(/\s+/g, '-')            // Espacios a guiones
    .trim();
};

/**
 * Genera el siguiente codigo automaticamente
 * Formato: TPR-001, TPR-002, etc.
 */
async function generarCodigo(): Promise<string> {
  const prefix = 'TPR';
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

export const tipoProductoService = {
  /**
   * Obtener todos los tipos de producto
   */
  async getAll(): Promise<TipoProducto[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const tipos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TipoProducto[];
      return tipos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    } catch (error: any) {
      console.error('Error al obtener tipos de producto:', error);
      throw new Error('Error al cargar tipos de producto');
    }
  },

  /**
   * Obtener tipos activos (para selects)
   */
  async getActivos(): Promise<TipoProducto[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estado', '==', 'activo')
      );
      const snapshot = await getDocs(q);
      const tipos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TipoProducto[];
      return tipos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    } catch (error: any) {
      console.error('Error al obtener tipos activos:', error);
      throw new Error('Error al cargar tipos de producto');
    }
  },

  /**
   * Obtener un tipo por ID
   */
  async getById(id: string): Promise<TipoProducto | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as TipoProducto;
    } catch (error: any) {
      console.error('Error al obtener tipo de producto:', error);
      throw new Error('Error al cargar tipo de producto');
    }
  },

  /**
   * Buscar tipo por nombre (exacto o similar)
   */
  async buscarPorNombre(nombre: string): Promise<TipoProducto | null> {
    try {
      const nombreNorm = normalizarTexto(nombre);
      const todos = await this.getAll();
      return todos.find(t => t.nombreNormalizado === nombreNorm) || null;
    } catch (error: any) {
      console.error('Error al buscar tipo por nombre:', error);
      return null;
    }
  },

  /**
   * Crear nuevo tipo de producto
   */
  async create(data: TipoProductoFormData, userId: string): Promise<TipoProducto> {
    try {
      // Verificar duplicados
      const existente = await this.buscarPorNombre(data.nombre);
      if (existente) {
        throw new Error(`Ya existe un tipo de producto con el nombre "${existente.nombre}"`);
      }

      const codigo = await generarCodigo();
      const nombreNormalizado = normalizarTexto(data.nombre);

      const nuevoTipo: Omit<TipoProducto, 'id'> = {
        codigo,
        nombre: data.nombre.trim(),
        nombreNormalizado,
        alias: data.alias || [],
        descripcion: data.descripcion || '',
        principioActivo: data.principioActivo || '',
        beneficiosPrincipales: data.beneficiosPrincipales || [],
        categoriasSugeridasIds: data.categoriasSugeridasIds || [],
        iconoUrl: data.iconoUrl || '',
        imagenUrl: data.imagenUrl || '',
        estado: 'activo',
        metricas: {
          productosActivos: 0,
          unidadesVendidas: 0,
          ventasTotalPEN: 0,
          margenPromedio: 0
        },
        creadoPor: userId,
        fechaCreacion: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevoTipo);
      return { id: docRef.id, ...nuevoTipo };
    } catch (error: any) {
      console.error('Error al crear tipo de producto:', error);
      throw new Error(error.message || 'Error al crear tipo de producto');
    }
  },

  /**
   * Crear tipo de producto rapido (desde selector en ProductoForm)
   */
  async crearRapido(nombre: string, userId: string): Promise<TipoProducto> {
    return this.create({ nombre }, userId);
  },

  /**
   * Actualizar tipo de producto
   */
  async update(id: string, data: Partial<TipoProductoFormData>, userId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);

      const updateData: Record<string, any> = {
        actualizadoPor: userId,
        fechaActualizacion: Timestamp.now()
      };

      if (data.nombre !== undefined) {
        // Verificar duplicados si cambia el nombre
        const existente = await this.buscarPorNombre(data.nombre);
        if (existente && existente.id !== id) {
          throw new Error(`Ya existe un tipo de producto con el nombre "${existente.nombre}"`);
        }
        updateData.nombre = data.nombre.trim();
        updateData.nombreNormalizado = normalizarTexto(data.nombre);
      }

      if (data.alias !== undefined) updateData.alias = data.alias;
      if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
      if (data.principioActivo !== undefined) updateData.principioActivo = data.principioActivo;
      if (data.beneficiosPrincipales !== undefined) updateData.beneficiosPrincipales = data.beneficiosPrincipales;
      if (data.categoriasSugeridasIds !== undefined) updateData.categoriasSugeridasIds = data.categoriasSugeridasIds;
      if (data.iconoUrl !== undefined) updateData.iconoUrl = data.iconoUrl;
      if (data.imagenUrl !== undefined) updateData.imagenUrl = data.imagenUrl;

      await updateDoc(docRef, updateData);
    } catch (error: any) {
      console.error('Error al actualizar tipo de producto:', error);
      throw new Error(error.message || 'Error al actualizar tipo de producto');
    }
  },

  /**
   * Cambiar estado del tipo de producto
   */
  async cambiarEstado(id: string, estado: EstadoTipoProducto, userId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        estado,
        actualizadoPor: userId,
        fechaActualizacion: Timestamp.now()
      });
    } catch (error: any) {
      console.error('Error al cambiar estado:', error);
      throw new Error('Error al cambiar estado del tipo de producto');
    }
  },

  /**
   * Eliminar tipo de producto (solo si no tiene productos asociados)
   */
  async delete(id: string): Promise<void> {
    try {
      const tipo = await this.getById(id);
      if (!tipo) throw new Error('Tipo de producto no encontrado');

      if (tipo.metricas.productosActivos > 0) {
        throw new Error('No se puede eliminar: tiene productos asociados');
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.error('Error al eliminar tipo de producto:', error);
      throw new Error(error.message || 'Error al eliminar tipo de producto');
    }
  },

  /**
   * Obtener snapshot para desnormalizar en producto
   */
  async getSnapshot(id: string): Promise<TipoProductoSnapshot | null> {
    const tipo = await this.getById(id);
    if (!tipo) return null;

    return {
      tipoProductoId: tipo.id,
      codigo: tipo.codigo,
      nombre: tipo.nombre
    };
  },

  /**
   * Actualizar metricas del tipo (llamar al actualizar productos)
   */
  async actualizarMetricas(
    id: string,
    metricas: Partial<TipoProducto['metricas']>
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData: Record<string, any> = {};

      if (metricas.productosActivos !== undefined) {
        updateData['metricas.productosActivos'] = metricas.productosActivos;
      }
      if (metricas.unidadesVendidas !== undefined) {
        updateData['metricas.unidadesVendidas'] = metricas.unidadesVendidas;
      }
      if (metricas.ventasTotalPEN !== undefined) {
        updateData['metricas.ventasTotalPEN'] = metricas.ventasTotalPEN;
      }
      if (metricas.margenPromedio !== undefined) {
        updateData['metricas.margenPromedio'] = metricas.margenPromedio;
      }

      if (Object.keys(updateData).length > 0) {
        await updateDoc(docRef, updateData);
      }
    } catch (error: any) {
      console.error('Error al actualizar metricas:', error);
    }
  },

  /**
   * Buscar tipos con filtros
   */
  async buscar(filtros: TipoProductoFiltros): Promise<TipoProducto[]> {
    try {
      let resultado = await this.getAll();

      // Filtrar por busqueda
      if (filtros.busqueda) {
        const term = filtros.busqueda.toLowerCase();
        resultado = resultado.filter(t =>
          t.nombre.toLowerCase().includes(term) ||
          t.codigo.toLowerCase().includes(term) ||
          t.alias?.some(a => a.toLowerCase().includes(term)) ||
          t.descripcion?.toLowerCase().includes(term)
        );
      }

      // Filtrar por estado
      if (filtros.estado) {
        resultado = resultado.filter(t => t.estado === filtros.estado);
      }

      // Filtrar por productos
      if (filtros.conProductos === true) {
        resultado = resultado.filter(t => t.metricas.productosActivos > 0);
      } else if (filtros.conProductos === false) {
        resultado = resultado.filter(t => t.metricas.productosActivos === 0);
      }

      // Ordenar
      if (filtros.ordenarPor) {
        const orden = filtros.orden === 'desc' ? -1 : 1;
        resultado.sort((a, b) => {
          switch (filtros.ordenarPor) {
            case 'nombre':
              return a.nombre.localeCompare(b.nombre, 'es') * orden;
            case 'productosActivos':
              return (a.metricas.productosActivos - b.metricas.productosActivos) * orden;
            case 'ventasTotal':
              return (a.metricas.ventasTotalPEN - b.metricas.ventasTotalPEN) * orden;
            case 'fechaCreacion':
              return (a.fechaCreacion.toMillis() - b.fechaCreacion.toMillis()) * orden;
            default:
              return 0;
          }
        });
      }

      return resultado;
    } catch (error: any) {
      console.error('Error al buscar tipos:', error);
      throw new Error('Error al buscar tipos de producto');
    }
  },

  /**
   * Obtener estadisticas
   */
  async getStats(): Promise<TipoProductoStats> {
    try {
      const todos = await this.getAll();

      const activos = todos.filter(t => t.estado === 'activo');
      const conProductos = todos.filter(t => t.metricas.productosActivos > 0);

      // Top por ventas
      const topVentas = [...todos]
        .sort((a, b) => b.metricas.ventasTotalPEN - a.metricas.ventasTotalPEN)
        .slice(0, 10)
        .map(t => ({
          tipoProductoId: t.id,
          nombre: t.nombre,
          ventasTotalPEN: t.metricas.ventasTotalPEN,
          productosActivos: t.metricas.productosActivos
        }));

      // Top por margen
      const topMargen = [...todos]
        .filter(t => t.metricas.margenPromedio > 0)
        .sort((a, b) => b.metricas.margenPromedio - a.metricas.margenPromedio)
        .slice(0, 10)
        .map(t => ({
          tipoProductoId: t.id,
          nombre: t.nombre,
          margenPromedio: t.metricas.margenPromedio,
          productosActivos: t.metricas.productosActivos
        }));

      return {
        totalTipos: todos.length,
        tiposActivos: activos.length,
        tiposConProductos: conProductos.length,
        topTiposPorVentas: topVentas,
        topTiposPorMargen: topMargen
      };
    } catch (error: any) {
      console.error('Error al obtener estadisticas:', error);
      throw new Error('Error al obtener estadisticas');
    }
  },

  /**
   * Actualizar snapshots en productos cuando cambia el tipo
   * (Llamar desde Cloud Function o manualmente)
   */
  async propagarCambiosAProductos(tipoId: string): Promise<number> {
    try {
      const tipo = await this.getById(tipoId);
      if (!tipo) return 0;

      const snapshot: TipoProductoSnapshot = {
        tipoProductoId: tipo.id,
        codigo: tipo.codigo,
        nombre: tipo.nombre
      };

      // Buscar productos con este tipo
      const productosRef = collection(db, 'productos');
      const q = query(productosRef, where('tipoProductoId', '==', tipoId));
      const productosSnap = await getDocs(q);

      if (productosSnap.empty) return 0;

      // Actualizar en batch
      const batch = writeBatch(db);
      productosSnap.docs.forEach(docSnap => {
        batch.update(docSnap.ref, { tipoProducto: snapshot });
      });

      await batch.commit();
      return productosSnap.size;
    } catch (error: any) {
      console.error('Error al propagar cambios:', error);
      return 0;
    }
  }
};
