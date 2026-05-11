/**
 * ForecastCostosTable · proyección costos top SKUs · Workspace Forecast
 *
 * chk5.B10c (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-forecast.html · Sec 1 · Panel 1`.
 *
 * Tabla top N SKUs ordenados por riesgo (mayor δ esperado en 30d).
 * Selector horizonte 30/60/90d · cuando confidence general es baja, sólo 30d.
 * Confidence visual: barra horizontal + label · SKUs con baja confidence
 * muestran proyección en italic + ± rango.
 */

import React from 'react';
import { Droplets, Pill, Package } from 'lucide-react';
import type { ForecastCostoSku, ForecastHorizon, ConfidenceLevel } from '../../../utils/costIntelligence';
import { CONFIDENCE_LABELS, CONFIDENCE_CLASSES } from '../../../utils/costIntelligence';

interface ForecastCostosTableProps {
  skus: ForecastCostoSku[];
  horizonte: ForecastHorizon;
  onCambiarHorizonte: (h: ForecastHorizon) => void;
  /** Horizontes 60d/90d se ocultan cuando confidence general es baja */
  permitirHorizontesLargos: boolean;
}

const fmtPEN = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPEN0 = (n: number) =>
  Math.round(n).toLocaleString('es-PE');
const fmtPct = (n: number, decimals = 1) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;

function iconPorLinea(linea?: string): React.ComponentType<{ className?: string }> {
  const code = (linea ?? '').toLowerCase();
  if (code.includes('skin')) return Droplets;
  if (code.includes('sup') || code.includes('vita') || code.includes('cap')) return Pill;
  return Package;
}

function iconColorPorLinea(linea?: string): string {
  const code = (linea ?? '').toLowerCase();
  if (code.includes('skin')) return 'text-amber-700';
  if (code.includes('sup') || code.includes('vita') || code.includes('cap')) return 'text-indigo-700';
  return 'text-slate-600';
}

function rowBgByDelta(delta: number, confidence: ConfidenceLevel): string {
  if (confidence === 'baja') return 'hover:bg-slate-50';
  if (delta >= 5) return 'bg-rose-50/30 hover:bg-rose-50/60';
  if (delta >= 2) return 'bg-amber-50/30 hover:bg-amber-50/60';
  return 'hover:bg-slate-50';
}

function deltaColorByConfidence(delta: number, confidence: ConfidenceLevel): string {
  if (confidence === 'baja') return 'text-slate-500';
  if (delta >= 5) return 'text-rose-700';
  if (delta >= 2) return 'text-amber-700';
  if (delta >= 0) return 'text-emerald-600';
  return 'text-emerald-600';
}

