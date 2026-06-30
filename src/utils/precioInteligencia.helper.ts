/**
 * precioInteligencia.helper · Fase A · MOTOR PURO del Lente 2 (inteligencia de precio al comprar).
 *
 * Responde, al momento de tipear el costo de un producto en una OC: "¿es buen precio para
 * comprar HOY?" — semáforo (vs tu propio histórico · crudo-vs-crudo · SEAM-A) + margen proyectado
 * (landed · live) + score de viabilidad (fórmula 40/30/20/10 preservada de WizardStepInteligencia).
 *
 * Es el CONTRATO COMPARTIDO: lo consumen ambas vías de creación (OCWizardV3 + OCBuilder) y el
 * snapshot de forecast al confirmar. 100% puro y testeable — el caller provee la referencia de
 * precio (getReferenciaPreciosEnMemoria), la investigación VIVA (calcularInvestigacion) y los cargos.
 *
 * FIX de 3 bugs que cegaban el Lente 2 (era WizardStepInteligencia):
 *   1. Margen/PVP leían campos DEPRECADOS (inv.precioPERUMin/precioSugeridoCalculado/margenEstimado
 *      = 0 en investigaciones nuevas) → ahora vienen de calcularInvestigacion (precioEfectivo · VIVO).
 *   2. Doble fuente de PVP (precioPERUMin*0.95 vs precioReferencia) → una sola (precioEfectivo).
 *   3. base del delta ≠ número sugerido → UNA base de comparación unificada (promedio histórico crudo).
 *
 * SEAM-A: el semáforo compara CRUDO-vs-CRUDO (lo que negociás vs tu histórico crudo) · el margen usa
 * el costo LANDED (con cargos prorrateados · costo real). Dos lentes distintos, rotulados distinto.
 */

export type VeredictoPrecio =
  | 'excelente'        // claramente más barato que tu base
  | 'en_rango'         // dentro de lo normal
  | 'caro'             // por encima de tu base
  | 'no_recomendable'  // muy por encima
  | 'sin_referencia';  // no hay base contra la cual comparar (no se inventa)

export type ScoreTone = 'emerald' | 'amber' | 'rose' | 'slate';

/** Referencia de precio histórico del SKU (de getReferenciaPreciosEnMemoria · crudo USD). */
export interface ReferenciaPrecio {
  ultimaCompra: number | null;
  promedio: number | null;
  nMuestras: number;
}

/** Subconjunto VIVO de calcularInvestigacion (NO los campos deprecados de producto.investigacion). */
export interface InvestigacionViva {
  precioMejorProvUSD: number;  // mejor proveedor (crudo USD)
  precioEfectivo: number;      // PVP efectivo PEN (manual o MIN(comp)×0.95) · fuente única de PVP
  tieneProveedores: boolean;
  tieneCompetidores: boolean;
}

export interface AnalisisPrecioInput {
  /** Costo unitario que el comprador TIPEA (crudo USD). */
  costoUnitarioUSD: number;
  /** (cargos − descuentos) / unidades · prorrateado por unidad (crudo USD). */
  costoAdicionalPorUnidadUSD: number;
  /** Tipo de cambio USD→PEN. */
  tc: number;
  /** Referencia histórica del SKU (crudo). */
  referencia: ReferenciaPrecio;
  /** Investigación VIVA (de calcularInvestigacion) · null si no hay. */
  investigacion: InvestigacionViva | null;
  /** Puntuación de viabilidad de la investigación (0-100) · opcional (factor 10% del score). */
  puntuacionViabilidad?: number;
}

