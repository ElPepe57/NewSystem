/**
 * Barrel · Componentes Maestros con Campo Creable (Fase E1)
 *
 * Implementa el patrón canónico V2 para vincular productos a maestros:
 *   - MaestroSelect (single value · marca · tipo de producto)
 *   - MaestroChipsMulti (multi value · categorías · etiquetas)
 *
 * Mockup canónico: docs/mockups/productos/41-wizard-maestros-skincare.html (v4)
 */
export { MaestroSelect, type MaestroItem } from './MaestroSelect';
export {
  MaestroChipsMulti,
  type MaestroChipItem,
  type MaestroChipSelection,
} from './MaestroChipsMulti';
export { ChipsCerrados, type ChipCerradoOption } from './ChipsCerrados';
