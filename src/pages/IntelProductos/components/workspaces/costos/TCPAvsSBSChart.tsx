/**
 * TCPAvsSBSChart · líneas comparativas Pool USD vs TC oficial
 *
 * chk5.B9 (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-canon-productos.html · Sec 2 · Panel 2`.
 *
 * Visualiza dos líneas en el mismo eje:
 *   - SBS (gray dashed): TC SUNAT cierre de mes
 *   - TCPA (emerald solid): TC promedio ponderado del Pool USD
 *
 * Diferencia positiva (TCPA < SBS) = ganancia oculta. Banner emerald al pie
 * cuantifica el ahorro real del mes actual.
 *
 * Empty state: sin snapshots Pool USD (módulo Tesorería).
 */

import React from 'react';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TCPAvsSBS } from '../../../utils/costIntelligence';

interface TCPAvsSBSChartProps {
  data: TCPAvsSBS;
  /** Saldo USD actual del pool · para calcular ahorro real PEN */
  saldoUSDPool?: number;
}

const COLOR_TCPA = '#10b981';        // emerald-500
const COLOR_SBS = '#94a3b8';         // slate-400

const fmtTC = (n: number) => n.toFixed(2);
const fmtPENShort = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
  return Math.round(n).toString();
};

export const TCPAvsSBSChart: React.FC<TCPAvsSBSChartProps> = ({ data, saldoUSDPool = 0 }) => {
  const { serie, tcpaActual, sbsActual, diffAbsoluteActual, diffPctActual, minSerie, maxSerie, hasData } = data;

  // Ahorro real PEN del mes actual = saldoUSD × (SBS - TCPA)
  // Si TCPA < SBS → positivo (ahorro) · si TCPA > SBS → negativo (sobrecosto)
  const ahorroPEN = diffAbsoluteActual !== null && saldoUSDPool > 0
    ? saldoUSDPool * diffAbsoluteActual
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-slate-900">
            TCPA vs TC oficial · ganancia oculta
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Pool USD vs SBS · diferencia favorable este mes
          </div>
        </div>
        <DollarSign className="w-4 h-4 text-slate-400" />
      </div>

      {!hasData ? (
        <EmptyChart />
      ) : (
        <>
          <ComparativaLinesSVG
            serie={serie}
            min={minSerie}
            max={maxSerie}
            tcpaActual={tcpaActual}
            sbsActual={sbsActual}
          />

          {/* Banner inferior · ahorro o sobrecosto */}
          {diffAbsoluteActual !== null && diffPctActual !== null && (
            <BannerAhorro
              diffAbs={diffAbsoluteActual}
              diffPct={diffPctActual}
              ahorroPEN={ahorroPEN}
            />
          )}
        </>
      )}
    </div>
  );
};

// ─── Empty state interno ─────────────────────────────────────────────────────
const EmptyChart: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-44 text-center px-4">
    <DollarSign className="w-8 h-8 text-slate-300 mb-2" />
    <p className="text-xs text-slate-500 mb-1 font-semibold">Sin snapshots Pool USD</p>
    <p className="text-[10px] text-slate-400 max-w-xs mb-3">
      Para activar este chart, generar al menos 1 snapshot mensual de Pool USD
      con TCPA + TC cierre.
    </p>
    <Link to="/finanzas/saldos" className="text-[10px] font-bold text-teal-700 hover:text-teal-800 underline">
      Ir a Finanzas → Pool USD
    </Link>
  </div>
);

// ─── Banner ahorro · emerald si TCPA < SBS · amber si igual · rose si sobrecosto
interface BannerAhorroProps {
  diffAbs: number;
  diffPct: number;
  ahorroPEN: number | null;
}

const BannerAhorro: React.FC<BannerAhorroProps> = ({ diffAbs, diffPct, ahorroPEN }) => {
  if (diffAbs > 0) {
    // Ahorro · TCPA < SBS
    return (
      <div className="mt-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-800 flex items-center gap-1.5">
        <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          {ahorroPEN !== null && ahorroPEN > 0 ? (
            <>
              <span className="font-bold">Ahorro real S/ {fmtPENShort(ahorroPEN)}</span>
              {' · '}
            </>
          ) : null}
          TCPA {diffAbs.toFixed(2)} menor que SBS · costo {diffPct.toFixed(1)}% inferior al oficial
        </span>
      </div>
    );
  } else if (diffAbs < 0) {
    // Sobrecosto · TCPA > SBS
    return (
      <div className="mt-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          {ahorroPEN !== null && ahorroPEN < 0 ? (
            <>
              <span className="font-bold">Sobrecosto S/ {fmtPENShort(Math.abs(ahorroPEN))}</span>
              {' · '}
            </>
          ) : null}
          TCPA {Math.abs(diffAbs).toFixed(2)} mayor que SBS · costo {Math.abs(diffPct).toFixed(1)}% sobre el oficial
        </span>
      </div>
    );
  }
  return (
    <div className="mt-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-700">
      TCPA ≈ SBS este mes · sin diferencia significativa
    </div>
  );
};

