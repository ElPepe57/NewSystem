/**
 * KpiStripFinanzas — chk5.D-S2 · SF1
 *
 * Strip único de 5 KPIs financieros del módulo Finanzas (canon v8.0 N1+N2).
 * Reemplaza al viejo `FinanzasKPIBar.tsx` (eliminado en chk5.D-S5 · 2026-05-16).
 *
 * Diseño canon v8.0 + v9.0 M1 copy-paste literal del mockup MOCK 1
 * (docs/mockups/finanzas-shell-overview-v5.1.html · §2 KPI strip).
 *
 * 5 KPIs con tinte semántico:
 *   1. Patrimonio total · teal
 *   2. Por cobrar (CxC) · emerald
 *   3. Por pagar (CxP) · rose
 *   4. Flujo neto mes · indigo
 *   5. DSO / DPO · amber
 *
 * Mini-stats footer integrado (canon N3): Pool USD · TC ciclo cerrado · GK Xpress.
 */

import React from 'react';
import {
  Landmark,
  ArrowDownCircle,
  ArrowUpCircle,
  Activity,
  Clock,
  DollarSign,
  CreditCard,
  Truck,
} from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface KpiStripFinanzasData {
  patrimonioTotalPEN: number;
  patrimonioDeltaMes: number;
  porCobrarPEN: number;
  porCobrarClientesCount: number;
  porPagarPEN: number;
  porPagarVencen7dCount: number;
  flujoNetoMesPEN: number;
  flujoMesAnteriorPEN: number;
  dsoDias: number;
  dpoDias: number;
}

export interface MiniStatsFooterData {
  poolUSD: number;
  poolUSDCuentasCount: number;
  tcpa: number;
  tcCicloCerradoPEN: number;
  recaudadoraPendientePEN: number;
}

export interface KpiStripFinanzasProps {
  data: KpiStripFinanzasData;
  miniStats?: MiniStatsFooterData;
  loading?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

const fmt = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDecimal = (n: number) =>
  n.toFixed(2).split('.')[1];

const splitMoney = (n: number) => {
  const entero = Math.floor(Math.abs(n));
  const decimal = fmtDecimal(n);
  return { entero: fmt(entero), decimal, signo: n < 0 ? '−' : '' };
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const KpiStripFinanzas: React.FC<KpiStripFinanzasProps> = ({
  data,
  miniStats,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-slate-100 rounded-2xl p-4 h-[100px] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const patrimonio = splitMoney(data.patrimonioTotalPEN);
  const porCobrar = splitMoney(data.porCobrarPEN);
  const porPagar = splitMoney(data.porPagarPEN);
  const flujoNeto = splitMoney(data.flujoNetoMesPEN);
  const flujoSigno = data.flujoNetoMesPEN >= 0 ? '+' : '−';
  const flujoColorClass = data.flujoNetoMesPEN >= 0 ? 'text-indigo-900' : 'text-rose-900';
  const dsoDpoGap = data.dpoDias - data.dsoDias;

  return (
    <>
      {/* KPI strip · canon v8.0 N1+N2 · 5 KPIs semánticos */}
      <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* KPI 1 · Patrimonio total · teal */}
        <div className="bg-gradient-to-br from-teal-50 to-teal-100/40 ring-1 ring-teal-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-teal-700 font-bold">
              Patrimonio total
            </span>
            <Landmark className="w-3.5 h-3.5 text-teal-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-teal-900">
            S/ {patrimonio.entero}
            <span className="text-teal-400">.{patrimonio.decimal}</span>
          </div>
          <div className="text-[11px] text-teal-700 flex items-center gap-1 mt-1">
            <span className="tabular-nums">
              {data.patrimonioDeltaMes >= 0 ? '+' : '−'}S/{' '}
              {fmt(Math.abs(data.patrimonioDeltaMes))} mes
            </span>
          </div>
        </div>

        {/* KPI 2 · Por cobrar · emerald */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
              Por cobrar
            </span>
            <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            S/ {porCobrar.entero}
            <span className="text-emerald-400">.{porCobrar.decimal}</span>
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 tabular-nums">
            {data.porCobrarClientesCount} clientes
          </div>
        </div>

        {/* KPI 3 · Por pagar · rose */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">
              Por pagar
            </span>
            <ArrowUpCircle className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">
            S/ {porPagar.entero}
            <span className="text-rose-400">.{porPagar.decimal}</span>
          </div>
          <div className="text-[11px] text-rose-700 mt-1 tabular-nums">
            {data.porPagarVencen7dCount > 0
              ? `${data.porPagarVencen7dCount} vencen 7d`
              : 'sin vencimientos próx'}
          </div>
        </div>

        {/* KPI 4 · Flujo neto mes · indigo */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">
              Flujo neto mes
            </span>
            <Activity className="w-3.5 h-3.5 text-indigo-700" />
          </div>
          <div className={`text-2xl font-bold tabular-nums ${flujoColorClass}`}>
            {flujoSigno}S/ {flujoNeto.entero}
          </div>
          <div className="text-[11px] text-indigo-700 mt-1 tabular-nums">
            vs{' '}
            {data.flujoMesAnteriorPEN >= 0 ? '+' : '−'}S/{' '}
            {fmt(Math.abs(data.flujoMesAnteriorPEN))} prev
          </div>
        </div>

        {/* KPI 5 · DSO / DPO · amber */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">
              DSO / DPO
            </span>
            <Clock className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-xl font-bold tabular-nums text-amber-900">
            {data.dsoDias} / <span className="text-amber-700">{data.dpoDias}</span>
          </div>
          <div className="text-[11px] text-amber-700 mt-1 tabular-nums">
            {dsoDpoGap > 0 ? `Healthy gap +${dsoDpoGap}d` : `Gap ${dsoDpoGap}d`}
          </div>
        </div>
      </div>

      {/* Mini-stats footer integrado · canon N3 */}
      {miniStats && (
        <div className="bg-slate-50/50 border-b border-slate-200 px-6 py-2 flex items-center gap-4 text-[11px] flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
            Hoy:
          </span>
          <span className="text-slate-700 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-teal-600" />
            Pool USD:{' '}
            <span className="font-bold tabular-nums">
              $ {fmt(miniStats.poolUSD)}
            </span>{' '}
            {miniStats.poolUSDCuentasCount > 1 && (
              <span className="text-[9px] text-slate-500">
                ({miniStats.poolUSDCuentasCount} ctas)
              </span>
            )}{' '}
            · TCPA{' '}
            <span className="font-bold tabular-nums">
              {miniStats.tcpa.toFixed(3)}
            </span>
          </span>
          {miniStats.tcCicloCerradoPEN > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-700 flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-amber-600" />
                TC ciclo cerrado ·{' '}
                <span className="font-bold tabular-nums">
                  S/ {fmt(miniStats.tcCicloCerradoPEN)}
                </span>
              </span>
            </>
          )}
          {miniStats.recaudadoraPendientePEN > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-slate-700 flex items-center gap-1">
                <Truck className="w-3 h-3 text-purple-600" />
                Recaudadora pendiente liquidar:{' '}
                <span className="font-bold tabular-nums text-purple-700">
                  S/ {fmt(miniStats.recaudadoraPendientePEN)}
                </span>
              </span>
            </>
          )}
        </div>
      )}
    </>
  );
};
