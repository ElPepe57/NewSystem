import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../utils';
import { text, border, radius } from '../tokens';

interface ContentAreaProps<T> {
  items: T[];
  viewMode: 'table' | 'card';
  tableComponent: React.ComponentType<{ items: T[] }>;
  cardComponent: React.ComponentType<{ item: T; onClick?: () => void }>;
  cardColumns?: 1 | 2 | 3 | 4;
  loading?: boolean;
  onItemClick?: (item: T) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
  className?: string;
}

/**
 * ContentArea — Wrapper que maneja toggle tabla/cards + loading + empty state.
 */
export function ContentArea<T>({
  items, viewMode, tableComponent: Table, cardComponent: Card,
  cardColumns = 3, loading, onItemClick, emptyTitle, emptyMessage,
  keyExtractor, className,
}: ContentAreaProps<T>) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className={cn('bg-white', border.default, radius.md, 'p-5 animate-pulse')}>
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
            <div className="h-3 bg-slate-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn('bg-white', border.default, radius.md, 'py-16 text-center')}>
        <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className={text.bodyStrong}>{emptyTitle || 'Sin resultados'}</p>
        <p className={cn(text.caption, 'mt-1')}>{emptyMessage || 'No se encontraron elementos con los filtros actuales.'}</p>
      </div>
    );
  }

  if (viewMode === 'table') {
    return (
      <div className={cn('bg-white', border.default, radius.md, 'overflow-hidden', className)}>
        <Table items={items} />
      </div>
    );
  }

  const colsMap = { 1: 'grid-cols-1', 2: 'grid-cols-1 md:grid-cols-2', 3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' };

  return (
    <div className={cn('grid gap-4', colsMap[cardColumns], className)}>
      {items.map(item => (
        <Card key={keyExtractor(item)} item={item} onClick={onItemClick ? () => onItemClick(item) : undefined} />
      ))}
    </div>
  );
}
