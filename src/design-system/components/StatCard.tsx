import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../utils';
import { text, border, radius, transition, statusColors } from '../tokens';
import type { StatusVariant } from '../tokens';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
    isPositiveGood?: boolean;
  };
  variant?: StatusVariant;
  size?: 'sm' | 'md';
  onClick?: () => void;
  active?: boolean;
  className?: string;
  // Aliases legacy para compat con consumidores antiguos
  subtitle?: string;
  subtext?: string;
  bgColor?: string;
  textColor?: string;
}

/**
 * StatCard — UNA sola stat card unificada.
 * Reemplaza KPICard, StatCard (ProfessionalUI), QuickStatRow.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label, value, icon: Icon, trend, variant = 'neutral',
  size = 'md', onClick, active, className,
  subtitle, subtext,
}) => {
  const subText = subtitle || subtext;
  const colors = statusColors[variant] || statusColors.neutral;
  const isClickable = !!onClick;
  const trendPositive = trend && trend.value > 0;
  const trendNegative = trend && trend.value < 0;
  const trendGood = trend?.isPositiveGood !== false ? trendPositive : trendNegative;

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white', border.default, radius.md, transition.fast,
        'border-l-4',
        active ? `${colors.bg} border-l-${variant === 'brand' ? 'teal' : variant === 'neutral' ? 'slate' : variant === 'success' ? 'emerald' : variant === 'warning' ? 'amber' : variant === 'danger' ? 'red' : 'sky'}-500` : 'border-l-transparent',
        isClickable && 'cursor-pointer hover:shadow-md',
        size === 'sm' ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className={text.label}>{label}</p>
          <p className={cn(size === 'sm' ? text.metricSm : text.metric, 'mt-1')}>
            {typeof value === 'number' ? value.toLocaleString('es-PE') : value}
          </p>
          {subText && <p className={cn(text.caption, 'mt-0.5 truncate')}>{subText}</p>}
        </div>
        {Icon && (
          <div className={cn('flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center', colors.bg)}>
            <Icon className={cn('w-4.5 h-4.5', colors.text)} />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-2 flex items-center gap-1">
          {trendPositive ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : trendNegative ? <TrendingDown className="w-3.5 h-3.5 text-red-500" /> : null}
          <span className={cn('text-xs font-medium', trendGood ? 'text-emerald-600' : 'text-red-600')}>
            {trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%
          </span>
          {trend.label && <span className={text.caption}>{trend.label}</span>}
        </div>
      )}
    </div>
  );
};
