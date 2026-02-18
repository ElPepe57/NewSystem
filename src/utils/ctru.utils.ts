import type { Unidad } from '../types/unidad.types';

/**
 * Obtener el CTRU (Costo Total Real por Unidad) de una unidad.
 * Fuente única de verdad para el cálculo de CTRU.
 *
 * Prioridad:
 * 1. ctruDinamico (incluye gastos GA/GO prorrateados)
 * 2. ctruInicial (costo base al momento de recepción)
 * 3. Cálculo manual: (costoUnitarioUSD + costoFleteUSD) × TC
 */
export function getCTRU(unidad: Pick<Unidad, 'ctruDinamico' | 'ctruInicial' | 'costoUnitarioUSD' | 'costoFleteUSD' | 'tcPago' | 'tcCompra'>): number {
  if (unidad.ctruDinamico && unidad.ctruDinamico > 0) {
    return unidad.ctruDinamico;
  }

  if (unidad.ctruInicial && unidad.ctruInicial > 0) {
    return unidad.ctruInicial;
  }

  // Fallback: cálculo manual
  const tc = getTC(unidad);
  const costoTotalUSD = (unidad.costoUnitarioUSD || 0) + (unidad.costoFleteUSD || 0);
  return costoTotalUSD * tc;
}

/**
 * Obtener el TC aplicable de una unidad.
 * Prioridad: tcPago > tcCompra
 * Sin fallback hardcodeado - retorna 0 si no hay TC.
 */
export function getTC(unidad: Pick<Unidad, 'tcPago' | 'tcCompra'>): number {
  return unidad.tcPago || unidad.tcCompra || 0;
}

/**
 * Calcular el costo base (sin GA/GO) de una unidad en PEN.
 * Usado para distribución proporcional de gastos.
 */
export function getCostoBasePEN(unidad: Pick<Unidad, 'ctruInicial' | 'costoUnitarioUSD' | 'costoFleteUSD' | 'tcPago' | 'tcCompra'>): number {
  if (unidad.ctruInicial && unidad.ctruInicial > 0) {
    return unidad.ctruInicial;
  }

  const tc = getTC(unidad);
  const costoTotalUSD = (unidad.costoUnitarioUSD || 0) + (unidad.costoFleteUSD || 0);
  return costoTotalUSD * tc;
}
