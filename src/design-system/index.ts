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
export { DataCard } from './components/DataCard';
export { StatCard } from './components/StatCard';
export { KPIBar } from './components/KPIBar';
export { StatusBadge } from './components/StatusBadge';

// Forms
export { FormModal } from './components/FormModal';
export { FormField } from './components/FormField';
