import { create } from 'zustand';
import { categoriaService } from '../services/categoria.service';
import type {
  Categoria,
  CategoriaFormData,
  CategoriaStats,
  CategoriaFiltros,
  CategoriaArbol,
  CategoriaConPath,
  CategoriaSelectOption,
  NivelCategoria
} from '../types/categoria.types';

interface CategoriaState {
  // Estado
  categorias: Categoria[];
  categoriasActivas: Categoria[];
  categoriasPadre: Categoria[];
  arbol: CategoriaArbol[];
  categoriasConPath: CategoriaConPath[];
  categoriaSeleccionada: Categoria | null;
  resultadosBusqueda: Categoria[];
  stats: CategoriaStats | null;
  loading: boolean;
  buscando: boolean;
  error: string | null;

  // Acciones de carga
  fetchCategorias: () => Promise<void>;
  fetchCategoriasActivas: () => Promise<void>;
  fetchCategoriasPadre: () => Promise<void>;
  fetchArbol: () => Promise<void>;
  fetchCategoriasConPath: () => Promise<void>;
  fetchStats: () => Promise<void>;

  // Acciones de busqueda
  buscar: (filtros: CategoriaFiltros) => Promise<void>;
  buscarPorNombre: (nombre: string) => Promise<Categoria | null>;
  getSubcategorias: (categoriaPadreId: string) => Promise<Categoria[]>;
  getSelectOptions: (seleccionadasIds?: string[]) => Promise<CategoriaSelectOption[]>;
  limpiarBusqueda: () => void;

  // Acciones CRUD
  getById: (id: string) => Promise<Categoria | null>;
  create: (data: CategoriaFormData, userId: string) => Promise<Categoria>;
  crearRapida: (nombre: string, nivel: NivelCategoria, userId: string, categoriaPadreId?: string) => Promise<Categoria>;
  update: (id: string, data: Partial<CategoriaFormData>, userId: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
  cambiarEstado: (id: string, estado: 'activa' | 'inactiva', userId: string) => Promise<void>;

  // Seleccion
  setCategoriaSeleccionada: (categoria: Categoria | null) => void;
  clearError: () => void;
}

export const useCategoriaStore = create<CategoriaState>((set, get) => ({
  categorias: [],
  categoriasActivas: [],
  categoriasPadre: [],
  arbol: [],
  categoriasConPath: [],
  categoriaSeleccionada: null,
  resultadosBusqueda: [],
  stats: null,
  loading: false,
  buscando: false,
  error: null,

  // ============ CARGA ============

  fetchCategorias: async () => {
    set({ loading: true, error: null });
    try {
      const categorias = await categoriaService.getAll();
      set({ categorias, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchCategoriasActivas: async () => {
    set({ loading: true, error: null });
    try {
      const categoriasActivas = await categoriaService.getActivas();
      set({ categoriasActivas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchCategoriasPadre: async () => {
    set({ loading: true, error: null });
    try {
      const categoriasPadre = await categoriaService.getCategoriasPadre();
      set({ categoriasPadre, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchArbol: async () => {
    set({ loading: true, error: null });
    try {
      const arbol = await categoriaService.getArbol();
      set({ arbol, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchCategoriasConPath: async () => {
    set({ loading: true, error: null });
    try {
      const categoriasConPath = await categoriaService.getConPath();
      set({ categoriasConPath, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await categoriaService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ BUSQUEDA ============

  buscar: async (filtros: CategoriaFiltros) => {
    set({ buscando: true });
    try {
      const resultados = await categoriaService.buscar(filtros);
      set({ resultadosBusqueda: resultados, buscando: false });
    } catch (error: any) {
      set({ buscando: false });
      console.error('Error en busqueda:', error);
    }
  },

  buscarPorNombre: async (nombre: string) => {
    try {
      return await categoriaService.buscarPorNombre(nombre);
    } catch (error: any) {
      console.error('Error buscando por nombre:', error);
      return null;
    }
  },

  getSubcategorias: async (categoriaPadreId: string) => {
    try {
      return await categoriaService.getSubcategorias(categoriaPadreId);
    } catch (error: any) {
      console.error('Error obteniendo subcategorias:', error);
      return [];
    }
  },

  getSelectOptions: async (seleccionadasIds: string[] = []) => {
    try {
      return await categoriaService.getSelectOptions(seleccionadasIds);
    } catch (error: any) {
      console.error('Error obteniendo opciones:', error);
      return [];
    }
  },

  limpiarBusqueda: () => {
    set({ resultadosBusqueda: [] });
  },

  // ============ CRUD ============

  getById: async (id: string) => {
    try {
      const categoria = await categoriaService.getById(id);
      if (categoria) {
        set({ categoriaSeleccionada: categoria });
      }
      return categoria;
    } catch (error: any) {
      console.error('Error obteniendo categoria:', error);
      return null;
    }
  },

  create: async (data: CategoriaFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevaCategoria = await categoriaService.create(data, userId);
      await get().fetchCategorias();
      await get().fetchCategoriasActivas();
      await get().fetchArbol();
      await get().fetchCategoriasConPath();
      set({ loading: false });
      return nuevaCategoria;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  crearRapida: async (nombre: string, nivel: NivelCategoria, userId: string, categoriaPadreId?: string) => {
    set({ loading: true, error: null });
    try {
      const nuevaCategoria = await categoriaService.crearRapida(nombre, nivel, userId, categoriaPadreId);
      await get().fetchCategoriasActivas();
      await get().fetchArbol();
      await get().fetchCategoriasConPath();
      set({ loading: false });
      return nuevaCategoria;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  update: async (id: string, data: Partial<CategoriaFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await categoriaService.update(id, data, userId);
      await get().fetchCategorias();
      await get().fetchCategoriasActivas();
      await get().fetchArbol();
      await get().fetchCategoriasConPath();

      const { categoriaSeleccionada } = get();
      if (categoriaSeleccionada?.id === id) {
        const actualizada = await categoriaService.getById(id);
        set({ categoriaSeleccionada: actualizada });
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  delete: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await categoriaService.delete(id);
      await get().fetchCategorias();
      await get().fetchCategoriasActivas();
      await get().fetchArbol();
      await get().fetchCategoriasConPath();

      const { categoriaSeleccionada } = get();
      if (categoriaSeleccionada?.id === id) {
        set({ categoriaSeleccionada: null });
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  cambiarEstado: async (id: string, estado: 'activa' | 'inactiva', userId: string) => {
    set({ loading: true, error: null });
    try {
      await categoriaService.cambiarEstado(id, estado, userId);
      await get().fetchCategorias();
      await get().fetchCategoriasActivas();
      await get().fetchArbol();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ SELECCION ============

  setCategoriaSeleccionada: (categoria: Categoria | null) => {
    set({ categoriaSeleccionada: categoria });
  },

  clearError: () => set({ error: null })
}));
