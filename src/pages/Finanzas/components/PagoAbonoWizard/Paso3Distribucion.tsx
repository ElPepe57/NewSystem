/**
 * Paso 3 — Distribuir el abono ⭐ pieza clave
 *
 * Tabla con todos los documentos pendientes. Estrategias auto + manual.
 * Balance en vivo: Abono · Distribuido · Restante. Validación reactiva.
 *
 * UX:
 *  - Estrategia se aplica auto via useEffect en el shell.
 *  - Toggle de check por fila para incluir/excluir.
 *  - Edición inline del monto con re-cálculo en vivo.
 *  - Botón "Igualar al pendiente" por fila para llenarla rápido.
 */

import React, { useMemo } from 'react';
import {
  ClockArrowDown,
  CircleAlert,
  ArrowDownWideNarrow,
  Pencil,
  RotateCw,
} from 'lucide-react';
import {
  autoDistribuir,
} from '../../../../types/pagoAbonoDistribuido.types';
import type {
  DistribucionItem,
  EstrategiaDistribucion,
} from '../../../../types/pagoAbonoDistribuido.types';
import type { PagoAbonoState } from './types';
import { cn } from '../../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

interface Paso3Props {
  state: PagoAbonoState;
  setState: React.Dispatch<React.SetStateAction<PagoAbonoState>>;
}

const ESTRATEGIAS: Array<{
  value: EstrategiaDistribucion;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'antiguas_primero', label: 'Más antiguas primero', icon: ClockArrowDown },
  { value: 'solo_vencidas', label: 'Solo vencidas', icon: CircleAlert },
  { value: 'mayor_monto', label: 'Mayor monto', icon: ArrowDownWideNarrow },
  { value: 'manual', label: 'Manual', icon: Pencil },
];

