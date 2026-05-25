/**
 * Módulo de Contabilidad
 * Componentes para la vista contable del negocio
 */

export { default as EstadoResultados } from './EstadoResultados';
export { default as BalanceGeneral } from './BalanceGeneral';
// chk5.E-RM · RevisionMensual reemplaza a CierreMensual (deprecated · queda en filesystem por backward compat)
export { default as RevisionMensual } from './RevisionMensual';
/** @deprecated · usar RevisionMensual · ver chk5.E-RM */
export { default as CierreMensual } from './CierreMensual';
export { GlosarioModal } from './GlosarioModal';
// chk5.E-C · Sprint C · Storytelling components
export { BannerEstadoNegocio } from './BannerEstadoNegocio';
export { InsightsDelMes } from './InsightsDelMes';
export { PuntoEquilibrioCard, CapitalAtrapadoCard } from './VistasNuevasResumen';
export { IndicadoresPreguntasView } from './IndicadoresPreguntasView';
