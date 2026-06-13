import { create } from 'zustand';
import { unidadService } from '../services/unidad.service';
import type {
  Unidad,
  UnidadFormData,
  UnidadFiltros,
  UnidadStats,
  CrearUnidadesLoteData
} from '../types/unidad.types';

// ---- TTL cache: evita re-descargar todas las unidades en cada montaje de página ----
let _lastFetchAt = 0;
const FETCH_TTL_MS = 5 * 60 * 1000; // 5 minutos

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
    almacenInfo: { nombre: string; pais: string }
  ) => Promise<void>;
  crearLote: (
    data: CrearUnidadesLoteData,
    userId: string,
    productoInfo: { sku: string; nombre: string },
    almacenInfo: { nombre: string; pais: string }
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
    // Si no hay filtros específicos y los datos son recientes, omitir la descarga
    if (!filtros && Date.now() - _lastFetchAt < FETCH_TTL_MS && get().unidades.length > 0) return;

    // Canon refetch-silencioso (auditoría 2026-06-12): loading=true SOLO en el
    // primer load (lista vacía). Los refetch posteriores son silenciosos — la
    // tabla (ProductoInventarioTable tiene early-return por loading) ya no
    // colapsa al spinner en cada recarga.
    set({ loading: get().unidades.length === 0, error: null });
    try {
      const unidades = filtros
        ? await unidadService.buscar(filtros)
        : await unidadService.getAll();
      set({ unidades, loading: false });
      // Solo actualizar TTL cuando cargamos sin filtros (datos completos)
      if (!filtros) _lastFetchAt = Date.now();
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

  // ── Mutaciones · canon refetch-silencioso (auditoría 2026-06-12) ────────
  // Las mutaciones NO tocan el `loading` global (eso colapsaba la tabla al
  // spinner en cada crear/lote/estado/venta — el modal que muta maneja su
  // propio estado de submit). Además resetean _lastFetchAt para que el
  // refetch interno NO sea saltado por el TTL (antes la lista quedaba stale
  // hasta 5 min después de una mutación).

  createUnidad: async (data, userId, productoInfo, almacenInfo) => {
    set({ error: null });
    try {
      await unidadService.create(data, userId, productoInfo, almacenInfo);
      _lastFetchAt = 0;
      await get().fetchUnidades();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  crearLote: async (data, userId, productoInfo, almacenInfo) => {
    set({ error: null });
    try {
      await unidadService.crearLote(data, userId, productoInfo, almacenInfo);
      _lastFetchAt = 0;
      await get().fetchUnidades();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  actualizarEstado: async (id, nuevoEstado, userId, observaciones) => {
    set({ error: null });
    try {
      await unidadService.actualizarEstado(id, nuevoEstado, userId, observaciones);
      _lastFetchAt = 0;
      await get().fetchUnidades();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  marcarComoVendida: async (id, ventaId, ventaNumero, precioVentaPEN, userId) => {
    set({ error: null });
    try {
      await unidadService.marcarComoVendida(id, ventaId, ventaNumero, precioVentaPEN, userId);
      _lastFetchAt = 0;
      await get().fetchUnidades();
    } catch (error: any) {
      set({ error: error.message });
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
