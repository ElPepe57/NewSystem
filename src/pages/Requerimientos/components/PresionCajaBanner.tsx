/**
 * PresionCajaBanner · A2 · F4 · widget §F (alerta condicional) del Resumen.
 *
 * Banner NO-binding (informa, no bloquea): se ENCIENDE solo cuando la cola pendiente
 * de aprobación supera la caja libre disponible (`AnalisisCola.enPresion`). Da el desglose
 * que el KPI strip NO da (cola total · caja libre · exceso) + CTA a priorizar.
 *
 * Spec pixel-perfect: docs/mockups/requerimientos-evolucion-propuesta-v1.html · ACTO 7 §F (A2 · §F).
 */
import React from 'react';
import { TrendingUp, ArrowRight } from 'lucide-react';
import type { AnalisisCola } from '../colaRequerimientos.helper';

interface Props {
  analisis: AnalisisCola;
}

const fmtPEN = (n: number): string => `S/ ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export const PresionCajaBanner: React.FC<Props> = ({ analisis }) => {
  // Solo enciende cuando la cola supera la caja libre (caja conocida + total > caja).
  if (!analisis.enPresion || analisis.cajaDisponiblePEN == null) return null;

  return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-rose-200 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-rose-600" />
        <span className="text-[13px] font-semibold text-rose-900">Presión de caja</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="text-[12px] text-rose-800 font-medium leading-snug">
          El total de reqs pendientes supera la caja libre disponible.
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-rose-700">Cola total</span>
          <span className="font-bold tabular-nums text-rose-900">{fmtPEN(analisis.totalPendientePEN)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-rose-700">Caja libre</span>
          <span className="font-bold tabular-nums text-rose-900">{fmtPEN(analisis.cajaDisponiblePEN)}</span>
        </div>
        <div className="h-px bg-rose-200 my-1" />
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-semibold text-rose-800">Exceso</span>
          <span className="font-bold tabular-nums text-rose-700 text-[15px]">{fmtPEN(analisis.excesoPEN)}</span>
        </div>
        <div className="pt-1">
          {/* TODO: link a tab Plan de compra cuando exista */}
          <button
            type="button"
            className="text-[12px] font-semibold text-rose-700 flex items-center gap-1 hover:text-rose-900"
          >
            <ArrowRight className="w-3.5 h-3.5" /> Ir a Plan de compra para priorizar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresionCajaBanner;
