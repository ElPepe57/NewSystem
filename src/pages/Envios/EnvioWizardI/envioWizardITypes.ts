/**
 * EnvioWizardI — Tipos y reducer del Wizard "Almacén propio → Almacén tercero"
 *
 * Caso I del Modelo Envíos Transversal (FBA Amazon, consignatario, distribuidor).
 * Wizard manual de 4 pasos:
 *   Origen+Picking → Tercero (destino+referencia) → Detalles → Confirmar
 *
 * D-10: las unidades enviadas quedan BLOQUEADAS — no aparecen en stock
 * vendible hasta que regresen a Perú o se liquiden allá.
 *
 * Decisiones aplicadas:
 *   - D-8 (casos I/J como envíos entre nodos)
 *   - D-10 (Opción B: bloqueo de stock)
 *   - D-15 (Caso I nace en 'borrador')
 */

import type { Unidad } from '../../../types/unidad.types';

// ════════════════════════════════════════════════════════════════════════════
// Tipos auxiliares
// ════════════════════════════════════════════════════════════════════════════

/** Tipo de relación comercial con el tercero */
export type TipoRelacionTercero = 'fulfillment' | 'consignacion' | 'distribucion' | 'otro';

/** Costo multi-moneda del envío I */
export interface CostoEnvioI {
  id: string;
  concepto: string;
  moneda: 'USD' | 'PEN';
  monto: number;
  metodo: 'monto_total' | 'por_unidad';
  activo: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// State shape
// ════════════════════════════════════════════════════════════════════════════

export interface EnvioWizardIState {
  // ─── Paso 1: Origen + Picking ───
  almacenOrigenId: string;
  almacenOrigenNombre: string;
  almacenOrigenPais: string;

  unidadesDisponibles: Unidad[];
  unidadesIdsSeleccionadas: string[];

  // ─── Paso 2: Tercero (destino + referencia) ───
  almacenTerceroDestinoId: string;
  almacenTerceroDestinoNombre: string;
  almacenTerceroDestinoPais: string;
  referenciaTercero: string;
  tipoRelacion: TipoRelacionTercero;

  // ─── Paso 3: Detalles (transporte + costos) ───
  colaboradorTransporteId: string;
  colaboradorTransporteNombre: string;
  numeroTracking: string;
  tipoCambio: number;
  costos: CostoEnvioI[];

  // ─── Paso 4: Confirmar ───
  notas: string;

