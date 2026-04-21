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
