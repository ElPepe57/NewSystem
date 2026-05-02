/**
 * useProductosFilters · hook de estado consolidado para filtros de Productos V2
 *
 * Centraliza:
 *   - Pill rápido activo (todos / activos / stock_critico / sin_investigar / packs)
 *   - Date range preset
 *   - Selecciones por chip group (línea, tipo, estado · multi-valor)
 *   - Search term (sincronizado con URL ?buscar=)
 *   - Sort value
 *   - Selección bulk de productos por id
 *
 * Calcula:
 *   - hayFiltrosActivos (boolean)
 *   - chipsActivos (lista para ChipsActivos component)
 *   - reset() para limpiar todo
 *
 * NOTA · esta versión NO ejecuta el filtrado en sí (eso vive en ProductosPageV2.tsx
 * con useMemo sobre productos del store). El hook solo maneja state y derivaciones.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DateRangePreset } from './FiltrosBar';
import type { PillKey } from './PillsRapidos';
import type { ChipActivo } from './ChipsActivos';

export interface FiltrosState {
  pillActivo: PillKey;
  dateRange: DateRangePreset;
  selecciones: Record<string, string[]>; // { 'linea': ['skincare'], 'tipo': ['pack'] }
  searchTerm: string;
  sortValue: string;
  selectedIds: Set<string>;
}

const DEFAULT_STATE: FiltrosState = {
  pillActivo: 'todos',
  dateRange: 'todo',
  selecciones: {},
  searchTerm: '',
  sortValue: 'mas_vendidos',
  selectedIds: new Set(),
};

export function useProductosFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [pillActivo, setPillActivo] = useState<PillKey>('todos');
  const [dateRange, setDateRange] = useState<DateRangePreset>('todo');
  const [selecciones, setSelecciones] = useState<Record<string, string[]>>({});
  const [searchTerm, setSearchTermState] = useState<string>(searchParams.get('buscar') ?? '');
  const [sortValue, setSortValue] = useState<string>('mas_vendidos');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sync URL ?buscar= con searchTerm
  const setSearchTerm = useCallback(
    (term: string) => {
      setSearchTermState(term);
      const next = new URLSearchParams(searchParams);
      if (term.trim()) {
        next.set('buscar', term);
      } else {
        next.delete('buscar');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Sync inicial al montar (caso entrar con URL ya con ?buscar=)
  useEffect(() => {
    const fromUrl = searchParams.get('buscar') ?? '';
    if (fromUrl !== searchTerm) {
      setSearchTermState(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle chip dentro de un grupo
  const toggleChip = useCallback((groupKey: string, value: string) => {
    setSelecciones(prev => {
      const current = prev[groupKey] ?? [];
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      const updated = { ...prev };
      if (next.length === 0) {
        delete updated[groupKey];
      } else {
        updated[groupKey] = next;
      }
      return updated;
    });
  }, []);

  const removeChip = useCallback((groupKey: string, value: string) => {
    setSelecciones(prev => {
      const current = prev[groupKey] ?? [];
      const next = current.filter(v => v !== value);
      const updated = { ...prev };
      if (next.length === 0) {
        delete updated[groupKey];
      } else {
        updated[groupKey] = next;
      }
      return updated;
    });
  }, []);

  // Reset global
  const reset = useCallback(() => {
    setPillActivo('todos');
    setDateRange('todo');
    setSelecciones({});
    setSearchTerm('');
    setSortValue('mas_vendidos');
    // selectedIds NO se resetea aquí · es selección de bulk, vive aparte
  }, [setSearchTerm]);

  // Bulk selection helpers
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const setManyselected = useCallback((ids: string[]) => setSelectedIds(new Set(ids)), []);

  // Indicador booleano de si hay algo aplicado (excluye pillActivo='todos' y selectedIds)
  const hayFiltrosActivos = useMemo(() => {
    if (dateRange !== 'todo') return true;
    if (Object.keys(selecciones).length > 0) return true;
    if (searchTerm.trim().length > 0) return true;
    return false;
  }, [dateRange, selecciones, searchTerm]);

  // Builder de chips activos para mostrar en el banner
  const buildChipsActivos = useCallback(
    (
      chipLabels: Record<string, Record<string, { label: string; color: ChipActivo['color'] }>>,
      dateRangeLabel?: string
    ): ChipActivo[] => {
      const chips: ChipActivo[] = [];

      if (dateRange !== 'todo') {
        chips.push({
          key: 'date',
          label: dateRangeLabel ?? `Rango: ${dateRange}`,
          color: 'teal',
          onRemove: () => setDateRange('todo'),
        });
      }

      Object.entries(selecciones).forEach(([groupKey, values]) => {
        values.forEach(value => {
          const meta = chipLabels[groupKey]?.[value];
          chips.push({
            key: `${groupKey}:${value}`,
            label: meta?.label ?? `${groupKey}: ${value}`,
            color: meta?.color ?? 'slate',
            onRemove: () => removeChip(groupKey, value),
          });
        });
      });

      if (searchTerm.trim()) {
        chips.push({
          key: 'search',
          label: `Buscar: "${searchTerm}"`,
          color: 'slate',
          onRemove: () => setSearchTerm(''),
        });
      }

      return chips;
    },
    [dateRange, selecciones, searchTerm, removeChip, setSearchTerm]
  );

  return {
    // state
    pillActivo,
    dateRange,
    selecciones,
    searchTerm,
    sortValue,
    selectedIds,

    // setters
    setPillActivo,
    setDateRange,
    toggleChip,
    removeChip,
    setSearchTerm,
    setSortValue,

    // bulk
    toggleSelected,
    clearSelection,
    setManyselected,

    // derivaciones
    hayFiltrosActivos,
    buildChipsActivos,
    reset,
  };
}

export { DEFAULT_STATE as DEFAULT_FILTROS };
