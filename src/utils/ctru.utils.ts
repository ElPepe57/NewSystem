import type { Unidad } from '../types/unidad.types';

/**
 * Obtener el CTRU (Costo Total Real por Unidad) de una unidad.
 * Fuente única de verdad para el cálculo de CTRU.
 *
 * IMPORTANTE: ctruDinamico y ctruInicial pueden haber sido calculados ANTES
 * de que la transferencia asignara costoFleteUSD. Cuando la unidad tiene
 * costoFleteUSD, usamos getCostoBasePEN() + costoGAGOAsignado para
 * garantizar que el flete esté incluido.
 */
export function getCTRU(unidad: Pick<Unidad, 'ctruDinamico' | 'ctruInicial' | 'costoUnitarioUSD' | 'costoFleteUSD' | 'tcPago' | 'tcCompra'> & { costoGAGOAsignado?: number }): number {
  const costoFleteUSD = unidad.costoFleteUSD || 0;

  // Si la unidad tiene flete, verificar que ctruDinamico/ctruInicial lo incluyan
  if (costoFleteUSD > 0) {
    const costoBase = getCostoBasePEN(unidad);
    const gagoAsignado = unidad.costoGAGOAsignado || 0;

    // Si ctruDinamico existe y es mayor que costoBase, puede que incluya GA/GO correctamente
    // Pero si ctruDinamico ≈ ctruInicial (sin flete) + GA/GO, está incorrecto
    // Recalculamos: costoBase (con flete) + GA/GO asignado
    if (unidad.ctruDinamico && unidad.ctruDinamico > 0) {
      const costoBaseConFlete = costoBase;
      const ctruRecalculado = costoBaseConFlete + gagoAsignado;
      // Usar el mayor: puede que ctruDinamico ya esté correcto
      return Math.max(unidad.ctruDinamico, ctruRecalculado);
    }

    return costoBase;
  }

  // Sin flete: usar valores almacenados normalmente
  if (unidad.ctruDinamico && unidad.ctruDinamico > 0) {
    return unidad.ctruDinamico;
  }

  if (unidad.ctruInicial && unidad.ctruInicial > 0) {
    return unidad.ctruInicial;
  }

  // Fallback: cálculo manual
  const tc = getTC(unidad);
  const costoTotalUSD = (unidad.costoUnitarioUSD || 0);
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
 *
 * IMPORTANTE: ctruInicial puede haber sido calculado ANTES de que la transferencia
 * asignara el costoFleteUSD. En ese caso, ctruInicial no incluye el flete.
 * Siempre recalculamos: (costoUnitarioUSD + costoFleteUSD) × TC
 * y usamos el mayor entre ese valor y ctruInicial para garantizar que el flete
 * esté incluido.
 */
export function getCostoBasePEN(unidad: Pick<Unidad, 'ctruInicial' | 'costoUnitarioUSD' | 'costoFleteUSD' | 'tcPago' | 'tcCompra'> & { costoRecojoPEN?: number }): number {
  const tc = getTC(unidad);
  const costoFleteUSD = unidad.costoFleteUSD || 0;
  const costoRecojo = (unidad as any).costoRecojoPEN || 0;
  const costoCalculado = ((unidad.costoUnitarioUSD || 0) + costoFleteUSD) * tc + costoRecojo;

  // Si la unidad tiene flete o recojo asignado, siempre usar el cálculo completo
  // ya que ctruInicial pudo haberse calculado antes de la transferencia
  if (costoFleteUSD > 0 || costoRecojo > 0) {
    return costoCalculado;
  }

  // Sin flete ni recojo: preferir ctruInicial si existe (puede incluir otros ajustes)
  if (unidad.ctruInicial && unidad.ctruInicial > 0) {
    return unidad.ctruInicial;
  }

  return costoCalculado;
}

/**
 * Calcular CTRU Real usando TCPA (del Pool USD) en lugar del TC histórico de la unidad.
 * Esto refleja el costo REAL de los dólares usados para comprar el producto,
 * no el TC al que se pagó la OC (que puede ser diferente al costo real del dólar).
 *
 * Fórmula: (costoUnitarioUSD + costoFleteUSD) × TCPA + costoGAGOAsignado
 */
export function getCTRU_Real(
  unidad: Pick<Unidad, 'costoUnitarioUSD' | 'costoFleteUSD'> & { costoGAGOAsignado?: number },
  tcpa: number
): number {
  if (tcpa <= 0) return 0;
  const costoUSD = (unidad.costoUnitarioUSD || 0) + (unidad.costoFleteUSD || 0);
  const gagoAsignado = unidad.costoGAGOAsignado || 0;
  return costoUSD * tcpa + gagoAsignado;
}

/**
 * Calcular la asignación proporcional de GA/GO para una unidad.
 * Fuente única de verdad para esta fórmula — usada por ctru.service (Firestore)
 * y ctruStore (analytics client-side).
 *
 * Fórmula: costoGAGO_unidad = totalGAGO × (costoBase_unidad / costoBase_total_vendidas)
 *
 * Solo se aplica a unidades vendidas. Las unidades activas reciben 0.
 */
export function calcularGAGOProporcional(
  costoBaseUnidad: number,
  costoBaseTotalVendidas: number,
  totalGAGO: number
): number {
  if (costoBaseTotalVendidas <= 0 || totalGAGO <= 0) return 0;
  return totalGAGO * (costoBaseUnidad / costoBaseTotalVendidas);
}
