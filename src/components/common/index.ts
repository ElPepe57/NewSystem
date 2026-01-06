export { Button } from './Button';
export { Input } from './Input';
export { Card } from './Card';
export { Badge } from './Badge';
export { Modal, ModalFooter } from './Modal';
export { Select } from './Select';
export { PageLoader } from './PageLoader';
export { ConfirmDialog, useConfirmDialog, GlobalConfirmDialog, useGlobalConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps, ConfirmDialogVariant, UseConfirmDialogOptions } from './ConfirmDialog';
export { AutocompleteInput } from './AutocompleteInput';
export { KPICard, KPIGrid, AlertCard, StatDistribution } from './KPICard';
export type { KPICardProps, KPIGridProps, AlertCardProps, StatDistributionProps } from './KPICard';
export { QuickActions } from './QuickActions';
export { ListSummary, ListSummaryCompact } from './ListSummary';
export type { SummaryIcon } from './ListSummary';

// Pagination
export { Pagination, usePagination } from './Pagination';
export type { PaginationProps } from './Pagination';

// Skeleton Loading Components
export {
  Skeleton,
  TableRowSkeleton,
  KPISkeleton,
  ListSkeleton,
  ProductCardSkeleton,
  FormSkeleton,
  PageSkeleton,
  DetailSkeleton,
  DashboardSkeleton,
  InventarioSkeleton,
  GastosSkeleton
} from './Skeleton';

// Search Input
export { SearchInput, SearchWithFilters } from './SearchInput';
export type { SearchInputProps, SearchWithFiltersProps } from './SearchInput';

// Empty State
export { EmptyStateAction, EmptyStateCompact, TableEmptyState } from './EmptyStateAction';
export type { EmptyStateActionProps, EmptyStateVariant, EmptyStateIcon } from './EmptyStateAction';

// Tabs
export { Tabs, TabPanel, TabsProvider, TabsWithContent, useTabs } from './Tabs';
export type { Tab, TabsProps, TabPanelProps } from './Tabs';

// Tooltip
export { Tooltip, TooltipSimple, TooltipInfo, HelpTooltip } from './Tooltip';
export type { TooltipProps, TooltipPosition } from './Tooltip';

// Dropdown
export { Dropdown, DropdownSelect, ActionsDropdown } from './Dropdown';
export type { DropdownProps, DropdownItem, DropdownSelectProps } from './Dropdown';

// Professional UI Components
export {
  EntityAvatar,
  GradientHeader,
  StatCard,
  EntityCard,
  TabNavigation,
  SectionHeader,
  EmptyState,
  HighlightBox,
  MasterCard,
  QuickStatRow
} from './ProfessionalUI';
export type { MasterCardVariant } from './ProfessionalUI';

// Virtual List
export { VirtualList, useVirtualTable } from './VirtualList';
export type { VirtualListProps, UseVirtualTableOptions, UseVirtualTableResult } from './VirtualList';

// Charts
export {
  SimpleLineChart,
  MultiLineChart,
  SimpleAreaChart,
  SimpleBarChart,
  MultiBarChart,
  SimplePieChart,
  DonutChart,
  SimpleComposedChart,
  MiniChart,
  CHART_COLORS,
  CHART_COLOR_PALETTE,
  formatCurrency,
  formatNumber,
  formatPercent
} from './Charts';

// Stepper
export { Stepper, useStepper, StepContent, StepNavigation } from './Stepper';
export type { StepperProps, Step, UseStepperOptions, UseStepperResult, StepContentProps, StepNavigationProps } from './Stepper';

// Breadcrumbs
export { Breadcrumbs, SimpleBreadcrumbs, useBreadcrumbs, PageHeaderWithBreadcrumbs } from './Breadcrumbs';
export type { BreadcrumbItem, BreadcrumbsProps, SimpleBreadcrumbsProps, UseBreadcrumbsOptions, PageHeaderWithBreadcrumbsProps } from './Breadcrumbs';

// Pipeline Header
export { PipelineHeader } from './PipelineHeader';
export type { PipelineHeaderProps, PipelineStage } from './PipelineHeader';

// Status Timeline
export { StatusTimeline, useVentaTimelineSteps, useOrdenCompraTimelineSteps } from './StatusTimeline';
export type { StatusTimelineProps, TimelineStep, NextAction } from './StatusTimeline';

// Action Modal
export { ActionModal, useActionModal, GlobalActionModal, useGlobalActionModal } from './ActionModal';
export type { ActionModalProps, ActionModalField, ActionModalVariant, UseActionModalOptions } from './ActionModal';