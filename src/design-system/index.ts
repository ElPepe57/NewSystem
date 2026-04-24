/**
 * Design System — Barrel Export
 *
 * Importar todo desde aqui:
 *   import { PageShell, PageHeader, StatCard, ... } from '../../design-system';
 */

// Tokens
export * from './tokens';

// Utils
export { cn } from './utils';

// Layout
export { PageShell } from './components/PageShell';
export { PageHeader } from './components/PageHeader';
export { Toolbar } from './components/Toolbar';
export { FilterDrawer } from './components/FilterDrawer';
export { FilterSection } from './components/FilterSection';
export { ContentArea } from './components/ContentArea';

// Data Display
export { DataTable } from './components/DataTable';
export type { Column as DataTableColumn } from './components/DataTable';
export { DataCard } from './components/DataCard';
export { StatCard } from './components/StatCard';
export { KPIBar } from './components/KPIBar';
export { StatusBadge } from './components/StatusBadge';

// Forms
export { FormModal } from './components/FormModal';
export { FormField } from './components/FormField';

// ─── S41 Rework — Infra reutilizable (Bloque 0) ──────────────────────────
// Wizards multi-paso (Nueva OC, Nuevo Envío)
export { WizardShell } from './components/WizardShell';
export type { WizardStep } from './components/WizardShell';

// Selector rico de entidades (proveedor, colaborador, casilla, etc.)
export { EntityPicker } from './components/EntityPicker';
export type { EntityPickerGroup } from './components/EntityPicker';

// Visualización de ruta logística A→B→C
export { RouteVisual } from './components/RouteVisual';
export type {
  RouteNode,
  RouteSegment,
  RouteNodeType,
  RouteNodeState,
} from './components/RouteVisual';

// Cargos/descuentos/impuestos agregables dinámicamente
export { DynamicChargesSection } from './components/DynamicChargesSection';
export type {
  ChargeKind,
  DynamicChargeItem,
} from './components/DynamicChargesSection';

// Display consistente de producto con descripción rica
export { ProductoDisplay } from './components/ProductoDisplay';
export type { ProductoDisplayData } from './components/ProductoDisplay';

// Banner de borrador de wizard (autoguardado 2 capas)
export { DraftBanner, formatFechaRelativa } from './components/DraftBanner';
// Modal de confirmación al cerrar wizard con cambios sin guardar (S53.19)
export { ConfirmarSalidaWizardModal } from './components/ConfirmarSalidaWizardModal';

// ─── S52 — Capa 3: Plantillas de dominio ─────────────────────────────────
// Patrones canónicos del ERP derivados del estándar OrdenCompraCard.
// Ver `docs/DESIGN_PATTERNS.md` para documentación completa.
export * from './templates';
export * from './hooks';
