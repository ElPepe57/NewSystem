/**
 * EnvioWizardI — Barrel export del Wizard "Almacén propio → Almacén tercero" (Caso I).
 *
 * D-10: stock bloqueado hasta retornar a Perú o liquidar en el tercero.
 */

export type {
  TipoRelacionTercero,
  CostoEnvioI,
  EnvioWizardIState,
  EnvioWizardIAction,
} from './envioWizardITypes';
export {
  initialEnvioWizardIState,
  envioWizardIReducer,
  selectUnidadesCount,
  selectProductosCount,
  selectCTRUBaseUSD,
  selectTotalCostosUSD,
  selectTotalCostosPEN,
} from './envioWizardITypes';

export { EnvioIStepOrigen } from './EnvioIStepOrigen';
export { EnvioIStepTercero } from './EnvioIStepTercero';
export { EnvioIStepDetalles } from './EnvioIStepDetalles';
export { EnvioIStepConfirm } from './EnvioIStepConfirm';

export { WizardIPage } from './WizardIPage';
export type { WizardIPageProps } from './WizardIPage';
