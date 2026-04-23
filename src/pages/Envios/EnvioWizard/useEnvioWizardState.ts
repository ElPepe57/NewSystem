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

  // Paso 1 completo: origen + destino + al menos 1 unidad
  const paso1Completo =
    !!state.origenCategoria &&
    !!state.destinoCategoria &&
    !!tipoInferido &&
    !!state.ubicacionOrigenId &&
    !!state.ubicacionDestinoId &&
    totalUnidades > 0;

  // Paso 2 completo según tipo (se salta automático para C y J)
  const paso2Completo = (() => {
    if (!tipoConfig) return false;
    if (!tipoConfig.requiereDestinoDetalles) return true; // no aplica
    if (tipoInferido === 'E') {
      return !!state.motivo;
    }
    if (tipoInferido === 'I') {
      return !!state.referenciaTercero?.trim() && !!state.tipoRelacion;
    }
    return true;
  })();

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

  const siguientePaso = useCallback(() => {
    // Si Paso 2 es condicional y no aplica, saltarlo
    if (state.pasoActual === 1 && tipoConfig && !tipoConfig.requiereDestinoDetalles) {
      dispatch({ type: 'VALIDAR_PASO', paso: 1 });
      dispatch({ type: 'VALIDAR_PASO', paso: 2 });
      dispatch({ type: 'IR_A_PASO', paso: 3 });
      return;
    }
    dispatch({ type: 'VALIDAR_PASO', paso: state.pasoActual });
    dispatch({ type: 'SIGUIENTE_PASO' });
  }, [state.pasoActual, tipoConfig]);

  const pasoAnterior = useCallback(() => {
    // Si estamos en Paso 3 y el tipo no requiere Paso 2, saltar a Paso 1
    if (state.pasoActual === 3 && tipoConfig && !tipoConfig.requiereDestinoDetalles) {
      dispatch({ type: 'IR_A_PASO', paso: 1 });
      return;
    }
    dispatch({ type: 'PASO_ANTERIOR' });
  }, [state.pasoActual, tipoConfig]);

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
