/**
 * Barrel · FiltrosBar componible (canon F3 v7.0)
 *
 * Promovidos desde pages/Productos/components/filters/ a design-system/ en
 * S3.6 M1 chk3 (2026-05-07). Reutilizables por cualquier módulo que necesite
 * filtros canónicos.
 *
 * NOTA: useProductosFilters.ts permanece page-scoped en Productos por ser
 * lógica específica de su dominio. Cada módulo crea su propio useXFilters.
 */
export { PillsRapidos } from './PillsRapidos';
export type { PillKey, PillCounts } from './PillsRapidos';

export { FiltrosBar } from './FiltrosBar';
export type {
  ChipGroupConfig,
  ChipOption,
  DateRangePreset,
  SortOption,
  LeadingFilterConfig,
  LeadingFilterOption,
  LeadingFilterOptionGroup,
} from './FiltrosBar';

export { ChipsActivos } from './ChipsActivos';
export type { ChipActivo, ChipColor } from './ChipsActivos';

export { FiltrosDrawerMobile } from './FiltrosDrawerMobile';

export { BulkActionsToolbar } from './BulkActionsToolbar';

export { PaginacionFooter } from './PaginacionFooter';
export { OrdenamientoSelect, type SortKey, type PageSize } from './OrdenamientoSelect';
