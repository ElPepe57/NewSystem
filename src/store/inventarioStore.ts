import { create } from 'zustand';
import type { Unidad, UnidadFormData, EstadoUnidad, Almacen, ResumenInventario } from '../types/producto.types';
import { InventarioService } from '../services/inventario.service';

interface InventarioState {
  unidades: Unidad[];
  resumen: ResumenInventario | null;
  loading: boolean;
  error: string | null;
  selectedUnidad: Unidad | null;
  
  // Actions
  fetchUnidadesByProducto: (productoId: string) => Promise<void>;
  fetchUnidadesByAlmacen: (almacen: Almacen) => Promise<void>;
  fetchUnidadesByEstado: (estado: EstadoUnidad) => Promise<void>;
  crearUnidades: (data: UnidadFormData, sku: string, userId: string) => Promise<void>;
  moverUnidad: (unidadId: string, almacenDestino: Almacen, motivo: string, userId: string, observaciones?: string) => Promise<void>;
  cambiarEstado: (unidadId: string, nuevoEstado: EstadoUnidad, motivo: string, userId: string, observaciones?: string) => Promise<void>;
  fetchResumen: (productoId: string) => Promise<void>;
  setSelectedUnidad: (unidad: Unidad | null) => void;
  clearUnidades: () => void;
}

export const useInventarioStore = create<InventarioState>((set, get) => ({
  unidades: [],
  resumen: null,
  loading: false,
  error: null,
  selectedUnidad: null,
  
  fetchUnidadesByProducto: async (productoId: string) => {
    set({ loading: true, error: null });
    try {
      const unidades = await InventarioService.getByProducto(productoId);
      set({ unidades, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchUnidadesByAlmacen: async (almacen: Almacen) => {
    set({ loading: true, error: null });
    try {
      const unidades = await InventarioService.getByAlmacen(almacen);
      set({ unidades, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchUnidadesByEstado: async (estado: EstadoUnidad) => {
    set({ loading: true, error: null });
    try {
      const unidades = await InventarioService.getByEstado(estado);
      set({ unidades, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  crearUnidades: async (data: UnidadFormData, sku: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevasUnidades = await InventarioService.crearUnidades(data, sku, userId);
      set(state => ({ 
        unidades: [...nuevasUnidades, ...state.unidades],
        loading: false 
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  moverUnidad: async (unidadId: string, almacenDestino: Almacen, motivo: string, userId: string, observaciones?: string) => {
    set({ loading: true, error: null });
    try {
      await InventarioService.moverUnidad(unidadId, almacenDestino, motivo, userId, observaciones);
      
      // Recargar las unidades del producto actual
      const unidad = get().unidades.find(u => u.id === unidadId);
      if (unidad) {
        await get().fetchUnidadesByProducto(unidad.productoId);
      }
      
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  cambiarEstado: async (unidadId: string, nuevoEstado: EstadoUnidad, motivo: string, userId: string, observaciones?: string) => {
    set({ loading: true, error: null });
    try {
      await InventarioService.cambiarEstado(unidadId, nuevoEstado, motivo, userId, observaciones);
      
      // Recargar las unidades del producto actual
      const unidad = get().unidades.find(u => u.id === unidadId);
      if (unidad) {
        await get().fetchUnidadesByProducto(unidad.productoId);
      }
      
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  fetchResumen: async (productoId: string) => {
    set({ loading: true, error: null });
    try {
      const resumen = await InventarioService.getResumenPorProducto(productoId);
      set({ resumen, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  setSelectedUnidad: (unidad) => {
    set({ selectedUnidad: unidad });
  },
  
  clearUnidades: () => {
    set({ unidades: [], resumen: null, selectedUnidad: null });
  }
}));