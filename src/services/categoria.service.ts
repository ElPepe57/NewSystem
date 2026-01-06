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
  Categoria,
  CategoriaFormData,
  CategoriaFiltros,
  CategoriaSnapshot,
  CategoriaStats,
  CategoriaArbol,
  CategoriaConPath,
  CategoriaSelectOption,
  EstadoCategoria,
  NivelCategoria
} from '../types/categoria.types';

const COLLECTION_NAME = 'categorias';

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
 * Formato: CAT-001, CAT-002, etc.
 */
async function generarCodigo(): Promise<string> {
  const prefix = 'CAT';
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

/**
 * Obtener siguiente orden display para un nivel/padre
 */
async function getSiguienteOrdenDisplay(nivel: NivelCategoria, categoriaPadreId?: string): Promise<number> {
  const todas = await categoriaService.getAll();
  let filtradas: Categoria[];

  if (nivel === 1) {
    filtradas = todas.filter(c => c.nivel === 1);
  } else {
    filtradas = todas.filter(c => c.categoriaPadreId === categoriaPadreId);
  }

  if (filtradas.length === 0) return 1;
  return Math.max(...filtradas.map(c => c.ordenDisplay)) + 1;
}

export const categoriaService = {
  /**
   * Obtener todas las categorias
   */
  async getAll(): Promise<Categoria[]> {
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const categorias = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Categoria[];
      // Ordenar por nivel y luego por ordenDisplay
      return categorias.sort((a, b) => {
        if (a.nivel !== b.nivel) return a.nivel - b.nivel;
        return a.ordenDisplay - b.ordenDisplay;
      });
    } catch (error: any) {
      console.error('Error al obtener categorias:', error);
      throw new Error('Error al cargar categorias');
    }
  },

  /**
   * Obtener categorias activas
   */
  async getActivas(): Promise<Categoria[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('estado', '==', 'activa')
      );
      const snapshot = await getDocs(q);
      const categorias = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Categoria[];
      return categorias.sort((a, b) => {
        if (a.nivel !== b.nivel) return a.nivel - b.nivel;
        return a.ordenDisplay - b.ordenDisplay;
      });
    } catch (error: any) {
      console.error('Error al obtener categorias activas:', error);
      throw new Error('Error al cargar categorias');
    }
  },

  /**
   * Obtener categorias padre (nivel 1)
   */
  async getCategoriasPadre(): Promise<Categoria[]> {
    const todas = await this.getActivas();
    return todas.filter(c => c.nivel === 1);
  },

  /**
   * Obtener subcategorias de una categoria padre
   */
  async getSubcategorias(categoriaPadreId: string): Promise<Categoria[]> {
    const todas = await this.getActivas();
    return todas.filter(c => c.categoriaPadreId === categoriaPadreId);
  },

  /**
   * Obtener una categoria por ID
   */
  async getById(id: string): Promise<Categoria | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Categoria;
    } catch (error: any) {
      console.error('Error al obtener categoria:', error);
      throw new Error('Error al cargar categoria');
    }
  },

  /**
   * Buscar categoria por nombre
   */
  async buscarPorNombre(nombre: string): Promise<Categoria | null> {
    try {
      const nombreNorm = normalizarTexto(nombre);
      const todas = await this.getAll();
      return todas.find(c => c.nombreNormalizado === nombreNorm) || null;
    } catch (error: any) {
      console.error('Error al buscar categoria:', error);
      return null;
    }
  },

  /**
   * Crear nueva categoria
   */
  async create(data: CategoriaFormData, userId: string): Promise<Categoria> {
    try {
      // Verificar duplicados
      const existente = await this.buscarPorNombre(data.nombre);
      if (existente) {
        throw new Error(`Ya existe una categoria con el nombre "${existente.nombre}"`);
      }

      // Si es subcategoria, obtener datos del padre
      let categoriaPadreNombre: string | undefined;
      if (data.nivel === 2 && data.categoriaPadreId) {
        const padre = await this.getById(data.categoriaPadreId);
        if (!padre) throw new Error('Categoria padre no encontrada');
        if (padre.nivel !== 1) throw new Error('El padre debe ser una categoria de nivel 1');
        categoriaPadreNombre = padre.nombre;
      }

      const codigo = await generarCodigo();
      const nombreNormalizado = normalizarTexto(data.nombre);
      const slug = generarSlug(data.nombre);
      const ordenDisplay = data.ordenDisplay || await getSiguienteOrdenDisplay(data.nivel, data.categoriaPadreId);

      const nuevaCategoria: Omit<Categoria, 'id'> = {
        codigo,
        nombre: data.nombre.trim(),
        nombreNormalizado,
        slug,
        nivel: data.nivel,
        categoriaPadreId: data.nivel === 2 ? data.categoriaPadreId : undefined,
        categoriaPadreNombre: data.nivel === 2 ? categoriaPadreNombre : undefined,
        ordenDisplay,
        descripcion: data.descripcion || '',
        metaDescription: data.metaDescription || '',
        keywords: data.keywords || [],
        icono: data.icono,
        color: data.color || '#6B7280',
        imagenUrl: data.imagenUrl || '',
        imagenBannerUrl: data.imagenBannerUrl || '',
        estado: 'activa',
        mostrarEnWeb: data.mostrarEnWeb ?? true,
        mostrarEnApp: data.mostrarEnApp ?? true,
        metricas: {
          productosActivos: 0,
          subcategorias: 0
        },
        creadoPor: userId,
        fechaCreacion: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), nuevaCategoria);

      // Si es subcategoria, actualizar contador del padre
      if (data.nivel === 2 && data.categoriaPadreId) {
        await this.actualizarContadorSubcategorias(data.categoriaPadreId);
      }

      return { id: docRef.id, ...nuevaCategoria };
    } catch (error: any) {
      console.error('Error al crear categoria:', error);
      throw new Error(error.message || 'Error al crear categoria');
    }
  },

  /**
   * Crear categoria rapida (desde selector)
   */
  async crearRapida(nombre: string, nivel: NivelCategoria, userId: string, categoriaPadreId?: string): Promise<Categoria> {
    return this.create({
      nombre,
      nivel,
      categoriaPadreId
    }, userId);
  },

  /**
   * Actualizar categoria
   */
  async update(id: string, data: Partial<CategoriaFormData>, userId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const categoriaActual = await this.getById(id);
      if (!categoriaActual) throw new Error('Categoria no encontrada');

      const updateData: Record<string, any> = {
        actualizadoPor: userId,
        fechaActualizacion: Timestamp.now()
      };

      if (data.nombre !== undefined) {
        const existente = await this.buscarPorNombre(data.nombre);
        if (existente && existente.id !== id) {
          throw new Error(`Ya existe una categoria con el nombre "${existente.nombre}"`);
        }
        updateData.nombre = data.nombre.trim();
        updateData.nombreNormalizado = normalizarTexto(data.nombre);
        updateData.slug = generarSlug(data.nombre);
      }

      if (data.ordenDisplay !== undefined) updateData.ordenDisplay = data.ordenDisplay;
      if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
      if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription;
      if (data.keywords !== undefined) updateData.keywords = data.keywords;
      if (data.icono !== undefined) updateData.icono = data.icono;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.imagenUrl !== undefined) updateData.imagenUrl = data.imagenUrl;
      if (data.imagenBannerUrl !== undefined) updateData.imagenBannerUrl = data.imagenBannerUrl;
      if (data.mostrarEnWeb !== undefined) updateData.mostrarEnWeb = data.mostrarEnWeb;
      if (data.mostrarEnApp !== undefined) updateData.mostrarEnApp = data.mostrarEnApp;

      await updateDoc(docRef, updateData);
    } catch (error: any) {
      console.error('Error al actualizar categoria:', error);
      throw new Error(error.message || 'Error al actualizar categoria');
    }
  },

  /**
   * Cambiar estado de la categoria
   */
  async cambiarEstado(id: string, estado: EstadoCategoria, userId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        estado,
        actualizadoPor: userId,
        fechaActualizacion: Timestamp.now()
      });
    } catch (error: any) {
      console.error('Error al cambiar estado:', error);
      throw new Error('Error al cambiar estado de la categoria');
    }
  },

  /**
   * Eliminar categoria (solo si no tiene productos ni subcategorias)
   */
  async delete(id: string): Promise<void> {
    try {
      const categoria = await this.getById(id);
      if (!categoria) throw new Error('Categoria no encontrada');

      if (categoria.metricas.productosActivos > 0) {
        throw new Error('No se puede eliminar: tiene productos asociados');
      }

      if (categoria.nivel === 1 && categoria.metricas.subcategorias > 0) {
        throw new Error('No se puede eliminar: tiene subcategorias');
      }

      // Si es subcategoria, actualizar contador del padre
      if (categoria.nivel === 2 && categoria.categoriaPadreId) {
        await this.actualizarContadorSubcategorias(categoria.categoriaPadreId);
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error: any) {
      console.error('Error al eliminar categoria:', error);
      throw new Error(error.message || 'Error al eliminar categoria');
    }
  },

  /**
   * Actualizar contador de subcategorias de una categoria padre
   */
  async actualizarContadorSubcategorias(categoriaPadreId: string): Promise<void> {
    try {
      const subcategorias = await this.getSubcategorias(categoriaPadreId);
      const docRef = doc(db, COLLECTION_NAME, categoriaPadreId);
      await updateDoc(docRef, {
        'metricas.subcategorias': subcategorias.length
      });
    } catch (error: any) {
      console.error('Error al actualizar contador:', error);
    }
  },

  /**
   * Obtener snapshot para desnormalizar en producto
   */
  async getSnapshot(id: string): Promise<CategoriaSnapshot | null> {
    const categoria = await this.getById(id);
    if (!categoria) return null;

    return {
      categoriaId: categoria.id,
      codigo: categoria.codigo,
      nombre: categoria.nombre,
      slug: categoria.slug,
      nivel: categoria.nivel,
      categoriaPadreId: categoria.categoriaPadreId,
      categoriaPadreNombre: categoria.categoriaPadreNombre,
      icono: categoria.icono,
      color: categoria.color
    };
  },

  /**
   * Obtener multiples snapshots
   */
  async getSnapshots(ids: string[]): Promise<CategoriaSnapshot[]> {
    const snapshots: CategoriaSnapshot[] = [];
    for (const id of ids) {
      const snap = await this.getSnapshot(id);
      if (snap) snapshots.push(snap);
    }
    return snapshots;
  },

  /**
   * Construir arbol de categorias para navegacion
   */
  async getArbol(): Promise<CategoriaArbol[]> {
    const todas = await this.getActivas();
    const padres = todas.filter(c => c.nivel === 1);

    return padres.map(padre => ({
      ...padre,
      hijos: todas
        .filter(c => c.categoriaPadreId === padre.id)
        .sort((a, b) => a.ordenDisplay - b.ordenDisplay)
        .map(hijo => ({ ...hijo, hijos: [] }))
    }));
  },

  /**
   * Obtener categorias con path completo para display
   */
  async getConPath(): Promise<CategoriaConPath[]> {
    const todas = await this.getActivas();
    const padresMap = new Map<string, string>();

    // Crear mapa de IDs a nombres de padres
    todas.filter(c => c.nivel === 1).forEach(p => {
      padresMap.set(p.id, p.nombre);
    });

    return todas.map(c => ({
      ...c,
      pathCompleto: c.nivel === 1
        ? c.nombre
        : `${c.categoriaPadreNombre || padresMap.get(c.categoriaPadreId || '')} > ${c.nombre}`
    }));
  },

  /**
   * Obtener opciones para select (UI)
   */
  async getSelectOptions(seleccionadasIds: string[] = []): Promise<CategoriaSelectOption[]> {
    const conPath = await this.getConPath();

    return conPath.map(c => ({
      value: c.id,
      label: c.pathCompleto,
      nivel: c.nivel,
      icono: c.icono,
      color: c.color,
      disabled: seleccionadasIds.includes(c.id)
    }));
  },

  /**
   * Buscar categorias con filtros
   */
  async buscar(filtros: CategoriaFiltros): Promise<Categoria[]> {
    try {
      let resultado = await this.getAll();

      if (filtros.busqueda) {
        const term = filtros.busqueda.toLowerCase();
        resultado = resultado.filter(c =>
          c.nombre.toLowerCase().includes(term) ||
          c.codigo.toLowerCase().includes(term) ||
          c.descripcion?.toLowerCase().includes(term) ||
          c.keywords?.some(k => k.toLowerCase().includes(term))
        );
      }

      if (filtros.estado) {
        resultado = resultado.filter(c => c.estado === filtros.estado);
      }

      if (filtros.nivel) {
        resultado = resultado.filter(c => c.nivel === filtros.nivel);
      }

      if (filtros.categoriaPadreId) {
        resultado = resultado.filter(c => c.categoriaPadreId === filtros.categoriaPadreId);
      }

      if (filtros.mostrarEnWeb !== undefined) {
        resultado = resultado.filter(c => c.mostrarEnWeb === filtros.mostrarEnWeb);
      }

      if (filtros.conProductos === true) {
        resultado = resultado.filter(c => c.metricas.productosActivos > 0);
      } else if (filtros.conProductos === false) {
        resultado = resultado.filter(c => c.metricas.productosActivos === 0);
      }

      if (filtros.ordenarPor) {
        const orden = filtros.orden === 'desc' ? -1 : 1;
        resultado.sort((a, b) => {
          switch (filtros.ordenarPor) {
            case 'nombre':
              return a.nombre.localeCompare(b.nombre, 'es') * orden;
            case 'ordenDisplay':
              return (a.ordenDisplay - b.ordenDisplay) * orden;
            case 'productosActivos':
              return (a.metricas.productosActivos - b.metricas.productosActivos) * orden;
            case 'fechaCreacion':
              return (a.fechaCreacion.toMillis() - b.fechaCreacion.toMillis()) * orden;
            default:
              return 0;
          }
        });
      }

      return resultado;
    } catch (error: any) {
      console.error('Error al buscar categorias:', error);
      throw new Error('Error al buscar categorias');
    }
  },

  /**
   * Actualizar metricas de la categoria
   */
  async actualizarMetricas(id: string, productosActivos: number): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        'metricas.productosActivos': productosActivos
      });
    } catch (error: any) {
      console.error('Error al actualizar metricas:', error);
    }
  },

  /**
   * Obtener estadisticas
   */
  async getStats(): Promise<CategoriaStats> {
    try {
      const todas = await this.getAll();
      const activas = todas.filter(c => c.estado === 'activa');
      const padres = todas.filter(c => c.nivel === 1);
      const hijos = todas.filter(c => c.nivel === 2);

      const topProductos = [...todas]
        .sort((a, b) => b.metricas.productosActivos - a.metricas.productosActivos)
        .slice(0, 10)
        .map(c => ({
          categoriaId: c.id,
          nombre: c.nombre,
          productosActivos: c.metricas.productosActivos,
          nivel: c.nivel
        }));

      return {
        totalCategorias: todas.length,
        categoriasActivas: activas.length,
        categoriasPadre: padres.length,
        subcategorias: hijos.length,
        topCategoriasPorProductos: topProductos,
        distribucionPorNivel: {
          nivel1: padres.length,
          nivel2: hijos.length
        }
      };
    } catch (error: any) {
      console.error('Error al obtener estadisticas:', error);
      throw new Error('Error al obtener estadisticas');
    }
  },

  /**
   * Propagar cambios a productos cuando cambia la categoria
   */
  async propagarCambiosAProductos(categoriaId: string): Promise<number> {
    try {
      const categoria = await this.getById(categoriaId);
      if (!categoria) return 0;

      const snapshot: CategoriaSnapshot = {
        categoriaId: categoria.id,
        codigo: categoria.codigo,
        nombre: categoria.nombre,
        slug: categoria.slug,
        nivel: categoria.nivel,
        categoriaPadreId: categoria.categoriaPadreId,
        categoriaPadreNombre: categoria.categoriaPadreNombre,
        icono: categoria.icono,
        color: categoria.color
      };

      // Buscar productos que tengan esta categoria
      const productosRef = collection(db, 'productos');
      const q = query(productosRef, where('categoriaIds', 'array-contains', categoriaId));
      const productosSnap = await getDocs(q);

      if (productosSnap.empty) return 0;

      // Actualizar cada producto (el snapshot esta dentro de un array)
      let actualizados = 0;
      for (const docSnap of productosSnap.docs) {
        const data = docSnap.data();
        const categorias = (data.categorias || []) as CategoriaSnapshot[];
        const nuevasCategorias = categorias.map(c =>
          c.categoriaId === categoriaId ? snapshot : c
        );

        await updateDoc(docSnap.ref, { categorias: nuevasCategorias });
        actualizados++;
      }

      return actualizados;
    } catch (error: any) {
      console.error('Error al propagar cambios:', error);
      return 0;
    }
  }
};
