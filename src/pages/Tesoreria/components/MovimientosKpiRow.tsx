/**
 * MovimientosKpiRow — Imp-L6 · M6 movimientos
 *
 * KPI strip horizontal estilo S58e (`tesoreria-movimientos-s58e.html`):
 * 4 KPIs ejecutivos del libro mayor en una sola fila con divisores verticales,
 * deltas vs mes anterior y "mostrando X de Y".
 *
 * Refactor M-MIGRACION-VISUAL · sesión post-Gastos: alinear a mockup canónico
 * con tabular-nums, decimales en tono atenuado y deltas calculados.
 */

import React, { useMemo } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { MovimientoTesoreria } from '../../../types/tesoreria.types';
import { toDateOrNow } from '../../../utils/dateFormatters';

const ES_INGRESO = (m: MovimientoTesoreria): boolean => {
  const tipoIngreso = ['ingreso_venta', 'ingreso_anticipo', 'ingreso_otro', 'aporte_capital', 'ajuste_positivo'];
  return tipoIngreso.includes(m.tipo);
};

const ES_EGRESO = (m: MovimientoTesoreria): boolean => {
  const tipoEgreso = [
    'pago_orden_compra',
    'pago_viajero',
    'pago_proveedor_local',
    'gasto_operativo',
    'retiro_socio',
    'pago_nomina',
    'adelanto_empleado',
    'ajuste_negativo',
  ];
  return tipoEgreso.includes(m.tipo);
};

/** Format S/ 62,340.50 con decimales en clase distinta para tono atenuado. */
function fmtPEN(n: number): { entero: string; decimales: string } {
  const entero = Math.floor(Math.abs(n)).toLocaleString('es-PE');
  const decimales = (Math.round((Math.abs(n) % 1) * 100)).toString().padStart(2, '0');
  return { entero: `${n < 0 ? '-' : ''}S/ ${entero}`, decimales: `.${decimales}` };
}

export interface MovimientosKpiRowProps {
  movimientos: MovimientoTesoreria[];
  /** TC para consolidar USD a PEN (default 3.85) */
  tipoCambio?: number;
  /** Total bruto antes de filtros (para mostrar "X de Y"). Si no se pasa, usa movimientos.length. */
  totalSinFiltros?: number;
}

export const MovimientosKpiRow: React.FC<MovimientosKpiRowProps> = ({
  movimientos,
  tipoCambio = 3.85,
  totalSinFiltros,
}) => {
  // Calcular periodo actual y mes anterior para deltas.
  const { ingresosPEN, egresosPEN, totalCount, deltaIngresos, deltaEgresos } = useMemo(() => {
    let ingresosPEN = 0;
    let egresosPEN = 0;
    let totalCount = 0;
    let ingresosMesAnterior = 0;
    let egresosMesAnterior = 0;

    const ahora = new Date();
    const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);

    for (const m of movimientos) {
      if (m.estado === 'anulado') continue;
      totalCount++;
      const montoPEN = m.montoEquivalentePEN ?? (m.moneda === 'PEN' ? m.monto : m.monto * tipoCambio);
      const fecha = toDateOrNow(m.fecha);
      const enMesActual = fecha >= inicioMesActual;
      const enMesAnterior = fecha >= inicioMesAnterior && fecha < inicioMesActual;

      if (ES_INGRESO(m)) {
        ingresosPEN += montoPEN;
        if (enMesAnterior) ingresosMesAnterior += montoPEN;
        if (!enMesActual && !enMesAnterior) {
          /* no contribuye a ningún delta */
        }
      } else if (ES_EGRESO(m)) {
        egresosPEN += montoPEN;
        if (enMesAnterior) egresosMesAnterior += montoPEN;
      }
    }

    const deltaIngresos = ingresosMesAnterior > 0
      ? ((ingresosPEN - ingresosMesAnterior) / ingresosMesAnterior) * 100
      : 0;
    const deltaEgresos = egresosMesAnterior > 0
      ? ((egresosPEN - egresosMesAnterior) / egresosMesAnterior) * 100
      : 0;

    return { ingresosPEN, egresosPEN, totalCount, deltaIngresos, deltaEgresos };
  }, [movimientos, tipoCambio]);

  const neto = ingresosPEN - egresosPEN;
  const netoPositivo = neto >= 0;
  const ingresosFmt = fmtPEN(ingresosPEN);
  const egresosFmt = fmtPEN(egresosPEN);
  const netoFmt = fmtPEN(Math.abs(neto));
  const totalGlobal = typeof totalSinFiltros === 'number' ? totalSinFiltros : totalCount;
  const mostrandoSubset = totalGlobal !== totalCount;

  return (
    <div className="bg-white border border-slate-200 rounded-xl mb-4 grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
      {/* Ingresos del periodo */}
      <div className="p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Ingresos del periodo
        </div>
        <div className="text-xl font-bold text-emerald-700 tabular-nums">
          {ingresosFmt.entero}
          <span className="text-slate-400 text-sm font-normal">{ingresosFmt.decimales}</span>
        </div>
        {Math.abs(deltaIngresos) > 0.01 && (
          <div
            className={`text-xs mt-0.5 flex items-center gap-1 ${
              deltaIngresos > 0 ? 'text-emerald-600' : 'text-rose-500'
            }`}
          >
            {deltaIngresos > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {deltaIngresos > 0 ? '+' : ''}
            {deltaIngresos.toFixed(0)}% vs. mes anterior
          </div>
        )}
      </div>

      {/* Egresos del periodo */}
      <div className="p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Egresos del periodo
        </div>
        <div className="text-xl font-bold text-rose-600 tabular-nums">
          {egresosFmt.entero}
          <span className="text-slate-400 text-sm font-normal">{egresosFmt.decimales}</span>
        </div>
        {Math.abs(deltaEgresos) > 0.01 && (
          <div
            className={`text-xs mt-0.5 flex items-center gap-1 ${
              deltaEgresos > 0 ? 'text-rose-500' : 'text-emerald-600'
            }`}
          >
            {deltaEgresos > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {deltaEgresos > 0 ? '+' : ''}
            {deltaEgresos.toFixed(0)}% vs. mes anterior
          </div>
        )}
      </div>

      {/* Saldo neto */}
      <div className="p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Saldo neto
        </div>
        <div
          className={`text-xl font-bold tabular-nums ${netoPositivo ? 'text-teal-700' : 'text-rose-600'}`}
        >
          {netoPositivo ? '+' : '-'}
          {netoFmt.entero.replace('-', '')}
          <span className="text-slate-400 text-sm font-normal">{netoFmt.decimales}</span>
        </div>
        <div
          className={`text-xs mt-0.5 flex items-center gap-1 ${
            netoPositivo ? 'text-emerald-600' : 'text-rose-500'
          }`}
        >
          <ArrowUpRight className="w-3 h-3" />
          {netoPositivo ? 'Positivo' : 'Negativo'} ·{' '}
          {new Date().toLocaleString('es-PE', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Movimientos */}
      <div className="p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Movimientos
        </div>
        <div className="text-xl font-bold text-slate-900 tabular-nums">
          {totalCount.toLocaleString('es-PE')}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          {mostrandoSubset
            ? `Mostrando ${totalCount.toLocaleString('es-PE')} de ${totalGlobal.toLocaleString('es-PE')}`
            : 'En el filtro actual'}
        </div>
      </div>
    </div>
  );
};
