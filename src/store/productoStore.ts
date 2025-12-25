import { create } from 'zustand';
import type { Producto, InvestigacionFormData, InvestigacionMercado } from '../types/producto.types';
import { ProductoService } from '../services/producto.service';

interface ProductoState {
  productos: Producto[];
  loading: boolean;
  error: string | null;
  selectedProducto: Producto | null;

  // Actions
  fetchProductos: () => Promise<void>;
  createProducto: (data: any, userId: string) => Promise<void>;
  updateProducto: (id: string, data: any) => Promise<void>;
  deleteProducto: (id: string) => Promise<void>;
  setSelectedProducto: (producto: Producto | null) => void;
  searchProductos: (term: string) => Promise<void>;

  // Investigación de Mercado
  guardarInvestigacion: (productoId: string, data: InvestigacionFormData, userId: string, tipoCambio?: number) => Promise<InvestigacionMercado>;
  eliminarInvestigacion: (productoId: string) => Promise<void>;
  getProductosSinInvestigacion: () => Promise<Producto[]>;
  getProductosInvestigacionVencida: () => Promise<Producto[]>;
}

export const useProductoStore = create<ProductoState>((set) => ({
  productos: [],
  loading: false,
  error: null,
  selectedProducto: null,
  
  fetchProductos: async () => {
    set({ loading: true, error: null });
    try {
      const productos = await ProductoService.getAll();
      set({ productos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
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
  
  deleteProducto: async (id) => {
    set({ loading: true, error: null });
    try {
      await ProductoService.delete(id);
      set(state => ({
        productos: state.productos.filter(p => p.id !== id),
        loading: false
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  setSelectedProducto: (producto) => {
    set({ selectedProducto: producto });
  },
  
  searchProductos: async (term) => {
    if (!term.trim()) {
      // Si no hay término, cargar todos
      const productos = await ProductoService.getAll();
      set({ productos });
      return;
    }

    set({ loading: true, error: null });
    try {
      const productos = await ProductoService.search(term);
      set({ productos, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  // ============================================
  // INVESTIGACIÓN DE MERCADO
  // ============================================

  guardarInvestigacion: async (productoId, data, userId, tipoCambio = 3.70) => {
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
  },

  getProductosSinInvestigacion: async () => {
    try {
      return await ProductoService.getProductosSinInvestigacion();
    } catch (error: any) {
      console.error('Error al obtener productos sin investigación:', error);
      return [];
    }
  },

  getProductosInvestigacionVencida: async () => {
    try {
      return await ProductoService.getProductosInvestigacionVencida();
    } catch (error: any) {
      console.error('Error al obtener productos con investigación vencida:', error);
      return [];
    }
  }
}));