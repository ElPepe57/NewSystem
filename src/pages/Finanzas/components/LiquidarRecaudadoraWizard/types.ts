/**
 * LiquidarRecaudadoraWizard · types.ts — chk5.D-S1f · F5
 *
 * State + validación de los 3 pasos del wizard para liquidar el saldo
 * pendiente de una Caja Recaudadora (D5 + D12) hacia su cuenta destino.
 *
 * Pasos:
 *   1 · Selección: recaudadora + periodo (inicio/fin) + cuenta destino + fecha liquidación
 *   2 · Revisión: lectura del balance calculado + lista eventos pendientes + breakdown canal
 *   3 · Confirmar: trigger del service `liquidarCajaRecaudadora.service.ts::liquidarSaldo`
 *
 * F-Borradores integrado · tipo='liquidar_recaudadora' en TipoBorradorWizard.
 */

import type { BalanceRecaudadora } from '../../../../types/eventoServicioRecaudador.types';

// ═════════════════════════════════════════════════════════════════════════
// PASOS
// ═════════════════════════════════════════════════════════════════════════

export type PasoLiquidacion = 1 | 2 | 3;

export const PASOS_LIQUIDACION_LABEL: Record<PasoLiquidacion, string> = {
  1: 'Selección',
  2: 'Revisión',
  3: 'Confirmar',
};

// ═════════════════════════════════════════════════════════════════════════
// STATE
// ═════════════════════════════════════════════════════════════════════════

export interface LiquidarRecaudadoraState {
  // ── Paso 1 · Selección ──
  recaudadoraId: string;
  recaudadoraNombre: string;     // Display denormalizado
  fechaInicio: string;            // YYYY-MM-DD (string para input date)
  fechaFin: string;
  fechaLiquidacion: string;
  cuentaDestinoId: string;
  cuentaDestinoNombre: string;    // Display denormalizado

  // ── Paso 2 · Revisión (calculado por service) ──
  balance: BalanceRecaudadora | null;
  balanceLoading: boolean;
  balanceError: string | null;

  // ── Paso 3 · Confirmar ──
  saldoLiquidado: number;         // Auto-cargado del balance · usuario puede ajustar (cuidado)
  notas: string;
}

export const INITIAL_STATE: LiquidarRecaudadoraState = {
  recaudadoraId: '',
  recaudadoraNombre: '',
  fechaInicio: '',
  fechaFin: '',
  fechaLiquidacion: new Date().toISOString().split('T')[0],
  cuentaDestinoId: '',
  cuentaDestinoNombre: '',
  balance: null,
  balanceLoading: false,
  balanceError: null,
  saldoLiquidado: 0,
  notas: '',
};

// ═════════════════════════════════════════════════════════════════════════
// VALIDACIÓN POR PASO
// ═════════════════════════════════════════════════════════════════════════

export interface ValidacionPaso {
  valido: boolean;
  errores: string[];
}

export function validarPaso(
  paso: PasoLiquidacion,
  state: LiquidarRecaudadoraState,
): ValidacionPaso {
  const errores: string[] = [];

  if (paso === 1) {
    if (!state.recaudadoraId) errores.push('Selecciona la Caja Recaudadora a liquidar');
    if (!state.fechaInicio) errores.push('Indica fecha de inicio del periodo');
    if (!state.fechaFin) errores.push('Indica fecha de fin del periodo');
    if (state.fechaInicio && state.fechaFin) {
      const inicio = new Date(state.fechaInicio);
      const fin = new Date(state.fechaFin);
      if (inicio > fin) {
        errores.push('La fecha de inicio debe ser anterior a la fecha de fin');
      }
    }
    if (!state.fechaLiquidacion) errores.push('Indica fecha de la liquidación');
    if (!state.cuentaDestinoId) errores.push('Selecciona la cuenta destino donde se transferirá el saldo');
  }

  if (paso === 2) {
    if (state.balanceLoading) errores.push('Calculando balance · esperá...');
    if (state.balanceError) errores.push(`Error calculando balance: ${state.balanceError}`);
    if (!state.balance) errores.push('Balance no disponible · reintentar');
    if (state.balance && state.balance.eventosPendientesCount === 0) {
      errores.push('No hay eventos pendientes en el periodo para liquidar');
    }
    if (state.balance && state.balance.pendienteLiquidar <= 0) {
      errores.push(`Saldo pendiente a liquidar = ${state.balance.pendienteLiquidar.toFixed(2)} · debe ser mayor a 0`);
    }
  }

  if (paso === 3) {
    if (state.saldoLiquidado <= 0) errores.push('Saldo a liquidar debe ser mayor a 0');
    if (state.balance) {
      const diff = Math.abs(state.balance.pendienteLiquidar - state.saldoLiquidado);
      if (diff > 0.01) {
        errores.push(
          `Saldo a liquidar (${state.saldoLiquidado.toFixed(2)}) no coincide con balance calculado (${state.balance.pendienteLiquidar.toFixed(2)}). Ajustar antes de confirmar.`,
        );
      }
    }
  }

  return { valido: errores.length === 0, errores };
}

// ═════════════════════════════════════════════════════════════════════════
// RESUMEN PARA F-BORRADORES (display en banner)
// ═════════════════════════════════════════════════════════════════════════

export function generarResumenBorrador(state: LiquidarRecaudadoraState): {
  resumen: string;
  montoEstimado?: number;
} {
  const partes: string[] = [];
  if (state.recaudadoraNombre) partes.push(state.recaudadoraNombre);
  if (state.fechaInicio && state.fechaFin) {
    partes.push(`${state.fechaInicio} → ${state.fechaFin}`);
  }
  const resumen = partes.length > 0 ? partes.join(' · ') : 'Liquidación recaudadora pendiente';
  return {
    resumen,
    montoEstimado: state.saldoLiquidado > 0 ? state.saldoLiquidado : undefined,
  };
}
