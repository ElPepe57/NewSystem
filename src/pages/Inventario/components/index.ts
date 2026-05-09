/**
 * Barrel · componentes page-scoped del módulo Inventario V2 (S3.6 M1 chk4)
 *
 * Estructura canónica (8 subcarpetas):
 *   shell/    → orquestador InventarioPageV2 + tabs (chk4.2)
 *   cards/    → StockProductoCard · UnidadCard
 *   detail/   → UnidadDetailsModal
 *   modals/   → PromocionModal · EditarVencimientoModal · GestionVencidasModal
 *   sections/ → AlertasInventario · AlertasPrioritarias · IncidenciasTab
 *               · InventarioAnalytics · ProductoInventarioTable
 *               · UnidadTable · UnidadesDesglose
 *   shared/   → helpers cross-componente (vacío inicial)
 *   tools/    → utility components (vacío inicial)
 *   wizards/  → wizards de creación (vacío inicial)
 *
 * NOTA · este barrel REEMPLAZA al antiguo `src/components/modules/inventario/index.ts`
 * que será eliminado en chk5 junto con sus 2 huérfanos (RecepcionForm, InventarioPipeline).
 */

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
