/**
 * ForecastGastosChart · stacked bars 6m hist + 3m futuro · Workspace Forecast
 *
 * chk5.B10c (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-forecast.html · Sec 1 · Panel 2`.
 *
 * Combina serie histórica (barras sólidas · canon Costos) con barras
 * proyectadas (dashed + opacity decreciente por horizonte). Línea separadora
 * vertical entre hoy y futuro.
 *
 * Banner inferior · total trimestre proyectado vs anterior.
 */

import React from 'react';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import type { ForecastGastos } from '../../../utils/costIntelligence';

interface ForecastGastosChartProps {
  data: ForecastGastos;
}

const COLOR_PRODUCTO = '#3b82f6';
const COLOR_VENTA = '#8b5cf6';
const COLOR_PERIODO = '#f59e0b';

const fmtPENShort = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
  return Math.round(n).toLocaleString('es-PE');
};
const fmtPENFull = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 0 });

export const ForecastGastosChart: React.FC<ForecastGastosChartProps> = ({ data }) => {
  if (!data.hasData) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-slate-900">Proyección gastos · 6m hist + 3m futuro</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Stacked bars históricas + futuras dashed</div>
          </div>
          <BarChart3 className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex flex-col items-center justify-center h-44 text-center px-4">
          <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-xs text-slate-500 mb-1 font-semibold">Sin gastos clasificados para proyectar</p>
          <p className="text-[10px] text-slate-400 max-w-xs">
            Necesita ≥2 meses históricos para activar proyección WMA.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-slate-900">
            Proyección gastos · {data.serieHistorica.length}m hist + {data.serieFutura.length}m futuro
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Stacked bars históricas + futuras dashed</div>
        </div>
        <BarChart3 className="w-4 h-4 text-slate-400" />
      </div>

      <ChartSVG data={data} />

      {/* Leyenda */}
      <div className="flex items-center gap-3 mt-2 text-[10px] flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLOR_PRODUCTO }} />
          Producto
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLOR_VENTA }} />
          Venta
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLOR_PERIODO }} />
          Período
        </span>
        <span className="flex items-center gap-1 italic text-slate-500">— dashed: proyectado</span>
      </div>

      {/* Banner total trimestre proyectado */}
      <BannerTotalTrimestre
        total={data.totalProximoTrimestrePEN}
        delta={data.deltaPctVsTrimestreAnt}
      />
    </div>
  );
};

