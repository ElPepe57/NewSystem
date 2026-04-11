import React from 'react';
import { Search, SlidersHorizontal, LayoutGrid, List } from 'lucide-react';
import { cn } from '../utils';
import { text, radius, border, transition } from '../tokens';

interface ToolbarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  filterCount?: number;
  onFilterToggle?: () => void;
  viewMode?: 'table' | 'card';
  onViewModeChange?: (mode: 'table' | 'card') => void;
  actions?: React.ReactNode;
  resultCount?: number;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Toolbar — Barra de herramientas debajo del header.
 * Busqueda + filtros + toggle vista + acciones.
 */
export const Toolbar: React.FC<ToolbarProps> = ({
  search, filterCount, onFilterToggle, viewMode, onViewModeChange,
  actions, resultCount, children, className,
}) => (
  <div className={cn('bg-white', border.default, radius.md, 'p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3', className)}>
    {/* Search */}
    {search && (
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search.value}
          onChange={e => search.onChange(e.target.value)}
          placeholder={search.placeholder || 'Buscar...'}
          className={cn('w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border-0', radius.sm, 'focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none', transition.fast)}
        />
      </div>
    )}

    {children}

    <div className="flex items-center gap-2 flex-shrink-0">
      {/* Result count */}
      {resultCount !== undefined && (
        <span className={cn(text.caption, 'hidden sm:inline')}>{resultCount} resultados</span>
      )}

      {/* Filter toggle */}
      {onFilterToggle && (
        <button
          onClick={onFilterToggle}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium', radius.sm, transition.fast,
            filterCount ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filtros</span>
          {!!filterCount && (
            <span className="ml-1 w-5 h-5 bg-teal-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </button>
      )}

      {/* View toggle */}
      {viewMode && onViewModeChange && (
        <div className={cn('flex', radius.sm, 'border border-slate-200 overflow-hidden')}>
          <button
            onClick={() => onViewModeChange('table')}
            className={cn('p-2', transition.fast, viewMode === 'table' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600')}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('card')}
            className={cn('p-2', transition.fast, viewMode === 'card' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Actions */}
      {actions}
    </div>
  </div>
);
