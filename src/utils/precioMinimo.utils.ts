/**
 * precioMinimo.utils — Piso de precio CONSCIENTE DEL CANAL (pata 2 del modelo CTRU).
 *
 * Reemplaza la fórmula ciega `costo / (1 - margen)` (que ignora la comisión del canal
 * y corre sobre el modelo muerto costoTotalReal=ctruCalc+gvgdProm) por un piso que:
 *  - parte del CTRU limpio (fuente única getCTRU · caja producto),
 *  - descuenta la comisión del canal (ML ~13% sube el piso vs venta directa 0%),
 *  - descuenta un costo de envío fijo opcional del canal,
 *  - ofrece el piso DON'T-LOSE (margen 0 = no perder) además de los pisos por margen.
 *
 * Decisión "por ámbito de canal" (2026-06-16): el costo de venta NO se promedia
 * cross-canal (anti-patrón del modelo viejo) · el piso se computa POR canal con su
 * comisión forward-looking del maestro CanalVenta, no con el promedio histórico.
 */

export interface PisoCanalInput {
  /** CTRU del producto en PEN (fuente única getCTRU · caja producto). */
  ctru: number;
  /** Comisión del canal como FRACCIÓN (0.13 = 13%). */
  comisionFraccion: number;
  /** Costo de envío/logística fijo por venta en ese canal, en PEN. Default 0. */
  costoEnvioFijo?: number;
  /** Margen objetivo como FRACCIÓN sobre el precio (0 = piso don't-lose). Default 0. */
  margenObjetivoFraccion?: number;
}

/**
 * Resuelve el precio P mínimo tal que la contribución cubra el margen objetivo
 * DESPUÉS de la comisión del canal y el envío fijo:
 *
 *   P·(1 − comisión) − envíoFijo − CTRU ≥ margenObjetivo · P
 *     ⇒ P ≥ (CTRU + envíoFijo) / (1 − comisión − margenObjetivo)
 *
 * - margen = 0 → piso DON'T-LOSE (vender más barato = perder).
 * - margen > 0 → piso con margen objetivo sobre el precio.
 * - Devuelve Infinity si el margen es inalcanzable en ese canal (comisión + margen ≥ 1).
 */
export function calcPisoCanal({
  ctru,
  comisionFraccion,
  costoEnvioFijo = 0,
  margenObjetivoFraccion = 0,
}: PisoCanalInput): number {
  const denom = 1 - comisionFraccion - margenObjetivoFraccion;
  if (denom <= 0) return Infinity;
  return (ctru + costoEnvioFijo) / denom;
}

/** Canal de entrada para el builder (del maestro CanalVenta · comisionPorcentaje 0-100). */
export interface CanalParaPiso {
  id: string;
  nombre: string;
  comisionPorcentaje?: number;   // del maestro CanalVenta (0-100 · ML=13, Directa=0)
  costoEnvioFijo?: number;       // PEN por venta, opcional (futuro · default 0)
}

/** Matriz de pisos de un producto en un canal. */
export interface PrecioMinimoCanal {
  canalId: string;
  canalNombre: string;
  comisionPct: number;           // 0-100 (para display)
  costoEnvioCanal: number;
  pisoAbsoluto: number;          // DON'T-LOSE (margen 0)
  piso10: number;
  piso20: number;
  piso30: number;
}

/**
 * Construye la matriz piso × canal × margen para un producto, a partir de su CTRU
 * limpio y los canales activos del maestro. Normaliza comisionPorcentaje (0-100) a
 * fracción. El piso de un canal sin comisión == la fórmula legacy CTRU/(1-margen).
 */
export function buildPisosPorCanal(ctru: number, canales: CanalParaPiso[]): PrecioMinimoCanal[] {
  return canales.map((c) => {
    const comisionFraccion = (c.comisionPorcentaje ?? 0) / 100;
    const costoEnvioFijo = c.costoEnvioFijo ?? 0;
    const piso = (margen: number) =>
      calcPisoCanal({ ctru, comisionFraccion, costoEnvioFijo, margenObjetivoFraccion: margen });
    return {
      canalId: c.id,
      canalNombre: c.nombre,
      comisionPct: c.comisionPorcentaje ?? 0,
      costoEnvioCanal: costoEnvioFijo,
      pisoAbsoluto: piso(0),
      piso10: piso(0.1),
      piso20: piso(0.2),
      piso30: piso(0.3),
    };
  });
}
