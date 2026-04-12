import React from 'react';

const formatStatValue = (value: number, format?: 'currency' | 'number' | 'compact'): string => {
  if (format === 'currency') {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (format === 'compact') {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  }
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export interface StatDistributionProps {
  title: string;
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  total?: number;
  showPercentage?: boolean;
  valueFormat?: 'currency' | 'number' | 'compact';
}

export const StatDistribution: React.FC<StatDistributionProps> = ({
  title,
  data,
  total: providedTotal,
  showPercentage = true,
  valueFormat = 'number'
}) => {
  const total = providedTotal || data.reduce((sum, item) => sum + item.value, 0);

  const defaultColors = [
    'bg-teal-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-red-500',
    'bg-violet-500',
    'bg-sky-500',
    'bg-slate-500'
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-700 mb-3">{title}</h3>

      {/* Barra de distribución */}
      <div className="h-3 flex rounded-full overflow-hidden bg-slate-100 mb-4">
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          if (percentage === 0) return null;
          return (
            <div
              key={item.label}
              className={item.color || defaultColors[index % defaultColors.length]}
              style={{ width: `${percentage}%` }}
              title={`${item.label}: ${formatStatValue(item.value, valueFormat)}`}
            />
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="space-y-2">
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className={`h-3 w-3 rounded flex-shrink-0 ${item.color || defaultColors[index % defaultColors.length]}`} />
                <span className="text-sm text-slate-700 truncate" title={item.label}>{item.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-slate-900">
                  {formatStatValue(item.value, valueFormat)}
                </span>
                {showPercentage && total > 0 && (
                  <span className="text-xs text-slate-500 w-10 text-right">({percentage.toFixed(0)}%)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
