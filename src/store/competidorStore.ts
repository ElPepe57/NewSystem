/**
 * Store de Competidores usando Zustand
 * Centraliza el estado y operaciones de competidores
 */
import { create } from 'zustand';
import { competidorService } from '../services/competidor.service';
import type {
  Competidor,
  CompetidorFormData,
  PlataformaCompetidor,
  ReputacionCompetidor
} from '../types/entidadesMaestras.types';

// Tipo para estadísticas de competidores
export interface CompetidorStats {
  total: number;
  activos: number;
  inactivos: number;
  porPlataforma: Record<PlataformaCompetidor, number>;
  porNivelAmenaza: Record<string, number>;
  porReputacion: Record<ReputacionCompetidor, number>;
  lideresCategoria: number;
  totalProductosAnalizados: number;
  precioPromedioGeneral: number;
  topCompetidoresPorAnalisis: Array<{
    id: string;
    codigo: string;
    nombre: string;
    productosAnalizados: number;
    precioPromedio: number;
    nivelAmenaza: string;
  }>;
  competidoresAmenazaAlta: Array<{
    id: string;
    codigo: string;
    nombre: string;
    plataformaPrincipal: PlataformaCompetidor;
    productosAnalizados: number;
  }>;
}

interface CompetidorState {
  // Data
  competidores: Competidor[];
  competidoresActivos: Competidor[];
  stats: CompetidorStats | null;

  // UI State
  loading: boolean;
  error: string | null;

  // Actions
  fetchCompetidores: () => Promise<void>;
  fetchCompetidoresActivos: () => Promise<void>;
  fetchStats: () => Promise<void>;
  createCompetidor: (data: CompetidorFormData, userId: string) => Promise<Competidor>;
  updateCompetidor: (id: string, data: Partial<CompetidorFormData>, userId: string) => Promise<void>;
  cambiarEstado: (id: string, estado: 'activo' | 'inactivo' | 'cerrado', userId: string) => Promise<void>;
  deleteCompetidor: (id: string) => Promise<void>;
  buscarCompetidores: (texto: string) => Promise<Competidor[]>;
  clearError: () => void;
}

export const useCompetidorStore = create<CompetidorState>((set, get) => ({
  // Initial state
  competidores: [],
  competidoresActivos: [],
  stats: null,
  loading: false,
  error: null,

  // Fetch all competidores
  fetchCompetidores: async () => {
    set({ loading: true, error: null });
    try {
      const competidores = await competidorService.getAll();
      // Ordenar por nombre
      competidores.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      set({
        competidores,
        competidoresActivos: competidores.filter(c => c.estado === 'activo'),
        loading: false
      });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  // Fetch only active competidores
  fetchCompetidoresActivos: async () => {
    set({ loading: true, error: null });
    try {
      const competidores = await competidorService.getActivos();
      competidores.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      set({ competidoresActivos: competidores, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  // Create new competidor
  createCompetidor: async (data: CompetidorFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await competidorService.create(data, userId);
      const nuevoCompetidor = await competidorService.getById(id);
      if (nuevoCompetidor) {
        set(state => ({
          competidores: [...state.competidores, nuevoCompetidor].sort((a, b) =>
            a.nombre.localeCompare(b.nombre, 'es')
          ),
          competidoresActivos: [...state.competidoresActivos, nuevoCompetidor].sort((a, b) =>
            a.nombre.localeCompare(b.nombre, 'es')
          ),
          loading: false
        }));
        return nuevoCompetidor;
      }
      throw new Error('Error al obtener competidor creado');
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Update existing competidor
  updateCompetidor: async (id: string, data: Partial<CompetidorFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await competidorService.update(id, data, userId);
      const actualizado = await competidorService.getById(id);
      if (actualizado) {
        set(state => ({
          competidores: state.competidores.map(c =>
            c.id === id ? actualizado : c
          ),
          competidoresActivos: state.competidoresActivos
            .map(c => c.id === id ? actualizado : c)
            .filter(c => c.estado === 'activo'),
          loading: false
        }));
      }
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Change competidor status
  cambiarEstado: async (id: string, estado: 'activo' | 'inactivo' | 'cerrado', userId: string) => {
    set({ loading: true, error: null });
    try {
      await competidorService.cambiarEstado(id, estado, userId);
      set(state => ({
        competidores: state.competidores.map(c =>
          c.id === id ? { ...c, estado } : c
        ),
        competidoresActivos: estado === 'activo'
          ? [...state.competidoresActivos, state.competidores.find(c => c.id === id)!].filter(Boolean)
          : state.competidoresActivos.filter(c => c.id !== id),
        loading: false
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Delete competidor
  deleteCompetidor: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await competidorService.delete(id);
      set(state => ({
        competidores: state.competidores.filter(c => c.id !== id),
        competidoresActivos: state.competidoresActivos.filter(c => c.id !== id),
        loading: false
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Search competidores
  buscarCompetidores: async (texto: string) => {
    try {
      return await competidorService.buscar(texto);
    } catch (error: any) {
      console.error('Error buscando competidores:', error);
      return [];
    }
  },

  // Fetch stats
  fetchStats: async () => {
    try {
      const stats = await competidorService.getStats();
      set({ stats });
    } catch (error: any) {
      console.error('Error obteniendo stats de competidores:', error);
    }
  },

  // Clear error
  clearError: () => set({ error: null })
}));
