/**
 * AnalyticsTab · canon pixel-perfect mockup X (chk4.17)
 *
 * Estructura del mockup stock-canon-s3.6-X.html (líneas 809-928):
 *   3 charts simples:
 *     1. Donut · Distribución por estado (5 estados con %)
 *     2. Líneas · Tendencia movimiento (entradas vs salidas · 6 meses)
 *     3. Barras horizontales · Top 5 productos por valor en stock
 *
 * Reemplaza al InventarioAnalytics legacy (1846 ln · god-component).
 * Filosofía: simplicidad + alineación canon · NO recargar con KPIs
 * redundantes (eso ya está en KpiStripV2 arriba).
 *
 * Charts construidos con SVG inline · cero deps externas.
 *
 * NOTA · El chart de Tendencia 6 meses requiere histórico de movimientos
 * que aún no se computa · placeholder activo · TODO en chk siguiente.
 */

import React, { useMemo } from 'react';
import { PieChart, TrendingUp, BarChart3, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../../../utils/format';
import type { ProductoConUnidades } from './ProductoInventarioTable';

interface AnalyticsTabProps {
  productosConUnidades: ProductoConUnidades[];
  /** Stats agregados del inventario (mismo contrato que KpiStripV2) */
  stats: {
    enOrigen: number;
    enTransito: number;
    disponiblePeru: number;
    reservada: number;
    problemas: number;
    total: number;
  };
}

interface DonutSegmento {
  label: string;
  value: number;
  color: string;
  hex: string;
}

// ─── AnalyticsTab principal ───────────────────────────────────────────────────

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ productosConUnidades, stats }) => {
  // Donut: 5 estados con valor + %
  const donutSegmentos: DonutSegmento[] = useMemo(() => [
    { label: 'Disponible',  value: stats.disponiblePeru,  color: 'bg-emerald-500', hex: '#10b981' },
    { label: 'En tránsito', value: stats.enTransito,       color: 'bg-sky-500',     hex: '#0ea5e9' },
    { label: 'Origen',       value: stats.enOrigen,         color: 'bg-amber-500',   hex: '#f59e0b' },
    { label: 'Reservada',    value: stats.reservada,        color: 'bg-purple-500',  hex: '#8b5cf6' },
    { label: 'Problemas',    value: stats.problemas,        color: 'bg-rose-500',    hex: '#ef4444' },
  ], [stats]);

  // Top 5 productos por valor en stock (USD)
  const topProductos = useMemo(() => {
    const ordenados = [...productosConUnidades]
      .filter(p => p.valorTotalUSD > 0)
      .sort((a, b) => b.valorTotalUSD - a.valorTotalUSD)
      .slice(0, 5);
    const valorTotalGlobal = productosConUnidades.reduce((s, p) => s + p.valorTotalUSD, 0);
    return ordenados.map((p, idx) => ({
      ...p,
      pct: valorTotalGlobal > 0 ? (p.valorTotalUSD / valorTotalGlobal) * 100 : 0,
      // Color rotativo · primer producto teal · luego purple/amber/indigo
      barColor: ['bg-teal-500', 'bg-purple-500', 'bg-amber-500', 'bg-amber-500', 'bg-indigo-500'][idx],
    }));
  }, [productosConUnidades]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 1 · Donut Distribución por estado */}
      <ChartCard
        title="Distribución por estado"
        subtitle={`Snapshot actual · ${stats.total.toLocaleString('es-PE')} unidades`}
        icon={PieChart}
      >
        <DonutChart segmentos={donutSegmentos} total={stats.total} />
      </ChartCard>

      {/* Chart 2 · Líneas Tendencia movimiento (placeholder · requiere histórico) */}
      <ChartCard
        title="Tendencia movimiento"
        subtitle="Últimos 6 meses · entradas vs salidas"
        icon={TrendingUp}
      >
        <PlaceholderChart message="Histórico de movimientos no disponible aún" />
      </ChartCard>

      {/* Chart 3 · Top 5 productos por valor (col-span-2) */}
      <div className="lg:col-span-2">
        <ChartCard
          title="Top 5 productos por valor en stock"
          subtitle="USD · concentración del capital inmovilizado"
          icon={BarChart3}
        >
          {topProductos.length === 0 ? (
            <PlaceholderChart message="Sin productos con valor para rankear" />
          ) : (
            <BarrasHorizontales productos={topProductos} />
          )}
        </ChartCard>
      </div>
    </div>
  );
};

