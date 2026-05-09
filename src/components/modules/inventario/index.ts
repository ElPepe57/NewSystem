/**
 * @deprecated · S3.6 M1 chk4 (2026-05-08)
 *
 * Los componentes de inventario fueron promovidos a:
 *   `src/pages/Inventario/components/`
 *
 * Subcarpetas canónicas:
 *   cards/    → StockProductoCard · UnidadCard
 *   detail/   → UnidadDetailsModal
 *   modals/   → PromocionModal · EditarVencimientoModal · GestionVencidasModal
 *   sections/ → AlertasInventario · AlertasPrioritarias · IncidenciasTab
 *               · InventarioAnalytics · ProductoInventarioTable
 *               · UnidadTable · UnidadesDesglose
 *
 * Importar desde el nuevo barrel: `import { ... } from '@/pages/Inventario/components'`
 *
 * Esta carpeta se eliminará por completo en chk5 junto con sus 2 archivos huérfanos
 * (RecepcionForm.tsx, InventarioPipeline.tsx) que NO tienen consumidores activos.
 */
export {};
