/**
 * Combobox — S58 Fase 2 · Búsqueda + selección + crear nuevo
 *
 * Reemplaza al `<select>` cuando hay listas largas. Estilo Linear/Stripe Atlas:
 *  - Input con search · filtra en vivo
 *  - Dropdown con grupos opcionales (ej: "Recientes" + "Todos")
 *  - Render personalizable por item (icono, sub-label, badge)
 *  - Atajos: ↑↓ navegar · Enter seleccionar · Esc cerrar
 *  - Slot "Crear nuevo" al final si onCreate está definido
 *  - Empty state si no hay matches
 *
 * Uso típico: cuentas, proveedores, métodos de pago.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Check, Plus, CircleAlert } from 'lucide-react';
import { cn } from '../../utils';

export interface ComboboxOption<T = string> {
  value: T;
  label: string;
  /** Sub-texto debajo del label (ej: "Banco · cta corriente · S/ 85,420"). */
  subLabel?: string;
  /** Icono opcional a la izquierda. */
  icon?: React.ReactNode;
  /** Badge a la derecha (ej: monto). */
  badge?: React.ReactNode;
  /** Si true, deshabilita la opción. */
  disabled?: boolean;
}

export interface ComboboxGroup<T = string> {
  /** Etiqueta del grupo (ej: "Recientes"). Si null/empty, no se renderiza. */
  label?: string;
  options: ComboboxOption<T>[];
}

export interface ComboboxProps<T = string> {
  label: string;
  /** Valor seleccionado actual. */
  value: T | undefined;
  /** Callback cuando se selecciona una opción. */
  onChange: (value: T) => void;

  /** Grupos de opciones. Cada grupo puede tener label opcional. */
  groups: ComboboxGroup<T>[];

  /** Placeholder del input. */
  placeholder?: string;
  /** Hint debajo del input. */
  hint?: string;
  /** Error inline. */
  error?: string;
  /** Marca como opcional. */
  optional?: boolean;
  /** Slot a la derecha del label. */
  rightHint?: React.ReactNode;

  /** Callback al click en "Crear nuevo · {searchTerm}". Si null, no aparece. */
  onCreate?: (searchTerm: string) => void;
  createLabel?: string;

  /** Empty state custom (ej: "No hay ventas con ese número"). */
  emptyMessage?: string;

  disabled?: boolean;
  className?: string;
}

export function Combobox<T extends string | number = string>({
  label,
  value,
  onChange,
  groups,
  placeholder = 'Buscar...',
  hint,
  error,
  optional,
  rightHint,
  onCreate,
  createLabel = 'Crear nuevo',
  emptyMessage = 'Sin resultados',
  disabled,
  className,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasError = !!error;

  // ── Aplanar opciones para navegación con teclado ──
  const flatOptions = groups.flatMap((g) =>
    g.options.filter((o) => !o.disabled).map((o) => ({ ...o, _groupLabel: g.label })),
  );

  // ── Filtrar por search ──
  const filteredGroups = groups
    .map((g) => ({
      ...g,
      options: g.options.filter((o) =>
        search.trim() === ''
          ? true
          : o.label.toLowerCase().includes(search.toLowerCase()) ||
            (o.subLabel ?? '').toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((g) => g.options.length > 0);

  const filteredFlat = filteredGroups.flatMap((g) =>
    g.options.filter((o) => !o.disabled),
  );

  // ── Encontrar opción seleccionada (para mostrar texto) ──
  const selectedOption = flatOptions.find((o) => o.value === value);

  // ── Click outside cierra ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    if (open) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [open]);

  // ── Reset highlight cuando cambia search ──
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, open]);

  // ── Atajos de teclado ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setOpen(true);
        return;
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filteredFlat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filteredFlat[highlightedIndex];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
        setSearch('');
      } else if (onCreate && search.trim()) {
        onCreate(search.trim());
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    }
  };

  return (
    <div ref={containerRef} className={cn('w-full relative', className)}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
          {label}
          {optional && (
            <span className="text-[9px] normal-case text-slate-400 ml-1.5">(opcional)</span>
          )}
        </label>
        {rightHint}
      </div>

      {/* Trigger / display */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((o) => !o);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        onKeyDown={handleKeyDown}
        aria-invalid={hasError}
        className={cn(
          'w-full h-10 px-3 pr-10 text-sm rounded-md bg-white border outline-none transition-colors text-left',
          'focus:ring-2 focus:ring-teal-500 focus:border-teal-500',
          'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
          'flex items-center gap-2',
          hasError
            ? 'border-red-400 bg-red-50/30 focus:ring-red-500 focus:border-red-500'
            : 'border-slate-300',
        )}
      >
        {selectedOption ? (
          <>
            {selectedOption.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
            <span className="truncate flex-1 text-slate-900">{selectedOption.label}</span>
          </>
        ) : (
          <span className="text-slate-400 truncate">{placeholder}</span>
        )}
        <ChevronDown
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="relative border-b border-slate-100">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-white outline-none placeholder:text-slate-400"
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="max-h-72 overflow-auto">
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <Search className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
                <div className="text-[12px] text-slate-500">{emptyMessage}</div>
              </div>
            ) : (
              filteredGroups.map((g, gi) => {
                let runningIdx = filteredGroups
                  .slice(0, gi)
                  .reduce((acc, prev) => acc + prev.options.filter((o) => !o.disabled).length, 0);
                return (
                  <div key={gi}>
                    {g.label && (
                      <div className="text-[10px] uppercase text-slate-400 font-semibold px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                        {g.label}
                      </div>
                    )}
                    {g.options.map((opt) => {
                      const idx = opt.disabled ? -1 : runningIdx++;
                      const isHighlighted = idx === highlightedIndex && !opt.disabled;
                      const isSelected = opt.value === value;
                      return (
                        <button
                          key={String(opt.value)}
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => {
                            if (opt.disabled) return;
                            onChange(opt.value);
                            setOpen(false);
                            setSearch('');
                          }}
                          onMouseEnter={() => !opt.disabled && setHighlightedIndex(idx)}
                          className={cn(
                            'w-full px-3 py-2 flex items-center gap-2.5 text-left transition-colors',
                            isHighlighted && 'bg-teal-50',
                            !isHighlighted && !opt.disabled && 'hover:bg-slate-50',
                            opt.disabled && 'opacity-50 cursor-not-allowed',
                          )}
                        >
                          {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-medium text-slate-900 truncate">
                              {opt.label}
                            </div>
                            {opt.subLabel && (
                              <div className="text-[10px] text-slate-500 truncate">
                                {opt.subLabel}
                              </div>
                            )}
                          </div>
                          {opt.badge && <span className="flex-shrink-0">{opt.badge}</span>}
                          {isSelected && (
                            <Check className="flex-shrink-0 w-4 h-4 text-teal-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}

            {/* Crear nuevo */}
            {onCreate && search.trim() && (
              <button
                type="button"
                onClick={() => {
                  onCreate(search.trim());
                  setOpen(false);
                  setSearch('');
                }}
                className="w-full px-3 py-2 hover:bg-teal-50 flex items-center gap-2 text-left text-[12px] text-teal-700 font-medium border-t border-slate-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {createLabel} · "{search.trim()}"
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {hasError ? (
        <div className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1">
          <CircleAlert className="w-3 h-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : hint ? (
        <div className="text-[11px] text-slate-500 mt-1.5">{hint}</div>
      ) : null}
    </div>
  );
}
