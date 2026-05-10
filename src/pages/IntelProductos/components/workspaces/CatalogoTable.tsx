/**
 * CatalogoTable · grid-12 canon Productos · density-first
 *
 * chk5.B7 (S3.6 M1.bis · Cost Intelligence) · refactor pixel-perfect contra
 * canon Productos V2. Reemplaza tabla HTML por grid-12 divs (canon F4).
 *
 * COLUMNAS (grid 12 cols):
 *   col-1  checkbox
 *   col-4  Producto · avatar gradient (canon) + nombre + sub-info (sku · marca · línea · estado)
 *   col-2  Costo unit. (S/ + $USD · TC)
 *   col-2  Margen % + sparkline mini inline + utilidad/u
 *   col-2  Trend 90d (sparkline real cuando haya histórico · placeholder gris MVP)
 *   col-1  Score pill (verde/amber/rose)
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Sec 1
 */

import React from 'react';
import { ChevronUp, ChevronDown, AlertCircle, Search as SearchIcon } from 'lucide-react';
import { ProductoAvatar, inferLineaFromProducto } from '../../../Productos/components/shared/ProductoAvatar';
import { SparklineMini } from '../../../Productos/components/shared/SparklineMini';
import type { ProductoEnriquecido, SortKey, SortDir } from './CatalogoWorkspace';

