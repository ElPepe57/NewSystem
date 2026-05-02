/**
 * FiltrosBar · barra de filtros canónica del módulo Productos V2
 *
 * Mockup canónico:
 *   - 06 (default sin filtros)
 *   - 07 (con filtros aplicados · estado activo + botón "Limpiar")
 *
 * Diseño:
 *   - Card blanca + border slate-200 · interior space-y-2.5
 *   - Fila 1 (chips por dimensión): DateRange + dividers + ChipGroups (Línea/Tipo/Estado)
 *   - Border-t separador
 *   - Fila 2 (búsqueda + orden): SearchInput flex-1 + Sort dropdown + (Clear si hayFiltros)
 *
 * Estados visuales activos (mockup 07):
 *   - DateRange: bg-teal-50 + ring + texto teal-700
 *   - Chip seleccionado: bg-{color}-100 + ring-2 ring-{color}-300
 *   - SearchInput con valor: border-teal-300 + ring-2 ring-teal-100 + botón X visible
 *   - Botón "Limpiar": visible solo cuando hayFiltrosActivos
 *
 * NOTA · API compositional: por simplicidad de Fase 2 se mantiene como componente
 * con props · refactor a sub-componentes <FiltrosBar.ChipGroup> queda para iteración
 * futura cuando se identifiquen otros consumidores con necesidades similares.
 */

import React from 'react';
import { Calendar, ChevronDown, Search, X, ArrowUpDown, type LucideIcon } from 'lucide-react';

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export type DateRangePreset = 'todo' | '7d' | '30d' | '90d' | '6m' | 'año';

export interface ChipOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  variant: 'amber' | 'indigo' | 'emerald' | 'rose' | 'sky' | 'purple' | 'slate' | 'teal';
}

export interface ChipGroupConfig {
  key: string;
  label: string;
  options: ChipOption[];
  /** Selección multi-valor (default true) */
  multi?: boolean;
}

export type SortOption = { value: string; label: string };

interface FiltrosBarProps {
  // Date range
  dateRange?: DateRangePreset;
  onDateRangeChange?: (preset: DateRangePreset) => void;

  // Chips por dimensión
  chipGroups: ChipGroupConfig[];
  selecciones: Record<string, string[]>; // { 'linea': ['skincare'], 'tipo': ['pack'] }
  onChipToggle: (groupKey: string, value: string) => void;

  // Búsqueda
  searchTerm: string;
  searchPlaceholder?: string;
  onSearchChange: (term: string) => void;

  // Sort
  sortValue: string;
  sortOptions: SortOption[];
  onSortChange: (value: string) => void;

  // Limpiar global
  hayFiltrosActivos: boolean;
  onLimpiarTodo: () => void;
}

// ─── Utilidades visuales ─────────────────────────────────────────────────────

const CHIP_DEFAULT_CLASSES =
  'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200 transition-all';

const CHIP_HOVER_BY_VARIANT: Record<ChipOption['variant'], string> = {
  amber: 'hover:bg-amber-50',
  indigo: 'hover:bg-indigo-50',
  emerald: 'hover:bg-emerald-50',
  rose: 'hover:bg-rose-50',
  sky: 'hover:bg-sky-50',
  purple: 'hover:bg-purple-50',
  slate: 'hover:bg-slate-50',
  teal: 'hover:bg-teal-50',
};

const CHIP_ACTIVE_BY_VARIANT: Record<ChipOption['variant'], string> = {
  amber: 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 ring-2 ring-amber-300',
  indigo: 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300',
  emerald: 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300',
  rose: 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 ring-2 ring-rose-300',
  sky: 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 ring-2 ring-sky-300',
  purple: 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 ring-2 ring-purple-300',
  slate: 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 ring-2 ring-slate-300',
  teal: 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-teal-100 text-teal-700 ring-2 ring-teal-300',
};

const DATE_PRESET_LABEL: Record<DateRangePreset, string> = {
  todo: 'Todo el período',
  '7d': 'Últ. 7 días',
  '30d': 'Últ. 30 días',
  '90d': 'Últ. 90 días',
  '6m': 'Últ. 6 meses',
  año: 'Últ. año',
};

// ─── Componente principal ────────────────────────────────────────────────────

