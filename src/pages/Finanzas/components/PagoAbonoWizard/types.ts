/**
 * types.ts — PagoAbonoWizard internal state
 *
 * State machine del wizard de 4 pasos. Cada paso valida una porción del
 * estado y avanza al siguiente. El estado final se traduce a
 * `PagoAbonoDistribuidoInput` para llamar al service.
 */

import type {
  DeudaDistribuible,
  DistribucionItem,
  EstrategiaDistribucion,
} from '../../../../types/pagoAbonoDistribuido.types';
import type { TipoEntidadCC } from '../../../../types/cuentaCorriente.types';
import type {
  MetodoTesoreria,
  MonedaTesoreria,
} from '../../../../types/tesoreria.types';

// ═════════════════════════════════════════════════════════════════════════
// PASOS
// ═════════════════════════════════════════════════════════════════════════

export type PasoWizard = 1 | 2 | 3 | 4;

export const PASOS_LABEL: Record<PasoWizard, string> = {
  1: 'Entidad',
  2: 'Abono',
  3: 'Distribución',
  4: 'Confirmar',
};

// ═════════════════════════════════════════════════════════════════════════
// STATE
// ═════════════════════════════════════════════════════════════════════════

export interface EntidadSeleccionada {
  entidadId: string;
  entidadTipo: TipoEntidadCC;
  entidadNombre: string;
  /** Saldo USD a la fecha (negativo = le debemos). */
  saldoUSD: number;
  /** Saldo PEN a la fecha (negativo = le debemos). */
  saldoPEN: number;
}

export interface PagoAbonoState {
  // ── Paso 1 ──
  entidad: EntidadSeleccionada | null;
  /** Cache de deudas resueltas para la entidad seleccionada. */
  deudas: DeudaDistribuible[];

  // ── Paso 2 ──
  montoAbono: number | undefined;
  monedaAbono: MonedaTesoreria;
  cuentaId: string | undefined;
  cuentaNombre: string;
  metodo: MetodoTesoreria;
  fecha: Date;
  tipoCambio: number;
  referencia: string;

  // ── Paso 3 ──
  estrategia: EstrategiaDistribucion;
  /** Distribución actual (auto-calculada o manual). */
  distribucion: DistribucionItem[];

  // ── Paso 4 ──
  notas: string;
}

export const INITIAL_STATE: PagoAbonoState = {
  entidad: null,
  deudas: [],

  montoAbono: undefined,
  monedaAbono: 'USD',
  cuentaId: undefined,
  cuentaNombre: '',
  metodo: 'transferencia_bancaria',
  fecha: new Date(),
  tipoCambio: 0,
  referencia: '',

  estrategia: 'antiguas_primero',
  distribucion: [],

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

export function validarPaso(paso: PasoWizard, state: PagoAbonoState): ValidacionPaso {
  const errores: string[] = [];

  if (paso === 1) {
    if (!state.entidad) errores.push('Selecciona una entidad');
    else if (state.deudas.length === 0)
      errores.push('La entidad no tiene deudas pendientes');
  }

  if (paso === 2) {
    if (!state.montoAbono || state.montoAbono <= 0)
      errores.push('El monto del abono debe ser mayor a 0');
    if (!state.cuentaId) errores.push('Selecciona la cuenta');
    if (!state.tipoCambio || state.tipoCambio <= 0)
      errores.push('Tipo de cambio inválido');
    if (!state.fecha) errores.push('Selecciona una fecha');
  }

  if (paso === 3) {
    if (state.distribucion.length === 0)
      errores.push('Distribuye el abono entre al menos 1 documento');
    const sumaDistribuido = state.distribucion.reduce(
      (s, d) => s + d.montoAplicado,
      0,
    );
    if (Math.abs(sumaDistribuido - (state.montoAbono ?? 0)) > TOLERANCIA) {
      errores.push(
        `Distribuido (${sumaDistribuido.toFixed(2)}) ≠ Abono (${(state.montoAbono ?? 0).toFixed(2)})`,
      );
    }
    for (const item of state.distribucion) {
      if (item.montoAplicado <= 0) {
        errores.push(`${item.documentoNumero}: monto inválido`);
        break;
      }
    }
  }

  return { valido: errores.length === 0, errores };
}
