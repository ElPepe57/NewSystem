import { create } from 'zustand';
import type { 
  EmpresaInfo,
  ConfiguracionGeneral,
  Almacen,
  EmpresaFormData,
  ConfiguracionFormData,
  AlmacenFormData
} from '../types/configuracion.types';
import { ConfiguracionService } from '../services/configuracion.service';

interface ConfiguracionState {
  empresa: EmpresaInfo | null;
  configuracion: ConfiguracionGeneral | null;
  almacenes: Almacen[];
  loading: boolean;
  error: string | null;
  
  // Actions - Empresa
  fetchEmpresa: () => Promise<void>;
  saveEmpresa: (data: EmpresaFormData, userId: string) => Promise<void>;
  
  // Actions - Configuración
  fetchConfiguracion: () => Promise<void>;
  saveConfiguracion: (data: ConfiguracionFormData, userId: string) => Promise<void>;
  
  // Actions - Almacenes
  fetchAlmacenes: () => Promise<void>;
  createAlmacen: (data: AlmacenFormData, userId: string) => Promise<void>;
  updateAlmacen: (id: string, data: Partial<AlmacenFormData>) => Promise<void>;
  deleteAlmacen: (id: string) => Promise<void>;
}

export const useConfiguracionStore = create<ConfiguracionState>((set, get) => ({
  empresa: null,
  configuracion: null,
  almacenes: [],
  loading: false,
  error: null,
  
  fetchEmpresa: async () => {
    set({ loading: true, error: null });
    try {
      const empresa = await ConfiguracionService.getEmpresa();
      set({ empresa, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  saveEmpresa: async (data: EmpresaFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      await ConfiguracionService.saveEmpresa(data, userId);
      await get().fetchEmpresa();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  fetchConfiguracion: async () => {
    set({ loading: true, error: null });
    try {
      const configuracion = await ConfiguracionService.getConfiguracion();
      set({ configuracion, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  saveConfiguracion: async (data: ConfiguracionFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      await ConfiguracionService.saveConfiguracion(data, userId);
      await get().fetchConfiguracion();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  fetchAlmacenes: async () => {
    set({ loading: true, error: null });
    try {
      const almacenes = await ConfiguracionService.getAlmacenes();
      set({ almacenes, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  createAlmacen: async (data: AlmacenFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const nuevoAlmacen = await ConfiguracionService.createAlmacen(data, userId);
      set(state => ({ 
        almacenes: [...state.almacenes, nuevoAlmacen],
        loading: false 
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  updateAlmacen: async (id: string, data: Partial<AlmacenFormData>) => {
    set({ loading: true, error: null });
    try {
      await ConfiguracionService.updateAlmacen(id, data);
      await get().fetchAlmacenes();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  
  deleteAlmacen: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await ConfiguracionService.deleteAlmacen(id);
      set(state => ({
        almacenes: state.almacenes.filter(a => a.id !== id),
        loading: false
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  }
}));