/**
 * Types + reducer del Wizard de Envíos Unificado (S52 · S53 F1)
 *
 * Reemplaza los 4 reducers separados de EnvioWizardT2/J/E/I.
 * Shape unificado que soporta los 4 tipos (C, J, E, I) con campos
 * específicos opcionales según el tipo inferido del Paso 1.
 *
 * El tipo se INFIERE del par (origenTipo, destinoTipo) via `useTipoInferido`.
 * El usuario nunca ve siglas técnicas ("T2", "C", "J").
 */
import type { MotivoEnvioInterno } from '../../../types/envio.types';
import type { TramoPeso } from '../../../types/colaborador.types';

// ============================================================================
// Tipos primitivos
// ============================================================================

/** Tipo inferido del envío según par origen+destino (Paso 1) */
export type TipoInferido = 'C' | 'J' | 'E' | 'I';

/** Categoría de origen (Paso 1, sub-sección [1]) */
export type OrigenCategoria = 'casilla_intl' | 'almacen_peru';

/** Categoría de destino (Paso 1, sub-sección [2]) */
export type DestinoCategoria = 'casilla_intl' | 'almacen_peru' | 'almacen_tercero';

/** Modo de transporte (afecta icono del sidebar y validaciones) */
export type ModoTransporte = 'aereo' | 'maritimo' | 'terrestre';

/** Tipo de transportador disponible según tipo inferido */
export type TipoTransportador = 'viajero' | 'courier_internacional' | 'transportista_local';

/** Modalidad de cálculo de costos (Paso 3) */
export type ModalidadCosto =
  | 'flete_total'      // Usuario ingresa monto total fijo
  | 'tarifa_unidad'    // $ × uds (costo por unidad uniforme)
  | 'por_producto'     // Tabla variable (costo distinto por SKU)
  | 'por_tramos';      // D-11: escalonado por peso (lb)

/** Tipo de relación comercial con tercero (tipo I) */
export type TipoRelacionTercero = 'fulfillment' | 'consignacion' | 'distribucion' | 'otro';

// ============================================================================
// Sub-types de state
// ============================================================================

/** Unidad seleccionada en el picker del Paso 1 */
export interface UnidadSeleccionadaWizard {
  unidadId: string;
  productoId: string;
  sku: string;
  codigoUnidad: string;
  productoNombre: string;
  pesoLibras?: number;
  /** `true` si la unidad tiene `reservadaPara` definido (pre-vendida) */
  esPrevendida?: boolean;
  /** Para productos agrupables: cuántas unidades del mismo SKU se incluyen */
  cantidadSeleccionada: number;
  /** Cuántas hay disponibles en la ubicación origen */
  cantidadDisponible: number;
}

/** Costo variable por producto (modalidad 'por_producto') */
export interface CostoPorProducto {
  productoId: string;
  /** Costo unitario en USD (o PEN según tipo) */
  costoUnitario: number;
}

// ============================================================================
// State principal
// ============================================================================

export interface EnvioWizardState {
  // ---- Paso 1 · Origen ----
  origenCategoria: OrigenCategoria | null;
  ubicacionOrigenId: string;
  ubicacionOrigenNombre: string;      // desnormalizado para sidebar
  ubicacionOrigenPais: string;        // desnormalizado

  // ---- Paso 1 · Destino ----
  destinoCategoria: DestinoCategoria | null;
  ubicacionDestinoId: string;
  ubicacionDestinoNombre: string;
  ubicacionDestinoPais: string;

  // ---- Paso 1 · Unidades ----
  unidadesSeleccionadas: UnidadSeleccionadaWizard[];
  /** Checkbox "incluir automáticamente pre-vendidas" (default true) */
  incluirPrevendidas: boolean;
  /** Buscador de productos en el Paso 1 sección [3] */
  busquedaUnidades: string;

