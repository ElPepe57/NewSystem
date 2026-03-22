/**
 * devolucionStore.ts
 *
 * Store Zustand para el módulo de devoluciones.
 * Gestiona la lista de devoluciones y el estado de carga.
 */

import { create } from 'zustand';
import { devolucionService } from '../services/devolucion.service';
import { logger } from '../lib/logger';
import type { Devolucion, DevolucionFiltros } from '../types/devolucion.types';

// ================================================================
// TIPOS DEL STORE
// ================================================================

interface DevolucionState {
  devoluciones: Devolucion[];
  loading: boolean;
  error: string | null;

  // Acciones
  fetchDevoluciones: (filtros?: DevolucionFiltros) => Promise<void>;
  fetchByVenta: (ventaId: string) => Promise<Devolucion[]>;
  clearError: () => void;
  reset: () => void;
}

// ================================================================
// STORE
// ================================================================

export const useDevolucionStore = create<DevolucionState>((set, get) => ({
  devoluciones: [],
  loading: false,
  error: null,

  /**
   * Carga todas las devoluciones con filtros opcionales.
   * Se usa principalmente en el tab de Devoluciones.
   */
  fetchDevoluciones: async (filtros?: DevolucionFiltros) => {
    set({ loading: true, error: null });
    try {
      const devoluciones = await devolucionService.getAll(filtros);
      set({ devoluciones, loading: false });
    } catch (error: any) {
      logger.error('[devolucionStore.fetchDevoluciones] Error:', error);
      set({
        error: error.message || 'Error al cargar las devoluciones',
        loading: false,
      });
    }
  },

  /**
   * Carga las devoluciones de una venta específica.
   * Retorna el arreglo sin almacenarlo en el store global
   * (cada modal lo gestiona localmente para evitar contaminación).
   */
  fetchByVenta: async (ventaId: string) => {
    try {
      return await devolucionService.getByVenta(ventaId);
    } catch (error: any) {
      logger.error('[devolucionStore.fetchByVenta] Error:', error);
      throw error;
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set({ devoluciones: [], loading: false, error: null }),
}));
