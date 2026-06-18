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
 * REINGENIERIA: CTRU = precio producto (de OC) + costos landed (de Envio)
 * GA/GO ya NO se incluyen en el CTRU (Acuerdo 3).
 * Los gastos del periodo se ven en el P&L como "Gastos Fijos del Mes".
 *
 * MODELO ADAPTATIVO (fundación 2026-06-16): si la unidad tiene componentesCosto[]
 * congelados, el CTRU es su SUMA. Si no (unidades legacy sin componentes), se cae
 * al cálculo por escalares de abajo SIN cambios — backward-compat obligatorio
 * porque ningún doc histórico tiene componentesCosto todavía.
 */
export function getCTRU(unidad: Pick<Unidad, 'ctruDinamico' | 'ctruInicial' | 'costoUnitarioUSD' | 'costoFleteUSD' | 'tcPago' | 'tcCompra' | 'componentesCosto'> & { costoGAGOAsignado?: number; costosLandedPEN?: number }): number {
  // Prioridad 0: modelo adaptativo — si hay componentes congelados, el CTRU es su suma neta.
  if (unidad.componentesCosto && unidad.componentesCosto.length > 0) {
    return sumarComponentesCosto(unidad.componentesCosto);
  }

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
 * Formula: (costoUnitarioUSD + costoFleteUSD) x TC + costoRecojoPEN
 *
 * MODELO ADAPTATIVO: si hay componentesCosto[], el costo base ES su suma (igual
 * que getCTRU — no hay componente de overhead, así getCTRU===getCostoBasePEN y
 * desaparece la divergencia BUG-3/BUG-5). Si no, cálculo por escalares (legacy).
 */
export function getCostoBasePEN(unidad: Pick<Unidad, 'ctruInicial' | 'costoUnitarioUSD' | 'costoFleteUSD' | 'tcPago' | 'tcCompra' | 'componentesCosto'> & { costoRecojoPEN?: number }): number {
  // Prioridad 0: modelo adaptativo — base = suma de componentes congelados.
  if (unidad.componentesCosto && unidad.componentesCosto.length > 0) {
    return sumarComponentesCosto(unidad.componentesCosto);
  }

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
 *
 * MODELO ADAPTATIVO: si hay componentesCosto[], se revalúan al TCPA los que
 * nacieron en USD (montoOrigenUSD); los que ya están en PEN se mantienen.
 */
export function getCTRU_Real(
  unidad: Pick<Unidad, 'costoUnitarioUSD' | 'costoFleteUSD' | 'componentesCosto'> & { costosLandedPEN?: number },
  tcpa: number
): number {
  if (tcpa <= 0) return 0;

  // Prioridad 0: revaluar componentes congelados al TCPA gerencial.
  if (unidad.componentesCosto && unidad.componentesCosto.length > 0) {
    return unidad.componentesCosto.reduce((sum, c) => {
      if (c?.montoOrigenUSD != null) return sum + c.montoOrigenUSD * tcpa;
      return sum + (c?.montoPEN || 0);
    }, 0);
  }

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
