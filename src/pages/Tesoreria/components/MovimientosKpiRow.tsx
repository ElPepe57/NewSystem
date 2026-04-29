/**
 * MovimientosKpiRow — Imp-L6 · M6 movimientos
 *
 * 4 KPIs ejecutivos del libro mayor: ingresos / egresos / neto / conteo.
 * Calcula totales en PEN equivalente desde la lista de movimientos.
 */

import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  FileText,
} from 'lucide-react';
import type { MovimientoTesoreria } from '../../../types/tesoreria.types';

function fmtPEN(n: number): string {
  return `S/ ${Math.floor(n).toLocaleString('es-PE')}.${((n * 100) % 100).toFixed(0).padStart(2, '0')}`;
}

const ES_INGRESO = (m: MovimientoTesoreria): boolean => {
  // Heurística: si tiene cuentaDestino y NO cuentaOrigen → ingreso puro
  // Conversiones y transferencias se tratan como neutros (no suman ni restan al neto)
  const tipoIngreso = ['ingreso_venta', 'ingreso_anticipo', 'ingreso_otro', 'aporte_capital'];
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
  ];
  return tipoEgreso.includes(m.tipo);
};

export interface MovimientosKpiRowProps {
  movimientos: MovimientoTesoreria[];
  /** TC para consolidar USD a PEN (default 3.85) */
  tipoCambio?: number;
}

export const MovimientosKpiRow: React.FC<MovimientosKpiRowProps> = ({
  movimientos,
  tipoCambio = 3.85,
}) => {
  let ingresosPEN = 0;
  let egresosPEN = 0;
  let totalCount = 0;

  for (const m of movimientos) {
    if (m.estado === 'anulado') continue;
    totalCount++;
    const montoPEN = m.montoEquivalentePEN ?? (m.moneda === 'PEN' ? m.monto : m.monto * tipoCambio);
    if (ES_INGRESO(m)) ingresosPEN += montoPEN;
    else if (ES_EGRESO(m)) egresosPEN += montoPEN;
  }

  const neto = ingresosPEN - egresosPEN;
  const netoPositivo = neto >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      {/* Ingresos */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            Ingresos del periodo
          </span>
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
        </div>
        <div className="text-2xl font-bold text-emerald-700 tabular-nums">
          {fmtPEN(ingresosPEN)}
        </div>
        <div className="text-xs text-slate-500 mt-1">PEN equivalente</div>
      </div>

      {/* Egresos */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            Egresos del periodo
          </span>
          <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4 text-red-600" />
          </div>
        </div>
        <div className="text-2xl font-bold text-red-600 tabular-nums">
          {fmtPEN(egresosPEN)}
        </div>
        <div className="text-xs text-slate-500 mt-1">PEN equivalente</div>
      </div>

      {/* Neto */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            Flujo neto
          </span>
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${netoPositivo ? 'bg-emerald-50' : 'bg-red-50'}`}
          >
            {netoPositivo ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-600" />
            )}
          </div>
        </div>
        <div
          className={`text-2xl font-bold tabular-nums ${netoPositivo ? 'text-emerald-700' : 'text-red-600'}`}
        >
          {netoPositivo ? '+' : '−'}
          {fmtPEN(Math.abs(neto))}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {netoPositivo ? 'Saldo del periodo positivo' : 'Saldo del periodo negativo'}
        </div>
      </div>

      {/* Conteo */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            Movimientos
          </span>
          <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-teal-600" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-900 tabular-nums">
          {totalCount}
        </div>
        <div className="text-xs text-slate-500 mt-1">Ejecutados en el filtro</div>
      </div>
    </div>
  );
};
