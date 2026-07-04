/**
 * impactoCompras.helper · Tab "Impacto financiero" del hub de Compras (Acto 16 · lente de
 * dinero de SOLO-LECTURA).
 *
 * Helpers PUROS compartidos entre `TabImpactoCompras` (detalle §E · calendario de caja +
 * exposición FX) y `TabResumenCompras` (teaser de 1 línea · adjudicación de no-redundancia
 * n°3: los bloques MIGRARON del Resumen al Impacto · el Resumen solo teasea con cross-link).
 * Fuente ÚNICA del cálculo — prohibido re-implementarlo en cada tab.
 *
 * HONESTIDAD del modelo (2026-07-03):
 *  · NO existe fecha de vencimiento pactada de pago de OC → el "cuándo golpea" se ESTIMA
 *    por antigüedad del débito (más antigua = más urgente) y se rotula "estimación".
 *  · Un BORRADOR no es deuda: el débito en CC nace al confirmar (c52e904) → los agregados
 *    de dinero EXCLUYEN borradores (su golpe se ve solo en la simulación §C del Impacto).
 */
import type { OrdenCompra } from '../../types/ordenCompra.types';

const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const o = v as { toDate?: () => Date; seconds?: number };
  if (typeof o.toDate === 'function') return o.toDate();
  if (typeof o.seconds === 'number') return new Date(o.seconds * 1000);
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  return null;
};

export const diasDesdeImpacto = (v: unknown): number | null => {
  const d = toDate(v);
  return d ? (Date.now() - d.getTime()) / 86400000 : null;
};

/**
 * Saldo pendiente en USD de una OC · MISMA fórmula que `statsExtra` del hub
 * (montoPendiente denormalizado en PEN / tcRef · fallback totalUSD) → los desgloses
 * de la tab CUADRAN con el "Por pagar" del strip.
 */
export const pendienteUsdDeOC = (o: OrdenCompra): number => {
  const tcRef = o.tcReferencial || o.tcCompra || 1;
  return o.montoPendiente ? o.montoPendiente / tcRef : (o.totalUSD || 0);
};

/** Deuda viva = OC COMPROMETIDA (ni borrador ni cancelada) con saldo pendiente o parcial. */
export const esDeudaViva = (o: OrdenCompra): boolean =>
  o.estado !== 'cancelada' &&
  o.estado !== 'borrador' &&
  (o.estadoPago === 'pendiente' || o.estadoPago === 'parcial');

// ─── Calendario de caja (¿CUÁNDO golpea la deuda?) · estimación por antigüedad ──────────

export interface CalendarioCajaCompras {
  /** Estimado a salir en ~7 días (deuda más antigua · +21d). */
  d7: number;
  /** Estimado a ~15 días (11-21d de antigüedad). */
  d15: number;
  /** Estimado a ~30 días (≤10d de antigüedad). */
  d30: number;
  max: number;
  total: number;
  hayDatos: boolean;
}

export function calcularCalendarioCajaCompras(ordenes: OrdenCompra[]): CalendarioCajaCompras {
  let d7 = 0, d15 = 0, d30 = 0;
  for (const o of ordenes) {
    if (!esDeudaViva(o)) continue;
    const pendUSD = pendienteUsdDeOC(o);
    if (pendUSD <= 0.01) continue;
    const dias = diasDesdeImpacto(o.fechaCreacion) ?? 0;
    // Heurística honesta: más antigua = vence antes (más urgente).
    if (dias > 21) d7 += pendUSD;
    else if (dias > 10) d15 += pendUSD;
    else d30 += pendUSD;
  }
  const total = d7 + d15 + d30;
  return { d7, d15, d30, max: Math.max(d7, d15, d30, 1), total, hayDatos: total > 0 };
}

// ─── Exposición FX de la deuda (TC pactado al confirmar vs TC hoy) ───────────────────────

export interface ExposicionFxCompras {
  /** Σ saldos USD con TC pactado conocido (base medible del diferencial). */
  deudaUSD: number;
  /** # OCs con saldo pendiente y TC pactado. */
  pagosPendientes: number;
  /** TC pactado promedio, ponderado por saldo. null = sin datos medibles. */
  tcPromedioPactado: number | null;
  /** Variación % del TC hoy vs el pactado. null = sin datos. */
  deltaPct: number | null;
  /** PEN extra (>0 = pagar hoy cuesta MÁS que lo previsto) si se pagara todo hoy. */
  impactoPEN: number;
  hayTC: boolean;
}

export function calcularExposicionFxCompras(ordenes: OrdenCompra[], tcHoy: number): ExposicionFxCompras {
  if (!tcHoy) {
    return { deudaUSD: 0, pagosPendientes: 0, tcPromedioPactado: null, deltaPct: null, impactoPEN: 0, hayTC: false };
  }
  let deudaUSD = 0, ponderado = 0, impactoPEN = 0, pagos = 0;
  for (const o of ordenes) {
    if (!esDeudaViva(o)) continue;
    const tcRef = o.tcReferencial || o.tcCompra;
    if (!tcRef) continue; // sin TC pactado no hay diferencial medible (no se inventa)
    const pendUSD = o.montoPendiente ? o.montoPendiente / tcRef : (o.totalUSD || 0);
    if (pendUSD <= 0.01) continue;
    deudaUSD += pendUSD;
    ponderado += pendUSD * tcRef;
    impactoPEN += pendUSD * (tcHoy - tcRef);
    pagos++;
  }
  const tcProm = deudaUSD > 0 ? ponderado / deudaUSD : null;
  const deltaPct = tcProm ? ((tcHoy - tcProm) / tcProm) * 100 : null;
  return {
    deudaUSD,
    pagosPendientes: pagos,
    tcPromedioPactado: tcProm,
    deltaPct,
    impactoPEN: Math.round(impactoPEN),
    hayTC: true,
  };
}
