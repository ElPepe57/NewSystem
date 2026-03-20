import { create } from 'zustand';
import { paisOrigenService } from '../services/paisOrigen.service';
import type { PaisOrigen, PaisOrigenFormData } from '../types/paisOrigen.types';

interface PaisOrigenState {
  paises: PaisOrigen[];
  paisesActivos: PaisOrigen[];
  loading: boolean;
  error: string | null;

  fetchPaises: () => Promise<void>;
  fetchPaisesActivos: () => Promise<void>;
  createPais: (data: PaisOrigenFormData, userId: string) => Promise<string>;
  updatePais: (id: string, data: Partial<PaisOrigenFormData>, userId: string) => Promise<void>;
  clearError: () => void;

  // Helpers
  getPaisNombre: (codigo: string) => string;
  getPaisByCodigo: (codigo: string) => PaisOrigen | undefined;
  getFleteEstimado: (codigo: string) => number;
}

export const usePaisOrigenStore = create<PaisOrigenState>((set, get) => ({
  paises: [],
  paisesActivos: [],
  loading: false,
  error: null,

  fetchPaises: async () => {
    set({ loading: true, error: null });
    try {
      const paises = await paisOrigenService.getAll();
      set({ paises, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchPaisesActivos: async () => {
    set({ loading: true, error: null });
    try {
      const paisesActivos = await paisOrigenService.getActivos();
      set({ paisesActivos, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createPais: async (data: PaisOrigenFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await paisOrigenService.create(data, userId);
      await get().fetchPaises();
      await get().fetchPaisesActivos();
      set({ loading: false });
      return id;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  updatePais: async (id: string, data: Partial<PaisOrigenFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await paisOrigenService.update(id, data, userId);
      await get().fetchPaises();
      await get().fetchPaisesActivos();
      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),

  getPaisNombre: (codigo: string) => {
    const pais = get().paises.find(p => p.codigo === codigo);
    return pais?.nombre || codigo;
  },

  getPaisByCodigo: (codigo: string) => {
    return get().paises.find(p => p.codigo === codigo);
  },

  getFleteEstimado: (codigo: string) => {
    const pais = get().paises.find(p => p.codigo === codigo);
    return pais?.tarifaFleteEstimadaUSD ?? 0;
  },
}));
