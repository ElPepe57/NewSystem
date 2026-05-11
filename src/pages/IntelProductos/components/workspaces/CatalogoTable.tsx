/**
 * CatalogoTable · grid-12 canon Productos · density-first · Cost Intelligence
 *
 * chk5.B8 (S3.6 M1.bis · Cost Intelligence) · refactor canon CI · cero refs
 * a investigación. Las columnas reflejan la lógica propia del módulo:
 * costos reales de adquisición + variance + capital atrapado + stability.
 *
 * COLUMNAS (grid 12 cols · canon F4):
 *   col-1  checkbox
 *   col-4  Producto · avatar gradient + nombre + sub-info (sku · marca · línea · lotes)
 *   col-2  Último costo (S/ + $USD · TCPA)
 *   col-2  Variance vs lote ant (% · color + label estable/volátil/anómalo)
 *   col-2  Capital · Trend 90d (S/ + sparkline real de lotes)
 *   col-1  Stability score pill (verde/amber/rose)
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Sec 1
 */

import React from 'react';
import {
  ChevronUp,
  ChevronDown,
  Search as SearchIcon,
  Zap,
  TrendingUp,
} from 'lucide-react';
import {
  ProductoAvatar,
  inferLineaFromProducto,
} from '../../../Productos/components/shared/ProductoAvatar';
import { SparklineMini } from '../../../Productos/components/shared/SparklineMini';
import type { SkuConCostos } from '../../utils/costIntelligence';
import {
  ESTADO_COSTO_CLASSES,
  ESTADO_COSTO_LABELS,
} from '../../utils/costIntelligence';

export type SortKey = 'nombre' | 'ultimoCosto' | 'variance' | 'capital' | 'stability';
export type SortDir = 'asc' | 'desc';

