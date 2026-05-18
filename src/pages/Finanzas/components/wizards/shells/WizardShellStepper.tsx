/**
 * WizardShellStepper — chk5.D-S4.b · SF4
 *
 * Shell shared para wizards multi-step con stepper horizontal canon MOCK 3 §4.
 * Pixel-perfect para wizards de 3 pasos como B.2 PagarEstadoCuentaWizard y
 * B.4 LiquidarRecaudadoraWizard (este último ya canon S1f).
 *
 * Layout canon:
 *   - Backdrop overlay con `bg-slate-900/50`
 *   - Card central · max-w-4xl · rounded-2xl
 *   - Stepper horizontal arriba (3 pasos en fila · línea + círculos)
 *   - Top bar opcional con tinte (label paso)
 *   - Main · contenido del paso actual
 *   - Footer canon · [← Atrás] [Descartar] [Guardar borrador] [Siguiente →]
 */

import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export type WizardStepperTono = 'amber' | 'sky' | 'purple' | 'teal' | 'emerald' | 'rose' | 'indigo';

export interface WizardStepperPaso {
  numero: number;
  label: string;
  completado: boolean;
  actual: boolean;
}

export interface WizardShellStepperProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  onAtras?: () => void;
  onSiguiente?: () => void;
  onDescartar?: () => void;
  onGuardarBorrador?: () => void;

  tono: WizardStepperTono;
  titulo: string;
  subtitulo?: string;
  /** 3 pasos típicamente (también soporta 2 o 4) */
  pasos: WizardStepperPaso[];
  /** Contenido del main */
  children: React.ReactNode;
  /** Label del botón siguiente · default "Siguiente" */
  siguienteLabel?: string;
  siguienteEsSubmit?: boolean;
  siguienteDisabled?: boolean;
  loading?: boolean;
  /** Tamaño del modal · default 'lg' (max-w-4xl) */
  size?: 'md' | 'lg' | 'xl';
}

// ═════════════════════════════════════════════════════════════════════════
// MAPS canon
// ═════════════════════════════════════════════════════════════════════════

const SIZE_CLASSES: Record<NonNullable<WizardShellStepperProps['size']>, string> = {
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
};

const TONO_CIRCLE_ACTIVO: Record<WizardStepperTono, string> = {
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  purple: 'bg-purple-500',
  teal: 'bg-teal-600',
  emerald: 'bg-emerald-600',
  rose: 'bg-rose-600',
  indigo: 'bg-indigo-600',
};

const TONO_LINE_COMPLETO: Record<WizardStepperTono, string> = {
  amber: 'bg-amber-300',
  sky: 'bg-sky-300',
  purple: 'bg-purple-300',
  teal: 'bg-teal-300',
  emerald: 'bg-emerald-300',
  rose: 'bg-rose-300',
  indigo: 'bg-indigo-300',
};

const TONO_LABEL_ACTIVO: Record<WizardStepperTono, string> = {
  amber: 'text-amber-900',
  sky: 'text-sky-900',
  purple: 'text-purple-900',
  teal: 'text-teal-900',
  emerald: 'text-emerald-900',
  rose: 'text-rose-900',
  indigo: 'text-indigo-900',
};

const TONO_BG_TOPBAR: Record<WizardStepperTono, string> = {
  amber: 'bg-amber-50 border-amber-200',
  sky: 'bg-sky-50 border-sky-200',
  purple: 'bg-purple-50 border-purple-200',
  teal: 'bg-teal-50 border-teal-200',
  emerald: 'bg-emerald-50 border-emerald-200',
  rose: 'bg-rose-50 border-rose-200',
  indigo: 'bg-indigo-50 border-indigo-200',
};

const TONO_TEXT_TOPBAR: Record<WizardStepperTono, string> = {
  amber: 'text-amber-700',
  sky: 'text-sky-700',
  purple: 'text-purple-700',
  teal: 'text-teal-700',
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  indigo: 'text-indigo-700',
};

