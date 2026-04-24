import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmarSalidaWizardModalProps {
  /** Si el modal se muestra */
  isOpen: boolean;
  /** Resumen corto de los datos en progreso (ej: "Asian Beauty · 1 producto · $203") */
  resumen?: string;
  /** Paso actual (ej: "Paso 2 de 5") */
  pasoActual?: string;
  /** Callback: guardar como borrador y cerrar */
  onGuardarBorrador: () => void;
  /** Callback: descartar todo y cerrar */
  onDescartar: () => void;
  /** Callback: cancelar el cierre (mantener el wizard abierto) */
  onSeguirEditando: () => void;
  /** Texto del wizard (ej: "esta orden", "este envío") — default "estos cambios" */
  contextoSingular?: string;
}

/**
 * Modal de confirmación al intentar cerrar un wizard con cambios sin guardar.
 *
 * Tres acciones claras:
 *   1. Guardar borrador (verde, primario) — persiste el state y cierra.
 *      El usuario podrá retomar al reabrir vía el banner "Tienes un borrador".
 *   2. Descartar (rojo, secundario) — elimina cualquier borrador existente
 *      y cierra. Útil cuando el usuario se arrepintió.
 *   3. Seguir editando (gris, cancel) — cierra el modal pero mantiene el
 *      wizard abierto con todos los datos intactos.
 *
 * Patrón UX similar a Gmail, Notion, Linear: al cerrar una composición con
 * cambios, preguntar explícitamente qué hacer en vez de autoguardado mudo.
 */
export const ConfirmarSalidaWizardModal: React.FC<
  ConfirmarSalidaWizardModalProps
> = ({
  isOpen,
  resumen,
  pasoActual,
  onGuardarBorrador,
  onDescartar,
  onSeguirEditando,
  contextoSingular = 'estos cambios',
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onSeguirEditando}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-[fadeIn_150ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 leading-tight">
                Tienes cambios sin guardar
              </h3>
              {(resumen || pasoActual) && (
                <div className="mt-1 text-sm text-slate-600 truncate">
                  {resumen}
                  {resumen && pasoActual && (
                    <span className="text-slate-400 mx-1.5">·</span>
                  )}
                  {pasoActual && (
                    <span className="text-slate-500">{pasoActual}</span>
                  )}
                </div>
              )}
              <p className="text-sm text-slate-500 mt-3">
                ¿Qué quieres hacer con {contextoSingular}?
              </p>
            </div>
            <button
              type="button"
              onClick={onSeguirEditando}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 -mt-1 -mr-1 transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Acciones */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDescartar}
            className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Descartar
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSeguirEditando}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Seguir editando
            </button>
            <button
              type="button"
              onClick={onGuardarBorrador}
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-sm"
            >
              Guardar borrador
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
