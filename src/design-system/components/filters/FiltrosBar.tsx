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

import React, { useRef, useState, useEffect } from 'react';
import { Calendar, ChevronDown, Search, X, ArrowUpDown, MapPin, Check, type LucideIcon } from 'lucide-react';
import { FloatingDropdown } from '../maestros/FloatingDropdown';

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export type DateRangePreset = 'todo' | '7d' | '30d' | '90d' | '6m' | 'año';

export interface ChipOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  /** Emoji opcional ANTES del label (ej: bandera de país, icono de línea) · prioritario sobre icon */
  emojiPrefix?: string;
  /** Color HEX directo (override · usa CSS inline en lugar de variant Tailwind) */
  hexColor?: string;
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

/**
 * Filtro single-select que se renderiza al inicio de la fila 1 como dropdown
 * botón compacto · ej "Todas las ubicaciones ▼" en Inventario.
 *
 * Soporta dos formatos de opciones:
 *   1. Flat: { value, label, icon? }[]  → lista plana sin grupos
 *   2. Grouped: { groupLabel, groupIcon?, options }[] → secciones agrupadas
 *      con label uppercase pequeño tipo Notion/Linear (ej "Viajeros · Couriers
 *      · Almacenes Perú")
 */
export interface LeadingFilterOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

export interface LeadingFilterOptionGroup {
  groupLabel: string;
  groupIcon?: LucideIcon;
  options: LeadingFilterOption[];
}

export interface LeadingFilterConfig {
  label: string;
  icon?: LucideIcon;
  /** Valor actual · '' = "Todas/Todos" */
  value: string;
  /**
   * Opciones disponibles. Acepta:
   *  - LeadingFilterOption[] (flat) · primer item suele ser "Todas/Todos"
   *  - LeadingFilterOptionGroup[] (grouped) · secciones agrupadas
   */
  options: LeadingFilterOption[] | LeadingFilterOptionGroup[];
  /**
   * Item "Todas/Todos" mostrado SIEMPRE arriba del menú cuando se usa formato
   * grouped (porque value '' no encaja en ningún grupo). Opcional.
   */
  allOption?: LeadingFilterOption;
  onChange: (value: string) => void;
}

const isGroupedOptions = (
  opts: LeadingFilterOption[] | LeadingFilterOptionGroup[]
): opts is LeadingFilterOptionGroup[] => {
  return opts.length > 0 && (opts[0] as LeadingFilterOptionGroup).options !== undefined;
};

interface FiltrosBarProps {
  // Date range
  dateRange?: DateRangePreset;
  onDateRangeChange?: (preset: DateRangePreset) => void;

