/**
 * EnvioWizardJ — Tipos y reducer del Wizard "Casilla Internacional → Casilla Internacional"
 *
 * Caso J del Modelo Envíos Transversal (ver `docs/MODELO_ENVIOS_TRANSVERSAL.md`).
 * Wizard manual de 5 pasos: Origen → Destino → Transporte → Costos → Confirmar.
 *
 * Diferencias clave vs. Wizard T2 (S44):
 *   - Paso 1 (Origen): casilla cualquier país (no solo USA). Sin consulta de OCs —
 *     el picking opera sobre el stock disponible en la casilla.
 *   - Paso 2 (Destino): casilla internacional (NO almacén Perú) + selector variante
 *     J1/J2 + warning intra-país (D-9).
 *   - Paso 3 (Transporte): en J1 el default es el propio colaborador origen.
 *   - Paso 4 (Costos): reutiliza `EnvioT2StepCostos` sin cambios.
 *   - Paso 5 (Confirmar): reutiliza `EnvioT2StepConfirm` con adaptador de contexto.
 *
 * Decisiones aplicadas:
 *  - D-8: casos I/J como envíos entre nodos
 *  - D-9: intra-país preferente (warning si cambia país)
 *  - D-15: envío J nace en estado 'borrador'
 *  - D-17/D-18: mismo modelo de costos landed que T2
 */

import type { Unidad } from '../../../types/unidad.types';
import type { PresetTarifa, CostoAdicionalT2, TipoTransporteT2 } from '../EnvioWizardT2';

// ════════════════════════════════════════════════════════════════════════════
// Tipos auxiliares específicos del Caso J
// ════════════════════════════════════════════════════════════════════════════

/** Variante del Caso J (D-8) */
export type VarianteCasoJ = 'J1' | 'J2';

// ════════════════════════════════════════════════════════════════════════════
// State shape del wizard
// ════════════════════════════════════════════════════════════════════════════

export interface EnvioWizardJState {
  // ─── Paso 1: Origen ───
  casillaOrigenId: string;
  casillaOrigenNombre: string;
  casillaOrigenPais: string;
  /** Colaborador dueño de la casilla origen (precargado al seleccionar casilla) */
  colaboradorOrigenId: string;
  colaboradorOrigenNombre: string;

  // ─── Paso 2: Destino ───
  casillaDestinoId: string;
  casillaDestinoNombre: string;
  casillaDestinoPais: string;
  /** Colaborador dueño de la casilla destino (precargado) */
  colaboradorDestinoId: string;
  colaboradorDestinoNombre: string;
  /** Variante J1/J2 derivada: J1 si colaboradorOrigen === colaboradorDestino */
  variante: VarianteCasoJ;
  /** D-9: flag auditable cuando origenPais !== destinoPais */
  advertenciaCambioPais: boolean;

  // ─── Paso Picking (unidades) ───
  /** Cache de unidades disponibles en la casilla origen */
  unidadesDisponibles: Unidad[];
  /** Unidades seleccionadas por el usuario */
  unidadesIdsSeleccionadas: string[];
  /** Checkbox "Incluir pre-vendidas automáticamente" */
  incluirPrevendidasAuto: boolean;

  // ─── Paso 3: Transporte ───
  tipoTransporte: TipoTransporteT2 | null;
  colaboradorTransporteId: string;
  colaboradorTransporteNombre: string;
  colaboradorTarifaBaseUSD: number;
  colaboradorMetodoBase: PresetTarifa | null;
  numeroTracking: string;

  // ─── Paso 4: Costos landed ───
  presetTarifa: PresetTarifa;
  montoTotalFlete: number;
  tarifaPorUnidad: number;
  tarifaVariablePorProducto: Record<string, number>;
  tipoCambio: number;
  costosAdicionales: CostoAdicionalT2[];

  // ─── Paso 5: Confirmar ───
  notas: string;

