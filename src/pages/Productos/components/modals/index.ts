/**
 * Barrel · modales standalone del módulo Productos V2
 *   - Papelera (#23)
 *   - Investigación completa (#24) + 3 sub-tabs (#25, #26, #27)
 */
export { PapeleraModal } from './PapeleraModal';
export { InvestigacionCompletaModal } from './InvestigacionCompletaModal';
export { TabProveedores } from './investigacion/TabProveedores';
export { TabCompetencia } from './investigacion/TabCompetencia';
export { TabDecision } from './investigacion/TabDecision';
export type {
  ProveedorInvestigacion,
  CompetidorInvestigacion,
  CriterioDecision,
  DecisionInvestigacion,
  AlertaInvestigacion,
  InvestigacionPayload,
} from './investigacion/types';
