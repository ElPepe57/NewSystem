/**
 * useEnvioWizardState — Hook central del Wizard de Envíos Unificado.
 *
 * Envuelve useReducer + expone selectors y dispatch tipado.
 * Todos los steps consumen este hook (single source of truth).
 */
import { useReducer, useCallback } from 'react';
import {
  envioWizardReducer,
  initialEnvioWizardState,
  type EnvioWizardState,
  type EnvioWizardAction,
  selectTotalUnidades,
  selectTotalSKUs,
  selectTotalPrevendidas,
  selectTotalFleteUSD,
} from './envioWizardTypes';
import { inferirTipo } from './useTipoInferido';
import { getTipoConfig } from './registry';

export interface UseEnvioWizardStateReturn {
  state: EnvioWizardState;
  dispatch: React.Dispatch<EnvioWizardAction>;
  // Derivados del tipo inferido
  tipoInferido: ReturnType<typeof inferirTipo>;
  tipoConfig: ReturnType<typeof getTipoConfig>;
  // Selectors
  totalUnidades: number;
  totalSKUs: number;
  totalPrevendidas: number;
  totalFleteUSD: number;
  // Validaciones de paso
  paso1Completo: boolean;
  paso2Completo: boolean;
  paso3Completo: boolean;
  puedeAvanzar: boolean;
  // Helpers de navegación
  siguientePaso: () => void;
  pasoAnterior: () => void;
  irAPaso: (paso: number) => void;
  reset: () => void;
}

export function useEnvioWizardState(): UseEnvioWizardStateReturn {
  const [state, dispatch] = useReducer(
    envioWizardReducer,
    initialEnvioWizardState
  );

  const tipoInferido = inferirTipo(state.origenCategoria, state.destinoCategoria);
  const tipoConfig = getTipoConfig(tipoInferido);

  const totalUnidades = selectTotalUnidades(state);
  const totalSKUs = selectTotalSKUs(state);
  const totalPrevendidas = selectTotalPrevendidas(state);
  const totalFleteUSD = selectTotalFleteUSD(state);

  // Paso 1 · RUTA completo (rework 3b): origen + destino + (detalles del destino si el
  // tipo lo requiere · E/I). Las UNIDADES ya no se validan acá — viven en el Paso 2.
  const paso1Completo =
    !!state.origenCategoria &&
    !!state.destinoCategoria &&
    !!tipoInferido &&
    !!state.ubicacionOrigenId &&
    !!state.ubicacionDestinoId &&
    (() => {
      if (!tipoConfig?.requiereDestinoDetalles) return true; // no aplica (C/J)
      if (tipoInferido === 'E') return !!state.motivo;
      if (tipoInferido === 'I') return !!state.referenciaTercero?.trim() && !!state.tipoRelacion;
      return true;
    })();

  // Paso 2 · UNIDADES completo: al menos 1 unidad seleccionada.
  const paso2Completo = totalUnidades > 0;

  // Paso 3 completo: transportador + modalidad con valor consistente
  const paso3Completo = (() => {
    if (!state.tipoTransportador) return false;
    if (!state.colaboradorTransporteId) return false;
    // Los costos son opcionales por D-17 (cierre operativo ≠ financiero)
    // Solo validamos que la modalidad elegida tenga datos mínimos si ingresó algo.
    return true;
  })();

  const puedeAvanzar = (() => {
    if (state.pasoActual === 1) return paso1Completo;
    if (state.pasoActual === 2) return paso2Completo;
    if (state.pasoActual === 3) return paso3Completo;
    return true; // Paso 4 es confirmar, siempre puede avanzar (el botón es Crear)
  })();

  // Rework 3b: sin auto-skip. Los 4 pasos son fijos (Ruta · Unidades · Logística ·
  // Confirmar) · los "detalles del destino" condicionales se pliegan dentro de Ruta.
  const siguientePaso = useCallback(() => {
    dispatch({ type: 'VALIDAR_PASO', paso: state.pasoActual });
    dispatch({ type: 'SIGUIENTE_PASO' });
  }, [state.pasoActual]);

  const pasoAnterior = useCallback(() => {
    dispatch({ type: 'PASO_ANTERIOR' });
  }, []);

  const irAPaso = useCallback((paso: number) => {
    dispatch({ type: 'IR_A_PASO', paso });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    dispatch,
    tipoInferido,
    tipoConfig,
    totalUnidades,
    totalSKUs,
    totalPrevendidas,
    totalFleteUSD,
    paso1Completo,
    paso2Completo,
    paso3Completo,
    puedeAvanzar,
    siguientePaso,
    pasoAnterior,
    irAPaso,
    reset,
  };
}
