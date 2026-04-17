import { create } from 'zustand';
import { envioCrudService } from '../services/envio.crud.service';
import { envioPagosService } from '../services/envio.pagos.service';
import type {
  Envio,
  EnvioFormData,
  EnvioFiltros,
  ResumenEnvios,
  PagoColaborador,
} from '../types/envio.types';
import type { MetodoTesoreria } from '../types/tesoreria.types';

interface EnvioState {
  // Estado
  envios: Envio[];
  enviosEnTransito: Envio[];
  enviosPendientesRecepcion: Envio[];
  pendientesPago: Envio[];
  resumen: ResumenEnvios | null;
  selectedEnvio: Envio | null;
  loading: boolean;
  error: string | null;

  // Consultas
  fetchEnvios: () => Promise<void>;
  fetchPorFiltros: (filtros: EnvioFiltros) => Promise<Envio[]>;
  fetchEnTransito: () => Promise<void>;
  fetchPendientesRecepcion: () => Promise<void>;
  fetchPendientesPago: () => Promise<void>;
  fetchResumen: () => Promise<void>;
  getById: (id: string) => Promise<Envio | null>;

  // Gestion
  crearEnvio: (data: EnvioFormData, userId: string) => Promise<string>;
  confirmarEnvio: (id: string, userId: string) => Promise<void>;
  enviarEnvio: (id: string, datos: { numeroTracking?: string; fechaSalida?: Date; courier?: string; courierColaboradorId?: string }, userId: string) => Promise<void>;
  cancelarEnvio: (id: string, motivo: string, userId: string) => Promise<void>;
  registrarPagoColaborador: (
    envioId: string,
    datos: {
      fechaPago: Date;
      monedaPago: 'USD' | 'PEN';
      montoOriginal: number;
      tipoCambio: number;
      metodoPago: MetodoTesoreria;
      cuentaOrigenId?: string;
      referencia?: string;
      notas?: string;
    },
    userId: string
  ) => Promise<PagoColaborador>;
  reconciliarPagoColaborador: (envioId: string, userId: string, pagoId?: string) => Promise<string>;
  actualizarFlete: (id: string, costoFletePorProducto: Record<string, number>, userId: string) => Promise<void>;

  // Utilidades
  setSelectedEnvio: (envio: Envio | null) => void;
  clearError: () => void;
}

export const useEnvioStore = create<EnvioState>((set, get) => ({
  envios: [],
  enviosEnTransito: [],
  enviosPendientesRecepcion: [],
  pendientesPago: [],
  resumen: null,
  selectedEnvio: null,
  loading: false,
  error: null,

  // ============================================
  // CONSULTAS
  // ============================================

  fetchEnvios: async () => {
    set({ loading: true, error: null });
    try {
      const envios = await envioCrudService.getAll();
      set({ envios, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchPorFiltros: async (filtros: EnvioFiltros) => {
    set({ loading: true, error: null });
    try {
      const envios = await envioCrudService.getByFiltros(filtros);
      set({ envios, loading: false });
      return envios;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchEnTransito: async () => {
    set({ loading: true, error: null });
    try {
      const enviosEnTransito = await envioCrudService.getEnTransito();
      set({ enviosEnTransito, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchPendientesRecepcion: async () => {
    set({ loading: true, error: null });
    try {
      const enviosPendientesRecepcion = await envioCrudService.getPendientesRecepcion();
      set({ enviosPendientesRecepcion, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchPendientesPago: async () => {
    set({ loading: true, error: null });
    try {
      const pendientesPago = await envioPagosService.getPendientesPagoColaborador();
      set({ pendientesPago, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchResumen: async () => {
    set({ loading: true, error: null });
    try {
      const resumen = await envioCrudService.getResumen();
      set({ resumen, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  getById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const envio = await envioCrudService.getById(id);
      set({ selectedEnvio: envio, loading: false });
      return envio;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // ============================================
  // GESTION
  // ============================================

  crearEnvio: async (data: EnvioFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const { id } = await envioCrudService.crear(data, userId);
      await get().fetchEnvios();
      await get().fetchResumen();
      set({ loading: false });
      return id;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  confirmarEnvio: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await envioCrudService.confirmar(id, userId);
      await get().fetchEnvios();
      await get().fetchPendientesRecepcion();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  enviarEnvio: async (id: string, datos: { numeroTracking?: string; fechaSalida?: Date; courier?: string; courierColaboradorId?: string }, userId: string) => {
    set({ loading: true, error: null });
    try {
      await envioCrudService.enviar(id, datos, userId);
      await get().fetchEnvios();
      await get().fetchEnTransito();
      await get().fetchPendientesRecepcion();
      await get().fetchResumen();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  cancelarEnvio: async (id: string, motivo: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await envioCrudService.cancelar(id, motivo, userId);
      await get().fetchEnvios();
      await get().fetchResumen();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  registrarPagoColaborador: async (envioId, datos, userId) => {
    set({ loading: true, error: null });
    try {
      const pago = await envioPagosService.registrarPagoColaborador(envioId, datos, userId);
      await get().fetchEnvios();
      set({ loading: false });
      return pago;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  reconciliarPagoColaborador: async (envioId, userId, pagoId) => {
    set({ loading: true, error: null });
    try {
      const movimientoId = await envioPagosService.reconciliarPagoColaborador(envioId, userId, pagoId);
      await get().fetchEnvios();
      set({ loading: false });
      return movimientoId;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  actualizarFlete: async (id, costoFletePorProducto, userId) => {
    set({ loading: true, error: null });
    try {
      await envioCrudService.actualizarFleteEnvio(id, costoFletePorProducto, userId);
      await get().fetchEnvios();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // ============================================
  // UTILIDADES
  // ============================================

  setSelectedEnvio: (envio) => set({ selectedEnvio: envio }),
  clearError: () => set({ error: null }),
}));

// S40 Bloque E: alias useTransferenciaStore eliminado — todos los consumidores migrados a useEnvioStore.
