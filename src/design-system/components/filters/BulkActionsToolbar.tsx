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
import { Check, CircleDot, Tag, Layers, Download, Archive, X, ChevronDown } from 'lucide-react';

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onClear: () => void;
  onCambiarEstado?: () => void;
  onEtiquetar?: () => void;
  onCambiarLinea?: () => void;
  onExportar?: () => void;
  onArchivar?: () => void;
}

export const BulkActionsToolbar: React.FC<BulkActionsToolbarProps> = ({
  selectedCount,
  totalCount,
  onClear,
  onCambiarEstado,
  onEtiquetar,
  onCambiarLinea,
  onExportar,
  onArchivar,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-20 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl shadow-lg mb-3">
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 backdrop-blur rounded-lg w-8 h-8 flex items-center justify-center">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold tabular-nums">
              {selectedCount} producto{selectedCount === 1 ? '' : 's'} seleccionado{selectedCount === 1 ? '' : 's'}
            </div>
            <div className="text-[11px] text-teal-100 tabular-nums">de {totalCount} totales</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onCambiarEstado && (
            <BulkButton onClick={onCambiarEstado} icon={CircleDot} label="Cambiar estado" hasDropdown />
          )}
          {onEtiquetar && <BulkButton onClick={onEtiquetar} icon={Tag} label="Etiquetar" />}
          {onCambiarLinea && <BulkButton onClick={onCambiarLinea} icon={Layers} label="Cambiar línea" />}
          {onExportar && <BulkButton onClick={onExportar} icon={Download} label="Exportar" />}

          {onArchivar && (
            <>
              <div className="h-6 w-px bg-white/30 mx-1" />
              <button
                type="button"
                onClick={onArchivar}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/40 text-rose-100 hover:text-white backdrop-blur rounded-lg transition-all"
              >
                <Archive className="w-3.5 h-3.5" />
                Archivar
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