interface CatalogoTableProps {
  skus: SkuConCostos[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  seleccionadoId: string | null;
  onSelect: (sku: SkuConCostos) => void;
}

const fmtPEN = (n: number) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSD = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString('es-PE');
const fmtPct = (n: number, decimals = 1) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;

function stabilityClasses(score: number): string {
  if (score >= 70) return 'bg-emerald-100 text-emerald-700';
  if (score >= 40) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
}

function lineaBadgeClasses(linea: string | undefined): string {
  const code = (linea ?? '').toLowerCase();
  if (code.includes('skin')) return 'bg-amber-50 text-amber-700';
  if (code.includes('sup') || code.includes('vita') || code.includes('cap')) return 'bg-indigo-50 text-indigo-700';
  if (code.includes('well') || code.includes('aloe')) return 'bg-emerald-50 text-emerald-700';
  return 'bg-slate-50 text-slate-600';
}

export const CatalogoTable: React.FC<CatalogoTableProps> = ({
  skus,
  sortKey,
  sortDir,
  onSort,
  seleccionadoId,
  onSelect,
}) => {
  if (skus.length === 0) {
    return (
      <div className="p-12 text-center">
        <SearchIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">
          No hay SKUs con costos que coincidan con los filtros
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Header tabla · grid 12 cols canon */}
      <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        <div className="col-span-1">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-teal-600 w-3.5 h-3.5"
          />
        </div>
        <SortHeader
          label="Producto"
          k="nombre"
          align="left"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          className="col-span-4"
        />
        <SortHeader
          label="Último costo"
          k="ultimoCosto"
          align="right"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          className="col-span-2"
        />
        <SortHeader
          label="Variance vs lote ant."
          k="variance"
          align="right"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          className="col-span-2"
        />
        <SortHeader
          label="Capital · Trend 90d"
          k="capital"
          align="right"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          className="col-span-2"
        />
        <SortHeader
          label="Stability"
          k="stability"
          align="center"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          className="col-span-1"
        />
      </div>

      {/* Cuerpo · divide-y canon */}
      <div className="divide-y divide-slate-100">
        {skus.map((sku) => {
          const isSelected = seleccionadoId === sku.productoId;
          const isAnomalia = sku.estadoCosto === 'anomalo';
          const isInactive = sku.estado !== 'activo';

          const linea = inferLineaFromProducto({
            linea: sku.lineaNegocioNombre,
            tipo: sku.tipoProductoNombre,
            esPack: sku.esPack,
          });

          // Trend color · derivado del último variance (no del score)
          const trendColor = sku.estadoCosto === 'estable'
            ? '#10b981'
            : sku.estadoCosto === 'volatil'
            ? '#f59e0b'
            : sku.estadoCosto === 'anomalo'
            ? '#e11d48'
            : '#94a3b8';

          // Variance display
          const variance = sku.varianceVsLoteAntPct;
          const varianceClasses = variance === null
            ? 'text-slate-400'
            : sku.estadoCosto === 'estable'
            ? 'text-emerald-600'
            : sku.estadoCosto === 'volatil'
            ? 'text-amber-600'
            : 'text-rose-600';

          return (
            <div
              key={sku.productoId}
              onClick={() => onSelect(sku)}
              className={`grid grid-cols-12 gap-3 items-center px-4 py-3 cursor-pointer group transition-colors ${
                isSelected
                  ? isAnomalia
                    ? 'bg-rose-50/30 ring-1 ring-rose-200'
                    : 'bg-teal-50/60 ring-1 ring-teal-200'
                  : 'hover:bg-slate-50'
              } ${isInactive ? 'opacity-60' : ''}`}
            >
              {/* col-1 checkbox */}
              <div className="col-span-1">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-teal-600 w-3.5 h-3.5"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* col-4 producto · avatar + nombre + sub-info */}
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <ProductoAvatar linea={linea} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                    {sku.nombreComercial}
                    {isAnomalia && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" />
                        ANOMALÍA
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 flex-wrap">
                    <span className="font-mono">{sku.sku || '—'}</span>
                    {sku.marca && (
                      <>
                        <span>·</span>
                        <span className="text-slate-600 font-medium truncate">{sku.marca}</span>
                      </>
                    )}
                    {sku.lineaNegocioNombre && (
                      <>
                        <span>·</span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${lineaBadgeClasses(
                            sku.lineaNegocioNombre
                          )}`}
                        >
                          {sku.lineaNegocioNombre}
                        </span>
                      </>
                    )}
                    {sku.lotes.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                          {sku.lotes.length} {sku.lotes.length === 1 ? 'lote' : 'lotes'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* col-2 Último costo */}
              <div className="col-span-2 text-right">
                <div className="text-sm font-semibold text-slate-900 tabular-nums">
                  S/ {fmtPEN(sku.ultimoCostoPEN).split('.')[0]}
                  <span className="text-slate-400">
                    .{fmtPEN(sku.ultimoCostoPEN).split('.')[1]}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 tabular-nums">
                  $ {fmtUSD(sku.ultimoCostoUSD)} · TCPA {sku.tcUltimoLote.toFixed(2)}
                </div>
              </div>

              {/* col-2 Variance vs lote anterior */}
              <div className="col-span-2 text-right">
                {variance !== null ? (
                  <>
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-sm font-bold tabular-nums ${varianceClasses}`}>
                        {fmtPct(variance)}
                      </span>
                      {sku.estadoCosto === 'anomalo' && (
                        <TrendingUp className="w-3.5 h-3.5 text-rose-600" />
                      )}
                    </div>
                    {sku.estadoCosto && (
                      <div
                        className={`text-[10px] ${
                          sku.estadoCosto === 'estable'
                            ? 'text-slate-500'
                            : sku.estadoCosto === 'volatil'
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {ESTADO_COSTO_LABELS[sku.estadoCosto]}
                        {sku.estadoCosto === 'volatil' && ' · revisar'}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-slate-400 tabular-nums italic">—</div>
                    <div className="text-[10px] text-slate-500">Sólo 1 lote</div>
                  </>
                )}
              </div>

              {/* col-2 Capital · Trend 90d */}
              <div className="col-span-2 text-right">
                <div className="text-sm font-semibold text-slate-900 tabular-nums">
                  S/ {fmtInt(Math.round(sku.capitalActivoPEN))}
                </div>
                {sku.trendCostosPEN.length >= 2 ? (
                  <SparklineMini
                    values={sku.trendCostosPEN}
                    color={trendColor}
                    width={80}
                    height={16}
                    strokeWidth={1.5}
                    className="inline mt-0.5"
                  />
                ) : (
                  <div className="text-[10px] text-slate-400 italic">
                    {sku.unidadesActivas} uds · 1 lote
                  </div>
                )}
              </div>

              {/* col-1 Stability score pill */}
              <div className="col-span-1 text-center">
                <span
                  className={`inline-flex items-center justify-center min-w-[28px] h-6 rounded-full font-bold tabular-nums text-[10px] ${stabilityClasses(
                    sku.stabilityScore
                  )}`}
                  title={`Stability score · ${sku.stabilityScore}/100`}
                >
                  {sku.stabilityScore}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer info · canon */}
      <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-200 text-[10px] text-slate-500 tabular-nums flex items-center justify-between">
        <span>
          {fmtInt(skus.length)} SKUs · stability promedio:{' '}
          <span className="font-semibold text-slate-700">
            {Math.round(skus.reduce((s, e) => s + e.stabilityScore, 0) / skus.length)}
          </span>
        </span>
        {(() => {
          const anomalias = skus.filter((s) => s.estadoCosto === 'anomalo').length;
          if (anomalias === 0) return null;
          const cls = ESTADO_COSTO_CLASSES.anomalo;
          return (
            <span className={`flex items-center gap-1 ${cls.text}`}>
              <Zap className="w-3 h-3" />
              {fmtInt(anomalias)} con anomalía
            </span>
          );
        })()}
      </div>
    </>
  );
};

interface SortHeaderProps {
  label: string;
  k: SortKey;
  align: 'left' | 'right' | 'center';
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}

const SortHeader: React.FC<SortHeaderProps> = ({
  label,
  k,
  align,
  sortKey,
  sortDir,
  onSort,
  className = '',
}) => {
  const isActive = sortKey === k;
  const justifyClass =
    align === 'left'
      ? 'justify-start'
      : align === 'right'
      ? 'justify-end'
      : 'justify-center';
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className={`${className} flex items-center gap-0.5 ${justifyClass} hover:text-slate-900 ${
        isActive ? 'text-slate-900' : ''
      } select-none`}
    >
      {label}
      {isActive &&
        (sortDir === 'asc' ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        ))}
    </button>
  );
};