  // ─── Metadata ───
  pasoActual: number;
  ultimoPasoValidado: number;
}

export const initialEnvioWizardIState: EnvioWizardIState = {
  almacenOrigenId: '',
  almacenOrigenNombre: '',
  almacenOrigenPais: '',

  unidadesDisponibles: [],
  unidadesIdsSeleccionadas: [],

  almacenTerceroDestinoId: '',
  almacenTerceroDestinoNombre: '',
  almacenTerceroDestinoPais: '',
  referenciaTercero: '',
  tipoRelacion: 'fulfillment',

  colaboradorTransporteId: '',
  colaboradorTransporteNombre: '',
  numeroTracking: '',
  tipoCambio: 0,
  costos: [],

  notas: '',

  pasoActual: 0,
  ultimoPasoValidado: 0,
};

// ════════════════════════════════════════════════════════════════════════════
// Actions
// ════════════════════════════════════════════════════════════════════════════

export type EnvioWizardIAction =
  | { type: 'GO_TO_STEP'; paso: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_ORIGEN'; almacenId: string; almacenNombre: string; pais: string }
  | { type: 'SET_UNIDADES_DISPONIBLES'; unidades: Unidad[] }
  | { type: 'TOGGLE_UNIDAD'; unidadId: string }
  | { type: 'TOGGLE_PRODUCTO'; productoId: string }
  | { type: 'SET_CANTIDAD_PRODUCTO'; productoId: string; cantidad: number }
  | { type: 'SET_TERCERO_DESTINO'; almacenId: string; almacenNombre: string; pais: string }
  | { type: 'SET_REFERENCIA_TERCERO'; referencia: string }
  | { type: 'SET_TIPO_RELACION'; tipo: TipoRelacionTercero }
  | { type: 'SET_COLABORADOR_TRANSPORTE'; id: string; nombre: string }
  | { type: 'SET_TRACKING'; tracking: string }
  | { type: 'SET_TIPO_CAMBIO'; tc: number }
  | { type: 'AGREGAR_COSTO'; costo: CostoEnvioI }
  | { type: 'EDITAR_COSTO'; id: string; updates: Partial<CostoEnvioI> }
  | { type: 'ELIMINAR_COSTO'; id: string }
  | { type: 'SET_NOTAS'; notas: string }
  | { type: 'RESET' }
  | { type: 'HYDRATE'; state: Partial<EnvioWizardIState> };

// ════════════════════════════════════════════════════════════════════════════
// Reducer
// ════════════════════════════════════════════════════════════════════════════

export function envioWizardIReducer(
  state: EnvioWizardIState,
  action: EnvioWizardIAction
): EnvioWizardIState {
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

    case 'SET_ORIGEN':
      return {
        ...state,
        almacenOrigenId: action.almacenId,
        almacenOrigenNombre: action.almacenNombre,
        almacenOrigenPais: action.pais,
        unidadesDisponibles: [],
        unidadesIdsSeleccionadas: [],
      };

    case 'SET_UNIDADES_DISPONIBLES':
      return {
        ...state,
        unidadesDisponibles: action.unidades,
        unidadesIdsSeleccionadas: [],
      };

    case 'TOGGLE_UNIDAD': {
      const has = state.unidadesIdsSeleccionadas.includes(action.unidadId);
      return {
        ...state,
        unidadesIdsSeleccionadas: has
          ? state.unidadesIdsSeleccionadas.filter((id) => id !== action.unidadId)
          : [...state.unidadesIdsSeleccionadas, action.unidadId],
      };
    }

    case 'TOGGLE_PRODUCTO': {
      const idsDelProducto = state.unidadesDisponibles
        .filter((u) => u.productoId === action.productoId)
        .map((u) => u.id);
      const todasSeleccionadas = idsDelProducto.every((id) =>
        state.unidadesIdsSeleccionadas.includes(id)
      );
      return {
        ...state,
        unidadesIdsSeleccionadas: todasSeleccionadas
          ? state.unidadesIdsSeleccionadas.filter((id) => !idsDelProducto.includes(id))
          : Array.from(new Set([...state.unidadesIdsSeleccionadas, ...idsDelProducto])),
      };
    }

    case 'SET_CANTIDAD_PRODUCTO': {
      const unidadesProducto = state.unidadesDisponibles.filter(
        (u) => u.productoId === action.productoId
      );
      const ordenadas = [...unidadesProducto].sort((a, b) => {
        // FIFO por fecha recepción (Caso I no prioriza pre-vendidas — es stock neto)
        const aFecha = a.fechaRecepcion?.toMillis?.() ?? 0;
        const bFecha = b.fechaRecepcion?.toMillis?.() ?? 0;
        return aFecha - bFecha;
      });
      const cantidad = Math.max(0, Math.min(action.cantidad, ordenadas.length));
      const idsAIncluir = new Set(ordenadas.slice(0, cantidad).map((u) => u.id));
      const idsDelProducto = new Set(unidadesProducto.map((u) => u.id));
      const nuevasSelecciones = state.unidadesIdsSeleccionadas.filter(
        (id) => !idsDelProducto.has(id)
      );
      return {
        ...state,
        unidadesIdsSeleccionadas: [...nuevasSelecciones, ...Array.from(idsAIncluir)],
      };
    }

    case 'SET_TERCERO_DESTINO':
      return {
        ...state,
        almacenTerceroDestinoId: action.almacenId,
        almacenTerceroDestinoNombre: action.almacenNombre,
        almacenTerceroDestinoPais: action.pais,
      };

    case 'SET_REFERENCIA_TERCERO':
      return { ...state, referenciaTercero: action.referencia };

    case 'SET_TIPO_RELACION':
      return { ...state, tipoRelacion: action.tipo };

    case 'SET_COLABORADOR_TRANSPORTE':
      return {
        ...state,
        colaboradorTransporteId: action.id,
        colaboradorTransporteNombre: action.nombre,
      };

    case 'SET_TRACKING':
      return { ...state, numeroTracking: action.tracking };

    case 'SET_TIPO_CAMBIO':
      return { ...state, tipoCambio: action.tc };

    case 'AGREGAR_COSTO':
      return { ...state, costos: [...state.costos, action.costo] };

    case 'EDITAR_COSTO':
      return {
        ...state,
        costos: state.costos.map((c) =>
          c.id === action.id ? { ...c, ...action.updates } : c
        ),
      };

    case 'ELIMINAR_COSTO':
      return { ...state, costos: state.costos.filter((c) => c.id !== action.id) };

    case 'SET_NOTAS':
      return { ...state, notas: action.notas };

    case 'RESET':
      return initialEnvioWizardIState;

    case 'HYDRATE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Selectors
// ════════════════════════════════════════════════════════════════════════════

export function selectUnidadesCount(state: EnvioWizardIState): number {
  return state.unidadesIdsSeleccionadas.length;
}

export function selectProductosCount(state: EnvioWizardIState): number {
  const ids = new Set(
    state.unidadesDisponibles
      .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
      .map((u) => u.productoId)
  );
  return ids.size;
}

export function selectCTRUBaseUSD(state: EnvioWizardIState): number {
  return state.unidadesDisponibles
    .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
    .reduce((sum, u) => sum + (u.ctruDinamico ?? u.costoUnitarioUSD ?? 0), 0);
}

/** Total costos convertidos a USD (para display unificado) */
export function selectTotalCostosUSD(state: EnvioWizardIState): number {
  return state.costos
    .filter((c) => c.activo)
    .reduce((sum, c) => {
      const uds = selectUnidadesCount(state);
      const montoBase = c.metodo === 'por_unidad' ? c.monto * uds : c.monto;
      // Si PEN y hay TC, convertir; si no, usar como está (asume USD)
      if (c.moneda === 'PEN') {
        return sum + (state.tipoCambio > 0 ? montoBase / state.tipoCambio : montoBase);
      }
      return sum + montoBase;
    }, 0);
}

/** Total costos en PEN (para display local) */
export function selectTotalCostosPEN(state: EnvioWizardIState): number {
  return state.costos
    .filter((c) => c.activo)
    .reduce((sum, c) => {
      const uds = selectUnidadesCount(state);
      const montoBase = c.metodo === 'por_unidad' ? c.monto * uds : c.monto;
      if (c.moneda === 'USD') {
        return sum + montoBase * (state.tipoCambio || 1);
      }
      return sum + montoBase;
    }, 0);
}
