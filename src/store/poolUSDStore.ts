import { create } from 'zustand';
import { poolUSDService } from '../services/poolUSD.service';
import type {
  PoolUSDMovimiento,
  PoolUSDSnapshot,
  PoolUSDResumen,
  PoolMovimientoFormData,
  SaldoInicialFormData,
  TipoMovimientoPool,
} from '../types/rendimientoCambiario.types';

interface PoolUSDState {
  // Estado
  movimientos: PoolUSDMovimiento[];
  snapshots: PoolUSDSnapshot[];
  resumen: PoolUSDResumen | null;
  loading: boolean;
  error: string | null;

  // Acciones — lectura
  fetchMovimientos: (filtros?: {
    fechaInicio?: Date;
    fechaFin?: Date;
    tipo?: TipoMovimientoPool;
    direccion?: 'entrada' | 'salida';
  }) => Promise<void>;
  fetchMovimientosPeriodo: (anio: number, mes: number) => Promise<void>;
  fetchSnapshots: () => Promise<void>;
  fetchResumen: () => Promise<void>;

  // Acciones — escritura
  registrarMovimiento: (data: PoolMovimientoFormData, userId: string) => Promise<PoolUSDMovimiento>;
  registrarSaldoInicial: (data: SaldoInicialFormData, userId: string) => Promise<PoolUSDMovimiento>;
  recalcularPool: (userId: string) => Promise<{ movimientosRecalculados: number; saldoFinal: number; tcpaFinal: number }>;
  generarSnapshot: (anio: number, mes: number, userId: string) => Promise<PoolUSDSnapshot>;
  eliminarMovimiento: (movimientoId: string) => Promise<void>;

  // Utilidades
  clearError: () => void;
}

export const usePoolUSDStore = create<PoolUSDState>((set) => ({
  movimientos: [],
  snapshots: [],
  resumen: null,
  loading: false,
  error: null,

  fetchMovimientos: async (filtros) => {
    set({ loading: true, error: null });
    try {
      const movimientos = await poolUSDService.getMovimientos(filtros);
      set({ movimientos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchMovimientosPeriodo: async (anio, mes) => {
    set({ loading: true, error: null });
    try {
      const movimientos = await poolUSDService.getMovimientosPeriodo(anio, mes);
      set({ movimientos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchSnapshots: async () => {
    set({ loading: true, error: null });
    try {
      const snapshots = await poolUSDService.getSnapshots();
      set({ snapshots, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchResumen: async () => {
    set({ loading: true, error: null });
    try {
      const resumen = await poolUSDService.getResumen();
      set({ resumen, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  registrarMovimiento: async (data, userId) => {
    set({ loading: true, error: null });
    try {
      const mov = await poolUSDService.registrarMovimiento(data, userId);
      // Refrescar movimientos y resumen
      const movimientos = await poolUSDService.getMovimientos();
      const resumen = await poolUSDService.getResumen();
      set({ movimientos, resumen, loading: false });
      return mov;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  registrarSaldoInicial: async (data, userId) => {
    set({ loading: true, error: null });
    try {
      const mov = await poolUSDService.registrarSaldoInicial(data, userId);
      const movimientos = await poolUSDService.getMovimientos();
      const resumen = await poolUSDService.getResumen();
      set({ movimientos, resumen, loading: false });
      return mov;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  recalcularPool: async (userId) => {
    set({ loading: true, error: null });
    try {
      const result = await poolUSDService.recalcularPoolDesdeHistorico(userId);
      const movimientos = await poolUSDService.getMovimientos();
      const resumen = await poolUSDService.getResumen();
      set({ movimientos, resumen, loading: false });
      return result;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  generarSnapshot: async (anio, mes, userId) => {
    set({ loading: true, error: null });
    try {
      const snap = await poolUSDService.generarSnapshot(anio, mes, userId);
      const snapshots = await poolUSDService.getSnapshots();
      set({ snapshots, loading: false });
      return snap;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  eliminarMovimiento: async (movimientoId) => {
    set({ loading: true, error: null });
    try {
      await poolUSDService.eliminarMovimiento(movimientoId);
      const movimientos = await poolUSDService.getMovimientos();
      const resumen = await poolUSDService.getResumen();
      set({ movimientos, resumen, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
