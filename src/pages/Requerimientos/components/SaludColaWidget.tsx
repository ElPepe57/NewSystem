/**
 * SaludColaWidget · D1 · F4 · widget §B (visualización + insight) del Resumen.
 *
 * Composición de la cola por ORIGEN (barra apilada · color semántico por lente, igual que
 * OrigenBadge) + ratio cola/caja + chips de higiene accionables. Da el ANÁLISIS que el KPI
 * strip NO da (el strip da el número; esto da composición/ratios/higiene). Canon NO-redundancia.
 *
 * Spec pixel-perfect: docs/mockups/requerimientos-evolucion-propuesta-v1.html · ACTO 7 §B (D1 · §B).
 */
import React from 'react';
import { Activity, AlertTriangle, AlertCircle, MinusCircle, Tag } from 'lucide-react';
import type { AnalisisCola } from '../colaRequerimientos.helper';
import type { LenteDecision } from '../panelDecision.helper';

interface Props {
  analisis: AnalisisCola;
}

/** Color semántico por lente · idéntico a OrigenBadge: demanda=emerald · restock=sky · apuesta=indigo · manual=slate. */
const SEG_CLS: Record<LenteDecision, string> = {
  demanda_comprometida: 'bg-emerald-500',
  restock: 'bg-sky-400',
  apuesta: 'bg-indigo-400',
  manual: 'bg-slate-300',
};
const LEYENDA_CLS: Record<LenteDecision, string> = {
  demanda_comprometida: 'bg-emerald-500',
  restock: 'bg-sky-400',
  apuesta: 'bg-indigo-400',
  manual: 'bg-slate-300',
};
const LENTE_LABEL: Record<LenteDecision, string> = {
  demanda_comprometida: 'Demanda',
  restock: 'Restock',
  apuesta: 'Apuesta',
  manual: 'Manual',
};

const fmtPEN = (n: number): string => `S/ ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export const SaludColaWidget: React.FC<Props> = ({ analisis }) => {
  const { mix, ratioColaCaja, higiene, enCola } = analisis;
  const ratioTono =
    ratioColaCaja != null && ratioColaCaja > 1.5
      ? 'bg-rose-50 border-rose-200 text-rose-800'
      : 'bg-amber-50 border-amber-200 text-amber-800';
  const hayHigiene = higiene.apuestasSinTesis > 0 || higiene.manualesSinDriver > 0 || higiene.sinPrecioVenta > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Activity className="w-4 h-4 text-blue-600" />
        <span className="text-[13px] font-semibold text-slate-800">Salud de la cola — composición por origen</span>
      </div>

      {enCola === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-slate-400">
          Sin requerimientos en cola.
        </div>
      ) : (
        <div className="px-4 py-3 space-y-3">
          {/* Barra apilada por origen */}
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Gasto en cola por tipo de req</div>
          <div className="flex h-4 rounded-full overflow-hidden gap-px">
            {mix.map((m) => (
              <div
                key={m.lente}
                className={`${SEG_CLS[m.lente]} flex-none`}
                style={{ width: `${m.pct}%` }}
                title={`${LENTE_LABEL[m.lente]} ${m.pct}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-[10px]">
            {mix.map((m) => (
              <span key={m.lente} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm ${LEYENDA_CLS[m.lente]}`} />
                <span className="text-slate-600">
                  {LENTE_LABEL[m.lente]} <strong className="tabular-nums">{m.pct}%</strong> · {fmtPEN(m.montoPEN)} · {m.count}
                </span>
              </span>
            ))}
          </div>

          {/* Ratio cola / caja: análisis que el strip NO da */}
          {ratioColaCaja != null && ratioColaCaja > 1 && (
            <div className={`border rounded-lg px-3 py-2 text-[12px] flex items-center gap-2 ${ratioTono}`}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                Tu cola pendiente es <strong className="tabular-nums">{ratioColaCaja}×</strong> tu caja libre · hay que priorizar o diferir
              </span>
            </div>
          )}

          {/* Chips de higiene · solo si hay algo que limpiar */}
          {hayHigiene && (
            <div className="flex flex-wrap gap-1.5">
              {higiene.apuestasSinTesis > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-1 rounded-full">
                  <AlertCircle className="w-3 h-3" /> {higiene.apuestasSinTesis} apuesta{higiene.apuestasSinTesis > 1 ? 's' : ''} sin tesis
                </span>
              )}
              {higiene.manualesSinDriver > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-semibold bg-slate-50 border border-slate-200 text-slate-600 px-2 py-1 rounded-full">
                  <MinusCircle className="w-3 h-3" /> {higiene.manualesSinDriver} manual{higiene.manualesSinDriver > 1 ? 'es' : ''} sin driver
                </span>
              )}
              {higiene.sinPrecioVenta > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-semibold bg-rose-50 border border-rose-200 text-rose-700 px-2 py-1 rounded-full">
                  <Tag className="w-3 h-3" /> {higiene.sinPrecioVenta} sin precio de venta
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SaludColaWidget;
