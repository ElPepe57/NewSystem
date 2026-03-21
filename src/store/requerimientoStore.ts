import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { requerimientoService } from '../services/requerimiento.service';
import type {
  Requerimiento,
  RequerimientoFormData,
  EstadoRequerimiento,
  RequerimientoFiltros
} from '../types/requerimiento.types';

interface RequerimientoState {
  // Datos
  requerimientos: Requerimiento[];
  loading: boolean;
  error: string | null;

  // Filtros
  filtroEstado: EstadoRequerimiento | null;

  // Acciones - Consultas
  fetchRequerimientos: (filtros?: RequerimientoFiltros) => Promise<void>;

  // Acciones - Mutaciones
  crearRequerimiento: (data: RequerimientoFormData, userId: string) => Promise<string>;
  actualizarEstado: (id: string, estado: 'pendiente' | 'aprobado' | 'en_proceso' | 'completado' | 'cancelado', userId: string) => Promise<void>;
  limpiarDatosVinculacion: (userId: string) => Promise<{
    reqsCancelados: string[];
    ventasCorregidas: string[];
    resumen: string;
  }>;

  // Utilidades
  setFiltroEstado: (estado: EstadoRequerimiento | null) => void;
  clearError: () => void;
}

export const useRequerimientoStore = create<RequerimientoState>()(
  devtools(
    (set, get) => ({
      requerimientos: [],
      loading: false,
      error: null,
      filtroEstado: null,

      fetchRequerimientos: async (filtros?: RequerimientoFiltros) => {
        set({ loading: true, error: null });
        try {
          const efectivo = filtros || (get().filtroEstado ? { estado: get().filtroEstado! } : undefined);
          const requerimientos = await requerimientoService.getRequerimientos(efectivo);
          set({ requerimientos, loading: false });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message, loading: false });
          throw error;
        }
      },

      crearRequerimiento: async (data: RequerimientoFormData, userId: string) => {
        set({ loading: true, error: null });
        try {
          const id = await requerimientoService.crearRequerimiento(data, userId);
          await get().fetchRequerimientos();
          return id;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message, loading: false });
          throw error;
        }
      },

      actualizarEstado: async (id: string, estado: 'pendiente' | 'aprobado' | 'en_proceso' | 'completado' | 'cancelado', userId: string) => {
        set({ error: null });
        try {
          await requerimientoService.actualizarEstado(id, estado, userId);
          await get().fetchRequerimientos();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message });
          throw error;
        }
      },

      limpiarDatosVinculacion: async (userId: string) => {
        set({ loading: true, error: null });
        try {
          const result = await requerimientoService.limpiarDatosVinculacion(userId);
          await get().fetchRequerimientos();
          return result;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Error desconocido';
          set({ error: message, loading: false });
          throw error;
        }
      },

      setFiltroEstado: (estado: EstadoRequerimiento | null) => {
        set({ filtroEstado: estado });
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'requerimiento-store' }
  )
);
