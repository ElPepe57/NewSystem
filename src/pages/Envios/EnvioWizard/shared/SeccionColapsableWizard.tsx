/**
 * SeccionColapsableWizard — Átomo de sección numerada colapsable estilo OCWizardV3
 *
 * S52 · D-8: cada sección del wizard tiene 2 estados:
 *   - EXPANDED: título + contenido expandido (form completo)
 *   - COLLAPSED: título + resumen de la selección + link "Cambiar"
 *
 * El componente es "controlled": recibe `collapsed` + `onToggle`. El padre
 * decide cuándo colapsar/expandir (típicamente al seleccionar una opción).
 */
import React from 'react';

interface Props {
  /** Número del badge circular (1, 2, 3, ...) */
  numero: number | string;
  /** Título de la sección (pregunta en lenguaje humano) */
  titulo: string;
  /** Subtítulo opcional con contexto corto */
  subtitulo?: string;
  /** Estado colapsado/expandido */
  collapsed: boolean;
  /** Callback al hacer click en "Cambiar" (solo cuando está collapsed) */
  onToggle: () => void;
  /** `true` si la sección aún no está desbloqueada (gris, no interactiva) */
  disabled?: boolean;
  /** Contenido del resumen cuando está COLLAPSED (React node para flexibilidad) */
  resumen?: React.ReactNode;
  /** Contenido del form cuando está EXPANDED */
  children?: React.ReactNode;
  /** Texto adicional a la derecha del header (ej. contador "14 / 47 seleccionadas") */
  headerExtra?: React.ReactNode;
  /** Variante del badge: 'activo' (teal) o 'completado' (teal-100) */
  variante?: 'activo' | 'completado';
}

export const SeccionColapsableWizard: React.FC<Props> = ({
  numero,
  titulo,
  subtitulo,
  collapsed,
  onToggle,
  disabled = false,
  resumen,
  children,
  headerExtra,
  variante = 'activo',
}) => {
  const badgeClases = disabled
    ? 'bg-slate-100 text-slate-400'
    : variante === 'activo'
    ? 'bg-teal-600 text-white'
    : 'bg-teal-100 text-teal-700';

  const bordeContainer = disabled
    ? 'border-slate-200 opacity-60'
    : 'border-slate-200';

  return (
    <div className={`border rounded-xl overflow-hidden ${bordeContainer}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeClases}`}
          >
            {numero}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 truncate">
              {titulo}
            </h4>
            {subtitulo && !collapsed && (
              <p className="text-[11px] text-slate-500 mt-0.5">{subtitulo}</p>
            )}
          </div>
        </div>

        {/* Right: headerExtra (counter) O botón Cambiar (si collapsed) */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {headerExtra}
          {collapsed && !disabled && (
            <button
              type="button"
              onClick={onToggle}
              className="text-xs font-medium text-teal-600 hover:text-teal-700"
            >
              Cambiar
            </button>
          )}
        </div>
      </div>

      {/* Body — resumen o children */}
      {!disabled && (
        <div className="p-4">{collapsed ? resumen : children}</div>
      )}
      {disabled && (
        <div className="p-4">
          <div className="text-xs text-slate-400 italic text-center py-2">
            Completá la sección anterior para continuar.
          </div>
        </div>
      )}
    </div>
  );
};
