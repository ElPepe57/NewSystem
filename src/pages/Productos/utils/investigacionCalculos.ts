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
