import type { EstadoOrden, EstadoPagoOC, SubOrdenCompra } from '../types/ordenCompra.types';

// ─── Estado derivado de la OC basado en sus sub-ordenes ────────────────

/**
 * Calcula el estado logistico de la OC a partir del estado de sus sub-ordenes.
 * Si no hay sub-ordenes, retorna el estado actual sin cambios.
 */
export function calcularEstadoDerivadoOC(
  subOrdenes: SubOrdenCompra[],
  estadoActual: EstadoOrden
): EstadoOrden {
  if (!subOrdenes?.length) return estadoActual;

  const total = subOrdenes.length;
  const recibidas = subOrdenes.filter(s => s.estado === 'recibida').length;
  const enTransito = subOrdenes.filter(s => s.estado === 'en_transito').length;

  if (recibidas === total) return 'completada';
  if (recibidas > 0 || enTransito > 0) return 'en_proceso';
  return estadoActual;
}

/**
 * Calcula el estado de pago de la OC a partir del pago de sus sub-ordenes.
 * Si no hay sub-ordenes, retorna el estado actual sin cambios.
 */
export function calcularEstadoPagoDerivado(
  subOrdenes: SubOrdenCompra[],
  estadoPagoActual: EstadoPagoOC
): EstadoPagoOC {
  if (!subOrdenes?.length) return estadoPagoActual;

  const pagadas = subOrdenes.filter(s => s.estadoPago === 'pagado').length;
  if (pagadas === subOrdenes.length) return 'pagado';
  if (pagadas > 0) return 'parcial';
  return 'pendiente';
}

// ─── Resumen para badges de tabla ──────────────────────────────────────

export interface SubOrdenResumen {
  total: number;
  recibidas: number;
  enTransito: number;
  pendientes: number;
  pagadas: number;
}

/**
 * Genera un resumen compacto de sub-ordenes para mostrar en badges de tabla.
 * Retorna null si la OC no tiene sub-ordenes.
 */
export function getSubOrdenResumen(subOrdenes?: SubOrdenCompra[]): SubOrdenResumen | null {
  if (!subOrdenes?.length) return null;
  return {
    total: subOrdenes.length,
    recibidas: subOrdenes.filter(s => s.estado === 'recibida').length,
    enTransito: subOrdenes.filter(s => s.estado === 'en_transito').length,
    pendientes: subOrdenes.filter(s => !s.estado || s.estado === 'borrador').length,
    pagadas: subOrdenes.filter(s => s.estadoPago === 'pagado').length,
  };
}
