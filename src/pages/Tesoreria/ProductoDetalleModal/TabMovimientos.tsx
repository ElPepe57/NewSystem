/**
 * TabMovimientos — Imp-L2 · M2 detalle producto · tab "Movimientos"
 *
 * Tabla rica desktop (cards en mobile) con saldo corrido bancario,
 * filtros rápidos por categoría y paginación.
 *
 * Carga movimientos del libro mayor unificado (productoFinanciero.adapters
 * vía getMovimientosUnificados) filtrados por productoId.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, FileText } from 'lucide-react';
import type { CuentaCaja, MovimientoTesoreria } from '../../../types/tesoreria.types';
import { cn } from '../../../design-system/utils';

function fmtSaldo(n: number, moneda: 'PEN' | 'USD'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtFecha(t: any): string {
  const d = t?.toDate?.() ?? new Date(t);
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

type FiltroTipo = 'todos' | 'ingresos' | 'egresos' | 'transferencias';

const ES_INGRESO = (m: MovimientoTesoreria, productoId: string): boolean => {
  return m.cuentaDestino === productoId;
};

export interface TabMovimientosProps {
  cuenta: CuentaCaja;
  movimientos: MovimientoTesoreria[];
  loading?: boolean;
}

export const TabMovimientos: React.FC<TabMovimientosProps> = ({
  cuenta,
  movimientos,
  loading = false,
}) => {
  const [filtro, setFiltro] = useState<FiltroTipo>('todos');

  // Filtrar movimientos del producto
  const movsProducto = useMemo(() => {
    return movimientos.filter(
      (m) => m.cuentaOrigen === cuenta.id || m.cuentaDestino === cuenta.id,
    );
  }, [movimientos, cuenta.id]);

  // Aplicar filtro
  const movsFiltrados = useMemo(() => {
    if (filtro === 'todos') return movsProducto;
    if (filtro === 'ingresos') return movsProducto.filter((m) => ES_INGRESO(m, cuenta.id));
    if (filtro === 'egresos')
      return movsProducto.filter((m) => !ES_INGRESO(m, cuenta.id) && m.tipo !== 'transferencia_interna');
    if (filtro === 'transferencias')
      return movsProducto.filter((m) => m.tipo === 'transferencia_interna');
    return movsProducto;
  }, [movsProducto, filtro, cuenta.id]);

  // Saldo corrido
  const movsConSaldo = useMemo(() => {
    const ordenados = [...movsFiltrados].sort((a, b) => {
      const ta = a.fecha?.toDate?.()?.getTime() ?? 0;
      const tb = b.fecha?.toDate?.()?.getTime() ?? 0;
      return ta - tb;
    });
    let saldo = 0;
    const result = ordenados.map((m) => {
      if (m.estado !== 'anulado') {
        const esIng = ES_INGRESO(m, cuenta.id);
        saldo += (esIng ? 1 : -1) * m.monto;
      }
      return { mov: m, saldoCorrido: saldo };
    });
    return result.reverse(); // descendente para display
  }, [movsFiltrados, cuenta.id]);

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-400">
        Cargando movimientos...
      </div>
    );
  }

  if (movsProducto.length === 0) {
    return (
      <div className="p-12 text-center">
        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="text-sm text-slate-500 font-medium">Sin movimientos</p>
        <p className="text-xs text-slate-400 mt-1">
          Este producto aún no tiene movimientos registrados.
        </p>
      </div>
    );
  }

  const FILTROS: Array<{ value: FiltroTipo; label: string }> = [
    { value: 'todos', label: 'Todos' },
    { value: 'ingresos', label: 'Ingresos' },
    { value: 'egresos', label: 'Egresos' },
    { value: 'transferencias', label: 'Transferencias' },
  ];

  return (
    <div>
      {/* Filtros rápidos */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-600">Filtrar:</span>
        {FILTROS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFiltro(f.value)}
            className={cn(
              'text-[11px] px-2.5 py-1 rounded-full transition-all',
              filtro === f.value
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-400">
          {movsFiltrados.length} {movsFiltrados.length === 1 ? 'movimiento' : 'movimientos'}
        </span>
      </div>

      {/* Tabla desktop */}
      <div className="hidden md:block overflow-x-auto max-h-[55vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
              <th className="px-5 py-2.5">Fecha</th>
              <th className="px-3 py-2.5">Concepto</th>
              <th className="px-3 py-2.5">Tipo</th>
              <th className="px-3 py-2.5 text-right">Monto</th>
              <th className="px-5 py-2.5 text-right">Saldo corrido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movsConSaldo.map(({ mov, saldoCorrido }) => {
              const esIng = ES_INGRESO(mov, cuenta.id);
              const esTransf = mov.tipo === 'transferencia_interna';
              return (
                <tr
                  key={mov.id}
                  className={cn(
                    'hover:bg-teal-50/50 transition-colors',
                    mov.estado === 'anulado' && 'opacity-50',
                  )}
                >
                  <td className="px-5 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                    {fmtFecha(mov.fecha)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-800 truncate max-w-xs">
                      {mov.concepto}
                    </div>
                    <div className="text-xs text-slate-400 truncate max-w-xs">
                      {mov.ordenCompraNumero ?? mov.ventaNumero ?? mov.gastoNumero ?? mov.numeroMovimiento}
                      {mov.metodo && ` · ${mov.metodo}`}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {esTransf ? (
                      <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <ArrowLeftRight className="w-2.5 h-2.5" />
                        Transferencia
                      </span>
                    ) : esIng ? (
                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <ArrowDownLeft className="w-2.5 h-2.5" />
                        Ingreso
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <ArrowUpRight className="w-2.5 h-2.5" />
                        Egreso
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                    <span
                      className={cn(
                        'font-semibold',
                        esIng ? 'text-emerald-700' : 'text-red-600',
                      )}
                    >
                      {esIng ? '+' : '−'}
                      {fmtSaldo(mov.monto, mov.moneda)}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-slate-500 whitespace-nowrap">
                    {fmtSaldo(saldoCorrido, cuenta.moneda)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cards mobile */}
      <div className="md:hidden divide-y divide-slate-100 max-h-[55vh] overflow-y-auto">
        {movsConSaldo.map(({ mov, saldoCorrido }) => {
          const esIng = ES_INGRESO(mov, cuenta.id);
          return (
            <div
              key={mov.id}
              className={cn(
                'px-4 py-3',
                mov.estado === 'anulado' && 'opacity-50',
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] text-slate-500">
                  {fmtFecha(mov.fecha)}
                </span>
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    esIng ? 'text-emerald-700' : 'text-red-600',
                  )}
                >
                  {esIng ? '+' : '−'}
                  {fmtSaldo(mov.monto, mov.moneda)}
                </span>
              </div>
              <div className="text-sm font-medium text-slate-800 truncate">
                {mov.concepto}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Saldo: {fmtSaldo(saldoCorrido, cuenta.moneda)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
