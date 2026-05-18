/**
 * GraficasCondensadas — chk5.D-S3.quinto · SF6
 *
 * 3 gráficas condensadas canon MOCK 4 §8-10:
 *   - G5 · Cohort cobro DSO (heatmap)
 *   - G4 · ROI por línea (scatter quadrant)
 *   - G6 · Cash flow escenarios (cross-link a /finanzas/cash-flow)
 *
 * Las 3 viven en el mismo archivo porque comparten estructura visual (card
 * pequeña con icon + título + svg + lectura) y juntas conforman el TIER 3.
 */

import React from 'react';
import { Grid3x3, ScatterChart, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CohortDSORow, ROIPunto, CashFlowEscenarios } from './analisisHelpers';
import { fmtMonto } from './analisisHelpers';

// ═════════════════════════════════════════════════════════════════════════
// G5 · COHORT COBRO DSO (heatmap)
// ═════════════════════════════════════════════════════════════════════════

export interface G5CohortDSOProps {
  rows: CohortDSORow[];
}

export const G5CohortDSO: React.FC<G5CohortDSOProps> = ({ rows }) => {
  const meses = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'] as const;

  // Detectar tendencia atención · primera columna (M1) decreciente
  const m1Values = rows.map((r) => r.m1).filter((v): v is number => v !== undefined);
  const decreciente = m1Values.length >= 3 && m1Values[m1Values.length - 1] < m1Values[0] - 10;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Grid3x3 className="w-4 h-4 text-emerald-700" />
        <h3 className="text-[13px] font-bold text-slate-900">G5 · Cohort cobro · DSO por cohorte</h3>
      </div>
      <p className="text-[10px] text-slate-500 mb-3">
        ¿Los clientes recientes pagan mejor que los anteriores? · heatmap
      </p>

      <div className="text-[10px] tabular-nums">
        {/* Header */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          <div className="text-[8px] text-slate-500 font-bold py-1">Cohort</div>
          {meses.map((m) => (
            <div key={m} className="text-[8px] text-slate-500 font-bold text-center py-1">
              {m}
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row) => (
          <div key={row.cohort} className="grid grid-cols-7 gap-0.5 mb-0.5">
            <div className="text-[8px] font-bold py-1">{row.cohort}</div>
            {meses.map((m) => {
              const valor = row[m.toLowerCase() as 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6'];
              if (valor === undefined) {
                return <div key={m} className="bg-slate-100 rounded" />;
              }
              const { bg, text } = celdaColor(valor);
              return (
                <div key={m} className={`${bg} rounded text-center text-[8px] py-1 ${text}`}>
                  {valor}%
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {decreciente && (
        <div className="text-[10px] text-amber-700 mt-2 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>Tendencia atención: cohortes recientes cobran más lento. Revisar política crédito.</span>
        </div>
      )}

      <div className="text-[10px] text-slate-500 mt-2 italic">
        Vista preview · cohort definitivo cuando se conecte el tracking de fecha-primera-venta por cliente.
      </div>
    </div>
  );
};

function celdaColor(valor: number): { bg: string; text: string } {
  if (valor >= 95) return { bg: 'bg-emerald-700', text: 'text-white' };
  if (valor >= 85) return { bg: 'bg-emerald-600', text: 'text-white' };
  if (valor >= 75) return { bg: 'bg-emerald-400', text: 'text-white' };
  if (valor >= 65) return { bg: 'bg-emerald-200', text: '' };
  if (valor >= 55) return { bg: 'bg-amber-400', text: 'text-white' };
  if (valor >= 45) return { bg: 'bg-amber-200', text: '' };
  return { bg: 'bg-rose-200', text: '' };
}

// ═════════════════════════════════════════════════════════════════════════
// G4 · ROI POR LÍNEA (scatter quadrant)
// ═════════════════════════════════════════════════════════════════════════

export interface G4ROIScatterProps {
  puntos: ROIPunto[];
}

const SCATTER_W = 280;
const SCATTER_H = 160;
const SCATTER_PAD = 15;

const PUNTO_COLOR_FILL: Record<ROIPunto['color'], string> = {
  emerald: '#10b98180',
  amber: '#f59e0b80',
  rose: '#f43f5e80',
};

const PUNTO_COLOR_TEXT: Record<ROIPunto['color'], string> = {
  emerald: '#047857',
  amber: '#92400e',
  rose: '#991b1b',
};

export const G4ROIScatter: React.FC<G4ROIScatterProps> = ({ puntos }) => {
  // chk5.D-S8.SF3.D3 · guard NaN: inversion/retorno podrian ser NaN si helpers calculan mal.
  const xCoord = (inv: number) => {
    const safe = Number.isFinite(inv) ? inv : 0;
    return SCATTER_PAD + (safe / 100) * (SCATTER_W - SCATTER_PAD * 2);
  };
  const yCoord = (ret: number) => {
    const safe = Number.isFinite(ret) ? ret : 0;
    return SCATTER_PAD + (1 - safe / 100) * (SCATTER_H - SCATTER_PAD * 2);
  };

  // Detectar star
  const star = puntos.find((p) => p.cuadrante === 'star');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <ScatterChart className="w-4 h-4 text-amber-700" />
        <h3 className="text-[13px] font-bold text-slate-900">
          G4 · ROI por línea/canal · scatter quadrant
        </h3>
      </div>
      <p className="text-[10px] text-slate-500 mb-3">
        ¿Cuál línea de negocio rinde más por sol invertido?
      </p>

      {puntos.length === 0 ? (
        <div className="bg-slate-50 rounded p-4 text-center text-[11px] text-slate-500 italic">
          Sin movimientos con línea de negocio asignada en el periodo.
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${SCATTER_W} ${SCATTER_H}`}
            preserveAspectRatio="none"
            className="w-full bg-slate-50 rounded"
            role="img"
            aria-label="ROI por línea scatter"
          >
            {/* Cuadrantes */}
            <line
              x1={SCATTER_W / 2}
              y1={SCATTER_PAD}
              x2={SCATTER_W / 2}
              y2={SCATTER_H - SCATTER_PAD}
              stroke="#cbd5e1"
              strokeDasharray="2"
            />
            <line
              x1={SCATTER_PAD}
              y1={SCATTER_H / 2}
              x2={SCATTER_W - SCATTER_PAD}
              y2={SCATTER_H / 2}
              stroke="#cbd5e1"
              strokeDasharray="2"
            />

            {/* Labels cuadrantes */}
            <text x={20} y={25} fontSize="7" fill="#0f766e" fontWeight="bold">
              ⭐ STARS
            </text>
            <text x={200} y={25} fontSize="7" fill="#d97706" fontWeight="bold">
              ? PROMESAS
            </text>
            <text x={20} y={SCATTER_H - 5} fontSize="7" fill="#059669" fontWeight="bold">
              $ VACAS
            </text>
            <text x={200} y={SCATTER_H - 5} fontSize="7" fill="#dc2626" fontWeight="bold">
              ✗ PERROS
            </text>

            {/* Ejes */}
            <text
              x={SCATTER_W / 2 - 30}
              y={SCATTER_H - 2}
              fontSize="7"
              fill="#475569"
            >
              Inversión →
            </text>
            <text
              x={5}
              y={SCATTER_H / 2}
              fontSize="7"
              fill="#475569"
              transform={`rotate(-90 5 ${SCATTER_H / 2})`}
            >
              Retorno →
            </text>

            {/* Puntos */}
            {puntos.map((p) => (
              <g key={p.id}>
                <circle
                  cx={xCoord(p.inversion)}
                  cy={yCoord(p.retorno)}
                  r={p.radio}
                  fill={PUNTO_COLOR_FILL[p.color]}
                />
                <text
                  x={xCoord(p.inversion)}
                  y={yCoord(p.retorno) + 2}
                  fontSize="8"
                  fill={PUNTO_COLOR_TEXT[p.color]}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {p.label}
                </text>
              </g>
            ))}
          </svg>

          {star && (
            <div className="text-[10px] text-emerald-700 mt-2 flex items-start gap-1">
              <TrendingUp className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                <strong>{star.label}</strong> es Star · alto retorno, inversión moderada · escalar.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// G6 · CASH FLOW ESCENARIOS (cross-link)
// ═════════════════════════════════════════════════════════════════════════

export interface G6CashFlowEscenariosProps {
  data: CashFlowEscenarios;
}

const CHART_W = 280;
const CHART_H = 140;

export const G6CashFlowEscenarios: React.FC<G6CashFlowEscenariosProps> = ({ data }) => {
  const navigate = useNavigate();

  // Normalizar escala
  const maxAbs = Math.max(
    Math.abs(data.base90d),
    Math.abs(data.optimista90d),
    Math.abs(data.pesimista90d),
    1,
  );
  const yScale = (v: number) => {
    // map [-maxAbs, maxAbs] → [CHART_H - 10, 10]
    // chk5.D-S8.SF3.D3 · guard NaN
    const safe = Number.isFinite(v) ? v : 0;
    const norm = (safe + maxAbs) / (2 * maxAbs);
    const result = CHART_H - 10 - norm * (CHART_H - 20);
    return Number.isFinite(result) ? result : CHART_H / 2;
  };

  // 3 puntos · hoy, +30d, +60d, +90d
  const xCoord = (idx: number) => 20 + (idx / 3) * (CHART_W - 40);
  const puntosBase = [
    { x: xCoord(0), y: yScale(0) },
    { x: xCoord(1), y: yScale(data.base30d) },
    { x: xCoord(2), y: yScale(data.base60d) },
    { x: xCoord(3), y: yScale(data.base90d) },
  ];
  const puntosOpt = [
    { x: xCoord(0), y: yScale(0) },
    { x: xCoord(1), y: yScale(data.base30d * 1.15) },
    { x: xCoord(2), y: yScale(data.base60d * 1.15) },
    { x: xCoord(3), y: yScale(data.optimista90d) },
  ];
  const puntosPes = [
    { x: xCoord(0), y: yScale(0) },
    { x: xCoord(1), y: yScale(data.base30d * 0.8) },
    { x: xCoord(2), y: yScale(data.base60d * 0.8) },
    { x: xCoord(3), y: yScale(data.pesimista90d) },
  ];

  const polyStr = (pts: typeof puntosBase) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3 justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-700" />
          <h3 className="text-[13px] font-bold text-slate-900">G6 · Cash flow · escenarios 90d</h3>
        </div>
        <button
          type="button"
          onClick={() => navigate('/finanzas/cash-flow')}
          className="text-[10px] font-bold text-indigo-700 hover:underline flex items-center gap-0.5"
        >
          Vista completa <ArrowRight className="w-2.5 h-2.5" />
        </button>
      </div>
      <p className="text-[10px] text-slate-500 mb-3">
        Resumen de proyección · ver detalle completo en tab Cash flow.
      </p>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="none"
        className="w-full bg-slate-50 rounded"
        role="img"
        aria-label="Cash flow escenarios"
      >
        {/* Línea cero */}
        <line
          x1={20}
          y1={yScale(0)}
          x2={CHART_W - 20}
          y2={yScale(0)}
          stroke="#cbd5e1"
          strokeWidth="1"
          strokeDasharray="2 2"
        />

        {/* Línea base */}
        <polyline points={polyStr(puntosBase)} fill="none" stroke="#6366f1" strokeWidth="2" />
        <text x={CHART_W - 18} y={puntosBase[3].y} fontSize="8" fill="#4338ca" fontWeight="bold">
          Base
        </text>

        {/* Línea optimista */}
        <polyline
          points={polyStr(puntosOpt)}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeDasharray="3"
        />
        <text
          x={CHART_W - 18}
          y={puntosOpt[3].y}
          fontSize="8"
          fill="#047857"
          fontWeight="bold"
        >
          +15%
        </text>

        {/* Línea pesimista */}
        <polyline
          points={polyStr(puntosPes)}
          fill="none"
          stroke="#f43f5e"
          strokeWidth="1.5"
          strokeDasharray="3"
        />
        <text
          x={CHART_W - 18}
          y={puntosPes[3].y}
          fontSize="8"
          fill="#991b1b"
          fontWeight="bold"
        >
          −20%
        </text>

        {/* Ejes */}
        <text x={20} y={CHART_H - 2} fontSize="7" fill="#475569">
          Hoy
        </text>
        <text x={xCoord(1) - 10} y={CHART_H - 2} fontSize="7" fill="#475569">
          30d
        </text>
        <text x={xCoord(2) - 10} y={CHART_H - 2} fontSize="7" fill="#475569">
          60d
        </text>
        <text x={xCoord(3) - 20} y={CHART_H - 2} fontSize="7" fill="#475569">
          90d
        </text>
      </svg>

      <div className="grid grid-cols-3 gap-1 mt-2 text-[10px]">
        <EscCard color="emerald" label="Optim +15%" value={data.optimista90d} />
        <EscCard color="indigo" label="Base" value={data.base90d} />
        <EscCard color="rose" label="Pesim −20%" value={data.pesimista90d} />
      </div>
    </div>
  );
};

interface EscCardProps {
  color: 'emerald' | 'indigo' | 'rose';
  label: string;
  value: number;
}

const ESC_BG: Record<EscCardProps['color'], string> = {
  emerald: 'bg-emerald-50',
  indigo: 'bg-indigo-50',
  rose: 'bg-rose-50',
};
const ESC_LABEL: Record<EscCardProps['color'], string> = {
  emerald: 'text-emerald-700',
  indigo: 'text-indigo-700',
  rose: 'text-rose-700',
};
const ESC_TEXT: Record<EscCardProps['color'], string> = {
  emerald: 'text-emerald-900',
  indigo: 'text-indigo-900',
  rose: 'text-rose-900',
};

const EscCard: React.FC<EscCardProps> = ({ color, label, value }) => (
  <div className={`rounded p-1 text-center ${ESC_BG[color]}`}>
    <div className={`text-[8px] font-bold ${ESC_LABEL[color]}`}>{label}</div>
    <div className={`font-bold tabular-nums ${ESC_TEXT[color]}`}>
      {value >= 0 ? '+' : '−'}S/ {fmtMonto(Math.abs(value))}
    </div>
  </div>
);
