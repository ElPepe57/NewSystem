/**
 * Hub Kit · L5 · building blocks del shell canónico de módulos.
 *
 * Spec validada: docs/mockups/hub-kit-implementacion-v1.html
 * Un módulo nuevo se ENSAMBLA desde estos blocks (no re-implementa el shell).
 *
 * Estado de construcción (F3):
 *   ✅ HubShell   · card contenedor (1 recuadro continuo)
 *   ✅ HubTopBar  · breadcrumb S9.D1 + chip de rol (color heredado del grupo)
 *   ⬜ HubHeader  · icono tonal + h1 + subtítulo + acciones 3-tier
 *   ⬜ HubKpiStrip· KPIs semánticos + mini-stats footer
 *   ⬜ HubTabs    · tabs border-b-2 (color del grupo) + scroll-x mobile
 *   ⬜ HubBody    · cuerpo · aside opcional decide Layout A/B
 */
export { HubShell } from './HubShell';
export { HubTopBar } from './HubTopBar';