  // ---- Paso 2 · Destino detalles (condicional E/I) ----
  motivo?: MotivoEnvioInterno;            // solo E
  motivoDetalle?: string;                 // solo E
  referenciaTercero?: string;             // solo I
  tipoRelacion?: TipoRelacionTercero;     // solo I
  /** D-9 · flag auditable para tipo J cuando origen y destino están en países distintos */
  advertenciaCambioPais: boolean;

  // ---- Paso 3 · Logística ----
  tipoTransportador: TipoTransportador | null;
  colaboradorTransporteId: string;
  colaboradorTransporteNombre: string;    // desnormalizado para sidebar
  modoTransporte: ModoTransporte;         // para icono sidebar ✈️/🚢/🚚
  numeroTracking: string;

  // ---- Paso 3 · Costos ----
  modalidadCosto: ModalidadCosto;
  /** Modalidad 'flete_total' · monto global ingresado */
  costoFleteTotalUSD: number;
  /** Modalidad 'tarifa_unidad' · costo por unidad */
  costoPorUnidadUSD: number;
  /** Modalidad 'por_producto' · costo distinto por SKU */
  costosPorProducto: CostoPorProducto[];
  /** Modalidad 'por_tramos' · tabla escalonada (auto-cargada del colaborador) */
  tramosPeso: TramoPeso[];
  /** TC auto-poblado desde sección TC del sistema (D-10) */
  tipoCambio: number;
  /** `true` si el usuario overrideo manualmente el TC (auditable) */
  tipoCambioOverride: boolean;

  // ---- Paso 4 · Confirmar ----
  notas: string;

  // ---- Metadata ----
  pasoActual: number;
  ultimoPasoValidado: number;
  /** Estado de submit: 'idle' | 'saving' | 'error' */
  estadoSubmit: 'idle' | 'saving' | 'error';
  errorSubmit?: string;
}

// ============================================================================
// Estado inicial
// ============================================================================

export const initialEnvioWizardState: EnvioWizardState = {
  origenCategoria: null,
  ubicacionOrigenId: '',
  ubicacionOrigenNombre: '',
  ubicacionOrigenPais: '',
  destinoCategoria: null,
  ubicacionDestinoId: '',
  ubicacionDestinoNombre: '',
  ubicacionDestinoPais: '',
  unidadesSeleccionadas: [],
  incluirPrevendidas: true,
  busquedaUnidades: '',
  advertenciaCambioPais: false,
  tipoTransportador: null,
  colaboradorTransporteId: '',
  colaboradorTransporteNombre: '',
  modoTransporte: 'aereo',
  numeroTracking: '',
  modalidadCosto: 'flete_total',
  costoFleteTotalUSD: 0,
  costoPorUnidadUSD: 0,
  costosPorProducto: [],
  tramosPeso: [],
  tipoCambio: 0,
  tipoCambioOverride: false,
  notas: '',
  pasoActual: 1,
  ultimoPasoValidado: 0,
  estadoSubmit: 'idle',
};

// ============================================================================
// Actions del reducer
// ============================================================================

