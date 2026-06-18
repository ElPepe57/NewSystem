/**
 * BulkActionsToolbar · barra de acciones masivas (sticky top)
 *
 * Mockup canónico: docs/mockups/productos/09-bulk-actions-toolbar.html
 *
 * Diseño:
 *   - Aparece sobre el listado cuando hay ≥1 producto seleccionado
 *   - Sticky top con z-20 · gradient teal-600 → teal-700 · texto blanco
 *   - Lado izq: badge "{N} seleccionados" + sub "de {total} totales"
 *   - Lado der: 4 acciones soft + divider + acción destructiva (Archivar) + X clear
 *
 * Las acciones son callbacks · este componente NO maneja state.
 */

import React from 'react';
import { Check, CircleDot, Tag, Layers, Download, Archive, X, ChevronDown, type LucideIcon } from 'lucide-react';
import type { ColorIdentidad } from '../../grupoColor';

/** Acción genérica para la toolbar (módulos no-Productos · ej. Compras). */
export interface BulkAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  hasDropdown?: boolean;
}

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onClear: () => void;
  // ── API legacy (Productos) · se mantiene intacta ──
  onCambiarEstado?: () => void;
  onEtiquetar?: () => void;
  onCambiarLinea?: () => void;
  onExportar?: () => void;
  onArchivar?: () => void;
  // ── API genérica (canon · cualquier módulo) ──
  /** Color de identidad del grupo (gradient + acento). Default 'teal'. */
  color?: ColorIdentidad;
  /** Nombre de la entidad en singular (default 'producto'). */
  entityLabel?: string;
  /** La entidad es femenina (→ 'seleccionada'). Default false. */
  entityLabelFem?: boolean;
  /** Acciones genéricas · si se pasan, reemplazan a las named (Productos). */
  actions?: BulkAction[];
  /** Acción destructiva genérica (reemplaza 'Archivar'). */
  destructiveAction?: { icon: LucideIcon; label: string; onClick: () => void };
}

const BULK_GRADIENT: Record<ColorIdentidad, string> = {
  teal: 'from-teal-600 to-teal-700',
  violet: 'from-violet-600 to-violet-700',
  blue: 'from-blue-600 to-blue-700',
  orange: 'from-orange-600 to-orange-700',
  indigo: 'from-indigo-600 to-indigo-700',
  slate: 'from-slate-700 to-slate-800',
};

const BULK_SUBTEXT: Record<ColorIdentidad, string> = {
  teal: 'text-teal-100', violet: 'text-violet-100', blue: 'text-blue-100',
  orange: 'text-orange-100', indigo: 'text-indigo-100', slate: 'text-slate-300',
};

export const BulkActionsToolbar: React.FC<BulkActionsToolbarProps> = ({
  selectedCount,
  totalCount,
  onClear,
  onCambiarEstado,
  onEtiquetar,
  onCambiarLinea,
  onExportar,
  onArchivar,
  color = 'teal',
  entityLabel = 'producto',
  entityLabelFem = false,
  actions,
  destructiveAction,
}) => {
  if (selectedCount === 0) return null;
  const plural = selectedCount === 1 ? '' : 's';
  const sufFem = entityLabelFem ? 'a' : 'o';
  const DestIcon = destructiveAction?.icon ?? Archive;

  return (
    <div className={`sticky top-0 z-20 bg-gradient-to-r ${BULK_GRADIENT[color]} text-white rounded-xl shadow-lg mb-3`}>
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 backdrop-blur rounded-lg w-8 h-8 flex items-center justify-center">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold tabular-nums">
              {selectedCount} {entityLabel}{plural} seleccionad{sufFem}{plural}
            </div>
            <div className={`text-[11px] ${BULK_SUBTEXT[color]} tabular-nums`}>de {totalCount} totales</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {actions && actions.length > 0 ? (
            actions.map((act) => (
              <BulkButton key={act.label} onClick={act.onClick} icon={act.icon} label={act.label} hasDropdown={act.hasDropdown} />
            ))
          ) : (
            <>
              {onCambiarEstado && (
                <BulkButton onClick={onCambiarEstado} icon={CircleDot} label="Cambiar estado" hasDropdown />
              )}
              {onEtiquetar && <BulkButton onClick={onEtiquetar} icon={Tag} label="Etiquetar" />}
              {onCambiarLinea && <BulkButton onClick={onCambiarLinea} icon={Layers} label="Cambiar línea" />}
              {onExportar && <BulkButton onClick={onExportar} icon={Download} label="Exportar" />}
            </>
          )}

          {(destructiveAction || onArchivar) && (
            <>
              <div className="h-6 w-px bg-white/30 mx-1" />
              <button
                type="button"
                onClick={destructiveAction ? destructiveAction.onClick : onArchivar}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/40 text-rose-100 hover:text-white backdrop-blur rounded-lg transition-all"
              >
                <DestIcon className="w-3.5 h-3.5" />
                {destructiveAction ? destructiveAction.label : 'Archivar'}
              </button>
            </>
          )}

          <div className="h-6 w-px bg-white/30 mx-1" />
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium hover:bg-white/15 rounded-lg transition-all"
            title="Limpiar selección"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const BulkButton: React.FC<{ onClick: () => void; icon: typeof Check; label: string; hasDropdown?: boolean }> = ({
  onClick,
  icon: Icon,
  label,
  hasDropdown,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/15 hover:bg-white/25 backdrop-blur rounded-lg transition-all"
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
    {hasDropdown && <ChevronDown className="w-3 h-3 opacity-70" />}
  </button>
);
