import { create } from 'zustand';
import type {
  EmpresaInfo,
  ConfiguracionGeneral,
  EmpresaFormData,
  ConfiguracionFormData
} from '../types/configuracion.types';
import { ConfiguracionService } from '../services/configuracion.service';

interface ConfiguracionState {
  empresa: EmpresaInfo | null;
  configuracion: ConfiguracionGeneral | null;
  loading: boolean;
  error: string | null;

  // Actions - Empresa
  fetchEmpresa: () => Promise<void>;
  saveEmpresa: (data: EmpresaFormData, userId: string) => Promise<void>;

  // Actions - Configuración
  fetchConfiguracion: () => Promise<void>;
  saveConfiguracion: (data: ConfiguracionFormData, userId: string) => Promise<void>;
}

export const useConfiguracionStore = create<ConfiguracionState>((set, get) => ({
  empresa: null,
  configuracion: null,
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
}));