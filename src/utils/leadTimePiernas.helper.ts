/**
 * leadTimePiernas.helper · scorecard de proveedor/viajero · núcleo PURO.
 *
 * Parte el lead-time de la cadena en sus DOS piernas con dueños distintos (decisión del user
 * 2026-06-29 · "medir no encasillar"):
 *   - Pierna A · PROVEEDOR: desde que el proveedor despacha la tanda hasta que llega a la casilla
 *     de origen. Ponderado por unidades sobre las `SubEnvioT1` con ambas fechas. Solo medible con
 *     tandas que tengan despacho+entrega → null si no (degrada HONESTO en envíos planos · NO inventa).
 *   - Pierna B · VIAJERO: días en tránsito (origen → Perú). Usa `diasEnTransito` ya computado, o
 *     `fechaLlegadaReal − fechaSalida`.
 *
 * Reemplaza el cálculo roto de `proveedor.analytics.calcularTiemposEntrega` (que fusiona A+B+aduana
 * en `fechaRecibida − fechaEnviada` a nivel OC e ignora sub-órdenes/tandas · bug de doble-fuente).
 * El scorecard consolida sobre ENVÍOS (el dueño de las fechas reales), no sobre la OC.
 *
 * 100% testeable. NO calcula "puntualidad %" — eso necesita un objetivo/SLA que hoy no existe
 * (greenfield · Ola 4). Acá solo el lead-time real + su consistencia (desviación).
 */

const MS_POR_DIA = 1000 * 60 * 60 * 24;

/** Algo con `toMillis()` (Firestore Timestamp) o nada. */
type FechaTs = { toMillis?: () => number } | null | undefined;

/** Días enteros entre dos fechas · null si falta alguna o el rango es inválido (negativo). */
export function diasEntre(desde: FechaTs, hasta: FechaTs): number | null {
  const a = desde?.toMillis?.();
  const b = hasta?.toMillis?.();
  if (a == null || b == null) return null;
  const dias = Math.floor((b - a) / MS_POR_DIA);
  return dias >= 0 ? dias : null;
}

export interface TandaLeadTime {
  fechaDespachoProveedor?: FechaTs;
  fechaEntrega?: FechaTs;
  unidadesIds?: string[];
}

/**
 * Pierna A (proveedor): promedio PONDERADO por unidades de (fechaEntrega − fechaDespachoProveedor)
 * sobre las tandas que tienen ambas fechas. null si ninguna tanda es medible (envío plano sin despacho).
 */
export function leadTimePiernaA(tandas: TandaLeadTime[] | undefined): number | null {
  if (!tandas || tandas.length === 0) return null;
  let sumPonderado = 0;
  let sumPeso = 0;
  for (const t of tandas) {
    const dias = diasEntre(t.fechaDespachoProveedor, t.fechaEntrega);
    if (dias == null) continue;
    const peso = t.unidadesIds?.length || 1;
    sumPonderado += dias * peso;
    sumPeso += peso;
  }
  return sumPeso > 0 ? sumPonderado / sumPeso : null;
}

/**
 * Pierna B (viajero): días en tránsito. Prefiere el campo `diasEnTransito` ya computado;
 * si no, lo deriva de `fechaLlegadaReal − fechaSalida`. null si no es medible.
 */
export function leadTimePiernaB(envio: {
  diasEnTransito?: number;
  fechaSalida?: FechaTs;
  fechaLlegadaReal?: FechaTs;
}): number | null {
  if (typeof envio.diasEnTransito === 'number' && envio.diasEnTransito >= 0) return envio.diasEnTransito;
  return diasEntre(envio.fechaSalida, envio.fechaLlegadaReal);
}

export interface LeadTimeStats {
  promedio: number;
  min: number;
  max: number;
  /** Desviación estándar poblacional · proxy de CONSISTENCIA (más bajo = más predecible). */
  desviacion: number;
  n: number;
}

/** Estadísticas de un conjunto de lead-times (por entidad). null si no hay muestras. */
export function resumirLeadTime(valores: number[]): LeadTimeStats | null {
  const v = valores.filter((x) => typeof x === 'number' && x >= 0);
  if (v.length === 0) return null;
  const promedio = v.reduce((s, x) => s + x, 0) / v.length;
  const desviacion = Math.sqrt(v.reduce((s, x) => s + (x - promedio) ** 2, 0) / v.length);
  return {
    promedio: Math.round(promedio * 10) / 10,
    min: Math.min(...v),
    max: Math.max(...v),
    desviacion: Math.round(desviacion * 10) / 10,
    n: v.length,
  };
}
