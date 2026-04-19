import { create } from 'zustand';
import { colaboradorService } from '../services/colaborador.service';
import type { Colaborador, ColaboradorFormData, TipoColaborador } from '../types/colaborador.types';

interface ColaboradorState {
  colaboradores: Colaborador[];
  viajeros: Colaborador[];
  couriers: Colaborador[];
  empresa: Colaborador | null;
  // Transportistas locales activos (alias para compatibilidad con consumidores del transportistaStore)
  transportistasActivos: Colaborador[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchColaboradores: () => Promise<void>;
  // Alias compatible con el transportistaStore: carga transportistas_local activos
  fetchActivos: () => Promise<void>;
  crearColaborador: (data: ColaboradorFormData, userId: string) => Promise<string>;
  actualizarColaborador: (id: string, data: Partial<ColaboradorFormData>, userId: string) => Promise<void>;
  eliminarColaborador: (id: string) => Promise<void>;
  getByTipo: (tipo: TipoColaborador) => Colaborador[];
}

export const useColaboradorStore = create<ColaboradorState>((set, get) => ({
  colaboradores: [],
  viajeros: [],
  couriers: [],
  empresa: null,
  transportistasActivos: [],
  loading: false,
  error: null,

  fetchColaboradores: async () => {
    set({ loading: true, error: null });
    try {
      const colaboradores = await colaboradorService.getAll();
      const viajeros = colaboradores.filter(c => c.tipo === 'viajero');
      const couriers = colaboradores.filter(c => c.tipo === 'courier_externo');
      const empresa = colaboradores.find(c => c.tipo === 'empresa') || null;
      const transportistasActivos = colaboradores.filter(
        c => c.tipo === 'transportista_local' && c.estado === 'activo'
      );
      set({ colaboradores, viajeros, couriers, empresa, transportistasActivos, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
    }
  },

  fetchActivos: async () => {
    set({ loading: true, error: null });
    try {
      const colaboradores = await colaboradorService.getAll();
      const transportistasActivos = colaboradores.filter(
        c => c.tipo === 'transportista_local' && c.estado === 'activo'
      );
      set({ transportistasActivos, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
    }
  },

  crearColaborador: async (data, userId) => {
    const id = await colaboradorService.crear(data, userId);
    await get().fetchColaboradores();
    return id;
  },

  actualizarColaborador: async (id, data, userId) => {
    await colaboradorService.actualizar(id, data, userId);
    await get().fetchColaboradores();
  },

  eliminarColaborador: async (id) => {
    await colaboradorService.eliminar(id);
    await get().fetchColaboradores();
  },

  getByTipo: (tipo) => {
    return get().colaboradores.filter(c => c.tipo === tipo);
  },
}));
