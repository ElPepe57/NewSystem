/**
 * KpiStripGastos · KPI strip canon v8.0 · color semántico + mini-stats integrados
 *
 * chk5.C-UX-PASS (2026-05-11) · refactor con canon v8.0 (CLAUDE.md):
 *   - N1 · color semántico por KPI · NO slate uniforme
 *   - N2 · cards con gradient sutil + ring colored
 *   - N3 · mini-stats INTEGRADOS como footer del MISMO card
 *   - N7 · responsive desde md: (768px) no lg:
 *
 * 5 KPIs primarios con tinte semántico canon:
 *   1. Gasto del mes        · amber (dinero · warmth)
 *   2. Burn Rate 3m         · rose (consumo · fuego)
 *   3. % Recurrentes        · indigo (commitment · fijo)
 *   4. Vencimientos 30d     · rose-strong (urgencia)
 *   5. DPO · Días Pago      · emerald (cash management positivo)
 *
 * Mockup referencia: `gastos-rework-v4-responsive-color.html · Sección 3`.
 */

import React from 'react';
import {
  TrendingUp, TrendingDown, Minus,
  Receipt, Flame, Repeat, Clock, CalendarCheck,
  UserCheck, AlertCircle, Bell,
} from 'lucide-react';

export interface KpiGastosData {
  /** Total gasto del mes en PEN */
  gastoMesPEN: number;
  /** Variación % vs mes anterior */
  variacionPct: number;
  /** Promedio móvil 3 meses · S/ */
  burnRate3m: number;
  /** % de gastos del mes que son recurrentes */
  porcentajeRecurrentes: number;
  /** Total a pagar en próximos 30 días · S/ */
  vencimientos30dPEN: number;
  /** Count de gastos en vencimiento 30d */
  vencimientos30dCount: number;
  /** Count de gastos CRÍTICOS (vencidos hoy o vencen <3d) */
  vencimientosCriticos: number;
  /** DPO · días promedio de pago */
  dpoDias: number;
  /** Trend DPO vs trimestre · positivo = empeora · negativo = mejora */
  dpoDeltaTrimestre: number;
}

export interface MiniStatsData {
  /** Top proveedor del mes · {nombre, pctDelMes} */
  topProveedor: { nombre: string; pctDelMes: number } | null;
  /** Count de gastos sin clasificar */
  sinClasificarCount: number;
  /** Próximo vencimiento (si existe) · {descripcion, diasParaVencer} */
  proximoVencimiento: { descripcion: string; diasParaVencer: number } | null;
}

interface KpiStripGastosProps {
  kpis: KpiGastosData;
  miniStats: MiniStatsData;
}

const fmtPEN = (n: number): string =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPEN0 = (n: number): string =>
  `S/ ${Math.round(n).toLocaleString('es-PE')}`;
