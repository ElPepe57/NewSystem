import { create } from 'zustand';
import { marcaService } from '../services/marca.service';
import type {
  Marca,
  MarcaFormData,
  MarcaStats,
  DuplicadoEncontrado
} from '../types/entidadesMaestras.types';

interface MarcaState {
  // Estado
  marcas: Marca[];
  marcasActivas: Marca[];
  marcaSeleccionada: Marca | null;
  resultadosBusqueda: Marca[];
  duplicadosDetectados: DuplicadoEncontrado<Marca>[];
  stats: MarcaStats | null;
  loading: boolean;
  buscando: boolean;
  error: string | null;

  // Acciones de carga
  fetchMarcas: () => Promise<void>;
  fetchMarcasActivas: () => Promise<void>;
  fetchStats: () => Promise<void>;

  // Acciones de búsqueda inteligente
  buscar: (termino: string) => Promise<void>;
  buscarPorNombreExacto: (nombre: string) => Promise<Marca | null>;
  detectarDuplicados: (nombre: string) => Promise<void>;
  limpiarBusqueda: () => void;

  // Acciones CRUD
  getById: (id: string) => Promise<Marca | null>;
  createMarca: (data: MarcaFormData, userId: string) => Promise<string>;
  updateMarca: (id: string, data: Partial<MarcaFormData>, userId: string) => Promise<void>;
  deleteMarca: (id: string) => Promise<void>;
  cambiarEstado: (id: string, estado: 'activa' | 'inactiva' | 'descontinuada', userId: string) => Promise<void>;

  // Acciones especiales
  getOrCreate: (nombre: string, tipoMarca: 'farmaceutica' | 'suplementos' | 'cosmetica' | 'tecnologia' | 'otro', userId: string) => Promise<{ marca: Marca; esNueva: boolean }>;
  agregarAlias: (marcaId: string, alias: string, userId: string) => Promise<void>;
  actualizarMetricas: (marcaId: string, unidadesVendidas: number, montoVentaPEN: number, margen: number) => Promise<void>;
  incrementarProductos: (marcaId: string, cantidad?: number) => Promise<void>;

  // Migración
  migrarDesdeProductos: (userId: string) => Promise<{ migradas: number; errores: string[] }>;

  // Recálculo de métricas
  recalcularMetricasDesdeVentas: () => Promise<{ marcasActualizadas: number; errores: string[] }>;

  // Selección
  setMarcaSeleccionada: (marca: Marca | null) => void;
  clearError: () => void;
}

