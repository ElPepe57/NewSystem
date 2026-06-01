/**
 * Hub Kit · L5 · building blocks del shell canónico de módulos. COMPLETO (6/6).
 *
 * Spec validada: docs/mockups/hub-kit-implementacion-v1.html
 * Un módulo nuevo se ENSAMBLA desde estos blocks (no re-implementa el shell):
 *
 *   <HubShell>
 *     <HubTopBar grupo modulo leaf esAdmin onInicio onModulo />
 *     <HubHeader grupo icon titulo subtitulo acciones />
 *     <HubKpiStrip kpis miniStats cols />
 *     <HubTabs grupo tabs activa onChange />
 *     <HubBody aside={...}>{contenido}</HubBody>
 *   </HubShell>
 *
 * Color: el CHROME (topbar chip · header icono/primary · tab activo) hereda del
 * grupo vía grupoColor.ts. Los DATOS (KPIs · badges) usan paleta semántica fija.
 */
export { HubShell } from './HubShell';
export { HubTopBar } from './HubTopBar';
export { HubHeader } from './HubHeader';
export type { HubHeaderAccion } from './HubHeader';
export { HubKpiStrip } from './HubKpiStrip';
export type { HubKpi, HubKpiTono, HubMiniStat } from './HubKpiStrip';
export { HubTabs } from './HubTabs';
export type { HubTab, HubTabBadgeTono } from './HubTabs';
export { HubBody } from './HubBody';
