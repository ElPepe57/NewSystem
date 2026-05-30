/**
 * KpiStripGastos · KPI strip canon HUB · Gastos rework v5.2 (2026-05-30)
 *
 * PIXEL-PERFECT contra docs/mockups/gastos-v5.2-integral.html · ACTO 1 · §C + §D.
 * Reescrito 2026-05-30 (canon v9.0 M1·M2): los 5 KPIs son mini-cards SEPARADOS
 * con gap-3 + ring-1 ring-{color}-200/50 + rounded-2xl + gradient fuerte
 * (from-{c}-50 to-{c}-100/40). Antes (v4) estaban fusionados con divide-x · NO
 * coincidía con el mockup canon del hub.
 *
 * 2 zonas hermanas (sin card wrapper propio · viven dentro del shell de Gastos.tsx):
 *   §C · KPI strip · px-6 py-4 · 5 mini-cards con tinte semántico (canon v8.0 N1·N2)
 *   §D · mini-stats footer · border-t · briefcase/alert-circle/clock (canon v8.0 N3)
 *
 * Tintes semánticos canon:
 *   1. Gasto del mes        · amber  (dinero · warmth)
 *   2. Burn Rate 3m         · rose   (consumo · fuego)
 *   3. % Recurrentes        · indigo (commitment · fijo)
 *   4. Vencen 30d           · rose   (urgencia)
 *   5. DPO · Días Pago      · emerald (cash management positivo)
 */

import React from 'react';
import {
  TrendingUp, TrendingDown, Minus,
  Receipt, Flame, Repeat, Clock, CalendarCheck,
  Briefcase, AlertCircle,
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

// Formato canon F7 · tabular · sin prefijo "S/" en el valor grande (como el mockup)
const fmtMiles = (n: number): string => Math.round(n).toLocaleString('es-PE');
const fmtPct = (n: number, decimals = 1): string =>
  `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;

export const KpiStripGastos: React.FC<KpiStripGastosProps> = ({ kpis, miniStats }) => {
  // ── Helpers de delta (color por dirección · semántica de negocio) ─────────
  const variacionUp = kpis.variacionPct > 0;
  const variacionDown = kpis.variacionPct < 0;
  const VariacionIcon = variacionUp ? TrendingUp : variacionDown ? TrendingDown : Minus;

  const dpoMejora = kpis.dpoDeltaTrimestre < 0;
  const DpoIcon = dpoMejora ? TrendingDown : TrendingUp;

  // Gasto del mes con decimales atenuados · "12,480" + ".50" (es-PE)
  const gastoFixed = kpis.gastoMesPEN.toLocaleString('es-PE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const [gastoEntero, gastoDecimales = '00'] = gastoFixed.split('.');

  return (
    <>
      {/* §C · KPI STRIP · canon v8.0 N1·N2 · 5 mini-cards separados (gap-3 + ring + rounded-2xl) */}
      <div className="px-4 sm:px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-3">

        {/* KPI 1 · Gasto del mes · AMBER */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">Gasto del mes</span>
            <Receipt className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900">
            {gastoEntero}<span className="text-amber-400">.{gastoDecimales}</span>
          </div>
          <div className={`text-[11px] flex items-center gap-1 mt-1 tabular-nums ${
            variacionUp ? 'text-rose-600' : variacionDown ? 'text-emerald-600' : 'text-amber-700'
          }`}>
            <VariacionIcon className="w-3 h-3 flex-shrink-0" />
            {variacionUp ? '+' : ''}{kpis.variacionPct.toFixed(1)}% vs mes ant.
          </div>
        </div>

        {/* KPI 2 · Burn rate · 3M · ROSE */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">Burn rate · 3M</span>
            <Flame className="w-3.5 h-3.5 text-rose-700 flex-shrink-0" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">{fmtMiles(kpis.burnRate3m)}</div>
          <div className="text-[11px] text-rose-700 mt-1">promedio móvil</div>
        </div>

        {/* KPI 3 · Recurrentes · INDIGO */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">Recurrentes</span>
            <Repeat className="w-3.5 h-3.5 text-indigo-700 flex-shrink-0" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-indigo-900">
            {kpis.porcentajeRecurrentes.toFixed(0)}<span className="text-indigo-400">%</span>
          </div>
          <div className="text-[11px] text-indigo-700 mt-1">fijos comprometidos</div>
        </div>

        {/* KPI 4 · Vencen 30d · ROSE */}
        <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">Vencen 30d</span>
            <Clock className="w-3.5 h-3.5 text-rose-700 flex-shrink-0" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-rose-900">{fmtMiles(kpis.vencimientos30dPEN)}</div>
          <div className="text-[11px] text-rose-700 mt-1 tabular-nums">
            {kpis.vencimientos30dCount} gastos
            {kpis.vencimientosCriticos > 0 && (
              <> · <span className="font-bold">{kpis.vencimientosCriticos} críticos</span></>
            )}
          </div>
        </div>

        {/* KPI 5 · DPO · días pago · EMERALD */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">DPO · días pago</span>
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
          </div>
          <div className="text-2xl font-bold tabular-nums text-emerald-900">
            {kpis.dpoDias}<span className="text-emerald-400">d</span>
          </div>
          <div className={`text-[11px] flex items-center gap-1 mt-1 tabular-nums ${
            dpoMejora ? 'text-emerald-700' : 'text-amber-700'
          }`}>
            <DpoIcon className="w-3 h-3 flex-shrink-0" />
            {fmtPct(kpis.dpoDeltaTrimestre, 0)}d vs trim.
          </div>
        </div>
      </div>

      {/* §D · MINI-STATS · footer integrado · border-t (canon v8.0 N3) */}
      <div className="bg-slate-50/50 border-t border-slate-200 px-4 sm:px-6 py-2 flex items-center gap-4 text-[11px] flex-wrap">
        {/* Top proveedor · sin label (canon · alineado con Finanzas · solo chips) */}
        {miniStats.topProveedor ? (
          <span className="flex items-center gap-1 text-slate-600">
            <Briefcase className="w-3 h-3 text-slate-400 flex-shrink-0" /> Top proveedor:{' '}
            <strong className="text-slate-900 tabular-nums">
              {miniStats.topProveedor.nombre} · {miniStats.topProveedor.pctDelMes.toFixed(0)}%
            </strong>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-slate-400">
            <Briefcase className="w-3 h-3 flex-shrink-0" /> Top proveedor: <span className="italic">sin data</span>
          </span>
        )}

        {/* Sin clasificar */}
        <span className="flex items-center gap-1 text-slate-600">
          <AlertCircle className={`w-3 h-3 flex-shrink-0 ${miniStats.sinClasificarCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} /> Sin clasificar:{' '}
          <strong className={`tabular-nums ${miniStats.sinClasificarCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {miniStats.sinClasificarCount}
          </strong>
        </span>

        {/* Próximo vencimiento */}
        {miniStats.proximoVencimiento ? (
          <span className="flex items-center gap-1 text-slate-600">
            <Clock className="w-3 h-3 text-rose-500 flex-shrink-0" /> Próximo vto:{' '}
            <strong className="text-slate-900 tabular-nums">
              {miniStats.proximoVencimiento.descripcion} · en {miniStats.proximoVencimiento.diasParaVencer}d
            </strong>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-slate-400">
            <Clock className="w-3 h-3 flex-shrink-0" /> Próximo vto: <span className="italic">sin data</span>
          </span>
        )}
      </div>
    </>
  );
};
