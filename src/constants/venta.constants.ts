/**
 * Constantes compartidas para filtrado de ventas.
 * Fuente única de verdad — evita inconsistencias entre Dashboard, Reportes y Stats.
 */

/** Estados que representan ventas reales (no cotizaciones ni canceladas) */
export const ESTADOS_VENTA_VALIDOS = [
  'confirmada',
  'parcial',
  'asignada',
  'en_entrega',
  'despachada',
  'entrega_parcial',
  'entregada',
  'reservada',
] as const;

/** Estados que NO deben contarse como ventas */
export const ESTADOS_VENTA_EXCLUIDOS = ['cotizacion', 'cancelada', 'devuelta'] as const;

/** Verifica si un estado es una venta válida para reportes */
export function esEstadoVentaValido(estado: string): boolean {
  return (ESTADOS_VENTA_VALIDOS as readonly string[]).includes(estado);
}
