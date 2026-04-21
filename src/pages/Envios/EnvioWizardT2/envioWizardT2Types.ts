/**
 * EnvioWizardT2 — Tipos y reducer del wizard "Casilla Internacional → Almacén Perú"
 *
 * Caso C del modelo Envíos Transversal (ver `docs/MODELO_ENVIOS_TRANSVERSAL.md`).
 * Wizard manual de 5 pasos: Origen → Picking → Transporte → Costos → Confirmar.
 *
 * Design-Driven: este state shape nace del mockup
 * `docs/mockups/wizard-t2-pixel-perfect.html`.
 *
 * Decisiones aplicadas:
 *  - D-5/D-14: priorización de pre-vendidas via `Unidad.reservadaPara`
 *  - D-13: 5 pasos (Origen / Picking / Transporte / Costos / Confirmar)
 *  - D-15: envío T2 nace en estado `borrador`
 *  - D-17: costos con estado `estimado` | `confirmado` (timing flexible)
 *  - D-18: en S44 TODOS los costos son `scope='envio'` implícito (sin tanda)
 */

import type { Unidad } from '../../../types/unidad.types';

// ════════════════════════════════════════════════════════════════════════════
// Tipos auxiliares
// ════════════════════════════════════════════════════════════════════════════

/** Tipo de transporte del envío T2 */
export type TipoTransporteT2 = 'viajero' | 'courier';

/** Preset de tarifa del colaborador (D-18 simplificado a 3 presets) */
export type PresetTarifa =
  | 'monto_total'    // Das el total, sistema prorratea por peso
  | 'por_unidad'     // $X × uds, cada unidad paga igual
  | 'variable';      // Tabla por producto (tarifas distintas por SKU)

/** Costo adicional del envío (ej. fee de recepción, otros) */
export interface CostoAdicionalT2 {
  id: string;
  concepto: string;
  metodo: 'monto_total' | 'por_unidad' | 'por_valor';
  monto: number;
  activo: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// State shape del wizard
// ════════════════════════════════════════════════════════════════════════════

export interface EnvioWizardT2State {
  // ─── Paso 1: Origen ───
  casillaOrigenId: string;
  casillaOrigenNombre: string;
  casillaOrigenPais: string;

  // ─── Paso 2: Picking ───
  /** Cache de unidades disponibles en la casilla origen (estado `disponible`) */
  unidadesDisponibles: Unidad[];
  /** Unidades seleccionadas por el usuario */
  unidadesIdsSeleccionadas: string[];
  /** Checkbox "Incluir pre-vendidas automáticamente" — afecta selección inicial */
  incluirPrevendidasAuto: boolean;

  // ─── Paso 3: Transporte ───
  tipoTransporte: TipoTransporteT2 | null;
  colaboradorId: string;
  colaboradorNombre: string;
  /** Tarifa base del colaborador en USD (viene de su configuración) */
  colaboradorTarifaBaseUSD: number;
  /** Método de tarifa base del colaborador (para prellenar preset) */
  colaboradorMetodoBase: PresetTarifa | null;
  numeroTracking: string;
  almacenDestinoId: string;
  almacenDestinoNombre: string;

  // ─── Paso 4: Costos landed ───
  presetTarifa: PresetTarifa;
  /** Para preset 'monto_total': el total directo en USD */
  montoTotalFlete: number;
  /** Para preset 'por_unidad': tarifa por unidad en USD */
  tarifaPorUnidad: number;
  /** Para preset 'variable': mapa productoId → tarifa unitaria en USD */
  tarifaVariablePorProducto: Record<string, number>;
  /** Tipo de cambio PEN/USD para prorrateo a moneda local */
  tipoCambio: number;
  /** Costos adicionales (fee recepción, colaborador casilla, etc.) */
  costosAdicionales: CostoAdicionalT2[];

  // ─── Paso 5: Confirmar ───
  notas: string;

