import React from 'react';
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
}

export interface NextAction {
  label: string;
  description?: string;
  buttonText?: string;
  onClick?: () => void;
  variant?: 'primary' | 'warning' | 'success';
}

export interface StatusTimelineProps {
  steps: TimelineStep[];
  nextAction?: NextAction;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  showDates?: boolean;
  compact?: boolean;
}

const formatDate = (date: Timestamp | Date | null | undefined): string => {
  if (!date) return '';

  const d = 'toDate' in date ? date.toDate() : date;
  return d.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const statusConfig = {
  completed: {
    icon: <Check className="h-4 w-4" />,
    bgColor: 'bg-green-100',
    iconColor: 'text-green-600',
    borderColor: 'border-green-500',
    lineColor: 'bg-green-500',
    textColor: 'text-green-700'
  },
  current: {
    icon: <Clock className="h-4 w-4 animate-pulse" />,
    bgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-500',
    lineColor: 'bg-blue-500',
    textColor: 'text-blue-700'
  },
  pending: {
    icon: null,
    bgColor: 'bg-gray-100',
    iconColor: 'text-gray-400',
    borderColor: 'border-gray-300',
    lineColor: 'bg-gray-200',
    textColor: 'text-gray-500'
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

const actionVariantConfig = {
  primary: {
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    text: 'text-primary-700',
    button: 'bg-primary-600 hover:bg-primary-700 text-white'
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    button: 'bg-amber-600 hover:bg-amber-700 text-white'
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    button: 'bg-green-600 hover:bg-green-700 text-white'
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
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        Actual
                      </span>
                    )}
                  </div>

                  {step.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>
                  )}

                  {showDates && step.date && (
                    <p className="text-xs text-gray-400 mt-1">{formatDate(step.date)}</p>
                  )}

                  {step.metadata && Object.keys(step.metadata).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(step.metadata).map(([key, value]) => (
                        <span
                          key={key}
                          className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
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
                  <span className="text-xs text-gray-400 mt-0.5 text-center">
                    {formatDate(step.date)}
                  </span>
                )}

                {/* Badge de estado actual */}
                {step.status === 'current' && (
                  <span className="mt-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                    Actual
                  </span>
                )}
              </div>

              {/* Conector */}
              {!isLast && (
                <div className={`
                  flex-1 h-0.5 mx-2 min-w-[20px]
                  ${config.lineColor}
                `} />
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
  const config = actionVariantConfig[action.variant || 'primary'];

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
            <p className="text-sm text-gray-600 mt-0.5">
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

// Hook para generar steps de ventas
export const useVentaTimelineSteps = (venta: {
  estado: string;
  fechaCreacion?: Timestamp | Date;
  fechaConfirmacion?: Timestamp | Date;
  fechaAsignacion?: Timestamp | Date;
  fechaEntrega?: Timestamp | Date;
}): TimelineStep[] => {
  const estadoIndex: Record<string, number> = {
    'cotizacion': 0,
    'confirmada': 1,
    'asignada': 2,
    'en_entrega': 3,
    'entregada': 4,
    'cancelada': -1
  };

  const currentIndex = estadoIndex[venta.estado] ?? 0;
  const isCancelled = venta.estado === 'cancelada';

  return [
    {
      id: 'cotizacion',
      label: 'Cotización',
      date: venta.fechaCreacion,
      status: isCancelled ? 'skipped' : currentIndex >= 0 ? 'completed' : 'pending'
    },
    {
      id: 'confirmada',
      label: 'Confirmada',
      date: venta.fechaConfirmacion,
      status: isCancelled ? 'skipped' : currentIndex > 1 ? 'completed' : currentIndex === 1 ? 'current' : 'pending'
    },
    {
      id: 'asignada',
      label: 'Asignada',
      date: venta.fechaAsignacion,
      status: isCancelled ? 'skipped' : currentIndex > 2 ? 'completed' : currentIndex === 2 ? 'current' : 'pending'
    },
    {
      id: 'en_entrega',
      label: 'En Entrega',
      status: isCancelled ? 'skipped' : currentIndex > 3 ? 'completed' : currentIndex === 3 ? 'current' : 'pending'
    },
    {
      id: 'entregada',
      label: 'Entregada',
      date: venta.fechaEntrega,
      status: isCancelled ? 'skipped' : currentIndex === 4 ? 'completed' : 'pending'
    }
  ];
};

// Hook para generar steps de órdenes de compra
export const useOrdenCompraTimelineSteps = (orden: {
  estado: string;
  fechaCreacion?: Timestamp | Date;
  fechaEnviada?: Timestamp | Date;
  fechaEnTransito?: Timestamp | Date;
  fechaRecibida?: Timestamp | Date;
}): TimelineStep[] => {
  const estadoIndex: Record<string, number> = {
    'borrador': 0,
    'enviada': 1,
    'en_transito': 2,
    'recibida': 3,
    'cancelada': -1
  };

  const currentIndex = estadoIndex[orden.estado] ?? 0;
  const isCancelled = orden.estado === 'cancelada';

  return [
    {
      id: 'borrador',
      label: 'Borrador',
      date: orden.fechaCreacion,
      status: isCancelled ? 'skipped' : currentIndex >= 0 ? 'completed' : 'pending'
    },
    {
      id: 'enviada',
      label: 'Enviada',
      date: orden.fechaEnviada,
      status: isCancelled ? 'skipped' : currentIndex > 1 ? 'completed' : currentIndex === 1 ? 'current' : 'pending'
    },
    {
      id: 'en_transito',
      label: 'En Tránsito',
      date: orden.fechaEnTransito,
      status: isCancelled ? 'skipped' : currentIndex > 2 ? 'completed' : currentIndex === 2 ? 'current' : 'pending'
    },
    {
      id: 'recibida',
      label: 'Recibida',
      date: orden.fechaRecibida,
      status: isCancelled ? 'skipped' : currentIndex === 3 ? 'completed' : 'pending'
    }
  ];
};

export default StatusTimeline;
