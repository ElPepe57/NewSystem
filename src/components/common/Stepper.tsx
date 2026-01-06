import React from 'react';
import { Check } from 'lucide-react';

export interface Step {
  id: string | number;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  optional?: boolean;
}

export interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  allowClickCompleted?: boolean;
  allowClickFuture?: boolean;
}

const sizeConfig = {
  sm: {
    circle: 'h-6 w-6',
    icon: 'h-3 w-3',
    text: 'text-xs',
    description: 'text-xs',
    connector: 'h-0.5',
    verticalConnector: 'w-0.5 h-8'
  },
  md: {
    circle: 'h-8 w-8',
    icon: 'h-4 w-4',
    text: 'text-sm',
    description: 'text-xs',
    connector: 'h-0.5',
    verticalConnector: 'w-0.5 h-12'
  },
  lg: {
    circle: 'h-10 w-10',
    icon: 'h-5 w-5',
    text: 'text-base',
    description: 'text-sm',
    connector: 'h-1',
    verticalConnector: 'w-1 h-16'
  }
};

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  orientation = 'horizontal',
  size = 'md',
  className = '',
  allowClickCompleted = true,
  allowClickFuture = false
}) => {
  const sizes = sizeConfig[size];

  const getStepStatus = (index: number): 'completed' | 'current' | 'pending' => {
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'current';
    return 'pending';
  };

  const handleStepClick = (index: number) => {
    if (!onStepClick) return;

    const status = getStepStatus(index);
    if (status === 'completed' && allowClickCompleted) {
      onStepClick(index);
    } else if (status === 'pending' && allowClickFuture) {
      onStepClick(index);
    }
  };

  const isClickable = (index: number): boolean => {
    if (!onStepClick) return false;
    const status = getStepStatus(index);
    if (status === 'completed' && allowClickCompleted) return true;
    if (status === 'pending' && allowClickFuture) return true;
    return false;
  };

  const renderStepCircle = (step: Step, index: number) => {
    const status = getStepStatus(index);
    const clickable = isClickable(index);

    const baseClasses = `
      ${sizes.circle} rounded-full flex items-center justify-center
      font-semibold transition-all duration-200
      ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-primary-300' : ''}
    `;

    const statusClasses = {
      completed: 'bg-primary-600 text-white',
      current: 'bg-primary-600 text-white ring-4 ring-primary-100',
      pending: 'bg-gray-200 text-gray-500'
    };

    const statusLabels = {
      completed: 'Completado',
      current: 'Paso actual',
      pending: 'Pendiente'
    };

    return (
      <div
        className={`${baseClasses} ${statusClasses[status]}`}
        onClick={() => handleStepClick(index)}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-label={`${step.label}: ${statusLabels[status]}${clickable ? '. Clic para volver a este paso' : ''}`}
        onKeyDown={(e) => {
          if (clickable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleStepClick(index);
          }
        }}
      >
        {status === 'completed' ? (
          <Check className={sizes.icon} />
        ) : step.icon ? (
          <span className={sizes.icon}>{step.icon}</span>
        ) : (
          <span className={sizes.text}>{index + 1}</span>
        )}
      </div>
    );
  };

  const renderConnector = (index: number) => {
    if (index === steps.length - 1) return null;

    const status = getStepStatus(index);
    const isCompleted = status === 'completed';

    if (orientation === 'horizontal') {
      return (
        <div
          className={`
            flex-1 mx-2 ${sizes.connector} rounded-full transition-colors duration-200
            ${isCompleted ? 'bg-primary-600' : 'bg-gray-200'}
          `}
        />
      );
    }

    return (
      <div
        className={`
          ${sizes.verticalConnector} ml-4 rounded-full transition-colors duration-200
          ${isCompleted ? 'bg-primary-600' : 'bg-gray-200'}
        `}
      />
    );
  };

  if (orientation === 'vertical') {
    return (
      <nav
        aria-label="Progreso del formulario"
        className={`flex flex-col ${className}`}
      >
        <ol role="list" className="flex flex-col">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          return (
          <li
            key={step.id}
            className="flex flex-col"
            aria-current={status === 'current' ? 'step' : undefined}
          >
            <div className="flex items-start gap-3">
              {renderStepCircle(step, index)}
              <div className="flex flex-col pt-1">
                <span
                  className={`
                    font-medium ${sizes.text}
                    ${status === 'pending' ? 'text-gray-500' : 'text-gray-900'}
                  `}
                >
                  {step.label}
                  {step.optional && (
                    <span className="ml-1 text-gray-400 font-normal">(opcional)</span>
                  )}
                </span>
                {step.description && (
                  <span className={`text-gray-500 ${sizes.description} mt-0.5`}>
                    {step.description}
                  </span>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className="flex" aria-hidden="true">
                {renderConnector(index)}
              </div>
            )}
          </li>
          );
        })}
        </ol>
      </nav>
    );
  }

  // Horizontal layout
  return (
    <nav aria-label="Progreso del formulario" className={className}>
      <ol role="list" className="flex items-center">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          return (
          <li
            key={step.id}
            className="flex items-center"
            aria-current={status === 'current' ? 'step' : undefined}
          >
            <div className="flex flex-col items-center">
              {renderStepCircle(step, index)}
              <span
                className={`
                  mt-2 font-medium ${sizes.text} text-center
                  ${status === 'pending' ? 'text-gray-500' : 'text-gray-900'}
                `}
              >
                {step.label}
              </span>
              {step.description && (
                <span className={`text-gray-500 ${sizes.description} text-center mt-0.5`}>
                  {step.description}
                </span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div aria-hidden="true" className="flex-1">{renderConnector(index)}</div>
            )}
          </li>
          );
        })}
      </ol>
    </nav>
  );
};

