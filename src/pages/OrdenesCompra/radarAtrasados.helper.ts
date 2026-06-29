/**
 * radarAtrasados.helper · Fase 1 (Llegadas) · núcleo PURO del radar de atrasados en vuelo.
 *
 * Lo PROPIO de Compras en el unhappy path: el seguimiento de "¿qué OC/envío va tarde?".
 * NO depende de la ETA (que casi nunca se puebla) — clasifica por `diasEnVuelo` (hoy − fechaSalida)
 * contra el lead-time ESPERADO del proveedor (aprendido). Gravedad GRADUADA, no booleana.
 *
 * El badge de la tab = severos + críticos (los que demandan acción) · el leve "con señal viva"
 * no escala. "Mudo" = sin señal de tracking hace > umbral (candidato a pérdida → se empuja/escala).
 *
 * 100% testeable. El ensamblado (hook) provee diasEnVuelo + leadTimeEsperado + capital + última señal;
 * este helper SOLO clasifica/ordena/resume.
 */

export type GravedadAtraso = 'leve' | 'severo' | 'critico';

/** Ratio diasEnVuelo/leadTime que marca cada gravedad. */
export const RATIO_SEVERO = 1.5;
export const RATIO_CRITICO = 2.0;
/** Sin señal de tracking hace más de esto = "mudo" (candidato a pérdida). */
export const DIAS_MUDO = 7;

export interface FilaAtraso {
  id: string;
  numero: string;
  proveedor: string;
  diasEnVuelo: number;
  leadTimeEsperado: number;
  ratio: number;
  gravedad: GravedadAtraso;
  /** Capital en juego (USD) · LECTURA (el dato vive en Envíos/Finanzas · no se opera acá). */
  capitalUSD: number;
  /** Días desde la última señal de tracking · null = sin tracking conocido. */
  diasUltimaSenal: number | null;
  mudo: boolean;
}

/**
 * Clasifica un ítem en vuelo. Devuelve null si NO está atrasado (ratio ≤ 1) o si no hay
 * lead-time esperado conocido (no se puede afirmar "va tarde" sin baseline).
 */
export function clasificarAtraso(
  diasEnVuelo: number,
  leadTimeEsperado: number,
): { gravedad: GravedadAtraso; ratio: number } | null {
  if (leadTimeEsperado <= 0 || diasEnVuelo <= 0) return null;
  const ratio = diasEnVuelo / leadTimeEsperado;
  if (ratio <= 1) return null;
  if (ratio > RATIO_CRITICO) return { gravedad: 'critico', ratio };
  if (ratio > RATIO_SEVERO) return { gravedad: 'severo', ratio };
  return { gravedad: 'leve', ratio };
}

/** "Mudo" = sin señal de tracking hace más de DIAS_MUDO (no aplica si nunca hubo tracking). */
export function esMudo(diasUltimaSenal: number | null): boolean {
  return diasUltimaSenal != null && diasUltimaSenal > DIAS_MUDO;
}

export interface ResumenRadar {
  leves: number;
  severos: number;
  criticos: number;
  /** Lo que demanda acción (severo + crítico) · = el badge de la tab. */
  badge: number;
  /** Σ capital de los severo+crítico (la exposición real en riesgo). */
  capitalEnRiesgoUSD: number;
}

export function resumirRadar(filas: FilaAtraso[]): ResumenRadar {
  const severos = filas.filter((f) => f.gravedad === 'severo').length;
  const criticos = filas.filter((f) => f.gravedad === 'critico').length;
  const leves = filas.filter((f) => f.gravedad === 'leve').length;
  const capitalEnRiesgoUSD = filas
    .filter((f) => f.gravedad !== 'leve')
    .reduce((s, f) => s + (f.capitalUSD || 0), 0);
  return { leves, severos, criticos, badge: severos + criticos, capitalEnRiesgoUSD };
}

/** Orden del radar: crítico → severo → leve, y dentro, por ratio (más tarde primero). */
export function ordenarRadar(filas: FilaAtraso[]): FilaAtraso[] {
  const peso: Record<GravedadAtraso, number> = { critico: 0, severo: 1, leve: 2 };
  return [...filas].sort((a, b) => peso[a.gravedad] - peso[b.gravedad] || b.ratio - a.ratio);
}
