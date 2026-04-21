/**
 * EnvioWizardE — Barrel export del Wizard "Traslado interno Perú ↔ Perú" (Caso E).
 *
 * Caso E del Modelo Envíos Transversal · absorbe el concepto legacy de
 * Transferencias internas bajo el hub unificado de Envíos (D-1).
 *
 * Fase 1 (S48): tipos + reducer + servicio crearEnvioE + flag WIZARD_E
 * Fase 2 (S48): 4 pasos del wizard (sin átomos nuevos — reusa T2)
 * Fase 3 (S48): ruta + botón de acceso
 */

// ─── Tipos y reducer ────────────────────────────────────────────────────────
export type {
  CostoPENItem,
  EnvioWizardEState,
  EnvioWizardEAction,
} from './envioWizardETypes';
export {
  initialEnvioWizardEState,
  envioWizardEReducer,
  selectUnidadesCount,
  selectProductosCount,
  selectPrioritariasDisponibles,
  selectPrioritariasIncluidas,
  selectCTRUBaseUSD,
  selectTotalCostosPEN,
} from './envioWizardETypes';

// ─── Pasos del wizard ───────────────────────────────────────────────────────
export { EnvioEStepOrigen } from './EnvioEStepOrigen';
export { EnvioEStepDestino } from './EnvioEStepDestino';
export { EnvioEStepDetalles } from './EnvioEStepDetalles';
export { EnvioEStepConfirm } from './EnvioEStepConfirm';

// ─── Contenedor principal ───────────────────────────────────────────────────
export { WizardEPage } from './WizardEPage';
export type { WizardEPageProps } from './WizardEPage';
