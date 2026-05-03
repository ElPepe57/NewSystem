/**
 * Barrel · filtros del módulo Productos V2
 */
export { PillsRapidos } from './PillsRapidos';
export type { PillKey, PillCounts } from './PillsRapidos';

export { FiltrosBar } from './FiltrosBar';
export type { ChipGroupConfig, ChipOption, DateRangePreset, SortOption } from './FiltrosBar';

export { ChipsActivos } from './ChipsActivos';
export type { ChipActivo, ChipColor } from './ChipsActivos';

export { FiltrosDrawerMobile } from './FiltrosDrawerMobile';

export { BulkActionsToolbar } from './BulkActionsToolbar';

export { useProductosFilters, DEFAULT_FILTROS } from './useProductosFilters';

export { PaginacionFooter } from './PaginacionFooter';
export { OrdenamientoSelect, type SortKey, type PageSize } from './OrdenamientoSelect';
