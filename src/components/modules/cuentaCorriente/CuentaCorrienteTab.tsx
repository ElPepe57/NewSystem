/**
 * CuentaCorrienteTab — S55 Fase 7 · Componente reutilizable de extracto CC
 *
 * Muestra el saldo actual + extracto bancario tipo de movimientos de una
 * Cuenta Corriente (cliente / proveedor / colaborador / empleado).
 *
 * Diseño: layout extracto bancario (fecha, concepto, débito, crédito, saldo).
 * Filtros básicos por moneda y tipo de movimiento.
 *
 * Uso en fichas:
 *   <CuentaCorrienteTab entidadId={proveedor.id} tipo="proveedor" entidadNombre={proveedor.nombre} />
 */

import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Filter,
  ArrowDownCircle,
  ArrowUpCircle,
  CircleDot,
  RefreshCw,
} from 'lucide-react';
import { useCuentaCorriente } from '../../../hooks/useCuentaCorriente';
import { useMovimientosCC } from '../../../hooks/useMovimientosCC';
import {
  buildCuentaCorrienteId,
  esDebito,
  esCredito,
  TIPO_MOVIMIENTO_CC_LABELS,
  type TipoEntidadCC,
  type MonedaCC,
} from '../../../types/cuentaCorriente.types';
import { Badge } from '../../common';
import { cn } from '../../../design-system';

interface CuentaCorrienteTabProps {
  entidadId: string;
  tipo: TipoEntidadCC;
  /** Nombre denormalizado para mostrar en encabezado si la CC aún no existe. */
  entidadNombre: string;
  /** Mostrar el banner de saldo grande (default true). */
  showSaldoBanner?: boolean;
}

/**
 * Formatea un saldo CC con signo y color semántico según convención:
 *  - Positivo (la entidad nos debe) → verde
 *  - Negativo (le debemos a la entidad) → rojo
 *  - Cero → gris (saldado)
 */
function formatSaldo(saldo: number, moneda: MonedaCC): {
  text: string;
  colorClass: string;
  label: string;
} {
  const simbolo = moneda === 'USD' ? 'US$' : 'S/';
  if (Math.abs(saldo) < 0.01) {
    return {
      text: `${simbolo} 0.00`,
      colorClass: 'text-slate-500',
      label: 'Saldado',
    };
  }
  if (saldo > 0) {
    return {
      text: `+${simbolo} ${saldo.toFixed(2)}`,
      colorClass: 'text-emerald-700',
      label: 'A favor',
    };
  }
  return {
    text: `−${simbolo} ${Math.abs(saldo).toFixed(2)}`,
    colorClass: 'text-red-700',
    label: 'Por pagar',
  };
}

