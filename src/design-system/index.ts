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
// S58 Fase 1 — Modal banking-grade (header rico + atajos + auto-save banner)
// Se usa por modal en lugar de FormModal (migración progresiva).
export { FormModalV2 } from './components/FormModalV2';
export type {
  FormModalV2Props,
  FormModalV2SubmitVariant,
  FormModalV2AutoSaveStatus,
} from './components/FormModalV2';
// S58 Fase 2 — Inputs avanzados banking-grade
// (TextField · MoneyField · DateField · ToggleGroup · Combobox · ValidationSummary)
export * from './components/forms';

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

// S54 — Tarjeta de ruta V2 (pill modalidad arriba + 2/3 nodos grandes).
// Patrón unificado entre detalle de OC y detalle de Envío.
export { RouteCardV2, getFlagFromPais } from './components/RouteCardV2';
export type {
  RouteCardV2Node,
  RouteCardV2Pill,
  RouteCardV2Props,
  RouteCardV2PillVariant,
  RouteNodeBadgeVariant,
  RouteCardV2Pipeline,
  RouteCardV2PipelineStep,
  RouteCardV2PipelineStepStatus,
} from './components/RouteCardV2';

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
// S3.6 M1 chk2 · Banner canónico unificado (consolida BorradorOC/Envio/Producto)
export { BorradorBanner } from './components/BorradorBanner';

// ─── S3.6 M1 · Componentes Maestros canónicos (promovidos desde Productos) ─
// MaestroSelect (single value · marca · tipo de producto)
// MaestroChipsMulti (multi value · categorías · etiquetas)
// FloatingDropdown (portaleado · escapa overflow del modal contenedor)
// ChipsCerrados (vocabulario cerrado · atributos por línea)
export * from './components/maestros';

// ─── S52 — Capa 3: Plantillas de dominio ─────────────────────────────────
// Patrones canónicos del ERP derivados del estándar OrdenCompraCard.
// Ver `docs/DESIGN_PATTERNS.md` para documentación completa.
export * from './templates';
export * from './hooks';
