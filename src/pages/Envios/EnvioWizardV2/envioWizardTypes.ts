import type { Unidad } from '../../../types/unidad.types';
import type { MotivoEnvioInterno } from '../../../types/envio.types';

// ════════════════════════════════════════════════════════════════════════════
// Tipos de ruta específicos del wizard (Opción A — solo manual entre casillas)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Opción A del ESPEC §3.1:
 * - `casilla_casilla` = entre casillas del mismo origen (ej: Angie → Jose USA)
 * - `casilla_peru`    = cualquier casilla origen → Perú
 *
 * El tipo logístico real en Firestore siempre será `interna_origen`
 * (ambos casos se mapean ahí — el "tipo_ruta" aquí es UI-only).
 */
export type TipoRuta = 'casilla_casilla' | 'casilla_peru';

// ════════════════════════════════════════════════════════════════════════════
// Estado del wizard
// ════════════════════════════════════════════════════════════════════════════

export interface EnvioWizardState {
  // ─── Paso 1: Ruta ───
  tipoRuta: TipoRuta | null;
  origenCasillaId: string;
  origenCasillaNombre: string;
  destinoCasillaId: string;
  destinoCasillaNombre: string;
  colaboradorId: string;      // opcional
  colaboradorNombre: string;
  motivo?: MotivoEnvioInterno;

  // ─── Paso 2: Productos/Unidades ───
  unidadesDisponibles: Unidad[];         // cache de unidades en origen
  unidadesIdsSeleccionadas: string[];    // unidades seleccionadas por el usuario

  // ─── Paso 3: Confirmar ───
  numeroTracking: string;     // opcional
  courier: string;            // opcional
  notas: string;              // opcional
}

export const initialEnvioWizardState: EnvioWizardState = {
  tipoRuta: null,
  origenCasillaId: '',
  origenCasillaNombre: '',
  destinoCasillaId: '',
  destinoCasillaNombre: '',
  colaboradorId: '',
  colaboradorNombre: '',
  motivo: undefined,
  unidadesDisponibles: [],
  unidadesIdsSeleccionadas: [],
  numeroTracking: '',
  courier: '',
  notas: '',
};

// ════════════════════════════════════════════════════════════════════════════
// Actions
// ════════════════════════════════════════════════════════════════════════════

export type EnvioWizardAction =
  | { type: 'SET_TIPO_RUTA'; tipoRuta: TipoRuta }
  | { type: 'SET_ORIGEN'; id: string; nombre: string }
  | { type: 'SET_DESTINO'; id: string; nombre: string }
  | { type: 'SET_COLABORADOR'; id: string; nombre: string }
  | { type: 'SET_MOTIVO'; motivo: MotivoEnvioInterno | undefined }
  | { type: 'SET_UNIDADES_DISPONIBLES'; unidades: Unidad[] }
  | { type: 'TOGGLE_UNIDAD'; unidadId: string }
  | { type: 'TOGGLE_PRODUCTO'; productoId: string }
  | { type: 'SET_UNIDADES_SELECCIONADAS'; ids: string[] }
  | { type: 'SET_TRACKING'; tracking: string }
  | { type: 'SET_COURIER'; courier: string }
  | { type: 'SET_NOTAS'; notas: string }
  | { type: 'RESET' };

// ════════════════════════════════════════════════════════════════════════════
// Reducer
// ════════════════════════════════════════════════════════════════════════════

export function envioWizardReducer(
  state: EnvioWizardState,
  action: EnvioWizardAction
): EnvioWizardState {
  switch (action.type) {
    case 'SET_TIPO_RUTA':
      // Al cambiar tipo ruta se reinicia destino (origen se mantiene)
      return {
        ...state,
        tipoRuta: action.tipoRuta,
        destinoCasillaId: '',
        destinoCasillaNombre: '',
      };

    case 'SET_ORIGEN':
      // Al cambiar origen se reinician las unidades y selección
      return {
        ...state,
        origenCasillaId: action.id,
        origenCasillaNombre: action.nombre,
        unidadesDisponibles: [],
        unidadesIdsSeleccionadas: [],
      };

    case 'SET_DESTINO':
      return {
        ...state,
        destinoCasillaId: action.id,
        destinoCasillaNombre: action.nombre,
      };

    case 'SET_COLABORADOR':
      return {
        ...state,
        colaboradorId: action.id,
        colaboradorNombre: action.nombre,
      };

    case 'SET_MOTIVO':
      return { ...state, motivo: action.motivo };

    case 'SET_UNIDADES_DISPONIBLES':
      return { ...state, unidadesDisponibles: action.unidades };

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
      const unidadesDelProducto = state.unidadesDisponibles.filter(
        (u) => u.productoId === action.productoId
      );
      const idsDelProducto = unidadesDelProducto.map((u) => u.id);
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

    case 'SET_UNIDADES_SELECCIONADAS':
      return { ...state, unidadesIdsSeleccionadas: action.ids };

    case 'SET_TRACKING':
      return { ...state, numeroTracking: action.tracking };

    case 'SET_COURIER':
      return { ...state, courier: action.courier };

    case 'SET_NOTAS':
      return { ...state, notas: action.notas };

    case 'RESET':
      return initialEnvioWizardState;

    default:
      return state;
  }
}
