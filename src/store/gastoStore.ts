import { create } from 'zustand';
import { gastoService } from '../services/gasto.service';
import type {
  Gasto,
  GastoFormData,
  GastoFiltros,
  ResumenGastosMes,
  GastoStats
} from '../types/gasto.types';

interface PagoGastoData {
  fechaPago: Date;
  monedaPago: 'USD' | 'PEN';
  montoPago: number;
  tipoCambio: number;
  metodoPago: string;
  cuentaOrigenId: string;
  referenciaPago?: string;
  notas?: string;
}

type ViewMode = 'month' | 'all' | 'pending';

interface GastoState {
  gastos: Gasto[];
  resumenMes: ResumenGastosMes | null;
  stats: GastoStats | null;
  loading: boolean;
  error: string | null;

  // Vista actual
  currentViewMode: ViewMode;
  currentMonth: number;
  currentYear: number;

  // Acciones
  fetchGastos: () => Promise<void>;
  fetchGastosMes: (mes: number, anio: number) => Promise<void>;
  fetchGastosMesActual: () => Promise<void>;
  fetchResumenMes: (mes: number, anio: number) => Promise<void>;
  fetchStats: () => Promise<void>;
  buscarGastos: (filtros: GastoFiltros) => Promise<void>;
  crearGasto: (data: GastoFormData, userId: string) => Promise<string>;
  actualizarGasto: (id: string, data: Partial<GastoFormData>, userId: string) => Promise<void>;
  eliminarGasto: (id: string) => Promise<void>;
  registrarPagoGasto: (gastoId: string, datoPago: PagoGastoData, userId: string) => Promise<void>;
  getGastosPendientesRecalculo: () => Promise<Gasto[]>;
  fetchGastosPendientesYParciales: () => Promise<void>;
  setViewMode: (mode: ViewMode, mes?: number, anio?: number) => void;
  reloadCurrentView: () => Promise<void>;
  clearError: () => void;
}

export const useGastoStore = create<GastoState>((set, get) => ({
  gastos: [],
  resumenMes: null,
  stats: null,
  loading: false,
  error: null,

  // Vista actual - defaults al mes actual
  currentViewMode: 'month',
  currentMonth: new Date().getMonth() + 1,
  currentYear: new Date().getFullYear(),

  fetchGastos: async () => {
    set({ loading: true, error: null });
    try {
      const gastos = await gastoService.getAll();
      set({ gastos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchGastosMes: async (mes: number, anio: number) => {
    set({ loading: true, error: null });
    try {
      const gastos = await gastoService.getGastosMes(mes, anio);
      set({ gastos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchGastosMesActual: async () => {
    set({ loading: true, error: null });
    try {
      const gastos = await gastoService.getGastosMesActual();
      set({ gastos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchResumenMes: async (mes: number, anio: number) => {
    set({ loading: true, error: null });
    try {
      const resumenMes = await gastoService.getResumenMes(mes, anio);
      set({ resumenMes, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await gastoService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  buscarGastos: async (filtros: GastoFiltros) => {
    set({ loading: true, error: null });
    try {
      const gastos = await gastoService.buscar(filtros);
      set({ gastos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  crearGasto: async (data: GastoFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await gastoService.create(data, userId);
      await get().reloadCurrentView();
      await get().fetchStats();
      set({ loading: false });
      return id;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  actualizarGasto: async (id: string, data: Partial<GastoFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await gastoService.update(id, data, userId);
      await get().reloadCurrentView();
      await get().fetchStats();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  eliminarGasto: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await gastoService.delete(id);
      await get().reloadCurrentView();
      await get().fetchStats();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  getGastosPendientesRecalculo: async () => {
    try {
      return await gastoService.getGastosPendientesRecalculoCTRU();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  fetchGastosPendientesYParciales: async () => {
    set({ loading: true, error: null });
    try {
      const allGastos = await gastoService.getAll();
      const gastos = allGastos.filter(
        g => g.estado === 'pendiente' || g.estado === 'parcial'
      );
      set({ gastos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  registrarPagoGasto: async (gastoId: string, datoPago: PagoGastoData, userId: string) => {
    set({ loading: true, error: null });
    try {
      await gastoService.registrarPago(gastoId, {
        fechaPago: datoPago.fechaPago,
        monedaPago: datoPago.monedaPago,
        montoPago: datoPago.montoPago,
        tipoCambio: datoPago.tipoCambio,
        metodoPago: datoPago.metodoPago as any,
        cuentaOrigenId: datoPago.cuentaOrigenId,
        referenciaPago: datoPago.referenciaPago,
        notas: datoPago.notas
      }, userId);
      await get().reloadCurrentView();
      await get().fetchStats();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  setViewMode: (mode: ViewMode, mes?: number, anio?: number) => {
    set({
      currentViewMode: mode,
      currentMonth: mes ?? get().currentMonth,
      currentYear: anio ?? get().currentYear
    });
  },

  reloadCurrentView: async () => {
    const { currentViewMode, currentMonth, currentYear } = get();
    if (currentViewMode === 'all') {
      await get().fetchGastos();
    } else if (currentViewMode === 'pending') {
      await get().fetchGastosPendientesYParciales();
    } else {
      await get().fetchGastosMes(currentMonth, currentYear);
    }
  },

  clearError: () => set({ error: null })
}));
