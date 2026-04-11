/**
 * pagoMasivoStore.ts
 *
 * Estado global para el módulo de Pagos Masivos.
 */
import { create } from 'zustand';
import { cuentasPendientesService } from '../services/cuentasPendientes.service';
import { ejecutarLote, getHistorialLotes } from '../services/pagoMasivo.service';
import { useTipoCambioStore } from './tipoCambioStore';
import type { PendienteFinanciero } from '../types/tesoreria.types';
import type {
  LotePago,
  ItemSeleccionado,
  ConfigPagoMasivo,
  ProgresoLote,
} from '../types/pagoMasivo.types';

type TipoLote = 'egreso' | 'ingreso';

interface PagoMasivoState {
  // Vista
  tipoLote: TipoLote;
  setTipoLote: (tipo: TipoLote) => void;

  // Pendientes cargados
  pendientes: PendienteFinanciero[];
  loadingPendientes: boolean;
  fetchPendientes: () => Promise<void>;

  // Selección
  seleccionados: Map<string, ItemSeleccionado>;
  toggleSeleccion: (pendiente: PendienteFinanciero) => void;
  seleccionarTodos: (pendientes: PendienteFinanciero[]) => void;
  deseleccionarTodos: () => void;
  actualizarMontoPagar: (documentoId: string, monto: number) => void;

  // Ejecución
  progreso: ProgresoLote | null;
  ejecutando: boolean;
  loteResultado: LotePago | null;
  ejecutarPagoMasivo: (config: ConfigPagoMasivo, userId: string) => Promise<LotePago>;

  // Historial
  historial: LotePago[];
  loadingHistorial: boolean;
  fetchHistorial: () => Promise<void>;

  // Lote detalle
  loteDetalle: LotePago | null;
  setLoteDetalle: (lote: LotePago | null) => void;

  // Reset
  resetSeleccion: () => void;
  resetEjecucion: () => void;

  // Error
  error: string | null;
  clearError: () => void;
}

export const usePagoMasivoStore = create<PagoMasivoState>((set, get) => ({
  tipoLote: 'egreso',
  setTipoLote: (tipo) => {
    set({ tipoLote: tipo, seleccionados: new Map(), progreso: null, loteResultado: null });
    get().fetchPendientes();
  },

  pendientes: [],
  loadingPendientes: false,
  fetchPendientes: async () => {
    set({ loadingPendientes: true, error: null });
    try {
      const tcData = await useTipoCambioStore.getState().getTCDelDia();
      const tc = tcData?.venta || 0;
      const { tipoLote } = get();

      let pendientes: PendienteFinanciero[];
      if (tipoLote === 'egreso') {
        const [oc, gastos] = await Promise.all([
          cuentasPendientesService.getOrdenesCompraPorPagar(tc),
          cuentasPendientesService.getGastosPorPagar(tc),
        ]);
        pendientes = [...oc, ...gastos];
      } else {
        pendientes = await cuentasPendientesService.getVentasPorCobrar(tc);
      }

      set({ pendientes, loadingPendientes: false });
    } catch (error: any) {
      set({ error: error.message, loadingPendientes: false });
    }
  },

  seleccionados: new Map(),
  toggleSeleccion: (pendiente) => {
    const { seleccionados } = get();
    const next = new Map(seleccionados);
    if (next.has(pendiente.documentoId)) {
      next.delete(pendiente.documentoId);
    } else {
      next.set(pendiente.documentoId, {
        documentoId: pendiente.documentoId,
        tipoDocumento: pendiente.tipo,
        numeroDocumento: pendiente.numeroDocumento,
        contraparteNombre: pendiente.contraparteNombre,
        montoOriginal: pendiente.montoPendiente,
        montoPagar: pendiente.montoPendiente,
        monedaDocumento: pendiente.moneda,
      });
    }
    set({ seleccionados: next });
  },

  seleccionarTodos: (pendientes) => {
    const next = new Map<string, ItemSeleccionado>();
    for (const p of pendientes) {
      next.set(p.documentoId, {
        documentoId: p.documentoId,
        tipoDocumento: p.tipo,
        numeroDocumento: p.numeroDocumento,
        contraparteNombre: p.contraparteNombre,
        montoOriginal: p.montoPendiente,
        montoPagar: p.montoPendiente,
        monedaDocumento: p.moneda,
      });
    }
    set({ seleccionados: next });
  },

  deseleccionarTodos: () => {
    set({ seleccionados: new Map() });
  },

  actualizarMontoPagar: (documentoId, monto) => {
    const { seleccionados } = get();
    const next = new Map(seleccionados);
    const item = next.get(documentoId);
    if (item) {
      next.set(documentoId, { ...item, montoPagar: Math.min(monto, item.montoOriginal) });
      set({ seleccionados: next });
    }
  },

  progreso: null,
  ejecutando: false,
  loteResultado: null,

  ejecutarPagoMasivo: async (config, userId) => {
    const { tipoLote, seleccionados } = get();
    const items = Array.from(seleccionados.values());

    if (items.length === 0) throw new Error('No hay items seleccionados');

    set({ ejecutando: true, progreso: null, loteResultado: null, error: null });

    try {
      const lote = await ejecutarLote(
        tipoLote,
        items,
        config,
        userId,
        (progreso) => set({ progreso })
      );

      set({ loteResultado: lote, ejecutando: false });
      return lote;
    } catch (error: any) {
      set({ error: error.message, ejecutando: false });
      throw error;
    }
  },

  historial: [],
  loadingHistorial: false,
  fetchHistorial: async () => {
    set({ loadingHistorial: true });
    try {
      const historial = await getHistorialLotes();
      set({ historial, loadingHistorial: false });
    } catch (error: any) {
      set({ error: error.message, loadingHistorial: false });
    }
  },

  loteDetalle: null,
  setLoteDetalle: (lote) => set({ loteDetalle: lote }),

  resetSeleccion: () => {
    set({ seleccionados: new Map(), progreso: null, loteResultado: null });
  },

  resetEjecucion: () => {
    set({ progreso: null, loteResultado: null, ejecutando: false });
  },

  error: null,
  clearError: () => set({ error: null }),
}));
