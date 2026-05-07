import React from 'react';
import { formatFecha as formatDate } from '../../utils/dateFormatters';
import { Check, Clock, AlertCircle, ChevronRight, ArrowRight } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';

export interface TimelineStep {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  date?: Timestamp | Date | null;
  status: 'completed' | 'current' | 'pending' | 'skipped';
  metadata?: Record<string, string | number>;
  /** Label to show on the connector AFTER this step (e.g. "3d") */
  durationLabel?: string;
}

export interface NextAction {
  label: string;
  description?: string;
  buttonText?: string;
  onClick?: () => void;
  variant?: 'primary' | 'warning' | 'success' | 'info';
}

export interface StatusTimelineProps {
  steps: TimelineStep[];
  nextAction?: NextAction;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  showDates?: boolean;
  compact?: boolean;
}


const statusConfig = {
  completed: {
    icon: <Check className="h-4 w-4" />,
    bgColor: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    borderColor: 'border-emerald-500',
    lineColor: 'bg-emerald-500',
    textColor: 'text-emerald-700'
  },
  current: {
    icon: <Clock className="h-4 w-4 animate-pulse" />,
    bgColor: 'bg-sky-100',
    iconColor: 'text-sky-600',
    borderColor: 'border-sky-500',
    lineColor: 'bg-sky-500',
    textColor: 'text-sky-700'
  },
  pending: {
    icon: null,
    bgColor: 'bg-slate-100',
    iconColor: 'text-slate-400',
    borderColor: 'border-slate-300',
    lineColor: 'bg-slate-200',
    textColor: 'text-slate-500'
  },
  skipped: {
    icon: <AlertCircle className="h-4 w-4" />,
    bgColor: 'bg-red-100',
    iconColor: 'text-red-600',
    borderColor: 'border-red-500',
    lineColor: 'bg-red-500',
    textColor: 'text-red-700'
  }
};

const actionVariantConfig: Record<string, { bg: string; border: string; text: string; button: string }> = {
  primary: {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-700',
    button: 'bg-teal-600 hover:bg-teal-700 text-white'
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    button: 'bg-amber-600 hover:bg-amber-700 text-white'
  },
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white'
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
    button: 'bg-sky-600 hover:bg-sky-700 text-white'
  }
};

export const StatusTimeline: React.FC<StatusTimelineProps> = ({
  steps,
  nextAction,
  orientation = 'horizontal',
  className = '',
  showDates = true,
  compact = false
}) => {
  if (orientation === 'vertical') {
    return (
      <div className={`${className}`}>
        <div className="relative">
          {steps.map((step, index) => {
            const config = statusConfig[step.status];
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="flex gap-3 pb-6 last:pb-0">
                {/* Línea y círculo */}
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      flex items-center justify-center
                      ${compact ? 'h-6 w-6' : 'h-8 w-8'}
                      rounded-full border-2
                      ${config.borderColor}
                      ${config.bgColor}
                      ${config.iconColor}
                    `}
                  >
                    {step.icon || config.icon || (
                      <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold`}>
                        {index + 1}
                      </span>
                    )}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 flex-1 min-h-[20px] ${config.lineColor}`} />
                  )}
                </div>

                {/* Contenido */}
                <div className="flex-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${compact ? 'text-sm' : 'text-base'} ${config.textColor}`}>
                      {step.label}
                    </span>
                    {step.status === 'current' && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-sky-100 text-sky-700 rounded-full">
                        Actual
                      </span>
                    )}
                  </div>

                  {step.description && (
                    <p className="text-sm text-slate-500 mt-0.5">{step.description}</p>
                  )}

                  {showDates && step.date && (
                    <p className="text-xs text-slate-400 mt-1">{formatDate(step.date)}</p>
                  )}

                  {step.metadata && Object.keys(step.metadata).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(step.metadata).map(([key, value]) => (
                        <span
                          key={key}
                          className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Siguiente acción */}
        {nextAction && (
          <NextActionBox action={nextAction} className="mt-4" />
        )}
      </div>
    );
  }

  // Horizontal layout
  return (
    <div className={`${className}`}>
      <div className="flex items-center overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const config = statusConfig[step.status];
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center min-w-[100px]">
                {/* Círculo */}
                <div
                  className={`
                    flex items-center justify-center
                    ${compact ? 'h-8 w-8' : 'h-10 w-10'}
                    rounded-full border-2
                    ${config.borderColor}
                    ${config.bgColor}
                    ${config.iconColor}
                    transition-all duration-200
                  `}
                >
                  {step.icon || config.icon || (
                    <span className={`${compact ? 'text-sm' : 'text-base'} font-semibold`}>
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span className={`
                  mt-2 text-center font-medium
                  ${compact ? 'text-xs' : 'text-sm'}
                  ${config.textColor}
                  max-w-[100px]
                `}>
                  {step.label}
                </span>

                {/* Fecha */}
                {showDates && step.date && (
                  <span className="text-xs text-slate-400 mt-0.5 text-center">
                    {formatDate(step.date)}
                  </span>
                )}

                {/* Badge de estado actual */}
                {step.status === 'current' && (
                  <span className="mt-1 px-2 py-0.5 text-xs font-medium bg-sky-100 text-sky-700 rounded-full">
                    Actual
                  </span>
                )}
              </div>

              {/* Conector */}
              {!isLast && (
                <div className="flex-1 mx-2 min-w-[20px] flex flex-col items-center justify-center">
                  {step.durationLabel && (
                    <span className="text-[10px] text-slate-400 mb-0.5 whitespace-nowrap">
                      {step.durationLabel}
                    </span>
                  )}
                  <div className={`w-full h-0.5 ${config.lineColor}`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Siguiente acción */}
      {nextAction && (
        <NextActionBox action={nextAction} className="mt-4" />
      )}
    </div>
  );
};

// Componente para la siguiente acción
interface NextActionBoxProps {
  action: NextAction;
  className?: string;
}

const NextActionBox: React.FC<NextActionBoxProps> = ({ action, className = '' }) => {
  const config = actionVariantConfig[action.variant || 'primary'] || actionVariantConfig.primary;

  return (
    <div className={`
      flex items-center justify-between p-4 rounded-lg border
      ${config.bg} ${config.border}
      ${className}
    `}>
      <div className="flex items-center gap-3">
        <ArrowRight className={`h-5 w-5 ${config.text}`} />
        <div>
          <p className={`font-medium ${config.text}`}>
            {action.label}
          </p>
          {action.description && (
            <p className="text-sm text-slate-600 mt-0.5">
              {action.description}
            </p>
          )}
        </div>
      </div>
      {action.buttonText && action.onClick && (
        <button
          onClick={action.onClick}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm
            transition-colors
            ${config.button}
          `}
        >
          {action.buttonText}
        </button>
      )}
    </div>
  );
};

export default StatusTimeline;
