import type { Unidad } from '../types/unidad.types';

/**
 * Obtener el CTRU (Costo Total Real por Unidad) de una unidad.
 * Fuente unica de verdad para el calculo de CTRU.
 *
 * REINGENIERIA: CTRU = precio producto (de OC) + costos landed (de Envio)
 * GA/GO ya NO se incluyen en el CTRU (Acuerdo 3).
 * Los gastos del periodo se ven en el P&L como "Gastos Fijos del Mes".
 */
export function getCTRU(unidad: Pick<Unidad, 'ctruDinamico' | 'ctruInicial' | 'costoUnitarioUSD' | 'costoFleteUSD' | 'tcPago' | 'tcCompra'> & { costoGAGOAsignado?: number; costosLandedPEN?: number }): number {
  // Prioridad 1: Si hay costosLanded del nuevo modelo (Envio), usarlos
  if (unidad.costosLandedPEN && unidad.costosLandedPEN > 0) {
    const tc = getTC(unidad);
    const costoProductoPEN = (unidad.costoUnitarioUSD || 0) * tc;
    return costoProductoPEN + unidad.costosLandedPEN;
  }

  // Prioridad 2: costoFleteUSD del modelo legacy (transferencia)
  const costoFleteUSD = unidad.costoFleteUSD || 0;
  if (costoFleteUSD > 0) {
    const costoBase = getCostoBasePEN(unidad);
    // REINGENIERIA: NO sumar costoGAGOAsignado — GA/GO no tocan CTRU
    return costoBase;
  }

  // Prioridad 3: valores almacenados
  // NOTA: ctruDinamico legacy puede incluir GA/GO. Preferir ctruInicial que es limpio.
  if (unidad.ctruInicial && unidad.ctruInicial > 0) {
    return unidad.ctruInicial;
  }

  if (unidad.ctruDinamico && unidad.ctruDinamico > 0) {
    // Restar GA/GO si estaban incluidos en ctruDinamico
    const gagoIncluido = unidad.costoGAGOAsignado || 0;
    return unidad.ctruDinamico - gagoIncluido;
  }

  // Fallback: calculo manual
  const tc = getTC(unidad);
  return (unidad.costoUnitarioUSD || 0) * tc;
}

/**
 * Obtener el TC aplicable de una unidad.
 * Prioridad: tcPago > tcCompra
 */
export function getTC(unidad: Pick<Unidad, 'tcPago' | 'tcCompra'>): number {
  return unidad.tcPago || unidad.tcCompra || 0;
}

/**
 * Calcular el costo base (precio + flete, sin GA/GO) de una unidad en PEN.
 * Formula: (costoUnitarioUSD + costoFleteUSD) x TC + costoRecojoPEN
 */
export function getCostoBasePEN(unidad: Pick<Unidad, 'ctruInicial' | 'costoUnitarioUSD' | 'costoFleteUSD' | 'tcPago' | 'tcCompra'> & { costoRecojoPEN?: number }): number {
  const tc = getTC(unidad);
  const costoFleteUSD = unidad.costoFleteUSD || 0;
  const costoRecojo = unidad.costoRecojoPEN || 0;
  const costoCalculado = ((unidad.costoUnitarioUSD || 0) + costoFleteUSD) * tc + costoRecojo;

  if (costoFleteUSD > 0 || costoRecojo > 0) {
    return costoCalculado;
  }

  if (unidad.ctruInicial && unidad.ctruInicial > 0) {
    return unidad.ctruInicial;
  }

  return costoCalculado;
}

/**
 * Calcular CTRU Real usando TCPA (del Pool USD) en lugar del TC historico.
 * REINGENIERIA: sin costoGAGOAsignado — GA/GO no tocan CTRU.
 */
export function getCTRU_Real(
  unidad: Pick<Unidad, 'costoUnitarioUSD' | 'costoFleteUSD'> & { costosLandedPEN?: number },
  tcpa: number
): number {
  if (tcpa <= 0) return 0;
  const costoUSD = (unidad.costoUnitarioUSD || 0) + (unidad.costoFleteUSD || 0);
  return costoUSD * tcpa + (unidad.costosLandedPEN || 0);
}

/**
 * @deprecated GA/GO ya no se prorratean al CTRU (Acuerdo 3 reingenieria).
 * Se mantiene temporalmente para backward compat en ctruStore analytics.
 * Siempre retorna 0.
 */
export function calcularGAGOProporcional(
  _costoBaseUnidad: number,
  _costoBaseTotalVendidas: number,
  _totalGAGO: number
): number {
  return 0;
}