// ─── SVG combinando histórico + futuro ────────────────────────────────────────
const ChartSVG: React.FC<{ data: ForecastGastos }> = ({ data }) => {
  const W = 360;
  const H = 180;
  const PADDING_LEFT = 8;
  const PADDING_RIGHT = 8;
  const PADDING_BOTTOM = 28;
  const PADDING_TOP = 10;
  const CHART_W = W - PADDING_LEFT - PADDING_RIGHT;
  const CHART_H = H - PADDING_BOTTOM - PADDING_TOP;

  const nHist = data.serieHistorica.length;
  const nFut = data.serieFutura.length;
  const totalBars = nHist + nFut;
  if (totalBars === 0) return null;

  const BAR_AREA = CHART_W / totalBars;
  const BAR_WIDTH = BAR_AREA * 0.75;
  const BAR_GAP = BAR_AREA * 0.25;

  // Max total across all bars · escala Y
  const allTotals = [
    ...data.serieHistorica.map((p) => p.total),
    ...data.serieFutura.map((p) => p.total),
  ];
  const maxTotal = Math.max(0, ...allTotals);
  const scale = maxTotal > 0 ? CHART_H / (maxTotal * 1.1) : 0;

  // X de la línea separadora entre histórico y futuro
  const xSeparator = PADDING_LEFT + nHist * BAR_AREA;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" preserveAspectRatio="xMidYMid meet">
      {/* Líneas de referencia eje Y */}
      <line x1="0" y1={PADDING_TOP + CHART_H} x2={W} y2={PADDING_TOP + CHART_H} stroke="#e2e8f0" strokeWidth="1" />

      {/* Historic bars */}
      {data.serieHistorica.map((p, i) => {
        const xBase = PADDING_LEFT + i * BAR_AREA + BAR_GAP / 2;
        const yBase = PADDING_TOP + CHART_H;
        const hProd = p.producto * scale;
        const hVenta = p.venta * scale;
        const hPer = p.periodo * scale;
        const yProd = yBase - hProd;
        const yVenta = yProd - hVenta;
        const yPer = yVenta - hPer;
        const isLast = i === nHist - 1;
        return (
          <g key={`h-${p.anio}-${p.mes}`}>
            {hProd > 0 && <rect x={xBase} y={yProd} width={BAR_WIDTH} height={hProd} fill={COLOR_PRODUCTO} />}
            {hVenta > 0 && <rect x={xBase} y={yVenta} width={BAR_WIDTH} height={hVenta} fill={COLOR_VENTA} />}
            {hPer > 0 && <rect x={xBase} y={yPer} width={BAR_WIDTH} height={hPer} fill={COLOR_PERIODO} />}
            {/* Outline mes actual (último histórico) */}
            {isLast && hProd + hVenta + hPer > 0 && (
              <rect
                x={xBase - 2}
                y={yPer - 2}
                width={BAR_WIDTH + 4}
                height={hProd + hVenta + hPer + 2}
                fill="none"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            )}
            <text
              x={xBase + BAR_WIDTH / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize="8"
              fill={isLast ? '#0f172a' : '#94a3b8'}
              fontWeight={isLast ? 700 : 400}
            >
              {p.label}
            </text>
          </g>
        );
      })}

      {/* Línea separadora histórico/futuro */}
      {nFut > 0 && (
        <>
          <line
            x1={xSeparator}
            y1={PADDING_TOP}
            x2={xSeparator}
            y2={PADDING_TOP + CHART_H}
            stroke="#cbd5e1"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          <text
            x={xSeparator + nFut * BAR_AREA / 2}
            y={H - 4}
            textAnchor="middle"
            fontSize="7"
            fill="#94a3b8"
            fontStyle="italic"
          >
            — futuro —
          </text>
        </>
      )}

      {/* Future bars · dashed + opacity decreciente */}
      {data.serieFutura.map((p, i) => {
        const idx = nHist + i;
        const xBase = PADDING_LEFT + idx * BAR_AREA + BAR_GAP / 2;
        const yBase = PADDING_TOP + CHART_H;
        const hProd = p.producto * scale;
        const hVenta = p.venta * scale;
        const hPer = p.periodo * scale;
        const yProd = yBase - hProd;
        const yVenta = yProd - hVenta;
        const yPer = yVenta - hPer;
        const opacity = 0.6 - i * 0.1; // decreciente

        return (
          <g key={`f-${p.anio}-${p.mes}`} opacity={opacity}>
            {hProd > 0 && (
              <rect
                x={xBase}
                y={yProd}
                width={BAR_WIDTH}
                height={hProd}
                fill={COLOR_PRODUCTO}
                stroke="#1e40af"
                strokeWidth="0.5"
                strokeDasharray="2 1"
              />
            )}
            {hVenta > 0 && (
              <rect
                x={xBase}
                y={yVenta}
                width={BAR_WIDTH}
                height={hVenta}
                fill={COLOR_VENTA}
                stroke="#5b21b6"
                strokeWidth="0.5"
                strokeDasharray="2 1"
              />
            )}
            {hPer > 0 && (
              <rect
                x={xBase}
                y={yPer}
                width={BAR_WIDTH}
                height={hPer}
                fill={COLOR_PERIODO}
                stroke="#92400e"
                strokeWidth="0.5"
                strokeDasharray="2 1"
              />
            )}
            <text
              x={xBase + BAR_WIDTH / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize="8"
              fill="#94a3b8"
              fontStyle="italic"
            >
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Banner total trimestre proyectado ────────────────────────────────────────
const BannerTotalTrimestre: React.FC<{ total: number; delta: number | null }> = ({ total, delta }) => {
  if (total === 0) return null;

  const subiendo = (delta ?? 0) > 0;
  const Icon = subiendo ? TrendingUp : TrendingDown;
  const cls = subiendo
    ? 'bg-amber-50/50 border-amber-200 text-amber-800'
    : 'bg-emerald-50/50 border-emerald-200 text-emerald-800';

  return (
    <div className={`mt-3 px-3 py-2 ${cls} border rounded text-[11px] flex items-start gap-1.5`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <span>
        <span className="font-bold">Total trimestre proyectado: S/ {fmtPENFull(total)}</span>
        {delta !== null && (
          <>
            {' '}· tendencia {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs trimestre anterior
          </>
        )}
        . {subiendo
          ? 'Revisar gastos si subida es sostenida.'
          : 'Tendencia favorable a la baja.'}
      </span>
    </div>
  );
};

void fmtPENShort; // util reservado para futuras versiones de etiquetas