export const useMarcaStore = create<MarcaState>((set, get) => ({
  marcas: [],
  marcasActivas: [],
  marcaSeleccionada: null,
  resultadosBusqueda: [],
  duplicadosDetectados: [],
  stats: null,
  loading: false,
  buscando: false,
  error: null,

  // ============ CARGA ============

  fetchMarcas: async () => {
    set({ loading: true, error: null });
    try {
      const marcas = await marcaService.getAll();
      set({ marcas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchMarcasActivas: async () => {
    set({ loading: true, error: null });
    try {
      const marcasActivas = await marcaService.getActivas();
      set({ marcasActivas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await marcaService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ BÚSQUEDA INTELIGENTE ============

  buscar: async (termino: string) => {
    if (!termino || termino.length < 2) {
      set({ resultadosBusqueda: [] });
      return;
    }

    set({ buscando: true });
    try {
      const resultados = await marcaService.buscar(termino);
      set({ resultadosBusqueda: resultados, buscando: false });
    } catch (error: any) {
      set({ buscando: false });
      console.error('Error en búsqueda:', error);
    }
  },

  buscarPorNombreExacto: async (nombre: string) => {
    try {
      return await marcaService.buscarPorNombreExacto(nombre);
    } catch (error: any) {
      console.error('Error buscando por nombre exacto:', error);
      return null;
    }
  },

  detectarDuplicados: async (nombre: string) => {
    try {
      const duplicados = await marcaService.detectarDuplicados(nombre);
      set({ duplicadosDetectados: duplicados });
    } catch (error: any) {
      console.error('Error detectando duplicados:', error);
      set({ duplicadosDetectados: [] });
    }
  },

  limpiarBusqueda: () => {
    set({ resultadosBusqueda: [], duplicadosDetectados: [] });
  },

  // ============ CRUD ============

  getById: async (id: string) => {
    try {
      const marca = await marcaService.getById(id);
      if (marca) {
        set({ marcaSeleccionada: marca });
      }
      return marca;
    } catch (error: any) {
      console.error('Error obteniendo marca:', error);
      return null;
    }
  },

  createMarca: async (data: MarcaFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await marcaService.create(data, userId);
      await get().fetchMarcas();
      await get().fetchMarcasActivas();
      set({ loading: false });
      return id;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateMarca: async (id: string, data: Partial<MarcaFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await marcaService.update(id, data, userId);
      await get().fetchMarcas();
      await get().fetchMarcasActivas();

      // Actualizar marca seleccionada si es la misma
      const { marcaSeleccionada } = get();
      if (marcaSeleccionada?.id === id) {
        const actualizada = await marcaService.getById(id);
        set({ marcaSeleccionada: actualizada });
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteMarca: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await marcaService.delete(id);
      await get().fetchMarcas();
      await get().fetchMarcasActivas();

      // Limpiar selección si era la eliminada
      const { marcaSeleccionada } = get();
      if (marcaSeleccionada?.id === id) {
        set({ marcaSeleccionada: null });
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  cambiarEstado: async (id: string, estado: 'activa' | 'inactiva' | 'descontinuada', userId: string) => {
    set({ loading: true, error: null });
    try {
      await marcaService.cambiarEstado(id, estado, userId);
      await get().fetchMarcas();
      await get().fetchMarcasActivas();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ ACCIONES ESPECIALES ============

  getOrCreate: async (nombre: string, tipoMarca: 'farmaceutica' | 'suplementos' | 'cosmetica' | 'tecnologia' | 'otro', userId: string) => {
    set({ loading: true, error: null });
    try {
      const resultado = await marcaService.getOrCreate(nombre, tipoMarca, userId);
      if (resultado.esNueva) {
        await get().fetchMarcas();
        await get().fetchMarcasActivas();
      }
      set({ loading: false });
      return resultado;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  agregarAlias: async (marcaId: string, alias: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await marcaService.agregarAlias(marcaId, alias, userId);

      // Actualizar marca seleccionada si es la misma
      const { marcaSeleccionada } = get();
      if (marcaSeleccionada?.id === marcaId) {
        const actualizada = await marcaService.getById(marcaId);
        set({ marcaSeleccionada: actualizada });
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  actualizarMetricas: async (marcaId: string, unidadesVendidas: number, montoVentaPEN: number, margen: number) => {
    try {
      await marcaService.actualizarMetricas(marcaId, unidadesVendidas, montoVentaPEN, margen);
    } catch (error: any) {
      console.error('Error actualizando métricas:', error);
    }
  },

  incrementarProductos: async (marcaId: string, cantidad?: number) => {
    try {
      await marcaService.incrementarProductos(marcaId, cantidad);
    } catch (error: any) {
      console.error('Error incrementando productos:', error);
    }
  },

  // ============ MIGRACIÓN ============

  migrarDesdeProductos: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const resultado = await marcaService.migrarDesdeProductos(userId);
      await get().fetchMarcas();
      await get().fetchMarcasActivas();
      set({ loading: false });
      return resultado;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ RECÁLCULO DE MÉTRICAS ============

  recalcularMetricasDesdeVentas: async () => {
    set({ loading: true, error: null });
    try {
      const resultado = await marcaService.recalcularMetricasDesdeVentas();
      await get().fetchMarcas();
      await get().fetchMarcasActivas();
      await get().fetchStats();
      set({ loading: false });
      return resultado;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ SELECCIÓN ============

  setMarcaSeleccionada: (marca: Marca | null) => {
    set({ marcaSeleccionada: marca });
  },

  clearError: () => set({ error: null })
}));
