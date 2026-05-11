/**
 * EvolucionBloquesChart · stacked bars 3 bloques · Workspace Costos
 *
 * chk5.B9 (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-canon-productos.html · Sec 2 · Panel 1`.
 *
 * Visualiza la evolución de gastos por bloque (producto/venta/periodo) en
 * los últimos N meses. Cada mes es una barra apilada con 3 segmentos:
 *   - Producto (blue · CTRU)
 *   - Venta (purple)
 *   - Periodo (amber)
 *
 * Detecta y marca visualmente el mes anómalo (total >= 120% promedio previo)
 * y el mes actual (border negro).
 *
 * Empty state: cuando no hay gastos clasificados en los últimos N meses.
 */

import React from 'react';
import { BarChart3, AlertCircle } from 'lucide-react';
import type { EvolucionPorBloque } from '../../../utils/costIntelligence';

interface EvolucionBloquesChartProps {
  data: EvolucionPorBloque;
}

const COLOR_PRODUCTO = '#3b82f6';   // blue-500 · CTRU
const COLOR_VENTA = '#8b5cf6';      // violet-500
const COLOR_PERIODO = '#f59e0b';    // amber-500

const fmtPENShort = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return Math.round(n).toString();
};

export const EvolucionBloquesChart: React.FC<EvolucionBloquesChartProps> = ({ data }) => {
  const { serie, maxTotalMensual, hasData } = data;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-slate-900">
            Evolución 3 bloques · {serie.length} meses
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Stacked bars · S/ por mes
          </div>
        </div>
        <BarChart3 className="w-4 h-4 text-slate-400" />
      </div>

      {!hasData ? (
        <EmptyChart />
      ) : (
        <>
          <StackedBarsSVG serie={serie} maxTotal={maxTotalMensual} />

          {/* Leyenda canon · 3 colores */}
          <div className="flex items-center gap-3 mt-2 text-[10px] flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLOR_PRODUCTO }} />
              Producto (CTRU)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLOR_VENTA }} />
              Venta
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLOR_PERIODO }} />
              Período
            </span>
          </div>

          {/* Banner anomalía si la hay */}
          {(() => {
            const anomalia = serie.find((p) => p.esAnomalia);
            if (!anomalia) return null;
            return (
              <div className="mt-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  <span className="font-bold">{anomalia.label.replace(' ▲', '')}</span> mostró
                  un total de <span className="font-bold tabular-nums">S/ {fmtPENShort(anomalia.total)}</span>
                  {' '}· revisar gastos clasificados ese mes
                </span>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
};

// ─── Empty state interno ─────────────────────────────────────────────────────
const EmptyChart: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-44 text-center px-4">
    <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
    <p className="text-xs text-slate-500 mb-1 font-semibold">Sin gastos clasificados</p>
    <p className="text-[10px] text-slate-400 max-w-xs">
      Para activar este chart, registrar gastos con categoría canon
      (módulo Gastos · árbol categoriasCosto)
    </p>
  </div>
);

// ─── SVG stacked bars · canon mockup ─────────────────────────────────────────
interface StackedBarsSVGProps {
  serie: EvolucionPorBloque['serie'];
  maxTotal: number;
}

const StackedBarsSVG: React.FC<StackedBarsSVGProps> = ({ serie, maxTotal }) => {
  // viewBox 320×160 · canon mockup
  const W = 320;
  const H = 160;
  const PADDING_LEFT = 18;
  const PADDING_RIGHT = 8;
  const PADDING_BOTTOM = 28;
  const PADDING_TOP = 10;
  const CHART_W = W - PADDING_LEFT - PADDING_RIGHT;
  const CHART_H = H - PADDING_BOTTOM - PADDING_TOP;

  const n = serie.length;
  const BAR_WIDTH = (CHART_W / n) * 0.75;
  const BAR_GAP = (CHART_W / n) * 0.25;

  // Escala Y · maxTotal en CHART_H · siempre dejamos 10% headroom
  const scale = maxTotal > 0 ? CHART_H / (maxTotal * 1.1) : 0;

  // Labels Y axis · 0, mitad, max
  const yMaxLabel = fmtPENShort(maxTotal);
  const yMidLabel = fmtPENShort(maxTotal / 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" preserveAspectRatio="xMidYMid meet">
      {/* Y-axis labels */}
      <text x="2" y={PADDING_TOP + 5} fontSize="8" fill="#94a3b8">{yMaxLabel}</text>
      <text x="2" y={PADDING_TOP + CHART_H / 2 + 3} fontSize="8" fill="#94a3b8">{yMidLabel}</text>
      <text x="2" y={PADDING_TOP + CHART_H + 5} fontSize="8" fill="#94a3b8">0</text>

      {/* Bars */}
      {serie.map((punto, i) => {
        const xBase = PADDING_LEFT + i * (BAR_WIDTH + BAR_GAP) + BAR_GAP / 2;
        const yBase = PADDING_TOP + CHART_H;

        // Stacking: producto al fondo · venta encima · periodo arriba
        const hProducto = punto.producto * scale;
        const hVenta = punto.venta * scale;
        const hPeriodo = punto.periodo * scale;

        const yProducto = yBase - hProducto;
        const yVenta = yProducto - hVenta;
        const yPeriodo = yVenta - hPeriodo;

        // Label color: rojo si anomalía · negro si actual · gris si normal
        const labelFill = punto.esAnomalia ? '#e11d48' : punto.esActual ? '#0f172a' : '#94a3b8';
        const labelWeight = (punto.esAnomalia || punto.esActual) ? 700 : 400;

        return (
          <g key={`${punto.anio}-${punto.mes}`}>
            {hProducto > 0 && (
              <rect x={xBase} y={yProducto} width={BAR_WIDTH} height={hProducto} fill={COLOR_PRODUCTO}>
                <title>{`${punto.label} · Producto · S/ ${punto.producto.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`}</title>
              </rect>
            )}
            {hVenta > 0 && (
              <rect x={xBase} y={yVenta} width={BAR_WIDTH} height={hVenta} fill={COLOR_VENTA}>
                <title>{`${punto.label} · Venta · S/ ${punto.venta.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`}</title>
              </rect>
            )}
            {hPeriodo > 0 && (
              <rect x={xBase} y={yPeriodo} width={BAR_WIDTH} height={hPeriodo} fill={COLOR_PERIODO}>
                <title>{`${punto.label} · Período · S/ ${punto.periodo.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`}</title>
              </rect>
            )}

            {/* Outline para mes actual */}
            {punto.esActual && hProducto + hVenta + hPeriodo > 0 && (
              <rect
                x={xBase - 2}
                y={yPeriodo - 2}
                width={BAR_WIDTH + 4}
                height={hProducto + hVenta + hPeriodo + 2}
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            )}

            {/* Label X */}
            <text
              x={xBase + BAR_WIDTH / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize="9"
              fill={labelFill}
              fontWeight={labelWeight}
            >
              {punto.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
