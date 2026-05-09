/**
 * Inventario · entry point del módulo (thin wrapper)
 *
 * Toda la implementación canónica vive en
 * `src/pages/Inventario/components/shell/InventarioPageV2.tsx` siguiendo el
 * patrón canónico (S3.3 wizard-producto + S3.6 M1 chk4.2).
 *
 * Este archivo solo expone el componente al router y mantiene
 * la ruta `/inventario` intacta sin requerir cambios en `App.tsx`.
 */

export { InventarioPageV2 as Inventario } from './components/shell/InventarioPageV2';
