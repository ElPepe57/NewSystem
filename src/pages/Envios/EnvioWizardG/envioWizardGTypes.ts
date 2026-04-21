/**
 * EnvioWizardG — Tipos y reducer del Wizard "Devolución cliente → Almacén Perú"
 *
 * Caso G del Modelo Envíos Transversal. Wizard manual de 3 pasos:
 *   Devolución → Destino+Detalles → Confirmar
 *
 * Vinculado obligatoriamente a una Devolucion existente. Las unidades y el
 * cliente se leen de esa devolución — el wizard solo captura el aspecto
 * logístico del retorno físico.
 *
 * D-7: las unidades NO vuelven a 'disponible'. Quedan en revisión hasta que
 * el operador decida reintegrables / merma / reclamo.
 */

import type { Devolucion } from '../../../types/devolucion.types';
import type { MetodoProrrateo } from '../../../types/envio.types';

// ════════════════════════════════════════════════════════════════════════════
// Tipos auxiliares
// ════════════════════════════════════════════════════════════════════════════

/** Costo en PEN del retorno físico (delivery inverso, combustible, etc.) */
export interface CostoRetornoPEN {
  id: string;
  concepto: string;
  metodo: 'monto_total' | 'por_unidad';
  montoPEN: number;
  activo: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// State shape
// ════════════════════════════════════════════════════════════════════════════

export interface EnvioWizardGState {
  // ─── Paso 1: Devolución ───
  devolucionId: string;
  devolucionSnapshot: Devolucion | null;
  /** IDs de unidades seleccionadas del listado de la devolución */
  unidadesIdsSeleccionadas: string[];

  // ─── Paso 2: Destino + Detalles ───
  almacenDestinoId: string;
  almacenDestinoNombre: string;
  colaboradorTransporteId: string;
  colaboradorTransporteNombre: string;
  numeroTracking: string;
  costosPEN: CostoRetornoPEN[];

  // ─── Paso 3: Confirmar ───
  notas: string;