// Hook para manejar el estado del stepper
export interface UseStepperOptions {
  steps: Step[];
  initialStep?: number;
  onComplete?: () => void;
}

export interface UseStepperResult {
  currentStep: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  currentStepData: Step;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
  progress: number;
}

export const useStepper = ({
  steps,
  initialStep = 0,
  onComplete
}: UseStepperOptions): UseStepperResult => {
  const [currentStep, setCurrentStep] = React.useState(initialStep);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const goToStep = React.useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  }, [steps.length]);

  const nextStep = React.useCallback(() => {
    if (isLastStep) {
      onComplete?.();
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  }, [isLastStep, steps.length, onComplete]);

  const prevStep = React.useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const reset = React.useCallback(() => {
    setCurrentStep(initialStep);
  }, [initialStep]);

  return {
    currentStep,
    isFirstStep,
    isLastStep,
    currentStepData,
    goToStep,
    nextStep,
    prevStep,
    reset,
    progress
  };
};

// Componente de contenido por paso
export interface StepContentProps {
  children: React.ReactNode[];
  currentStep: number;
  className?: string;
  /** Habilitar animación de transición */
  animate?: boolean;
}

export const StepContent: React.FC<StepContentProps> = ({
  children,
  currentStep,
  className = '',
  animate = true
}) => {
  const [isAnimating, setIsAnimating] = React.useState(true);
  const [displayedStep, setDisplayedStep] = React.useState(currentStep);
  const prevStepRef = React.useRef(currentStep);

  React.useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      if (animate) {
        setIsAnimating(false);
        const timer = setTimeout(() => {
          setDisplayedStep(currentStep);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setIsAnimating(true);
            });
          });
        }, 100);
        prevStepRef.current = currentStep;
        return () => clearTimeout(timer);
      } else {
        setDisplayedStep(currentStep);
        prevStepRef.current = currentStep;
      }
    }
  }, [currentStep, animate]);

  return (
    <div
      className={`
        ${className}
        ${animate ? 'transition-all duration-150 ease-out' : ''}
        ${isAnimating ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
      `}
      role="region"
      aria-live="polite"
    >
      {React.Children.toArray(children)[displayedStep]}
    </div>
  );
};

// Navegación del stepper
export interface StepNavigationProps {
  onPrev: () => void;
  onNext: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  prevLabel?: string;
  nextLabel?: string;
  completeLabel?: string;
  loading?: boolean;
  className?: string;
}

export const StepNavigation: React.FC<StepNavigationProps> = ({
  onPrev,
  onNext,
  isFirstStep,
  isLastStep,
  prevLabel = 'Anterior',
  nextLabel = 'Siguiente',
  completeLabel = 'Finalizar',
  loading = false,
  className = ''
}) => {
  return (
    <nav aria-label="Navegación de pasos" className={`flex justify-between ${className}`}>
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirstStep || loading}
        aria-label={isFirstStep ? 'Ya estás en el primer paso' : 'Ir al paso anterior'}
        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {prevLabel}
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={loading}
        aria-label={isLastStep ? 'Finalizar proceso' : 'Ir al siguiente paso'}
        aria-busy={loading}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Procesando...' : isLastStep ? completeLabel : nextLabel}
      </button>
    </nav>
  );
};

export default Stepper;
