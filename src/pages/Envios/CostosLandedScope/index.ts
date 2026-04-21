/**
 * CostosLandedScope — Barrel export del módulo S46.
 *
 * Componentes para gestionar costos landed con scope (envío/tanda) y cierre
 * financiero (D-17, D-18).
 *
 * Fase 2 (actual): 3 átomos
 * Fase 3: compuesto CostosLandedPanel
 */

export { CostoLandedRow } from './CostoLandedRow';
export type { CostoLandedRowProps } from './CostoLandedRow';

export { AgregarCostoLandedModal } from './AgregarCostoLandedModal';
export type {
  AgregarCostoLandedModalProps,
  AgregarCostoLandedModalResult,
} from './AgregarCostoLandedModal';

export { FinalizarCostosModal } from './FinalizarCostosModal';
export type { FinalizarCostosModalProps } from './FinalizarCostosModal';

// Compuesto (Fase 3)
export { CostosLandedPanel } from './CostosLandedPanel';
export type { CostosLandedPanelProps } from './CostosLandedPanel';
