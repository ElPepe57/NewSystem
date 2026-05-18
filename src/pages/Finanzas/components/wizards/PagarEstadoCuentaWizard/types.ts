/**
 * types.ts — PagarEstadoCuentaWizard internal state · S58d F4
 *
 * Wizard de 3 pasos para pagar el estado de cuenta de una TC. Dos modos:
 *
 *   - 'banco_emisor': aplica si tarjeta.titularidad='empresa'.
 *     Paga al banco con cuenta empresa. Calcula diferencial cambiario.
 *
 *   - 'reembolso_titular': aplica si tarjeta.titularidad='personal'.
 *     Reembolsa al titular sin diferencial.
 *
 * El modo se infiere de la tarjeta seleccionada en Paso 1 y se persiste
 * en el estado para conditional rendering en Pasos 2 y 3.
 */

import type {
  AplicacionPagoCargoTC,
  ModoPagoEstadoCuentaTC,
  TarjetaCredito,
} from '../../../../../types/tarjetaCredito.types';
import type {
  MetodoTesoreria,
  MonedaTesoreria,
} from '../../../../../types/tesoreria.types';

// ═════════════════════════════════════════════════════════════════════════
// PASOS
// ═════════════════════════════════════════════════════════════════════════

export type PasoPagoWizard = 1 | 2 | 3;

export const PASOS_LABEL: Record<PasoPagoWizard, string> = {
  1: 'Cargos',
  2: 'Pago',
  3: 'Confirmar',
};

// ═════════════════════════════════════════════════════════════════════════
// STATE
// ═════════════════════════════════════════════════════════════════════════

export interface PagarEstadoCuentaState {
  // ── Paso 1 ──
  tarjeta: TarjetaCredito | null;
  /** Modo inferido de tarjeta.titularidad (cacheado en estado). */
  modo: ModoPagoEstadoCuentaTC;
  /** Aplicaciones a cargos (incluyendo monto editable por fila). */
  aplicaciones: AplicacionPagoCargoTC[];

  // ── Paso 2 ──
  fecha: Date;
  monedaPago: MonedaTesoreria;
  cuentaOrigenId: string;
  cuentaOrigenNombre: string;
  metodo: MetodoTesoreria;
  tipoCambio: number;
  fuenteTipoCambio: 'tcpa_pool' | 'tipocambio_service' | 'manual';
  referencia: string;

  // ── Paso 3 ──
  notas: string;
}

export const INITIAL_STATE: PagarEstadoCuentaState = {
  tarjeta: null,
  modo: 'banco_emisor',
  aplicaciones: [],

  fecha: new Date(),
  monedaPago: 'USD',
  cuentaOrigenId: '',
  cuentaOrigenNombre: '',
  metodo: 'transferencia_bancaria',
  tipoCambio: 0,
  fuenteTipoCambio: 'tipocambio_service',
  referencia: '',

  notas: '',
};

// ═════════════════════════════════════════════════════════════════════════
// VALIDACIÓN POR PASO
// ═════════════════════════════════════════════════════════════════════════

export interface ValidacionPaso {
  valido: boolean;
  errores: string[];
}

const TOLERANCIA = 0.01;

export function validarPaso(
  paso: PasoPagoWizard,
  state: PagarEstadoCuentaState,
): ValidacionPaso {
  const errores: string[] = [];

  if (paso === 1) {
    if (!state.tarjeta) errores.push('Selecciona una tarjeta');
    else if (state.aplicaciones.length === 0)
      errores.push('Selecciona al menos 1 cargo a saldar');
    for (const app of state.aplicaciones) {
      if (app.montoAplicado <= 0) {
        errores.push(`${app.cargoNumero}: monto debe ser > 0`);
        break;
      }
    }
  }

  if (paso === 2) {
    if (!state.cuentaOrigenId) errores.push('Selecciona cuenta origen del pago');
    if (state.tipoCambio <= 0) errores.push('TC inválido');
    if (!state.fecha) errores.push('Selecciona fecha del pago');
  }

  if (paso === 3) {
    // Sin validaciones extras
  }

  void TOLERANCIA;
  return { valido: errores.length === 0, errores };
}

// ═════════════════════════════════════════════════════════════════════════
// DERIVADOS
// ═════════════════════════════════════════════════════════════════════════

/** Monto total del pago = Σ(montoAplicado). */
export function getMontoTotal(state: PagarEstadoCuentaState): number {
  return state.aplicaciones.reduce((s, a) => s + a.montoAplicado, 0);
}
