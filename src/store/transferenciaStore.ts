import { create } from 'zustand';
import { transferenciaService } from '../services/transferencia.service';
import type {
  Transferencia,
  TransferenciaFormData,
  RecepcionFormData,
  TransferenciaFiltros,
  ResumenTransferencias,
  PagoViajero
} from '../types/transferencia.types';
import type { MetodoTesoreria } from '../types/tesoreria.types';

interface TransferenciaState {
  // Estado
  transferencias: Transferencia[];
  transferenciasEnTransito: Transferencia[];
  transferenciasPendientes: Transferencia[];
  resumen: ResumenTransferencias | null;
  selectedTransferencia: Transferencia | null;
  loading: boolean;
  error: string | null;

  // Acciones de consulta
  fetchTransferencias: () => Promise<void>;
  fetchEnTransito: () => Promise<void>;
  fetchPendientesRecepcion: () => Promise<void>;
  fetchByFiltros: (filtros: TransferenciaFiltros) => Promise<void>;
  fetchResumen: () => Promise<void>;
  getById: (id: string) => Promise<Transferencia | null>;

  // Acciones de gestión
  crearTransferencia: (data: TransferenciaFormData, userId: string) => Promise<string>;
  confirmarTransferencia: (id: string, userId: string) => Promise<void>;
  enviarTransferencia: (id: string, datos: { numeroTracking?: string; fechaSalida?: Date }, userId: string) => Promise<void>;
  registrarRecepcion: (data: RecepcionFormData, userId: string) => Promise<void>;
  cancelarTransferencia: (id: string, motivo: string, userId: string) => Promise<void>;
  registrarPagoViajero: (
    transferenciaId: string,
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
  ) => Promise<PagoViajero>;

  // Utilidades
  setSelectedTransferencia: (transferencia: Transferencia | null) => void;
  clearError: () => void;
}

export const useTransferenciaStore = create<TransferenciaState>((set, get) => ({
  transferencias: [],
  transferenciasEnTransito: [],
  transferenciasPendientes: [],
  resumen: null,
  selectedTransferencia: null,
  loading: false,
  error: null,

  // ============================================
  // CONSULTAS
  // ============================================

  fetchTransferencias: async () => {
    set({ loading: true, error: null });
    try {
      const transferencias = await transferenciaService.getAll();
      set({ transferencias, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchEnTransito: async () => {
    set({ loading: true, error: null });
    try {
      const transferenciasEnTransito = await transferenciaService.getEnTransito();
      set({ transferenciasEnTransito, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchPendientesRecepcion: async () => {
    set({ loading: true, error: null });
    try {
      const transferenciasPendientes = await transferenciaService.getPendientesRecepcion();
      set({ transferenciasPendientes, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchByFiltros: async (filtros: TransferenciaFiltros) => {
    set({ loading: true, error: null });
    try {
      const transferencias = await transferenciaService.getByFiltros(filtros);
      set({ transferencias, loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  fetchResumen: async () => {
    set({ loading: true, error: null });
    try {
      const resumen = await transferenciaService.getResumen();
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
      const transferencia = await transferenciaService.getById(id);
      set({ selectedTransferencia: transferencia, loading: false });
      return transferencia;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // ============================================
  // GESTIÓN
  // ============================================

  crearTransferencia: async (data: TransferenciaFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      const id = await transferenciaService.crear(data, userId);
      await get().fetchTransferencias();
      await get().fetchResumen();
      set({ loading: false });
      return id;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  confirmarTransferencia: async (id: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await transferenciaService.confirmar(id, userId);
      await get().fetchTransferencias();
      await get().fetchPendientesRecepcion();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  enviarTransferencia: async (
    id: string,
    datos: { numeroTracking?: string; fechaSalida?: Date },
    userId: string
  ) => {
    set({ loading: true, error: null });
    try {
      await transferenciaService.enviar(id, datos, userId);
      await get().fetchTransferencias();
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

  registrarRecepcion: async (data: RecepcionFormData, userId: string) => {
    set({ loading: true, error: null });
    try {
      await transferenciaService.registrarRecepcion(data, userId);
      await get().fetchTransferencias();
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

  cancelarTransferencia: async (id: string, motivo: string, userId: string) => {
    set({ loading: true, error: null });
    try {
      await transferenciaService.cancelar(id, motivo, userId);
      await get().fetchTransferencias();
      await get().fetchResumen();
      set({ loading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  registrarPagoViajero: async (
    transferenciaId: string,
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
  ) => {
    set({ loading: true, error: null });
    try {
      const pago = await transferenciaService.registrarPagoViajero(transferenciaId, datos, userId);
      await get().fetchTransferencias();
      set({ loading: false });
      return pago;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // ============================================
  // UTILIDADES
  // ============================================

  setSelectedTransferencia: (transferencia: Transferencia | null) => {
    set({ selectedTransferencia: transferencia });
  },

  clearError: () => set({ error: null })
}));
