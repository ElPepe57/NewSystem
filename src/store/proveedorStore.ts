import { create } from 'zustand';
import { proveedorService } from '../services/proveedor.service';
import type {
  Proveedor,
  ProveedorFormData,
  TipoProveedor
} from '../types/ordenCompra.types';

interface ProveedorStats {
  totalProveedores: number;
  proveedoresActivos: number;
  proveedoresPorPais: Record<string, number>;
  proveedoresPorTipo: Record<TipoProveedor, number>;
  topProveedoresPorCompras: Array<{
    proveedorId: string;
    nombre: string;
    ordenesCompra: number;
    montoTotalUSD: number;
  }>;
}

interface ProveedorState {
  // Estado
  proveedores: Proveedor[];
  proveedoresActivos: Proveedor[];
  proveedorSeleccionado: Proveedor | null;
  resultadosBusqueda: Proveedor[];
  stats: ProveedorStats | null;
  loading: boolean;
  buscando: boolean;
  error: string | null;

  // Acciones de carga
  fetchProveedores: () => Promise<void>;
  fetchProveedoresActivos: () => Promise<void>;
  fetchStats: () => Promise<void>;

  // Acciones de búsqueda
  buscar: (termino: string) => Promise<void>;
  buscarPorNombreExacto: (nombre: string) => Promise<Proveedor | null>;
  limpiarBusqueda: () => void;

  // Acciones CRUD
  getById: (id: string) => Promise<Proveedor | null>;
  createProveedor: (data: ProveedorFormData, userId: string) => Promise<string>;
  updateProveedor: (id: string, data: Partial<ProveedorFormData>, userId: string) => Promise<void>;
  deleteProveedor: (id: string, userId: string) => Promise<void>;
  cambiarEstado: (id: string, activo: boolean, userId: string) => Promise<void>;

  // Acciones especiales
  getOrCreate: (nombre: string, pais: string, tipo: TipoProveedor, userId: string) => Promise<{ proveedor: Proveedor; esNuevo: boolean }>;
  actualizarMetricasPorCompra: (proveedorId: string, montoUSD: number, productos: string[]) => Promise<void>;

  // Selección
  setProveedorSeleccionado: (proveedor: Proveedor | null) => void;
  clearError: () => void;
}

export const useProveedorStore = create<ProveedorState>((set, get) => ({
  proveedores: [],
  proveedoresActivos: [],
  proveedorSeleccionado: null,
  resultadosBusqueda: [],
  stats: null,
  loading: false,
  buscando: false,
  error: null,

  // ============ CARGA ============

  fetchProveedores: async () => {
    set({ loading: true, error: null });
    try {
      const proveedores = await proveedorService.getAll();
      set({ proveedores, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchProveedoresActivos: async () => {
    set({ loading: true, error: null });
    try {
      const proveedoresActivos = await proveedorService.getActivos();
      set({ proveedoresActivos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await proveedorService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ BÚSQUEDA ============

  buscar: async (termino: string) => {
    if (!termino || termino.length < 2) {
      set({ resultadosBusqueda: [] });
      return;
    }

    set({ buscando: true });
    try {
      const resultados = await proveedorService.buscar(termino);
      set({ resultadosBusqueda: resultados, buscando: false });
    } catch (error: any) {
      set({ buscando: false });
      console.error('Error en búsqueda:', error);
    }
  },

  buscarPorNombreExacto: async (nombre: string) => {
    try {
      return await proveedorService.buscarPorNombreExacto(nombre);
    } catch (error: any) {
      console.error('Error buscando por nombre exacto:', error);
      return null;
    }
  },

  limpiarBusqueda: () => {
    set({ resultadosBusqueda: [] });
  },

  // ============ CRUD ============

  getById: async (id: string) => {
    try {
      const proveedor = await proveedorService.getById(id);
      if (proveedor) {
        set({ proveedorSeleccionado: proveedor });
      }
      return proveedor;
    } catch (error: any) {
      console.error('Error obteniendo proveedor:', error);
      return null;
    }
  },

  createProveedor: async (data: ProveedorFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await proveedorService.create(data, userId);
      await get().fetchProveedores();
      await get().fetchProveedoresActivos();
      set({ loading: false });
      return id;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateProveedor: async (id: string, data: Partial<ProveedorFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await proveedorService.update(id, data, userId);
      await get().fetchProveedores();
      await get().fetchProveedoresActivos();

      // Actualizar proveedor seleccionado si es el mismo
      const { proveedorSeleccionado } = get();
      if (proveedorSeleccionado?.id === id) {
        const actualizado = await proveedorService.getById(id);
        set({ proveedorSeleccionado: actualizado });
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteProveedor: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await proveedorService.delete(id, userId);
      await get().fetchProveedores();
      await get().fetchProveedoresActivos();

      // Limpiar selección si era el eliminado
      const { proveedorSeleccionado } = get();
      if (proveedorSeleccionado?.id === id) {
        set({ proveedorSeleccionado: null });
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  cambiarEstado: async (id: string, activo: boolean, userId: string) => {
    set({ loading: true, error: null });
    try {
      await proveedorService.cambiarEstado(id, activo, userId);
      await get().fetchProveedores();
      await get().fetchProveedoresActivos();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // ============ ACCIONES ESPECIALES ============

  getOrCreate: async (nombre: string, pais: string, tipo: TipoProveedor, userId: string) => {
    set({ loading: true, error: null });
    try {
      const resultado = await proveedorService.getOrCreate(nombre, pais, tipo, userId);
      if (resultado.esNuevo) {
        await get().fetchProveedores();
        await get().fetchProveedoresActivos();
      }
      set({ loading: false });
      return resultado;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  actualizarMetricasPorCompra: async (proveedorId: string, montoUSD: number, productos: string[]) => {
    try {
      await proveedorService.actualizarMetricasPorCompra(proveedorId, montoUSD, productos);
    } catch (error: any) {
      console.error('Error actualizando métricas:', error);
    }
  },

  // ============ SELECCIÓN ============

  setProveedorSeleccionado: (proveedor: Proveedor | null) => {
    set({ proveedorSeleccionado: proveedor });
  },

  clearError: () => set({ error: null })
}));
