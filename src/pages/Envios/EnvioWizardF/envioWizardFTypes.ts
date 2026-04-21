/**
 * EnvioWizardF — Tipos y reducer del Wizard "Despacho venta Almacén Perú → cliente"
 *
 * Caso F del Modelo Envíos Transversal (ver `docs/MODELO_ENVIOS_TRANSVERSAL.md`).
 * Wizard manual de 4 pasos:
 *   Venta → Picking → Detalles (transporte+costos) → Confirmar
 *
 * Diferencias clave vs. T2/E/J:
 *   - Vinculado OBLIGATORIAMENTE a una Venta existente
 *   - Cliente + dirección se autocompletan desde la Venta (no se editan)
 *   - Picking default = unidades con reservadaPara === ventaId
 *   - Todo en PEN (despacho local)
 *
 * Decisiones:
 *   - D-1 (Envios absorbe Ventas logística)
 *   - D-15 (Caso F nace en 'borrador')
 */

import type { Unidad } from '../../../types/unidad.types';
import type { Venta } from '../../../types/venta.types';

// ════════════════════════════════════════════════════════════════════════════
// Tipos auxiliares
// ════════════════════════════════════════════════════════════════════════════

/** Costo en PEN del despacho (delivery, combustible, etc.) */
export interface CostoPENDespacho {
  id: string;
  concepto: string;
  metodo: 'monto_total' | 'por_unidad';
  montoPEN: number;
  activo: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// State shape
// ════════════════════════════════════════════════════════════════════════════

export interface EnvioWizardFState {
  // ─── Paso 1: Venta ───
  ventaId: string;
  ventaSnapshot: Venta | null; // Cache de la venta seleccionada

  // ─── Paso 2: Picking ───
  almacenOrigenId: string;
  almacenOrigenNombre: string;
  unidadesDisponibles: Unidad[]; // Unidades reservadas + disponibles en almacén
  unidadesIdsSeleccionadas: string[];

  // ─── Paso 3: Transporte + Costos ───
  colaboradorTransporteId: string;
  colaboradorTransporteNombre: string;
  numeroTracking: string;
  costosPEN: CostoPENDespacho[];

  // ─── Paso 4: Confirmar ───
  notas: string;