export interface AnalisisPrecioResult {
  // ── Semáforo de precio (crudo vs crudo · negociación) ──
  /** Base unificada contra la que se compara (crudo USD) · null = sin referencia. */
  baseComparacionUSD: number | null;
  /** Origen de la base (para rotular honesto). */
  fuenteBase: 'historico' | 'mercado' | 'ninguna';
  /** (costo − base) / base × 100 · null si no hay base. >0 = más caro que tu base. */
  deltaPct: number | null;
  veredicto: VeredictoPrecio;
  // ── Margen (landed · live) ──
  /** Costo aterrizado por unidad en PEN = (costo + adicional) × tc · null si no calculable. */
  landedUnitPEN: number | null;
  /** PVP efectivo PEN (de la investigación viva · fuente única) · null si no hay. */
  precioVentaPEN: number | null;
  /** Margen % sobre el PVP · null si no calculable. */
  margenPct: number | null;
  // ── Score holístico (40/30/20/10 · preservado) ──
  /** 0-100 · 0 = sin datos suficientes. */
  score: number;
  scoreLabel: string;
  scoreTone: ScoreTone;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Umbrales del semáforo de precio (delta % vs base · crudo). */
export const DELTA_EXCELENTE = -5; // ≤ -5% = excelente
export const DELTA_EN_RANGO = 3;   // ≤ +3% = en rango
export const DELTA_CARO = 10;      // ≤ +10% = caro · > = no recomendable

/** Semáforo de precio: ¿buen precio para comprar HOY, vs tu propio histórico (crudo)? */
function clasificarVeredicto(deltaPct: number | null): VeredictoPrecio {
  if (deltaPct === null) return 'sin_referencia';
  if (deltaPct <= DELTA_EXCELENTE) return 'excelente';
  if (deltaPct <= DELTA_EN_RANGO) return 'en_rango';
  if (deltaPct <= DELTA_CARO) return 'caro';
  return 'no_recomendable';
}

/** Etiqueta + tono del score holístico (preservado de scoreLabelAndTone · red→rose para DS).
 *  Exportado para reusar en el score AGREGADO de la OC (useAnalisisOC · "Salud de la compra"). */
export function scoreLabelAndTone(score: number): { label: string; tone: ScoreTone } {
  if (score === 0) return { label: 'Sin datos suficientes', tone: 'slate' };
  if (score >= 85) return { label: 'Excelente · comprar', tone: 'emerald' };
  if (score >= 70) return { label: 'Bueno · comprar', tone: 'emerald' };
  if (score >= 55) return { label: 'Aceptable · revisar', tone: 'amber' };
  if (score >= 40) return { label: 'Dudoso · revisar', tone: 'amber' };
  return { label: 'No recomendable', tone: 'rose' };
}

/**
 * Score de viabilidad 40/30/20/10 (precio / margen / carga / viabilidad) · re-normalizado por peso
 * de los factores con datos. Preservado de WizardStepInteligencia.computeScore, pero alimentado con
 * los valores VIVOS (mejor proveedor + PVP efectivo de calcularInvestigacion · NO los deprecados).
 */
function computeScore(input: AnalisisPrecioInput, landedUnitPEN: number | null, margenPct: number | null): number {
  const { costoUnitarioUSD: costo, referencia, investigacion, puntuacionViabilidad } = input;
  let total = 0;
  let weight = 0;

  // 1 · Precio (40%) — vs mejor proveedor (si hay investigación) o vs tu histórico.
  const mejorProv = investigacion && investigacion.precioMejorProvUSD > 0 ? investigacion.precioMejorProvUSD : null;
  if (mejorProv && costo > 0) {
    const diff = ((costo - mejorProv) / mejorProv) * 100;
    const s = diff <= -5 ? 95 : diff <= 0 ? 85 : diff <= 2 ? 65 : diff <= 5 ? 45 : diff <= 10 ? 25 : 10;
    total += s * 40; weight += 40;
  } else if (referencia.promedio && referencia.promedio > 0 && costo > 0) {
    const diff = ((costo - referencia.promedio) / referencia.promedio) * 100;
    const s = diff <= -5 ? 90 : diff <= 0 ? 75 : diff <= 5 ? 50 : diff <= 10 ? 30 : 10;
    total += s * 40; weight += 40;
  }

  // 2 · Margen (30%) — landed (live) vs PVP efectivo (live).
  if (landedUnitPEN !== null && margenPct !== null) {
    const m = margenPct;
    const s = m >= 60 ? 90 : m >= 45 ? 75 : m >= 30 ? 60 : m >= 15 ? 35 : m >= 0 ? 15 : 5;
    total += s * 30; weight += 30;
  }

  // 3 · Carga (20%) — peso de los cargos prorrateados sobre el costo.
  if (costo > 0) {
    const chargeRatio = input.costoAdicionalPorUnidadUSD > 0 ? (input.costoAdicionalPorUnidadUSD / costo) * 100 : 0;
    const s = chargeRatio === 0 ? 70 : chargeRatio <= 5 ? 65 : chargeRatio <= 10 ? 55 : chargeRatio <= 20 ? 40 : chargeRatio <= 35 ? 25 : 10;
    total += s * 20; weight += 20;
  }

  // 4 · Viabilidad (10%) — de la investigación (si existe).
  if (puntuacionViabilidad && puntuacionViabilidad > 0) {
    total += puntuacionViabilidad * 10; weight += 10;
  }

  return weight > 0 ? Math.round(total / weight) : 0;
}

/**
 * Analiza el precio de UN producto al momento de comprarlo. Puro · sin Firestore.
 */
export function analizarPrecio(input: AnalisisPrecioInput): AnalisisPrecioResult {
  const { costoUnitarioUSD: costo, costoAdicionalPorUnidadUSD: adicional, tc, referencia, investigacion } = input;

  // ── Base de comparación UNIFICADA (fix bug #3) · crudo vs crudo (SEAM-A) ──
  // Prioriza tu propio histórico (promedio crudo). Si no hay, cae al mejor proveedor de mercado.
  let baseComparacionUSD: number | null = null;
  let fuenteBase: AnalisisPrecioResult['fuenteBase'] = 'ninguna';
  if (referencia.promedio && referencia.promedio > 0) {
    baseComparacionUSD = referencia.promedio;
    fuenteBase = 'historico';
  } else if (investigacion && investigacion.precioMejorProvUSD > 0) {
    baseComparacionUSD = investigacion.precioMejorProvUSD;
    fuenteBase = 'mercado';
  }

  const deltaPct = baseComparacionUSD !== null && baseComparacionUSD > 0 && costo > 0
    ? round1(((costo - baseComparacionUSD) / baseComparacionUSD) * 100)
    : null;
  const veredicto = clasificarVeredicto(deltaPct);

  // ── Margen LANDED (live · fix bugs #1 y #2) ──
  const landedUnitPEN = costo > 0 && tc > 0 ? round1((costo + adicional) * tc) : null;
  const precioVentaPEN = investigacion && investigacion.precioEfectivo > 0 ? investigacion.precioEfectivo : null;
  const margenPct = landedUnitPEN !== null && precioVentaPEN !== null && precioVentaPEN > 0
    ? round1(((precioVentaPEN - landedUnitPEN) / precioVentaPEN) * 100)
    : null;

  const score = computeScore(input, landedUnitPEN, margenPct);
  const { label, tone } = scoreLabelAndTone(score);

  return {
    baseComparacionUSD,
    fuenteBase,
    deltaPct,
    veredicto,
    landedUnitPEN,
    precioVentaPEN,
    margenPct,
    score,
    scoreLabel: label,
    scoreTone: tone,
  };
}
