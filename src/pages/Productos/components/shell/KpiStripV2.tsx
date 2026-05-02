/**
 * KpiStripV2 · KPI strip canónico F2 variante C (con sparklines opcionales)
 *
 * Mockup canónico: docs/mockups/productos/01-page-listado.html
 *
 * 4 columnas:
 *   1. Productos activos (count + delta texto)
 *   2. Variantes/SKUs (count + sub-line)
 *   3. Stock crítico (count rosa + sub-line con sub-cuenta)
 *   4. Margen promedio (% emerald + sparkline + delta vs trim. anterior)
 */

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { SparklineMini } from '../shared';

interface KpiStripV2Props {
  productosActivos: number;
  productosTotales: number;
  productosNuevosMes: number;
  variantesSkusTotal: number;
  productosConVariantes: number;
  stockCritico: number;
  stockCriticoSinInvestigar: number;
  margenPromedio: number;
  margenDeltaTrimestre?: number;
  /** Serie 6-12 puntos para el sparkline. Si no se pasa, no se muestra. */
  margenSerie?: number[];
}

export const KpiStripV2: React.FC<KpiStripV2Props> = ({
  productosActivos,
  productosTotales,
  productosNuevosMes,
  variantesSkusTotal,
  productosConVariantes,
  stockCritico,
  stockCriticoSinInvestigar,
  margenPromedio,
  margenDeltaTrimestre,
  margenSerie,
}) => {
  const margenDeltaPositive = (margenDeltaTrimestre ?? 0) >= 0;
  const TrendIcon = margenDeltaPositive ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 mb-5">
      {/* KPI 1 · Productos activos */}
      <div className="p-3 lg:p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Productos activos</div>
        <div className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight tabular-nums">{productosActivos}</div>
        <div className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
          {productosTotales} en total {productosNuevosMes > 0 && `· +${productosNuevosMes} este mes`}
        </div>
      </div>

      {/* KPI 2 · Variantes (SKUs) */}
      <div className="p-3 lg:p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Variantes (SKUs)</div>
        <div className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight tabular-nums">{variantesSkusTotal}</div>
        <div className="text-[11px] text-slate-500 mt-1.5 tabular-nums">de {productosConVariantes} productos</div>
      </div>

      {/* KPI 3 · Stock crítico */}
      <div className="p-3 lg:p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Stock crítico</div>
        <div className={`text-xl lg:text-2xl font-bold tracking-tight tabular-nums ${stockCritico > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
          {stockCritico}
        </div>
        <div className={`text-[11px] mt-1.5 tabular-nums ${stockCritico > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
          {stockCriticoSinInvestigar > 0 ? `${stockCriticoSinInvestigar} sin investigar` : 'Todo bajo control'}
        </div>
      </div>

      {/* KPI 4 · Margen promedio + sparkline */}
      <div className="p-3 lg:p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Margen promedio</div>
        <div className="flex items-end justify-between">
          <div className="text-xl lg:text-2xl font-bold text-emerald-600 tracking-tight tabular-nums">
            {margenPromedio}
            <span className="text-base text-emerald-300 font-normal">%</span>
          </div>
          {margenSerie && margenSerie.length >= 2 && (
            <SparklineMini values={margenSerie} color="#10b981" width={64} height={24} />
          )}
        </div>
        {margenDeltaTrimestre !== undefined && (
          <div className={`text-[11px] mt-1.5 flex items-center gap-1 tabular-nums ${margenDeltaPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            <TrendIcon className="w-3 h-3" />
            {margenDeltaPositive ? '+' : ''}
            {margenDeltaTrimestre.toFixed(1)} vs trim. anterior
          </div>
        )}
      </div>
    </div>
  );
};
