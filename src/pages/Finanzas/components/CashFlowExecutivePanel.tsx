/**
 * CashFlowExecutivePanel — Imp-L9 · Refactor visual S58e (mockup M9)
 *
 * Tablero ejecutivo de Cash Flow que se inserta en /finanzas/cash-flow
 * encima del componente Tesorería. Muestra:
 *   - Selector rango temporal (7d / 30d / 90d / YTD)
 *   - 4 KPIs: Ingresos / Egresos / Neto / Runway (con regla color)
 *   - Area chart SVG 860×240 con 3 series (ingresos / egresos / saldo neto)
 *   - 2 donuts breakdown (ingresos por origen / egresos por destino)
 *   - Top 5 contrapartes (entradas + salidas) en cards-row
 *
 * Datos calculados desde useTesoreriaStore.movimientos (libro mayor
 * unificado tras F4).
 */

import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Zap,
} from 'lucide-react';
import { useTesoreriaStore } from '../../../store/tesoreriaStore';
import type { MovimientoTesoreria } from '../../../types/tesoreria.types';
import { cn } from '../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

type RangoTemporal = '7d' | '30d' | '90d' | 'ytd';

const RANGOS: Array<{ value: RangoTemporal; label: string }> = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: 'ytd', label: 'YTD' },
];

function diasDelRango(r: RangoTemporal): number {
  if (r === '7d') return 7;
  if (r === '30d') return 30;
  if (r === '90d') return 90;
  // YTD
  const ahora = new Date();
  const inicio = new Date(ahora.getFullYear(), 0, 1);
  return Math.floor((ahora.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtPEN(n: number): string {
  return `S/ ${Math.floor(n).toLocaleString('es-PE')}.${((n * 100) % 100).toFixed(0).padStart(2, '0')}`;
}

const ES_INGRESO = (m: MovimientoTesoreria): boolean => {
  return ['ingreso_venta', 'ingreso_anticipo', 'ingreso_otro', 'aporte_capital'].includes(m.tipo);
};

const ES_EGRESO = (m: MovimientoTesoreria): boolean => {
  return [
    'pago_orden_compra',
    'pago_viajero',
    'pago_proveedor_local',
    'gasto_operativo',
    'retiro_socio',
    'pago_nomina',
    'adelanto_empleado',
  ].includes(m.tipo);
};

// ═════════════════════════════════════════════════════════════════════════
// AREA CHART (SVG inline 3 series)
// ═════════════════════════════════════════════════════════════════════════

const AreaChart: React.FC<{
  ingresosPorDia: number[];
  egresosPorDia: number[];
  netoAcumulado: number[];
}> = ({ ingresosPorDia, egresosPorDia, netoAcumulado }) => {
  const width = 860;
  const height = 220;
  const paddingX = 40;
  const paddingY = 20;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  if (ingresosPorDia.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl p-12 text-center text-sm text-slate-400">
        Sin datos en el rango seleccionado
      </div>
    );
  }

  const maxIngreso = Math.max(...ingresosPorDia, 1);
  const maxEgreso = Math.max(...egresosPorDia, 1);
  const maxNeto = Math.max(...netoAcumulado.map(Math.abs), 1);
  const yMax = Math.max(maxIngreso, maxEgreso) * 1.1;

  // Scale
  const xScale = (i: number) => paddingX + (i / (ingresosPorDia.length - 1 || 1)) * chartW;
  const yScale = (v: number) => paddingY + chartH - (v / yMax) * chartH;
  const yScaleNeto = (v: number) => paddingY + chartH / 2 - (v / maxNeto) * (chartH / 2);

  // Paths
  const pathIngresos = ingresosPorDia
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`)
    .join(' ');
  const areaIngresos = `${pathIngresos} L ${xScale(ingresosPorDia.length - 1).toFixed(1)} ${(paddingY + chartH).toFixed(1)} L ${paddingX.toFixed(1)} ${(paddingY + chartH).toFixed(1)} Z`;

  const pathEgresos = egresosPorDia
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`)
    .join(' ');
  const areaEgresos = `${pathEgresos} L ${xScale(egresosPorDia.length - 1).toFixed(1)} ${(paddingY + chartH).toFixed(1)} L ${paddingX.toFixed(1)} ${(paddingY + chartH).toFixed(1)} Z`;

  const pathNeto = netoAcumulado
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScaleNeto(v).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="areaIngresoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="areaEgresoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid horizontal */}
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <line
          key={p}
          x1={paddingX}
          x2={paddingX + chartW}
          y1={paddingY + chartH * (1 - p)}
          y2={paddingY + chartH * (1 - p)}
          stroke="#f1f5f9"
          strokeWidth="1"
        />
      ))}

      {/* Eje Y · línea cero */}
      <line
        x1={paddingX}
        x2={paddingX + chartW}
        y1={paddingY + chartH}
        y2={paddingY + chartH}
        stroke="#cbd5e1"
        strokeWidth="1"
      />

      {/* Area ingresos (verde) */}
      <path d={areaIngresos} fill="url(#areaIngresoGrad)" />
      <path d={pathIngresos} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />

      {/* Area egresos (rojo) */}
      <path d={areaEgresos} fill="url(#areaEgresoGrad)" />
      <path d={pathEgresos} fill="none" stroke="#dc2626" strokeWidth="2" strokeLinejoin="round" />

      {/* Línea saldo neto (teal) */}
      <path d={pathNeto} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="0" />
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// DONUT (SVG inline)
// ═════════════════════════════════════════════════════════════════════════

