/**
 * investigacionCalculos · Helper compartido de cálculos en vivo de investigación
 *
 * Origen del refactor (Fase H+): garantizar que TabInvestigacion (modal detalle),
 * cards del listado, sort comparators y herramientas (calculadora, sugerencias)
 * usen EXACTAMENTE la misma fórmula. Antes había 3 fuentes de verdad distintas:
 *   - service.guardarInvestigacion → ctruEstimado/margenEstimado guardados
 *   - TabInvestigacion → cálculo en vivo desde proveedores + flete + TC
 *   - cards/sort → leía campos legacy (ctruPromedio, ctruEstimado)
 *
 * Esta función reemplaza todo eso · UNA sola fuente de verdad.
 *
 * Fórmulas canónicas (mockup #42 v3.2):
 *   - mejor proveedor = sort(precio × (1+tax%)) ascendente
 *   - costoUSD = precio_mejor_prov × (1 + tax%) + flete_USD
 *   - costoPEN = costoUSD × TC
 *   - precioReferencia = MIN(competidores PEN) × 0.95
 *   - precioEfectivo = precioVenta manual O precioReferencia (si no hay manual)
 *   - margen = (precioEfectivo - costoPEN) / precioEfectivo × 100
 *   - utilidad/u = precioEfectivo - costoPEN
 */

import type { Producto } from '../../../types/producto.types';

export interface CalculosInvestigacion {
  // Proveedores
  mejorProveedorNombre: string | null;
  precioMejorProvUSD: number;
  taxMejorPct: number;
  // Flete & TC
  fleteUSD: number;
  tc: number;
  // Costo
  costoUSD: number;
  costoPEN: number;
  // Competencia
  competidoresCount: number;
  minComp: number;
  maxComp: number;
  promComp: number;
  // Precios
  precioReferencia: number;        // MIN(comp) × 0.95
  precioVentaManual: number;       // viene de producto.precioVenta
  precioEfectivo: number;          // manual si > 0, sino referencia
  usaSugerido: boolean;            // true si precioEfectivo === precioReferencia
  // Análisis
  utilidad: number;                // precioEfectivo - costoPEN
  margenPct: number;               // % sobre precioEfectivo
  // Ranking
  posicion: number;                // posición en el mercado vs competidores
  totalRanking: number;
  vsSugeridoPct: number;           // solo si hay precio manual
  // Estado
  tieneInvestigacion: boolean;
  tieneProveedores: boolean;
  tieneCompetidores: boolean;
  esCompleta: boolean;             // ambos = puede mostrarse en cards
}

const TC_DEFAULT = 3.7;

/**
 * Calcula todos los derivados de investigación EN VIVO desde el producto.
 *
 * @param producto - Producto con su sub-objeto investigacion
 * @param tcOverride - Tipo de cambio (USD→PEN). Si no se pasa, usa 3.7
 * @param fleteOverride - Override de flete (UI permite editarlo en TabInv).
 *                        Si no se pasa, usa producto.costoFleteInternacional
 */
