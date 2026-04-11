import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '../utils';
import { text, transition } from '../tokens';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
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
}

/**
 * DataTable — Tabla unificada sortable.
 */
export function DataTable<T>({
  columns, data, keyExtractor, onRowClick, sortBy, sortDirection, onSort, compact, className,
}: DataTableProps<T>) {
  const alignClass = (align?: string) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  text.label,
                  alignClass(col.align),
                  compact ? 'px-3 py-2' : 'px-4 py-3',
                  col.sortable && 'cursor-pointer select-none hover:bg-slate-100',
                  col.width,
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
          {data.map(item => (
            <tr
              key={keyExtractor(item)}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={cn(
                'border-b border-slate-100',
                transition.fast,
                onRowClick && 'cursor-pointer hover:bg-slate-50',
              )}
            >
              {columns.map(col => (
                <td key={col.key} className={cn(
                  'text-sm text-slate-700',
                  alignClass(col.align),
                  compact ? 'px-3 py-2' : 'px-4 py-3',
                  col.width,
                )}>
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
