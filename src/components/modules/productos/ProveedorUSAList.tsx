/**
 * @deprecated Usar ProveedorOrigenList directamente con la prop `paisOrigen`.
 * Este archivo se mantiene como alias de compatibilidad para no romper imports existentes.
 *
 * Migración:
 *   - origenProducto='usa' → paisOrigen='USA'
 *   - origenProducto='internacional' → omitir paisOrigen (muestra todos)
 */
export { ProveedorOrigenList as ProveedorUSAList } from './ProveedorOrigenList';