export const ForecastCostosTable: React.FC<ForecastCostosTableProps> = ({
  skus,
  horizonte,
  onCambiarHorizonte,
  permitirHorizontesLargos,
}) => {
  // Helper para obtener valor según horizonte
  const proyAt = (sku: ForecastCostoSku): number =>
    horizonte === '30d' ? sku.proyeccion30d
    : horizonte === '60d' ? sku.proyeccion60d
    : sku.proyeccion90d;
  const deltaAt = (sku: ForecastCostoSku): number =>
    horizonte === '30d' ? sku.deltaPct30d
    : horizonte === '60d' ? sku.deltaPct60d
    : sku.deltaPct90d;

  // Agregados footer (promedio ponderado por capital afectado)
  const totalCapital = skus.reduce((s, x) => s + x.capitalAfectadoPEN, 0);
  const promedioDeltaPonderado = totalCapital > 0
    ? skus.reduce((s, x) => s + deltaAt(x) * x.capitalAfectadoPEN, 0) / totalCapital
    : 0;
  const countByConf = skus.reduce<Record<ConfidenceLevel, number>>(
    (acc, x) => { acc[x.confidence] = (acc[x.confidence] ?? 0) + 1; return acc; },
    { alta: 0, media: 0, baja: 0 }
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div>
          <div className="text-sm font-bold text-slate-900">
            Proyección costos · top {skus.length} SKUs por riesgo
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Ordenados por mayor proyección de subida · WMA de últimos lotes
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-500">Horizonte:</span>
          <button
            type="button"
            onClick={() => onCambiarHorizonte('30d')}
            className={`px-2 py-1 rounded text-[10px] font-bold ${
              horizonte === '30d'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            30d
          </button>
          {permitirHorizontesLargos && (
            <>
              <button
                type="button"
                onClick={() => onCambiarHorizonte('60d')}
                className={`px-2 py-1 rounded text-[10px] font-bold ${
                  horizonte === '60d'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                60d
              </button>
              <button
                type="button"
                onClick={() => onCambiarHorizonte('90d')}
                className={`px-2 py-1 rounded text-[10px] font-bold ${
                  horizonte === '90d'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                90d
              </button>
            </>
          )}
        </div>
      </div>

      {!permitirHorizontesLargos && (
        <div className="text-[10px] text-amber-700 italic mb-3">
          ⚠ Horizontes 60d / 90d deshabilitados por baja confidence general
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
              <th className="px-2 py-2">SKU</th>
              <th className="px-2 py-2">Producto</th>
              <th className="px-2 py-2 text-right">Costo actual</th>
              <th className="px-2 py-2 text-right">Proyectado {horizonte}</th>
              <th className="px-2 py-2 text-right">Δ esperado</th>
              <th className="px-2 py-2 text-right">Capital afectado</th>
              <th className="px-2 py-2 text-center">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {skus.map((sku) => {
              const proj = proyAt(sku);
              const delta = deltaAt(sku);
              const Icon = iconPorLinea(sku.lineaNegocioNombre);
              const iconCls = iconColorPorLinea(sku.lineaNegocioNombre);
              const confCls = CONFIDENCE_CLASSES[sku.confidence];
              const isLowConf = sku.confidence === 'baja';
              return (
                <tr key={sku.productoId} className={rowBgByDelta(delta, sku.confidence)}>
                  <td className={`px-2 py-2 font-mono font-bold ${isLowConf ? 'text-slate-500' : delta >= 5 ? 'text-rose-700' : delta >= 2 ? 'text-amber-700' : 'text-slate-700'}`}>
                    {sku.sku || '—'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon className={`w-3 h-3 flex-shrink-0 ${iconCls}`} />
                      <span className="text-slate-900 font-medium truncate">{sku.nombreComercial}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold">
                    S/ {fmtPEN(sku.costoActualPEN)}
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums font-bold ${isLowConf ? 'text-slate-500 italic' : deltaColorByConfidence(delta, sku.confidence)}`}>
                    {isLowConf && '~'}S/ {fmtPEN(proj)}
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums font-bold ${isLowConf ? 'text-slate-500 italic' : deltaColorByConfidence(delta, sku.confidence)}`}>
                    {fmtPct(delta)}{isLowConf && ' ±5%'}
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums ${isLowConf ? 'text-slate-400' : 'text-slate-600'}`}>
                    S/ {fmtPEN0(sku.capitalAfectadoPEN)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="flex items-center justify-center gap-1">
                      <span className="inline-block h-1 w-8 rounded bg-slate-200 overflow-hidden align-middle">
                        <span
                          className={`block h-full ${confCls.bar}`}
                          style={{ width: `${sku.confidenceScore}%` }}
                        />
                      </span>
                      <span className={`text-[9px] font-bold ${confCls.text}`}>
                        {CONFIDENCE_LABELS[sku.confidence]}
                      </span>
                    </span>
                    <span className="text-[8px] text-slate-400 tabular-nums">
                      {sku.lotesHistoricos} {sku.lotesHistoricos === 1 ? 'lote' : 'lotes'}
                    </span>
                  </td>
                </tr>
              );
            })}

            {/* Footer · agregado ponderado */}
            <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
              <td className="px-2 py-2 text-slate-900" colSpan={2}>
                Promedio top {skus.length} (ponderado por capital)
              </td>
              <td className="px-2 py-2 text-right tabular-nums">—</td>
              <td className="px-2 py-2 text-right tabular-nums">—</td>
              <td className={`px-2 py-2 text-right tabular-nums ${promedioDeltaPonderado >= 2 ? 'text-rose-700' : 'text-emerald-600'}`}>
                {fmtPct(promedioDeltaPonderado)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                S/ {fmtPEN0(totalCapital)}
              </td>
              <td className="px-2 py-2 text-center text-[10px] text-slate-500 font-normal">
                {countByConf.alta} alta · {countByConf.media} media · {countByConf.baja} baja
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-slate-400 mt-3">
        <span className="font-bold">Confidence:</span> ≥6 lotes = alta · 3-5 = media · &lt;3 = baja (italic + rango ±)
      </div>
    </div>
  );
};
