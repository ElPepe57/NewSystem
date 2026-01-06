import { create } from 'zustand';
import { entregaService } from '../services/entrega.service';
import type {
  Entrega,
  ProgramarEntregaData,
  ResultadoEntregaData,
  ResumenEntregasVenta,
  EntregaStats,
  EntregaFilters
} from '../types/entrega.types';
import type { Venta } from '../types/venta.types';

interface EntregaState {
  // Estado
  entregas: Entrega[];
  entregasPendientes: Entrega[];
  entregasDelDia: Entrega[];
  resumenVenta: ResumenEntregasVenta | null;
  stats: EntregaStats | null;
  selectedEntrega: Entrega | null;
  loading: boolean;
  error: string | null;

  // Acciones
  fetchEntregas: () => Promise<void>;
  fetchPendientes: () => Promise<void>;
  fetchDelDia: (fecha?: Date) => Promise<void>;
  fetchByVenta: (ventaId: string) => Promise<Entrega[]>;
  fetchResumenVenta: (ventaId: string) => Promise<void>;
  fetchStats: (fechaInicio: Date, fechaFin: Date) => Promise<void>;
  search: (filters: EntregaFilters) => Promise<Entrega[]>;
  getById: (id: string) => Promise<Entrega | null>;
  programarEntrega: (data: ProgramarEntregaData, venta: Venta, userId: string) => Promise<string>;
  marcarEnCamino: (id: string, userId: string) => Promise<void>;
  registrarResultado: (data: ResultadoEntregaData, userId: string) => Promise<void>;
  cancelar: (id: string, motivo: string, userId: string) => Promise<void>;
  registrarTracking: (id: string, tracking: string, userId: string) => Promise<void>;
  setSelectedEntrega: (entrega: Entrega | null) => void;
  clearError: () => void;
}

export const useEntregaStore = create<EntregaState>((set, get) => ({
  entregas: [],
  entregasPendientes: [],
  entregasDelDia: [],
  resumenVenta: null,
  stats: null,
  selectedEntrega: null,
  loading: false,
  error: null,

  fetchEntregas: async () => {
    set({ loading: true, error: null });
    try {
      const entregas = await entregaService.getAll();
      set({ entregas, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchPendientes: async () => {
    set({ loading: true, error: null });
    try {
      const entregasPendientes = await entregaService.getPendientes();
      set({ entregasPendientes, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchDelDia: async (fecha?: Date) => {
    set({ loading: true, error: null });
    try {
      const entregasDelDia = await entregaService.getDelDia(fecha);
      set({ entregasDelDia, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchByVenta: async (ventaId: string) => {
    set({ loading: true, error: null });
    try {
      const entregas = await entregaService.getByVenta(ventaId);
      set({ loading: false });
      return entregas;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchResumenVenta: async (ventaId: string) => {
    set({ loading: true, error: null });
    try {
      const resumenVenta = await entregaService.getResumenVenta(ventaId);
      set({ resumenVenta, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchStats: async (fechaInicio: Date, fechaFin: Date) => {
    set({ loading: true, error: null });
    try {
      const stats = await entregaService.getStats(fechaInicio, fechaFin);
      set({ stats, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  search: async (filters: EntregaFilters) => {
    set({ loading: true, error: null });
    try {
      const entregas = await entregaService.search(filters);
      set({ loading: false });
      return entregas;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  getById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const entrega = await entregaService.getById(id);
      set({ selectedEntrega: entrega, loading: false });
      return entrega;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  programarEntrega: async (data: ProgramarEntregaData, venta: Venta, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await entregaService.programar(data, venta, userId);
      await get().fetchPendientes();
      set({ loading: false });
      return id;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  marcarEnCamino: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await entregaService.marcarEnCamino(id, userId);
      await get().fetchPendientes();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  registrarResultado: async (data: ResultadoEntregaData, userId: string) => {
    set({ loading: true, error: null });
    try {
      await entregaService.registrarResultado(data, userId);
      await get().fetchPendientes();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  cancelar: async (id: string, motivo: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await entregaService.cancelar(id, motivo, userId);
      await get().fetchPendientes();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  registrarTracking: async (id: string, tracking: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await entregaService.registrarTracking(id, tracking, userId);
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  setSelectedEntrega: (entrega: Entrega | null) => {
    set({ selectedEntrega: entrega });
  },

  clearError: () => set({ error: null })
}));
