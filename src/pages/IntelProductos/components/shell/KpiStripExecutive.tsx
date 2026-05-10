/**
 * KpiStripExecutive · KPI strip canon Cost Intelligence · F2 variante C
 *
 * chk5.B5 (S3.6 M1.bis · Cost Intelligence) · refactor pixel-perfect contra
 * canon Productos V2 `KpiStripV2.tsx`. 4 columnas con sparkline + delta
 * trend en la última (Margen promedio).
 *
 * KPIs canon (en orden):
 *   1. Capital catalogado  · S/ total invertido en costos investigados
 *   2. Investigados         · X/Y con % del catálogo
 *   3. Sin precio venta     · count amber · requieren investigación
 *   4. Margen promedio      · % emerald + SparklineMini + delta trim. anterior
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Sec 1
 */

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { SparklineMini } from '../../../Productos/components/shared/SparklineMini';

export interface KpiCatalogo {
  /** Suma de costoPEN de productos con investigación (capital invertido si se compraran todos) */
  capitalCatalogadoPEN: number;
  /** Total productos en catálogo */
  totalProductos: number;
  marcasUnicas: number;
  lineasUnicas: number;
  /** Productos con investigación completa */
  productosInvestigados: number;
  porcentajeInvestigados: number;
  productosSinPrecioVenta: number;
  /** Margen % promedio · null si no hay productos con margen calculable */
  margenPromedio: number | null;
  /** Serie 6-12 puntos para sparkline · opcional · se muestra solo si length >= 2 */
  margenSerie?: number[];
  /** Delta vs trim. anterior · positivo = subió */
  margenDeltaTrimestre?: number;
}

interface KpiStripExecutiveProps {
  kpis: KpiCatalogo;
}

const fmtPEN = (n: number) => `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
const fmtInt = (n: number) => n.toLocaleString('es-PE');

export const KpiStripExecutive: React.FC<KpiStripExecutiveProps> = ({ kpis }) => {
  const margenDeltaPositive = (kpis.margenDeltaTrimestre ?? 0) >= 0;
  const TrendIcon = margenDeltaPositive ? TrendingUp : TrendingDown;
  const margenStr = kpis.margenPromedio !== null ? kpis.margenPromedio.toFixed(1) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 mb-5">
      {/* KPI 1 · Capital catalogado */}
      <div className="p-3 lg:p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Capital catalogado
        </div>
        <div className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
          {fmtPEN(kpis.capitalCatalogadoPEN)}
        </div>
        <div className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
          {fmtInt(kpis.totalProductos)} SKUs · {fmtInt(kpis.marcasUnicas)} marcas · {fmtInt(kpis.lineasUnicas)} líneas
        </div>
      </div>

      {/* KPI 2 · Investigados */}
      <div className="p-3 lg:p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Investigados
        </div>
        <div className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
          {fmtInt(kpis.productosInvestigados)}
          <span className="text-base text-slate-400 font-normal">/{fmtInt(kpis.totalProductos)}</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
          {kpis.porcentajeInvestigados.toFixed(0)}% del catálogo
          {kpis.totalProductos - kpis.productosInvestigados > 0 &&
            ` · ${fmtInt(kpis.totalProductos - kpis.productosInvestigados)} pendientes`}
        </div>
      </div>

      {/* KPI 3 · Sin precio venta */}
      <div className="p-3 lg:p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Sin precio venta
        </div>
        <div
          className={`text-xl lg:text-2xl font-bold tracking-tight tabular-nums ${
            kpis.productosSinPrecioVenta > 0 ? 'text-amber-600' : 'text-slate-900'
          }`}
        >
          {fmtInt(kpis.productosSinPrecioVenta)}
        </div>
        <div className={`text-[11px] mt-1.5 tabular-nums ${kpis.productosSinPrecioVenta > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
          {kpis.productosSinPrecioVenta > 0 ? 'requieren investigación' : 'todos clasificados'}
        </div>
      </div>

      {/* KPI 4 · Margen promedio + sparkline */}
      <div className="p-3 lg:p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Margen promedio
        </div>
        <div className="flex items-end justify-between">
          <div className="text-xl lg:text-2xl font-bold text-emerald-600 tracking-tight tabular-nums">
            {margenStr !== null ? (
              <>
                {margenStr.split('.')[0]}
                <span className="text-base text-emerald-300 font-normal">.{margenStr.split('.')[1] || '0'}%</span>
              </>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>
          {kpis.margenSerie && kpis.margenSerie.length >= 2 && (
            <SparklineMini values={kpis.margenSerie} color="#10b981" width={64} height={24} />
          )}
        </div>
        {kpis.margenDeltaTrimestre !== undefined ? (
          <div
            className={`text-[11px] mt-1.5 flex items-center gap-1 tabular-nums ${
              margenDeltaPositive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            <TrendIcon className="w-3 h-3" />
            {margenDeltaPositive ? '+' : ''}
            {kpis.margenDeltaTrimestre.toFixed(1)} vs trim. anterior
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
            {kpis.margenPromedio !== null ? 'productos con investigación completa' : 'sin datos suficientes'}
          </div>
        )}
      </div>
    </div>
  );
};
