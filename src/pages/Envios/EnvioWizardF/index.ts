/**
 * EnvioWizardF — Barrel export del Wizard "Despacho venta → cliente" (Caso F).
 *
 * Absorbe Ventas logística bajo el hub unificado de Envíos (D-1).
 */

export type {
  CostoPENDespacho,
  EnvioWizardFState,
  EnvioWizardFAction,
} from './envioWizardFTypes';
export {
  initialEnvioWizardFState,
  envioWizardFReducer,
  selectUnidadesCount,
  selectProductosCount,
  selectUnidadesReservadasVenta,
  selectTotalCostosPEN,
  selectValorVentaPEN,
} from './envioWizardFTypes';

export { EnvioFStepVenta } from './EnvioFStepVenta';
export { EnvioFStepPicking } from './EnvioFStepPicking';
export { EnvioFStepDetalles } from './EnvioFStepDetalles';
export { EnvioFStepConfirm } from './EnvioFStepConfirm';

export { WizardFPage } from './WizardFPage';
export type { WizardFPageProps } from './WizardFPage';
