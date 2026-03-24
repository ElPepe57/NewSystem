import { create } from 'zustand';
import type { Producto, InvestigacionFormData, InvestigacionMercado } from '../types/producto.types';
import { ProductoService } from '../services/producto.service';

interface ProductoState {
  productos: Producto[];
  archivados: Producto[];
  loading: boolean;
  loadingArchivados: boolean;
  error: string | null;
  selectedProducto: Producto | null;

  // Actions
  fetchProductos: (incluirInactivos?: boolean) => Promise<void>;
  fetchArchivados: () => Promise<void>;
  createProducto: (data: any, userId: string) => Promise<void>;
  updateProducto: (id: string, data: any) => Promise<void>;
  deleteProducto: (id: string, userId?: string) => Promise<void>;
  reactivarProducto: (id: string) => Promise<void>;
  setSelectedProducto: (producto: Producto | null) => void;

  // Investigación de Mercado
  guardarInvestigacion: (productoId: string, data: InvestigacionFormData, userId: string, tipoCambio?: number) => Promise<InvestigacionMercado>;
  eliminarInvestigacion: (productoId: string) => Promise<void>;
}

export const useProductoStore = create<ProductoState>((set) => ({
  productos: [],
  archivados: [],
  loading: false,
  loadingArchivados: false,
  error: null,
  selectedProducto: null,
  
  fetchProductos: async (incluirInactivos = false) => {
    set({ loading: true, error: null });
    try {
      const productos = await ProductoService.getAll(incluirInactivos);
      set({ productos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchArchivados: async () => {
    set({ loadingArchivados: true });
    try {
      const archivados = await ProductoService.getArchivados();
      set({ archivados, loadingArchivados: false });
    } catch (error: any) {
      set({ error: error.message, loadingArchivados: false });
    }
  },
  
  createProducto: async (data, userId) => {
    set({ loading: true, error: null });
    try {
      const newProducto = await ProductoService.create(data, userId);
      set(state => ({ 
        productos: [newProducto, ...state.productos],
        loading: false 
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  updateProducto: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await ProductoService.update(id, data);
      set(state => ({
        productos: state.productos.map(p => 
          p.id === id ? { ...p, ...data } : p
        ),
        loading: false
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  deleteProducto: async (id, userId) => {
    set({ loading: true, error: null });
    try {
      await ProductoService.delete(id, userId);
      set(state => ({
        productos: state.productos.filter(p => p.id !== id),
        loading: false
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  reactivarProducto: async (id) => {
    try {
      await ProductoService.reactivar(id);
      set(state => {
        const producto = state.archivados.find(p => p.id === id) || state.productos.find(p => p.id === id);
        const reactivado = producto ? { ...producto, estado: 'activo' as const, fechaEliminacion: undefined, eliminadoPor: undefined } : null;
        return {
          eliminados: state.archivados.filter(p => p.id !== id),
          productos: reactivado ? [reactivado, ...state.productos.filter(p => p.id !== id)] : state.productos,
        };
      });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  setSelectedProducto: (producto) => {
    set({ selectedProducto: producto });
  },

  // ============================================
  // INVESTIGACIÓN DE MERCADO
  // ============================================

  guardarInvestigacion: async (productoId, data, userId, tipoCambio) => {
    set({ loading: true, error: null });
    try {
      const investigacion = await ProductoService.guardarInvestigacion(productoId, data, userId, tipoCambio);

      // Actualizar el producto en el estado local
      set(state => ({
        productos: state.productos.map(p =>
          p.id === productoId ? { ...p, investigacion } : p
        ),
        selectedProducto: state.selectedProducto?.id === productoId
          ? { ...state.selectedProducto, investigacion }
          : state.selectedProducto,
        loading: false
      }));

      return investigacion;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  eliminarInvestigacion: async (productoId) => {
    set({ loading: true, error: null });
    try {
      await ProductoService.eliminarInvestigacion(productoId);

      // Actualizar el producto en el estado local
      set(state => ({
        productos: state.productos.map(p =>
          p.id === productoId ? { ...p, investigacion: undefined } : p
        ),
        selectedProducto: state.selectedProducto?.id === productoId
          ? { ...state.selectedProducto, investigacion: undefined }
          : state.selectedProducto,
        loading: false
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  }
}));