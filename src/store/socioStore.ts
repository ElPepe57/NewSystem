/**
 * socioStore · chk5.E-INV-SOC (2026-05-24)
 *
 * Store Zustand de socios · mismo patrón que clienteStore, proveedorStore,
 * colaboradorStore. Consumido por:
 *  - useEntidadesPorTipo (cuando tipo='socio')
 *  - Maestros · sub-tab Socios
 *  - inversionistaService (agregaciones por socio)
 */

import { create } from 'zustand';
import { socioService } from '../services/socio.service';
import type { Socio, SocioFormData } from '../types/inversionista.types';

interface SocioState {
  socios: Socio[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchSocios: () => Promise<void>;
  crearSocio: (data: SocioFormData, userId: string) => Promise<string>;
  actualizarSocio: (id: string, data: Partial<SocioFormData>, userId: string) => Promise<void>;
  eliminarSocio: (id: string) => Promise<void>;
}

export const useSocioStore = create<SocioState>((set, get) => ({
  socios: [],
  loading: false,
  error: null,

  fetchSocios: async () => {
    set({ loading: true, error: null });
    try {
      const socios = await socioService.getAll();
      set({ socios, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
    }
  },

  crearSocio: async (data, userId) => {
    const id = await socioService.crear(data, userId);
    await get().fetchSocios();
    return id;
  },

  actualizarSocio: async (id, data, userId) => {
    await socioService.actualizar(id, data, userId);
    await get().fetchSocios();
  },

  eliminarSocio: async (id) => {
    await socioService.eliminar(id);
    await get().fetchSocios();
  },
}));
