/**
 * StepsSidebar — Imp-L3 · Pagos Masivos M5
 *
 * Sidebar izquierdo persistente con los 4 pasos del wizard. Replica el
 * patrón de S52 wizard envíos v7 (sidebar de pasos + contenido + sidebar
 * resumen). Estados: pending / active / done con conector vertical.
 */

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../../../../design-system/utils';

export type WizardStepKey = 'tipo' | 'documentos' | 'revision' | 'ejecucion';

export interface StepDef {
  key: WizardStepKey;
  num: number;
  label: string;
  hint: string;
}

export const PASOS: StepDef[] = [
  { key: 'tipo', num: 1, label: 'Tipo + Cuenta', hint: 'Egreso/Ingreso · cuenta · TC' },
  { key: 'documentos', num: 2, label: 'Documentos', hint: 'Selección de items' },
  { key: 'revision', num: 3, label: 'Revisión', hint: 'Confirmar el lote' },
  { key: 'ejecucion', num: 4, label: 'Ejecución', hint: 'Procesar' },
];

export interface StepsSidebarProps {
  pasoActual: WizardStepKey;
  /** Pasos completados (mostrar check verde) */
  pasosCompletados: Set<WizardStepKey>;
  /** Permitir click para navegar (solo a pasos ya completados) */
  onClickPaso?: (key: WizardStepKey) => void;
}

export const StepsSidebar: React.FC<StepsSidebarProps> = ({
  pasoActual,
  pasosCompletados,
  onClickPaso,
}) => {
  return (
    <div className="w-full lg:w-[200px] flex-shrink-0 bg-gradient-to-b from-slate-50 to-slate-100 border-b lg:border-b-0 lg:border-r border-slate-200 py-3 lg:py-6">
      <div className="px-3 lg:px-0 mb-3 lg:mb-2 lg:px-4 hidden lg:block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Progreso del lote
        </span>
      </div>

      {/* Mobile: pasos horizontales · Desktop: vertical */}
      <div className="flex lg:flex-col gap-1 lg:gap-0 px-3 lg:px-0 overflow-x-auto lg:overflow-visible scrollbar-hide">
        {PASOS.map((paso, idx) => {
          const isActive = pasoActual === paso.key;
          const isDone = pasosCompletados.has(paso.key);
          const isPending = !isActive && !isDone;
          const canClick = isDone && !isActive;

          return (
            <React.Fragment key={paso.key}>
              <button
                type="button"
                onClick={canClick ? () => onClickPaso?.(paso.key) : undefined}
                disabled={!canClick}
                className={cn(
                  'flex items-start gap-2 lg:gap-3 lg:px-4 px-2 py-2 lg:py-3 transition-all flex-shrink-0',
                  'lg:w-full text-left',
                  canClick && 'hover:bg-teal-50 cursor-pointer',
                  !canClick && 'cursor-default',
                )}
              >
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all',
                    isDone && 'bg-emerald-600 text-white',
                    isActive && 'bg-teal-600 text-white ring-[3px] ring-teal-100',
                    isPending && 'bg-slate-200 text-slate-400',
                  )}
                >
                  {isDone ? <Check className="w-3 h-3" /> : paso.num}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <div
                    className={cn(
                      'text-xs leading-tight font-medium',
                      isActive && 'text-teal-800 font-semibold',
                      isDone && 'text-emerald-700',
                      isPending && 'text-slate-400',
                    )}
                  >
                    {paso.label}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate hidden lg:block mt-0.5">
                    {paso.hint}
                  </div>
                </div>
              </button>
              {/* Connector solo desktop, no en último */}
              {idx < PASOS.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 h-4 ml-7 hidden lg:block',
                    pasosCompletados.has(paso.key) ? 'bg-emerald-300' : 'bg-slate-200',
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
