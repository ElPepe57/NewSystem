/**
 * DonutChart · canon v5.2 chk5.E-B
 *
 * Donut chart SVG nativo (sin biblioteca) para mostrar composición de un total.
 * Hasta N segmentos · auto-cálculo de %s · leyenda lateral con label + value + %.
 *
 * @example
 * <DonutChart
 *   total={458200}
 *   segments={[
 *     { label: 'Inventarios', value: 235000, color: 'blue' },
 *     { label: 'Efectivo', value: 124800, color: 'teal' },
 *     { label: 'CxC', value: 98400, color: 'purple' },
 *   ]}
 *   formatValue={(v) => formatCurrencyPEN(v)}
 *   ariaLabel="Composición del activo total"
 * />
 */

import React from 'react';

export type DonutSegmentColor =
  | 'emerald'
  | 'rose'
  | 'teal'
  | 'indigo'
  | 'amber'
  | 'sky'
  | 'purple'
  | 'blue'
  | 'slate';

export interface DonutSegment {
  label: string;
  value: number;
  color: DonutSegmentColor;
}

export interface DonutChartProps {
  /** Segmentos del donut · auto-calcula % cada uno */
  segments: DonutSegment[];
  /** Total opcional · si no se pasa, se calcula sumando segments */
  total?: number;
  /** Tamaño del SVG (clase Tailwind para w/h) · default w-24 h-24 */
  sizeClass?: string;
  /** Función para formatear valores (típicamente formatCurrencyPEN) */
  formatValue?: (v: number) => string;
  /** Mostrar leyenda lateral · default true */
  showLegend?: boolean;
  /** Posición de leyenda · 'right' (default) o 'bottom' */
  legendPosition?: 'right' | 'bottom';
  /** Label accesible */
  ariaLabel?: string;
}

const COLOR_MAP: Record<DonutSegmentColor, string> = {
  emerald: 'rgb(5 150 105)',
  rose: 'rgb(225 29 72)',
  teal: 'rgb(20 184 166)',
  indigo: 'rgb(79 70 229)',
  amber: 'rgb(245 158 11)',
  sky: 'rgb(2 132 199)',
  purple: 'rgb(168 85 247)',
  blue: 'rgb(59 130 246)',
  slate: 'rgb(148 163 184)',
};

const DOT_BG_CLASS: Record<DonutSegmentColor, string> = {
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-600',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-600',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  slate: 'bg-slate-400',
};

// Donut canon: radio 40, stroke-width 16, circunferencia ≈ 251.3
const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 251.327

export const DonutChartCanon: React.FC<DonutChartProps> = ({
  segments,
  total: totalProp,
  sizeClass = 'w-24 h-24',
  formatValue = (v) => v.toLocaleString('es-PE'),
  showLegend = true,
  legendPosition = 'right',
  ariaLabel,
}) => {
  // Filtrar segmentos con valor > 0
  const validSegments = segments.filter(
    (s) => typeof s.value === 'number' && Number.isFinite(s.value) && s.value > 0,
  );

  // Total · usar prop o calcular
  const total = totalProp ?? validSegments.reduce((sum, s) => sum + s.value, 0);

  // Empty state · sin segmentos válidos
  if (validSegments.length === 0 || total <= 0) {
    return (
      <div className={`${sizeClass} bg-slate-50 rounded-full flex items-center justify-center`}>
        <span className="text-[9px] text-slate-400 italic">—</span>
      </div>
    );
  }

  // Calcular % y dasharray + offset acumulado para cada segmento
  let accumulatedOffset = 0;
  const segmentsWithMeta = validSegments.map((s) => {
    const pct = (s.value / total) * 100;
    const dashLength = (s.value / total) * CIRCUMFERENCE;
    const dashOffset = -accumulatedOffset; // negativo porque SVG rota anti-horario
    accumulatedOffset += dashLength;
    return {
      ...s,
      pct,
      dashLength,
      dashOffset,
    };
  });

  const finalAriaLabel =
    ariaLabel || `Composición · ${validSegments.length} segmentos · total ${formatValue(total)}`;

  const donut = (
    <svg
      viewBox="0 0 100 100"
      className={`${sizeClass} flex-shrink-0 -rotate-90`}
      role="img"
      aria-label={finalAriaLabel}
    >
      <title>{finalAriaLabel}</title>
      {/* Track (fondo) */}
      <circle
        cx="50"
        cy="50"
        r={RADIUS}
        fill="none"
        stroke="rgb(241 245 249)"
        strokeWidth="16"
      />
      {/* Segmentos */}
      {segmentsWithMeta.map((s, i) => (
        <circle
          key={i}
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={COLOR_MAP[s.color]}
          strokeWidth="16"
          strokeDasharray={`${s.dashLength.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
          strokeDashoffset={s.dashOffset.toFixed(2)}
        />
      ))}
    </svg>
  );

  const legend = (
    <div className={`flex-1 text-[11px] space-y-1 ${legendPosition === 'bottom' ? 'mt-3' : ''}`}>
      {segmentsWithMeta.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${DOT_BG_CLASS[s.color]} flex-shrink-0`} />
          <span className="text-slate-700 truncate">{s.label}</span>
          <span className="ml-auto tabular-nums font-bold text-slate-900 flex-shrink-0">
            {s.pct.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );

  if (!showLegend) return donut;

  if (legendPosition === 'bottom') {
    return (
      <div className="flex flex-col items-center">
        {donut}
        {legend}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {donut}
      {legend}
    </div>
  );
};
