import { create } from 'zustand';
import type { Producto } from '../types/producto.types';
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
  }
}));