export function calcularInvestigacion(
  producto: Producto | null | undefined,
  tcOverride?: number,
  fleteOverride?: number,
): CalculosInvestigacion {
  const inv = producto?.investigacion;
  const proveedores = inv?.proveedoresUSA ?? [];
  const competidores = inv?.competidoresPeru ?? [];
  const tc = tcOverride && tcOverride > 0 ? tcOverride : TC_DEFAULT;
  const fleteUSD = fleteOverride !== undefined && fleteOverride >= 0
    ? fleteOverride
    : (producto?.costoFleteInternacional ?? 0);

  // Mejor proveedor por precio efectivo (precio × (1+tax%))
  const proveedoresOrdenados = [...proveedores].sort((a, b) => {
    const efA = (a.precio ?? 0) * (1 + (a.impuesto ?? 0) / 100);
    const efB = (b.precio ?? 0) * (1 + (b.impuesto ?? 0) / 100);
    return efA - efB;
  });
  const mejorProv = proveedoresOrdenados[0];
  const precioMejorProvUSD = mejorProv?.precio ?? 0;
  const taxMejorPct = mejorProv?.impuesto ?? 0;

  // Costo unitario
  const costoUSD = precioMejorProvUSD > 0
    ? precioMejorProvUSD * (1 + taxMejorPct / 100) + fleteUSD
    : 0;
  const costoPEN = costoUSD * tc;

  // Competencia
  const competidoresOrdenados = [...competidores].sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0));
  const minComp = competidoresOrdenados[0]?.precio ?? 0;
  const maxComp = competidoresOrdenados[competidoresOrdenados.length - 1]?.precio ?? 0;
  const promComp = competidores.length > 0
    ? competidores.reduce((s, c) => s + (c.precio ?? 0), 0) / competidores.length
    : 0;

  // Precios
  const precioReferencia = minComp > 0 ? minComp * 0.95 : 0;
  const precioVentaManual = (producto as any)?.precioVenta ?? 0;
  const usaSugerido = !precioVentaManual || precioVentaManual <= 0;
  const precioEfectivo = usaSugerido ? precioReferencia : precioVentaManual;

  // Análisis
  const utilidad = precioEfectivo > 0 && costoPEN > 0 ? precioEfectivo - costoPEN : 0;
  const margenPct = precioEfectivo > 0 && costoPEN > 0
    ? ((precioEfectivo - costoPEN) / precioEfectivo) * 100
    : 0;

  // Ranking
  const ranking = [...competidores.map(c => c.precio ?? 0), precioEfectivo]
    .filter(p => p > 0)
    .sort((a, b) => a - b);
  const posicion = precioEfectivo > 0 ? ranking.indexOf(precioEfectivo) + 1 : 0;
  const totalRanking = ranking.length;

  const vsSugeridoPct = precioReferencia > 0 && precioVentaManual > 0
    ? ((precioVentaManual - precioReferencia) / precioReferencia) * 100
    : 0;

  return {
    mejorProveedorNombre: mejorProv?.nombre ?? null,
    precioMejorProvUSD,
    taxMejorPct,
    fleteUSD,
    tc,
    costoUSD,
    costoPEN,
    competidoresCount: competidores.length,
    minComp,
    maxComp,
    promComp,
    precioReferencia,
    precioVentaManual,
    precioEfectivo,
    usaSugerido,
    utilidad,
    margenPct,
    posicion,
    totalRanking,
    vsSugeridoPct,
    tieneInvestigacion: !!inv,
    tieneProveedores: proveedores.length > 0,
    tieneCompetidores: competidores.length > 0,
    esCompleta: proveedores.length > 0 && competidores.length > 0,
  };
}

/**
 * Helper rápido · solo el margen % en vivo (cards + sort).
 * Devuelve null si no se puede calcular (sin investigación completa).
 */
export function getMargenEnVivo(producto: Producto | null | undefined, tc?: number): number | null {
  const c = calcularInvestigacion(producto, tc);
  if (!c.esCompleta || c.precioEfectivo <= 0 || c.costoPEN <= 0) return null;
  return Math.round(c.margenPct * 10) / 10; // 1 decimal
}

/**
 * Helper rápido · precio efectivo en vivo (cards · "PRECIO VENTA" + ordenamiento).
 */
