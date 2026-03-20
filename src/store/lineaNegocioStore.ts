import { create } from 'zustand';
import { lineaNegocioService } from '../services/lineaNegocio.service';
import type { LineaNegocio, LineaNegocioFormData } from '../types/lineaNegocio.types';

interface LineaNegocioState {
  // Estado
  lineas: LineaNegocio[];
  lineasActivas: LineaNegocio[];
  lineaSeleccionada: LineaNegocio | null;
  /** Línea activa para filtrado global (null = todas las líneas) */
  lineaFiltroGlobal: string | null;
  loading: boolean;
  error: string | null;

  // Acciones de carga
  fetchLineas: () => Promise<void>;
  fetchLineasActivas: () => Promise<void>;

  // Acciones CRUD
  getById: (id: string) => Promise<LineaNegocio | null>;
  create: (data: LineaNegocioFormData, userId: string) => Promise<string>;
  update: (id: string, data: Partial<LineaNegocioFormData>, userId: string) => Promise<void>;

  // Filtro global
  setLineaFiltroGlobal: (lineaId: string | null) => void;

  // Selección
  setLineaSeleccionada: (linea: LineaNegocio | null) => void;
  clearError: () => void;

  // Helpers
  getLineaNombre: (id: string) => string;
  getLineaColor: (id: string) => string;
  getLineaCodigo: (id: string) => string;
}

export const useLineaNegocioStore = create<LineaNegocioState>((set, get) => ({
  lineas: [],
  lineasActivas: [],
  lineaSeleccionada: null,
  lineaFiltroGlobal: null,
  loading: false,
  error: null,

  fetchLineas: async () => {
    set({ loading: true, error: null });
    try {
      const lineas = await lineaNegocioService.getAll();
      set({ lineas, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchLineasActivas: async () => {
    set({ loading: true, error: null });
    try {
      const lineasActivas = await lineaNegocioService.getActivas();
      // También poblar `lineas` si está vacío, para que los badges funcionen
      const currentLineas = get().lineas;
      set({
        lineasActivas,
        ...(currentLineas.length === 0 ? { lineas: lineasActivas } : {}),
        loading: false
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  getById: async (id: string) => {
    // Primero buscar en cache
    const cached = get().lineas.find(l => l.id === id);
    if (cached) return cached;
    return lineaNegocioService.getById(id);
  },

  create: async (data: LineaNegocioFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await lineaNegocioService.create(data, userId);
      await get().fetchLineas();
      await get().fetchLineasActivas();
      set({ loading: false });
      return id;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  update: async (id: string, data: Partial<LineaNegocioFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await lineaNegocioService.update(id, data, userId);
      await get().fetchLineas();
      await get().fetchLineasActivas();
      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  setLineaFiltroGlobal: (lineaId: string | null) => {
    set({ lineaFiltroGlobal: lineaId });
  },

  setLineaSeleccionada: (linea: LineaNegocio | null) => {
    set({ lineaSeleccionada: linea });
  },

  clearError: () => set({ error: null }),

  // Helpers para obtener datos de línea desde cache
  getLineaNombre: (id: string) => {
    const linea = get().lineas.find(l => l.id === id);
    return linea?.nombre || 'Sin línea';
  },

  getLineaColor: (id: string) => {
    const linea = get().lineas.find(l => l.id === id);
    return linea?.color || '#6B7280'; // gray-500 default
  },

  getLineaCodigo: (id: string) => {
    const linea = get().lineas.find(l => l.id === id);
    return linea?.codigo || '???';
  },
}));
