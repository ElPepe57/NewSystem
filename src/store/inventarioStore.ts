import { create } from 'zustand';
import { inventarioService } from '../services/inventario.service';
import type {
  InventarioProducto,
  InventarioPorPais,
  InventarioResumen,
  InventarioFiltros,
  InventarioStats
} from '../types/inventario.types';

interface InventarioState {
  inventario: InventarioProducto[];
  resumen: InventarioResumen | null;
  stats: InventarioStats | null;
  loading: boolean;
  error: string | null;

  // Acciones
  fetchInventario: (filtros?: InventarioFiltros) => Promise<void>;
  fetchInventarioPorPais: (pais: string) => Promise<InventarioPorPais>;
  fetchResumen: () => Promise<void>;
  fetchStats: () => Promise<void>;
  clearError: () => void;
}

export const useInventarioStore = create<InventarioState>((set, get) => ({
  inventario: [],
  resumen: null,
  stats: null,
  loading: false,
  error: null,

  fetchInventario: async (filtros?: InventarioFiltros) => {
    set({ loading: true, error: null });
    try {
      const inventario = await inventarioService.getInventarioAgregado(filtros);
      set({ inventario, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchInventarioPorPais: async (pais: string) => {
    set({ loading: true, error: null });
    try {
      const data = await inventarioService.getInventarioPorPais(pais);
      set({ loading: false });
      return data;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchResumen: async () => {
    set({ loading: true, error: null });
    try {
      const resumen = await inventarioService.getResumenGeneral();
      set({ resumen, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await inventarioService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null })
}));
