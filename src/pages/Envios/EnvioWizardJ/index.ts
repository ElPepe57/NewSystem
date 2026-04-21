/**
 * EnvioWizardJ — Barrel export del Wizard "Casilla Intl → Casilla Intl" (Caso J).
 *
 * Arquitectura Design-Driven: los componentes reflejan pixel-perfect el mockup
 * `docs/mockups/wizard-j-pixel-perfect.html`.
 *
 * Fase 1 (S47 actual): tipos + reducer + selectors + servicio `crearEnvioJ`
 * Fase 2 (siguiente):  átomos nuevos (CasillaDestinoColaboradorPicker,
 *                      WarningCambioPaisBanner, VarianteJIndicator)
 * Fase 3 (siguiente):  5 pasos + WizardJPage ensamblado
 */

// ─── Tipos y reducer ────────────────────────────────────────────────────────
export type {
  VarianteCasoJ,
  EnvioWizardJState,
  EnvioWizardJAction,
} from './envioWizardJTypes';
export {
  initialEnvioWizardJState,
  envioWizardJReducer,
  selectUnidadesCount,
  selectProductosCount,
  selectPrioritariasDisponibles,
  selectPrioritariasIncluidas,
  selectPrioritariasPendientes,
  selectCTRUBaseUSD,
  selectPesoTotalLb,
  selectMontoTotalFlete,
  selectTotalCostosAdicionales,
  selectTotalLandedUSD,
} from './envioWizardJTypes';

// ─── Átomos (Fase 2) ────────────────────────────────────────────────────────
export { WarningCambioPaisBanner } from './WarningCambioPaisBanner';
export type { WarningCambioPaisBannerProps } from './WarningCambioPaisBanner';

export { VarianteJIndicator } from './VarianteJIndicator';
export type { VarianteJIndicatorProps } from './VarianteJIndicator';

export { CasillaDestinoColaboradorPicker } from './CasillaDestinoColaboradorPicker';
export type { CasillaDestinoColaboradorPickerProps } from './CasillaDestinoColaboradorPicker';

// ─── Pasos del wizard (Fase 3) ──────────────────────────────────────────────
export { EnvioJStepOrigen } from './EnvioJStepOrigen';
export { EnvioJStepDestino } from './EnvioJStepDestino';
export { EnvioJStepTransporte } from './EnvioJStepTransporte';
export { EnvioJStepCostos } from './EnvioJStepCostos';
export { EnvioJStepConfirm } from './EnvioJStepConfirm';

// ─── Contenedor principal (Fase 3) ──────────────────────────────────────────
export { WizardJPage } from './WizardJPage';
export type { WizardJPageProps } from './WizardJPage';
