/**
 * functions/src/ctru.util.ts
 *
 * ⚠️ ESPEJO de src/utils/ctru.utils.ts (getCTRU / getCostoBasePEN / getTC / sumarComponentesCosto).
 * functions/ es un codebase AISLADO (no importa de src/), por eso el cálculo de CTRU se COPIA acá.
 * Si cambiás la lógica de costo en src/utils/ctru.utils.ts, replicá el cambio acá (riesgo de drift).
 *
 * Fase B2: ml.orderProcessor congela el costo de venta de una orden ML con getCTRUUnidad,
 * para que el costo de una unidad sea IDÉNTICO en la web (getCTRU) y en la Cloud Function.
 * REINGENIERIA Acuerdo 3: GA/GO NO se incluyen en el CTRU.
 */

interface ComponenteCostoLike {
  montoPEN?: number;
}

/** Subconjunto de campos de Unidad que el cálculo de costo necesita (doc Firestore crudo). */
export interface UnidadCostoInput {
  componentesCosto?: ComponenteCostoLike[] | null;
  costosLandedPEN?: number;
  costoUnitarioUSD?: number;
  costoFleteUSD?: number;
  costoRecojoPEN?: number;
  ctruInicial?: number;
  ctruDinamico?: number;
  costoGAGOAsignado?: number;
  tcPago?: number;
  tcCompra?: number;
}

/** Suma neta de los componentes de costo congelados (los descuentos entran con montoPEN negativo). */
export function sumarComponentesCosto(componentes?: ComponenteCostoLike[] | null): number {
  if (!componentes || componentes.length === 0) return 0;
  return componentes.reduce((sum, c) => sum + (c?.montoPEN || 0), 0);
}

/** TC aplicable de una unidad. Prioridad: tcPago > tcCompra. */
function getTC(u: UnidadCostoInput): number {
  return u.tcPago || u.tcCompra || 0;
}

/**
 * CTRU (Costo Total Real por Unidad) — ESPEJO EXACTO de src getCTRU (prioridades 0-3 + fallback).
 * GA/GO NO se incluyen (Acuerdo 3).
 */
export function getCTRUUnidad(u: UnidadCostoInput): number {
  // Prioridad 0: modelo adaptativo — si hay componentes congelados, el CTRU es su suma neta.
  if (u.componentesCosto && u.componentesCosto.length > 0) {
    return sumarComponentesCosto(u.componentesCosto);
  }

  // Prioridad 1: costos landed del nuevo modelo (Envío) + precio de producto.
  if (u.costosLandedPEN && u.costosLandedPEN > 0) {
    const tc = getTC(u);
    return (u.costoUnitarioUSD || 0) * tc + u.costosLandedPEN;
  }

  // Prioridad 2: costoFleteUSD del modelo legacy (transferencia) → costo base (precio + flete + recojo) en PEN.
  const costoFleteUSD = u.costoFleteUSD || 0;
  if (costoFleteUSD > 0) {
    const tc = getTC(u);
    return ((u.costoUnitarioUSD || 0) + costoFleteUSD) * tc + (u.costoRecojoPEN || 0);
  }

  // Prioridad 3: valores almacenados (ctruInicial limpio preferido sobre ctruDinamico, que puede incluir GA/GO).
  if (u.ctruInicial && u.ctruInicial > 0) return u.ctruInicial;
  if (u.ctruDinamico && u.ctruDinamico > 0) {
    return u.ctruDinamico - (u.costoGAGOAsignado || 0);
  }

  // Fallback: cálculo manual.
  return (u.costoUnitarioUSD || 0) * getTC(u);
}
