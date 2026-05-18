/**
 * LinkCardEficiencia · cross-link siempre visible · canon v8.0 N8
 *
 * chk5.C-UX-PASS (2026-05-11) · refactor con canon v8.0:
 *   - N8 · cross-link card SIEMPRE visible (con estado vacío + CTA si no hay data)
 *   - N1 · color teal accent (cross-link a CI)
 *   - Responsive: stack vertical en mobile · banner horizontal en md:+
 *
 * Muestra el valor ACTUAL de los 2 ratios estratégicos (sin evolución 6m · esa
 * vive en Cost Intelligence · Workspace Costos). Funciona como puente entre
 * operativo (Gastos) y analítico (Cost Intelligence).
 *
 * Comportamiento de estado vacío:
 *   - Si hasData=false (sin ventas ni unidades aún), muestra mensaje
 *     "Ratios disponibles cuando registres ventas + unidades" + CTA igual.
 *   - El usuario descubre el feature aunque no haya data (canon v8.0 N8).
 *
 * Mockup referencia: `gastos-rework-v4-responsive-color.html · Sección 3 · LinkCard`.
 */

import React from 'react';
import { BarChart3, ArrowRight } from 'lucide-react';

interface LinkCardEficienciaProps {
  /** Ratio Gasto/Inversión del mes actual · 0-100 · solo si hasData */
  ratioGastoInversion: number;
  /** Delta % puntos vs mes anterior · positivo = empeoró · solo si hasData */
  deltaGastoInversionPp: number;
  /** Ratio Gasto/Ingreso del mes actual · 0-100 · solo si hasData */
  ratioGastoIngreso: number;
  /** Delta % puntos vs mes anterior · positivo = empeoró · solo si hasData */
  deltaGastoIngresoPp: number;
  /** Click en CTA · navega a Cost Intelligence · Workspace Costos */
  onVerEvolucion: () => void;
  /** chk5.C-UX-PASS · si false, muestra estado vacío (canon v8.0 N8) */
  hasData: boolean;
}

const fmtPct = (n: number, decimals = 1): string => `${n.toFixed(decimals)}%`;
const fmtDeltaPp = (n: number, decimals = 1): string =>
  `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}pp`;

export const LinkCardEficiencia: React.FC<LinkCardEficienciaProps> = ({
  ratioGastoInversion,
  deltaGastoInversionPp,
  ratioGastoIngreso,
  deltaGastoIngresoPp,
  onVerEvolucion,
  hasData,
}) => {
  // Color según dirección del delta (positivo = peor · negativo = mejor)
  const invDeltaUp = deltaGastoInversionPp > 0;
  const invDeltaDown = deltaGastoInversionPp < 0;
  const invColor = invDeltaUp ? 'text-amber-600' : invDeltaDown ? 'text-emerald-600' : 'text-slate-500';

  const ingDeltaUp = deltaGastoIngresoPp > 0;
  const ingDeltaDown = deltaGastoIngresoPp < 0;
  const ingColor = ingDeltaUp ? 'text-rose-600' : ingDeltaDown ? 'text-emerald-600' : 'text-slate-500';

  return (
    /* chk5.C-UX-PASS · canon v8.0 N1+N8 · gradient teal + ring · siempre visible */
    <div className="bg-gradient-to-r from-teal-50 to-cyan-50/30 border border-teal-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Icon con tinte teal · canon v8.0 N2 */}
        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
          <BarChart3 className="w-5 h-5 text-teal-700" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-teal-700 font-bold">
            Eficiencia este mes
          </div>

          {/* canon v9.0 M1 · MISMO layout con-data y sin-data · chips inline
              (con-data muestra %, sin-data muestra "sin data" italic · igual mockup) */}
          <div className="flex items-center gap-4 text-xs mt-1">
            <div>
              <span className="text-slate-600">Gasto/Inversión:</span>{' '}
              {hasData ? (
                <>
                  <span className={`font-bold tabular-nums ${
                    invDeltaUp ? 'text-amber-600' : invDeltaDown ? 'text-emerald-600' : 'text-slate-900'
                  }`}>
                    {fmtPct(ratioGastoInversion)}
                  </span>
                  <span className={`text-[10px] ml-1 ${invColor}`}>
                    {fmtDeltaPp(deltaGastoInversionPp)}
                  </span>
                </>
              ) : (
                <span className="font-bold text-slate-400 ml-1 italic">sin data</span>
              )}
            </div>
            <span className="text-slate-300">·</span>
            <div>
              <span className="text-slate-600">Gasto/Ingreso:</span>{' '}
              {hasData ? (
                <>
                  <span className={`font-bold tabular-nums ${
                    ingDeltaUp ? 'text-rose-600' : ingDeltaDown ? 'text-emerald-600' : 'text-slate-900'
                  }`}>
                    {fmtPct(ratioGastoIngreso)}
                  </span>
                  <span className={`text-[10px] ml-1 ${ingColor}`}>
                    {fmtDeltaPp(deltaGastoIngresoPp)}
                  </span>
                </>
              ) : (
                <span className="font-bold text-slate-400 ml-1 italic">sin data</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CTA cross-link a CI · siempre visible */}
      <button
        type="button"
        onClick={onVerEvolucion}
        className="flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-800 transition-colors flex-shrink-0"
      >
        <span className="hidden sm:inline">Ver evolución 6m y análisis</span>
        <span className="sm:hidden">Ver análisis</span>
        <ArrowRight className="w-3 h-3" />
        <span className="hidden lg:inline text-[9px] text-slate-400 font-normal ml-1">
          en Cost Intelligence
        </span>
      </button>
    </div>
  );
};
