import { create } from 'zustand';
import type { 
  Venta, 
  VentaFormData, 
  EstadoVenta,
  VentaStats,
  ProductoDisponible,
  ResultadoAsignacion
} from '../types/venta.types';
import { VentaService } from '../services/venta.service';

interface VentaState {
  ventas: Venta[];
  productosDisponibles: ProductoDisponible[];
  stats: VentaStats | null;
  loading: boolean;
  error: string | null;
  selectedVenta: Venta | null;
  
  // Actions
  fetchVentas: () => Promise<void>;
  fetchVentaById: (id: string) => Promise<void>;
  fetchVentasByEstado: (estado: EstadoVenta) => Promise<void>;
  fetchProductosDisponibles: () => Promise<void>;
  createCotizacion: (data: VentaFormData, userId: string) => Promise<void>;
  createVenta: (data: VentaFormData, userId: string) => Promise<void>;
  confirmarCotizacion: (id: string, userId: string) => Promise<void>;
  asignarInventario: (id: string, userId: string) => Promise<ResultadoAsignacion[]>;
  marcarEnEntrega: (id: string, userId: string, datos?: any) => Promise<void>;
  marcarEntregada: (id: string, userId: string) => Promise<void>;
  cancelarVenta: (id: string, userId: string, motivo?: string) => Promise<void>;
  deleteVenta: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  setSelectedVenta: (venta: Venta | null) => void;
}

export const useVentaStore = create<VentaState>((set, get) => ({
  ventas: [],
  productosDisponibles: [],
  stats: null,
  loading: false,
  error: null,
  selectedVenta: null,
  
  fetchVentas: async () => {
    set({ loading: true, error: null });
    try {
      const ventas = await VentaService.getAll();
      set({ ventas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchVentaById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const venta = await VentaService.getById(id);
      set({ selectedVenta: venta, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchVentasByEstado: async (estado: EstadoVenta) => {
    set({ loading: true, error: null });
    try {
      const ventas = await VentaService.getByEstado(estado);
      set({ ventas, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchProductosDisponibles: async () => {
    set({ loading: true, error: null });
    try {
      const productosDisponibles = await VentaService.getProductosDisponibles();
      set({ productosDisponibles, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  createCotizacion: async (data: VentaFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevaVenta = await VentaService.create(data, userId, false);
      set(state => ({ 
        ventas: [nuevaVenta, ...state.ventas],
        loading: false 
      }));
      
      await get().fetchStats();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  createVenta: async (data: VentaFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevaVenta = await VentaService.create(data, userId, true);
      set(state => ({ 
        ventas: [nuevaVenta, ...state.ventas],
        loading: false 
      }));
      
      await get().fetchStats();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  confirmarCotizacion: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await VentaService.confirmarCotizacion(id, userId);
      await get().fetchVentas();
      await get().fetchStats();
      
      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }
      
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  asignarInventario: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      const resultados = await VentaService.asignarInventario(id, userId);
      await get().fetchVentas();
      await get().fetchStats();
      await get().fetchProductosDisponibles();
      
      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }
      
      set({ loading: false });
      return resultados;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  marcarEnEntrega: async (id: string, userId: string, datos?: any) => {
    set({ loading: true, error: null });
    try {
      await VentaService.marcarEnEntrega(id, userId, datos);
      await get().fetchVentas();
      await get().fetchStats();
      
      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }
      
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  marcarEntregada: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await VentaService.marcarEntregada(id, userId);
      await get().fetchVentas();
      await get().fetchStats();
      await get().fetchProductosDisponibles();
      
      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }
      
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  cancelarVenta: async (id: string, userId: string, motivo?: string) => {
    set({ loading: true, error: null });
    try {
      await VentaService.cancelar(id, userId, motivo);
      await get().fetchVentas();
      await get().fetchStats();
      await get().fetchProductosDisponibles();
      
      if (get().selectedVenta?.id === id) {
        await get().fetchVentaById(id);
      }
      
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  deleteVenta: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await VentaService.delete(id);
      set(state => ({
        ventas: state.ventas.filter(v => v.id !== id),
        loading: false
      }));
      
      await get().fetchStats();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await VentaService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  setSelectedVenta: (venta) => {
    set({ selectedVenta: venta });
  }
}));