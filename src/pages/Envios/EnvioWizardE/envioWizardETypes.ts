/**
 * EnvioWizardE — Tipos y reducer del Wizard "Traslado interno Almacén Perú ↔ Almacén Perú"
 *
 * Caso E del Modelo Envíos Transversal. Wizard manual de 4 pasos:
 *   Origen (+picking) → Destino (+motivo) → Detalles (transporte+costos) → Confirmar
 *
 * Diferencias clave vs. T2/J:
 *   - Todo en PEN (sin USD, sin TC, sin diferencial cambiario)
 *   - Sin aduana, sin advertencia cambio país (siempre intra-Perú)
 *   - Motivo obligatorio (consolidación / capacidad / costo_menor / otro)
 *   - Colaborador transporte opcional (traslado interno puede no tener costo)
 *
 * Decisiones aplicadas:
 *   - D-1 (Envios = hub que absorbe Transferencias)
 *   - D-15 (Caso E nace en 'borrador')
 */

import type { Unidad } from '../../../types/unidad.types';
import type { MotivoEnvioInterno } from '../../../types/envio.types';

// ════════════════════════════════════════════════════════════════════════════
// Tipos auxiliares específicos del Caso E
// ════════════════════════════════════════════════════════════════════════════

/** Costo en PEN capturado en el wizard (flete local, peaje, combustible, etc.) */
export interface CostoPENItem {
  id: string;
  concepto: string;
  metodo: 'monto_total' | 'por_unidad';
  montoPEN: number;
  activo: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// State shape del wizard
// ════════════════════════════════════════════════════════════════════════════

export interface EnvioWizardEState {
  // ─── Paso 1: Origen + Picking ───
  almacenOrigenId: string;
  almacenOrigenNombre: string;

  unidadesDisponibles: Unidad[];
  unidadesIdsSeleccionadas: string[];
  incluirPrevendidasAuto: boolean;

  // ─── Paso 2: Destino + Motivo ───
  almacenDestinoId: string;
  almacenDestinoNombre: string;
  motivo: MotivoEnvioInterno | '';
  motivoDetalle: string;

  // ─── Paso 3: Transporte + Costos ───
  colaboradorTransporteId: string;
  colaboradorTransporteNombre: string;
  numeroTracking: string;
  /** Costos adicionales en PEN (al menos 0, hasta N) */
  costosPEN: CostoPENItem[];

  // ─── Paso 4: Confirmar ───
  notas: string;