const fmtPct = (n: number, decimals = 1): string =>
  `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;

export const KpiStripGastos: React.FC<KpiStripGastosProps> = ({ kpis, miniStats }) => {
  // ── Helpers de delta (color por dirección) ───────────────────────────────
  const variacionUp = kpis.variacionPct > 0;
  const variacionDown = kpis.variacionPct < 0;
  const VariacionIcon = variacionUp ? TrendingUp : variacionDown ? TrendingDown : Minus;

  const dpoMejora = kpis.dpoDeltaTrimestre < 0;
  const DpoIcon = dpoMejora ? TrendingDown : TrendingUp;

  // Formato del Gasto del mes con decimales atenuados (canon F7 · tabular-nums)
  const formatCenta = (n: number): { entero: string; decimales: string } => {
    const parts = fmtPEN(n).split('.');
    return { entero: parts[0], decimales: parts[1] || '00' };
  };
  const gastoCentavos = formatCenta(kpis.gastoMesPEN);

  return (
    /* chk5.C-UX-PASS · canon v8.0 N3 · UN solo card con strip + footer mini-stats */
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-4">

      {/* chk5.C-UX-PASS · canon v8.0 N7 · md:grid-cols-5 (antes lg:)
          canon v8.0 N1 · cada KPI con tinte semántico (no slate uniforme) */}
      <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-200">

        {/* KPI 1 · Gasto del mes · AMBER (dinero/warmth) */}
        <div className="p-3 md:p-4 bg-gradient-to-br from-amber-50/40 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">
              Gasto del mes
            </span>
            <Receipt className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
          </div>
          <div className="text-xl md:text-2xl font-bold tabular-nums text-amber-900">
            {gastoCentavos.entero}
            <span className="text-amber-400">.{gastoCentavos.decimales}</span>
          </div>
          <div className={`text-[11px] mt-1 tabular-nums flex items-center gap-1 ${
            variacionUp ? 'text-rose-600' : variacionDown ? 'text-emerald-600' : 'text-amber-700'
          }`}>
            <VariacionIcon className="w-3 h-3 flex-shrink-0" />
            {variacionUp ? `+${kpis.variacionPct.toFixed(1)}` : kpis.variacionPct.toFixed(1)}% vs mes ant.
          </div>
        </div>

        {/* KPI 2 · Burn Rate 3m · ROSE (consumo/fuego) */}
        <div className="p-3 md:p-4 bg-gradient-to-br from-rose-50/40 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">
              Burn Rate · 3m
            </span>
            <Flame className="w-3.5 h-3.5 text-rose-700 flex-shrink-0" />
          </div>
          <div className="text-xl md:text-2xl font-bold tabular-nums text-rose-900">
            {fmtPEN0(kpis.burnRate3m)}
          </div>
          <div className="text-[11px] text-rose-700 mt-1">
            promedio móvil
          </div>
        </div>

        {/* KPI 3 · % Recurrentes · INDIGO (commitment/fijo) */}
        <div className="p-3 md:p-4 bg-gradient-to-br from-indigo-50/40 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">
              Recurrentes
            </span>
            <Repeat className="w-3.5 h-3.5 text-indigo-700 flex-shrink-0" />
          </div>
          <div className="text-xl md:text-2xl font-bold tabular-nums text-indigo-900">
            {kpis.porcentajeRecurrentes.toFixed(0)}<span className="text-indigo-400">%</span>
          </div>
          <div className="text-[11px] text-indigo-700 mt-1">
            fijos comprometidos
          </div>
        </div>

        {/* KPI 4 · Vencimientos 30d · ROSE STRONG (alerta accionable) */}
        <div className="p-3 md:p-4 bg-gradient-to-br from-rose-100/40 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-800 font-bold">
              Vencen 30d
            </span>
            <Clock className="w-3.5 h-3.5 text-rose-800 flex-shrink-0" />
          </div>
          <div className="text-xl md:text-2xl font-bold tabular-nums text-rose-900">
            {fmtPEN0(kpis.vencimientos30dPEN)}
          </div>
          <div className="text-[11px] text-rose-800 mt-1 tabular-nums">
            {kpis.vencimientos30dCount} gastos
            {kpis.vencimientosCriticos > 0 && (
              <> · <span className="font-bold">{kpis.vencimientosCriticos} críticos</span></>
            )}
          </div>
        </div>

        {/* KPI 5 · DPO · EMERALD (cash management positivo) */}
        <div className="p-3 md:p-4 bg-gradient-to-br from-emerald-50/40 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
              DPO · Días Pago
            </span>
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
          </div>
          <div className="text-xl md:text-2xl font-bold tabular-nums text-emerald-900">
            {kpis.dpoDias}<span className="text-emerald-400">d</span>
          </div>
          <div className={`text-[11px] mt-1 tabular-nums flex items-center gap-1 ${
            dpoMejora ? 'text-emerald-700' : 'text-amber-700'
          }`}>
            <DpoIcon className="w-3 h-3 flex-shrink-0" />
            {fmtPct(kpis.dpoDeltaTrimestre, 0)}d vs trimestre
          </div>
        </div>
      </div>

      {/* chk5.C-UX-PASS · canon v8.0 N3 · mini-stats footer integrado al MISMO card */}
      <div className="bg-slate-50/50 border-t border-slate-200 px-4 py-2 flex items-center gap-4 text-[11px] flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
          Mini-stats:
        </span>

        {/* Top proveedor */}
        {miniStats.topProveedor ? (
          <span className="flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-slate-500 flex-shrink-0" />
            <span className="text-slate-600">Top proveedor:</span>
            <span className="font-bold tabular-nums text-slate-900">
              {miniStats.topProveedor.nombre} <span className="text-slate-500 font-normal">·</span> {miniStats.topProveedor.pctDelMes.toFixed(0)}%
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-slate-400">
            <UserCheck className="w-3 h-3 flex-shrink-0" />
            <span>Top proveedor:</span>
            <span className="italic">sin data</span>
          </span>
        )}

        <span className="text-slate-300">·</span>

        {/* Sin clasificar */}
        <span className="flex items-center gap-1">
          <AlertCircle className={`w-3 h-3 flex-shrink-0 ${miniStats.sinClasificarCount > 0 ? 'text-rose-600' : 'text-slate-500'}`} />
          <span className="text-slate-600">Sin clasificar:</span>
          <span className={`font-bold tabular-nums ${miniStats.sinClasificarCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {miniStats.sinClasificarCount}
            {miniStats.sinClasificarCount > 0 && <span className="font-normal text-rose-500"> · revisar</span>}
          </span>
        </span>

        <span className="text-slate-300">·</span>

        {/* Próximo vencimiento */}
        {miniStats.proximoVencimiento ? (
          <span className="flex items-center gap-1">
            <Bell className="w-3 h-3 text-amber-600 flex-shrink-0" />
            <span className="text-slate-600">Próximo vto:</span>
            <span className="font-bold tabular-nums text-amber-700">
              {miniStats.proximoVencimiento.descripcion} <span className="text-slate-500 font-normal">·</span> en {miniStats.proximoVencimiento.diasParaVencer}d
            </span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-slate-400">
            <Bell className="w-3 h-3 flex-shrink-0" />
            <span>Próximo vto:</span>
            <span className="italic">sin data</span>
          </span>
        )}
      </div>
    </div>
  );
};
