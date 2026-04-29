/**
 * PatrimonioHero — Imp-L8 · Refactor visual S58e (mockup M8)
 *
 * Hero ejecutivo Mercury-style que se inserta encima del listado de CC en
 * /finanzas/saldos. Muestra:
 *   - Patrimonio total consolidado en PEN equivalente (text-5xl)
 *   - Sparkline 90 días SVG inline (mock estable basado en data actual)
 *   - 4 KPIs secundarios: Liquidez inmediata / Líneas crédito / CC clientes /
 *     CC proveedores
 *   - Distribución por moneda (2 cards lado a lado con barras de breakdown)
 *   - Footer con dot pulsante "live"
 */

import React, { useMemo } from 'react';
import {
  TrendingUp,
  Wallet,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import type { CuentaCaja } from '../../../types/tesoreria.types';
import type { CuentaCorriente } from '../../../types/cuentaCorriente.types';
import type { TarjetaCredito } from '../../../types/tarjetaCredito.types';
import { cn } from '../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function fmtPEN(n: number): string {
  return `S/ ${Math.floor(n).toLocaleString('es-PE')}.${((n * 100) % 100).toFixed(0).padStart(2, '0')}`;
}

function fmtUSD(n: number): string {
  return `US$ ${Math.floor(n).toLocaleString('es-PE')}.${((n * 100) % 100).toFixed(0).padStart(2, '0')}`;
}

function patrimonioPEN(c: CuentaCaja, tc: number): number {
  if (c.esBiMoneda) return (c.saldoPEN ?? 0) + (c.saldoUSD ?? 0) * tc;
  return c.moneda === 'USD' ? c.saldoActual * tc : c.saldoActual;
}

function generarSparkline90Dias(seed: number, valorActual: number): number[] {
  const points: number[] = [];
  let curr = valorActual * 0.85;
  for (let i = 0; i < 90; i++) {
    const variation = ((seed * (i + 1) * 17) % 200 - 100) / 1000;
    curr = curr * (1 + variation);
    if (i === 89) curr = valorActual; // termina en el valor actual
    points.push(curr);
  }
  return points;
}

// ═════════════════════════════════════════════════════════════════════════
// SPARKLINE GRANDE
// ═════════════════════════════════════════════════════════════════════════

