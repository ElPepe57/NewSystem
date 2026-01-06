import { create } from 'zustand';
import { etiquetaService } from '../services/etiqueta.service';
import type {
  Etiqueta,
  EtiquetaFormData,
  EtiquetaStats,
  EtiquetaFiltros,
  EtiquetasAgrupadas,
  TipoEtiqueta
} from '../types/etiqueta.types';

interface EtiquetaState {
  // Estado
  etiquetas: Etiqueta[];
  etiquetasActivas: Etiqueta[];
  etiquetasAgrupadas: EtiquetasAgrupadas | null;
  etiquetaSeleccionada: Etiqueta | null;
  resultadosBusqueda: Etiqueta[];
  stats: EtiquetaStats | null;
  loading: boolean;
  buscando: boolean;
  error: string | null;

  // Acciones de carga
  fetchEtiquetas: () => Promise<void>;
  fetchEtiquetasActivas: () => Promise<void>;
  fetchEtiquetasAgrupadas: () => Promise<void>;
  fetchEtiquetasParaFiltros: () => Promise<Etiqueta[]>;
  fetchStats: () => Promise<void>;

  // Acciones de busqueda
  buscar: (filtros: EtiquetaFiltros) => Promise<void>;
  buscarPorNombre: (nombre: string) => Promise<Etiqueta | null>;
  getByTipo: (tipo: TipoEtiqueta) => Promise<Etiqueta[]>;
  limpiarBusqueda: () => void;

  // Acciones CRUD
  getById: (id: string) => Promise<Etiqueta | null>;
  create: (data: EtiquetaFormData, userId: string) => Promise<Etiqueta>;
  crearRapida: (nombre: string, tipo: TipoEtiqueta, userId: string) => Promise<Etiqueta>;
  update: (id: string, data: Partial<EtiquetaFormData>, userId: string) => Promise<void>;
  delete: (id: string) => Promise<void>;
  cambiarEstado: (id: string, estado: 'activa' | 'inactiva', userId: string) => Promise<void>;

  // Acciones especiales
  crearPresets: (userId: string) => Promise<number>;

  // Seleccion
  setEtiquetaSeleccionada: (etiqueta: Etiqueta | null) => void;
  clearError: () => void;
}

export const useEtiquetaStore = create<EtiquetaState>((set, get) => ({
  etiquetas: [],
  etiquetasActivas: [],
  etiquetasAgrupadas: null,
  etiquetaSeleccionada: null,
  resultadosBusqueda: [],
  stats: null,
  loading: false,
  buscando: false,
  error: null,

  // ============ CARGA ============

  fetchEtiquetas: async () => {
    set({ loading: true, error: null });
    try {
      const etiquetas = await etiquetaService.getAll();
      set({ etiquetas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchEtiquetasActivas: async () => {
    set({ loading: true, error: null });
    try {
      const etiquetasActivas = await etiquetaService.getActivas();
      set({ etiquetasActivas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchEtiquetasAgrupadas: async () => {
    set({ loading: true, error: null });
    try {
      const etiquetasAgrupadas = await etiquetaService.getAgrupadas();
      set({ etiquetasAgrupadas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchEtiquetasParaFiltros: async () => {
    try {
      return await etiquetaService.getParaFiltros();
    } catch (error: any) {
      console.error('Error obteniendo etiquetas para filtros:', error);
      return [];
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await etiquetaService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ BUSQUEDA ============

  buscar: async (filtros: EtiquetaFiltros) => {
    set({ buscando: true });
    try {
      const resultados = await etiquetaService.buscar(filtros);
      set({ resultadosBusqueda: resultados, buscando: false });
    } catch (error: any) {
      set({ buscando: false });
      console.error('Error en busqueda:', error);
    }
  },

  buscarPorNombre: async (nombre: string) => {
    try {
      return await etiquetaService.buscarPorNombre(nombre);
    } catch (error: any) {
      console.error('Error buscando por nombre:', error);
      return null;
    }
  },

  getByTipo: async (tipo: TipoEtiqueta) => {
    try {
      return await etiquetaService.getByTipo(tipo);
    } catch (error: any) {
      console.error('Error obteniendo por tipo:', error);
      return [];
    }
  },

  limpiarBusqueda: () => {
    set({ resultadosBusqueda: [] });
  },

  // ============ CRUD ============

  getById: async (id: string) => {
    try {
      const etiqueta = await etiquetaService.getById(id);
      if (etiqueta) {
        set({ etiquetaSeleccionada: etiqueta });
      }
      return etiqueta;
    } catch (error: any) {
      console.error('Error obteniendo etiqueta:', error);
      return null;
    }
  },

  create: async (data: EtiquetaFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevaEtiqueta = await etiquetaService.create(data, userId);
      await get().fetchEtiquetas();
      await get().fetchEtiquetasActivas();
      await get().fetchEtiquetasAgrupadas();
      set({ loading: false });
      return nuevaEtiqueta;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  crearRapida: async (nombre: string, tipo: TipoEtiqueta, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevaEtiqueta = await etiquetaService.crearRapida(nombre, tipo, userId);
      await get().fetchEtiquetasActivas();
      await get().fetchEtiquetasAgrupadas();
      set({ loading: false });
      return nuevaEtiqueta;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  update: async (id: string, data: Partial<EtiquetaFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await etiquetaService.update(id, data, userId);
      await get().fetchEtiquetas();
      await get().fetchEtiquetasActivas();
      await get().fetchEtiquetasAgrupadas();

      const { etiquetaSeleccionada } = get();
      if (etiquetaSeleccionada?.id === id) {
        const actualizada = await etiquetaService.getById(id);
        set({ etiquetaSeleccionada: actualizada });
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
      await etiquetaService.delete(id);
      await get().fetchEtiquetas();
      await get().fetchEtiquetasActivas();
      await get().fetchEtiquetasAgrupadas();

      const { etiquetaSeleccionada } = get();
      if (etiquetaSeleccionada?.id === id) {
        set({ etiquetaSeleccionada: null });
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
      await etiquetaService.cambiarEstado(id, estado, userId);
      await get().fetchEtiquetas();
      await get().fetchEtiquetasActivas();
      await get().fetchEtiquetasAgrupadas();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ ACCIONES ESPECIALES ============

  crearPresets: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const creadas = await etiquetaService.crearPresets(userId);
      await get().fetchEtiquetas();
      await get().fetchEtiquetasActivas();
      await get().fetchEtiquetasAgrupadas();
      set({ loading: false });
      return creadas;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ SELECCION ============

  setEtiquetaSeleccionada: (etiqueta: Etiqueta | null) => {
    set({ etiquetaSeleccionada: etiqueta });
  },

  clearError: () => set({ error: null })
}));
