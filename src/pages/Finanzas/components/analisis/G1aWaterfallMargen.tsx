/**
 * G1aWaterfallMargen — chk5.D-S3.quinto · SF2
 *
 * Waterfall margen sin impuestos canon MOCK 4 §3.
 * Pixel-perfect · 5 barras (Ingreso → −COGS → MB → −Opex → EBITDA)
 * con porcentajes y resumen 3 cards inferiores.
 *
 * DEUDA-FISCAL-FUTURO declarada · activar G1.c con provisión IR cuando se
 * integre módulo SUNAT (D8 canon respetado).
 */

import React from 'react';
import { Info } from 'lucide-react';
import type { WaterfallMargen } from './analisisHelpers';
import { fmtMonto } from './analisisHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface G1aWaterfallMargenProps {
  data: WaterfallMargen;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const G1aWaterfallMargen: React.FC<G1aWaterfallMargenProps> = ({ data }) => {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-purple-700">
          § G1.a · Waterfall margen · sin impuestos
        </span>
        <div className="flex-1 h-px bg-purple-200" />
      </div>
      <p className="text-[12px] text-slate-500 max-w-2xl">
        ¿De cada S/ 100 que entran, cuánto queda al final? · Ingreso → COGS → Margen bruto → Opex →
        EBITDA. El impacto fiscal (IR) se incorpora cuando se active la integración SUNAT.
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="flex items-end gap-2 h-64 mb-4">
          {/* Ingreso (100%) */}
          <WaterfallBar
            label="Ingreso"
            value={data.ingreso}
            percent={100}
            heightPct={100}
            color="teal"
            barColor="from-teal-600 to-teal-400"
            highlight={false}
            signo=""
          />
          {/* −COGS */}
          <WaterfallBar
            label="− COGS"
            value={-data.cogs}
            percent={Math.round(data.cogsPct)}
            heightPct={Math.min(100, data.cogsPct)}
            color="rose"
            barColor="from-rose-600 to-rose-400"
            highlight={false}
            signo="−"
            anchorBottom
          />
          {/* Margen bruto */}
          <WaterfallBar
            label="Margen bruto"
            value={data.margenBruto}
            percent={Math.round(data.margenBrutoPct)}
            heightPct={Math.min(100, data.margenBrutoPct)}
            color="emerald"
            barColor="from-emerald-600 to-emerald-400"
            highlight={false}
            signo=""
          />
          {/* −Opex */}
          <WaterfallBar
            label="− Opex"
            value={-data.opex}
            percent={Math.round(data.opexPct)}
            heightPct={Math.min(100, data.opexPct)}
            color="rose"
            barColor="from-rose-500 to-rose-300"
            highlight={false}
            signo="−"
            anchorBottom
          />
          {/* EBITDA */}
          <WaterfallBar
            label="= EBITDA"
            value={data.ebitda}
            percent={Math.round(data.ebitdaPct)}
            heightPct={Math.min(100, Math.max(2, data.ebitdaPct))}
            color="teal"
            barColor="from-teal-700 to-teal-500"
            highlight={true}
            signo={data.ebitda >= 0 ? '' : '−'}
          />
        </div>

        {/* Resumen 3 ratios */}
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <RatioCard label="Margen bruto %" value={`${Math.round(data.margenBrutoPct)}%`} color="emerald" />
          <RatioCard label="Opex / Ingreso" value={`${Math.round(data.opexPct)}%`} color="amber" />
          <RatioCard label="Margen EBITDA" value={`${Math.round(data.ebitdaPct)}%`} color="teal" />
        </div>

        {/* Nota usuario: vista sin impuestos · cuando se integre SUNAT se agrega línea Provisión IR. */}
        <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg p-2.5 mt-3 text-[10px] text-amber-900 flex items-start gap-2">
          <Info className="w-3 h-3 text-amber-700 mt-0.5 flex-shrink-0" />
          <span>
            Vista <strong>antes de impuestos</strong>. Al integrar el módulo SUNAT se agrega la
            línea "Provisión IR estimada (29.5%)" después de EBITDA · margen neto bajaría
            aproximadamente a {Math.round(data.ebitdaPct * 0.705)}% del ingreso.
          </span>
        </div>
      </div>
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═════════════════════════════════════════════════════════════════════════

interface WaterfallBarProps {
  label: string;
  value: number;
  percent: number;
  heightPct: number;
  color: 'teal' | 'rose' | 'emerald';
  barColor: string; // tailwind gradient classes
  highlight: boolean;
  signo: string;
  /** Para COGS/Opex · ancla al fondo en lugar de top */
  anchorBottom?: boolean;
}

const VALUE_TEXT: Record<WaterfallBarProps['color'], string> = {
  teal: 'text-teal-700',
  rose: 'text-rose-700',
  emerald: 'text-emerald-700',
};

const LABEL_TEXT: Record<WaterfallBarProps['color'], string> = {
  teal: 'text-teal-900',
  rose: 'text-slate-700',
  emerald: 'text-slate-700',
};

const WaterfallBar: React.FC<WaterfallBarProps> = ({
  label,
  value,
  percent,
  heightPct,
  color,
  barColor,
  highlight,
  signo,
  anchorBottom,
}) => (
  <div className="flex-1 flex flex-col items-center">
    <div className={`text-[10px] font-bold tabular-nums mb-1 ${VALUE_TEXT[color]}`}>
      {signo}S/ {fmtMonto(Math.abs(value))}
    </div>
    <div className="w-full" style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
      <div
        className={`bg-gradient-to-t ${barColor} w-full rounded-t-lg flex items-end justify-center pb-2 ${
          highlight ? 'ring-2 ring-teal-300' : ''
        }`}
        style={{
          height: `${heightPct}%`,
          minHeight: '14px',
          marginTop: anchorBottom ? `${100 - heightPct}%` : undefined,
        }}
      >
        <span className="text-[10px] text-white font-bold">{percent}%</span>
      </div>
    </div>
    <div className={`text-[10px] font-bold mt-1 ${LABEL_TEXT[color]}`}>{label}</div>
  </div>
);

interface RatioCardProps {
  label: string;
  value: string;
  color: 'emerald' | 'amber' | 'teal';
}

const RATIO_TEXT: Record<RatioCardProps['color'], string> = {
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  teal: 'text-teal-700',
};

const RatioCard: React.FC<RatioCardProps> = ({ label, value, color }) => (
  <div className="bg-slate-50 rounded-lg p-2 text-center">
    <div className="text-[9px] uppercase font-bold text-slate-600">{label}</div>
    <div className={`text-lg font-bold tabular-nums ${RATIO_TEXT[color]}`}>{value}</div>
  </div>
);