export const CuentaCorrienteTab: React.FC<CuentaCorrienteTabProps> = ({
  entidadId,
  tipo,
  entidadNombre,
  showSaldoBanner = true,
}) => {
  const ccId = useMemo(
    () => buildCuentaCorrienteId(entidadId, tipo),
    [entidadId, tipo],
  );
  const { cc, loading: loadingCC } = useCuentaCorriente(entidadId, tipo);
  const { movimientos, loading: loadingMovs, refresh } = useMovimientosCC(ccId);

  const [filtroMoneda, setFiltroMoneda] = useState<'todas' | MonedaCC>('todas');

  const movimientosFiltrados = useMemo(() => {
    if (filtroMoneda === 'todas') return movimientos;
    return movimientos.filter((m) => m.moneda === filtroMoneda);
  }, [movimientos, filtroMoneda]);

  // ─── Estados de carga / vacío ─────────────────────────────────────────

  if (loadingCC) {
    return (
      <div className="p-6 text-center text-sm text-slate-400 italic">
        Cargando cuenta corriente...
      </div>
    );
  }

  // Si la CC no existe (sin movimientos), mostramos saldo 0
  const saldoPEN = cc?.saldoPEN || 0;
  const saldoUSD = cc?.saldoUSD || 0;
  const cantMovs = cc?.cantidadMovimientos || 0;

  const fmtPEN = formatSaldo(saldoPEN, 'PEN');
  const fmtUSD = formatSaldo(saldoUSD, 'USD');

  return (
    <div className="space-y-4">
      {/* ─── Banner saldos ─────────────────────────────────────────────── */}
      {showSaldoBanner && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* PEN */}
          <div className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-white to-slate-50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Saldo PEN
              </span>
              <Wallet className="w-4 h-4 text-slate-400" />
            </div>
            <div className={cn('text-2xl font-bold tabular-nums', fmtPEN.colorClass)}>
              {fmtPEN.text}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{fmtPEN.label}</div>
          </div>
          {/* USD */}
          <div className="border border-slate-200 rounded-xl p-4 bg-gradient-to-br from-white to-slate-50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Saldo USD
              </span>
              <Wallet className="w-4 h-4 text-slate-400" />
            </div>
            <div className={cn('text-2xl font-bold tabular-nums', fmtUSD.colorClass)}>
              {fmtUSD.text}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{fmtUSD.label}</div>
          </div>
        </div>
      )}

      {/* ─── Header con filtros + refresh ──────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            Movimientos · {cantMovs}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro moneda */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setFiltroMoneda('todas')}
              className={cn(
                'px-2 py-0.5 text-[11px] rounded transition-colors',
                filtroMoneda === 'todas'
                  ? 'bg-white text-slate-900 shadow-sm font-medium'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFiltroMoneda('PEN')}
              className={cn(
                'px-2 py-0.5 text-[11px] rounded transition-colors',
                filtroMoneda === 'PEN'
                  ? 'bg-white text-slate-900 shadow-sm font-medium'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              PEN
            </button>
            <button
              type="button"
              onClick={() => setFiltroMoneda('USD')}
              className={cn(
                'px-2 py-0.5 text-[11px] rounded transition-colors',
                filtroMoneda === 'USD'
                  ? 'bg-white text-slate-900 shadow-sm font-medium'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              USD
            </button>
          </div>
          {/* Refresh */}
          <button
            type="button"
            onClick={refresh}
            disabled={loadingMovs}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
            title="Recargar movimientos"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loadingMovs && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ─── Extracto / tabla de movimientos ───────────────────────────── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {loadingMovs ? (
          <div className="p-6 text-center text-sm text-slate-400 italic">
            Cargando movimientos...
          </div>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="p-8 text-center">
            <Filter className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <div className="text-sm text-slate-500">
              {cantMovs === 0
                ? `${entidadNombre} aún no tiene movimientos en su cuenta corriente.`
                : 'No hay movimientos que coincidan con el filtro.'}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] text-slate-600 uppercase">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Fecha</th>
                <th className="text-left px-3 py-2 font-semibold">Concepto</th>
                <th className="text-left px-3 py-2 font-semibold">Doc</th>
                <th className="text-right px-3 py-2 font-semibold">Débito</th>
                <th className="text-right px-3 py-2 font-semibold">Crédito</th>
                <th className="text-right px-3 py-2 font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movimientosFiltrados.map((mov) => {
                const isDebito = esDebito(mov.tipo);
                const isCredito = esCredito(mov.tipo);
                const simbolo = mov.moneda === 'USD' ? 'US$' : 'S/';
                const saldoPostMov =
                  mov.moneda === 'USD' ? mov.saldoUSDDespues : mov.saldoPENDespues;
                const colorSaldo =
                  Math.abs(saldoPostMov) < 0.01
                    ? 'text-slate-500'
                    : saldoPostMov > 0
                      ? 'text-emerald-700'
                      : 'text-red-700';

                return (
                  <tr key={mov.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-[12px] tabular-nums whitespace-nowrap text-slate-600">
                      {mov.fecha.toDate().toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-2 text-[12px]">
                      <div className="flex items-center gap-1.5">
                        {isDebito && (
                          <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        )}
                        {isCredito && mov.tipo !== 'ajuste_manual' && (
                          <ArrowDownCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        )}
                        {mov.tipo === 'ajuste_manual' && (
                          <CircleDot className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-slate-900 truncate">
                            {TIPO_MOVIMIENTO_CC_LABELS[mov.tipo]}
                          </div>
                          {mov.descripcion && (
                            <div className="text-[11px] text-slate-500 truncate">
                              {mov.descripcion}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">
                      {mov.refDocumentoNumero || '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {isDebito ? (
                        <span className="text-emerald-700 font-medium">
                          {simbolo} {mov.monto.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {isCredito ? (
                        <span className="text-red-600 font-medium">
                          {simbolo} {mov.monto.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap',
                        colorSaldo,
                      )}
                    >
                      {simbolo} {saldoPostMov.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── Convención de saldos (info) ────────────────────────────────── */}
      <div className="text-[10px] text-slate-400 italic px-2">
        <span className="text-emerald-700 font-medium">+ Saldo a favor</span>: la entidad
        nos debe ·{' '}
        <span className="text-red-700 font-medium">− Saldo en contra</span>: nosotros le
        debemos ·{' '}
        <span className="text-slate-500 font-medium">0</span>: cuenta saldada
      </div>
    </div>
  );
};

// Re-export para conveniencia
export { TIPO_MOVIMIENTO_CC_LABELS };
export type { TipoEntidadCC, MonedaCC };

// Iconos no usados pero exportables si se necesitan
export const _icons = { TrendingUp, TrendingDown };
