import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '../utils';
import { text, transition } from '../tokens';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  /** Ocultar en mobile (< sm breakpoint) */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  compact?: boolean;
  className?: string;
  /** Estado de carga */
  loading?: boolean;
  /** Cantidad de filas skeleton al cargar */
  loadingRows?: number;
  /** Contenido cuando no hay datos */
  emptyState?: React.ReactNode;
  /** Texto simple cuando no hay datos (alternativa a emptyState) */
  emptyMessage?: string;
  /** Contenido expandible por fila */
  expandedRowRender?: (item: T) => React.ReactNode;
  /** IDs de filas expandidas (controlado externamente) */
  expandedKeys?: Set<string>;
  /** Callback al expandir/colapsar */
  onToggleExpand?: (key: string) => void;
  /** Filas seleccionables con checkbox */
  selectable?: boolean;
  /** Keys seleccionados */
  selectedKeys?: Set<string>;
  /** Callback al seleccionar/deseleccionar */
  onToggleSelect?: (key: string) => void;
  /** Callback al seleccionar/deseleccionar todos */
  onToggleSelectAll?: () => void;
  /** Header sticky */
  stickyHeader?: boolean;
}

/**
 * DataTable — Tabla unificada del design system.
 * Soporta: sorting, loading, empty state, expandable rows,
 * selectable rows, responsive columns, sticky header.
 */
export function DataTable<T>({
  columns, data, keyExtractor, onRowClick, sortBy, sortDirection, onSort,
  compact, className, loading, loadingRows = 5, emptyState, emptyMessage,
  expandedRowRender, expandedKeys, onToggleExpand,
  selectable, selectedKeys, onToggleSelect, onToggleSelectAll,
  stickyHeader,
}: DataTableProps<T>) {
  const alignClass = (align?: string) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';
  const hasExpand = !!expandedRowRender && !!onToggleExpand;
  const allSelected = selectable && data.length > 0 && selectedKeys && data.every(item => selectedKeys.has(keyExtractor(item)));
  const totalCols = columns.length + (hasExpand ? 1 : 0) + (selectable ? 1 : 0);

  // Loading skeleton
  if (loading) {
    return (
      <div className={cn('overflow-x-auto', className)}>
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map(col => (
                <th key={col.key} className={cn(text.label, alignClass(col.align), cellPadding, col.width)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: loadingRows }).map((_, i) => (
              <tr key={i} className="border-b border-slate-100">
                {columns.map(col => (
                  <td key={col.key} className={cellPadding}>
                    <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    if (emptyMessage) {
      return (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr className={cn('bg-slate-50 border-b border-slate-200', stickyHeader && 'sticky top-0 z-10')}>
            {selectable && (
              <th className={cn(cellPadding, 'w-10')}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
              </th>
            )}
            {hasExpand && (
              <th className={cn(cellPadding, 'w-10')} />
            )}
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  text.label,
                  alignClass(col.align),
                  cellPadding,
                  col.sortable && 'cursor-pointer select-none hover:bg-slate-100',
                  col.width,
                  col.hideOnMobile && 'hidden sm:table-cell',
                )}
                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
              >
                <div className={cn('flex items-center gap-1', col.align === 'right' && 'justify-end', col.align === 'center' && 'justify-center')}>
                  {col.header}
                  {col.sortable && (
                    sortBy === col.key
                      ? sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronsUpDown className="w-3 h-3 text-slate-300" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(item => {
            const key = keyExtractor(item);
            const isExpanded = expandedKeys?.has(key);
            const isSelected = selectedKeys?.has(key);

            return (
              <React.Fragment key={key}>
                <tr
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={cn(
                    'border-b border-slate-100',
                    transition.fast,
                    onRowClick && 'cursor-pointer hover:bg-slate-50',
                    isExpanded && 'bg-teal-50/30',
                    isSelected && 'bg-teal-50/50',
                  )}
                >
                  {selectable && (
                    <td className={cn(cellPadding, 'w-10')} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect?.(key)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </td>
                  )}
                  {hasExpand && (
                    <td className={cn(cellPadding, 'w-10')} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onToggleExpand!(key)}
                        className={cn(
                          'p-1 rounded-md transition-colors',
                          isExpanded ? 'bg-teal-100 text-teal-700' : 'hover:bg-slate-100 text-slate-400'
                        )}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} className={cn(
                      'text-sm text-slate-700',
                      alignClass(col.align),
                      cellPadding,
                      col.width,
                      col.hideOnMobile && 'hidden sm:table-cell',
                    )}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
                {hasExpand && isExpanded && (
                  <tr>
                    <td colSpan={totalCols} className="p-0">
                      {expandedRowRender!(item)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