  /**
   * Filtro líder al inicio de la fila 1 (opcional · ej "Todas las ubicaciones").
   * Se renderiza como dropdown botón compacto antes de los chipGroups.
   */
  leadingFilter?: LeadingFilterConfig;

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

/**
 * Color del ícono Lucide en estado default (chip NO activo).
 * El chip mantiene fondo blanco + texto slate (canon F3) pero el ícono
 * lleva el color del variant para distinción visual cross-dimensión.
 *
 * En estado activo, el ícono hereda el `text-{variant}-700` del chip entero.
 */
const CHIP_ICON_COLOR_BY_VARIANT: Record<ChipOption['variant'], string> = {
  amber: 'text-amber-600',
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
  sky: 'text-sky-600',
  purple: 'text-purple-600',
  slate: 'text-slate-500',
  teal: 'text-teal-600',
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
  leadingFilter,
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
        {/* FILA 1 · DateRange + LeadingFilter + Chips por dimensión */}
        <div className="flex items-center gap-2 flex-wrap">
          {dateRange !== undefined && onDateRangeChange && (
            <>
              <DateRangeButton value={dateRange} active={dateActive} onCycle={onDateRangeChange} />
              <Divider />
            </>
          )}

          {leadingFilter && (
            <>
              <LeadingFilterDropdown config={leadingFilter} />
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
                  // Si hay hexColor, override CSS inline · si no, variant Tailwind
                  const useHex = !!opt.hexColor;
                  const inlineStyle: React.CSSProperties | undefined = useHex
                    ? isActive
                      ? { backgroundColor: `${opt.hexColor}20`, color: opt.hexColor, boxShadow: `0 0 0 2px ${opt.hexColor}50` }
                      : undefined
                    : undefined;
                  const className = useHex
                    ? `inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-all ${
                        isActive ? '' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`
                    : isActive
                      ? CHIP_ACTIVE_BY_VARIANT[opt.variant]
                      : `${CHIP_DEFAULT_CLASSES} ${CHIP_HOVER_BY_VARIANT[opt.variant]}`;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onChipToggle(group.key, opt.value)}
                      type="button"
                      className={className}
                      style={inlineStyle}
                    >
                      {opt.emojiPrefix ? (
                        <span className="text-[11px] leading-none">{opt.emojiPrefix}</span>
                      ) : opt.icon ? (
                        <opt.icon
                          className={`w-2.5 h-2.5 ${
                            isActive ? '' : CHIP_ICON_COLOR_BY_VARIANT[opt.variant]
                          }`}
                        />
                      ) : null}
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

// Helper · cuenta total de items en el menú (flat o agrupado)
const countMenuItems = (config: LeadingFilterConfig): number => {
  if (isGroupedOptions(config.options)) {
    return config.options.reduce((s, g) => s + g.options.length, 0)
      + config.options.length // labels de grupos
      + (config.allOption ? 1 : 0);
  }
  return config.options.length;
};

// Helper · obtiene el label actual seleccionado (flat o agrupado)
const getCurrentLabel = (config: LeadingFilterConfig): string => {
  if (config.value === '' && config.allOption) return config.allOption.label;
  if (isGroupedOptions(config.options)) {
    for (const group of config.options) {
      const found = group.options.find(o => o.value === config.value);
      if (found) return found.label;
    }
    return config.allOption?.label ?? config.label;
  }
  return config.options.find(o => o.value === config.value)?.label
    ?? config.options[0]?.label
    ?? config.label;
};

interface MenuItemProps {
  option: LeadingFilterOption;
  isSelected: boolean;
  onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ option, isSelected, onClick }) => {
  const Icon = option.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
        isSelected
          ? 'bg-teal-50 text-teal-700 font-semibold'
          : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`} />}
        <span className="truncate">{option.label}</span>
      </span>
      {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />}
    </button>
  );
};

const LeadingFilterDropdown: React.FC<{ config: LeadingFilterConfig }> = ({ config }) => {
  const Icon = config.icon ?? MapPin;
  const currentLabel = getCurrentLabel(config);
  const active = config.value !== '';

  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Click outside · cierra el dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        anchorRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSelect = (value: string) => {
    config.onChange(value);
    setIsOpen(false);
  };

  const grouped = isGroupedOptions(config.options);

  return (
    <>
      <div ref={anchorRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(o => !o)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
            active
              ? 'bg-teal-50 border border-teal-200 ring-2 ring-teal-100'
              : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Icon className="w-3.5 h-3.5 text-teal-600" />
          <span className={`text-xs font-medium whitespace-nowrap ${active ? 'text-teal-700 font-bold' : 'text-slate-700'}`}>
            {currentLabel}
          </span>
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <FloatingDropdown
        anchorRef={anchorRef}
        dropdownRef={dropdownRef}
        isOpen={isOpen}
        offset={6}
        estimatedHeight={Math.min(420, countMenuItems(config) * 30 + 32)}
      >
        <div
          ref={dropdownRef}
          className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-[420px] overflow-y-auto py-1"
          style={{ minWidth: 240 }}
        >
          {/* Item "Todas/Todos" (cuando hay grupos) */}
          {grouped && config.allOption && (
            <>
              <MenuItem
                option={config.allOption}
                isSelected={config.value === config.allOption.value}
                onClick={() => handleSelect(config.allOption!.value)}
              />
              <div className="my-1 border-t border-slate-100" />
            </>
          )}

          {/* Render flat o agrupado */}
          {grouped
            ? (config.options as LeadingFilterOptionGroup[]).map((group, idx) => {
                const GroupIcon = group.groupIcon;
                return (
                  <div key={`grp-${idx}`}>
                    {idx > 0 && <div className="my-1 border-t border-slate-100" />}
                    <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
                      {GroupIcon && <GroupIcon className="w-3 h-3 text-slate-400" />}
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        {group.groupLabel}
                      </span>
                    </div>
                    {group.options.map(o => (
                      <MenuItem
                        key={o.value}
                        option={o}
                        isSelected={o.value === config.value}
                        onClick={() => handleSelect(o.value)}
                      />
                    ))}
                  </div>
                );
              })
            : (config.options as LeadingFilterOption[]).map(o => (
                <MenuItem
                  key={o.value}
                  option={o}
                  isSelected={o.value === config.value}
                  onClick={() => handleSelect(o.value)}
                />
              ))
          }
        </div>
      </FloatingDropdown>
    </>
  );
};

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

  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        anchorRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSelect = (v: string) => {
    onChange(v);
    setIsOpen(false);
  };

  return (
    <>
      <div ref={anchorRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(o => !o)}
          className="bg-slate-50 border border-slate-200 text-slate-700 font-medium text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-slate-100 transition-all"
        >
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
          <span className="text-slate-400 font-normal">Ordenar:</span>
          <span>{currentLabel}</span>
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <FloatingDropdown
        anchorRef={anchorRef}
        dropdownRef={dropdownRef}
        isOpen={isOpen}
        offset={6}
        estimatedHeight={Math.min(320, options.length * 36 + 16)}
      >
        <div
          ref={dropdownRef}
          className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-[320px] overflow-y-auto py-1"
          style={{ minWidth: 200 }}
        >
          {options.map(o => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => handleSelect(o.value)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-teal-50 text-teal-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </FloatingDropdown>
    </>
  );
};
