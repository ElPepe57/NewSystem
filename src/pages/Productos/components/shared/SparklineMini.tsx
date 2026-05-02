/**
 * SparklineMini · átomo compartido del módulo Productos V2
 *
 * Línea SVG diminuta para visualizar tendencias en KPIs y filas (margen, ventas,
 * stock). Variante: line (default) · area (con relleno tenue).
 *
 * Mockup canónico: ver KPI strip variante C en docs/mockups/productos/01-page-listado.html
 */

import React, { useMemo } from 'react';

interface SparklineMiniProps {
  /** Serie de valores numéricos (mínimo 2). Las "x" se reparten parejo. */
  values: number[];
  /** Color stroke. Default emerald. */
  color?: string;
  /** Si true, dibuja un area-chart con gradiente del mismo color. */
  area?: boolean;
  /** Ancho en px. Default 60. */
  width?: number;
  /** Alto en px. Default 24. */
  height?: number;
  /** Stroke width. Default 1.5. */
  strokeWidth?: number;
  className?: string;
}

export const SparklineMini: React.FC<SparklineMiniProps> = ({
  values,
  color = '#10b981',
  area = false,
  width = 60,
  height = 24,
  strokeWidth = 1.5,
  className = '',
}) => {
  const { polylinePoints, areaPath } = useMemo(() => {
    if (values.length < 2) {
      return { polylinePoints: '', areaPath: '' };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = strokeWidth;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    const points = values.map((v, i) => {
      const x = padding + (i / (values.length - 1)) * innerWidth;
      // y invertido: max -> arriba (pequeño y) · min -> abajo
      const y = padding + (1 - (v - min) / range) * innerHeight;
      return { x, y };
    });

    const polyline = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // Path para area: cierra hacia abajo
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPathStr = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(height - padding).toFixed(1)} L${points[0].x.toFixed(1)},${(height - padding).toFixed(1)} Z`;

    return { polylinePoints: polyline, areaPath: areaPathStr };
  }, [values, width, height, strokeWidth]);

  if (values.length < 2) return null;

  const gradientId = `sparkline-gradient-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} style={{ width, height }} aria-hidden="true">
      {area && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
        </>
      )}
      <polyline points={polylinePoints} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