  // ─── Metadata del wizard ───
  pasoActual: number;
  ultimoPasoValidado: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Estado inicial
// ════════════════════════════════════════════════════════════════════════════

export const initialEnvioWizardJState: EnvioWizardJState = {
  casillaOrigenId: '',
  casillaOrigenNombre: '',
  casillaOrigenPais: '',
  colaboradorOrigenId: '',
  colaboradorOrigenNombre: '',

  casillaDestinoId: '',
  casillaDestinoNombre: '',
  casillaDestinoPais: '',
  colaboradorDestinoId: '',
  colaboradorDestinoNombre: '',
  variante: 'J1',
  advertenciaCambioPais: false,

  unidadesDisponibles: [],
  unidadesIdsSeleccionadas: [],
  incluirPrevendidasAuto: true,

  tipoTransporte: null,
  colaboradorTransporteId: '',
  colaboradorTransporteNombre: '',
  colaboradorTarifaBaseUSD: 0,
  colaboradorMetodoBase: null,
  numeroTracking: '',

  presetTarifa: 'monto_total',
  montoTotalFlete: 0,
  tarifaPorUnidad: 0,
  tarifaVariablePorProducto: {},
  tipoCambio: 0,
  costosAdicionales: [],

  notas: '',

  pasoActual: 0,
  ultimoPasoValidado: 0,
};

// ════════════════════════════════════════════════════════════════════════════
// Actions
// ════════════════════════════════════════════════════════════════════════════

export type EnvioWizardJAction =
  // Navegación
  | { type: 'GO_TO_STEP'; paso: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  // Paso 1 (Origen)
  | {
      type: 'SET_ORIGEN';
      casillaId: string;
      casillaNombre: string;
      pais: string;
      colaboradorId: string;
      colaboradorNombre: string;
    }
  // Paso 2 (Destino)
  | {
      type: 'SET_DESTINO';
      casillaId: string;
      casillaNombre: string;
      pais: string;
      colaboradorId: string;
      colaboradorNombre: string;
    }
  // Picking
  | { type: 'SET_UNIDADES_DISPONIBLES'; unidades: Unidad[] }
  | { type: 'TOGGLE_UNIDAD'; unidadId: string }
  | { type: 'TOGGLE_PRODUCTO'; productoId: string }
  | { type: 'SET_CANTIDAD_PRODUCTO'; productoId: string; cantidad: number }
  | { type: 'SET_INCLUIR_PREVENDIDAS_AUTO'; incluir: boolean }
  | { type: 'APLICAR_PRIORITARIAS' }
  // Paso 3 (Transporte)
  | { type: 'SET_TIPO_TRANSPORTE'; tipo: TipoTransporteT2 }
  | {
      type: 'SET_COLABORADOR_TRANSPORTE';
      id: string;
      nombre: string;
      tarifaBaseUSD?: number;
      metodoBase?: PresetTarifa;
    }
  | { type: 'SET_TRACKING'; tracking: string }
  // Paso 4 (Costos)
  | { type: 'SET_PRESET_TARIFA'; preset: PresetTarifa }
  | { type: 'SET_MONTO_TOTAL_FLETE'; monto: number }
  | { type: 'SET_TARIFA_POR_UNIDAD'; monto: number }
  | { type: 'SET_TARIFA_VARIABLE'; productoId: string; monto: number }
  | { type: 'SET_TIPO_CAMBIO'; tc: number }
  | { type: 'AGREGAR_COSTO_ADICIONAL'; costo: CostoAdicionalT2 }
  | { type: 'EDITAR_COSTO_ADICIONAL'; id: string; updates: Partial<CostoAdicionalT2> }
  | { type: 'ELIMINAR_COSTO_ADICIONAL'; id: string }
  // Paso 5
  | { type: 'SET_NOTAS'; notas: string }
  // Reset / hidratación
  | { type: 'RESET' }
  | { type: 'HYDRATE'; state: Partial<EnvioWizardJState> };

// ════════════════════════════════════════════════════════════════════════════
// Reducer
// ════════════════════════════════════════════════════════════════════════════

export function envioWizardJReducer(
  state: EnvioWizardJState,
  action: EnvioWizardJAction
): EnvioWizardJState {
  switch (action.type) {
    // ─── Navegación ───
    case 'GO_TO_STEP':
      return { ...state, pasoActual: Math.max(0, Math.min(4, action.paso)) };

    case 'NEXT_STEP': {
      const siguiente = Math.min(4, state.pasoActual + 1);
      return {
        ...state,
        pasoActual: siguiente,
        ultimoPasoValidado: Math.max(state.ultimoPasoValidado, siguiente),
      };
    }

    case 'PREV_STEP':
      return { ...state, pasoActual: Math.max(0, state.pasoActual - 1) };

    // ─── Paso 1: Origen ───
    case 'SET_ORIGEN':
      // Al cambiar origen se resetean unidades y picking (y también el destino
      // si era igual al nuevo origen — no tiene sentido origen===destino)
      return {
        ...state,
        casillaOrigenId: action.casillaId,
        casillaOrigenNombre: action.casillaNombre,
        casillaOrigenPais: action.pais,
        colaboradorOrigenId: action.colaboradorId,
        colaboradorOrigenNombre: action.colaboradorNombre,
        unidadesDisponibles: [],
        unidadesIdsSeleccionadas: [],
        // Si el destino actual coincide con el nuevo origen, limpiarlo
        ...(state.casillaDestinoId === action.casillaId
          ? {
              casillaDestinoId: '',
              casillaDestinoNombre: '',
              casillaDestinoPais: '',
              colaboradorDestinoId: '',
              colaboradorDestinoNombre: '',
              advertenciaCambioPais: false,
              variante: 'J1' as VarianteCasoJ,
            }
          : {
              // Recalcula advertencia y variante con el nuevo origen
              advertenciaCambioPais:
                !!state.casillaDestinoPais && state.casillaDestinoPais !== action.pais,
              variante:
                action.colaboradorId === state.colaboradorDestinoId ? 'J1' : 'J2',
            }),
      };

    // ─── Paso 2: Destino ───
    case 'SET_DESTINO': {
      const variante: VarianteCasoJ =
        action.colaboradorId === state.colaboradorOrigenId ? 'J1' : 'J2';
      const advertenciaCambioPais =
        !!state.casillaOrigenPais && state.casillaOrigenPais !== action.pais;
      return {
        ...state,
        casillaDestinoId: action.casillaId,
        casillaDestinoNombre: action.casillaNombre,
        casillaDestinoPais: action.pais,
        colaboradorDestinoId: action.colaboradorId,
        colaboradorDestinoNombre: action.colaboradorNombre,
        variante,
        advertenciaCambioPais,
        // J1: pre-selecciona al colaborador origen como transportador default
        ...(variante === 'J1' && !state.colaboradorTransporteId
          ? {
              colaboradorTransporteId: state.colaboradorOrigenId,
              colaboradorTransporteNombre: state.colaboradorOrigenNombre,
            }
          : {}),
      };
    }

    // ─── Picking ───
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
      // Stepper con FIFO priorizado (idéntico a T2)
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

    // ─── Paso 3: Transporte ───
    case 'SET_TIPO_TRANSPORTE':
      return {
        ...state,
        tipoTransporte: action.tipo,
        colaboradorTransporteId: '',
        colaboradorTransporteNombre: '',
        colaboradorTarifaBaseUSD: 0,
        colaboradorMetodoBase: null,
      };

    case 'SET_COLABORADOR_TRANSPORTE': {
      const tarifa = action.tarifaBaseUSD ?? 0;
      const metodo = action.metodoBase ?? null;
      return {
        ...state,
        colaboradorTransporteId: action.id,
        colaboradorTransporteNombre: action.nombre,
        colaboradorTarifaBaseUSD: tarifa,
        colaboradorMetodoBase: metodo,
        presetTarifa: metodo || state.presetTarifa,
        montoTotalFlete: metodo === 'monto_total' ? tarifa : state.montoTotalFlete,
        tarifaPorUnidad: metodo === 'por_unidad' ? tarifa : state.tarifaPorUnidad,
      };
    }

    case 'SET_TRACKING':
      return { ...state, numeroTracking: action.tracking };

    // ─── Paso 4: Costos ───
    case 'SET_PRESET_TARIFA':
      return { ...state, presetTarifa: action.preset };

    case 'SET_MONTO_TOTAL_FLETE':
      return { ...state, montoTotalFlete: action.monto };

    case 'SET_TARIFA_POR_UNIDAD':
      return { ...state, tarifaPorUnidad: action.monto };

    case 'SET_TARIFA_VARIABLE':
      return {
        ...state,
        tarifaVariablePorProducto: {
          ...state.tarifaVariablePorProducto,
          [action.productoId]: action.monto,
        },
      };

    case 'SET_TIPO_CAMBIO':
      return { ...state, tipoCambio: action.tc };

    case 'AGREGAR_COSTO_ADICIONAL':
      return {
        ...state,
        costosAdicionales: [...state.costosAdicionales, action.costo],
      };

    case 'EDITAR_COSTO_ADICIONAL':
      return {
        ...state,
        costosAdicionales: state.costosAdicionales.map((c) =>
          c.id === action.id ? { ...c, ...action.updates } : c
        ),
      };

    case 'ELIMINAR_COSTO_ADICIONAL':
      return {
        ...state,
        costosAdicionales: state.costosAdicionales.filter((c) => c.id !== action.id),
      };

    // ─── Paso 5 ───
    case 'SET_NOTAS':
      return { ...state, notas: action.notas };

    // ─── Reset / Hidratación ───
    case 'RESET':
      return initialEnvioWizardJState;

    case 'HYDRATE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Selectors (derivados útiles — reutilizan patrón del Wizard T2)
// ════════════════════════════════════════════════════════════════════════════

export function selectUnidadesCount(state: EnvioWizardJState): number {
  return state.unidadesIdsSeleccionadas.length;
}

export function selectProductosCount(state: EnvioWizardJState): number {
  const productosIds = new Set(
    state.unidadesDisponibles
      .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
      .map((u) => u.productoId)
  );
  return productosIds.size;
}

export function selectPrioritariasDisponibles(state: EnvioWizardJState): Unidad[] {
  return state.unidadesDisponibles.filter((u) => !!u.reservadaPara);
}

export function selectPrioritariasIncluidas(state: EnvioWizardJState): number {
  return state.unidadesDisponibles.filter(
    (u) => !!u.reservadaPara && state.unidadesIdsSeleccionadas.includes(u.id)
  ).length;
}

export function selectPrioritariasPendientes(state: EnvioWizardJState): number {
  const total = selectPrioritariasDisponibles(state).length;
  const incluidas = selectPrioritariasIncluidas(state);
  return total - incluidas;
}

export function selectCTRUBaseUSD(state: EnvioWizardJState): number {
  return state.unidadesDisponibles
    .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
    .reduce((sum, u) => sum + (u.ctruDinamico ?? u.costoUnitarioUSD ?? 0), 0);
}

export function selectPesoTotalLb(
  state: EnvioWizardJState,
  pesosPorProducto: Record<string, number>
): number {
  return state.unidadesDisponibles
    .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
    .reduce((sum, u) => sum + (pesosPorProducto[u.productoId] ?? 0), 0);
}

export function selectMontoTotalFlete(state: EnvioWizardJState): number {
  switch (state.presetTarifa) {
    case 'monto_total':
      return state.montoTotalFlete;
    case 'por_unidad':
      return state.tarifaPorUnidad * selectUnidadesCount(state);
    case 'variable': {
      const seleccionadas = state.unidadesDisponibles.filter((u) =>
        state.unidadesIdsSeleccionadas.includes(u.id)
      );
      return seleccionadas.reduce(
        (sum, u) => sum + (state.tarifaVariablePorProducto[u.productoId] ?? 0),
        0
      );
    }
    default:
      return 0;
  }
}

export function selectTotalCostosAdicionales(state: EnvioWizardJState): number {
  return state.costosAdicionales
    .filter((c) => c.activo)
    .reduce((sum, c) => sum + c.monto, 0);
}

export function selectTotalLandedUSD(state: EnvioWizardJState): number {
  return selectMontoTotalFlete(state) + selectTotalCostosAdicionales(state);
}