  // ─── Metadata del wizard ───
  /** Paso actual (0-based) */
  pasoActual: number;
  /** Último paso validado — para permitir saltos con clicks en stepper */
  ultimoPasoValidado: number;
}

// ════════════════════════════════════════════════════════════════════════════
// Estado inicial
// ════════════════════════════════════════════════════════════════════════════

export const initialEnvioWizardT2State: EnvioWizardT2State = {
  // Paso 1
  casillaOrigenId: '',
  casillaOrigenNombre: '',
  casillaOrigenPais: '',

  // Paso 2
  unidadesDisponibles: [],
  unidadesIdsSeleccionadas: [],
  incluirPrevendidasAuto: true,

  // Paso 3
  tipoTransporte: null,
  colaboradorId: '',
  colaboradorNombre: '',
  colaboradorTarifaBaseUSD: 0,
  colaboradorMetodoBase: null,
  numeroTracking: '',
  almacenDestinoId: '',
  almacenDestinoNombre: '',

  // Paso 4
  presetTarifa: 'monto_total',
  montoTotalFlete: 0,
  tarifaPorUnidad: 0,
  tarifaVariablePorProducto: {},
  tipoCambio: 0,
  costosAdicionales: [],

  // Paso 5
  notas: '',

  // Metadata
  pasoActual: 0,
  ultimoPasoValidado: 0,
};

// ════════════════════════════════════════════════════════════════════════════
// Actions
// ════════════════════════════════════════════════════════════════════════════

export type EnvioWizardT2Action =
  // Navegación
  | { type: 'GO_TO_STEP'; paso: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  // Paso 1
  | { type: 'SET_ORIGEN'; id: string; nombre: string; pais: string }
  // Paso 2
  | { type: 'SET_UNIDADES_DISPONIBLES'; unidades: Unidad[] }
  | { type: 'TOGGLE_UNIDAD'; unidadId: string }
  | { type: 'TOGGLE_PRODUCTO'; productoId: string }
  | { type: 'SET_CANTIDAD_PRODUCTO'; productoId: string; cantidad: number }
  | { type: 'SET_INCLUIR_PREVENDIDAS_AUTO'; incluir: boolean }
  | { type: 'APLICAR_PRIORITARIAS' }
  // Paso 3
  | { type: 'SET_TIPO_TRANSPORTE'; tipo: TipoTransporteT2 }
  | {
      type: 'SET_COLABORADOR';
      id: string;
      nombre: string;
      tarifaBaseUSD?: number;
      metodoBase?: PresetTarifa;
    }
  | { type: 'SET_TRACKING'; tracking: string }
  | { type: 'SET_ALMACEN_DESTINO'; id: string; nombre: string }
  // Paso 4
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
  // Reset / hidratación desde borrador
  | { type: 'RESET' }
  | { type: 'HYDRATE'; state: Partial<EnvioWizardT2State> };

// ════════════════════════════════════════════════════════════════════════════
// Reducer
// ════════════════════════════════════════════════════════════════════════════

export function envioWizardT2Reducer(
  state: EnvioWizardT2State,
  action: EnvioWizardT2Action
): EnvioWizardT2State {
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

    // ─── Paso 1 ───
    case 'SET_ORIGEN':
      // Al cambiar de casilla, se resetean unidades y picking
      return {
        ...state,
        casillaOrigenId: action.id,
        casillaOrigenNombre: action.nombre,
        casillaOrigenPais: action.pais,
        unidadesDisponibles: [],
        unidadesIdsSeleccionadas: [],
      };

    // ─── Paso 2 ───
    case 'SET_UNIDADES_DISPONIBLES': {
      // Si incluirPrevendidasAuto === true, pre-selecciona las unidades con `reservadaPara`
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
      // Stepper agregado por producto con FIFO priorizado (D-2 Opción C)
      //  - Primero las pre-vendidas (reservadaPara)
      //  - Luego las más antiguas (fechaRecepcion asc)
      const unidadesProducto = state.unidadesDisponibles.filter(
        (u) => u.productoId === action.productoId
      );
      // Ordenar: prioritarias primero, luego FIFO
      const ordenadas = [...unidadesProducto].sort((a, b) => {
        const aPrio = a.reservadaPara ? 1 : 0;
        const bPrio = b.reservadaPara ? 1 : 0;
        if (aPrio !== bPrio) return bPrio - aPrio; // prioritarias primero
        // FIFO: fechaRecepcion ascendente (más antigua primero)
        const aFecha = a.fechaRecepcion?.toMillis?.() ?? 0;
        const bFecha = b.fechaRecepcion?.toMillis?.() ?? 0;
        return aFecha - bFecha;
      });
      const cantidad = Math.max(0, Math.min(action.cantidad, ordenadas.length));
      const idsAIncluir = new Set(ordenadas.slice(0, cantidad).map((u) => u.id));
      const idsDelProducto = new Set(unidadesProducto.map((u) => u.id));
      // Mantener las selecciones de otros productos + aplicar las del producto actual
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
      // Agrega todas las prioritarias no incluidas aún
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

    // ─── Paso 3 ───
    case 'SET_TIPO_TRANSPORTE':
      // Cambiar tipo resetea colaborador (filtra por tipo)
      return {
        ...state,
        tipoTransporte: action.tipo,
        colaboradorId: '',
        colaboradorNombre: '',
        colaboradorTarifaBaseUSD: 0,
        colaboradorMetodoBase: null,
      };

    case 'SET_COLABORADOR': {
      const tarifa = action.tarifaBaseUSD ?? 0;
      const metodo = action.metodoBase ?? null;
      return {
        ...state,
        colaboradorId: action.id,
        colaboradorNombre: action.nombre,
        colaboradorTarifaBaseUSD: tarifa,
        colaboradorMetodoBase: metodo,
        // Prellena el preset según el método base del colaborador (si existe)
        presetTarifa: metodo || state.presetTarifa,
        // Prellena el monto según el método
        montoTotalFlete:
          metodo === 'monto_total' ? tarifa : state.montoTotalFlete,
        tarifaPorUnidad:
          metodo === 'por_unidad' ? tarifa : state.tarifaPorUnidad,
      };
    }

    case 'SET_TRACKING':
      return { ...state, numeroTracking: action.tracking };

    case 'SET_ALMACEN_DESTINO':
      return {
        ...state,
        almacenDestinoId: action.id,
        almacenDestinoNombre: action.nombre,
      };

    // ─── Paso 4 ───
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
      return initialEnvioWizardT2State;

    case 'HYDRATE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Selectors (derivados útiles para los componentes)
// ════════════════════════════════════════════════════════════════════════════

/** Cuenta unidades seleccionadas */
export function selectUnidadesCount(state: EnvioWizardT2State): number {
  return state.unidadesIdsSeleccionadas.length;
}

/** Cuenta productos únicos en la selección */
export function selectProductosCount(state: EnvioWizardT2State): number {
  const productosIds = new Set(
    state.unidadesDisponibles
      .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
      .map((u) => u.productoId)
  );
  return productosIds.size;
}

/** Cuenta OCs distintas en la selección */
export function selectOCsCount(state: EnvioWizardT2State): number {
  const ocsIds = new Set(
    state.unidadesDisponibles
      .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
      .map((u) => u.ordenCompraId)
      .filter(Boolean)
  );
  return ocsIds.size;
}

/** Unidades prioritarias disponibles (tienen `reservadaPara`) */
export function selectPrioritariasDisponibles(state: EnvioWizardT2State): Unidad[] {
  return state.unidadesDisponibles.filter((u) => !!u.reservadaPara);
}

/** Prioritarias ya incluidas en la selección */
export function selectPrioritariasIncluidas(state: EnvioWizardT2State): number {
  return state.unidadesDisponibles.filter(
    (u) => !!u.reservadaPara && state.unidadesIdsSeleccionadas.includes(u.id)
  ).length;
}

/** Prioritarias pendientes de incluir */
export function selectPrioritariasPendientes(state: EnvioWizardT2State): number {
  const total = selectPrioritariasDisponibles(state).length;
  const incluidas = selectPrioritariasIncluidas(state);
  return total - incluidas;
}

/** Suma del CTRU base (sin landed) de las unidades seleccionadas */
export function selectCTRUBaseUSD(state: EnvioWizardT2State): number {
  return state.unidadesDisponibles
    .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
    .reduce((sum, u) => sum + (u.ctruDinamico ?? u.costoUnitarioUSD ?? 0), 0);
}

/**
 * Peso total de las unidades seleccionadas en libras.
 *
 * NOTA: `Unidad` no desnormaliza `pesoLibras` — vive en `Producto`. El caller
 * debe proveer el mapping `productoId → pesoLibras` (típicamente desde
 * productoStore). Si un producto no está en el mapping se asume peso 0.
 *
 * Uso:
 *   const pesos = useProductoStore(s => s.getPesosMap());  // Record<string, number>
 *   const pesoTotal = selectPesoTotalLb(state, pesos);
 */
export function selectPesoTotalLb(
  state: EnvioWizardT2State,
  pesosPorProducto: Record<string, number>
): number {
  return state.unidadesDisponibles
    .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
    .reduce((sum, u) => sum + (pesosPorProducto[u.productoId] ?? 0), 0);
}

/** Calcula el monto total de flete según preset */
export function selectMontoTotalFlete(state: EnvioWizardT2State): number {
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

/** Suma de costos adicionales activos */
export function selectTotalCostosAdicionales(state: EnvioWizardT2State): number {
  return state.costosAdicionales
    .filter((c) => c.activo)
    .reduce((sum, c) => sum + c.monto, 0);
}

/** Total landed (flete + adicionales) en USD */
export function selectTotalLandedUSD(state: EnvioWizardT2State): number {
  return selectMontoTotalFlete(state) + selectTotalCostosAdicionales(state);
}