// ─── SVG líneas comparativas ─────────────────────────────────────────────────
interface ComparativaLinesSVGProps {
  serie: TCPAvsSBS['serie'];
  min: number;
  max: number;
  tcpaActual: number | null;
  sbsActual: number | null;
}

const ComparativaLinesSVG: React.FC<ComparativaLinesSVGProps> = ({ serie, min, max, tcpaActual, sbsActual }) => {
  const W = 320;
  const H = 160;
  const PADDING_LEFT = 18;
  const PADDING_RIGHT = 50; // espacio para labels TCPA/SBS
  const PADDING_BOTTOM = 28;
  const PADDING_TOP = 15;
  const CHART_W = W - PADDING_LEFT - PADDING_RIGHT;
  const CHART_H = H - PADDING_BOTTOM - PADDING_TOP;

  const n = serie.length;
  if (n === 0) return null;

  // Rango Y con 10% headroom en cada extremo
  const range = max - min || 1;
  const yMin = min - range * 0.1;
  const yMax = max + range * 0.1;
  const yRange = yMax - yMin;

  const xAt = (i: number) => PADDING_LEFT + (n > 1 ? (i / (n - 1)) * CHART_W : CHART_W / 2);
  const yAt = (v: number) => PADDING_TOP + CHART_H - ((v - yMin) / yRange) * CHART_H;

  const polyPoints = (selector: 'tcpa' | 'sbs') =>
    serie.map((p, i) => `${xAt(i)},${yAt(p[selector])}`).join(' ');

  // Labels eje X · primer + medio + último (canon mockup)
  const labelIndices = n <= 4
    ? serie.map((_, i) => i)
    : [0, Math.floor(n / 2), n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" preserveAspectRatio="xMidYMid meet">
      {/* Y-axis labels · max, mid, min */}
      <text x="2" y={yAt(yMax) + 3} fontSize="8" fill="#94a3b8">{fmtTC(yMax)}</text>
      <text x="2" y={yAt(yMin + yRange / 2) + 3} fontSize="8" fill="#94a3b8">{fmtTC(yMin + yRange / 2)}</text>
      <text x="2" y={yAt(yMin) + 3} fontSize="8" fill="#94a3b8">{fmtTC(yMin)}</text>

      {/* SBS line (dashed gray) */}
      <polyline
        points={polyPoints('sbs')}
        fill="none"
        stroke={COLOR_SBS}
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />
      {/* Final dot SBS + label */}
      {sbsActual !== null && n > 0 && (
        <>
          <circle cx={xAt(n - 1)} cy={yAt(sbsActual)} r="3" fill={COLOR_SBS} />
          <text x={xAt(n - 1) + 5} y={yAt(sbsActual) - 3} fontSize="9" fill={COLOR_SBS} fontWeight="700">
            {fmtTC(sbsActual)} SBS
          </text>
        </>
      )}

      {/* TCPA line (emerald solid) */}
      <polyline
        points={polyPoints('tcpa')}
        fill="none"
        stroke={COLOR_TCPA}
        strokeWidth="2"
      />
      {/* Final dot TCPA + label */}
      {tcpaActual !== null && n > 0 && (
        <>
          <circle cx={xAt(n - 1)} cy={yAt(tcpaActual)} r="3" fill={COLOR_TCPA} />
          <text x={xAt(n - 1) + 5} y={yAt(tcpaActual) + 4} fontSize="9" fill={COLOR_TCPA} fontWeight="700">
            {fmtTC(tcpaActual)} TCPA
          </text>
        </>
      )}

      {/* X-axis labels */}
      {labelIndices.map((i) => {
        const punto = serie[i];
        const fill = punto.esActual ? '#0f172a' : '#94a3b8';
        const weight = punto.esActual ? 700 : 400;
        return (
          <text
            key={i}
            x={xAt(i)}
            y={H - 8}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'middle' : 'middle'}
            fontSize="9"
            fill={fill}
            fontWeight={weight}
          >
            {punto.label}
          </text>
        );
      })}
    </svg>
  );
};
