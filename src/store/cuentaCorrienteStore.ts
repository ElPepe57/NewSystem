/**
 * cuentaCorrienteStore.ts — S55 · Cuenta Corriente Unificada
 *
 * Estado global zustand para listados y resúmenes de CCs. Para CCs
 * individuales con seguimiento reactivo, usar el hook `useCuentaCorriente`
 * (no este store).
 *
 * Uso típico:
 *  - Dashboards globales de saldos
 *  - Listados con filtros
 *  - KPIs en página de Tesorería
 */

import { create } from 'zustand';
import { cuentaCorrienteService } from '../services/cuentaCorriente.service';
import type {
  CuentaCorriente,
  CuentaCorrienteFiltros,
  SaldosResumen,
} from '../types/cuentaCorriente.types';

interface CuentaCorrienteState {
  cuentasCorrientes: CuentaCorriente[];
  resumen: SaldosResumen | null;
  loading: boolean;
  error: string | null;

  // ── Acciones ─────────────────────────────────────────────────
  fetchAll: (filtros?: CuentaCorrienteFiltros) => Promise<void>;
  fetchResumen: () => Promise<void>;
  reset: () => void;
}

export const useCuentaCorrienteStore = create<CuentaCorrienteState>((set) => ({
  cuentasCorrientes: [],
  resumen: null,
  loading: false,
  error: null,

  fetchAll: async (filtros) => {
    set({ loading: true, error: null });
    try {
      const ccs = await cuentaCorrienteService.getAll(filtros);
      set({ cuentasCorrientes: ccs, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando CCs';
      set({ error: message, loading: false });
    }
  },

  fetchResumen: async () => {
    set({ loading: true, error: null });
    try {
      const resumen = await cuentaCorrienteService.getResumen();
      set({ resumen, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando resumen';
      set({ error: message, loading: false });
    }
  },

  reset: () => set({ cuentasCorrientes: [], resumen: null, loading: false, error: null }),
}));
