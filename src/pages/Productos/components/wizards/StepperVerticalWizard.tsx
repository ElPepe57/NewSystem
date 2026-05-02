/**
 * StepperVerticalWizard · Sidebar vertical de pasos para wizards F5(A)
 *
 * Mockup canónico: docs/mockups/productos/18-wizard-crear-con-variantes.html
 *
 * Diseño:
 *   - Header del wizard (icon + título + subtítulo)
 *   - Lista de pasos con conector vertical (línea entre círculos)
 *     · Completado: círculo emerald + check + linea emerald
 *     · Activo: círculo de color (sky/purple/etc.) + número + ring + linea slate
 *     · Pendiente: círculo slate-200 + número + linea slate
 *   - Footer con resumen acumulado en vivo (key-value pairs)
 *   - Click en paso completado o actual permite navegar
 *
 * Responsive: en mobile se oculta el sidebar y se muestra un stepper top
 * compacto (handled por el wizard padre con lg:flex).
 */

import React from 'react';
import { Check, type LucideIcon } from 'lucide-react';

export interface StepConfig {
  /** Identificador del paso (usado para activeStep) */
  key: string;
  /** Título del paso */
  label: string;
  /** Subtítulo opcional debajo del label */
  subtitulo?: string;
  /** Si está deshabilitado · usado para forzar orden */
  disabled?: boolean;
}

export interface ResumenItem {
  label: string;
  value: React.ReactNode;
}

interface StepperVerticalWizardProps {
  steps: StepConfig[];
  /** Steps key del paso actual */
  activeStep: string;
  /** Steps keys que ya fueron completados */
  completedSteps: string[];
  /** Tone semántico del wizard (color del activo · sky/purple/teal) */
  tone: 'sky' | 'purple' | 'teal' | 'emerald';
  /** Header del sidebar */
  headerIcon: LucideIcon;
  headerTitle: string;
  headerSubtitle?: string;
  /** Resumen acumulado al pie del sidebar (opcional) */
  resumen?: ResumenItem[];
  /** Callback al click en un paso · solo si completado o actual */
  onStepClick?: (stepKey: string) => void;
}

const TONE_STYLES = {
  sky: { bg: 'bg-sky-600', ring: 'ring-sky-100', text: 'text-sky-700', headerBg: 'bg-sky-600' },
  purple: { bg: 'bg-purple-600', ring: 'ring-purple-100', text: 'text-purple-700', headerBg: 'bg-purple-600' },
  teal: { bg: 'bg-teal-600', ring: 'ring-teal-100', text: 'text-teal-700', headerBg: 'bg-teal-600' },
  emerald: { bg: 'bg-emerald-600', ring: 'ring-emerald-100', text: 'text-emerald-700', headerBg: 'bg-emerald-600' },
};

export const StepperVerticalWizard: React.FC<StepperVerticalWizardProps> = ({
  steps,
  activeStep,
  completedSteps,
  tone,
  headerIcon: HeaderIcon,
  headerTitle,
  headerSubtitle,
  resumen,
  onStepClick,
}) => {
  const toneStyle = TONE_STYLES[tone];
  const activeIdx = steps.findIndex(s => s.key === activeStep);

  return (
    <aside className="w-full lg:w-64 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 p-4 lg:p-5 flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 lg:mb-5 pb-3 lg:pb-4 border-b border-slate-200">
        <div className={`w-8 h-8 lg:w-9 lg:h-9 rounded-xl ${toneStyle.headerBg} flex items-center justify-center flex-shrink-0`}>
          <HeaderIcon className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className={`text-xs font-bold ${toneStyle.text} truncate`}>{headerTitle}</div>
          {headerSubtitle && <div className="text-[10px] text-slate-500 truncate">{headerSubtitle}</div>}
        </div>
      </div>

      {/* Pasos · DESKTOP vertical / MOBILE horizontal scroll */}
      <div className="lg:flex-1">
        <div className="flex lg:block lg:space-y-1 gap-3 lg:gap-0 overflow-x-auto scrollbar-hide lg:overflow-visible">
          {steps.map((step, idx) => {
            const isCompleted = completedSteps.includes(step.key);
            const isActive = step.key === activeStep;
            const isClickable = !step.disabled && (isCompleted || isActive) && onStepClick;
            const isLast = idx === steps.length - 1;

            return (
              <div key={step.key} className="flex items-start gap-2 lg:gap-3 flex-shrink-0">
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={isClickable ? () => onStepClick!(step.key) : undefined}
                    disabled={!isClickable}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isActive
                        ? `${toneStyle.bg} text-white ring-4 ${toneStyle.ring}`
                        : 'bg-slate-200 text-slate-500'
                    } ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </button>
                  {!isLast && (
                    <div
                      className={`hidden lg:block w-0.5 h-8 mt-1 ${
                        isCompleted ? 'bg-emerald-300' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
                <div className="pt-0.5 hidden lg:block min-w-0">
                  <div
                    className={`text-xs font-${isActive || isCompleted ? 'bold' : 'medium'} ${
                      isCompleted ? 'text-emerald-700' : isActive ? toneStyle.text : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </div>
                  {step.subtitulo && (
                    <div
                      className={`text-[10px] ${
                        isCompleted ? 'text-emerald-600' : isActive ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      {step.subtitulo}
                    </div>
                  )}
                </div>
                {/* Mobile · solo label compacto del activo */}
                {isActive && (
                  <div className="pt-0.5 lg:hidden min-w-0">
                    <div className={`text-xs font-bold ${toneStyle.text} whitespace-nowrap`}>
                      Paso {idx + 1} · {step.label}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Indicador progreso mobile */}
        <div className="lg:hidden mt-3 flex items-center gap-1.5">
          <div className="text-[10px] text-slate-500 tabular-nums">
            {activeIdx + 1} / {steps.length}
          </div>
          <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${toneStyle.bg} transition-all`}
              style={{ width: `${((activeIdx + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer · resumen acumulado · solo desktop */}
      {resumen && resumen.length > 0 && (
        <div className="hidden lg:block mt-5 pt-4 border-t border-slate-200 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Resumen</div>
          <div className="bg-white rounded-lg p-3 text-xs space-y-1.5">
            {resumen.map((r, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-slate-500 truncate">{r.label}</span>
                <span className="font-semibold text-slate-900 truncate">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
