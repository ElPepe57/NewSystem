/**
 * G7EbitdaBridge — chk5.D-S3.quinto · SF4
 *
 * EBITDA Bridge MoM canon MOCK 4 §6.
 * Pixel-perfect waterfall · barras intermedias mostrando drivers de variación.
 *
 * Layout: [EBITDA Mes Anterior] → [+Volumen / −Precio / −Costos / +FX] → [EBITDA Mes Actual]
 *
 * Variación destacada con badge % en la última barra · narrativa al pie
 * con detalle de drivers (DEUDA-EBITDA-DRIVERS para descomposición real).
 */

import React from 'react';
import { TrendingUp } from 'lucide-react';
import type { EbitdaBridge } from './analisisHelpers';
import { fmtMonto } from './analisisHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface G7EbitdaBridgeProps {
  data: EbitdaBridge;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const G7EbitdaBridge: React.FC<G7EbitdaBridgeProps> = ({ data }) => {
  // Escala · max absoluto entre los EBITDAs
  const maxAbs = Math.max(
    Math.abs(data.ebitdaMesAnterior),
    Math.abs(data.ebitdaMesActual),
    1,
  );
  const heightPctAnterior = Math.max(10, (Math.abs(data.ebitdaMesAnterior) / maxAbs) * 100);
  const heightPctActual = Math.max(10, (Math.abs(data.ebitdaMesActual) / maxAbs) * 100);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-purple-700">
          § G7 · EBITDA Bridge · variación MoM con drivers
        </span>
        <div className="flex-1 h-px bg-purple-200" />
      </div>
      <p className="text-[12px] text-slate-500 max-w-2xl">
        ¿Por qué este mes el EBITDA cambió S/ X vs el anterior? · Waterfall MoM con drivers
        identificados (volumen · precio · costos · opex).
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="flex items-end gap-2 h-48 mb-3">
          {/* EBITDA mes anterior */}
          <BridgeBar
            label="EBITDA prev"
            value={data.ebitdaMesAnterior}
            heightPct={heightPctAnterior}
            color="slate"
            signo={data.ebitdaMesAnterior >= 0 ? '' : '−'}
            valueColor="text-slate-700"
            labelColor="text-slate-700"
          />

          {/* Drivers intermedios */}
          {data.drivers.map((d, i) => {
            const heightPct = Math.max(3, (Math.abs(d.monto) / maxAbs) * 100);
            return (
              <BridgeBar
                key={`${d.label}-${i}`}
                label={d.label}
                value={d.monto}
                heightPct={heightPct}
                color={d.color}
                signo={d.monto >= 0 ? '+' : '−'}
                valueColor={d.color === 'emerald' ? 'text-emerald-700' : 'text-rose-700'}
                labelColor={d.color === 'emerald' ? 'text-emerald-700' : 'text-rose-700'}
                intermedia
              />
            );
          })}

          {/* EBITDA mes actual · destacado */}
          <BridgeBar
            label="EBITDA actual"
            value={data.ebitdaMesActual}
            heightPct={heightPctActual}
            color="teal"
            signo={data.ebitdaMesActual >= 0 ? '' : '−'}
            valueColor="text-teal-700"
            labelColor="text-teal-900"
            highlight
            badgePct={`${data.variacionPct >= 0 ? '+' : ''}${data.variacionPct}%`}
          />
        </div>

        {/* Narrativa */}
        <div
          className={`ring-1 rounded-lg p-3 text-[11px] flex items-start gap-2 ${
            data.variacion >= 0
              ? 'bg-emerald-50 ring-emerald-200/50 text-emerald-900'
              : 'bg-rose-50 ring-rose-200/50 text-rose-900'
          }`}
        >
          <TrendingUp
            className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
              data.variacion >= 0 ? 'text-emerald-700' : 'text-rose-700'
            } ${data.variacion < 0 ? 'rotate-180' : ''}`}
          />
          <span>{data.narrativa}</span>
        </div>

        {/* Nota usuario: drivers heurísticos · vista preview · descomposición fina (volumen/precio/mix/FX) en sprint próximo. */}
        <div className="bg-slate-100 ring-1 ring-slate-200 rounded-lg p-2 mt-2 text-[10px] text-slate-700">
          Drivers calculados de forma heurística (ingresos vs. egresos). La descomposición
          fina por volumen, precio, mix y FX se incorpora en una próxima iteración.
        </div>
      </div>
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

interface BridgeBarProps {
  label: string;
  value: number;
  heightPct: number;
  color: 'slate' | 'emerald' | 'rose' | 'teal';
  signo: string;
  valueColor: string;
  labelColor: string;
  highlight?: boolean;
  intermedia?: boolean;
  badgePct?: string;
}

const BAR_BG: Record<BridgeBarProps['color'], string> = {
  slate: 'bg-slate-400',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  teal: 'bg-gradient-to-t from-teal-600 to-teal-500',
};

const BridgeBar: React.FC<BridgeBarProps> = ({
  label,
  value,
  heightPct,
  color,
  signo,
  valueColor,
  labelColor,
  highlight,
  intermedia,
  badgePct,
}) => (
  <div className="flex-1 flex flex-col items-center min-w-[60px]">
    <div className={`text-[10px] font-bold mb-1 tabular-nums ${valueColor}`}>
      {signo}S/ {fmtMonto(Math.abs(value))}
    </div>
    <div className="w-full" style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
      <div
        className={`w-full rounded-t-lg flex items-end justify-center pb-2 ${BAR_BG[color]} ${
          highlight ? 'ring-2 ring-teal-300' : ''
        }`}
        style={{
          height: `${heightPct}%`,
          minHeight: '14px',
          // Para drivers intermedios · anclar verticalmente al medio (visualmente "flotan")
          marginTop: intermedia ? `${Math.max(0, 100 - heightPct - 30)}%` : undefined,
        }}
      >
        {badgePct && <span className="text-[10px] text-white font-bold">{badgePct}</span>}
      </div>
    </div>
    <div className={`text-[10px] font-bold mt-1 truncate w-full text-center ${labelColor}`}>
      {label}
    </div>
  </div>
);
