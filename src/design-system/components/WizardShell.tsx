import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '../utils';

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
  optional?: boolean;
}

/** Acento de color del wizard (chrome: paso activo del stepper + botón primary). Default teal. */
export type WizardAccent = 'teal' | 'blue' | 'violet' | 'orange' | 'indigo' | 'slate';

const ACCENT_STYLES: Record<WizardAccent, { stepActive: string; primary: string }> = {
  teal: { stepActive: 'bg-teal-600 text-white scale-105 ring-4 ring-teal-100', primary: 'bg-teal-600 hover:bg-teal-700' },
  blue: { stepActive: 'bg-blue-600 text-white scale-105 ring-4 ring-blue-100', primary: 'bg-blue-600 hover:bg-blue-700' },
  violet: { stepActive: 'bg-violet-600 text-white scale-105 ring-4 ring-violet-100', primary: 'bg-violet-600 hover:bg-violet-700' },
  orange: { stepActive: 'bg-orange-600 text-white scale-105 ring-4 ring-orange-100', primary: 'bg-orange-600 hover:bg-orange-700' },
  indigo: { stepActive: 'bg-indigo-600 text-white scale-105 ring-4 ring-indigo-100', primary: 'bg-indigo-600 hover:bg-indigo-700' },
  slate: { stepActive: 'bg-slate-700 text-white scale-105 ring-4 ring-slate-200', primary: 'bg-slate-700 hover:bg-slate-800' },
};

