/**
 * Componentes Avanzados de Visualización para Gestor de Maestros
 * Diseño profesional enterprise-grade con insights de negocio
 */
import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ============================================
// INDICADOR DE SALUD / SCORE
// ============================================

interface HealthScoreProps {
  score: number; // 0-100
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const HealthScore: React.FC<HealthScoreProps> = ({
  score,
  label,
  size = 'md',
  showLabel = true
}) => {
  const getColor = (s: number) => {
    if (s >= 80) return { stroke: 'stroke-green-500', text: 'text-green-600', bg: 'bg-green-50' };
    if (s >= 60) return { stroke: 'stroke-blue-500', text: 'text-blue-600', bg: 'bg-blue-50' };
    if (s >= 40) return { stroke: 'stroke-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (s >= 20) return { stroke: 'stroke-orange-500', text: 'text-orange-600', bg: 'bg-orange-50' };
    return { stroke: 'stroke-red-500', text: 'text-red-600', bg: 'bg-red-50' };
  };

  const sizes = {
    sm: { container: 'w-12 h-12', strokeWidth: 3, fontSize: 'text-xs' },
    md: { container: 'w-16 h-16', strokeWidth: 4, fontSize: 'text-sm' },
    lg: { container: 'w-20 h-20', strokeWidth: 5, fontSize: 'text-base' }
  };

  const colors = getColor(score);
  const sizeConfig = sizes[size];
  const circumference = 2 * Math.PI * 20;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${sizeConfig.container}`}>
        <svg className="transform -rotate-90 w-full h-full" viewBox="0 0 44 44">
          <circle
            cx="22"
            cy="22"
            r="20"
            stroke="currentColor"
            strokeWidth={sizeConfig.strokeWidth}
            fill="transparent"
            className="text-gray-200"
          />
          <circle
            cx="22"
            cy="22"
            r="20"
            strokeWidth={sizeConfig.strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={colors.stroke}
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center ${sizeConfig.fontSize} font-bold ${colors.text}`}>
          {score}
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 mt-1 text-center">{label}</span>
      )}
    </div>
  );
};

