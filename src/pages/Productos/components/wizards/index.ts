/**
 * Barrel · wizards de creación del módulo Productos V2
 */
export { WizardSelector } from './WizardSelector';
export type { TipoCreacion } from './WizardSelector';

// S3.4 (2026-05-04) · WizardSimple legacy ELIMINADO · usar WizardProductoV2.
export { WizardProductoV2 } from './WizardProductoV2';

export { WizardConVariantes } from './WizardConVariantes';
export type { DatosComunes, VarianteEntry } from './WizardConVariantes';

export { WizardPack } from './WizardPack';

export { WizardVarianteExistente } from './WizardVarianteExistente';

export { SeccionColapsable } from './SeccionColapsable';
export { StepperVerticalWizard } from './StepperVerticalWizard';
export type { StepConfig, ResumenItem } from './StepperVerticalWizard';