interface WizardShellProps {
  /** Título principal del wizard */
  title: string;
  /** Subtítulo o contexto */
  subtitle?: string;
  /** Pasos del wizard en orden */
  steps: WizardStep[];
  /** Índice del paso actual (0-based) */
  currentStep: number;
  /** Callback al cambiar de paso vía click directo en el stepper */
  onStepChange?: (index: number) => void;
  /** Contenido del paso actual */
  children: React.ReactNode;
  /** Panel lateral de preview/resumen (opcional, se muestra al costado derecho) */
  previewPanel?: React.ReactNode;
  /** Callback para cancelar el wizard */
  onCancel?: () => void;
  /** Callback para avanzar al siguiente paso */
  onNext?: () => void;
  /** Callback para retroceder al paso anterior */
  onPrev?: () => void;
  /** Etiqueta del botón "Siguiente" (default: "Siguiente") */
  nextLabel?: string;
  /** Etiqueta del botón "Anterior" (default: "Anterior") */
  prevLabel?: string;
  /** Etiqueta del botón de cierre (default: "Cancelar") */
  cancelLabel?: string;
  /** Texto hint debajo del botón siguiente (ej: "Puedes volver en cualquier paso") */
  nextHint?: string;
  /** Si el botón siguiente está deshabilitado (ej: validación pendiente) */
  nextDisabled?: boolean;
  /** Si está cargando (guardando) — muestra spinner en botón next */
  loading?: boolean;
  /** Callback de confirmación final (reemplaza onNext en último paso) */
  onConfirm?: () => void;
  /** Etiqueta para el botón de confirmar en el último paso */
  confirmLabel?: string;
  /** Variante visual: 'page' (standalone) o 'modal' (embebido) */
  variant?: 'page' | 'modal';
  /** Acento de color del chrome (paso activo + primary). Default 'teal'. */
  accent?: WizardAccent;
  /** ClassName adicional para el contenedor raíz */
  className?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Stepper Component
// ════════════════════════════════════════════════════════════════════════════

const Stepper: React.FC<{
  steps: WizardStep[];
  currentStep: number;
  onStepChange?: (index: number) => void;
  accent: WizardAccent;
}> = ({ steps, currentStep, onStepChange, accent }) => {
  return (
    <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isDone = index < currentStep;
        const isPending = index > currentStep;
        const isClickable = onStepChange && (isDone || isActive);

        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => isClickable && onStepChange(index)}
              disabled={!isClickable}
              className={cn(
                'flex flex-col items-center gap-1.5 flex-shrink-0 group',
                isClickable && 'cursor-pointer',
                !isClickable && 'cursor-default'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200',
                  isActive && ACCENT_STYLES[accent].stepActive,
                  isDone && 'bg-emerald-500 text-white',
                  isPending && 'bg-slate-200 text-slate-500',
                  isClickable && isDone && 'group-hover:bg-emerald-600'
                )}
              >
                {isDone ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <div className="text-center">
                <div
                  className={cn(
                    'text-xs font-medium transition-colors',
                    isActive && 'text-slate-900',
                    isDone && 'text-emerald-700',
                    isPending && 'text-slate-400'
                  )}
                >
                  {step.label}
                </div>
                {step.optional && (
                  <div className="text-[10px] text-slate-400">opcional</div>
                )}
              </div>
            </button>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2 transition-colors',
                  isDone ? 'bg-emerald-500' : 'bg-slate-200'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// WizardShell — Main export
// ════════════════════════════════════════════════════════════════════════════

/**
 * WizardShell — Contenedor estándar para wizards multi-paso del sistema.
 *
 * Estructura:
 *   ┌─ Header (título + botón cerrar)
 *   ├─ Stepper horizontal (clickable para pasos ya completados)
 *   ├─ Body (grid: contenido principal + preview panel opcional)
 *   └─ Footer (Cancelar / Anterior / Siguiente o Confirmar)
 *
 * Uso:
 *   <WizardShell
 *     title="Nueva Orden de Compra"
 *     steps={[{id:'ruta',label:'Ruta'}, {id:'prod',label:'Productos'}]}
 *     currentStep={currentStep}
 *     onNext={() => setStep(s => s+1)}
 *     onPrev={() => setStep(s => s-1)}
 *     previewPanel={<ResumenOC data={form} />}
 *   >
 *     {currentStep === 0 && <StepRuta />}
 *     {currentStep === 1 && <StepProductos />}
 *   </WizardShell>
 */
export const WizardShell: React.FC<WizardShellProps> = ({
  title,
  subtitle,
  steps,
  currentStep,
  onStepChange,
  children,
  previewPanel,
  onCancel,
  onNext,
  onPrev,
  onConfirm,
  nextLabel = 'Siguiente',
  prevLabel = 'Anterior',
  cancelLabel = 'Cancelar',
  confirmLabel = 'Confirmar',
  nextHint,
  nextDisabled = false,
  loading = false,
  variant = 'page',
  accent = 'teal',
  className,
}) => {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handlePrimary = () => {
    if (isLastStep && onConfirm) {
      onConfirm();
    } else if (onNext) {
      onNext();
    }
  };

  return (
    <div
      className={cn(
        'bg-white rounded-2xl overflow-hidden flex flex-col',
        variant === 'page' && 'shadow-xl border border-slate-200',
        variant === 'modal' && 'h-full',
        className
      )}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-2 hover:bg-slate-100 transition-colors"
            aria-label="Cerrar wizard"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Stepper */}
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
        <Stepper
          steps={steps}
          currentStep={currentStep}
          onStepChange={onStepChange}
          accent={accent}
        />
      </div>

      {/* Body — grid responsive: contenido + preview panel opcional.
           S53.16 — Sidebar visible desde sm: (≥640px) en vez de md: (≥768px)
           para aparecer en más viewports. Ancho fijo 360px. */}
      <div
        className={cn(
          'flex-1 overflow-hidden',
          previewPanel ? 'grid grid-cols-1 sm:grid-cols-[1fr_360px]' : ''
        )}
      >
        <div className="overflow-y-auto p-6">
          <div className="animate-[fadeIn_200ms_ease-out]">{children}</div>
        </div>

        {previewPanel && (
          <aside className="hidden sm:block overflow-y-auto border-l border-slate-200 bg-slate-50 p-4">
            <div className="sticky top-0">{previewPanel}</div>
          </aside>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          {!isFirstStep && onPrev && (
            <button
              type="button"
              onClick={onPrev}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              ← {prevLabel}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {nextHint && (
            <span className="text-xs text-slate-500 hidden sm:inline">
              {nextHint}
            </span>
          )}
          <button
            type="button"
            onClick={handlePrimary}
            disabled={nextDisabled || loading}
            className={cn(
              'px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors flex items-center gap-2',
              ACCENT_STYLES[accent].primary,
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {loading && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isLastStep ? confirmLabel : `${nextLabel} →`}
          </button>
        </div>
      </div>
    </div>
  );
};
