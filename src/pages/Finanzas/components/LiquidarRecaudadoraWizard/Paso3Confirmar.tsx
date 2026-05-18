/**
 * Paso 3 · Confirmar · LiquidarRecaudadoraWizard · chk5.D-S1f · F5
 *
 * Resumen ejecutivo final + saldo a liquidar editable (con warning si difiere
 * del balance calculado) + notas opcionales. El botón submit del wizard
 * triggerea `liquidarCajaRecaudadoraService.liquidarSaldo()`.
 */

import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { LiquidarRecaudadoraState } from './types';

interface Paso3Props {
  state: LiquidarRecaudadoraState;
  setState: React.Dispatch<React.SetStateAction<LiquidarRecaudadoraState>>;
}

export const Paso3Confirmar: React.FC<Paso3Props> = ({ state, setState }) => {
  const b = state.balance;
  const diff = b ? Math.abs(b.pendienteLiquidar - state.saldoLiquidado) : 0;
  const diffSignificativo = diff > 0.01;

  return (
    <div className="space-y-4">
      {/* Resumen ejecutivo */}
      <div className="bg-pink-50 ring-1 ring-pink-200 rounded-xl p-4 space-y-2">
        <h3 className="text-[12px] font-bold text-pink-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Resumen ejecutivo de la liquidación
        </h3>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-white rounded p-2">
            <div className="text-[9px] uppercase font-bold text-slate-500">Recaudadora</div>
            <div className="font-bold text-slate-900">{state.recaudadoraNombre || state.recaudadoraId}</div>
          </div>
          <div className="bg-white rounded p-2">
            <div className="text-[9px] uppercase font-bold text-slate-500">Cuenta destino</div>
            <div className="font-bold text-slate-900">{state.cuentaDestinoNombre || state.cuentaDestinoId}</div>
          </div>
          <div className="bg-white rounded p-2">
            <div className="text-[9px] uppercase font-bold text-slate-500">Periodo</div>
            <div className="font-bold text-slate-900 tabular-nums">{state.fechaInicio} → {state.fechaFin}</div>
          </div>
          <div className="bg-white rounded p-2">
            <div className="text-[9px] uppercase font-bold text-slate-500">Fecha liquidación</div>
            <div className="font-bold text-slate-900 tabular-nums">{state.fechaLiquidacion}</div>
          </div>
          {b && (
            <>
              <div className="bg-white rounded p-2">
                <div className="text-[9px] uppercase font-bold text-emerald-700">Eventos a liquidar</div>
                <div className="font-bold text-emerald-900 tabular-nums">{b.eventosPendientesCount}</div>
              </div>
              <div className="bg-white rounded p-2">
                <div className="text-[9px] uppercase font-bold text-emerald-700">Balance calculado</div>
                <div className="font-bold text-emerald-900 tabular-nums">{b.pendienteLiquidar.toFixed(2)}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Saldo a liquidar (editable) */}
      <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3 space-y-2">
        <label className="block text-[11px] uppercase tracking-wider text-amber-700 font-semibold">
          Saldo a liquidar (auto-cargado del balance · ajustar solo si necesario)
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            min="0"
            value={state.saldoLiquidado || ''}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                saldoLiquidado: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full px-3 py-2 text-base font-bold tabular-nums border border-amber-300 rounded bg-white text-right"
          />
        </div>
        {diffSignificativo && (
          <div className="bg-rose-50 ring-1 ring-rose-200 rounded p-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-900">
              <strong>Diferencia detectada · {diff.toFixed(2)}.</strong> El saldo
              declarado no coincide con el balance calculado (
              <strong className="tabular-nums">{b?.pendienteLiquidar.toFixed(2)}</strong>).
              El service rechazará la liquidación si la diferencia es mayor a 0.01.
              Volvé a Paso 2 a revisar.
            </div>
          </div>
        )}
      </div>

      {/* Notas */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5">
          Notas (opcional)
        </label>
        <textarea
          rows={2}
          value={state.notas}
          onChange={(e) => setState((s) => ({ ...s, notas: e.target.value }))}
          placeholder="Referencia · contexto · observaciones · número de transferencia bancaria del recaudador..."
          className="w-full px-3 py-2 text-[12px] border border-slate-300 rounded-lg bg-white"
        />
      </div>

      {/* Banner final · documentos generados */}
      <div className="bg-indigo-50 ring-1 ring-indigo-200 rounded-lg p-3 text-[11px] text-indigo-900">
        <strong>Al confirmar se generan (atomicamente):</strong>
        <ul className="list-disc pl-5 mt-1 space-y-0.5">
          <li>Documento <strong>LiquidacionRecaudadora</strong> · estado='confirmada'</li>
          <li>
            Los <strong>{b?.eventosPendientesCount ?? 0} eventos</strong> del periodo
            quedan marcados como 'liquidado' + FK a la liquidación
          </li>
          <li>
            <span className="text-amber-700">[TODO F6]</span> Movimiento tesorería ·
            CC proveedor · asiento contable (best-effort post-transacción)
          </li>
        </ul>
      </div>
    </div>
  );
};