  // ─── Metadata del wizard ───
  pasoActual: number;
  ultimoPasoValidado: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Estado inicial
// ════════════════════════════════════════════════════════════════════════════

export const initialEnvioWizardEState: EnvioWizardEState = {
  almacenOrigenId: '',
  almacenOrigenNombre: '',

  unidadesDisponibles: [],
  unidadesIdsSeleccionadas: [],
  incluirPrevendidasAuto: true,

  almacenDestinoId: '',
  almacenDestinoNombre: '',
  motivo: '',
  motivoDetalle: '',

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

export type EnvioWizardEAction =
  // Navegación
  | { type: 'GO_TO_STEP'; paso: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  // Paso 1 (Origen + Picking)
  | { type: 'SET_ORIGEN'; almacenId: string; almacenNombre: string }
  | { type: 'SET_UNIDADES_DISPONIBLES'; unidades: Unidad[] }
  | { type: 'TOGGLE_UNIDAD'; unidadId: string }
  | { type: 'TOGGLE_PRODUCTO'; productoId: string }
  | { type: 'SET_CANTIDAD_PRODUCTO'; productoId: string; cantidad: number }
  | { type: 'SET_INCLUIR_PREVENDIDAS_AUTO'; incluir: boolean }
  | { type: 'APLICAR_PRIORITARIAS' }
  // Paso 2 (Destino + Motivo)
  | { type: 'SET_DESTINO'; almacenId: string; almacenNombre: string }
  | { type: 'SET_MOTIVO'; motivo: MotivoEnvioInterno }
  | { type: 'SET_MOTIVO_DETALLE'; detalle: string }
  // Paso 3 (Transporte + Costos)
  | { type: 'SET_COLABORADOR_TRANSPORTE'; id: string; nombre: string }
  | { type: 'SET_TRACKING'; tracking: string }
  | { type: 'AGREGAR_COSTO_PEN'; costo: CostoPENItem }
  | { type: 'EDITAR_COSTO_PEN'; id: string; updates: Partial<CostoPENItem> }
  | { type: 'ELIMINAR_COSTO_PEN'; id: string }
  // Paso 4
  | { type: 'SET_NOTAS'; notas: string }
  // Reset / Hidratación
  | { type: 'RESET' }
  | { type: 'HYDRATE'; state: Partial<EnvioWizardEState> };

// ════════════════════════════════════════════════════════════════════════════
// Reducer
// ════════════════════════════════════════════════════════════════════════════

export function envioWizardEReducer(
  state: EnvioWizardEState,
  action: EnvioWizardEAction
): EnvioWizardEState {
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

    // ─── Paso 1 ───
    case 'SET_ORIGEN':
      return {
        ...state,
        almacenOrigenId: action.almacenId,
        almacenOrigenNombre: action.almacenNombre,
        unidadesDisponibles: [],
        unidadesIdsSeleccionadas: [],
        // Si destino coincide con nuevo origen, limpiarlo
        ...(state.almacenDestinoId === action.almacenId
          ? { almacenDestinoId: '', almacenDestinoNombre: '' }
          : {}),
      };

    case 'SET_UNIDADES_DISPONIBLES': {
      const idsPrioritarias = state.incluirPrevendidasAuto
        ? action.unidades.filter((u) => !!u.reservadaPara).map((u) => u.id)
        : [];
      return {
        ...state,
        unidadesDisponibles: action.unidades,
        unidadesIdsSeleccionadas: idsPrioritarias,
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
      // FIFO priorizado (igual patrón que T2/J)
      const unidadesProducto = state.unidadesDisponibles.filter(
        (u) => u.productoId === action.productoId
      );
      const ordenadas = [...unidadesProducto].sort((a, b) => {
        const aPrio = a.reservadaPara ? 1 : 0;
        const bPrio = b.reservadaPara ? 1 : 0;
        if (aPrio !== bPrio) return bPrio - aPrio;
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

    case 'SET_INCLUIR_PREVENDIDAS_AUTO':
      return { ...state, incluirPrevendidasAuto: action.incluir };

    case 'APLICAR_PRIORITARIAS': {
      const idsPrioritarias = state.unidadesDisponibles
        .filter((u) => !!u.reservadaPara)
        .map((u) => u.id);
      return {
        ...state,
        unidadesIdsSeleccionadas: Array.from(
          new Set([...state.unidadesIdsSeleccionadas, ...idsPrioritarias])
        ),
      };
    }

    // ─── Paso 2 ───
    case 'SET_DESTINO':
      return {
        ...state,
        almacenDestinoId: action.almacenId,
        almacenDestinoNombre: action.almacenNombre,
      };

    case 'SET_MOTIVO':
      return {
        ...state,
        motivo: action.motivo,
        // Limpiar detalle si el motivo no es 'otro'
        ...(action.motivo !== 'otro' ? { motivoDetalle: '' } : {}),
      };

    case 'SET_MOTIVO_DETALLE':
      return { ...state, motivoDetalle: action.detalle };

    // ─── Paso 3 ───
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

    // ─── Paso 4 ───
    case 'SET_NOTAS':
      return { ...state, notas: action.notas };

    // ─── Reset / Hidratación ───
    case 'RESET':
      return initialEnvioWizardEState;

    case 'HYDRATE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Selectors
// ════════════════════════════════════════════════════════════════════════════

export function selectUnidadesCount(state: EnvioWizardEState): number {
  return state.unidadesIdsSeleccionadas.length;
}

export function selectProductosCount(state: EnvioWizardEState): number {
  const ids = new Set(
    state.unidadesDisponibles
      .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
      .map((u) => u.productoId)
  );
  return ids.size;
}

export function selectPrioritariasDisponibles(state: EnvioWizardEState): Unidad[] {
  return state.unidadesDisponibles.filter((u) => !!u.reservadaPara);
}

export function selectPrioritariasIncluidas(state: EnvioWizardEState): number {
  return state.unidadesDisponibles.filter(
    (u) => !!u.reservadaPara && state.unidadesIdsSeleccionadas.includes(u.id)
  ).length;
}

/** CTRU base total en USD (suma del costo unitario de las unidades, referencia) */
export function selectCTRUBaseUSD(state: EnvioWizardEState): number {
  return state.unidadesDisponibles
    .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
    .reduce((sum, u) => sum + (u.ctruDinamico ?? u.costoUnitarioUSD ?? 0), 0);
}

/** Total de costos PEN activos (flete + peaje + combustible + ...) */
export function selectTotalCostosPEN(state: EnvioWizardEState): number {
  return state.costosPEN
    .filter((c) => c.activo)
    .reduce((sum, c) => {
      if (c.metodo === 'por_unidad') {
        return sum + c.montoPEN * selectUnidadesCount(state);
      }
      return sum + c.montoPEN;
    }, 0);
}