const Donut: React.FC<{
  data: Array<{ label: string; monto: number; color: string }>;
  total: number;
}> = ({ data, total }) => {
  const radius = 35;
  const strokeWidth = 12;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const segments = data.filter((d) => d.monto > 0);

  return (
    <svg viewBox="0 0 100 100" className="w-full max-w-[160px] -rotate-90">
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
      {segments.map((s) => {
        const portion = total > 0 ? s.monto / total : 0;
        const dasharray = `${portion * circumference} ${circumference}`;
        const dashoffset = -cumulative;
        cumulative += portion * circumference;
        return (
          <circle
            key={s.label}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
          />
        );
      })}
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export const CashFlowExecutivePanel: React.FC = () => {
  const movimientos = useTesoreriaStore((s) => s.movimientos);
  const cuentas = useTesoreriaStore((s) => s.cuentas);
  const [rango, setRango] = useState<RangoTemporal>('30d');

  const tipoCambio = 3.85;

  // Filtrar movimientos del rango
  const movsRango = useMemo(() => {
    const dias = diasDelRango(rango);
    const cutoff = Date.now() - dias * 24 * 60 * 60 * 1000;
    return movimientos.filter((m) => {
      if (m.estado === 'anulado') return false;
      const t = m.fecha?.toDate?.()?.getTime() ?? 0;
      return t >= cutoff;
    });
  }, [movimientos, rango]);

  // Series por día
  const series = useMemo(() => {
    const dias = diasDelRango(rango);
    const ingresosPorDia = new Array(dias).fill(0);
    const egresosPorDia = new Array(dias).fill(0);
    const ahora = new Date();

    for (const m of movsRango) {
      const fecha = m.fecha?.toDate?.();
      if (!fecha) continue;
      const diasAtras = Math.floor((ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
      const idx = dias - 1 - diasAtras;
      if (idx < 0 || idx >= dias) continue;
      const montoPEN = m.montoEquivalentePEN ?? (m.moneda === 'PEN' ? m.monto : m.monto * tipoCambio);
      if (ES_INGRESO(m)) ingresosPorDia[idx] += montoPEN;
      else if (ES_EGRESO(m)) egresosPorDia[idx] += montoPEN;
    }

    // Saldo neto acumulado
    const netoAcumulado: number[] = [];
    let acc = 0;
    for (let i = 0; i < dias; i++) {
      acc += ingresosPorDia[i] - egresosPorDia[i];
      netoAcumulado.push(acc);
    }

    return { ingresosPorDia, egresosPorDia, netoAcumulado };
  }, [movsRango, rango]);

  // KPIs
  const kpis = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;
    for (const m of movsRango) {
      const montoPEN = m.montoEquivalentePEN ?? (m.moneda === 'PEN' ? m.monto : m.monto * tipoCambio);
      if (ES_INGRESO(m)) ingresos += montoPEN;
      else if (ES_EGRESO(m)) egresos += montoPEN;
    }
    const neto = ingresos - egresos;

    // Caja actual (suma de cuentas activas, equivalente PEN)
    let cajaActualPEN = 0;
    for (const c of cuentas) {
      if (!c.activa) continue;
      if (c.esBiMoneda) cajaActualPEN += (c.saldoPEN ?? 0) + (c.saldoUSD ?? 0) * tipoCambio;
      else if (c.moneda === 'USD') cajaActualPEN += c.saldoActual * tipoCambio;
      else cajaActualPEN += c.saldoActual;
    }

    // Runway: días que dura la caja al ritmo de quema actual
    const dias = diasDelRango(rango);
    const quemaDiaria = dias > 0 ? egresos / dias : 0;
    const runwayDias = quemaDiaria > 0 ? Math.floor(cajaActualPEN / quemaDiaria) : 999;

    return { ingresos, egresos, neto, cajaActualPEN, runwayDias };
  }, [movsRango, cuentas, rango]);

  // Breakdown por categoría (donut)
  const breakdownIngresos = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movsRango) {
      if (!ES_INGRESO(m)) continue;
      const montoPEN = m.montoEquivalentePEN ?? (m.moneda === 'PEN' ? m.monto : m.monto * tipoCambio);
      map.set(m.tipo, (map.get(m.tipo) ?? 0) + montoPEN);
    }
    const colores: Record<string, string> = {
      ingreso_venta: '#10b981',
      ingreso_anticipo: '#06b6d4',
      ingreso_otro: '#a855f7',
      aporte_capital: '#facc15',
    };
    const labels: Record<string, string> = {
      ingreso_venta: 'Ventas',
      ingreso_anticipo: 'Anticipos',
      ingreso_otro: 'Otros',
      aporte_capital: 'Aportes capital',
    };
    return Array.from(map.entries()).map(([k, v]) => ({
      label: labels[k] ?? k,
      monto: v,
      color: colores[k] ?? '#94a3b8',
    }));
  }, [movsRango]);

  const breakdownEgresos = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movsRango) {
      if (!ES_EGRESO(m)) continue;
      const montoPEN = m.montoEquivalentePEN ?? (m.moneda === 'PEN' ? m.monto : m.monto * tipoCambio);
      map.set(m.tipo, (map.get(m.tipo) ?? 0) + montoPEN);
    }
    const colores: Record<string, string> = {
      pago_orden_compra: '#dc2626',
      pago_viajero: '#f97316',
      pago_proveedor_local: '#ea580c',
      gasto_operativo: '#a855f7',
      retiro_socio: '#64748b',
      pago_nomina: '#0ea5e9',
      adelanto_empleado: '#7c3aed',
    };
    const labels: Record<string, string> = {
      pago_orden_compra: 'OCs',
      pago_viajero: 'Viajeros',
      pago_proveedor_local: 'Proveedores',
      gasto_operativo: 'Gastos',
      retiro_socio: 'Retiros',
      pago_nomina: 'Planilla',
      adelanto_empleado: 'Adelantos',
    };
    return Array.from(map.entries()).map(([k, v]) => ({
      label: labels[k] ?? k,
      monto: v,
      color: colores[k] ?? '#94a3b8',
    }));
  }, [movsRango]);

  const netoPositivo = kpis.neto >= 0;

  // Regla de color para runway
  const runwayColor =
    kpis.runwayDias > 90
      ? { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600' }
      : kpis.runwayDias > 30
        ? { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-600' }
        : { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-600' };

  return (
    <div className="space-y-5 mb-6">
      {/* Header con selector de rango */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-600" />
            Cash Flow · Ejecutivo
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tendencia, breakdown y proyecciones de flujo de caja
          </p>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          {RANGOS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRango(r.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                rango === r.value
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPIs grandes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Ingresos
            </span>
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-700 tabular-nums">
            {fmtPEN(kpis.ingresos)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Del periodo</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Egresos
            </span>
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <div className="text-xl font-bold text-red-600 tabular-nums">
            {fmtPEN(kpis.egresos)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Del periodo</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Flujo neto
            </span>
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                netoPositivo ? 'bg-emerald-50' : 'bg-red-50',
              )}
            >
              <TrendingUp
                className={cn(
                  'w-4 h-4',
                  netoPositivo ? 'text-emerald-600' : 'text-red-600 rotate-180',
                )}
              />
            </div>
          </div>
          <div
            className={cn(
              'text-xl font-bold tabular-nums',
              netoPositivo ? 'text-emerald-700' : 'text-red-600',
            )}
          >
            {netoPositivo ? '+' : '−'}
            {fmtPEN(Math.abs(kpis.neto))}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {netoPositivo ? 'Saldo positivo' : 'Saldo negativo'}
          </div>
        </div>
        <div className={cn('border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all', runwayColor.bg)}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Runway
            </span>
            <div className="w-8 h-8 bg-white/70 rounded-lg flex items-center justify-center">
              <Calendar className={cn('w-4 h-4', runwayColor.icon)} />
            </div>
          </div>
          <div className={cn('text-xl font-bold tabular-nums', runwayColor.text)}>
            {kpis.runwayDias > 365 ? '> 1 año' : `${kpis.runwayDias} días`}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Caja {fmtPEN(kpis.cajaActualPEN)}
          </div>
        </div>
      </div>

      {/* Area chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Tendencia del periodo</h3>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              Ingresos
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
              Egresos
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-teal-600" />
              Neto acumulado
            </span>
          </div>
        </div>
        <AreaChart {...series} />
      </div>

      {/* 2 donuts breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">
            Ingresos por origen
          </h3>
          <div className="flex items-center gap-4">
            <Donut data={breakdownIngresos} total={kpis.ingresos} />
            <div className="flex-1 space-y-1.5">
              {breakdownIngresos.map((s) => {
                const pct = kpis.ingresos > 0 ? ((s.monto / kpis.ingresos) * 100).toFixed(0) : 0;
                return (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-slate-700 truncate">{s.label}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-slate-900 tabular-nums">
                        {fmtPEN(s.monto)}
                      </div>
                      <div className="text-[10px] text-slate-400">{pct}%</div>
                    </div>
                  </div>
                );
              })}
              {breakdownIngresos.length === 0 && (
                <div className="text-xs text-slate-400 italic">Sin ingresos</div>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">
            Egresos por destino
          </h3>
          <div className="flex items-center gap-4">
            <Donut data={breakdownEgresos} total={kpis.egresos} />
            <div className="flex-1 space-y-1.5">
              {breakdownEgresos.map((s) => {
                const pct = kpis.egresos > 0 ? ((s.monto / kpis.egresos) * 100).toFixed(0) : 0;
                return (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-slate-700 truncate">{s.label}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-slate-900 tabular-nums">
                        {fmtPEN(s.monto)}
                      </div>
                      <div className="text-[10px] text-slate-400">{pct}%</div>
                    </div>
                  </div>
                );
              })}
              {breakdownEgresos.length === 0 && (
                <div className="text-xs text-slate-400 italic">Sin egresos</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
