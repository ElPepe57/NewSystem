/**
 * components/index.ts — Imp-L1 · Refactor visual S58e
 *
 * Componentes reutilizables del módulo Tesorería rediseñado.
 */

export { BankLogo } from './BankLogo';
export type { BankLogoProps, BankLogoSize } from './BankLogo';

export {
  PipelineTesoreria,
  calcularBloquesPipeline,
} from './PipelineTesoreria';
export type {
  PipelineTesoreriaProps,
  EstadoPipeline,
  BloquePipelineData,
} from './PipelineTesoreria';

export { ProductCard } from './ProductCard';
export type { ProductCardProps } from './ProductCard';

export { BankSubheader } from './BankSubheader';
export type { BankSubheaderProps } from './BankSubheader';

export { TitularGroupHeader } from './TitularGroupHeader';
export type {
  TitularGroupHeaderProps,
  TipoTitular,
} from './TitularGroupHeader';

export {
  SaldoAlertChip,
  SaldoChipSaludable,
  calcularEstadoSaldo,
} from './SaldoAlertChip';
export type { SaldoAlertChipProps, SaldoEstado } from './SaldoAlertChip';

export { MovimientosKpiRow } from './MovimientosKpiRow';
export type { MovimientosKpiRowProps } from './MovimientosKpiRow';

export { MovimientosBreakdown } from './MovimientosBreakdown';
export type { MovimientosBreakdownProps } from './MovimientosBreakdown';

export { FiltrosMovimientosBar } from './FiltrosMovimientosBar';
export type {
  RangoFechasMov,
  CategoriaMov,
  CanalMov,
  DocumentoMov,
} from './FiltrosMovimientosBar';
