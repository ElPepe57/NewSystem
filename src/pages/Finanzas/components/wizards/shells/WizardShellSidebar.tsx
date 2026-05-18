/**
 * WizardShellSidebar — chk5.D-S4.b · SF1
 *
 * Shell shared para wizards multi-step con sidebar vertical canon MOCK 3 §3.
 * Pixel-perfect contra `docs/mockups/finanzas-wizards-completos-v5.1.html`.
 *
 * Layout canon:
 *   - Backdrop overlay con `bg-slate-900/50`
 *   - Card central · max-w-5xl · rounded-2xl
 *   - Top header opcional con tinte (label paso + descripción)
 *   - Grid 12 cols min-h-[560px]:
 *     · col-span-3 · Sidebar pasos numerados con check verde / activo / pendiente
 *     · col-span-9 · Main · contenido del paso actual
 *   - Footer canon · [← Atrás] [Descartar] [Guardar borrador] [Siguiente →]
 *
 * Usado por: B.1 PagoAbonoWizard · B.3 PagosMasivosWizard (4 pasos sidebar).
 *
 * Diseño N1+N10 · color del wizard (`tono`) determina active state purple/indigo/etc.
 */

import React, { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export type WizardSidebarTono = 'purple' | 'indigo' | 'teal' | 'amber' | 'emerald' | 'rose';

export interface WizardPasoItem {
  /** Número del paso (1-N) */
  numero: number;
  /** Label visible del paso · ej "Entidad + medio" */
  label: string;
  /** Si está completado · render check verde */
  completado: boolean;
  /** Si es el paso actual · render destacado con tinte */
  actual: boolean;
}

export interface WizardContextoItem {
  label: string;
  /** Valor visible · ej "Premium SA" · "S/ 8,000" */
  valor: React.ReactNode;
  /** Color opcional del valor · default slate-900 */
  valorColor?: 'slate' | 'rose' | 'emerald' | 'amber' | 'purple' | 'indigo';
}

export interface WizardShellSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Submit final del wizard (último paso) */
  onSubmit?: () => void;
  /** Atrás · click en footer izquierdo */
  onAtras?: () => void;
  /** Siguiente · click en footer derecho */
  onSiguiente?: () => void;
  /** Descartar borrador · footer */
  onDescartar?: () => void;
  /** Guardar borrador · footer */
  onGuardarBorrador?: () => void;

  /** Tinte canon del wizard · ej 'purple' (PagoAbono) · 'indigo' (PagosMasivos) */
  tono: WizardSidebarTono;
  /** Título del wizard · ej "PagoAbono distribuido" */
  titulo: string;
  /** Pasos · array completo (4 items típicamente) */
  pasos: WizardPasoItem[];
  /** Contexto inferior del sidebar · key-value pairs */
  contexto?: WizardContextoItem[];
  /** Header del top (label paso + descripción) opcional */
  topBarLabel?: string;
  topBarSubtitulo?: string;
  /** Contenido del main (cuerpo del paso actual) */
  children: React.ReactNode;
  /** Label del botón siguiente · default "Siguiente" */
  siguienteLabel?: string;
  /** Si true · el botón siguiente actúa como submit final · default false */
  siguienteEsSubmit?: boolean;
  /** Disabled del botón siguiente · default false */
  siguienteDisabled?: boolean;
  /** Loading state del submit */
  loading?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════
// MAPS canon · clases por tono
// ═════════════════════════════════════════════════════════════════════════

const TONO_BG_TOPBAR: Record<WizardSidebarTono, string> = {
  purple: 'bg-purple-50 border-purple-200',
  indigo: 'bg-indigo-50 border-indigo-200',
  teal: 'bg-teal-50 border-teal-200',
  amber: 'bg-amber-50 border-amber-200',
  emerald: 'bg-emerald-50 border-emerald-200',
  rose: 'bg-rose-50 border-rose-200',
};

const TONO_TEXT_TOPBAR: Record<WizardSidebarTono, string> = {
  purple: 'text-purple-700',
  indigo: 'text-indigo-700',
  teal: 'text-teal-700',
  amber: 'text-amber-700',
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
};

const TONO_TEXT_SUBTITULO: Record<WizardSidebarTono, string> = {
  purple: 'text-purple-600',
  indigo: 'text-indigo-600',
  teal: 'text-teal-600',
  amber: 'text-amber-600',
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
};

const TONO_PASO_ACTIVO_BG: Record<WizardSidebarTono, string> = {
  purple: 'bg-purple-50 ring-1 ring-purple-200',
  indigo: 'bg-indigo-50 ring-1 ring-indigo-200',
  teal: 'bg-teal-50 ring-1 ring-teal-200',
  amber: 'bg-amber-50 ring-1 ring-amber-200',
  emerald: 'bg-emerald-50 ring-1 ring-emerald-200',
  rose: 'bg-rose-50 ring-1 ring-rose-200',
};

const TONO_PASO_ACTIVO_CIRCLE: Record<WizardSidebarTono, string> = {
  purple: 'bg-purple-600',
  indigo: 'bg-indigo-600',
  teal: 'bg-teal-600',
  amber: 'bg-amber-600',
  emerald: 'bg-emerald-600',
  rose: 'bg-rose-600',
};

const TONO_PASO_ACTIVO_TEXT: Record<WizardSidebarTono, string> = {
  purple: 'text-purple-900',
  indigo: 'text-indigo-900',
  teal: 'text-teal-900',
  amber: 'text-amber-900',
  emerald: 'text-emerald-900',
  rose: 'text-rose-900',
};

const TONO_BTN_PRIMARY: Record<WizardSidebarTono, string> = {
  purple: 'bg-purple-600 hover:bg-purple-700',
  indigo: 'bg-indigo-600 hover:bg-indigo-700',
  teal: 'bg-teal-600 hover:bg-teal-700',
  amber: 'bg-amber-600 hover:bg-amber-700',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  rose: 'bg-rose-600 hover:bg-rose-700',
};

const CONTEXTO_COLOR: Record<NonNullable<WizardContextoItem['valorColor']>, string> = {
  slate: 'text-slate-900',
  rose: 'text-rose-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  purple: 'text-purple-700',
  indigo: 'text-indigo-700',
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const WizardShellSidebar: React.FC<WizardShellSidebarProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onAtras,
  onSiguiente,
  onDescartar,
  onGuardarBorrador,
  tono,
  titulo,
  pasos,
  contexto,
  topBarLabel,
  topBarSubtitulo,
  children,
  siguienteLabel = 'Siguiente',
  siguienteEsSubmit = false,
  siguienteDisabled = false,
  loading = false,
}) => {
  // Cerrar con Escape
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
      aria-labelledby="wizard-shell-title"
    >
      <div
        className="w-full max-w-5xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header card · cierre · tono accent */}
        <div className="bg-white border border-slate-200 border-b-0 rounded-t-2xl px-5 py-3 flex items-center justify-between">
          <div id="wizard-shell-title" className="text-[13px] font-bold text-slate-900">
            {titulo}
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
          {/* Top bar · etiqueta paso · color tono */}
          {topBarLabel && (
            <div
              className={`border-b px-5 py-2 flex items-center justify-between gap-2 flex-wrap ${TONO_BG_TOPBAR[tono]}`}
            >
              <span
                className={`text-[10px] uppercase tracking-wider font-bold ${TONO_TEXT_TOPBAR[tono]}`}
              >
                {topBarLabel}
              </span>
              {topBarSubtitulo && (
                <span className={`text-[10px] ${TONO_TEXT_SUBTITULO[tono]}`}>{topBarSubtitulo}</span>
              )}
            </div>
          )}

          {/* Grid 12 cols · sidebar + main */}
          <div className="grid grid-cols-12 min-h-[560px]">
            {/* Sidebar · col-span-3 */}
            <aside className="col-span-12 sm:col-span-3 bg-slate-50/50 border-b sm:border-b-0 sm:border-r border-slate-200 p-4 space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3">
                Pasos · {titulo}
              </div>
              {pasos.map((p) => (
                <PasoItem key={p.numero} paso={p} tono={tono} />
              ))}

              {contexto && contexto.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                    Contexto
                  </div>
                  <div className="text-[11px] text-slate-700 space-y-1">
                    {contexto.map((c, idx) => (
                      <div key={idx}>
                        <span className="text-slate-500">{c.label}:</span>{' '}
                        <span className={`font-bold ${CONTEXTO_COLOR[c.valorColor ?? 'slate']}`}>
                          {c.valor}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>

            {/* Main · col-span-9 */}
            <div className="col-span-12 sm:col-span-9 p-5">{children}</div>
          </div>

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
// SUB-COMPONENTE · PASO ITEM
// ═════════════════════════════════════════════════════════════════════════

interface PasoItemProps {
  paso: WizardPasoItem;
  tono: WizardSidebarTono;
}

const PasoItem: React.FC<PasoItemProps> = ({ paso, tono }) => {
  if (paso.completado) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg text-emerald-700">
        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center">
          <Check className="w-3 h-3" />
        </span>
        <span className="text-[12px]">{paso.label}</span>
      </div>
    );
  }
  if (paso.actual) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded-lg ${TONO_PASO_ACTIVO_BG[tono]}`}>
        <span
          className={`w-6 h-6 rounded-full text-white text-[11px] font-bold flex items-center justify-center ${TONO_PASO_ACTIVO_CIRCLE[tono]}`}
        >
          {paso.numero}
        </span>
        <span className={`text-[12px] font-bold ${TONO_PASO_ACTIVO_TEXT[tono]}`}>{paso.label}</span>
      </div>
    );
  }
  // Pendiente
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg text-slate-500">
      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center justify-center">
        {paso.numero}
      </span>
      <span className="text-[12px]">{paso.label}</span>
    </div>
  );
};
