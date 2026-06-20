/**
 * reserva.helper · lógica PURA del ciclo de reserva de unidades (F4 · Fase C · C1).
 *
 * Sin I/O · testeable directo. Fuente de:
 *   - vigencia por origen (override por origen · decisión 2026-06-20: venta 48h · cotización 90d ·
 *     ml 60d · requerimiento = NO expira (demanda comprometida · se libera solo al cancelar req/OC)).
 *   - estado de restauración por PAÍS al liberar (origen → recibida_origen · Perú → disponible_peru).
 *   - consolidación del dueño de la reserva (schema nuevo `reserva.para` + planos legacy).
 *
 * Lo consumen los writers (C3), el punto único `liberarUnidades` (C2) y el cron (C5).
 */
import { esPaisOrigen } from '../utils/multiOrigen.helpers';
import type { EstadoUnidad, OrigenReserva } from '../types/unidad.types';

const H = 60 * 60 * 1000;
const D = 24 * H;

/** Vigencia por defecto por origen, en ms desde `fechaReserva`. `null` = no expira por tiempo. */
export const VIGENCIA_MS_POR_ORIGEN: Record<OrigenReserva, number | null> = {
  venta: 48 * H,        // 48 horas
  cotizacion: 90 * D,   // 90 días
  ml: 60 * D,           // 60 días (orden ML confirmada · fallback)
  requerimiento: null,  // demanda comprometida · NO expira (decisión)
};

/** Fallback cuando el origen no está en el mapa. */
export const VIGENCIA_FALLBACK_MS = 60 * D;

/**
 * Calcula el expiry (ms epoch) de una reserva. `null` = no expira.
 * `overrideMs` permite la vigencia ajustable (config) — `null` fuerza no-expira; `undefined` usa el default del origen.
 */
export function calcularVigenciaReservaMs(
  fechaReservaMs: number,
  origen: OrigenReserva,
  overrideMs?: number | null
): number | null {
  if (overrideMs !== undefined) return overrideMs === null ? null : fechaReservaMs + overrideMs;
  const dur = VIGENCIA_MS_POR_ORIGEN[origen];
  const efectiva = dur === undefined ? VIGENCIA_FALLBACK_MS : dur;
  return efectiva === null ? null : fechaReservaMs + efectiva;
}

/**
 * Estado al que vuelve una unidad al LIBERAR su reserva, según su país.
 * Unidad en país de ORIGEN (USA/China/…) → 'recibida_origen' · Perú → 'disponible_peru'.
 * (Replica unidad.service.ts:862 · NO hardcodea 'disponible' como el cron roto.)
 */
export function resolverEstadoLiberacion(pais: string | undefined | null): EstadoUnidad {
  return esPaisOrigen(pais || '') ? 'recibida_origen' : 'disponible_peru';
}

interface UnidadReservaLike {
  reserva?: { para?: string } | null;
  reservadaPara?: string | null;
  reservadoPara?: string | null;
}
/** ID del doc dueño de la reserva · consolida el schema nuevo (`reserva.para`) + los 2 planos legacy. */
export function getReservaPara(u: UnidadReservaLike): string | null {
  return u.reserva?.para ?? u.reservadaPara ?? u.reservadoPara ?? null;
}

/** ¿La reserva está vencida a `nowMs`? `vigenciaHasta = null` = nunca vence (demanda comprometida). */
export function esReservaVencida(vigenciaHastaMs: number | null, nowMs: number): boolean {
  return vigenciaHastaMs == null ? false : vigenciaHastaMs <= nowMs;
}
