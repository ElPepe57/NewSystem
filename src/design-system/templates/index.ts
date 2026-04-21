/**
 * Capa 3 — Plantillas de dominio del ERP.
 *
 * Ver `docs/DESIGN_PATTERNS.md` para contexto completo.
 *
 * Reglas de uso:
 *   - SIEMPRE partí de la plantilla más alta disponible.
 *   - Si necesitás algo que no existe en esta capa, CREALO AQUÍ primero,
 *     nunca lo copies-pegues en el código del módulo.
 *   - Estas plantillas conocen la estructura visual del ERP (header fijo +
 *     zona dinámica, pipeline, KPIs, banner CTA) pero NO conocen los tipos
 *     de datos de ningún módulo (OC, Envío, Venta, etc.).
 */

// Plantilla principal: orquestador del detalle
export { EntityDetailShell } from './EntityDetailShell';
export type { EntityDetailShellProps } from './EntityDetailShell';

// Piezas del detalle (4 slots canónicos)
export { EntityHeader } from './EntityHeader';
export type { EntityHeaderProps } from './EntityHeader';

export { EntityPipeline } from './EntityPipeline';
export type {
  EntityPipelineProps,
  EntityPipelineStep,
  EntityPipelineStepStatus,
} from './EntityPipeline';

export { NextActionBanner } from './NextActionBanner';
export type { NextActionBannerProps, NextActionVariant } from './NextActionBanner';

export { KpiRow } from './KpiRow';
export type { KpiRowProps, KpiRowItem, KpiTone } from './KpiRow';
