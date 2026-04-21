/**
 * EnvioWizardT2 — Barrel export del Wizard "Casilla → Perú" (Caso C).
 *
 * Importar desde aquí:
 *   import { WizardT2Page, UnidadPickerItem } from '../EnvioWizardT2';
 *
 * Arquitectura Design-Driven: los componentes reflejan pixel-perfect el mockup
 * `docs/mockups/wizard-t2-pixel-perfect.html`.
 *
 * Fase 1 (S44 actual): átomos + tipos
 * Fase 2 (siguiente):  compuestos (ProductoPickingGroup, EnvioT2WizardPreview)
 * Fase 3 (siguiente):  5 pasos + WizardT2Page ensamblado
 */

// ─── Tipos y reducer ────────────────────────────────────────────────────────
export type {
  TipoTransporteT2,
  PresetTarifa,
  CostoAdicionalT2,
  EnvioWizardT2State,
  EnvioWizardT2Action,
} from './envioWizardT2Types';
export {
  initialEnvioWizardT2State,
  envioWizardT2Reducer,
  // Selectors
  selectUnidadesCount,
  selectProductosCount,
  selectOCsCount,
  selectPrioritariasDisponibles,
  selectPrioritariasIncluidas,
  selectPrioritariasPendientes,
  selectCTRUBaseUSD,
  selectPesoTotalLb,
  selectMontoTotalFlete,
  selectTotalCostosAdicionales,
  selectTotalLandedUSD,
} from './envioWizardT2Types';

// ─── Átomos (Fase 1) ────────────────────────────────────────────────────────
export { UnidadPickerItem } from './UnidadPickerItem';
export type { UnidadPickerItemProps } from './UnidadPickerItem';

export { BannerPriorizacion } from './BannerPriorizacion';
export type { BannerPriorizacionProps } from './BannerPriorizacion';

export { TarifaPresetSelector } from './TarifaPresetSelector';
export type { TarifaPresetSelectorProps } from './TarifaPresetSelector';

export { ColaboradorTransporteCard } from './ColaboradorTransporteCard';
export type { ColaboradorTransporteCardProps } from './ColaboradorTransporteCard';

export { CTRULandedPreview } from './CTRULandedPreview';
export type {
  CTRULandedPreviewProps,
  CTRULandedPreviewFila,
} from './CTRULandedPreview';

// ─── Compuestos (Fase 2) ────────────────────────────────────────────────────
export { ProductoPickingGroup } from './ProductoPickingGroup';
export type {
  ProductoPickingGroupProps,
  ProductoPickingGroupUnidad,
} from './ProductoPickingGroup';

export { EnvioT2WizardPreview } from './EnvioT2WizardPreview';
export type { EnvioT2WizardPreviewProps } from './EnvioT2WizardPreview';