export type EnvioWizardAction =
  // Paso 1 · Origen
  | { type: 'SET_ORIGEN_CATEGORIA'; categoria: OrigenCategoria | null }
  | {
      type: 'SET_UBICACION_ORIGEN';
      id: string;
      nombre: string;
      pais: string;
    }
  // Paso 1 · Destino
  | { type: 'SET_DESTINO_CATEGORIA'; categoria: DestinoCategoria | null }
  | {
      type: 'SET_UBICACION_DESTINO';
      id: string;
      nombre: string;
      pais: string;
    }
  // Paso 1 · Unidades
  | { type: 'TOGGLE_UNIDAD'; unidad: UnidadSeleccionadaWizard }
  | { type: 'SET_CANTIDAD_UNIDAD'; productoId: string; cantidad: number }
  | { type: 'SET_INCLUIR_PREVENDIDAS'; incluir: boolean }
  | { type: 'SET_BUSQUEDA_UNIDADES'; query: string }
  | { type: 'RESET_UNIDADES' }
  // Paso 2 · Destino detalles
  | { type: 'SET_MOTIVO'; motivo: MotivoEnvioInterno | undefined }
  | { type: 'SET_MOTIVO_DETALLE'; detalle: string }
  | { type: 'SET_REFERENCIA_TERCERO'; referencia: string }
  | { type: 'SET_TIPO_RELACION'; relacion: TipoRelacionTercero | undefined }
  | { type: 'SET_ADVERTENCIA_CAMBIO_PAIS'; flag: boolean }
  // Paso 3 · Logística
  | { type: 'SET_TIPO_TRANSPORTADOR'; tipo: TipoTransportador | null }
  | {
      type: 'SET_COLABORADOR_TRANSPORTE';
      id: string;
      nombre: string;
      tramosPreset?: TramoPeso[];
    }
  | { type: 'SET_MODO_TRANSPORTE'; modo: ModoTransporte }
  | { type: 'SET_TRACKING'; tracking: string }
  // Paso 3 · Costos
  | { type: 'SET_MODALIDAD_COSTO'; modalidad: ModalidadCosto }
  | { type: 'SET_COSTO_FLETE_TOTAL'; monto: number }
  | { type: 'SET_COSTO_POR_UNIDAD'; monto: number }
  | {
      type: 'SET_COSTO_POR_PRODUCTO';
      productoId: string;
      costoUnitario: number;
    }
  | { type: 'SET_TRAMOS_PESO'; tramos: TramoPeso[] }
  | { type: 'SET_TIPO_CAMBIO'; tc: number; override?: boolean }
  // Paso 4
  | { type: 'SET_NOTAS'; notas: string }
  // Navegación
  | { type: 'SIGUIENTE_PASO' }
  | { type: 'PASO_ANTERIOR' }
  | { type: 'IR_A_PASO'; paso: number }
  | { type: 'VALIDAR_PASO'; paso: number }
  // Submit
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'SUBMIT_SUCCESS' }
  // Reset
  | { type: 'RESET' };

// ============================================================================
// Reducer
// ============================================================================

