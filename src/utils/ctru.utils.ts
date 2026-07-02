import type { Unidad } from '../types/unidad.types';
import type { ComponenteCostoUnidad, CategoriaComponenteCosto } from '../types/ctru.types';

/**
 * Sumar los componentes de costo congelados de una unidad (modelo adaptativo).
 * Los descuentos entran con montoPEN negativo, así que la suma ya es neta.
 */
export function sumarComponentesCosto(componentes?: ComponenteCostoUnidad[] | null): number {
  if (!componentes || componentes.length === 0) return 0;
  return componentes.reduce((sum, c) => sum + (c?.montoPEN || 0), 0);
}

/**
 * Obtener el CTRU (Costo Total Real por Unidad) de una unidad.
 * Fuente unica de verdad para el calculo de CTRU.
 *
 * MODELO (limpieza 2026-07 · componentesCosto = fuente única · BD fresh-start,
 * ya sin unidades legacy con escalares ctru*):
 *
 *  (a) Unidad RECIBIDA → tiene componentesCosto[] CONGELADOS en la recepción
 *      (construirComponentesUnidad) → CTRU = Σ componentes (suma neta: los
 *      descuentos entran con montoPEN negativo).
 *  (b) Unidad NO recibida (pedida / en tránsito) → aún no tiene componentes →
 *      el costo es un ESTIMADO pre-recepción desde los inputs escalares:
 *      (costoUnitarioUSD + costoFleteUSD) × TC (getCostoBasePEN).
 *
 * GA/GO NO se incluyen en el CTRU (Acuerdo 3): los gastos del período se ven
 * en el P&L como "Gastos Fijos del Mes".
 */
export function getCTRU(unidad: Pick<Unidad, 'costoUnitarioUSD' | 'costoFleteUSD' | 'tcPago' | 'tcCompra' | 'componentesCosto'> & { costoRecojoPEN?: number }): number {
  // (a) Recibida: componentes congelados → el CTRU es su suma neta.
  if (unidad.componentesCosto && unidad.componentesCosto.length > 0) {
    return sumarComponentesCosto(unidad.componentesCosto);
  }

  // (b) No recibida: estimado pre-recepción por escalares.
  return getCostoBasePEN(unidad);
}

/**
 * Resumen del costo LANDED de una OC (re-home en el detalle de OC · "¿cuánto gasté?").
 * Suma getCTRU SOLO sobre las unidades ya aterrizadas (con componentesCosto congelados):
 * las no recibidas aún no tienen costo real, no se cuentan en el landed (quedan "pendientes").
 * Composición por capa para el desglose "¿dónde se va la plata?".
 * INVARIANTE: landedTotalPEN === capas.producto + capas.impuesto + capas.flete + capas.otros
 * (porque getCTRU de una unidad con componentes ES la suma de sus componentesCosto.montoPEN).
 */
export interface ResumenLandedOC {
  landedTotalPEN: number;
  unidadesConCosto: number;
  unidadesTotal: number;
  capas: { producto: number; impuesto: number; flete: number; otros: number };
}

const CAPA_DE_CATEGORIA: Record<CategoriaComponenteCosto, keyof ResumenLandedOC['capas']> = {
  producto: 'producto',
  impuesto: 'impuesto',
  flete: 'flete',
  recojo: 'flete',   // logística → flete
  landed: 'flete',   // cargos comerciales trasvasados → flete
  descuento: 'otros', // montoPEN negativo · reduce "otros"
  otro: 'otros',
};

export function resumirLandedOC(unidades: Unidad[]): ResumenLandedOC {
  const capas = { producto: 0, impuesto: 0, flete: 0, otros: 0 };
  let landedTotalPEN = 0;
  let unidadesConCosto = 0;
  for (const u of unidades) {
    if (!u.componentesCosto || u.componentesCosto.length === 0) continue;
    unidadesConCosto++;
    landedTotalPEN += getCTRU(u);
    for (const c of u.componentesCosto) {
      capas[CAPA_DE_CATEGORIA[c.categoria] ?? 'otros'] += c.montoPEN || 0;
    }
  }
  return { landedTotalPEN, unidadesConCosto, unidadesTotal: unidades.length, capas };
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
 *
 * - Con componentesCosto[] (unidad recibida): el costo base ES su suma (igual
 *   que getCTRU — no hay componente de overhead, así getCTRU===getCostoBasePEN).
 * - Sin componentes (unidad no recibida): ESTIMADO pre-recepción por escalares:
 *   (costoUnitarioUSD + costoFleteUSD) × TC + costoRecojoPEN.
 */
export function getCostoBasePEN(unidad: Pick<Unidad, 'costoUnitarioUSD' | 'costoFleteUSD' | 'tcPago' | 'tcCompra' | 'componentesCosto'> & { costoRecojoPEN?: number }): number {
  // Recibida: base = suma de componentes congelados.
  if (unidad.componentesCosto && unidad.componentesCosto.length > 0) {
    return sumarComponentesCosto(unidad.componentesCosto);
  }

  // No recibida: estimado por escalares.
  const tc = getTC(unidad);
  return ((unidad.costoUnitarioUSD || 0) + (unidad.costoFleteUSD || 0)) * tc + (unidad.costoRecojoPEN || 0);
}

/**
 * Calcular CTRU Real usando TCPA (del Pool USD) en lugar del TC historico.
 * REINGENIERIA: sin costoGAGOAsignado — GA/GO no tocan CTRU.
 *
 * - Con componentesCosto[] (unidad recibida): se revalúan al TCPA los que
 *   nacieron en USD (montoOrigenUSD); los que ya están en PEN se mantienen.
 * - Sin componentes (unidad no recibida): estimado (producto + flete) × TCPA.
 */
export function getCTRU_Real(
  unidad: Pick<Unidad, 'costoUnitarioUSD' | 'costoFleteUSD' | 'componentesCosto'>,
  tcpa: number
): number {
  if (tcpa <= 0) return 0;

  // Recibida: revaluar componentes congelados al TCPA gerencial.
  if (unidad.componentesCosto && unidad.componentesCosto.length > 0) {
    return unidad.componentesCosto.reduce((sum, c) => {
      if (c?.montoOrigenUSD != null) return sum + c.montoOrigenUSD * tcpa;
      return sum + (c?.montoPEN || 0);
    }, 0);
  }

  // No recibida: estimado pre-recepción al TCPA.
  return ((unidad.costoUnitarioUSD || 0) + (unidad.costoFleteUSD || 0)) * tcpa;
}

