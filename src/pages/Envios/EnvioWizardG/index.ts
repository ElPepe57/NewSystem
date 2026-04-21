/**
 * EnvioWizardG — Barrel export del Wizard "Retorno físico devolución" (Caso G).
 *
 * Registra el movimiento físico cliente → almacén Perú de una devolución
 * existente. D-7: unidades quedan en revisión hasta decisión del operador.
 */

export type {
  CostoRetornoPEN,
  EnvioWizardGState,
  EnvioWizardGAction,
} from './envioWizardGTypes';
export {
  initialEnvioWizardGState,
  envioWizardGReducer,
  selectUnidadesCount,
  selectProductosCount,
  selectValorDevolucionPEN,
  selectTotalCostosPEN,
  selectUnidadesPayload,
  selectMetodoProrrateoDefault,
} from './envioWizardGTypes';

export { EnvioGStepDevolucion } from './EnvioGStepDevolucion';
export { EnvioGStepDestinoDetalles } from './EnvioGStepDestinoDetalles';
export { EnvioGStepConfirm } from './EnvioGStepConfirm';

export { WizardGPage } from './WizardGPage';
export type { WizardGPageProps } from './WizardGPage';