// ============================================
// BARRA DE PROGRESO CON ETIQUETAS
// ============================================

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showValues?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  formatValue?: (v: number) => string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  label,
  showValues = true,
  variant = 'default',
  size = 'md',
  formatValue
}) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  const variantColors = {
    default: 'bg-gray-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500'
  };

  const autoVariant = () => {
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  const barColor = variant === 'default' ? variantColors[autoVariant()] : variantColors[variant];
  const barHeight = size === 'sm' ? 'h-1.5' : 'h-2.5';

  const format = formatValue || ((v: number) => v.toLocaleString());

  return (
    <div className="w-full">
      {(label || showValues) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs text-gray-600">{label}</span>}
          {showValues && (
            <span className="text-xs font-medium text-gray-700">
              {format(value)} / {format(max)} ({percentage.toFixed(0)}%)
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${barHeight}`}>
        <div
          className={`${barColor} ${barHeight} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// ============================================
// MINI CHART SPARKLINE (simplificado)
// ============================================

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = '#3B82F6',
  height = 30
}) => {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const width = 100;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
};

// ============================================
// INSIGHT CARD - Información contextual
// ============================================

interface InsightCardProps {
  type: 'positive' | 'negative' | 'warning' | 'neutral';
  title: string;
  description: string;
  metric?: string;
  action?: string;
  onAction?: () => void;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  type,
  title,
  description,
  metric,
  action,
  onAction
}) => {
  const config = {
    positive: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      metricColor: 'text-green-700'
    },
    negative: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: XCircle,
      iconColor: 'text-red-600',
      metricColor: 'text-red-700'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: AlertTriangle,
      iconColor: 'text-yellow-600',
      metricColor: 'text-yellow-700'
    },
    neutral: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: Info,
      iconColor: 'text-blue-600',
      metricColor: 'text-blue-700'
    }
  };

  const { bg, border, icon: Icon, iconColor, metricColor } = config[type];

  return (
    <div className={`${bg} ${border} border rounded-lg p-3`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 ${iconColor} mt-0.5 flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">{title}</p>
            {metric && (
              <span className={`text-sm font-bold ${metricColor}`}>{metric}</span>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-0.5">{description}</p>
          {action && onAction && (
            <button
              onClick={onAction}
              className={`text-xs font-medium ${iconColor} hover:underline mt-1`}
            >
              {action} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// METRIC COMPARISON - Comparación lado a lado
// ============================================

interface MetricComparisonProps {
  title: string;
  current: number;
  previous: number;
  format?: 'currency' | 'number' | 'percent';
  currencySymbol?: string;
  invertColors?: boolean;
}

export const MetricComparison: React.FC<MetricComparisonProps> = ({
  title,
  current,
  previous,
  format = 'number',
  currencySymbol = 'S/',
  invertColors = false
}) => {
  const diff = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const isPositive = diff > 0;
  const isNegative = diff < 0;

  const formatValue = (v: number) => {
    switch (format) {
      case 'currency':
        return `${currencySymbol} ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'percent':
        return `${v.toFixed(1)}%`;
      default:
        return v.toLocaleString();
    }
  };

  const getColor = () => {
    if (diff === 0) return 'text-gray-500';
    if (invertColors) {
      return isPositive ? 'text-red-600' : 'text-green-600';
    }
    return isPositive ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600">{title}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{formatValue(current)}</span>
        {previous > 0 && (
          <span className={`flex items-center text-xs font-medium ${getColor()}`}>
            {isPositive && <ArrowUpRight className="h-3 w-3" />}
            {isNegative && <ArrowDownRight className="h-3 w-3" />}
            {diff !== 0 && `${Math.abs(diff).toFixed(1)}%`}
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================
// STAT TILE - KPI compacto con tendencia
// ============================================

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: number;
  trendLabel?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  variant = 'default',
  onClick
}) => {
  const variantStyles = {
    default: 'bg-gray-50 border-gray-200',
    primary: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    danger: 'bg-red-50 border-red-200'
  };

  const iconColors = {
    default: 'text-gray-500',
    primary: 'text-blue-500',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    danger: 'text-red-500'
  };

  return (
    <div
      className={`${variantStyles[variant]} border rounded-lg p-3 ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className={`h-4 w-4 ${iconColors[variant]}`} />}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-lg font-bold text-gray-900">{value}</span>
        {trend !== undefined && (
          <div className={`flex items-center text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
            {Math.abs(trend).toFixed(1)}%
            {trendLabel && <span className="text-gray-400 ml-1">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// SECTION HEADER - Encabezado de sección
// ============================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-gray-500',
  action
}) => {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}
        <div>
          <h4 className="font-semibold text-gray-900">{title}</h4>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
};

// ============================================
// DATA TABLE MINI - Tabla compacta
// ============================================

interface DataTableMiniProps {
  headers: string[];
  rows: Array<{
    cells: (string | number | React.ReactNode)[];
    onClick?: () => void;
  }>;
  emptyMessage?: string;
}

export const DataTableMini: React.FC<DataTableMiniProps> = ({
  headers,
  rows,
  emptyMessage = 'Sin datos'
}) => {
  if (rows.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={row.onClick ? 'hover:bg-gray-50 cursor-pointer' : ''}
              onClick={row.onClick}
            >
              {row.cells.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-2 py-2 text-sm text-gray-700 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================
// QUICK INSIGHT BADGE - Badge con insight rápido
// ============================================

interface QuickInsightBadgeProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export const QuickInsightBadge: React.FC<QuickInsightBadgeProps> = ({
  icon: Icon,
  label,
  value,
  variant = 'default'
}) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700'
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${variants[variant]}`}>
      <Icon className="h-3 w-3" />
      <span>{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );
};

// ============================================
// TWO COLUMN LAYOUT - Layout de 2 columnas
// ============================================

interface TwoColumnLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: 'narrow' | 'equal' | 'wide';
}

export const TwoColumnLayout: React.FC<TwoColumnLayoutProps> = ({
  left,
  right,
  leftWidth = 'equal'
}) => {
  const widths = {
    narrow: 'lg:w-1/3',
    equal: 'lg:w-1/2',
    wide: 'lg:w-2/3'
  };

  const rightWidths = {
    narrow: 'lg:w-2/3',
    equal: 'lg:w-1/2',
    wide: 'lg:w-1/3'
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className={`w-full ${widths[leftWidth]}`}>{left}</div>
      <div className={`w-full ${rightWidths[leftWidth]}`}>{right}</div>
    </div>
  );
};
