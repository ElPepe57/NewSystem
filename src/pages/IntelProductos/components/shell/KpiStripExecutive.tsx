/**
 * KpiStripExecutive · KPI strip canon Cost Intelligence · F2 variante C
 *
 * chk5.B8 (S3.6 M1.bis · Cost Intelligence) · refactor pixel-perfect contra
 * mockup canónico `cost-intelligence-canon-productos.html` · Sec 1.
 *
 * 4 KPIs canon CI (lógica propia · NO investigación):
 *   1. Capital invertido   · S/ pagado en OCs cerradas (slate)
 *   2. Capital atrapado    · % uds en tránsito + aduana (amber)
 *   3. Variance promedio 30d + sparkline + delta vs mes ant. (rose si +)
 *   4. Anomalías 7D        · count SKUs con variance >5% (rose)
 *
 * Empty state honesto: cuando no hay data, KPIs muestran "—" con explicación.
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Sec 1 + Sec 3
 */

import React from 'react';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { SparklineMini } from '../../../Productos/components/shared/SparklineMini';
import type { KpiCostIntelligence } from '../../utils/costIntelligence';

interface KpiStripExecutiveProps {
  kpis: KpiCostIntelligence;
  /** Si false, renderiza estado dim "sin data" con valores en "—" */
  hasData: boolean;
}

const fmtPEN = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
const fmtInt = (n: number) => n.toLocaleString('es-PE');
const fmtPct = (n: number, decimals = 1) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}`;

export const KpiStripExecutive: React.FC<KpiStripExecutiveProps> = ({ kpis, hasData }) => {
  // Variance UI · si null → "—" gris · si presente → rose si +, emerald si -
  const variance = kpis.variancePromedio30dPct;
  const varianceIsPositive = (variance ?? 0) >= 0;
  const varianceColorClass = variance === null
    ? 'text-slate-400'
    : varianceIsPositive
    ? 'text-rose-600'
    : 'text-emerald-600';

  const delta = kpis.varianceDeltaVsMesAnteriorPct;
  const deltaPositive = (delta ?? 0) >= 0;
  const DeltaIcon = deltaPositive ? TrendingUp : TrendingDown;

  // Capital atrapado · estado UI
  const trappedHigh = kpis.capitalAtrapadoPct >= 15;

  // Anomalías · estado UI
  const hasAnomalias = kpis.anomaliasCount > 0;

  // Wrapper dim cuando no hay data
  const wrapperClasses = `bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 mb-5 ${
    hasData ? '' : 'opacity-70'
  }`;

  return (
    <div className={wrapperClasses}>
      {/* KPI 1 · Capital invertido */}
      <div className="p-3 lg:p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Capital invertido
        </div>
        <div className={`text-xl lg:text-2xl font-bold tracking-tight tabular-nums ${
          hasData ? 'text-slate-900' : 'text-slate-400'
        }`}>
          {hasData ? fmtPEN(kpis.capitalInvertidoPEN) : 'S/ —'}
        </div>
        <div className={`text-[11px] mt-1.5 tabular-nums flex items-center gap-1 ${
          hasData ? 'text-slate-500' : 'text-slate-400'
        }`}>
          <Package className="w-3 h-3" />
          {hasData
            ? `${fmtInt(kpis.capitalInvertidoUds)} uds · ${fmtInt(kpis.capitalInvertidoSkus)} SKUs`
            : '0 OCs cerradas'}
        </div>
      </div>

      {/* KPI 2 · Capital atrapado · amber si hay pipeline · slate si está en cero */}
      <div className="p-3 lg:p-4">
        <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${
          hasData && trappedHigh ? 'text-amber-700' : 'text-slate-500'
        }`}>
          Capital atrapado
        </div>
        <div className={`text-xl lg:text-2xl font-bold tracking-tight tabular-nums ${
          !hasData ? 'text-slate-400'
          : trappedHigh ? 'text-amber-700'
          : 'text-slate-900'
        }`}>
          {hasData ? fmtPEN(kpis.capitalAtrapadoPEN) : 'S/ —'}
        </div>
        <div className={`text-[11px] mt-1.5 tabular-nums flex items-center gap-1 ${
          !hasData ? 'text-slate-400'
          : trappedHigh ? 'text-amber-700'
          : 'text-slate-500'
        }`}>
          {hasData && trappedHigh && <AlertTriangle className="w-3 h-3" />}
          {hasData
            ? `${kpis.capitalAtrapadoPct.toFixed(0)}% del total · en tránsito + aduana`
            : '0 unidades en pipeline'}
        </div>
      </div>

      {/* KPI 3 · Variance promedio 30d + sparkline + delta */}
      <div className="p-3 lg:p-4">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Variance promedio 30d
        </div>
        <div className="flex items-end justify-between">
          <div className={`text-xl lg:text-2xl font-bold tracking-tight tabular-nums ${varianceColorClass}`}>
            {variance !== null ? (
              <>
                {fmtPct(variance)}
                <span className={varianceIsPositive ? 'text-rose-300' : 'text-emerald-300'}>%</span>
              </>
            ) : (
              '—'
            )}
          </div>
          {/* Sparkline placeholder · MVP sin serie real */}
          {variance !== null && (
            <SparklineMini
              values={[variance - 1.5, variance - 1.0, variance - 0.6, variance - 0.3, variance]}
              color={varianceIsPositive ? '#e11d48' : '#10b981'}
              width={64}
              height={24}
            />
          )}
        </div>
        {delta !== null ? (
          <div className={`text-[11px] mt-1.5 flex items-center gap-1 tabular-nums ${
            deltaPositive ? 'text-rose-600' : 'text-emerald-600'
          }`}>
            <DeltaIcon className="w-3 h-3" />
            {fmtPct(delta)} vs mes anterior
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
            {hasData
              ? 'Sin lotes consecutivos en 60d'
              : 'Requiere ≥2 OCs mismo SKU'}
          </div>
        )}
      </div>

      {/* KPI 4 · Anomalías 7D · rose si hay · slate si cero */}
      <div className="p-3 lg:p-4">
        <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${
          hasData && hasAnomalias ? 'text-rose-700' : 'text-slate-500'
        }`}>
          Anomalías 7D
        </div>
        <div className={`text-xl lg:text-2xl font-bold tracking-tight tabular-nums ${
          !hasData ? 'text-slate-400'
          : hasAnomalias ? 'text-rose-700'
          : 'text-slate-900'
        }`}>
          {hasData ? fmtInt(kpis.anomaliasCount) : '—'}
        </div>
        <div className={`text-[11px] mt-1.5 tabular-nums flex items-center gap-1 ${
          !hasData ? 'text-slate-400'
          : hasAnomalias ? 'text-rose-700'
          : 'text-slate-500'
        }`}>
          {hasData && hasAnomalias && <Zap className="w-3 h-3" />}
          {hasData
            ? hasAnomalias
              ? `${kpis.anomaliasCriticasCount} críticas · revisar`
              : 'sin anomalías esta semana'
            : 'Requiere histórico 60d'}
        </div>
      </div>
    </div>
  );
};
