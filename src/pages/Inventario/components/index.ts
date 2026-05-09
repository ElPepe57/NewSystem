/**
 * Barrel · componentes page-scoped del módulo Inventario V2 (S3.6 M1 chk4)
 *
 * Estructura canónica (8 subcarpetas):
 *   shell/    → InventarioPageV2 (orquestador) · HeaderV2 · KpiStripV2 · SegmentedControl
 *   cards/    → StockProductoCard · UnidadCard
 *   detail/   → UnidadDetailsModal
 *   modals/   → PromocionModal · EditarVencimientoModal · GestionVencidasModal
 *   sections/ → AlertasInventario · AlertasPrioritarias · IncidenciasTab
 *               · InventarioAnalytics · ProductoInventarioTable · UnidadTable
 *               · UnidadesDesglose · AtencionTab · MapaTab
 *   shared/   → helpers cross-componente (vacío inicial)
 *   tools/    → utility components (vacío inicial)
 *   wizards/  → wizards de creación (vacío inicial)
 *
 * NOTA · este barrel REEMPLAZA al antiguo `src/components/modules/inventario/`
 * que fue eliminado completamente en chk5 (commits chk4.1 + chk5).
 */

// shell (chk4.2)
export { InventarioPageV2 } from './shell/InventarioPageV2';
export { HeaderV2 } from './shell/HeaderV2';
export { KpiStripV2 } from './shell/KpiStripV2';
export type { KpiStripStats } from './shell/KpiStripV2';
export { SegmentedControl } from './shell/SegmentedControl';

// cards
export { StockProductoCard } from './cards/StockProductoCard';
export { UnidadCard } from './cards/UnidadCard';

// detail
export { UnidadDetailsModal } from './detail/UnidadDetailsModal';

// modals
export { PromocionModal } from './modals/PromocionModal';
export type { PromocionData } from './modals/PromocionModal';
export { EditarVencimientoModal } from './modals/EditarVencimientoModal';
export { GestionVencidasModal } from './modals/GestionVencidasModal';

// sections
export { AlertasInventario } from './sections/AlertasInventario';
export { AlertasPrioritarias } from './sections/AlertasPrioritarias';
export type { AlertaProducto } from './sections/AlertasPrioritarias';
export { IncidenciasTab } from './sections/IncidenciasTab';
export { InventarioAnalytics } from './sections/InventarioAnalytics';
export { ProductoInventarioTable } from './sections/ProductoInventarioTable';
export type { ProductoConUnidades } from './sections/ProductoInventarioTable';
export { UnidadTable } from './sections/UnidadTable';
export { UnidadesDesglose } from './sections/UnidadesDesglose';
export { AtencionTab } from './sections/AtencionTab';
export { MapaTab } from './sections/MapaTab';
export { UnidadesListView } from './sections/UnidadesListView';
