import { create } from 'zustand';
import { unidadService } from '../services/unidad.service';
import type {
  Unidad,
  UnidadFormData,
  UnidadFiltros,
  UnidadStats,
  CrearUnidadesLoteData
} from '../types/unidad.types';

interface UnidadState {
  unidades: Unidad[];
  unidadActual: Unidad | null;
  stats: UnidadStats | null;
  loading: boolean;
  error: string | null;

  // Acciones
  fetchUnidades: (filtros?: UnidadFiltros) => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  buscar: (filtros: UnidadFiltros) => Promise<void>;
  createUnidad: (
    data: UnidadFormData,
    userId: string,
    productoInfo: { sku: string; nombre: string },
    almacenInfo: { nombre: string; pais: 'USA' | 'Peru' }
  ) => Promise<void>;
  crearLote: (
    data: CrearUnidadesLoteData,
    userId: string,
    productoInfo: { sku: string; nombre: string },
    almacenInfo: { nombre: string; pais: 'USA' | 'Peru' }
  ) => Promise<void>;
  actualizarEstado: (
    id: string,
    nuevoEstado: Unidad['estado'],
    userId: string,
    observaciones?: string
  ) => Promise<void>;
  marcarComoVendida: (
    id: string,
    ventaId: string,
    ventaNumero: string,
    precioVentaPEN: number,
    userId: string
  ) => Promise<void>;
  fetchStats: (filtros?: Pick<UnidadFiltros, 'productoId' | 'almacenId' | 'pais'>) => Promise<void>;
  getProximasAVencer: (dias?: number) => Promise<Unidad[]>;
  clearError: () => void;
  clearUnidadActual: () => void;
}

export const useUnidadStore = create<UnidadState>((set, get) => ({
  unidades: [],
  unidadActual: null,
  stats: null,
  loading: false,
  error: null,

  fetchUnidades: async (filtros?: UnidadFiltros) => {
    set({ loading: true, error: null });
    try {
      const unidades = filtros
        ? await unidadService.buscar(filtros)
        : await unidadService.getAll();
      set({ unidades, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const unidad = await unidadService.getById(id);
      set({ unidadActual: unidad, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  buscar: async (filtros: UnidadFiltros) => {
    set({ loading: true, error: null });
    try {
      const unidades = await unidadService.buscar(filtros);
      set({ unidades, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  createUnidad: async (data, userId, productoInfo, almacenInfo) => {
    set({ loading: true, error: null });
    try {
      await unidadService.create(data, userId, productoInfo, almacenInfo);
      await get().fetchUnidades();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  crearLote: async (data, userId, productoInfo, almacenInfo) => {
    set({ loading: true, error: null });
    try {
      await unidadService.crearLote(data, userId, productoInfo, almacenInfo);
      await get().fetchUnidades();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  actualizarEstado: async (id, nuevoEstado, userId, observaciones) => {
    set({ loading: true, error: null });
    try {
      await unidadService.actualizarEstado(id, nuevoEstado, userId, observaciones);
      await get().fetchUnidades();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  marcarComoVendida: async (id, ventaId, ventaNumero, precioVentaPEN, userId) => {
    set({ loading: true, error: null });
    try {
      await unidadService.marcarComoVendida(id, ventaId, ventaNumero, precioVentaPEN, userId);
      await get().fetchUnidades();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchStats: async (filtros) => {
    set({ loading: true, error: null });
    try {
      const stats = await unidadService.getStats(filtros);
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  getProximasAVencer: async (dias = 30) => {
    set({ loading: true, error: null });
    try {
      const unidades = await unidadService.getProximasAVencer(dias);
      set({ loading: false });
      return unidades;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  clearUnidadActual: () => set({ unidadActual: null })
}));