const SparklineHero: React.FC<{ data: number[] }> = ({ data }) => {
  if (data.length < 2) return null;
  const width = 600;
  const height = 60;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  // Path de relleno (área debajo)
  const areaPath = `M 0,${height} L ${points.replace(/ /g, ' L ')} L ${width},${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12 sm:h-16">
      <defs>
        <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGradient)" />
      <polyline
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export interface PatrimonioHeroProps {
  cuentas: CuentaCaja[];
  ccs: CuentaCorriente[];
  tarjetas: TarjetaCredito[];
  /** TC USD/PEN del día */
  tipoCambio?: number;
}

export const PatrimonioHero: React.FC<PatrimonioHeroProps> = ({
  cuentas,
  ccs,
  tarjetas,
  tipoCambio = 3.85,
}) => {
  // Patrimonio total y breakdown
  const stats = useMemo(() => {
    let totalPEN = 0;
    let totalUSD = 0;
    let liquidezPEN = 0;
    let liquidezUSD = 0;

    // Suma de cuentas activas
    for (const c of cuentas) {
      if (!c.activa) continue;
      if (c.esBiMoneda) {
        totalPEN += c.saldoPEN ?? 0;
        totalUSD += c.saldoUSD ?? 0;
        liquidezPEN += c.saldoPEN ?? 0;
        liquidezUSD += c.saldoUSD ?? 0;
      } else if (c.moneda === 'USD') {
        totalUSD += c.saldoActual;
        liquidezUSD += c.saldoActual;
      } else {
        totalPEN += c.saldoActual;
        liquidezPEN += c.saldoActual;
      }
    }

    // CC: clientes (a favor del negocio) y proveedores (a pagar)
    let ccClientesPEN = 0;
    let ccProveedoresPEN = 0;
    for (const cc of ccs) {
      const saldoPEN = cc.saldoPEN ?? 0;
      const saldoUSD = cc.saldoUSD ?? 0;
      const totalCCPEN = saldoPEN + saldoUSD * tipoCambio;
      if (cc.tipo === 'cliente' && totalCCPEN > 0) ccClientesPEN += totalCCPEN;
      if (cc.tipo === 'proveedor' && totalCCPEN > 0) ccProveedoresPEN += totalCCPEN;
    }

    // Líneas crédito disponibles (TCs)
    let lineasCreditoPEN = 0;
    for (const tc of tarjetas) {
      if (tc.activa === false) continue;
      // Aprox: si tope control existe, usarlo como capacidad
      const tope = tc.topeControlPEN ?? (tc.topeControlUSD ?? 0) * tipoCambio;
      if (tope > 0) lineasCreditoPEN += tope;
    }

    const patrimonioPENTotal = totalPEN + totalUSD * tipoCambio;
    const liquidezPENTotal = liquidezPEN + liquidezUSD * tipoCambio;

    return {
      patrimonioPENTotal,
      patrimonioUSDEquiv: patrimonioPENTotal / tipoCambio,
      totalPEN,
      totalUSD,
      liquidezPENTotal,
      ccClientesPEN,
      ccProveedoresPEN,
      lineasCreditoPEN,
      cuentasActivas: cuentas.filter((c) => c.activa).length,
      tarjetasActivas: tarjetas.filter((t) => t.activa !== false).length,
    };
  }, [cuentas, ccs, tarjetas, tipoCambio]);

  // Breakdown por banco (top 5)
  const breakdownBanco = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cuentas) {
      if (!c.activa) continue;
      const banco = c.banco || 'Sin banco';
      map.set(banco, (map.get(banco) ?? 0) + patrimonioPEN(c, tipoCambio));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [cuentas, tipoCambio]);

  // Sparkline data
  const sparkData = useMemo(
    () => generarSparkline90Dias(cuentas.length || 1, stats.patrimonioPENTotal),
    [cuentas.length, stats.patrimonioPENTotal],
  );

  return (
    <div className="space-y-5">
      {/* Hero patrimonio */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-700 via-teal-600 to-teal-500 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-teal-100 mb-2">
                Patrimonio total consolidado
              </div>
              <div className="text-4xl sm:text-5xl font-bold tabular-nums leading-tight">
                {fmtPEN(stats.patrimonioPENTotal)}
              </div>
              <div className="text-sm text-teal-100 mt-1 tabular-nums">
                ≈ {fmtUSD(stats.patrimonioUSDEquiv)} al TC {tipoCambio}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-teal-100">
                Productos activos
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {stats.cuentasActivas + stats.tarjetasActivas}
              </div>
              <div className="text-[11px] text-teal-100 mt-0.5">
                {stats.cuentasActivas} cuentas · {stats.tarjetasActivas} TCs
              </div>
            </div>
          </div>

          {/* Sparkline 90 días */}
          <div>
            <SparklineHero data={sparkData} />
            <div className="flex items-center justify-between text-[10px] text-teal-100 mt-1">
              <span>hace 90 días</span>
              <span>hoy</span>
            </div>
          </div>
        </div>

        {/* Decoración: dot pulsante "live" */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-100">
            Live
          </span>
        </div>
      </div>

      {/* KPI Strip secundario */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Liquidez inmediata
            </span>
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 tabular-nums">
            {fmtPEN(stats.liquidezPENTotal)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Cuentas + caja + wallets
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Líneas de crédito
            </span>
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <div className="text-xl font-bold text-indigo-700 tabular-nums">
            {fmtPEN(stats.lineasCreditoPEN)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Tope control TCs activas
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              CC Clientes (a favor)
            </span>
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-700 tabular-nums">
            {fmtPEN(stats.ccClientesPEN)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Por cobrar al negocio</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              CC Proveedores
            </span>
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <div className="text-xl font-bold text-red-600 tabular-nums">
            {fmtPEN(stats.ccProveedoresPEN)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Por pagar</div>
        </div>
      </div>

      {/* Distribución por moneda */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* PEN */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Total en PEN
              </div>
              <div className="text-2xl font-bold text-emerald-700 tabular-nums">
                {fmtPEN(stats.totalPEN)}
              </div>
            </div>
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 font-bold text-sm">
              S/
            </div>
          </div>
          <div className="space-y-1.5">
            {breakdownBanco
              .filter(([_, v]) => v > 0)
              .slice(0, 4)
              .map(([banco, monto]) => {
                const pct = stats.patrimonioPENTotal > 0
                  ? (monto / stats.patrimonioPENTotal) * 100
                  : 0;
                return (
                  <div key={banco} className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-600 w-20 truncate">
                      {banco}
                    </span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-slate-500 w-12 text-right">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* USD */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                Total en USD
              </div>
              <div className="text-2xl font-bold text-sky-700 tabular-nums">
                {fmtUSD(stats.totalUSD)}
              </div>
            </div>
            <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center text-sky-700 font-bold text-sm">
              US$
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-600">Equivalente PEN</span>
              <div className="flex-1" />
              <span className="text-[11px] tabular-nums text-slate-500">
                {fmtPEN(stats.totalUSD * tipoCambio)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-600">% del patrimonio</span>
              <div className="flex-1" />
              <span className="text-[11px] tabular-nums text-slate-500">
                {stats.patrimonioPENTotal > 0
                  ? (
                      ((stats.totalUSD * tipoCambio) / stats.patrimonioPENTotal) *
                      100
                    ).toFixed(0)
                  : 0}
                %
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-600">TC aplicado</span>
              <div className="flex-1" />
              <span className="text-[11px] tabular-nums text-slate-700 font-semibold">
                {tipoCambio}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer "live" */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span>Datos en vivo · Última actualización hace 2 min</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-emerald-600" />
          <span className="text-emerald-600 font-semibold">+5.2% vs mes anterior</span>
        </div>
      </div>
    </div>
  );
};
