import { create } from 'zustand';
import { almacenService } from '../services/casilla.service';
import { casillaCrudService } from '../services/casilla.crud.service';
import type { Almacen, AlmacenFormData, ResumenAlmacenesUSA } from '../types/almacen.types';
import type { Casilla, CasillaFormData } from '../types/casilla.types';

// Tipo para estadísticas de almacenes
export interface AlmacenStats {
  totalAlmacenes: number;
  almacenesActivos: number;
  almacenesUSA: number;
  almacenesPeru: number;
  viajeros: number;
  unidadesTotalesUSA: number;
  valorInventarioUSA: number;
  capacidadPromedioUsada: number;
  almacenesCapacidadCritica: Array<{
    id: string;
    codigo: string;
    nombre: string;
    capacidadUsada: number;
    unidadesActuales: number;
    capacidadTotal: number;
  }>;
  proximosViajes: Array<{
    id: string;
    codigo: string;
    nombre: string;
    fechaViaje: Date;
    diasRestantes: number;
    unidadesActuales: number;
  }>;
  inventarioPorAlmacen: Array<{
    id: string;
    codigo: string;
    nombre: string;
    esViajero: boolean;
    unidadesActuales: number;
    valorInventarioUSD: number;
    capacidadUsada: number;
  }>;
}

interface AlmacenState {
  // Estado legacy (almacenes)
  almacenes: Almacen[];
  almacenesUSA: Almacen[];
  almacenesPeru: Almacen[];
  viajeros: Almacen[];
  viajerosConProximoViaje: Almacen[];
  /** @deprecated Usar ResumenAlmacenesPorPais cuando se implemente el servicio genérico */
  resumenUSA: ResumenAlmacenesUSA | null;
  stats: AlmacenStats | null;
  selectedAlmacen: Almacen | null;
  loading: boolean;
  error: string | null;

  // Estado nuevo (casillas)
  casillas: Casilla[];
  casillasLoading: boolean;

  // Acciones legacy
  fetchAlmacenes: () => Promise<void>;
  fetchAlmacenesUSA: () => Promise<void>;
  fetchAlmacenesPeru: () => Promise<void>;
  fetchViajeros: () => Promise<void>;
  fetchViajerosConProximoViaje: () => Promise<void>;
  fetchResumenUSA: () => Promise<void>;
  fetchStats: () => Promise<void>;
  getByPais: (pais: string) => Promise<Almacen[]>;
  getById: (id: string) => Promise<Almacen | null>;
  createAlmacen: (data: AlmacenFormData, userId: string) => Promise<string>;
  updateAlmacen: (id: string, data: Partial<AlmacenFormData>, userId: string) => Promise<void>;
  setSelectedAlmacen: (almacen: Almacen | null) => void;
  seedDefaultAlmacenes: (userId: string) => Promise<void>;
  clearError: () => void;

  // Acciones nuevas (casillas)
  fetchCasillas: () => Promise<void>;
  getCasillasByColaborador: (colaboradorId: string) => Casilla[];
  getCasillaPrincipal: (colaboradorId: string) => Casilla | undefined;
  crearCasilla: (data: CasillaFormData, userId: string) => Promise<string>;
}

export const useAlmacenStore = create<AlmacenState>((set, get) => ({
  almacenes: [],
  almacenesUSA: [],
  almacenesPeru: [],
  viajeros: [],
  viajerosConProximoViaje: [],
  resumenUSA: null,
  stats: null,
  selectedAlmacen: null,
  loading: false,
  error: null,
  casillas: [],
  casillasLoading: false,

  fetchAlmacenes: async () => {
    set({ loading: true, error: null });
    try {
      const almacenes = await almacenService.getAll();
      set({ almacenes, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchAlmacenesUSA: async () => {
    set({ loading: true, error: null });
    try {
      const almacenesUSA = await almacenService.getAlmacenesUSA();
      set({ almacenesUSA, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchAlmacenesPeru: async () => {
    set({ loading: true, error: null });
    try {
      const almacenesPeru = await almacenService.getAlmacenesPeru();
      set({ almacenesPeru, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchViajeros: async () => {
    set({ loading: true, error: null });
    try {
      const viajeros = await almacenService.getViajeros();
      set({ viajeros, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchViajerosConProximoViaje: async () => {
    set({ loading: true, error: null });
    try {
      const viajerosConProximoViaje = await almacenService.getViajerosConProximoViaje();
      set({ viajerosConProximoViaje, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchResumenUSA: async () => {
    set({ loading: true, error: null });
    try {
      const resumenUSA = await almacenService.getResumenAlmacenesUSA();
      set({ resumenUSA, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchStats: async () => {
    try {
      const stats = await almacenService.getStats();
      set({ stats });
    } catch (error: unknown) {
      console.error('Error obteniendo stats de almacenes:', error);
    }
  },

  getByPais: async (pais: string) => {
    set({ loading: true, error: null });
    try {
      const almacenes = await almacenService.getByPais(pais);
      set({ loading: false });
      return almacenes;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  getById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const almacen = await almacenService.getById(id);
      set({ selectedAlmacen: almacen, loading: false });
      return almacen;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  createAlmacen: async (data: AlmacenFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await almacenService.create(data, userId);
      await get().fetchAlmacenes();
      await get().fetchAlmacenesUSA();
      await get().fetchAlmacenesPeru();
      await get().fetchViajeros();
      set({ loading: false });
      return id;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  updateAlmacen: async (id: string, data: Partial<AlmacenFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await almacenService.update(id, data, userId);
      await get().fetchAlmacenes();
      await get().fetchAlmacenesUSA();
      await get().fetchAlmacenesPeru();
      await get().fetchViajeros();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  setSelectedAlmacen: (almacen: Almacen | null) => {
    set({ selectedAlmacen: almacen });
  },

  seedDefaultAlmacenes: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      await almacenService.seedDefaultAlmacenes(userId);
      await get().fetchAlmacenes();
      await get().fetchAlmacenesUSA();
      await get().fetchViajeros();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // ── Casillas (modelo nuevo) ──

  fetchCasillas: async () => {
    set({ casillasLoading: true });
    try {
      const casillas = await casillaCrudService.getAll();
      set({ casillas, casillasLoading: false });
    } catch {
      set({ casillasLoading: false });
    }
  },

  getCasillasByColaborador: (colaboradorId: string): Casilla[] => {
    return get().casillas.filter(c => c.colaboradorId === colaboradorId && c.estado === 'activa');
  },

  getCasillaPrincipal: (colaboradorId: string): Casilla | undefined => {
    const del = get().getCasillasByColaborador(colaboradorId);
    return del.find(c => c.esPrincipal) || del[0];
  },

  crearCasilla: async (data: CasillaFormData, userId: string): Promise<string> => {
    const id = await casillaCrudService.crear(data, userId);
    await get().fetchCasillas();
    return id;
  },

  clearError: () => set({ error: null })
}));
