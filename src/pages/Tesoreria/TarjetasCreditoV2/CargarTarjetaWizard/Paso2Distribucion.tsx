/**
 * Paso 2 — Distribución de docs a cargar · S58d F3
 *
 * Tabla con todos los docs pendientes de la entidad seleccionada.
 * Checkbox para incluir + monto editable por fila (default: todo el pendiente).
 *
 * El total del cargo = Σ(montoAplicado) — se muestra en footer.
 *
 * Diferencia con PagoAbonoWizard Paso 3:
 *   - Aquí NO hay un "monto del abono" fijo a distribuir; el cargo TOTAL
 *     se construye seleccionando docs.
 *   - El balance es solo informativo: total cargado y deuda restante.
 */

import React, { useMemo } from 'react';
import { CircleAlert, CheckCheck, X } from 'lucide-react';
import { cn } from '../../../../design-system/utils';
import type { CargarTarjetaState } from './types';
import { getTotalCargo } from './types';

interface Paso2Props {
  state: CargarTarjetaState;
  setState: React.Dispatch<React.SetStateAction<CargarTarjetaState>>;
}

const TOLERANCIA = 0.01;

function formatMoney(n: number, moneda: 'USD' | 'PEN'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const Paso2Distribucion: React.FC<Paso2Props> = ({ state, setState }) => {
  const moneda = state.monedaCargo;

  // ── Helpers ──
  const incluirTodos = () => {
    setState((s) => ({
      ...s,
      distribucion: s.deudas.map((d) => ({
        tipo: d.tipo,
        documentoId: d.documentoId,
        documentoNumero: d.documentoNumero,
        montoAplicado: d.montoPendiente,
      })),
    }));
  };

  const limpiarTodos = () => {
    setState((s) => ({ ...s, distribucion: [] }));
  };

  const toggleItem = (documentoId: string, incluir: boolean) => {
    if (incluir) {
      const deuda = state.deudas.find((d) => d.documentoId === documentoId);
      if (!deuda) return;
      setState((s) => ({
        ...s,
        distribucion: [
          ...s.distribucion,
          {
            tipo: deuda.tipo,
            documentoId: deuda.documentoId,
            documentoNumero: deuda.documentoNumero,
            montoAplicado: deuda.montoPendiente,
          },
        ],
      }));
    } else {
      setState((s) => ({
        ...s,
        distribucion: s.distribucion.filter(
          (d) => d.documentoId !== documentoId,
        ),
      }));
    }
  };

  const setMonto = (documentoId: string, monto: number) => {
    setState((s) => ({
      ...s,
      distribucion: s.distribucion.map((d) =>
        d.documentoId === documentoId ? { ...d, montoAplicado: monto } : d,
      ),
    }));
  };

  // ── Stats ──
  const total = getTotalCargo(state);
  const totalDeudas = state.deudas.reduce((s, d) => s + d.montoPendiente, 0);
  const incluidos = state.distribucion.length;

  // ── Render ──
  if (state.deudas.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-[12px] text-amber-900">
        No hay documentos pendientes en {moneda}. Vuelve al Paso 1 y elige
        otra entidad o tarjeta con moneda compatible.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Acciones rápidas */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[11px] text-slate-600">
          <strong className="text-slate-900">{incluidos}</strong> de{' '}
          {state.deudas.length} documentos seleccionados ·{' '}
          <strong className="text-amber-700 tabular-nums">
            {formatMoney(total, moneda)}
          </strong>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={incluirTodos}
            className="text-[10px] px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 flex items-center gap-1"
          >
            <CheckCheck className="w-3 h-3" />
            Incluir todos ({state.deudas.length})
          </button>
          {incluidos > 0 && (
            <button
              type="button"
              onClick={limpiarTodos}
              className="text-[10px] px-2 py-1 bg-white text-slate-600 border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-[10px] uppercase text-slate-500 font-semibold border-b border-slate-200">
                <th className="text-left py-2 px-3 w-10">Inc.</th>
                <th className="text-left py-2 pr-2">Documento</th>
                <th className="text-right py-2 pr-2">Pendiente</th>
                <th className="text-right py-2 pr-2 w-32">A cargar</th>
                <th className="text-left py-2 px-3 w-32">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.deudas.map((deuda) => {
                const item = state.distribucion.find(
                  (i) => i.documentoId === deuda.documentoId,
                );
                const incluido = !!item && item.montoAplicado > 0;
                const aplicado = item?.montoAplicado ?? 0;
                const queda = deuda.montoPendiente - aplicado;
                const cubreTotal =
                  aplicado >= deuda.montoPendiente - TOLERANCIA;
                const esParcial = aplicado > TOLERANCIA && !cubreTotal;
                const exceso = aplicado > deuda.montoPendiente + TOLERANCIA;

                return (
                  <tr
                    key={deuda.documentoId}
                    className={cn(
                      'hover:bg-slate-50/50 transition-colors',
                      !incluido && 'opacity-60',
                      esParcial && 'bg-amber-50/30',
                      exceso && 'bg-red-50/30',
                    )}
                  >
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={incluido}
                        onChange={(e) =>
                          toggleItem(deuda.documentoId, e.target.checked)
                        }
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                    </td>

                    <td className="py-2.5 pr-2">
                      <div className="font-mono font-semibold text-slate-900">
                        {deuda.documentoNumero}
                      </div>
                      <div className="text-[10px] text-slate-500 capitalize">
                        {deuda.tipo}
                        {deuda.estaVencido && deuda.diasVencimiento !== undefined && (
                          <span className="ml-1.5 text-amber-700">
                            <CircleAlert className="w-2.5 h-2.5 inline mr-0.5" />
                            Vencido {Math.abs(deuda.diasVencimiento)}d
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 pr-2 text-right tabular-nums">
                      {formatMoney(deuda.montoPendiente, deuda.moneda)}
                    </td>

                    <td className="py-2.5 pr-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={aplicado || ''}
                        placeholder="—"
                        onChange={(e) =>
                          setMonto(
                            deuda.documentoId,
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        disabled={!incluido}
                        className={cn(
                          'w-24 h-7 px-2 text-[11px] rounded text-right tabular-nums bg-white outline-none focus:ring-1 focus:ring-amber-500',
                          exceso
                            ? 'border border-red-400'
                            : esParcial
                              ? 'border border-amber-400'
                              : cubreTotal
                                ? 'border border-emerald-400'
                                : 'border border-slate-300',
                          !incluido && 'bg-slate-50 cursor-not-allowed',
                        )}
                      />
                    </td>

                    <td className="py-2.5 px-3">
                      {!incluido ? (
                        <span className="text-[10px] text-slate-400">
                          No incluido
                        </span>
                      ) : exceso ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
                          Excede pendiente
                        </span>
                      ) : cubreTotal ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                          Total
                        </span>
                      ) : (
                        <>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                            Parcial
                          </span>
                          <div className="text-[9px] text-amber-700 mt-0.5 tabular-nums">
                            Resta {formatMoney(queda, deuda.moneda)}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer balance */}
      <div className="rounded-lg px-4 py-3 border bg-amber-50 border-amber-200">
        <div className="grid grid-cols-3 gap-3 text-center text-[12px]">
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
              Total deudas
            </div>
            <div className="font-bold text-slate-900 tabular-nums">
              {formatMoney(totalDeudas, moneda)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
              A cargar
            </div>
            <div className="font-bold text-amber-700 tabular-nums">
              {formatMoney(total, moneda)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
              Restará pendiente
            </div>
            <div className="font-bold text-slate-700 tabular-nums">
              {formatMoney(Math.max(0, totalDeudas - total), moneda)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
