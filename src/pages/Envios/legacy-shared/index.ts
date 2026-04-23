/**
 * legacy-shared — Componentes compartidos entre EnvioWizardF y EnvioWizardG
 * (y antes también T2/J/E/I).
 *
 * S53 F5: cuando los wizards C/J/E/I se eliminan en favor del wizard unificado,
 * los 2 componentes que F y G todavía consumen de T2 se mueven aquí para
 * evitar romper F y G en el mismo commit.
 *
 * Estos componentes son TEMPORALES en esta ubicación. Se eliminarán cuando:
 *   - T-F: EnvioWizardF migre a flujo embedded en módulo Ventas
 *   - T-G: EnvioWizardG migre a flujo embedded en módulo Devoluciones
 *
 * Post-T-F y T-G, esta carpeta completa se puede borrar.
 */

export { ProductoPickingGroup } from './ProductoPickingGroup';
export type {
  ProductoPickingGroupProps,
  ProductoPickingGroupUnidad,
} from './ProductoPickingGroup';

export { UnidadPickerItem } from './UnidadPickerItem';
export type { UnidadPickerItemProps } from './UnidadPickerItem';

export { EnvioT2WizardPreview } from './EnvioT2WizardPreview';
export type { EnvioT2WizardPreviewProps } from './EnvioT2WizardPreview';
