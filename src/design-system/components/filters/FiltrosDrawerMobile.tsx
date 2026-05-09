/**
 * FiltrosDrawerMobile · drawer slide-up para filtros en mobile
 *
 * Mockup canónico: docs/mockups/productos/08-filtros-drawer-mobile.html
 *
 * Diseño:
 *   - Backdrop oscuro + blur
 *   - Drawer bottom-up · max-height 85% · rounded-t-3xl
 *   - Drag handle visual (sin gesture aún)
 *   - Header sticky · "Filtros" + count + X
 *   - Body scrolleable: Período (grid 3) · Línea · Tipo · Estado · Búsqueda · Orden
 *   - Footer sticky: Limpiar todo · Aplicar (CTA primary)
 */

import React, { useEffect } from 'react';
import { X, Calendar, Layers, Box, CircleDot, Search, ArrowUpDown, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import type { ChipGroupConfig, DateRangePreset, SortOption } from './FiltrosBar';

interface FiltrosDrawerMobileProps {
  open: boolean;
  onClose: () => void;
  resultCount: number;

  dateRange?: DateRangePreset;
  onDateRangeChange?: (preset: DateRangePreset) => void;

  chipGroups: ChipGroupConfig[];
  selecciones: Record<string, string[]>;
  onChipToggle: (groupKey: string, value: string) => void;

  searchTerm: string;
  searchPlaceholder?: string;
  onSearchChange: (term: string) => void;

  sortValue: string;
  sortOptions: SortOption[];
  onSortChange: (value: string) => void;

  onLimpiarTodo: () => void;
}

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: '6m', label: '6 meses' },
  { value: 'año', label: 'Este año' },
];

const GROUP_ICON_BY_KEY: Record<string, { icon: LucideIcon; color: string }> = {
  linea: { icon: Layers, color: 'text-amber-600' },
  tipo: { icon: Box, color: 'text-purple-600' },
  estado: { icon: CircleDot, color: 'text-emerald-600' },
};

const VARIANT_OPTION_STYLES: Record<string, { activeBorder: string; activeBg: string; activeText: string }> = {
  amber: { activeBorder: 'border-amber-300', activeBg: 'bg-amber-50', activeText: 'text-amber-700' },
  indigo: { activeBorder: 'border-indigo-300', activeBg: 'bg-indigo-50', activeText: 'text-indigo-700' },
  emerald: { activeBorder: 'border-emerald-300', activeBg: 'bg-emerald-50', activeText: 'text-emerald-700' },
  rose: { activeBorder: 'border-rose-300', activeBg: 'bg-rose-50', activeText: 'text-rose-700' },
  sky: { activeBorder: 'border-sky-300', activeBg: 'bg-sky-50', activeText: 'text-sky-700' },
  purple: { activeBorder: 'border-purple-300', activeBg: 'bg-purple-50', activeText: 'text-purple-700' },
  slate: { activeBorder: 'border-slate-300', activeBg: 'bg-slate-50', activeText: 'text-slate-700' },
  teal: { activeBorder: 'border-teal-300', activeBg: 'bg-teal-50', activeText: 'text-teal-700' },
};

export const FiltrosDrawerMobile: React.FC<FiltrosDrawerMobileProps> = ({
  open,
  onClose,
  resultCount,
  dateRange,
  onDateRangeChange,
  chipGroups,
  selecciones,
  onChipToggle,
  searchTerm,
  searchPlaceholder = 'Nombre, marca, SKU...',
  onSearchChange,
  sortValue,
  sortOptions,
  onSortChange,
  onLimpiarTodo,
}) => {
  // Cierra con ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        aria-label="Cerrar filtros"
      />

      {/* Drawer */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl overflow-hidden" style={{ maxHeight: '85vh' }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-teal-600" />
              Filtros
            </h2>
            <p className="text-[10px] text-slate-500 tabular-nums">{resultCount} productos coinciden con tu selección</p>
          </div>
          <button onClick={onClose} type="button" className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Body scrolleable */}
        <div className="overflow-y-auto px-5 py-4 space-y-5" style={{ maxHeight: 'calc(85vh - 200px)' }}>
          {/* Período */}
          {dateRange !== undefined && onDateRangeChange && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Período</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {DATE_PRESETS.map(p => {
                  const isActive = dateRange === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onDateRangeChange(p.value)}
                      className={`px-2 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                        isActive
                          ? 'bg-teal-100 border-teal-400 text-teal-700 ring-2 ring-teal-200'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-teal-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ChipGroups */}
          {chipGroups.map(group => {
            const groupSelecciones = selecciones[group.key] ?? [];
            const groupConfig = GROUP_ICON_BY_KEY[group.key.toLowerCase()] ?? { icon: Layers, color: 'text-slate-600' };
            const GroupIcon = groupConfig.icon;
            return (
              <div key={group.key}>
                <div className="flex items-center gap-1.5 mb-2">
                  <GroupIcon className={`w-3.5 h-3.5 ${groupConfig.color}`} />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{group.label}</span>
                </div>
                <div className="space-y-1.5">
                  {group.options.map(opt => {
                    const isActive = groupSelecciones.includes(opt.value);
                    const variantStyle = VARIANT_OPTION_STYLES[opt.variant];
                    const containerClasses = isActive
                      ? `flex items-center justify-between p-2.5 rounded-lg border-2 ${variantStyle.activeBorder} ${variantStyle.activeBg} cursor-pointer`
                      : `flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:${variantStyle.activeBorder}`;

                    return (
                      <label key={opt.value} className={containerClasses}>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => onChipToggle(group.key, opt.value)}
                            className="rounded border-slate-300 w-4 h-4"
                          />
                          {opt.icon && <opt.icon className={`w-3.5 h-3.5 ${isActive ? variantStyle.activeText : 'text-slate-600'}`} />}
                          <span className={`text-sm ${isActive ? `font-bold ${variantStyle.activeText}` : 'font-medium text-slate-700'}`}>
                            {opt.label}
                          </span>
                        </div>
                        {opt.count !== undefined && (
                          <span className={`text-[11px] tabular-nums ${isActive ? `font-bold ${variantStyle.activeText}` : 'text-slate-500'}`}>
                            {opt.count}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Búsqueda */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Search className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Búsqueda</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Orden */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ordenar por</span>
            </div>
            <select
              value={sortValue}
              onChange={e => onSortChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              {sortOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer sticky */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={() => {
              onLimpiarTodo();
            }}
            className="flex-1 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
          >
            Limpiar todo
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-[2] px-3 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-all shadow-sm"
          >
            Aplicar ({resultCount} productos)
          </button>
        </div>
      </div>
    </div>
  );
};
