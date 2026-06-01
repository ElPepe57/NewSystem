/**
 * ChipsActivos · banner de filtros activos · removibles individualmente
 *
 * Mockup canónico: docs/mockups/productos/07-filtros-bar-activos.html (banner debajo)
 *                  docs/mockups/productos/34-chips-filtros-activos.html
 *
 * Diseño:
 *   - Línea horizontal con flex wrap
 *   - "{X} de {Y} productos" + divider + "Filtros activos:" + chips
 *   - Cada chip: bg + border + label + botón X
 *   - Color por dominio: teal=date · amber=línea · purple=tipo · emerald=estado · slate=búsqueda
 */

import React from 'react';
import { X, Calendar, type LucideIcon } from 'lucide-react';

export type ChipColor = 'teal' | 'amber' | 'purple' | 'emerald' | 'rose' | 'sky' | 'indigo' | 'slate';

export interface ChipActivo {
  /** Identificador único: ej "date" · "linea:skincare" · "tipo:pack" · "search" */
  key: string;
  label: string;
  color: ChipColor;
  icon?: LucideIcon;
  onRemove: () => void;
}

interface ChipsActivosProps {
  resultCount: number;
  totalCount: number;
  chips: ChipActivo[];
  /** Sustantivo de la entidad contada (ej: 'productos', 'unidades'). Default 'productos'. */
  entityLabel?: string;
}

const COLOR_CLASSES: Record<ChipColor, string> = {
  teal: 'bg-teal-50 border-teal-200 text-teal-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  rose: 'bg-rose-50 border-rose-200 text-rose-700',
  sky: 'bg-sky-50 border-sky-200 text-sky-700',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  slate: 'bg-slate-100 border-slate-200 text-slate-700',
};

const REMOVE_HOVER_CLASSES: Record<ChipColor, string> = {
  teal: 'hover:bg-teal-100',
  amber: 'hover:bg-amber-100',
  purple: 'hover:bg-purple-100',
  emerald: 'hover:bg-emerald-100',
  rose: 'hover:bg-rose-100',
  sky: 'hover:bg-sky-100',
  indigo: 'hover:bg-indigo-100',
  slate: 'hover:bg-slate-200',
};

export const ChipsActivos: React.FC<ChipsActivosProps> = ({ resultCount, totalCount, chips, entityLabel = 'productos' }) => {
  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <span className="text-xs text-slate-500">
        <strong className="text-slate-900 tabular-nums">{resultCount}</strong> de{' '}
        <strong className="text-slate-900 tabular-nums">{totalCount}</strong> {entityLabel}
      </span>
      <span className="text-slate-300">·</span>
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Filtros activos:</span>
      {chips.map(chip => {
        const Icon = chip.icon ?? (chip.color === 'teal' ? Calendar : undefined);
        return (
          <span
            key={chip.key}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium ${COLOR_CLASSES[chip.color]}`}
          >
            {Icon && <Icon className="w-2.5 h-2.5" />}
            <span>{chip.label}</span>
            <button
              type="button"
              onClick={chip.onRemove}
              className={`rounded p-0.5 transition-colors ${REMOVE_HOVER_CLASSES[chip.color]}`}
              aria-label={`Quitar ${chip.label}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        );
      })}
    </div>
  );
};
