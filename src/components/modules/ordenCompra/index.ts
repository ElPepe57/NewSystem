// Orden de Compra Components
// S53.9 — OrdenCompraForm + OrdenCompraTable ELIMINADOS (legacy).
// Creación/edición ahora vive en OCWizardV3 (via page OrdenesCompra directamente).

// OC Builder (Wizard desde requerimientos)
export { OCBuilder } from './OCBuilder/OCBuilder';
export { PendientesCompraPanel } from './PendientesCompraPanel';

// Price Intelligence: cadena PriceAdvisor ELIMINADA (F3 · 2026-06-18 · 0 consumidores vivos).
// La "referencia de precio" se surfacea inline en el wizard (StepProductos) · ver intel-precios-360.
