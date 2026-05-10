/**
 * KpiStripExecutive · 5 KPIs canon Cost Intelligence
 *
 * En esta fase MVP (Camino A · solo Catálogo funcional) los KPIs reflejan
 * la realidad del catálogo de productos · no incluyen series temporales ni
 * variance (esos llegan cuando haya data transaccional).
 *
 * Mockup canónico: docs/mockups/cost-intelligence-vision-s3.6.html · KPI strip
 *
 * KPIs por workspace (MVP):
 *   - Total catálogo:       212 productos · 18 marcas · X líneas
 *   - Investigados:         Y/212 (Z%)
 *   - Margen prom.:         %  (sobre productos con investigación completa)
 *   - Sin precio venta:     N productos · CTA
 *   - Stability score:      0-100 (mismo formato canon que mockup)
 */

import React from 'react';
import { Package, ClipboardCheck, TrendingUp, AlertCircle, ShieldCheck } from 'lucide-react';

export interface KpiCatalogo {
  totalProductos: number;
  marcasUnicas: number;
  lineasUnicas: number;
  productosInvestigados: number;
  porcentajeInvestigados: number;
  margenPromedio: number | null;        // null si no hay productos con margen calculable
  productosSinPrecioVenta: number;
  stabilityScore: number;               // 0-100 · placeholder (cuando haya histórico real, se calcula con variance)
}

interface KpiStripExecutiveProps {
  kpis: KpiCatalogo;
}

export const KpiStripExecutive: React.FC<KpiStripExecutiveProps> = ({ kpis }) => {
  const fmt = (n: number) => n.toLocaleString('es-PE');
  const margenStr = kpis.margenPromedio !== null
    ? `${kpis.margenPromedio.toFixed(1)}%`
    : '—';

  return (
    <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-200">
      {/* KPI 1 · Total catálogo */}
      <div className="p-4">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
          Total catálogo
        </div>
        <div className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
          {fmt(kpis.totalProductos)}
        </div>
        <div className="text-[11px] text-slate-500 mt-1.5 tabular-nums flex items-center gap-1">
          <Package className="w-3 h-3" />
          {fmt(kpis.marcasUnicas)} marcas · {fmt(kpis.lineasUnicas)} líneas
        </div>
      </div>

      {/* KPI 2 · Investigados */}
      <div className="p-4">
        <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider mb-1.5">
          Investigados
        </div>
        <div className="text-2xl font-bold text-sky-700 tabular-nums tracking-tight">
          {fmt(kpis.productosInvestigados)}
          <span className="text-sm text-sky-600 font-medium ml-1">/ {fmt(kpis.totalProductos)}</span>
        </div>
        <div className="text-[11px] text-sky-700 mt-1.5 tabular-nums flex items-center gap-1">
          <ClipboardCheck className="w-3 h-3" />
          {kpis.porcentajeInvestigados.toFixed(0)}% del catálogo
        </div>
      </div>

      {/* KPI 3 · Margen promedio */}
      <div className="p-4">
        <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">
          Margen promedio
        </div>
        <div className="text-2xl font-bold text-emerald-600 tabular-nums tracking-tight">
          {margenStr}
        </div>
        <div className="text-[11px] text-emerald-600 mt-1.5 tabular-nums flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {kpis.margenPromedio !== null
            ? 'Productos con investigación completa'
            : 'Sin datos suficientes'}
        </div>
      </div>

      {/* KPI 4 · Sin precio venta */}
      <div className="p-4">
        <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">
          Sin precio venta
        </div>
        <div className="text-2xl font-bold text-amber-700 tabular-nums tracking-tight">
          {fmt(kpis.productosSinPrecioVenta)}
        </div>
        <div className="text-[11px] text-amber-700 mt-1.5 tabular-nums flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          requieren investigación
        </div>
      </div>

      {/* KPI 5 · Stability score */}
      <div className="p-4">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
          Stability score
        </div>
        <div className="text-2xl font-bold text-slate-400 tabular-nums tracking-tight">
          {kpis.stabilityScore}
        </div>
        <div className="text-[11px] text-slate-500 mt-1.5 tabular-nums flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          requiere historial · pendiente
        </div>
      </div>
    </div>
  );
};
