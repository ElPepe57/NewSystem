import { create } from 'zustand';
import { transportistaService } from '../services/transportista.service';
import type {
  Transportista,
  TransportistaFormData,
  TransportistaFilters,
  TipoTransportista
} from '../types/transportista.types';

interface TransportistaState {
  // Estado
  transportistas: Transportista[];
  transportistasActivos: Transportista[];
  transportistasInternos: Transportista[];
  transportistasExternos: Transportista[];
  ranking: Transportista[];
  selectedTransportista: Transportista | null;
  loading: boolean;
  error: string | null;

  // Acciones
  fetchTransportistas: () => Promise<void>;
  fetchActivos: () => Promise<void>;
  fetchByTipo: (tipo: TipoTransportista) => Promise<void>;
  fetchRanking: () => Promise<void>;
  search: (filters: TransportistaFilters) => Promise<Transportista[]>;
  getById: (id: string) => Promise<Transportista | null>;
  createTransportista: (data: TransportistaFormData, userId: string) => Promise<string>;
  updateTransportista: (id: string, data: Partial<TransportistaFormData>, userId: string) => Promise<void>;
  toggleEstado: (id: string, userId: string) => Promise<void>;
  setSelectedTransportista: (transportista: Transportista | null) => void;
  seedDefaultTransportistas: (userId: string) => Promise<void>;
  clearError: () => void;
}

export const useTransportistaStore = create<TransportistaState>((set, get) => ({
  transportistas: [],
  transportistasActivos: [],
  transportistasInternos: [],
  transportistasExternos: [],
  ranking: [],
  selectedTransportista: null,
  loading: false,
  error: null,

  fetchTransportistas: async () => {
    set({ loading: true, error: null });
    try {
      const transportistas = await transportistaService.getAll();
      set({ transportistas, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchActivos: async () => {
    set({ loading: true, error: null });
    try {
      const transportistasActivos = await transportistaService.getActivos();
      set({ transportistasActivos, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchByTipo: async (tipo: TipoTransportista) => {
    set({ loading: true, error: null });
    try {
      const transportistas = await transportistaService.getByTipo(tipo);
      if (tipo === 'interno') {
        set({ transportistasInternos: transportistas, loading: false });
      } else {
        set({ transportistasExternos: transportistas, loading: false });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchRanking: async () => {
    set({ loading: true, error: null });
    try {
      const ranking = await transportistaService.getRanking(10);
      set({ ranking, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  search: async (filters: TransportistaFilters) => {
    set({ loading: true, error: null });
    try {
      const transportistas = await transportistaService.search(filters);
      set({ loading: false });
      return transportistas;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  getById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const transportista = await transportistaService.getById(id);
      set({ selectedTransportista: transportista, loading: false });
      return transportista;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  createTransportista: async (data: TransportistaFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await transportistaService.create(data, userId);
      await get().fetchTransportistas();
      await get().fetchActivos();
      set({ loading: false });
      return id;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  updateTransportista: async (id: string, data: Partial<TransportistaFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await transportistaService.update(id, data, userId);
      await get().fetchTransportistas();
      await get().fetchActivos();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  toggleEstado: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await transportistaService.toggleEstado(id, userId);
      await get().fetchTransportistas();
      await get().fetchActivos();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  setSelectedTransportista: (transportista: Transportista | null) => {
    set({ selectedTransportista: transportista });
  },

  seedDefaultTransportistas: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      await transportistaService.seedDefaultTransportistas(userId);
      await get().fetchTransportistas();
      await get().fetchActivos();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null })
}));
