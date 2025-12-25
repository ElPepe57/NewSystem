import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    label?: string;
    isPositiveGood?: boolean; // default true
  };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const variantStyles = {
  default: {
    bg: 'bg-white',
    border: 'border-gray-200',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600'
  },
  success: {
    bg: 'bg-white',
    border: 'border-green-200',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600'
  },
  warning: {
    bg: 'bg-white',
    border: 'border-yellow-200',
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600'
  },
  danger: {
    bg: 'bg-white',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600'
  },
  info: {
    bg: 'bg-white',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600'
  }
};

const sizeStyles = {
  sm: {
    padding: 'p-3',
    iconSize: 'h-8 w-8',
    iconInner: 'h-4 w-4',
    valueSize: 'text-xl',
    titleSize: 'text-xs'
  },
  md: {
    padding: 'p-4',
    iconSize: 'h-10 w-10',
    iconInner: 'h-5 w-5',
    valueSize: 'text-2xl',
    titleSize: 'text-sm'
  },
  lg: {
    padding: 'p-5',
    iconSize: 'h-12 w-12',
    iconInner: 'h-6 w-6',
    valueSize: 'text-3xl',
    titleSize: 'text-base'
  }
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  trend,
  variant = 'default',
  size = 'md',
  onClick
}) => {
  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return TrendingUp;
    if (trend.value < 0) return TrendingDown;
    return Minus;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    const isPositiveGood = trend.isPositiveGood !== false;
    if (trend.value > 0) return isPositiveGood ? 'text-green-600' : 'text-red-600';
    if (trend.value < 0) return isPositiveGood ? 'text-red-600' : 'text-green-600';
    return 'text-gray-500';
  };

  const TrendIcon = getTrendIcon();

  return (
    <div
      className={`
        ${styles.bg} ${styles.border} border rounded-lg ${sizes.padding}
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`${sizes.titleSize} font-medium text-gray-500 truncate`}>
            {title}
          </p>
          <p className={`${sizes.valueSize} font-bold text-gray-900 mt-1`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={`flex items-center mt-2 ${getTrendColor()}`}>
              {TrendIcon && <TrendIcon className="h-3 w-3 mr-1" />}
              <span className="text-xs font-medium">
                {trend.value > 0 ? '+' : ''}{trend.value}%
                {trend.label && <span className="text-gray-500 ml-1">{trend.label}</span>}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`${sizes.iconSize} ${styles.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 ml-3`}>
            <Icon className={`${sizes.iconInner} ${iconColor || styles.iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
};

// Componente para mostrar un grid de KPIs
export interface KPIGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
}

export const KPIGrid: React.FC<KPIGridProps> = ({ children, columns = 4 }) => {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {children}
    </div>
  );
};

// Componente para alertas/items destacados
export interface AlertCardProps {
  title: string;
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
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    itemHover: 'hover:bg-yellow-100'
  },
  danger: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    itemHover: 'hover:bg-red-100'
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    itemHover: 'hover:bg-blue-100'
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    itemHover: 'hover:bg-green-100'
  }
};

export const AlertCard: React.FC<AlertCardProps> = ({
  title,
  items,
  icon: Icon,
  variant = 'warning',
  emptyMessage = 'Sin alertas',
  maxItems = 5,
  onItemClick,
  onViewAll
}) => {
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
        <h3 className="font-medium text-gray-900">{title}</h3>
        {items.length > 0 && (
          <span className={`ml-auto text-xs font-medium ${styles.iconColor} ${styles.iconBg} px-2 py-0.5 rounded-full`}>
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-2">{emptyMessage}</p>
      ) : (
        <div className="space-y-1">
          {displayItems.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-2 rounded ${styles.itemHover} ${onItemClick ? 'cursor-pointer' : ''}`}
              onClick={() => onItemClick?.(item.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                {item.sublabel && (
                  <p className="text-xs text-gray-500 truncate">{item.sublabel}</p>
                )}
              </div>
              {item.value !== undefined && (
                <span className="text-sm font-medium text-gray-700 ml-2 flex-shrink-0">
                  {item.value}
                </span>
              )}
            </div>
          ))}
          {hasMore && onViewAll && (
            <button
              onClick={onViewAll}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Ver {items.length - maxItems} más...
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Componente para estadísticas con distribución
export interface StatDistributionProps {
  title: string;
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  total?: number;
  showPercentage?: boolean;
}

export const StatDistribution: React.FC<StatDistributionProps> = ({
  title,
  data,
  total: providedTotal,
  showPercentage = true
}) => {
  const total = providedTotal || data.reduce((sum, item) => sum + item.value, 0);

  const defaultColors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500'
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">{title}</h3>

      {/* Barra de distribución */}
      <div className="h-2 flex rounded-full overflow-hidden bg-gray-100 mb-3">
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          if (percentage === 0) return null;
          return (
            <div
              key={item.label}
              className={item.color || defaultColors[index % defaultColors.length]}
              style={{ width: `${percentage}%` }}
            />
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="grid grid-cols-2 gap-2">
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded ${item.color || defaultColors[index % defaultColors.length]}`} />
              <span className="text-xs text-gray-600 truncate flex-1">{item.label}</span>
              <span className="text-xs font-medium text-gray-900">
                {item.value}
                {showPercentage && total > 0 && (
                  <span className="text-gray-500 ml-1">({percentage.toFixed(0)}%)</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
