/**
 * Sparkline · canon v5.2 chk5.E-A
 *
 * Mini-gráfica SVG nativa (sin biblioteca) para mostrar tendencias temporales
 * inline en KPIs, tablas, cards. Auto-normalización + auto-color por trend.
 *
 * @example
 * <Sparkline data={[100, 105, 98, 110, 115, 120]} color="auto" />
 * <Sparkline data={ventasUltimos6Meses} color="emerald" ariaLabel="Tendencia ventas 6 meses" />
 */

import React from 'react';

export type SparklineColor =
  | 'auto' // detecta trend y elige emerald (sube) / rose (baja) / slate (plano)
  | 'emerald'
  | 'rose'
  | 'teal'
  | 'indigo'
  | 'amber'
  | 'sky'
  | 'purple'
  | 'slate';

export interface SparklineProps {
  /** Array de valores numéricos · idealmente 6-8 puntos · mínimo 2 */
  data: number[];
  /** Color del trazo · 'auto' detecta tendencia */
  color?: SparklineColor;
  /** Width SVG en clase Tailwind · default w-full */
  widthClass?: string;
  /** Height SVG en clase Tailwind · default h-6 (24px) */
  heightClass?: string;
  /** Mostrar punto destacado al final · default true */
  showEndPoint?: boolean;
  /** Mostrar área debajo de la línea · default true */
  showArea?: boolean;
  /** Stroke width · default 2 */
  strokeWidth?: number;
  /** Label accesible para screen readers */
  ariaLabel?: string;
}

const COLOR_MAP: Record<Exclude<SparklineColor, 'auto'>, { stroke: string; fill: string }> = {
  emerald: { stroke: 'rgb(5 150 105)', fill: 'rgba(5,150,105,0.1)' },
  rose: { stroke: 'rgb(225 29 72)', fill: 'rgba(225,29,72,0.1)' },
  teal: { stroke: 'rgb(13 148 136)', fill: 'rgba(13,148,136,0.1)' },
  indigo: { stroke: 'rgb(79 70 229)', fill: 'rgba(79,70,229,0.1)' },
  amber: { stroke: 'rgb(217 119 6)', fill: 'rgba(217,119,6,0.1)' },
  sky: { stroke: 'rgb(2 132 199)', fill: 'rgba(2,132,199,0.1)' },
  purple: { stroke: 'rgb(147 51 234)', fill: 'rgba(147,51,234,0.1)' },
  slate: { stroke: 'rgb(100 116 139)', fill: 'rgba(100,116,139,0.1)' },
};

/**
 * Detecta tendencia auto y devuelve color apropiado:
 * - +5% o más → emerald (sube)
 * - -5% o menos → rose (baja)
 * - entre -5 y +5 → slate (plano)
 */
function detectTrendColor(data: number[]): Exclude<SparklineColor, 'auto'> {
  if (data.length < 2) return 'slate';
  const first = data[0];
  const last = data[data.length - 1];
  if (first === 0) return last > 0 ? 'emerald' : last < 0 ? 'rose' : 'slate';
  const pctChange = ((last - first) / Math.abs(first)) * 100;
  if (pctChange >= 5) return 'emerald';
  if (pctChange <= -5) return 'rose';
  return 'slate';
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = 'auto',
  widthClass = 'w-full',
  heightClass = 'h-6',
  showEndPoint = true,
  showArea = true,
  strokeWidth = 2,
  ariaLabel,
}) => {
  // Validación: necesitamos al menos 2 puntos válidos
  const validData = data.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (validData.length < 2) {
    return (
      <div
        className={`${widthClass} ${heightClass} bg-slate-50 rounded flex items-center justify-center`}
        aria-label={ariaLabel || 'Sin datos suficientes para tendencia'}
      >
        <span className="text-[9px] text-slate-400 italic">—</span>
      </div>
    );
  }

  // Resolver color (auto vs explícito)
  const resolvedColor: Exclude<SparklineColor, 'auto'> =
    color === 'auto' ? detectTrendColor(validData) : color;
  const { stroke, fill } = COLOR_MAP[resolvedColor];

  // Normalización Y · SVG: 0=arriba, 24=abajo (invertido)
  // Padding superior 4, inferior 4 · rango usable 4-20 (16 pixels)
  const minVal = Math.min(...validData);
  const maxVal = Math.max(...validData);
  const range = maxVal - minVal || 1; // evitar div/0 si todos iguales
  const yPaddingTop = 4;
  const yPaddingBottom = 20;
  const yRange = yPaddingBottom - yPaddingTop;

  const normalizeY = (v: number): number =>
    yPaddingBottom - ((v - minVal) / range) * yRange;

  // Normalización X · viewBox 0-100 · puntos equidistantes
  const xStep = 100 / (validData.length - 1);
  const points = validData
    .map((v, i) => `${(i * xStep).toFixed(2)},${normalizeY(v).toFixed(2)}`)
    .join(' ');

  // Polyline para área (cerrada con 100,24 y 0,24)
  const areaPoints = `${points} 100,24 0,24`;

  // Punto final
  const lastY = normalizeY(validData[validData.length - 1]);

  // Auto-generar aria-label si no se pasó
  const finalAriaLabel =
    ariaLabel ||
    `Tendencia ${validData.length} puntos · de ${validData[0].toFixed(0)} a ${validData[validData.length - 1].toFixed(0)}`;

  return (
    <svg
      viewBox="0 0 100 24"
      className={`${widthClass} ${heightClass}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={finalAriaLabel}
    >
      <title>{finalAriaLabel}</title>
      {showArea && <polyline points={areaPoints} fill={fill} stroke="none" />}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showEndPoint && <circle cx={100} cy={lastY} r={2} fill={stroke} />}
    </svg>
  );
};
