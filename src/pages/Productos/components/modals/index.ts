/**
 * Barrel · modales standalone del módulo Productos V2
 *
 * S3.4 (2026-05-04) · LIMPIEZA: InvestigacionCompletaModal + TabProveedores +
 * TabCompetencia + TabDecision ELIMINADOS. La gestión de investigación
 * (proveedores y competidores) vive ahora dentro del modal detalle del producto
 * (TabInvestigacion + ProveedorFormModal/CompetidorFormModal como sub-modales).
 *
 *   - Papelera (#23)
 *   - ProveedorFormModal (#37) + CompetidorFormModal (#38) + EntidadMaestraAutocomplete
 *     (siguen exportados porque ProductoDetailModal los usa internamente)
 */
export { PapeleraModal } from './PapeleraModal';
export {
  EntidadMaestraAutocomplete,
  type EntidadMaestraItem,
  type EntidadTipo,
} from './investigacion/EntidadMaestraAutocomplete';
export {
  ProveedorFormModal,
  type ProveedorInvestigacionFormValue,
} from './investigacion/ProveedorFormModal';
export {
  CompetidorFormModal,
  type CompetidorInvestigacionFormValue,
} from './investigacion/CompetidorFormModal';
export { AjustarPrecioModal } from './AjustarPrecioModal';
export { ImportarCSVModal } from './ImportarCSVModal';
export type {
  ProveedorInvestigacion,
  CompetidorInvestigacion,
  CriterioDecision,
  DecisionInvestigacion,
  AlertaInvestigacion,
  InvestigacionPayload,
} from './investigacion/types';