  // ─── Metadata ───
  pasoActual: number;
  ultimoPasoValidado: number;
}

export const initialEnvioWizardGState: EnvioWizardGState = {
  devolucionId: '',
  devolucionSnapshot: null,
  unidadesIdsSeleccionadas: [],

  almacenDestinoId: '',
  almacenDestinoNombre: '',
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

export type EnvioWizardGAction =
  | { type: 'GO_TO_STEP'; paso: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_DEVOLUCION'; devolucion: Devolucion }
  | { type: 'TOGGLE_UNIDAD'; unidadId: string }
  | { type: 'SELECCIONAR_TODAS' }
  | { type: 'SET_DESTINO'; almacenId: string; almacenNombre: string }
  | { type: 'SET_COLABORADOR_TRANSPORTE'; id: string; nombre: string }
  | { type: 'SET_TRACKING'; tracking: string }
  | { type: 'AGREGAR_COSTO_PEN'; costo: CostoRetornoPEN }
  | { type: 'EDITAR_COSTO_PEN'; id: string; updates: Partial<CostoRetornoPEN> }
  | { type: 'ELIMINAR_COSTO_PEN'; id: string }
  | { type: 'SET_NOTAS'; notas: string }
  | { type: 'RESET' }
  | { type: 'HYDRATE'; state: Partial<EnvioWizardGState> };

// ════════════════════════════════════════════════════════════════════════════
// Helpers de unidades disponibles en la devolución
// ════════════════════════════════════════════════════════════════════════════

/** IDs de todas las unidades que aparecen en la devolución (sum flatten) */
function getUnidadesIdsDeDevolucion(devolucion: Devolucion): string[] {
  return devolucion.productos.flatMap((p) => p.unidadesIds);
}

// ════════════════════════════════════════════════════════════════════════════
// Reducer
// ════════════════════════════════════════════════════════════════════════════

export function envioWizardGReducer(
  state: EnvioWizardGState,
  action: EnvioWizardGAction
): EnvioWizardGState {
  switch (action.type) {
    case 'GO_TO_STEP':
      return { ...state, pasoActual: Math.max(0, Math.min(2, action.paso)) };

    case 'NEXT_STEP': {
      const siguiente = Math.min(2, state.pasoActual + 1);
      return {
        ...state,
        pasoActual: siguiente,
        ultimoPasoValidado: Math.max(state.ultimoPasoValidado, siguiente),
      };
    }

    case 'PREV_STEP':
      return { ...state, pasoActual: Math.max(0, state.pasoActual - 1) };

    case 'SET_DEVOLUCION':
      return {
        ...state,
        devolucionId: action.devolucion.id,
        devolucionSnapshot: action.devolucion,
        // Pre-selecciona todas las unidades de la devolución (escenario default)
        unidadesIdsSeleccionadas: getUnidadesIdsDeDevolucion(action.devolucion),
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

    case 'SELECCIONAR_TODAS':
      return {
        ...state,
        unidadesIdsSeleccionadas: state.devolucionSnapshot
          ? getUnidadesIdsDeDevolucion(state.devolucionSnapshot)
          : [],
      };

    case 'SET_DESTINO':
      return {
        ...state,
        almacenDestinoId: action.almacenId,
        almacenDestinoNombre: action.almacenNombre,
      };

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
      return initialEnvioWizardGState;

    case 'HYDRATE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Selectors
// ════════════════════════════════════════════════════════════════════════════

export function selectUnidadesCount(state: EnvioWizardGState): number {
  return state.unidadesIdsSeleccionadas.length;
}

export function selectProductosCount(state: EnvioWizardGState): number {
  if (!state.devolucionSnapshot) return 0;
  const productosAfectados = new Set<string>();
  for (const p of state.devolucionSnapshot.productos) {
    const hayAlgunaSeleccionada = p.unidadesIds.some((uid) =>
      state.unidadesIdsSeleccionadas.includes(uid)
    );
    if (hayAlgunaSeleccionada) productosAfectados.add(p.productoId);
  }
  return productosAfectados.size;
}

/** Suma del subtotal de devolución de las unidades seleccionadas (proporcional) */
export function selectValorDevolucionPEN(state: EnvioWizardGState): number {
  if (!state.devolucionSnapshot) return 0;
  let total = 0;
  for (const p of state.devolucionSnapshot.productos) {
    const seleccionadasEnProducto = p.unidadesIds.filter((uid) =>
      state.unidadesIdsSeleccionadas.includes(uid)
    ).length;
    if (seleccionadasEnProducto > 0 && p.cantidad > 0) {
      total += (p.subtotalDevolucion / p.cantidad) * seleccionadasEnProducto;
    }
  }
  return total;
}

export function selectTotalCostosPEN(state: EnvioWizardGState): number {
  return state.costosPEN
    .filter((c) => c.activo)
    .reduce((sum, c) => {
      if (c.metodo === 'por_unidad') {
        return sum + c.montoPEN * selectUnidadesCount(state);
      }
      return sum + c.montoPEN;
    }, 0);
}

/** Payload de unidades para crearEnvioG — lee del snapshot y selección */
export function selectUnidadesPayload(state: EnvioWizardGState) {
  if (!state.devolucionSnapshot) return [];
  const unidades: Array<{
    unidadId: string;
    productoId: string;
    sku: string;
    codigoUnidad: string;
  }> = [];
  for (const p of state.devolucionSnapshot.productos) {
    for (const uid of p.unidadesIds) {
      if (state.unidadesIdsSeleccionadas.includes(uid)) {
        unidades.push({
          unidadId: uid,
          productoId: p.productoId,
          sku: p.sku,
          codigoUnidad: uid.slice(-6).toUpperCase(),
        });
      }
    }
  }
  return unidades;
}

/** Helper usable desde consumidores externos */
export function selectMetodoProrrateoDefault(
  metodo: CostoRetornoPEN['metodo']
): MetodoProrrateo {
  return metodo === 'por_unidad' ? 'fijo_por_unidad' : 'total_por_valor';
}
