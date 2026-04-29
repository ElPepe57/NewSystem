/**
 * KpiRow — Imp-L2 · M2 detalle producto
 *
 * 4 KPIs en grid debajo del hero. Adapta los KPIs según tipo de producto:
 *   - Cuenta bi-moneda → Saldo PEN / Saldo USD / Última act / Movs del mes
 *   - Cuenta mono     → Saldo / Saldo mínimo / Última act / Movs del mes
 *   - Tarjeta crédito → Saldo cargos / Próximo corte / Próximo pago / Tope control
 */

import React from 'react';
import type { CuentaCaja } from '../../../types/tesoreria.types';

function fmtPEN(n: number): string {
  return `S/ ${Math.floor(n).toLocaleString('es-PE')}.${((n * 100) % 100).toFixed(0).padStart(2, '0')}`;
}
function fmtUSD(n: number): string {
  return `US$ ${Math.floor(n).toLocaleString('es-PE')}.${((n * 100) % 100).toFixed(0).padStart(2, '0')}`;
}

function fmtFechaRel(d: Date | undefined | null): { fecha: string; rel: string } {
  if (!d) return { fecha: '—', rel: '' };
  const ahora = Date.now();
  const diffH = Math.floor((ahora - d.getTime()) / (1000 * 60 * 60));
  let rel = '';
  if (diffH < 1) rel = 'hace minutos';
  else if (diffH < 24) rel = `hace ${diffH}h`;
  else if (diffH < 24 * 7) rel = `hace ${Math.floor(diffH / 24)}d`;
  else rel = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });

  return {
    fecha: d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }),
    rel,
  };
}

export interface KpiRowProps {
  cuenta: CuentaCaja;
  /** Cantidad de movimientos del mes en curso */
  movimientosMes?: number;
  /** Total movido este mes en PEN equivalente */
  totalMovidoPEN?: number;
  /** TC del día (para mostrar equivalente USD↔PEN) */
  tipoCambio?: number;
}

export const KpiRow: React.FC<KpiRowProps> = ({
  cuenta,
  movimientosMes = 0,
  totalMovidoPEN = 0,
  tipoCambio = 3.85,
}) => {
  const esTC = cuenta.tipo === 'credito' && cuenta.productoFinanciero === 'tarjeta_credito';
  const fechaAct = cuenta.fechaActualizacion?.toDate?.() ?? null;
  const fechaActFmt = fmtFechaRel(fechaAct);

  // Variante TC
  if (esTC) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-100">
        <div className="p-4 border-r border-slate-100">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Saldo cargos
          </div>
          <div className="text-xl font-bold text-indigo-700 tabular-nums">
            {fmtPEN(cuenta.saldoActual)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Cargos del negocio
          </div>
        </div>
        <div className="p-4 border-r border-slate-100">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Próximo corte
          </div>
          <div className="text-base font-semibold text-slate-800">
            Día — del mes
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            (configurar en TC legacy)
          </div>
        </div>
        <div className="p-4 border-r border-slate-100">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Próximo pago
          </div>
          <div className="text-base font-semibold text-slate-800">
            Día — del mes
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            (configurar en TC legacy)
          </div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Tope control
          </div>
          <div className="text-base font-semibold text-slate-800 tabular-nums">
            —
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            (configurar en TC legacy)
          </div>
        </div>
      </div>
    );
  }

  // Variante Bi-moneda
  if (cuenta.esBiMoneda) {
    const saldoPEN = cuenta.saldoPEN ?? 0;
    const saldoUSD = cuenta.saldoUSD ?? 0;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-100">
        <div className="p-4 border-r border-slate-100">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Saldo PEN
          </div>
          <div className="text-xl font-bold text-emerald-700 tabular-nums">
            {fmtPEN(saldoPEN)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {cuenta.saldoMinimoPEN ? `Mínimo: ${fmtPEN(cuenta.saldoMinimoPEN)}` : 'Sin mínimo'}
          </div>
        </div>
        <div className="p-4 border-r border-slate-100">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Saldo USD
          </div>
          <div className="text-xl font-bold text-sky-700 tabular-nums">
            {fmtUSD(saldoUSD)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            ≈ {fmtPEN(saldoUSD * tipoCambio)} al TC {tipoCambio}
          </div>
        </div>
        <div className="p-4 border-r border-slate-100">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Última actualización
          </div>
          <div className="text-base font-semibold text-slate-800">{fechaActFmt.fecha}</div>
          <div className="text-xs text-slate-400 mt-0.5">{fechaActFmt.rel}</div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Movimientos mes
          </div>
          <div className="text-xl font-bold text-slate-900 tabular-nums">{movimientosMes}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {totalMovidoPEN > 0 ? `${fmtPEN(totalMovidoPEN)} movidos` : '—'}
          </div>
        </div>
      </div>
    );
  }

  // Variante mono-moneda
  const fmtSaldo = cuenta.moneda === 'PEN' ? fmtPEN : fmtUSD;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-100">
      <div className="p-4 border-r border-slate-100">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Saldo actual
        </div>
        <div className="text-xl font-bold text-emerald-700 tabular-nums">
          {fmtSaldo(cuenta.saldoActual)}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">{cuenta.moneda}</div>
      </div>
      <div className="p-4 border-r border-slate-100">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Saldo mínimo
        </div>
        <div className="text-base font-semibold text-slate-800 tabular-nums">
          {cuenta.saldoMinimo ? fmtSaldo(cuenta.saldoMinimo) : '—'}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          {cuenta.saldoMinimo ? 'Alerta si saldo baja' : 'No configurado'}
        </div>
      </div>
      <div className="p-4 border-r border-slate-100">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Última actualización
        </div>
        <div className="text-base font-semibold text-slate-800">{fechaActFmt.fecha}</div>
        <div className="text-xs text-slate-400 mt-0.5">{fechaActFmt.rel}</div>
      </div>
      <div className="p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Movimientos mes
        </div>
        <div className="text-xl font-bold text-slate-900 tabular-nums">{movimientosMes}</div>
        <div className="text-xs text-slate-400 mt-0.5">
          {totalMovidoPEN > 0 ? `${fmtPEN(totalMovidoPEN)} movidos` : '—'}
        </div>
      </div>
    </div>
  );
};
