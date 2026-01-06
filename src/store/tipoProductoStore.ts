import { create } from 'zustand';
import { tipoProductoService } from '../services/tipoProducto.service';
import type {
  TipoProducto,
  TipoProductoFormData,
  TipoProductoStats,
  TipoProductoFiltros
} from '../types/tipoProducto.types';

interface TipoProductoState {
  // Estado
  tipos: TipoProducto[];
  tiposActivos: TipoProducto[];
  tipoSeleccionado: TipoProducto | null;
  resultadosBusqueda: TipoProducto[];
  stats: TipoProductoStats | null;
  loading: boolean;
  buscando: boolean;
  error: string | null;

  // Acciones de carga
  fetchTipos: () => Promise<void>;
  fetchTiposActivos: () => Promise<void>;
  fetchStats: () => Promise<void>;

  // Acciones de busqueda
  buscar: (filtros: TipoProductoFiltros) => Promise<void>;
  buscarPorNombre: (nombre: string) => Promise<TipoProducto | null>;
  limpiarBusqueda: () => void;

  // Acciones CRUD
  getById: (id: string) => Promise<TipoProducto | null>;
  create: (data: TipoProductoFormData, userId: string) => Promise<TipoProducto>;
  crearRapido: (nombre: string, userId: string) => Promise<TipoProducto>;
  update: (id: string, data: Partial<TipoProductoFormData>, userId: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
  cambiarEstado: (id: string, estado: 'activo' | 'inactivo', userId: string) => Promise<void>;

  // Seleccion
  setTipoSeleccionado: (tipo: TipoProducto | null) => void;
  clearError: () => void;
}

export const useTipoProductoStore = create<TipoProductoState>((set, get) => ({
  tipos: [],
  tiposActivos: [],
  tipoSeleccionado: null,
  resultadosBusqueda: [],
  stats: null,
  loading: false,
  buscando: false,
  error: null,

  // ============ CARGA ============

  fetchTipos: async () => {
    set({ loading: true, error: null });
    try {
      const tipos = await tipoProductoService.getAll();
      set({ tipos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchTiposActivos: async () => {
    set({ loading: true, error: null });
    try {
      const tiposActivos = await tipoProductoService.getActivos();
      set({ tiposActivos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await tipoProductoService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ BUSQUEDA ============

  buscar: async (filtros: TipoProductoFiltros) => {
    set({ buscando: true });
    try {
      const resultados = await tipoProductoService.buscar(filtros);
      set({ resultadosBusqueda: resultados, buscando: false });
    } catch (error: any) {
      set({ buscando: false });
      console.error('Error en busqueda:', error);
    }
  },

  buscarPorNombre: async (nombre: string) => {
    try {
      return await tipoProductoService.buscarPorNombre(nombre);
    } catch (error: any) {
      console.error('Error buscando por nombre:', error);
      return null;
    }
  },

  limpiarBusqueda: () => {
    set({ resultadosBusqueda: [] });
  },

  // ============ CRUD ============

  getById: async (id: string) => {
    try {
      const tipo = await tipoProductoService.getById(id);
      if (tipo) {
        set({ tipoSeleccionado: tipo });
      }
      return tipo;
    } catch (error: any) {
      console.error('Error obteniendo tipo:', error);
      return null;
    }
  },

  create: async (data: TipoProductoFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevoTipo = await tipoProductoService.create(data, userId);
      await get().fetchTipos();
      await get().fetchTiposActivos();
      set({ loading: false });
      return nuevoTipo;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  crearRapido: async (nombre: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevoTipo = await tipoProductoService.crearRapido(nombre, userId);
      await get().fetchTiposActivos();
      set({ loading: false });
      return nuevoTipo;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  update: async (id: string, data: Partial<TipoProductoFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await tipoProductoService.update(id, data, userId);
      await get().fetchTipos();
      await get().fetchTiposActivos();

      const { tipoSeleccionado } = get();
      if (tipoSeleccionado?.id === id) {
        const actualizado = await tipoProductoService.getById(id);
        set({ tipoSeleccionado: actualizado });
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
      await tipoProductoService.delete(id);
      await get().fetchTipos();
      await get().fetchTiposActivos();

      const { tipoSeleccionado } = get();
      if (tipoSeleccionado?.id === id) {
        set({ tipoSeleccionado: null });
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  cambiarEstado: async (id: string, estado: 'activo' | 'inactivo', userId: string) => {
    set({ loading: true, error: null });
    try {
      await tipoProductoService.cambiarEstado(id, estado, userId);
      await get().fetchTipos();
      await get().fetchTiposActivos();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ SELECCION ============

  setTipoSeleccionado: (tipo: TipoProducto | null) => {
    set({ tipoSeleccionado: tipo });
  },

  clearError: () => set({ error: null })
}));
