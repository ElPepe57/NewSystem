/**
 * HubKpiStrip · Hub Kit L5 · strip de KPIs del shell hub.
 *
 * KPIs con color SEMÁNTICO (N1) en cards gradient + ring (N2) + mini-stats footer
 * integrado (N3). OJO: el color aquí es SEMÁNTICO (qué significa el dato), NO el
 * color del grupo/módulo — la identidad nunca pisa al semántico.
 *
 * Paleta semántica (canon v8.0 N1): amber=dinero · rose=urgencia · emerald=positivo ·
 * indigo=fijo/compromiso · sky=parcial/info · violet=capital/socio · slate=neutral.
 *
 * Spec: docs/mockups/hub-kit-implementacion-v1.html (ACTO 1/4).
 */
import React from 'react';
import { type LucideIcon } from 'lucide-react';

export type HubKpiTono = 'amber' | 'rose' | 'emerald' | 'indigo' | 'sky' | 'violet' | 'slate';

export interface HubKpi {
  label: string;
  valor: string;
  /** sufijo atenuado · decimales/unidad (ej. "k", "%", ".5"). canon F7. */
  sufijo?: string;
  tono: HubKpiTono;
  icon?: LucideIcon;
  /** texto secundario bajo el valor (ej. "3 cuentas"). */
  delta?: string;
}

export interface HubMiniStat {
  label: React.ReactNode;
  icon?: LucideIcon;
}

interface HubKpiStripProps {
  kpis: HubKpi[];
  miniStats?: HubMiniStat[];
  /** columnas en desktop · default 5 (KPI strip canónico). Mobile siempre 2. */
  cols?: 3 | 4 | 5;
  className?: string;
}

// Clases LITERALES por tono semántico (JIT-safe · NUNCA interpolar `${tono}`).
const TONO: Record<HubKpiTono, { card: string; label: string; icon: string; valor: string; decimal: string; delta: string }> = {
  amber:   { card: 'from-amber-50 to-amber-100/40 ring-amber-200/50',      label: 'text-amber-700',   icon: 'text-amber-700',   valor: 'text-amber-900',   decimal: 'text-amber-400',   delta: 'text-amber-700' },
  rose:    { card: 'from-rose-50 to-rose-100/40 ring-rose-200/50',         label: 'text-rose-700',    icon: 'text-rose-700',    valor: 'text-rose-900',    decimal: 'text-rose-400',    delta: 'text-rose-700' },
  emerald: { card: 'from-emerald-50 to-emerald-100/40 ring-emerald-200/50', label: 'text-emerald-700', icon: 'text-emerald-700', valor: 'text-emerald-900', decimal: 'text-emerald-400', delta: 'text-emerald-700' },
  indigo:  { card: 'from-indigo-50 to-indigo-100/40 ring-indigo-200/50',   label: 'text-indigo-700',  icon: 'text-indigo-700',  valor: 'text-indigo-900',  decimal: 'text-indigo-400',  delta: 'text-indigo-700' },
  sky:     { card: 'from-sky-50 to-sky-100/40 ring-sky-200/50',            label: 'text-sky-700',     icon: 'text-sky-700',     valor: 'text-sky-900',     decimal: 'text-sky-400',     delta: 'text-sky-700' },
  violet:  { card: 'from-violet-50 to-violet-100/40 ring-violet-200/50',   label: 'text-violet-700',  icon: 'text-violet-700',  valor: 'text-violet-900',  decimal: 'text-violet-400',  delta: 'text-violet-700' },
  slate:   { card: 'from-slate-50 to-slate-100/60 ring-slate-200/60',      label: 'text-slate-600',   icon: 'text-slate-600',   valor: 'text-slate-900',   decimal: 'text-slate-400',   delta: 'text-slate-600' },
};

const COLS: Record<3 | 4 | 5, string> = {
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
};

export const HubKpiStrip: React.FC<HubKpiStripProps> = ({ kpis, miniStats = [], cols = 5, className = '' }) => (
  <div className={`px-4 sm:px-6 py-4 border-b border-slate-100 ${className}`}>
    <div className={`grid grid-cols-2 ${COLS[cols]} gap-2 sm:gap-3`}>
      {kpis.map((k, i) => {
        const t = TONO[k.tono];
        const Ki = k.icon;
        return (
          <div key={i} className={`bg-gradient-to-br ${t.card} ring-1 rounded-2xl p-3`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[10px] uppercase tracking-wider font-bold ${t.label}`}>{k.label}</span>
              {Ki && <Ki className={`w-3.5 h-3.5 ${t.icon}`} />}
            </div>
            <div className={`text-2xl font-bold tabular-nums ${t.valor}`}>
              {k.valor}{k.sufijo && <span className={t.decimal}>{k.sufijo}</span>}
            </div>
            {k.delta && <div className={`text-[10px] mt-0.5 ${t.delta}`}>{k.delta}</div>}
          </div>
        );
      })}
    </div>

    {miniStats.length > 0 && (
      <div className="bg-slate-50/50 border border-slate-200 rounded-xl mt-3 px-4 py-2 flex items-center gap-4 text-[11px] flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Mini-stats:</span>
        {miniStats.map((m, i) => {
          const Mi = m.icon;
          return (
            <span key={i} className="flex items-center gap-1 text-slate-600">
              {Mi && <Mi className="w-3 h-3 text-slate-400" />}
              {m.label}
            </span>
          );
        })}
      </div>
    )}
  </div>
);
