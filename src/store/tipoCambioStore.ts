import { create } from 'zustand';
import { tipoCambioService } from '../services/tipoCambio.service';
import type { TipoCambio, TipoCambioFormData, TipoCambioFiltros } from '../types/tipoCambio.types';

interface TipoCambioState {
  tiposCambio: TipoCambio[];
  loading: boolean;
  error: string | null;
  
  // Acciones
  fetchTiposCambio: () => Promise<void>;
  fetchHistorial: (filtros?: TipoCambioFiltros) => Promise<void>;
  getTCDelDia: () => Promise<TipoCambio | null>;
  createTipoCambio: (data: TipoCambioFormData, userId: string) => Promise<void>;
  updateTipoCambio: (id: string, data: Partial<TipoCambioFormData>, userId: string) => Promise<void>;
  registrarDesdeSunat: (fecha: Date, userId: string) => Promise<void>;
  getUltimosDias: (dias?: number) => Promise<TipoCambio[]>;
  clearError: () => void;
}

export const useTipoCambioStore = create<TipoCambioState>((set, get) => ({
  tiposCambio: [],
  loading: false,
  error: null,

  fetchTiposCambio: async () => {
    set({ loading: true, error: null });
    try {
      const tiposCambio = await tipoCambioService.getAll();
      set({ tiposCambio, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchHistorial: async (filtros?: TipoCambioFiltros) => {
    set({ loading: true, error: null });
    try {
      const tiposCambio = await tipoCambioService.getHistorial(filtros);
      set({ tiposCambio, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  getTCDelDia: async () => {
    set({ loading: true, error: null });
    try {
      const tc = await tipoCambioService.getTCDelDia();
      set({ loading: false });
      return tc;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  createTipoCambio: async (data: TipoCambioFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      await tipoCambioService.create(data, userId);
      await get().fetchTiposCambio();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateTipoCambio: async (id: string, data: Partial<TipoCambioFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await tipoCambioService.update(id, data, userId);
      await get().fetchTiposCambio();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  registrarDesdeSunat: async (fecha: Date, userId: string) => {
    set({ loading: true, error: null });
    try {
      await tipoCambioService.registrarDesdeSunat(fecha, userId);
      await get().fetchTiposCambio();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  getUltimosDias: async (dias: number = 30) => {
    set({ loading: true, error: null });
    try {
      const tiposCambio = await tipoCambioService.getUltimosDias(dias);
      set({ loading: false });
      return tiposCambio;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null })
}));