export function getPrecioEfectivoEnVivo(producto: Producto | null | undefined, tc?: number): number {
  return calcularInvestigacion(producto, tc).precioEfectivo;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACIERTO vs REALIDAD · Variance Analysis (Fase H+ · Productos Intel)
// ═══════════════════════════════════════════════════════════════════════════
//
// Compara la EXPECTATIVA (de la investigación) vs la REALIDAD (de la operación)
// en 3 ejes:
//   1. Costo unitario:  estimado en investigación vs CTRU real (promedio)
//   2. Precio venta:    sugerido (MIN comp × 0.95) vs precio manual confirmado
//   3. Margen:          esperado vs realizado (derivado de los anteriores)
//
// Sirve para que el usuario aprenda qué tan bien investiga · cuando un score
// está bajo, indica que su metodología de investigación necesita ajuste.
//
// LIMITACIÓN ACTUAL · DEUDA-PV2-INV-SNAPSHOTS
// La investigación es mutable · si el usuario re-investiga después de comprar,
// estamos comparando CTRU real vs investigación ACTUALIZADA (no la del momento
// de la decisión). Es engañoso si los precios del mercado fluctuaron mucho.
// Solución futura: snapshot automático al confirmar OC.

export type EtiquetaAcierto = 'acierto' | 'medio' | 'desvio' | 'en_curso';

export interface EjeComparativo {
  esperado: number | null;
  obtenido: number | null;
  variacionPct: number | null;  // (obt - esp) / esp · puede ser negativa
}

export interface AciertoInversion {
  /** Score 0-100 · más alto = más certero · null si no hay base */
  score: number | null;
  /** Etiqueta visual semáforo */
  etiqueta: EtiquetaAcierto;
  /** Detalle por eje · permite tooltip explicativo */
  costo: EjeComparativo;
  precio: EjeComparativo;
  margen: EjeComparativo;
  /** Promedio de variación absoluta de los ejes con data */
  variacionPromedioPct: number | null;
}

/**
 * Calcula el acierto de la inversión comparando expectativa vs realidad.
 *
 * Casos:
 * - Sin investigación completa (proveedores+competidores) → null
 * - Con investigación pero sin operación real (sin CTRU promedio ni precio
 *   manual) → 'en_curso' · score null · "esperando data"
 * - Con investigación + al menos 1 eje con data real → score calculado
 */
export function calcularAciertoInversion(
  producto: Producto | null | undefined,
  tc?: number,
): AciertoInversion | null {
  if (!producto) return null;
  const calc = calcularInvestigacion(producto, tc);

  // Requisito mínimo: investigación completa (al menos 1 prov + 1 comp)
  if (!calc.esCompleta) return null;

  // ── EJE 1 · COSTO UNITARIO ──────────────────────────────────────────────
  // Esperado: costoPEN derivado de investigación · Real: ctruPromedio
  const ctruReal = (producto as any).ctruPromedio;
  const costoEsp = calc.costoPEN > 0 ? calc.costoPEN : null;
  const costoReal = typeof ctruReal === 'number' && ctruReal > 0 ? ctruReal : null;
  const costo: EjeComparativo = {
    esperado: costoEsp,
    obtenido: costoReal,
    variacionPct: costoEsp !== null && costoReal !== null && costoEsp > 0
      ? ((costoReal - costoEsp) / costoEsp) * 100
      : null,
  };

  // ── EJE 2 · PRECIO VENTA ────────────────────────────────────────────────
  // Esperado: precioReferencia (MIN comp × 0.95) · Real: precio manual confirmado
  const precioManual = (producto as any).precioVenta;
  const precioEsp = calc.precioReferencia > 0 ? calc.precioReferencia : null;
  const precioReal = typeof precioManual === 'number' && precioManual > 0 ? precioManual : null;
  const precio: EjeComparativo = {
    esperado: precioEsp,
    obtenido: precioReal,
    variacionPct: precioEsp !== null && precioReal !== null && precioEsp > 0
      ? ((precioReal - precioEsp) / precioEsp) * 100
      : null,
  };

  // ── EJE 3 · MARGEN % ────────────────────────────────────────────────────
  // Esperado: (precioRef − costoEsp) / precioRef · Real: (precioReal − costoReal) / precioReal
  const margenEsp = precioEsp !== null && costoEsp !== null && precioEsp > 0
    ? ((precioEsp - costoEsp) / precioEsp) * 100
    : null;
  const margenReal = precioReal !== null && costoReal !== null && precioReal > 0
    ? ((precioReal - costoReal) / precioReal) * 100
    : null;
  const margen: EjeComparativo = {
    esperado: margenEsp,
    obtenido: margenReal,
    variacionPct: margenEsp !== null && margenReal !== null && Math.abs(margenEsp) > 0.01
      ? ((margenReal - margenEsp) / Math.abs(margenEsp)) * 100
      : null,
  };

  // ── SCORE Y ETIQUETA ────────────────────────────────────────────────────
  const variaciones = [costo.variacionPct, precio.variacionPct, margen.variacionPct]
    .filter((v): v is number => v !== null)
    .map(v => Math.abs(v));

  if (variaciones.length === 0) {
    // Hay investigación pero ningún eje con data real todavía
    return {
      score: null,
      etiqueta: 'en_curso',
      costo, precio, margen,
      variacionPromedioPct: null,
    };
  }

  const variacionPromedio = variaciones.reduce((s, v) => s + v, 0) / variaciones.length;

  // Score: 100 si variación promedio = 0 · 0 si variación >= 50%
  const score = Math.max(0, Math.min(100, Math.round(100 - variacionPromedio * 2)));

  let etiqueta: EtiquetaAcierto;
  if (variacionPromedio < 10) etiqueta = 'acierto';
  else if (variacionPromedio < 25) etiqueta = 'medio';
  else etiqueta = 'desvio';

  return {
    score,
    etiqueta,
    costo, precio, margen,
    variacionPromedioPct: variacionPromedio,
  };
}
