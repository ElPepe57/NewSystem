import { create } from 'zustand';
import { categoriaCostoService } from '../services/categoriaCosto.service';
import type { CategoriaCosto, CategoriaCostoFormData, BloqueCosto } from '../types/categoriaCosto.types';

interface CategoriaCostoState {
  categorias: CategoriaCosto[];
  arbol: Record<BloqueCosto, { padres: CategoriaCosto[]; hijos: Record<string, CategoriaCosto[]> }> | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchCategorias: () => Promise<void>;
  fetchArbol: () => Promise<void>;
  crearCategoria: (data: CategoriaCostoFormData, userId: string) => Promise<string>;
  actualizarCategoria: (id: string, data: Partial<CategoriaCostoFormData>, userId: string) => Promise<void>;
  getByBloque: (bloque: BloqueCosto) => CategoriaCosto[];
  getPadres: (bloque?: BloqueCosto) => CategoriaCosto[];
  getHijos: (padreId: string) => CategoriaCosto[];
}

export const useCategoriaCostoStore = create<CategoriaCostoState>((set, get) => ({
  categorias: [],
  arbol: null,
  loading: false,
  error: null,

  fetchCategorias: async () => {
    set({ loading: true, error: null });
    try {
      const categorias = await categoriaCostoService.getAll();
      set({ categorias, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchArbol: async () => {
    set({ loading: true, error: null });
    try {
      const [categorias, arbol] = await Promise.all([
        categoriaCostoService.getAll(),
        categoriaCostoService.getArbol(),
      ]);
      set({ categorias, arbol, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  crearCategoria: async (data, userId) => {
    const id = await categoriaCostoService.crear(data, userId);
    await get().fetchArbol();
    return id;
  },

  actualizarCategoria: async (id, data, userId) => {
    await categoriaCostoService.actualizar(id, data, userId);
    await get().fetchArbol();
  },

  getByBloque: (bloque) => {
    return get().categorias.filter(c => c.bloque === bloque);
  },

  getPadres: (bloque?) => {
    const cats = get().categorias.filter(c => c.nivel === 0);
    return bloque ? cats.filter(c => c.bloque === bloque) : cats;
  },

  getHijos: (padreId) => {
    return get().categorias.filter(c => c.categoriaPadreId === padreId);
  },
}));