export function envioWizardReducer(
  state: EnvioWizardState,
  action: EnvioWizardAction
): EnvioWizardState {
  switch (action.type) {
    case 'SET_ORIGEN_CATEGORIA':
      // Cambiar categoría resetea la ubicación específica y las unidades
      return {
        ...state,
        origenCategoria: action.categoria,
        ubicacionOrigenId: '',
        ubicacionOrigenNombre: '',
        ubicacionOrigenPais: '',
        unidadesSeleccionadas: [],
      };

    case 'SET_UBICACION_ORIGEN':
      // Cambiar ubicación resetea unidades (las disponibles dependen del origen)
      return {
        ...state,
        ubicacionOrigenId: action.id,
        ubicacionOrigenNombre: action.nombre,
        ubicacionOrigenPais: action.pais,
        unidadesSeleccionadas: [],
      };

    case 'SET_DESTINO_CATEGORIA':
      return {
        ...state,
        destinoCategoria: action.categoria,
        ubicacionDestinoId: '',
        ubicacionDestinoNombre: '',
        ubicacionDestinoPais: '',
        // Limpiar campos específicos del destino cuando cambia categoría
        motivo: undefined,
        motivoDetalle: undefined,
        referenciaTercero: undefined,
        tipoRelacion: undefined,
      };

    case 'SET_UBICACION_DESTINO': {
      // Detectar D-9: cambio de país para tipo J
      const cambioPais =
        state.origenCategoria === 'casilla_intl' &&
        action.pais !== '' &&
        state.ubicacionOrigenPais !== '' &&
        state.ubicacionOrigenPais !== action.pais;
      return {
        ...state,
        ubicacionDestinoId: action.id,
        ubicacionDestinoNombre: action.nombre,
        ubicacionDestinoPais: action.pais,
        advertenciaCambioPais: cambioPais,
      };
    }

    case 'TOGGLE_UNIDAD': {
      const existe = state.unidadesSeleccionadas.find(
        u => u.productoId === action.unidad.productoId
      );
      if (existe) {
        return {
          ...state,
          unidadesSeleccionadas: state.unidadesSeleccionadas.filter(
            u => u.productoId !== action.unidad.productoId
          ),
        };
      }
      return {
        ...state,
        unidadesSeleccionadas: [...state.unidadesSeleccionadas, action.unidad],
      };
    }

    case 'SET_CANTIDAD_UNIDAD': {
      const existe = state.unidadesSeleccionadas.find(
        u => u.productoId === action.productoId
      );
      if (!existe) return state;
      if (action.cantidad <= 0) {
        return {
          ...state,
          unidadesSeleccionadas: state.unidadesSeleccionadas.filter(
            u => u.productoId !== action.productoId
          ),
        };
      }
      const cantidadFinal = Math.min(action.cantidad, existe.cantidadDisponible);
      return {
        ...state,
        unidadesSeleccionadas: state.unidadesSeleccionadas.map(u =>
          u.productoId === action.productoId
            ? { ...u, cantidadSeleccionada: cantidadFinal }
            : u
        ),
      };
    }

    case 'SET_INCLUIR_PREVENDIDAS':
      return { ...state, incluirPrevendidas: action.incluir };

    case 'SET_BUSQUEDA_UNIDADES':
      return { ...state, busquedaUnidades: action.query };

    case 'RESET_UNIDADES':
      return { ...state, unidadesSeleccionadas: [] };

    case 'SET_MOTIVO':
      return { ...state, motivo: action.motivo };

    case 'SET_MOTIVO_DETALLE':
      return { ...state, motivoDetalle: action.detalle };

    case 'SET_REFERENCIA_TERCERO':
      return { ...state, referenciaTercero: action.referencia };

    case 'SET_TIPO_RELACION':
      return { ...state, tipoRelacion: action.relacion };

    case 'SET_ADVERTENCIA_CAMBIO_PAIS':
      return { ...state, advertenciaCambioPais: action.flag };

    case 'SET_TIPO_TRANSPORTADOR':
      // Cambiar tipo resetea colaborador y tramos
      return {
        ...state,
        tipoTransportador: action.tipo,
        colaboradorTransporteId: '',
        colaboradorTransporteNombre: '',
        tramosPeso: [],
      };

    case 'SET_COLABORADOR_TRANSPORTE':
      return {
        ...state,
        colaboradorTransporteId: action.id,
        colaboradorTransporteNombre: action.nombre,
        // Auto-cargar tramos preset del colaborador si existen (D-11)
        tramosPeso: action.tramosPreset || [],
      };

    case 'SET_MODO_TRANSPORTE':
      return { ...state, modoTransporte: action.modo };

    case 'SET_TRACKING':
      return { ...state, numeroTracking: action.tracking };

    case 'SET_MODALIDAD_COSTO':
      return { ...state, modalidadCosto: action.modalidad };

    case 'SET_COSTO_FLETE_TOTAL':
      return { ...state, costoFleteTotalUSD: action.monto };

    case 'SET_COSTO_POR_UNIDAD':
      return { ...state, costoPorUnidadUSD: action.monto };

    case 'SET_COSTO_POR_PRODUCTO': {
      const existe = state.costosPorProducto.find(
        c => c.productoId === action.productoId
      );
      if (existe) {
        return {
          ...state,
          costosPorProducto: state.costosPorProducto.map(c =>
            c.productoId === action.productoId
              ? { ...c, costoUnitario: action.costoUnitario }
              : c
          ),
        };
      }
      return {
        ...state,
        costosPorProducto: [
          ...state.costosPorProducto,
          { productoId: action.productoId, costoUnitario: action.costoUnitario },
        ],
      };
    }

    case 'SET_TRAMOS_PESO':
      return { ...state, tramosPeso: action.tramos };

    case 'SET_TIPO_CAMBIO':
      return {
        ...state,
        tipoCambio: action.tc,
        tipoCambioOverride: action.override ?? state.tipoCambioOverride,
      };

    case 'SET_NOTAS':
      return { ...state, notas: action.notas };

    case 'SIGUIENTE_PASO':
      return { ...state, pasoActual: Math.min(state.pasoActual + 1, 4) };

    case 'PASO_ANTERIOR':
      return { ...state, pasoActual: Math.max(state.pasoActual - 1, 1) };

    case 'IR_A_PASO':
      return { ...state, pasoActual: action.paso };

    case 'VALIDAR_PASO':
      return {
        ...state,
        ultimoPasoValidado: Math.max(state.ultimoPasoValidado, action.paso),
      };

    case 'SUBMIT_START':
      return { ...state, estadoSubmit: 'saving', errorSubmit: undefined };

    case 'SUBMIT_ERROR':
      return { ...state, estadoSubmit: 'error', errorSubmit: action.error };

    case 'SUBMIT_SUCCESS':
      return { ...state, estadoSubmit: 'idle' };

    case 'RESET':
      return initialEnvioWizardState;

    default:
      return state;
  }
}

