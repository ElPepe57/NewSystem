/**
 * Paso 2 · Revisión balance · LiquidarRecaudadoraWizard · chk5.D-S1f · F5
 *
 * Llama al service `cajaRecaudadoraService.calcularBalanceMes()` con el
 * periodo elegido en Paso 1 y muestra:
 *   - Totales consolidados (cobros · servicios · liquidaciones · pendiente)
 *   - Breakdown por canal D12 (gráfico simple)
 *   - Counts de eventos pendientes
 *   - Días desde última liquidación (para detectar atrasos)
 */

import React, { useEffect } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react';
import { cajaRecaudadoraService } from '../../../../services/cajaRecaudadora.service';
import {
  CANAL_RECAUDACION_LABEL,
  CANAL_RECAUDACION_COLOR,
} from '../../../../types/productoFinanciero.types';
import type { LiquidarRecaudadoraState } from './types';

interface Paso2Props {
  state: LiquidarRecaudadoraState;
  setState: React.Dispatch<React.SetStateAction<LiquidarRecaudadoraState>>;
}

const COLOR_BG: Record<string, string> = {
  purple: 'bg-purple-500',
  cyan: 'bg-cyan-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  teal: 'bg-teal-500',
};

export const Paso2Revision: React.FC<Paso2Props> = ({ state, setState }) => {
  // Al entrar al paso · calcular balance
  useEffect(() => {
    if (!state.recaudadoraId || !state.fechaInicio || !state.fechaFin) return;
    if (state.balanceLoading) return;

    const cargarBalance = async () => {
      setState((s) => ({ ...s, balanceLoading: true, balanceError: null }));
      try {
        const balance = await cajaRecaudadoraService.calcularBalanceMes(
          state.recaudadoraId,
          new Date(state.fechaInicio),
          new Date(state.fechaFin),
        );
        setState((s) => ({
          ...s,
          balance,
          balanceLoading: false,
          // Pre-llenar saldoLiquidado con pendienteLiquidar para Paso 3
          saldoLiquidado: balance.pendienteLiquidar,
        }));
      } catch (err: any) {
        setState((s) => ({
          ...s,
          balanceLoading: false,
          balanceError: err?.message ?? 'Error calculando balance',
        }));
      }
    };
    void cargarBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.recaudadoraId, state.fechaInicio, state.fechaFin]);

  if (state.balanceLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-[12px] text-slate-600">Calculando balance del periodo...</p>
      </div>
    );
  }

  if (state.balanceError) {
    return (
      <div className="bg-rose-50 ring-1 ring-rose-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-700 flex-shrink-0 mt-0.5" />
        <div className="text-[12px] text-rose-900">
          <p className="font-bold mb-1">Error al calcular balance</p>
          <p>{state.balanceError}</p>
        </div>
      </div>
    );
  }

  if (!state.balance) {
    return (
      <div className="text-center py-12 text-[12px] text-slate-500">
        Sin datos · vuelve a Paso 1 y verifica recaudadora + periodo.
      </div>
    );
  }

  const b = state.balance;
  const totalCanal = Object.values(b.porCanal).reduce(
    (acc, c) => acc + (c?.monto ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      {/* Totales consolidados */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold text-emerald-700">Cobros</div>
          <div className="text-[16px] font-bold tabular-nums text-emerald-900">
            {b.cobrosRecibidos.toFixed(2)}
          </div>
          <div className="text-[9px] text-emerald-700">{b.cobrosCount} eventos</div>
        </div>
        <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold text-amber-700">Servicios</div>
          <div className="text-[16px] font-bold tabular-nums text-amber-900">
            −{b.serviciosDescontados.toFixed(2)}
          </div>
          <div className="text-[9px] text-amber-700">{b.serviciosCount} eventos</div>
        </div>
        <div className="bg-slate-100 ring-1 ring-slate-300 rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold text-slate-700">Liquidaciones previas</div>
          <div className="text-[16px] font-bold tabular-nums text-slate-900">
            −{b.liquidacionesYa.toFixed(2)}
          </div>
          <div className="text-[9px] text-slate-700">{b.liquidacionesCount} liquidaciones</div>
        </div>
        <div className="bg-pink-50 ring-2 ring-pink-400 rounded-lg p-3">
          <div className="text-[10px] uppercase font-bold text-pink-700">Pendiente liquidar</div>
          <div className="text-[18px] font-bold tabular-nums text-pink-900">
            {b.pendienteLiquidar.toFixed(2)}
          </div>
          <div className="text-[9px] text-pink-700">{b.eventosPendientesCount} eventos pendientes</div>
        </div>
      </div>

      {/* Breakdown por canal D12 */}
      {totalCanal > 0 && (
        <div className="bg-white ring-1 ring-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-purple-700" />
            <h3 className="text-[12px] font-bold text-slate-900">Cobros por canal (D12)</h3>
          </div>
          <div className="space-y-1.5">
            {Object.entries(b.porCanal)
              .filter(([, datos]) => datos && datos.monto > 0)
              .sort(([, a], [, c]) => (c?.monto ?? 0) - (a?.monto ?? 0))
              .map(([canal, datos]) => {
                const pct = totalCanal > 0 ? (datos!.monto / totalCanal) * 100 : 0;
                const colorKey = CANAL_RECAUDACION_COLOR[canal as keyof typeof CANAL_RECAUDACION_COLOR];
                const bgClass = COLOR_BG[colorKey] ?? COLOR_BG.teal;
                return (
                  <div key={canal} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold w-24 text-slate-700">
                      {CANAL_RECAUDACION_LABEL[canal as keyof typeof CANAL_RECAUDACION_LABEL]}
                    </span>
                    <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full ${bgClass} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-slate-800 tabular-nums">
                        {datos!.monto.toFixed(2)} · {datos!.eventos} ev
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-600 w-10 text-right tabular-nums">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Alertas */}
      {b.diasDesdeUltimaLiquidacion !== undefined && b.diasDesdeUltimaLiquidacion > 30 && (
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-700 mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-rose-900">
            <strong>Atraso detectado:</strong> última liquidación hace{' '}
            {b.diasDesdeUltimaLiquidacion} días · revisar política con el recaudador.
          </div>
        </div>
      )}

      {/* Ready to liquidate */}
      {b.eventosPendientesCount > 0 && b.pendienteLiquidar > 0 && (
        <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
          <div className="text-[11px] text-emerald-900">
            <strong>Listo para liquidar:</strong> {b.eventosPendientesCount} eventos
            pendientes por un total de{' '}
            <strong className="tabular-nums">{b.pendienteLiquidar.toFixed(2)}</strong>. Continúa
            al Paso 3 para confirmar.
          </div>
        </div>
      )}
    </div>
  );
};
