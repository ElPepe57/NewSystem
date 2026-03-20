import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { tesoreriaService } from '../services/tesoreria.service';
import type {
  MovimientoTesoreria,
  ConversionCambiaria,
  CuentaCaja,
  TesoreriaStats,
  MovimientoTesoreriaFormData,
  ConversionCambiariaFormData,
  CuentaCajaFormData,
  TransferenciaEntreCuentasFormData,
  MovimientoTesoreriaFiltros,
  ConversionCambiariaFiltros
} from '../types/tesoreria.types';

interface TesoreriaState {
  // Datos
  movimientos: MovimientoTesoreria[];
  conversiones: ConversionCambiaria[];
  cuentas: CuentaCaja[];
  stats: TesoreriaStats | null;
  loading: boolean;
  error: string | null;

  // Acciones - Consultas
  fetchAll: () => Promise<void>;
  fetchMovimientos: (filtros?: MovimientoTesoreriaFiltros) => Promise<void>;
  fetchConversiones: (filtros?: ConversionCambiariaFiltros) => Promise<void>;
  fetchCuentas: () => Promise<void>;
  fetchStats: () => Promise<void>;

  // Acciones - Mutaciones
  registrarMovimiento: (data: MovimientoTesoreriaFormData, userId: string) => Promise<string>;
  actualizarMovimiento: (id: string, data: Partial<MovimientoTesoreriaFormData>, userId: string) => Promise<void>;
  eliminarMovimiento: (id: string, userId: string) => Promise<void>;
  registrarConversion: (data: ConversionCambiariaFormData, userId: string) => Promise<string>;
  transferirEntreCuentas: (data: TransferenciaEntreCuentasFormData, userId: string) => Promise<void>;
  crearCuenta: (data: CuentaCajaFormData, userId: string) => Promise<string>;
  actualizarCuenta: (id: string, data: Partial<CuentaCajaFormData>, userId: string) => Promise<void>;
  recalcularSaldos: () => Promise<{ cuentasActualizadas: number; errores: string[] }>;

  // Utilidades
  clearError: () => void;
}

export const useTesoreriaStore = create<TesoreriaState>()(
  devtools(
    (set, get) => ({
      movimientos: [],
      conversiones: [],
      cuentas: [],
      stats: null,
      loading: false,
      error: null,

      fetchAll: async () => {
        set({ loading: true, error: null });
        try {
          const [movimientos, conversiones, cuentas, stats] = await Promise.all([
            tesoreriaService.getMovimientos(),
            tesoreriaService.getConversiones(),
            tesoreriaService.getCuentas(),
            tesoreriaService.getStats()
          ]);
          set({ movimientos, conversiones, cuentas, stats, loading: false });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message, loading: false });
          throw error;
        }
      },

      fetchMovimientos: async (filtros?: MovimientoTesoreriaFiltros) => {
        set({ loading: true, error: null });
        try {
          const movimientos = await tesoreriaService.getMovimientos(filtros);
          set({ movimientos, loading: false });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message, loading: false });
          throw error;
        }
      },

      fetchConversiones: async (filtros?: ConversionCambiariaFiltros) => {
        set({ loading: true, error: null });
        try {
          const conversiones = await tesoreriaService.getConversiones(filtros);
          set({ conversiones, loading: false });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message, loading: false });
          throw error;
        }
      },

      fetchCuentas: async () => {
        set({ loading: true, error: null });
        try {
          const cuentas = await tesoreriaService.getCuentas();
          set({ cuentas, loading: false });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message, loading: false });
          throw error;
        }
      },

      fetchStats: async () => {
        set({ error: null });
        try {
          const stats = await tesoreriaService.getStats();
          set({ stats });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message });
          throw error;
        }
      },

      registrarMovimiento: async (data: MovimientoTesoreriaFormData, userId: string) => {
        set({ error: null });
        try {
          const id = await tesoreriaService.registrarMovimiento(data, userId);
          await get().fetchAll();
          return id;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message });
          throw error;
        }
      },

      actualizarMovimiento: async (id: string, data: Partial<MovimientoTesoreriaFormData>, userId: string) => {
        set({ error: null });
        try {
          await tesoreriaService.actualizarMovimiento(id, data, userId);
          await get().fetchAll();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message });
          throw error;
        }
      },

      eliminarMovimiento: async (id: string, userId: string) => {
        set({ error: null });
        try {
          await tesoreriaService.eliminarMovimiento(id, userId);
          await get().fetchAll();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message });
          throw error;
        }
      },

      registrarConversion: async (data: ConversionCambiariaFormData, userId: string) => {
        set({ error: null });
        try {
          const id = await tesoreriaService.registrarConversion(data, userId);
          await get().fetchAll();
          return id;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message });
          throw error;
        }
      },

      transferirEntreCuentas: async (data: TransferenciaEntreCuentasFormData, userId: string) => {
        set({ error: null });
        try {
          await tesoreriaService.transferirEntreCuentas(data, userId);
          await get().fetchAll();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message });
          throw error;
        }
      },

      crearCuenta: async (data: CuentaCajaFormData, userId: string) => {
        set({ error: null });
        try {
          const id = await tesoreriaService.crearCuenta(data, userId);
          await get().fetchAll();
          return id;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message });
          throw error;
        }
      },

      actualizarCuenta: async (id: string, data: Partial<CuentaCajaFormData>, userId: string) => {
        set({ error: null });
        try {
          await tesoreriaService.actualizarCuenta(id, data, userId);
          await get().fetchAll();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message });
          throw error;
        }
      },

      recalcularSaldos: async () => {
        set({ loading: true, error: null });
        try {
          const resultado = await tesoreriaService.recalcularTodosLosSaldos();
          await get().fetchAll();
          return resultado;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message, loading: false });
          throw error;
        }
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'tesoreria-store' }
  )
);
