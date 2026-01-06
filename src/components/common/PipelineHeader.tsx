import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface PipelineStage {
  id: string;
  label: string;
  count: number;
  color: 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'purple' | 'orange';
  icon?: React.ReactNode;
}

export interface PipelineHeaderProps {
  stages: PipelineStage[];
  activeStage?: string | null;
  onStageClick?: (stageId: string | null) => void;
  title?: string;
  className?: string;
}

const colorStyles: Record<PipelineStage['color'], { bg: string; bgActive: string; text: string; border: string }> = {
  gray: {
    bg: 'bg-gray-50',
    bgActive: 'bg-gray-100 ring-2 ring-gray-400',
    text: 'text-gray-700',
    border: 'border-gray-200'
  },
  blue: {
    bg: 'bg-blue-50',
    bgActive: 'bg-blue-100 ring-2 ring-blue-400',
    text: 'text-blue-700',
    border: 'border-blue-200'
  },
  yellow: {
    bg: 'bg-yellow-50',
    bgActive: 'bg-yellow-100 ring-2 ring-yellow-400',
    text: 'text-yellow-700',
    border: 'border-yellow-200'
  },
  green: {
    bg: 'bg-green-50',
    bgActive: 'bg-green-100 ring-2 ring-green-400',
    text: 'text-green-700',
    border: 'border-green-200'
  },
  red: {
    bg: 'bg-red-50',
    bgActive: 'bg-red-100 ring-2 ring-red-400',
    text: 'text-red-700',
    border: 'border-red-200'
  },
  purple: {
    bg: 'bg-purple-50',
    bgActive: 'bg-purple-100 ring-2 ring-purple-400',
    text: 'text-purple-700',
    border: 'border-purple-200'
  },
  orange: {
    bg: 'bg-orange-50',
    bgActive: 'bg-orange-100 ring-2 ring-orange-400',
    text: 'text-orange-700',
    border: 'border-orange-200'
  }
};

export const PipelineHeader: React.FC<PipelineHeaderProps> = ({
  stages,
  activeStage,
  onStageClick,
  title,
  className = ''
}) => {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  const handleClick = (stageId: string) => {
    if (!onStageClick) return;
    // Toggle: si ya está activo, limpia el filtro
    if (activeStage === stageId) {
      onStageClick(null);
    } else {
      onStageClick(stageId);
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
          {activeStage && (
            <button
              onClick={() => onStageClick?.(null)}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Mostrar todos ({total})
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {stages.map((stage, index) => {
          const colors = colorStyles[stage.color];
          const isActive = activeStage === stage.id;
          const isClickable = onStageClick !== undefined;

          return (
            <React.Fragment key={stage.id}>
              {index > 0 && (
                <ChevronRight
                  className="h-4 w-4 text-gray-300 flex-shrink-0"
                  aria-hidden="true"
                />
              )}

              <button
                onClick={() => handleClick(stage.id)}
                disabled={!isClickable}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                  ${isActive ? colors.bgActive : colors.bg}
                  ${colors.border}
                  ${isClickable ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}
                  ${isClickable && !isActive ? 'hover:ring-1 hover:ring-gray-300' : ''}
                  flex-shrink-0
                `}
                aria-pressed={isActive}
                aria-label={`${stage.label}: ${stage.count} ${stage.count === 1 ? 'item' : 'items'}${isActive ? ' (filtro activo)' : ''}`}
              >
                {stage.icon && (
                  <span className={`${colors.text} flex-shrink-0`}>
                    {stage.icon}
                  </span>
                )}
                <span className={`text-sm font-medium ${colors.text} whitespace-nowrap`}>
                  {stage.label}
                </span>
                <span className={`
                  inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
                  rounded-full text-xs font-semibold
                  ${isActive ? 'bg-white' : colors.bg}
                  ${colors.text}
                `}>
                  {stage.count}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Barra de progreso visual */}
      {total > 0 && (
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
          {stages.map((stage) => {
            const percentage = (stage.count / total) * 100;
            if (percentage === 0) return null;

            const barColors: Record<PipelineStage['color'], string> = {
              gray: 'bg-gray-400',
              blue: 'bg-blue-500',
              yellow: 'bg-yellow-500',
              green: 'bg-green-500',
              red: 'bg-red-500',
              purple: 'bg-purple-500',
              orange: 'bg-orange-500'
            };

            return (
              <div
                key={stage.id}
                className={`${barColors[stage.color]} transition-all duration-300`}
                style={{ width: `${percentage}%` }}
                title={`${stage.label}: ${stage.count} (${percentage.toFixed(0)}%)`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PipelineHeader;