const TONO_BTN_PRIMARY: Record<WizardStepperTono, string> = {
  amber: 'bg-amber-600 hover:bg-amber-700',
  sky: 'bg-sky-600 hover:bg-sky-700',
  purple: 'bg-purple-600 hover:bg-purple-700',
  teal: 'bg-teal-600 hover:bg-teal-700',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  rose: 'bg-rose-600 hover:bg-rose-700',
  indigo: 'bg-indigo-600 hover:bg-indigo-700',
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const WizardShellStepper: React.FC<WizardShellStepperProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onAtras,
  onSiguiente,
  onDescartar,
  onGuardarBorrador,
  tono,
  titulo,
  subtitulo,
  pasos,
  children,
  siguienteLabel = 'Siguiente',
  siguienteEsSubmit = false,
  siguienteDisabled = false,
  loading = false,
  size = 'lg',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSiguienteClick = () => {
    if (siguienteEsSubmit) onSubmit?.();
    else onSiguiente?.();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-stepper-title"
    >
      <div
        className={`w-full ${SIZE_CLASSES[size]} my-8`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header card */}
        <div className="bg-white border border-slate-200 border-b-0 rounded-t-2xl px-5 py-3 flex items-center justify-between">
          <div>
            <div id="wizard-stepper-title" className="text-[13px] font-bold text-slate-900">
              {titulo}
            </div>
            {subtitulo && (
              <div className="text-[10px] text-slate-500 mt-0.5">{subtitulo}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Cerrar wizard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card principal */}
        <div className="bg-white border border-slate-200 rounded-b-2xl shadow-sm overflow-hidden">
          {/* Stepper horizontal · canon mockup §4 */}
          <div className="border-b border-slate-200 px-5 py-3 bg-slate-50">
            <div className="flex items-center gap-2">
              {pasos.map((p, idx) => (
                <React.Fragment key={p.numero}>
                  <PasoCircle paso={p} tono={tono} />
                  {idx < pasos.length - 1 && (
                    <div
                      className={`flex-1 h-px transition-colors ${
                        p.completado ? TONO_LINE_COMPLETO[tono] : 'bg-slate-300'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Top bar · etiqueta paso · color tono */}
          {pasos.find((p) => p.actual) && (
            <div className={`border-b px-5 py-2 ${TONO_BG_TOPBAR[tono]}`}>
              <span className={`text-[10px] uppercase tracking-wider font-bold ${TONO_TEXT_TOPBAR[tono]}`}>
                PASO {pasos.find((p) => p.actual)!.numero} · {pasos.find((p) => p.actual)!.label}
              </span>
            </div>
          )}

          {/* Main · contenido */}
          <div className="p-5 min-h-[400px]">{children}</div>

          {/* Footer · canon N10 */}
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={onAtras}
              disabled={!onAtras || loading}
              className="text-[11px] font-semibold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-3 h-3" /> Atrás
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              {onDescartar && (
                <button
                  type="button"
                  onClick={onDescartar}
                  disabled={loading}
                  className="text-[11px] font-semibold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg disabled:opacity-40"
                >
                  Descartar
                </button>
              )}
              {onGuardarBorrador && (
                <button
                  type="button"
                  onClick={onGuardarBorrador}
                  disabled={loading}
                  className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-3 py-1.5 rounded-lg disabled:opacity-40"
                >
                  Guardar borrador
                </button>
              )}
              <button
                type="button"
                onClick={handleSiguienteClick}
                disabled={siguienteDisabled || loading}
                className={`text-[11px] font-bold text-white px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${TONO_BTN_PRIMARY[tono]}`}
              >
                {loading ? 'Procesando...' : siguienteLabel}
                {!loading && !siguienteEsSubmit && <ArrowRight className="w-3 h-3" />}
                {!loading && siguienteEsSubmit && <Check className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

interface PasoCircleProps {
  paso: WizardStepperPaso;
  tono: WizardStepperTono;
}

const PasoCircle: React.FC<PasoCircleProps> = ({ paso, tono }) => {
  if (paso.completado) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-7 h-7 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center">
          <Check className="w-3.5 h-3.5" />
        </div>
        <span className="text-[11px] text-slate-600 whitespace-nowrap">{paso.label}</span>
      </div>
    );
  }
  if (paso.actual) {
    return (
      <div className="flex items-center gap-1.5">
        <div
          className={`w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center ring-4 ring-white ${TONO_CIRCLE_ACTIVO[tono]}`}
        >
          {paso.numero}
        </div>
        <span className={`text-[11px] font-bold whitespace-nowrap ${TONO_LABEL_ACTIVO[tono]}`}>
          {paso.label}
        </span>
      </div>
    );
  }
  // Pendiente
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-7 h-7 rounded-full bg-white border-2 border-slate-300 text-slate-500 text-[11px] font-bold flex items-center justify-center">
        {paso.numero}
      </div>
      <span className="text-[11px] text-slate-500 whitespace-nowrap">{paso.label}</span>
    </div>
  );
};