export const FiltrosBar: React.FC<FiltrosBarProps> = ({
  dateRange,
  onDateRangeChange,
  chipGroups,
  selecciones,
  onChipToggle,
  searchTerm,
  searchPlaceholder = 'Buscar...',
  onSearchChange,
  sortValue,
  sortOptions,
  onSortChange,
  hayFiltrosActivos,
  onLimpiarTodo,
}) => {
  const dateActive = !!dateRange && dateRange !== 'todo';
  const searchActive = searchTerm.trim().length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4">
      <div className="space-y-2.5">
        {/* FILA 1 · DateRange + Chips por dimensión */}
        <div className="flex items-center gap-2 flex-wrap">
          {dateRange !== undefined && onDateRangeChange && (
            <>
              <DateRangeButton value={dateRange} active={dateActive} onCycle={onDateRangeChange} />
              <Divider />
            </>
          )}

          {chipGroups.map((group, idx) => {
            const groupSelecciones = selecciones[group.key] ?? [];
            return (
              <React.Fragment key={group.key}>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{group.label}:</span>
                {group.options.map(opt => {
                  const isActive = groupSelecciones.includes(opt.value);
                  const className = isActive
                    ? CHIP_ACTIVE_BY_VARIANT[opt.variant]
                    : `${CHIP_DEFAULT_CLASSES} ${CHIP_HOVER_BY_VARIANT[opt.variant]}`;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onChipToggle(group.key, opt.value)}
                      type="button"
                      className={className}
                    >
                      {opt.icon && <opt.icon className="w-2.5 h-2.5" />}
                      <span>{opt.label}</span>
                      {opt.count !== undefined && <span className="opacity-60 tabular-nums">{opt.count}</span>}
                    </button>
                  );
                })}
                {idx < chipGroups.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="border-t border-slate-100" />

        {/* FILA 2 · Búsqueda + Sort + (Limpiar) */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={`w-full pl-9 pr-9 py-2 text-sm rounded-lg focus:outline-none placeholder:text-slate-400 ${
                searchActive
                  ? 'border border-teal-300 ring-2 ring-teal-100'
                  : 'border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-transparent'
              }`}
            />
            {searchActive && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <SortDropdown value={sortValue} options={sortOptions} onChange={onSortChange} />
          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={onLimpiarTodo}
              className="text-[10px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 px-2 py-2 hover:bg-teal-50 rounded-lg whitespace-nowrap"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-componentes internos ────────────────────────────────────────────────

const Divider: React.FC = () => <div className="h-5 w-px bg-slate-200" />;

const DateRangeButton: React.FC<{ value: DateRangePreset; active: boolean; onCycle: (next: DateRangePreset) => void }> = ({
  value,
  active,
  onCycle,
}) => {
  // Por simplicidad: click cicla por presets. Una iteración futura abrirá un dropdown popover.
  const presets: DateRangePreset[] = ['todo', '7d', '30d', '90d', '6m', 'año'];
  const handleClick = () => {
    const idx = presets.indexOf(value);
    onCycle(presets[(idx + 1) % presets.length]);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
        active
          ? 'bg-teal-50 border border-teal-200 ring-2 ring-teal-100'
          : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
      }`}
    >
      <Calendar className={`w-3.5 h-3.5 ${active ? 'text-teal-600' : 'text-teal-600'}`} />
      <span className={`text-xs font-medium ${active ? 'text-teal-700 font-bold' : 'text-slate-700'}`}>{DATE_PRESET_LABEL[value]}</span>
      <ChevronDown className={`w-3 h-3 ${active ? 'text-teal-500' : 'text-slate-400'}`} />
    </button>
  );
};

const SortDropdown: React.FC<{ value: string; options: SortOption[]; onChange: (v: string) => void }> = ({
  value,
  options,
  onChange,
}) => {
  const currentLabel = options.find(o => o.value === value)?.label ?? options[0]?.label ?? '';
  return (
    <div className="relative">
      <button
        type="button"
        className="bg-slate-50 border border-slate-200 text-slate-700 font-medium text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-slate-100 transition-all"
      >
        <ArrowUpDown className="w-3 h-3 text-slate-400" />
        <span className="text-slate-400 font-normal">Ordenar:</span>
        <span>{currentLabel}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>
      {/* Select nativo invisible para mantenerlo simple en Fase 2 · UX mejorable luego */}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label="Ordenar"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
};
