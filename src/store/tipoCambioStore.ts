import { create } from 'zustand';
import type { TipoCambio, TipoCambioFormData, TipoCambioStats, TipoCambioHistorial } from '../types/tipoCambio.types';
import { TipoCambioService } from '../services/tipoCambio.service';

interface TipoCambioState {
  tiposCambio: TipoCambio[];
  stats: TipoCambioStats | null;
  historial: TipoCambioHistorial[];
  loading: boolean;
  error: string | null;
  selectedTC: TipoCambio | null;
  
  // Actions
  fetchTiposCambio: () => Promise<void>;
  fetchByDateRange: (fechaInicio: Date, fechaFin: Date) => Promise<void>;
  fetchLatest: () => Promise<void>;
  createTipoCambio: (data: TipoCambioFormData, userId: string) => Promise<void>;
  updateTipoCambio: (id: string, data: Partial<TipoCambioFormData>) => Promise<void>;
  deleteTipoCambio: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchHistorial: (dias?: number) => Promise<void>;
  setSelectedTC: (tc: TipoCambio | null) => void;
}

export const useTipoCambioStore = create<TipoCambioState>((set, get) => ({
  tiposCambio: [],
  stats: null,
  historial: [],
  loading: false,
  error: null,
  selectedTC: null,
  
  fetchTiposCambio: async () => {
    set({ loading: true, error: null });
    try {
      const tiposCambio = await TipoCambioService.getAll();
      set({ tiposCambio, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchByDateRange: async (fechaInicio: Date, fechaFin: Date) => {
    set({ loading: true, error: null });
    try {
      const tiposCambio = await TipoCambioService.getByDateRange(fechaInicio, fechaFin);
      set({ tiposCambio, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchLatest: async () => {
    set({ loading: true, error: null });
    try {
      const latest = await TipoCambioService.getLatest();
      if (latest) {
        set({ selectedTC: latest, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  createTipoCambio: async (data: TipoCambioFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevoTC = await TipoCambioService.create(data, userId);
      set(state => ({ 
        tiposCambio: [nuevoTC, ...state.tiposCambio],
        loading: false 
      }));
      
      // Recargar stats después de crear
      await get().fetchStats();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  updateTipoCambio: async (id: string, data: Partial<TipoCambioFormData>) => {
    set({ loading: true, error: null });
    try {
      await TipoCambioService.update(id, data);
      
      // Recargar lista
      await get().fetchTiposCambio();
      await get().fetchStats();
      
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  deleteTipoCambio: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await TipoCambioService.delete(id);
      set(state => ({
        tiposCambio: state.tiposCambio.filter(tc => tc.id !== id),
        loading: false
      }));
      
      // Recargar stats después de eliminar
      await get().fetchStats();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await TipoCambioService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchHistorial: async (dias: number = 30) => {
    set({ loading: true, error: null });
    try {
      const historial = await TipoCambioService.getHistorial(dias);
      set({ historial, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  setSelectedTC: (tc) => {
    set({ selectedTC: tc });
  }
}));