const TOLERANCIA = 0.01;

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function formatMoney(n: number, moneda: 'USD' | 'PEN'): string {
  const symbol = moneda === 'USD' ? 'US$' : 'S/';
  return `${symbol} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const Paso3Distribucion: React.FC<Paso3Props> = ({ state, setState }) => {
  const montoAbono = state.montoAbono ?? 0;

  // ── Solo deudas en la moneda del abono ──
  const deudasFiltradas = useMemo(() => {
    return state.deudas.filter((d) => d.moneda === state.monedaAbono);
  }, [state.deudas, state.monedaAbono]);

  // ── Sumas para balance ──
  const distribuido = useMemo(
    () => state.distribucion.reduce((s, d) => s + d.montoAplicado, 0),
    [state.distribucion],
  );
  const restante = montoAbono - distribuido;
  const completo = Math.abs(restante) < TOLERANCIA;

  // ── Aplicar estrategia ──
  const handleEstrategia = (e: EstrategiaDistribucion) => {
    if (e === 'manual') {
      // Mantener distribución actual; usuario edita libremente
      setState((s) => ({ ...s, estrategia: e }));
      return;
    }
    const nueva = autoDistribuir(deudasFiltradas, montoAbono, e);
    setState((s) => ({ ...s, estrategia: e, distribucion: nueva }));
  };

  const handleReaplicar = () => {
    if (state.estrategia === 'manual') return;
    const nueva = autoDistribuir(deudasFiltradas, montoAbono, state.estrategia);
    setState((s) => ({ ...s, distribucion: nueva }));
  };

  // ── Modificar item de distribución ──
  const setMontoItem = (documentoId: string, monto: number) => {
    setState((s) => {
      const existe = s.distribucion.find((d) => d.documentoId === documentoId);
      if (!existe) {
        const deuda = deudasFiltradas.find((d) => d.documentoId === documentoId);
        if (!deuda) return s;
        return {
          ...s,
          // Auto-cambiar a manual si edita un valor
          estrategia: 'manual',
          distribucion: [
            ...s.distribucion,
            {
              tipo: deuda.tipo,
              documentoId: deuda.documentoId,
              documentoNumero: deuda.documentoNumero,
              montoAplicado: monto,
            },
          ],
        };
      }
      if (monto <= 0) {
        // Eliminar el item
        return {
          ...s,
          estrategia: 'manual',
          distribucion: s.distribucion.filter((d) => d.documentoId !== documentoId),
        };
      }
      return {
        ...s,
        estrategia: 'manual',
        distribucion: s.distribucion.map((d) =>
          d.documentoId === documentoId ? { ...d, montoAplicado: monto } : d,
        ),
      };
    });
  };

  const toggleItem = (documentoId: string, incluir: boolean) => {
    if (incluir) {
      const deuda = deudasFiltradas.find((d) => d.documentoId === documentoId);
      if (!deuda) return;
      // Aplicar el restante (o el pendiente, lo que sea menor)
      const aplicar = Math.min(restante > 0 ? restante : 0, deuda.montoPendiente);
      if (aplicar <= TOLERANCIA) return;
      setMontoItem(documentoId, aplicar);
    } else {
      setMontoItem(documentoId, 0);
    }
  };

  const igualarAlPendiente = (documentoId: string, montoPendiente: number) => {
    const itemActual = state.distribucion.find((d) => d.documentoId === documentoId);
    const aporteActual = itemActual?.montoAplicado ?? 0;
    // Cuánto restante hay disponible (sumando lo que ya tiene este item)
    const disponible = restante + aporteActual;
    const target = Math.min(montoPendiente, disponible);
    if (target > TOLERANCIA) {
      setMontoItem(documentoId, target);
    }
  };

  // ── Render ──
  if (deudasFiltradas.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-[12px] text-amber-900">
        No hay documentos pendientes en {state.monedaAbono}. Vuelve al Paso 2
        y cambia la moneda del abono.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estrategia */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase text-slate-500 font-semibold mr-1">
            Estrategia
          </span>
          {ESTRATEGIAS.map((est) => {
            const Icon = est.icon;
            const active = state.estrategia === est.value;
            return (
              <button
                key={est.value}
                type="button"
                onClick={() => handleEstrategia(est.value)}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors',
                  active
                    ? 'bg-white text-teal-700 shadow-sm border border-teal-300 font-semibold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                <Icon className="w-3 h-3" />
                {est.label}
              </button>
            );
          })}
        </div>
        {state.estrategia !== 'manual' && (
          <button
            type="button"
            onClick={handleReaplicar}
            className="text-[11px] text-teal-700 hover:underline font-medium flex items-center gap-1"
          >
            <RotateCw className="w-3 h-3" />
            Reaplicar
          </button>
        )}
      </div>

      {/* Tabla de documentos */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="text-[10px] uppercase text-slate-500 font-semibold border-b border-slate-200">
                <th className="text-left py-2 px-3 w-10">Inc.</th>
                <th className="text-left py-2 pr-2">Documento</th>
                <th className="text-right py-2 pr-2">Pendiente</th>
                <th className="text-right py-2 pr-2 w-32">A pagar</th>
                <th className="text-left py-2 px-3 w-32">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deudasFiltradas.map((deuda) => {
                const item = state.distribucion.find(
                  (i) => i.documentoId === deuda.documentoId,
                );
                const incluida = !!item && item.montoAplicado > 0;
                const aplicado = item?.montoAplicado ?? 0;
                const queda = deuda.montoPendiente - aplicado;
                const cubreTotal = aplicado >= deuda.montoPendiente - TOLERANCIA;
                const esParcial = aplicado > TOLERANCIA && !cubreTotal;
                const rowDimmed = !incluida;
                const rowAmber = esParcial;

                return (
                  <tr
                    key={deuda.documentoId}
                    className={cn(
                      'hover:bg-slate-50/50 transition-colors',
                      rowDimmed && 'opacity-60',
                      rowAmber && 'bg-amber-50/30',
                    )}
                  >
                    {/* Checkbox incluir */}
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={incluida}
                        onChange={(e) =>
                          toggleItem(deuda.documentoId, e.target.checked)
                        }
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                    </td>

                    {/* Documento */}
                    <td className="py-2.5 pr-2">
                      <div className="font-mono font-semibold text-slate-900">
                        {deuda.documentoNumero}
                      </div>
                      {deuda.estaVencido && deuda.diasVencimiento !== undefined ? (
                        <div className="text-[10px] text-amber-700 flex items-center gap-1">
                          <CircleAlert className="w-2.5 h-2.5" />
                          Vencida hace {Math.abs(deuda.diasVencimiento)} días
                        </div>
                      ) : deuda.diasVencimiento !== undefined ? (
                        <div className="text-[10px] text-slate-500">
                          Vence en {deuda.diasVencimiento} días
                        </div>
                      ) : null}
                    </td>

                    {/* Pendiente */}
                    <td className="py-2.5 pr-2 text-right tabular-nums">
                      {formatMoney(deuda.montoPendiente, deuda.moneda)}
                    </td>

                    {/* A pagar (input) */}
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center justify-end gap-1">
                        {incluida && !cubreTotal && (
                          <button
                            type="button"
                            onClick={() =>
                              igualarAlPendiente(
                                deuda.documentoId,
                                deuda.montoPendiente,
                              )
                            }
                            title="Igualar al pendiente"
                            className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 whitespace-nowrap"
                          >
                            Max
                          </button>
                        )}
                        <input
                          type="number"
                          step="0.01"
                          value={aplicado || ''}
                          placeholder="—"
                          onChange={(e) =>
                            setMontoItem(
                              deuda.documentoId,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className={cn(
                            'w-24 h-7 px-2 text-[11px] rounded text-right tabular-nums bg-white outline-none focus:ring-1 focus:ring-teal-500',
                            esParcial
                              ? 'border border-amber-400'
                              : cubreTotal
                                ? 'border border-emerald-400'
                                : 'border border-slate-300',
                          )}
                        />
                      </div>
                    </td>

                    {/* Resultado */}
                    <td className="py-2.5 px-3">
                      {!incluida ? (
                        <span className="text-[10px] text-slate-400">No incluida</span>
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

      {/* Balance */}
      <div
        className={cn(
          'rounded-lg px-4 py-3 border',
          completo
            ? 'bg-teal-50 border-teal-200'
            : restante > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200',
        )}
      >
        <div className="grid grid-cols-3 gap-3 text-center text-[12px]">
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
              Abono
            </div>
            <div className="font-bold text-slate-900 tabular-nums">
              {formatMoney(montoAbono, state.monedaAbono)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
              Distribuido
            </div>
            <div className="font-bold text-teal-700 tabular-nums">
              {formatMoney(distribuido, state.monedaAbono)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
              Restante
            </div>
            <div
              className={cn(
                'font-bold tabular-nums',
                completo
                  ? 'text-emerald-700'
                  : restante > 0
                    ? 'text-amber-700'
                    : 'text-red-700',
              )}
            >
              {formatMoney(restante, state.monedaAbono)}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 w-full h-1.5 bg-white rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300',
              completo
                ? 'bg-teal-600'
                : restante > 0
                  ? 'bg-amber-500'
                  : 'bg-red-500',
            )}
            style={{
              width: `${Math.min(100, montoAbono > 0 ? (distribuido / montoAbono) * 100 : 0)}%`,
            }}
          />
        </div>

        <div className="text-[10px] text-center mt-1.5 font-medium">
          {completo ? (
            <span className="text-emerald-700">
              ✓ Distribución completa · 100% del abono asignado
            </span>
          ) : restante > 0 ? (
            <span className="text-amber-700">
              Falta distribuir {formatMoney(restante, state.monedaAbono)}
            </span>
          ) : (
            <span className="text-red-700">
              Sobre-distribuido en {formatMoney(Math.abs(restante), state.monedaAbono)} · reduce alguno
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
