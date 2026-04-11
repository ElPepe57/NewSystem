import { create } from 'zustand';
import { insumoService } from '../services/insumo.service';
import type { Insumo, InsumoFormData } from '../types/insumo.types';

interface InsumoState {
  insumos: Insumo[];
  insumosStockBajo: Insumo[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchInsumos: () => Promise<void>;
  crearInsumo: (data: InsumoFormData, userId: string) => Promise<string>;
  actualizarInsumo: (id: string, data: Partial<InsumoFormData>, userId: string) => Promise<void>;
  registrarEntrada: (insumoId: string, cantidad: number, costoUnitarioPEN: number, userId: string) => Promise<void>;
  registrarSalida: (insumoId: string, cantidad: number, motivo: string, userId: string) => Promise<void>;
}

export const useInsumoStore = create<InsumoState>((set, get) => ({
  insumos: [],
  insumosStockBajo: [],
  loading: false,
  error: null,

  fetchInsumos: async () => {
    set({ loading: true, error: null });
    try {
      const [insumos, insumosStockBajo] = await Promise.all([
        insumoService.getAll(),
        insumoService.getConStockBajo(),
      ]);
      set({ insumos, insumosStockBajo, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  crearInsumo: async (data, userId) => {
    const id = await insumoService.crear(data, userId);
    await get().fetchInsumos();
    return id;
  },

  actualizarInsumo: async (id, data, userId) => {
    await insumoService.actualizar(id, data, userId);
    await get().fetchInsumos();
  },

  registrarEntrada: async (insumoId, cantidad, costoUnitarioPEN, userId) => {
    await insumoService.registrarEntrada(insumoId, cantidad, costoUnitarioPEN, userId);
    await get().fetchInsumos();
  },

  registrarSalida: async (insumoId, cantidad, motivo, userId) => {
    await insumoService.registrarSalida(insumoId, cantidad, motivo, userId);
    await get().fetchInsumos();
  },
}));
