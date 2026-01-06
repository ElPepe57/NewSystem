import { create } from 'zustand';
import { canalVentaService } from '../services/canalVenta.service';
import type { CanalVenta, CanalVentaFormData, EstadoCanalVenta } from '../types/canalVenta.types';

interface CanalVentaState {
  // Estado
  canales: CanalVenta[];
  canalesActivos: CanalVenta[];
  selectedCanal: CanalVenta | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;

  // Acciones
  fetchCanales: () => Promise<void>;
  fetchCanalesActivos: () => Promise<void>;
  getById: (id: string) => Promise<CanalVenta | null>;
  getByCodigo: (codigo: string) => Promise<CanalVenta | null>;
  createCanal: (data: CanalVentaFormData, userId: string) => Promise<string>;
  updateCanal: (id: string, data: Partial<CanalVentaFormData>, userId: string) => Promise<void>;
  cambiarEstado: (id: string, estado: EstadoCanalVenta, userId: string) => Promise<void>;
  reordenarCanales: (ordenCanales: { id: string; orden: number }[]) => Promise<void>;
  inicializarCanalesSistema: (userId: string) => Promise<void>;
  setSelectedCanal: (canal: CanalVenta | null) => void;
  clearError: () => void;
}

export const useCanalVentaStore = create<CanalVentaState>((set, get) => ({
  // Estado inicial
  canales: [],
  canalesActivos: [],
  selectedCanal: null,
  loading: false,
  error: null,
  initialized: false,

  // ============================================
  // FETCH
  // ============================================

  fetchCanales: async () => {
    set({ loading: true, error: null });
    try {
      const canales = await canalVentaService.getAll();
      set({ canales, loading: false, initialized: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchCanalesActivos: async () => {
    set({ loading: true, error: null });
    try {
      const canalesActivos = await canalVentaService.getActivos();
      set({ canalesActivos, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // ============================================
  // GET
  // ============================================

  getById: async (id: string) => {
    try {
      // Primero buscar en cache local
      const { canales } = get();
      const canalLocal = canales.find(c => c.id === id);
      if (canalLocal) {
        return canalLocal;
      }

      // Si no está en cache, buscar en Firestore
      return await canalVentaService.getById(id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message });
      throw error;
    }
  },

  getByCodigo: async (codigo: string) => {
    try {
      // Primero buscar en cache local
      const { canales } = get();
      const canalLocal = canales.find(c => c.codigo === codigo);
      if (canalLocal) {
        return canalLocal;
      }

      // Si no está en cache, buscar en Firestore
      return await canalVentaService.getByCodigo(codigo);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message });
      throw error;
    }
  },

  // ============================================
  // CREATE / UPDATE
  // ============================================

  createCanal: async (data: CanalVentaFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await canalVentaService.create(data, userId);

      // Refrescar lista
      await get().fetchCanales();

      set({ loading: false });
      return id;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  updateCanal: async (id: string, data: Partial<CanalVentaFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await canalVentaService.update(id, data, userId);

      // Refrescar lista
      await get().fetchCanales();

      // Actualizar selectedCanal si es el mismo
      const { selectedCanal } = get();
      if (selectedCanal && selectedCanal.id === id) {
        const canalActualizado = await canalVentaService.getById(id);
        set({ selectedCanal: canalActualizado });
      }

      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  cambiarEstado: async (id: string, estado: EstadoCanalVenta, userId: string) => {
    set({ loading: true, error: null });
    try {
      await canalVentaService.cambiarEstado(id, estado, userId);

      // Refrescar lista
      await get().fetchCanales();

      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  reordenarCanales: async (ordenCanales: { id: string; orden: number }[]) => {
    set({ loading: true, error: null });
    try {
      await canalVentaService.reordenar(ordenCanales);

      // Refrescar lista
      await get().fetchCanales();

      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // ============================================
  // INICIALIZACIÓN
  // ============================================

  inicializarCanalesSistema: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      await canalVentaService.inicializarCanalesSistema(userId);

      // Cargar canales después de inicializar
      await get().fetchCanales();

      set({ loading: false, initialized: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // ============================================
  // UTILIDADES
  // ============================================

  setSelectedCanal: (canal: CanalVenta | null) => {
    set({ selectedCanal: canal });
  },

  clearError: () => {
    set({ error: null });
  }
}));
