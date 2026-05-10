/**
 * CatalogoTable · tabla densa Bloomberg-grade · Cost Intelligence
 *
 * Aplica F4 (canon) · este es uno de los 3 casos donde la tabla SE PERMITE
 * (vs cards apiladas): "catálogos densos" con 12+ columnas y 100+ filas.
 *
 * Características canon:
 *   - tabular-nums obligatorio en todas las celdas numéricas
 *   - density-row hover (sin shadow)
 *   - Headers sorteables con cursor pointer
 *   - Score badge color-coded (rojo/amber/verde según rango)
 *   - Sparklines DIFERIDAS hasta tener histórico (placeholder gris)
 *   - Row click → selecciona (drill-down se abre en pane derecha)
 */

import React from 'react';
import { ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
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
const fmtInt = (n: number) => n.toLocaleString('es-PE');

function scoreClasses(score: number): string {
  if (score >= 70) return 'bg-emerald-100 text-emerald-700';
  if (score >= 40) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
}

function margenClasses(margenPct: number | null): string {
  if (margenPct === null) return 'text-slate-400';
  if (margenPct >= 30) return 'text-emerald-700 font-bold';
  if (margenPct >= 20) return 'text-emerald-600';
  if (margenPct >= 10) return 'text-amber-600';
  return 'text-rose-600 font-bold';
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
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No hay productos que coincidan con los filtros</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-[11px] leading-tight">
        <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
          <tr>
            <SortHeader label="SKU" align="left" k="sku" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Producto" align="left" k="nombre" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Costo unit." align="right" k="costo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Precio venta" align="right" k="precio" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Margen" align="right" k="margen" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <th className="text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2 py-2">
              Trend 90d
            </th>
            <SortHeader label="Score" align="center" k="score" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {enriquecidos.map((item) => {
            const p = item.producto;
            const isSelected = seleccionadoId === p.id;
            const isInactive = p.estado !== 'activo';
            return (
              <tr
                key={p.id}
                onClick={() => onSelect(item)}
                className={`
                  cursor-pointer transition-colors border-b border-slate-50
                  ${isSelected ? 'bg-teal-50/60 ring-1 ring-teal-200' : 'hover:bg-slate-50'}
                  ${isInactive ? 'opacity-60' : ''}
                `.replace(/\s+/g, ' ').trim()}
              >
                {/* SKU */}
                <td className="px-2 py-2 font-mono text-slate-700 font-semibold whitespace-nowrap">
                  {p.sku ?? '—'}
                </td>
                {/* Producto · nombre + marca */}
                <td className="px-2 py-2 min-w-[200px]">
                  <div className="font-semibold text-slate-900 truncate">{p.nombreComercial ?? '—'}</div>
                  <div className="text-[9px] text-slate-500 truncate">
                    {p.marca ?? '—'}
                    {p.lineaNegocioNombre ? ` · ${p.lineaNegocioNombre}` : ''}
                  </div>
                </td>
                {/* Costo unit. */}
                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                  {item.tieneInvestigacion ? (
                    <span className="font-semibold text-slate-900">S/ {fmtPEN(item.costoPEN)}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                {/* Precio venta */}
                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                  {item.precioEfectivo > 0 ? (
                    <span className="font-semibold text-slate-900">S/ {fmtPEN(item.precioEfectivo)}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                {/* Margen */}
                <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${margenClasses(item.margenPct)}`}>
                  {item.margenPct !== null ? `${item.margenPct.toFixed(1)}%` : '—'}
                </td>
                {/* Trend 90d · placeholder · cuando haya histórico se conecta */}
                <td className="px-2 py-2 text-center">
                  <span className="inline-block w-16 h-3 bg-slate-100 rounded" title="Sparkline pendiente · requiere histórico de costos" />
                </td>
                {/* Score */}
                <td className="px-2 py-2 text-center">
                  <span className={`inline-flex items-center justify-center min-w-[28px] h-6 rounded-full font-bold tabular-nums text-[10px] ${scoreClasses(item.score)}`}>
                    {item.score}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-slate-50 border-t border-slate-200">
          <tr>
            <td colSpan={7} className="px-3 py-2 text-[10px] text-slate-500 tabular-nums">
              {fmtInt(enriquecidos.length)} productos · Score promedio:{' '}
              <span className="font-semibold text-slate-700">
                {enriquecidos.length > 0
                  ? Math.round(enriquecidos.reduce((s, e) => s + e.score, 0) / enriquecidos.length)
                  : 0}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

interface SortHeaderProps {
  label: string;
  k: SortKey;
  align: 'left' | 'right' | 'center';
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}

const SortHeader: React.FC<SortHeaderProps> = ({ label, k, align, sortKey, sortDir, onSort }) => {
  const isActive = sortKey === k;
  const alignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  const justifyClass = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';
  return (
    <th className={`${alignClass} text-[9px] font-bold text-slate-500 uppercase tracking-wider px-2 py-2 select-none`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`flex items-center gap-0.5 ${justifyClass} w-full hover:text-slate-900 ${isActive ? 'text-slate-900' : ''}`}
      >
        {label}
        {isActive && (sortDir === 'asc'
          ? <ChevronUp className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3" />
        )}
      </button>
    </th>
  );
};
