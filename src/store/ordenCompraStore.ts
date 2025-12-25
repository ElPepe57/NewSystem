import { create } from 'zustand';
import type {
  OrdenCompra,
  OrdenCompraFormData,
  EstadoOrden,
  OrdenCompraStats,
  Proveedor,
  ProveedorFormData,
  PagoOrdenCompra
} from '../types/ordenCompra.types';
import type { MetodoTesoreria } from '../types/tesoreria.types';
import { OrdenCompraService } from '../services/ordenCompra.service';

interface OrdenCompraState {
  ordenes: OrdenCompra[];
  proveedores: Proveedor[];
  stats: OrdenCompraStats | null;
  loading: boolean;
  error: string | null;
  selectedOrden: OrdenCompra | null;
  
  // Actions - Proveedores
  fetchProveedores: () => Promise<void>;
  createProveedor: (data: ProveedorFormData, userId: string) => Promise<void>;
  updateProveedor: (id: string, data: Partial<ProveedorFormData>) => Promise<void>;
  deleteProveedor: (id: string) => Promise<void>;
  
  // Actions - Órdenes
  fetchOrdenes: () => Promise<void>;
  fetchOrdenById: (id: string) => Promise<void>;
  fetchOrdenesByEstado: (estado: EstadoOrden) => Promise<void>;
  createOrden: (data: OrdenCompraFormData, userId: string) => Promise<void>;
  updateOrden: (id: string, data: Partial<OrdenCompraFormData>, userId: string) => Promise<void>;
  cambiarEstadoOrden: (id: string, nuevoEstado: EstadoOrden, userId: string, datos?: any) => Promise<void>;
  registrarPago: (id: string, datos: {
    fechaPago: Date;
    monedaPago: 'USD' | 'PEN';
    montoOriginal: number;
    tipoCambio: number;
    metodoPago: MetodoTesoreria;
    cuentaOrigenId?: string;
    referencia?: string;
    notas?: string;
  }, userId: string) => Promise<PagoOrdenCompra>;
  recibirOrden: (id: string, userId: string) => Promise<{
    unidadesGeneradas: string[];
    unidadesReservadas: string[];
    unidadesDisponibles: string[];
    cotizacionVinculada?: string;
  }>;
  deleteOrden: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  setSelectedOrden: (orden: OrdenCompra | null) => void;
}

export const useOrdenCompraStore = create<OrdenCompraState>((set, get) => ({
  ordenes: [],
  proveedores: [],
  stats: null,
  loading: false,
  error: null,
  selectedOrden: null,
  
  // ========================================
  // PROVEEDORES
  // ========================================
  
  fetchProveedores: async () => {
    set({ loading: true, error: null });
    try {
      const proveedores = await OrdenCompraService.getAllProveedores();
      set({ proveedores, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  createProveedor: async (data: ProveedorFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevoProveedor = await OrdenCompraService.createProveedor(data, userId);
      set(state => ({ 
        proveedores: [...state.proveedores, nuevoProveedor].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        loading: false 
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  updateProveedor: async (id: string, data: Partial<ProveedorFormData>) => {
    set({ loading: true, error: null });
    try {
      await OrdenCompraService.updateProveedor(id, data);
      await get().fetchProveedores();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  deleteProveedor: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await OrdenCompraService.deleteProveedor(id);
      set(state => ({
        proveedores: state.proveedores.filter(p => p.id !== id),
        loading: false
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  // ========================================
  // ÓRDENES DE COMPRA
  // ========================================
  
  fetchOrdenes: async () => {
    set({ loading: true, error: null });
    try {
      const ordenes = await OrdenCompraService.getAll();
      set({ ordenes, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchOrdenById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const orden = await OrdenCompraService.getById(id);
      set({ selectedOrden: orden, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  fetchOrdenesByEstado: async (estado: EstadoOrden) => {
    set({ loading: true, error: null });
    try {
      const ordenes = await OrdenCompraService.getByEstado(estado);
      set({ ordenes, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  createOrden: async (data: OrdenCompraFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevaOrden = await OrdenCompraService.create(data, userId);
      set(state => ({ 
        ordenes: [nuevaOrden, ...state.ordenes],
        loading: false 
      }));
      
      // Recargar stats
      await get().fetchStats();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  updateOrden: async (id: string, data: Partial<OrdenCompraFormData>, userId: string) => {
    set({ loading: true, error: null });
    try {
      await OrdenCompraService.update(id, data, userId);
      await get().fetchOrdenes();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  cambiarEstadoOrden: async (id: string, nuevoEstado: EstadoOrden, userId: string, datos?: any) => {
    set({ loading: true, error: null });
    try {
      await OrdenCompraService.cambiarEstado(id, nuevoEstado, userId, datos);
      await get().fetchOrdenes();
      await get().fetchStats();

      // Si se seleccionó esta orden, recargarla
      if (get().selectedOrden?.id === id) {
        await get().fetchOrdenById(id);
      }

      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  registrarPago: async (id: string, datos: {
    fechaPago: Date;
    monedaPago: 'USD' | 'PEN';
    montoOriginal: number;
    tipoCambio: number;
    metodoPago: MetodoTesoreria;
    cuentaOrigenId?: string;
    referencia?: string;
    notas?: string;
  }, userId: string) => {
    set({ loading: true, error: null });
    try {
      const pago = await OrdenCompraService.registrarPago(id, datos, userId);
      await get().fetchOrdenes();
      await get().fetchStats();

      // Si se seleccionó esta orden, recargarla
      if (get().selectedOrden?.id === id) {
        await get().fetchOrdenById(id);
      }

      set({ loading: false });
      return pago;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  recibirOrden: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      const resultado = await OrdenCompraService.recibirOrden(id, userId);
      await get().fetchOrdenes();
      await get().fetchStats();

      set({ loading: false });
      return resultado;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  deleteOrden: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await OrdenCompraService.delete(id);
      set(state => ({
        ordenes: state.ordenes.filter(o => o.id !== id),
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
      const stats = await OrdenCompraService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      console.error('Error en fetchStats:', error);
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  setSelectedOrden: (orden) => {
    set({ selectedOrden: orden });
  }
}));