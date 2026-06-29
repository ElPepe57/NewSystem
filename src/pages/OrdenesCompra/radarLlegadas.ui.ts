/**
 * radarLlegadas.ui · tokens semánticos de la tab Llegadas (gravedad del atraso).
 *
 * Color SEMÁNTICO en el DATO (canon v8.0 N1): leve=amber · severo=rose-400 · crítico=rose-strong.
 * El chrome del módulo (blue · Comercial) NO pinta el dato. Pixel del mockup compras-llegadas-v1.html.
 */

import type { GravedadAtraso } from './radarAtrasados.helper';

export interface GravedadMeta {
  label: string;
  /** Borde izquierdo de la fila (refuerza la gravedad · mockup border-l-4). */
  borderL: string;
  /** Hover de la fila. */
  hover: string;
  /** Color del icono de envío (ship). */
  shipIcon: string;
  /** Color del número de días (héroe del atraso). */
  dias: string;
  /** Color de la barra de progreso del atraso. */
  bar: string;
  /** Badge de gravedad (chip "crítico 2.2×"). */
  badge: string;
  /** Banner de contexto del atraso (en el modal). */
  banner: string;
  bannerIcon: string;
  bannerText: string;
}

export const GRAVEDAD_META: Record<GravedadAtraso, GravedadMeta> = {
  critico: {
    label: 'crítico',
    borderL: 'border-l-rose-500',
    hover: 'hover:bg-rose-50/30',
    shipIcon: 'text-rose-500',
    dias: 'text-rose-900',
    bar: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800 border border-rose-300',
    banner: 'bg-rose-50/60 border border-rose-200',
    bannerIcon: 'text-rose-600',
    bannerText: 'text-rose-800',
  },
  severo: {
    label: 'severo',
    borderL: 'border-l-rose-400',
    hover: 'hover:bg-rose-50/20',
    shipIcon: 'text-rose-400',
    dias: 'text-rose-900',
    bar: 'bg-rose-400',
    badge: 'bg-rose-50 text-rose-700 border border-rose-200',
    banner: 'bg-rose-50/60 border border-rose-200',
    bannerIcon: 'text-rose-600',
    bannerText: 'text-rose-800',
  },
  leve: {
    label: 'leve',
    borderL: 'border-l-amber-400',
    hover: 'hover:bg-amber-50/20',
    shipIcon: 'text-amber-500',
    dias: 'text-amber-900',
    bar: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    banner: 'bg-amber-50/60 border border-amber-200',
    bannerIcon: 'text-amber-600',
    bannerText: 'text-amber-800',
  },
};

/** Ancho de la barra de progreso del atraso (clamp visual · ratio 1→~50%, 2+→100%). */
export function barWidthPct(ratio: number): number {
  // leve (1-1.5)→ ~50-75% · severo (1.5-2)→ ~75-100% · crítico (>2)→ 100%
  return Math.min(100, Math.max(40, Math.round((ratio / 2) * 100)));
}
