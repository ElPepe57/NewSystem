/**
 * tesoreria.shared.ts
 * Shared constants, collection names, and helper functions used across
 * all tesoreria sub-service modules.
 */
import { COLLECTIONS } from '../config/collections';
import type {
  TipoMovimientoTesoreria
} from '../types/tesoreria.types';

// ─── Collection names ────────────────────────────────────────────────────────

export const MOVIMIENTOS_COLLECTION = COLLECTIONS.MOVIMIENTOS_TESORERIA;
export const CONVERSIONES_COLLECTION = COLLECTIONS.CONVERSIONES_CAMBIARIAS;
export const CUENTAS_COLLECTION = COLLECTIONS.CUENTAS_CAJA;
export const REGISTROS_TC_COLLECTION = COLLECTIONS.REGISTROS_TC_TRANSACCION;
export const ESTADISTICAS_DOC = 'estadisticas/tesoreria';

// ─── Movement type classification ────────────────────────────────────────────

// Tipos de movimiento que son ingresos (entradas de dinero)
export const TIPOS_INGRESO: TipoMovimientoTesoreria[] = [
  'ingreso_venta',
  'ingreso_anticipo',
  'ingreso_otro',
  'aporte_capital',
  'ajuste_positivo'
];

// Tipos de movimiento que son egresos (salidas de dinero)
export const TIPOS_EGRESO: TipoMovimientoTesoreria[] = [
  'pago_orden_compra',
  'pago_viajero',
  'pago_proveedor_local',
  'gasto_operativo',
  'retiro_socio',
  'ajuste_negativo'
];

// Tipos de conversión (son tanto ingreso como egreso dependiendo del contexto)
export const TIPOS_CONVERSION: TipoMovimientoTesoreria[] = [
  'conversion_usd_pen',
  'conversion_pen_usd'
];

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Helper para determinar si un tipo de movimiento es ingreso
 * Para conversiones, depende de si tiene cuentaDestino (entrada de dinero)
 */
export const esMovimientoIngreso = (
  tipo: TipoMovimientoTesoreria,
  movimiento?: { cuentaOrigen?: string; cuentaDestino?: string }
): boolean => {
  if (TIPOS_CONVERSION.includes(tipo) && movimiento) {
    // Para conversiones, es ingreso si tiene cuentaDestino (dinero que entra)
    return !!movimiento.cuentaDestino;
  }
  return TIPOS_INGRESO.includes(tipo);
};

/**
 * Helper para determinar si un tipo de movimiento es egreso
 * Para conversiones, depende de si tiene cuentaOrigen (salida de dinero)
 */
export const esMovimientoEgreso = (
  tipo: TipoMovimientoTesoreria,
  movimiento?: { cuentaOrigen?: string; cuentaDestino?: string }
): boolean => {
  if (TIPOS_CONVERSION.includes(tipo) && movimiento) {
    // Para conversiones, es egreso si tiene cuentaOrigen (dinero que sale)
    return !!movimiento.cuentaOrigen;
  }
  return TIPOS_EGRESO.includes(tipo);
};