interface CatalogoTableProps {
  enriquecidos: ProductoEnriquecido[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  seleccionadoId: string | null;
  onSelect: (item: ProductoEnriquecido) => void;
}

const fmtPEN = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSD = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString('es-PE');

function scoreClasses(score: number): string {
  if (score >= 70) return 'bg-emerald-100 text-emerald-700';
  if (score >= 40) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
}

function margenClasses(margenPct: number | null): string {
  if (margenPct === null) return 'text-slate-400';
  if (margenPct >= 30) return 'text-emerald-600';
  if (margenPct >= 20) return 'text-emerald-600';
  if (margenPct >= 10) return 'text-amber-600';
  return 'text-rose-600';
}

function lineaBadgeClasses(linea: string | undefined): string {
  const code = (linea ?? '').toLowerCase();
  if (code.includes('skin')) return 'bg-amber-50 text-amber-700';
  if (code.includes('sup') || code.includes('vita') || code.includes('cap')) return 'bg-indigo-50 text-indigo-700';
  if (code.includes('well') || code.includes('aloe')) return 'bg-emerald-50 text-emerald-700';
  return 'bg-slate-50 text-slate-600';
}

/** Genera una serie mock determinística de 7 puntos basada en margen actual.
 *  Cuando haya histórico real de costos, reemplazar por la serie verdadera. */
function generarTrendSerie(score: number, margen: number | null): number[] {
  if (margen === null) return [];
  const base = margen;
  const seed = score / 100;
  // Trend ascendente si score alto · plano si medio · descendente si bajo
  const dir = score >= 70 ? 1 : score >= 40 ? 0 : -1;
  return Array.from({ length: 7 }, (_, i) => base + (i * 0.4 * dir * seed));
}

export const CatalogoTable: React.FC<CatalogoTableProps> = ({
  enriquecidos,
  sortKey,
  sortDir,
  onSort,
  seleccionadoId,
  onSelect,
}) => {
  if (enriquecidos.length === 0) {
    return (
      <div className="p-12 text-center">
        <SearchIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No hay productos que coincidan con los filtros</p>
      </div>
    );
  }

  return (
    <>
      {/* Header tabla · grid 12 cols canon */}
      <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        <div className="col-span-1"><input type="checkbox" className="rounded border-slate-300 text-teal-600 w-3.5 h-3.5" /></div>
        <SortHeader label="Producto" k="nombre" align="left" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="col-span-4" />
        <SortHeader label="Costo unit." k="costo" align="right" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="col-span-2" />
        <SortHeader label="Margen" k="margen" align="right" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="col-span-2" />
        <div className="col-span-2 text-center">Trend 90d</div>
        <SortHeader label="Score" k="score" align="center" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="col-span-1" />
      </div>

      {/* Cuerpo · divide-y canon */}
      <div className="divide-y divide-slate-100">
        {enriquecidos.map((item) => {
          const p = item.producto;
          const isSelected = seleccionadoId === p.id;
          const isInactive = p.estado !== 'activo';
          const linea = inferLineaFromProducto({
            linea: p.lineaNegocioNombre,
            tipo: p.tipoProducto?.nombre,
            esPack: p.esPack,
          });
          const trendSerie = generarTrendSerie(item.score, item.margenPct);
          const trendColor = item.score >= 70 ? '#10b981' : item.score >= 40 ? '#f59e0b' : '#e11d48';

          return (
            <div
              key={p.id}
              onClick={() => onSelect(item)}
              className={`grid grid-cols-12 gap-3 items-center px-4 py-3 cursor-pointer group transition-colors ${
                isSelected
                  ? 'bg-teal-50/60 ring-1 ring-teal-200'
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
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {p.nombreComercial ?? '—'}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 flex-wrap">
                    <span className="font-mono">{p.sku ?? '—'}</span>
                    {p.marca && (
                      <>
                        <span>·</span>
                        <span className="text-slate-600 font-medium truncate">{p.marca}</span>
                      </>
                    )}
                    {p.lineaNegocioNombre && (
                      <>
                        <span>·</span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${lineaBadgeClasses(p.lineaNegocioNombre)}`}>
                          {p.lineaNegocioNombre}
                        </span>
                      </>
                    )}
                    {!item.tieneInvestigacion && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold flex items-center gap-0.5">
                        <SearchIcon className="w-2.5 h-2.5" />
                        Sin investigar
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* col-2 Costo unit. */}
              <div className="col-span-2 text-right">
                {item.tieneInvestigacion ? (
                  <>
                    <div className="text-sm font-semibold text-slate-900 tabular-nums">
                      S/ {fmtPEN(item.costoPEN).split('.')[0]}
                      <span className="text-slate-400">.{fmtPEN(item.costoPEN).split('.')[1]}</span>
                    </div>
                    {item.costoUSD > 0 && (
                      <div className="text-[10px] text-slate-500 tabular-nums">$ {fmtUSD(item.costoUSD)} · TC {item.tc.toFixed(2)}</div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-slate-400 tabular-nums italic">—</div>
                    <div className="text-[10px] text-amber-600">Sin proveedor</div>
                  </>
                )}
              </div>

              {/* col-2 Margen + sparkline mini inline + utilidad */}
              <div className="col-span-2 text-right">
                {item.margenPct !== null ? (
                  <>
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-sm font-semibold tabular-nums ${margenClasses(item.margenPct)}`}>
                        {item.margenPct.toFixed(1)}%
                      </span>
                      <SparklineMini
                        values={trendSerie}
                        color={trendColor}
                        width={32}
                        height={14}
                        strokeWidth={1.5}
                      />
                    </div>
                    {item.utilidad !== null && (
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        S/ {fmtPEN(item.utilidad)}/u
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm font-semibold text-slate-400 tabular-nums italic">—</div>
                )}
              </div>

              {/* col-2 Trend 90d · sparkline o placeholder */}
              <div className="col-span-2 text-center">
                {item.tieneInvestigacion && trendSerie.length >= 2 ? (
                  <SparklineMini
                    values={trendSerie}
                    color={trendColor}
                    width={80}
                    height={16}
                    strokeWidth={1.5}
                    className="inline"
                  />
                ) : (
                  <span
                    className="inline-block w-20 h-3 bg-slate-100 rounded"
                    title="Sin data histórica · requiere ≥2 OCs"
                  />
                )}
              </div>

              {/* col-1 Score pill canon */}
              <div className="col-span-1 text-center">
                <span
                  className={`inline-flex items-center justify-center min-w-[28px] h-6 rounded-full font-bold tabular-nums text-[10px] ${scoreClasses(item.score)}`}
                >
                  {item.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer info · canon Productos */}
      <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-200 text-[10px] text-slate-500 tabular-nums flex items-center justify-between">
        <span>
          {fmtInt(enriquecidos.length)} productos · score promedio:{' '}
          <span className="font-semibold text-slate-700">
            {Math.round(enriquecidos.reduce((s, e) => s + e.score, 0) / enriquecidos.length)}
          </span>
        </span>
        {enriquecidos.some((e) => !e.tieneInvestigacion) && (
          <span className="flex items-center gap-1 text-amber-700">
            <AlertCircle className="w-3 h-3" />
            {fmtInt(enriquecidos.filter((e) => !e.tieneInvestigacion).length)} sin investigar
          </span>
        )}
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

const SortHeader: React.FC<SortHeaderProps> = ({ label, k, align, sortKey, sortDir, onSort, className = '' }) => {
  const isActive = sortKey === k;
  const justifyClass = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      className={`${className} flex items-center gap-0.5 ${justifyClass} hover:text-slate-900 ${isActive ? 'text-slate-900' : ''} select-none`}
    >
      {label}
      {isActive && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  );
};
