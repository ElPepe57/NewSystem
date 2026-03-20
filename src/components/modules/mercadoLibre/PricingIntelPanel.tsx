/**
 * Panel principal de Pricing Inteligente para MercadoLibre.
 * Compone KPIs, filtros, tabla/cards, detalle modal, y editor masivo.
 * Trabaja con productos agrupados (MLProductGroup) en vez de listings individuales.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Trophy,
  AlertTriangle,
  Link2,
  Search,
  Loader2,
} from 'lucide-react';
import { groupProductMaps } from '../../../store/mercadoLibreStore';
import { useCTRUStore } from '../../../store/ctruStore';
import { KPICard, KPIGrid } from '../../common/KPICard';
import { PricingIntelTable } from './PricingIntelTable';
import { PricingIntelCard } from './PricingIntelCard';
import { PricingDetailModal } from './PricingDetailModal';
import { BulkPriceEditor } from './BulkPriceEditor';
import type { MLProductMap } from '../../../types/mercadoLibre.types';
import {
  buildPricingIntelRows,
  computeKPIs,
  filterRows,
  sortRows,
  fmtPct,
  type PricingIntelRow,
  type MarginFilter,
  type BuyBoxFilter,
  type VinculadoFilter,
  type SortField,
  type SortDir,
} from './pricingIntel.utils';

interface PricingIntelPanelProps {
  productMaps: MLProductMap[];
}

const MARGIN_FILTERS: { id: MarginFilter; label: string; shortLabel: string }[] = [
  { id: 'todos', label: 'Todos', shortLabel: 'Todos' },
  { id: 'negativo', label: 'Negativo', shortLabel: 'Neg.' },
  { id: 'critico', label: 'Crítico (<10%)', shortLabel: '<10%' },
  { id: 'bajo', label: 'Bajo (10-20%)', shortLabel: '10-20%' },
  { id: 'saludable', label: 'Saludable (>20%)', shortLabel: '>20%' },
];

const BUYBOX_FILTERS: { id: BuyBoxFilter; label: string; shortLabel: string }[] = [
  { id: 'todos', label: 'Todos', shortLabel: 'Todos' },
  { id: 'winning', label: 'Ganando', shortLabel: 'Win' },
  { id: 'competing', label: 'Perdiendo', shortLabel: 'Lose' },
  { id: 'sharing_first_place', label: 'Compartido', shortLabel: 'Share' },
];

export const PricingIntelPanel: React.FC<PricingIntelPanelProps> = ({ productMaps }) => {
  // CTRU data
  const { productosDetalle, loading: ctruLoading, fetchAll } = useCTRUStore();

  // Filters
  const [search, setSearch] = useState('');
  const [marginFilter, setMarginFilter] = useState<MarginFilter>('todos');
  const [buyBoxFilter, setBuyBoxFilter] = useState<BuyBoxFilter>('todos');
  const [vinculadoFilter, setVinculadoFilter] = useState<VinculadoFilter>('todos');
  const [sortField, setSortField] = useState<SortField>('margen');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Selection uses groupKey
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailRow, setDetailRow] = useState<PricingIntelRow | null>(null);

  // Load CTRU data on mount
  useEffect(() => {
    if (productosDetalle.length === 0 && !ctruLoading) {
      fetchAll();
    }
  }, [productosDetalle.length, ctruLoading, fetchAll]);

  // Group productMaps → MLProductGroup[]
  const productGroups = useMemo(() => groupProductMaps(productMaps), [productMaps]);

  // Build joined rows from groups
  const allRows = useMemo(
    () => buildPricingIntelRows(productGroups, productosDetalle),
    [productGroups, productosDetalle]
  );

  // KPIs from all rows (unfiltered)
  const kpis = useMemo(() => computeKPIs(allRows), [allRows]);

  // Filtered + sorted
  const displayRows = useMemo(() => {
    const filtered = filterRows(allRows, search, marginFilter, buyBoxFilter, vinculadoFilter);
    return sortRows(filtered, sortField, sortDir);
  }, [allRows, search, marginFilter, buyBoxFilter, vinculadoFilter, sortField, sortDir]);

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    setSortDir((prev) => (sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortField(field);
  }, [sortField]);

  // Selection handlers (using groupKey)
  const handleToggleSelect = useCallback((groupKey: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allKeys = displayRows.map((r) => r.groupKey);
      const allSelected = allKeys.every((key) => prev.has(key));
      if (allSelected) return new Set();
      return new Set(allKeys);
    });
  }, [displayRows]);

  // Get selected rows for bulk editor
  const selectedRows = useMemo(
    () => allRows.filter((r) => selectedIds.has(r.groupKey)),
    [allRows, selectedIds]
  );

  if (ctruLoading && productosDetalle.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando datos de costos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <KPIGrid columns={4}>
        <KPICard
          title="Margen Promedio"
          value={kpis.margenPromedio != null ? fmtPct(kpis.margenPromedio) : '—'}
          icon={TrendingUp}
          variant={
            kpis.margenPromedio == null ? 'default' :
            kpis.margenPromedio < 10 ? 'danger' :
            kpis.margenPromedio < 20 ? 'warning' : 'success'
          }
          size="sm"
        />
        <KPICard
          title="Buy Box Ganando"
          value={`${kpis.buyBoxGanando} / ${kpis.buyBoxTotal}`}
          subtitle={kpis.buyBoxTotal > 0 ? `${((kpis.buyBoxGanando / kpis.buyBoxTotal) * 100).toFixed(0)}% del catálogo` : 'Sin catálogo'}
          icon={Trophy}
          variant={kpis.buyBoxTotal === 0 ? 'default' : kpis.buyBoxGanando === kpis.buyBoxTotal ? 'success' : 'warning'}
          size="sm"
        />
        <KPICard
          title="Precio < Costo"
          value={kpis.precioMenorCosto}
          subtitle={kpis.precioMenorCosto > 0 ? 'Productos perdiendo dinero' : 'Todos rentables'}
          icon={AlertTriangle}
          variant={kpis.precioMenorCosto > 0 ? 'danger' : 'success'}
          size="sm"
        />
        <KPICard
          title="Vinculados"
          value={`${kpis.vinculados} / ${kpis.total}`}
          subtitle={kpis.total > 0 ? `${((kpis.vinculados / kpis.total) * 100).toFixed(0)}% con datos de costo` : ''}
          icon={Link2}
          variant={kpis.vinculados === kpis.total ? 'success' : 'info'}
          size="sm"
        />
      </KPIGrid>

      {/* Filters toolbar */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-48 pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Margin filter */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
            {MARGIN_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setMarginFilter(f.id)}
                className={`px-2 py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-colors ${
                  marginFilter === f.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="sm:hidden">{f.shortLabel}</span>
                <span className="hidden sm:inline">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Buy Box filter + Vinculado filter */}
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
            {BUYBOX_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setBuyBoxFilter(f.id)}
                className={`px-2 py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-colors ${
                  buyBoxFilter === f.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="sm:hidden">{f.shortLabel}</span>
                <span className="hidden sm:inline">{f.label}</span>
              </button>
            ))}
          </div>

          <select
            value={vinculadoFilter}
            onChange={(e) => setVinculadoFilter(e.target.value as VinculadoFilter)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-2 focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="todos">Todos</option>
            <option value="vinculados">Vinculados</option>
            <option value="sin_vincular">Sin vincular</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400">
        {displayRows.length} producto{displayRows.length !== 1 ? 's' : ''}
        {selectedIds.size > 0 && ` · ${selectedIds.size} seleccionado${selectedIds.size !== 1 ? 's' : ''}`}
      </p>

      {/* Desktop table */}
      <div className="hidden md:block">
        <PricingIntelTable
          rows={displayRows}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onOpenDetail={setDetailRow}
        />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {displayRows.map((row) => (
          <PricingIntelCard
            key={row.groupKey}
            row={row}
            selected={selectedIds.has(row.groupKey)}
            onToggleSelect={handleToggleSelect}
            onOpenDetail={setDetailRow}
          />
        ))}
        {displayRows.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No se encontraron productos</p>
        )}
      </div>

      {/* Bulk price editor (floating bar) */}
      {selectedIds.size > 0 && (
        <BulkPriceEditor
          selectedRows={selectedRows}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      )}

      {/* Detail modal */}
      <PricingDetailModal
        isOpen={!!detailRow}
        onClose={() => setDetailRow(null)}
        row={detailRow}
      />
    </div>
  );
};
