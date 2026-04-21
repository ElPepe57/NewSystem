/**
 * SubEnviosT1 — Barrel export del módulo S45.
 *
 * Componentes para gestionar sub-tandas dentro de envíos T1 (casos A/B/D):
 *   - SubEnvioTimelineItem: una tanda individual en el timeline
 *   - AgregarTandaModal: modal para crear nueva sub-tanda
 *   - ResolverReclamoModal: modal para resolver reclamo con 3 salidas (D-16)
 *
 * Fase 2 (actual): átomos
 * Fase 3 (siguiente): compuesto SubEnviosTimeline + CrearTandaReemplazoModal
 * Fase 4: integración en EnvioDetailModal + TabReclamos
 */

export { SubEnvioTimelineItem, SubEnviosTimelineLinea } from './SubEnvioTimelineItem';
export type {
  SubEnvioTimelineItemProps,
  SubEnvioTimelineItemProductoInfo,
} from './SubEnvioTimelineItem';

export { AgregarTandaModal } from './AgregarTandaModal';
export type {
  AgregarTandaModalProps,
  AgregarTandaModalUnidad,
  AgregarTandaModalResult,
} from './AgregarTandaModal';

export { ResolverReclamoModal } from './ResolverReclamoModal';
export type {
  ResolverReclamoModalProps,
  ResolverReclamoModalReclamoInfo,
  ResolverReclamoModalResult,
} from './ResolverReclamoModal';