// ============================================================================
// Selectors (derivan datos del state)
// ============================================================================

/** Total de unidades seleccionadas (suma de cantidades) */
export function selectTotalUnidades(state: EnvioWizardState): number {
  return state.unidadesSeleccionadas.reduce(
    (sum, u) => sum + u.cantidadSeleccionada,
    0
  );
}

/** Total de SKUs distintos seleccionados */
export function selectTotalSKUs(state: EnvioWizardState): number {
  return state.unidadesSeleccionadas.length;
}

/** Total de unidades pre-vendidas seleccionadas */
export function selectTotalPrevendidas(state: EnvioWizardState): number {
  return state.unidadesSeleccionadas
    .filter(u => u.esPrevendida)
    .reduce((sum, u) => sum + u.cantidadSeleccionada, 0);
}

/**
 * Encuentra el tramo de peso aplicable a un peso dado.
 * Retorna `null` si no hay tramos o si ningún tramo matchea.
 */
export function encontrarTramoPorPeso(
  tramos: TramoPeso[],
  peso: number
): TramoPeso | null {
  for (const tramo of tramos) {
    const matchDesde = peso >= tramo.pesoDesde;
    const matchHasta = tramo.pesoHasta === null || peso < tramo.pesoHasta;
    if (matchDesde && matchHasta) return tramo;
  }
  return null;
}

/**
 * Calcula el total del flete según la modalidad seleccionada.
 * Aproximación: los cálculos refinados con validaciones van en F3.
 */
export function selectTotalFleteUSD(state: EnvioWizardState): number {
  const totalUds = selectTotalUnidades(state);

  switch (state.modalidadCosto) {
    case 'flete_total':
      return state.costoFleteTotalUSD;

    case 'tarifa_unidad':
      return state.costoPorUnidadUSD * totalUds;

    case 'por_producto':
      return state.unidadesSeleccionadas.reduce((sum, u) => {
        const costo = state.costosPorProducto.find(
          c => c.productoId === u.productoId
        );
        return sum + (costo?.costoUnitario || 0) * u.cantidadSeleccionada;
      }, 0);

    case 'por_tramos':
      return state.unidadesSeleccionadas.reduce((sum, u) => {
        if (!u.pesoLibras || state.tramosPeso.length === 0) return sum;
        const tramo = encontrarTramoPorPeso(state.tramosPeso, u.pesoLibras);
        return sum + (tramo?.costoUnitario || 0) * u.cantidadSeleccionada;
      }, 0);

    default:
      return 0;
  }
}
