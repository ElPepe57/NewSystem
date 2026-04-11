import { create } from 'zustand';
import { tarjetaCreditoService } from '../services/tarjetaCredito.service';
import type { TarjetaCredito, TarjetaCreditoFormData } from '../types/tarjetaCredito.types';

interface TarjetaCreditoState {
  tarjetas: TarjetaCredito[];
  tarjetasActivas: TarjetaCredito[];
  saldoTotalUSD: number;
  loading: boolean;
  error: string | null;

  // Actions
  fetchTarjetas: () => Promise<void>;
  crearTarjeta: (data: TarjetaCreditoFormData, userId: string) => Promise<string>;
  actualizarTarjeta: (id: string, data: Partial<TarjetaCreditoFormData>, userId: string) => Promise<void>;
  registrarCargo: (tarjetaId: string, montoUSD: number, tcDelDia: number, descripcion: string, userId: string, ordenCompraId?: string) => Promise<void>;
  registrarPago: (tarjetaId: string, montoUSD: number, tcPago: number, userId: string) => Promise<{ diferencialCambiarioPEN: number }>;
}

export const useTarjetaCreditoStore = create<TarjetaCreditoState>((set, get) => ({
  tarjetas: [],
  tarjetasActivas: [],
  saldoTotalUSD: 0,
  loading: false,
  error: null,

  fetchTarjetas: async () => {
    set({ loading: true, error: null });
    try {
      const tarjetas = await tarjetaCreditoService.getAll();
      const tarjetasActivas = tarjetas.filter(t => t.activa);
      const saldoTotalUSD = tarjetasActivas.reduce((sum, t) => sum + t.saldoActualUSD, 0);
      set({ tarjetas, tarjetasActivas, saldoTotalUSD, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  crearTarjeta: async (data, userId) => {
    const id = await tarjetaCreditoService.crear(data, userId);
    await get().fetchTarjetas();
    return id;
  },

  actualizarTarjeta: async (id, data, userId) => {
    await tarjetaCreditoService.actualizar(id, data, userId);
    await get().fetchTarjetas();
  },

  registrarCargo: async (tarjetaId, montoUSD, tcDelDia, descripcion, userId, ordenCompraId?) => {
    await tarjetaCreditoService.registrarCargo(tarjetaId, montoUSD, tcDelDia, descripcion, userId, ordenCompraId);
    await get().fetchTarjetas();
  },

  registrarPago: async (tarjetaId, montoUSD, tcPago, userId) => {
    const result = await tarjetaCreditoService.registrarPago(tarjetaId, montoUSD, tcPago, userId);
    await get().fetchTarjetas();
    return result;
  },
}));