  // ─── Metadata ───
  pasoActual: number;
  ultimoPasoValidado: number;
}

export const initialEnvioWizardFState: EnvioWizardFState = {
  ventaId: '',
  ventaSnapshot: null,

  almacenOrigenId: '',
  almacenOrigenNombre: '',
  unidadesDisponibles: [],
  unidadesIdsSeleccionadas: [],

  colaboradorTransporteId: '',
  colaboradorTransporteNombre: '',
  numeroTracking: '',
  costosPEN: [],

  notas: '',

  pasoActual: 0,
  ultimoPasoValidado: 0,
};

// ════════════════════════════════════════════════════════════════════════════
// Actions
// ════════════════════════════════════════════════════════════════════════════

export type EnvioWizardFAction =
  | { type: 'GO_TO_STEP'; paso: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_VENTA'; venta: Venta }
  | { type: 'SET_ALMACEN_ORIGEN'; almacenId: string; almacenNombre: string }
  | { type: 'SET_UNIDADES_DISPONIBLES'; unidades: Unidad[] }
  | { type: 'TOGGLE_UNIDAD'; unidadId: string }
  | { type: 'SELECCIONAR_TODAS_RESERVADAS' }
  | { type: 'SET_COLABORADOR_TRANSPORTE'; id: string; nombre: string }
  | { type: 'SET_TRACKING'; tracking: string }
  | { type: 'AGREGAR_COSTO_PEN'; costo: CostoPENDespacho }
  | { type: 'EDITAR_COSTO_PEN'; id: string; updates: Partial<CostoPENDespacho> }
  | { type: 'ELIMINAR_COSTO_PEN'; id: string }
  | { type: 'SET_NOTAS'; notas: string }
  | { type: 'RESET' }
  | { type: 'HYDRATE'; state: Partial<EnvioWizardFState> };

// ════════════════════════════════════════════════════════════════════════════
// Reducer
// ════════════════════════════════════════════════════════════════════════════

export function envioWizardFReducer(
  state: EnvioWizardFState,
  action: EnvioWizardFAction
): EnvioWizardFState {
  switch (action.type) {
    case 'GO_TO_STEP':
      return { ...state, pasoActual: Math.max(0, Math.min(3, action.paso)) };

    case 'NEXT_STEP': {
      const siguiente = Math.min(3, state.pasoActual + 1);
      return {
        ...state,
        pasoActual: siguiente,
        ultimoPasoValidado: Math.max(state.ultimoPasoValidado, siguiente),
      };
    }

    case 'PREV_STEP':
      return { ...state, pasoActual: Math.max(0, state.pasoActual - 1) };

    case 'SET_VENTA':
      return {
        ...state,
        ventaId: action.venta.id,
        ventaSnapshot: action.venta,
        // Cambiar venta resetea picking y almacén
        almacenOrigenId: '',
        almacenOrigenNombre: '',
        unidadesDisponibles: [],
        unidadesIdsSeleccionadas: [],
      };

    case 'SET_ALMACEN_ORIGEN':
      return {
        ...state,
        almacenOrigenId: action.almacenId,
        almacenOrigenNombre: action.almacenNombre,
        unidadesDisponibles: [],
        unidadesIdsSeleccionadas: [],
      };

    case 'SET_UNIDADES_DISPONIBLES': {
      // Pre-seleccionar las que tienen reservadaPara === ventaId
      const idsReservadas = action.unidades
        .filter((u) => u.reservadaPara === state.ventaId)
        .map((u) => u.id);
      return {
        ...state,
        unidadesDisponibles: action.unidades,
        unidadesIdsSeleccionadas: idsReservadas,
      };
    }

    case 'TOGGLE_UNIDAD': {
      const has = state.unidadesIdsSeleccionadas.includes(action.unidadId);
      return {
        ...state,
        unidadesIdsSeleccionadas: has
          ? state.unidadesIdsSeleccionadas.filter((id) => id !== action.unidadId)
          : [...state.unidadesIdsSeleccionadas, action.unidadId],
      };
    }

    case 'SELECCIONAR_TODAS_RESERVADAS': {
      const idsReservadas = state.unidadesDisponibles
        .filter((u) => u.reservadaPara === state.ventaId)
        .map((u) => u.id);
      return {
        ...state,
        unidadesIdsSeleccionadas: Array.from(
          new Set([...state.unidadesIdsSeleccionadas, ...idsReservadas])
        ),
      };
    }

    case 'SET_COLABORADOR_TRANSPORTE':
      return {
        ...state,
        colaboradorTransporteId: action.id,
        colaboradorTransporteNombre: action.nombre,
      };

    case 'SET_TRACKING':
      return { ...state, numeroTracking: action.tracking };

    case 'AGREGAR_COSTO_PEN':
      return { ...state, costosPEN: [...state.costosPEN, action.costo] };

    case 'EDITAR_COSTO_PEN':
      return {
        ...state,
        costosPEN: state.costosPEN.map((c) =>
          c.id === action.id ? { ...c, ...action.updates } : c
        ),
      };

    case 'ELIMINAR_COSTO_PEN':
      return {
        ...state,
        costosPEN: state.costosPEN.filter((c) => c.id !== action.id),
      };

    case 'SET_NOTAS':
      return { ...state, notas: action.notas };

    case 'RESET':
      return initialEnvioWizardFState;

    case 'HYDRATE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Selectors
// ════════════════════════════════════════════════════════════════════════════

export function selectUnidadesCount(state: EnvioWizardFState): number {
  return state.unidadesIdsSeleccionadas.length;
}

export function selectProductosCount(state: EnvioWizardFState): number {
  const ids = new Set(
    state.unidadesDisponibles
      .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
      .map((u) => u.productoId)
  );
  return ids.size;
}

export function selectUnidadesReservadasVenta(state: EnvioWizardFState): Unidad[] {
  if (!state.ventaId) return [];
  return state.unidadesDisponibles.filter((u) => u.reservadaPara === state.ventaId);
}

export function selectTotalCostosPEN(state: EnvioWizardFState): number {
  return state.costosPEN
    .filter((c) => c.activo)
    .reduce((sum, c) => {
      if (c.metodo === 'por_unidad') {
        return sum + c.montoPEN * selectUnidadesCount(state);
      }
      return sum + c.montoPEN;
    }, 0);
}

/** Valor total de venta vinculada (PEN) */
export function selectValorVentaPEN(state: EnvioWizardFState): number {
  return state.ventaSnapshot?.totalPEN ?? 0;
}