// ─── ChartCard wrapper ────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, icon: Icon, children }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4">
    <div className="flex items-center justify-between mb-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
        <div className="text-[10px] text-slate-500 truncate">{subtitle}</div>
      </div>
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
    </div>
    {children}
  </div>
);

// ─── DonutChart ──────────────────────────────────────────────────────────────

const DonutChart: React.FC<{ segmentos: DonutSegmento[]; total: number }> = ({ segmentos, total }) => {
  if (total === 0) {
    return <PlaceholderChart message="Sin unidades para visualizar" />;
  }

  // Calcular dasharrays acumulativos (circumference para r=14 ≈ 88 → simplificamos a 100)
  let acumuladoOffset = 0;
  const segmentosConDash = segmentos.map(s => {
    const pct = total > 0 ? (s.value / total) * 100 : 0;
    const dasharray = `${pct} 100`;
    const dashoffset = -acumuladoOffset;
    acumuladoOffset += pct;
    return { ...s, pct, dasharray, dashoffset };
  });

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90 flex-shrink-0">
        <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="4" />
        {segmentosConDash.map((s, idx) =>
          s.value > 0 ? (
            <circle
              key={idx}
              cx="18" cy="18" r="14"
              fill="none"
              stroke={s.hex}
              strokeWidth="4"
              strokeDasharray={s.dasharray}
              strokeDashoffset={s.dashoffset}
            />
          ) : null
        )}
      </svg>
      <div className="flex-1 min-w-[180px] space-y-1.5 text-xs">
        {segmentosConDash.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${s.color} flex-shrink-0`} />
            <span className="text-slate-700 truncate">{s.label}</span>
            <span className="ml-auto font-bold text-slate-900 tabular-nums">{s.value.toLocaleString('es-PE')}</span>
            <span className="text-slate-400 text-[10px] tabular-nums w-8 text-right">{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── BarrasHorizontales ──────────────────────────────────────────────────────

interface BarraProducto {
  productoId: string;
  nombre: string;
  valorTotalUSD: number;
  pct: number;
  barColor: string;
}

const BarrasHorizontales: React.FC<{ productos: BarraProducto[] }> = ({ productos }) => {
  // El primero (mayor valor) es 100% de la barra · el resto es relativo
  const maxValor = productos[0]?.valorTotalUSD ?? 1;

  return (
    <div className="space-y-2.5">
      {productos.map(p => {
        const widthBar = (p.valorTotalUSD / maxValor) * 95; // 95% max para que entre el label
        return (
          <div key={p.productoId} className="flex items-center gap-3">
            <div className="text-xs font-medium text-slate-700 w-48 truncate flex-shrink-0">
              {p.nombre}
            </div>
            <div className="flex-1 bg-slate-100 rounded h-5 relative overflow-hidden">
              <div
                className={`${p.barColor} h-full rounded`}
                style={{ width: `${Math.max(widthBar, 5)}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-white tabular-nums">
                {formatCurrency(p.valorTotalUSD, 'USD')}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 tabular-nums w-12 text-right flex-shrink-0">
              {p.pct.toFixed(0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── PlaceholderChart ────────────────────────────────────────────────────────

const PlaceholderChart: React.FC<{ message: string }> = ({ message }) => (
  <div className="h-32 flex items-center justify-center bg-slate-50 rounded-lg">
    <div className="text-center">
      <Sparkles className="w-6 h-6 text-slate-300 mx-auto mb-1" />
      <p className="text-xs text-slate-400 italic">{message}</p>
    </div>
  </div>
);
