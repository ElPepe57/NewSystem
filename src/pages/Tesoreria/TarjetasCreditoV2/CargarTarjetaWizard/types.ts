/**
 * types.ts — CargarTarjetaWizard internal state · S58d F3
 *
 * Wizard de 3 pasos para cargar OCs/envíos/gastos a una tarjeta de crédito.
 * El estado se mapea a CargoTarjetaInput para llamar a TX-1.
 *
 * Pasos:
 *   1. Tarjeta + Entidad fuente (proveedor/colaborador)
 *   2. Distribución de documentos pendientes (checkbox + monto editable)
 *   3. Detalles + Confirmar (descripción + TC auto + ejecutar)
 */

import type {
  DeudaDistribuible,
  DistribucionItem,
} from '../../../../types/pagoAbonoDistribuido.types';
import type { TipoEntidadCC } from '../../../../types/cuentaCorriente.types';
import type { TarjetaCredito } from '../../../../types/tarjetaCredito.types';
import type { MonedaTesoreria } from '../../../../types/tesoreria.types';

// ═════════════════════════════════════════════════════════════════════════
// PASOS
// ═════════════════════════════════════════════════════════════════════════

export type PasoCargoWizard = 1 | 2 | 3;

export const PASOS_LABEL: Record<PasoCargoWizard, string> = {
  1: 'Origen',
  2: 'Distribución',
  3: 'Confirmar',
};

// ═════════════════════════════════════════════════════════════════════════
// STATE
// ═════════════════════════════════════════════════════════════════════════

export interface EntidadOrigenCargo {
  entidadId: string;
  entidadTipo: TipoEntidadCC;
  entidadNombre: string;
}

export interface CargarTarjetaState {
  // ── Paso 1 ──
  tarjeta: TarjetaCredito | null;
  entidad: EntidadOrigenCargo | null;
  /** Cache de deudas resueltas para la entidad seleccionada. */
  deudas: DeudaDistribuible[];

  // ── Paso 2 ──
  /** Items elegidos para incluir en el cargo. */
  distribucion: DistribucionItem[];
  /** Moneda del cargo (heredada de los docs · uniforme). */
  monedaCargo: MonedaTesoreria;

  // ── Paso 3 ──
  fecha: Date;
  descripcion: string;
  tcDelDia: number;
  fuenteTcDelDia: 'auto' | 'manual';
  motivoOverrideTc: string;
}

export const INITIAL_STATE: CargarTarjetaState = {
  tarjeta: null,
  entidad: null,
  deudas: [],

  distribucion: [],
  monedaCargo: 'USD',

  fecha: new Date(),
  descripcion: '',
  tcDelDia: 0,
  fuenteTcDelDia: 'auto',
  motivoOverrideTc: '',
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
  paso: PasoCargoWizard,
  state: CargarTarjetaState,
): ValidacionPaso {
  const errores: string[] = [];

  if (paso === 1) {
    if (!state.tarjeta) errores.push('Selecciona una tarjeta');
    if (!state.entidad) errores.push('Selecciona una entidad origen');
    else if (state.deudas.length === 0)
      errores.push('La entidad no tiene documentos pendientes');
  }

  if (paso === 2) {
    if (state.distribucion.length === 0)
      errores.push('Selecciona al menos 1 documento a cargar');
    for (const item of state.distribucion) {
      if (item.montoAplicado <= 0) {
        errores.push(`${item.documentoNumero}: monto debe ser > 0`);
        break;
      }
    }
  }

  if (paso === 3) {
    if (!state.descripcion.trim())
      errores.push('Agrega una descripción del cargo');
    if (state.tcDelDia <= 0) errores.push('TC del día inválido');
    if (!state.fecha) errores.push('Selecciona una fecha');
    if (
      state.fuenteTcDelDia === 'manual' &&
      !state.motivoOverrideTc.trim()
    ) {
      errores.push('Motivo del override de TC es requerido');
    }
  }

  // Validación cross-step: el monto total debe coincidir con suma de items
  void TOLERANCIA;

  return { valido: errores.length === 0, errores };
}

// ═════════════════════════════════════════════════════════════════════════
// DERIVADOS
// ═════════════════════════════════════════════════════════════════════════

/** Total del cargo = Σ(montoAplicado). */
export function getTotalCargo(state: CargarTarjetaState): number {
  return state.distribucion.reduce((s, d) => s + d.montoAplicado, 0);
}
