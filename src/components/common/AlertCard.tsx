import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface AlertCardProps {
  title?: string;
  label?: string; // alias legacy
  items: Array<{
    id: string;
    label: string;
    value?: string | number;
    sublabel?: string;
  }>;
  icon?: LucideIcon;
  variant?: 'warning' | 'danger' | 'info' | 'success';
  emptyMessage?: string;
  maxItems?: number;
  onItemClick?: (id: string) => void;
  onViewAll?: () => void;
}

const alertVariantStyles = {
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    itemHover: 'hover:bg-amber-100'
  },
  danger: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    itemHover: 'hover:bg-red-100'
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    itemHover: 'hover:bg-sky-100'
  },
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    itemHover: 'hover:bg-emerald-100'
  }
};

export const AlertCard: React.FC<AlertCardProps> = ({
  title,
  label,
  items,
  icon: Icon,
  variant = 'warning',
  emptyMessage = 'Sin alertas',
  maxItems = 5,
  onItemClick,
  onViewAll
}) => {
  const displayTitle = title || label || '';
  const styles = alertVariantStyles[variant];
  const displayItems = items.slice(0, maxItems);
  const hasMore = items.length > maxItems;

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && (
          <div className={`${styles.iconBg} p-1.5 rounded`}>
            <Icon className={`h-4 w-4 ${styles.iconColor}`} />
          </div>
        )}
        <h3 className="font-medium text-slate-900">{displayTitle}</h3>
        {items.length > 0 && (
          <span className={`ml-auto text-xs font-medium ${styles.iconColor} ${styles.iconBg} px-2 py-0.5 rounded-full`}>
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-2">{emptyMessage}</p>
      ) : (
        <div className="space-y-1">
          {displayItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-2 rounded ${styles.itemHover} ${onItemClick ? 'cursor-pointer' : ''}`}
              onClick={() => onItemClick?.(item.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{item.label}</p>
                {item.sublabel && (
                  <p className="text-xs text-slate-500 truncate">{item.sublabel}</p>
                )}
              </div>
              {item.value !== undefined && (
                <span className="text-sm font-medium text-slate-700 ml-2 flex-shrink-0">
                  {item.value}
                </span>
              )}
            </div>
          ))}
          {hasMore && onViewAll && (
            <button
              onClick={onViewAll}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-700 py-2"
            >
              Ver {items.length - maxItems} más...
            </button>
          )}
        </div>
      )}
    </div>
  );
};
