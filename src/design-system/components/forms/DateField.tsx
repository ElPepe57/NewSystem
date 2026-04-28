/**
 * DateField — S58 Fase 2 · Input de fecha con shortcuts
 *
 * Estilo banking:
 *  - Input nativo type="date" (mejor UX nativa, accesibilidad)
 *  - Shortcuts chips arriba: Hoy · Ayer · Esta semana · Este mes
 *  - Default visual: hoy
 */

import React, { forwardRef } from 'react';
import { CircleAlert, Calendar } from 'lucide-react';
import { cn } from '../../utils';

export interface DateFieldProps {
  label: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  hint?: string;
  error?: string;
  optional?: boolean;
  rightHint?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  /** Mostrar chips de shortcuts arriba del input. Default: true. */
  showShortcuts?: boolean;
  /** Min/max permitidos (formato YYYY-MM-DD). */
  min?: string;
  max?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function dateToInputValue(date: Date | undefined): string {
  if (!date || isNaN(date.getTime())) return '';
  // Format: YYYY-MM-DD
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function inputValueToDate(input: string): Date | undefined {
  if (!input) return undefined;
  const [y, m, d] = input.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
}

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // lunes
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  return date;
}

// ─── Componente ────────────────────────────────────────────────────────

export const DateField = forwardRef<HTMLInputElement, DateFieldProps>(
  (
    {
      label,
      value,
      onChange,
      hint,
      error,
      optional,
      rightHint,
      disabled,
      className,
      showShortcuts = true,
      min,
      max,
    },
    ref,
  ) => {
    const hasError = !!error;
    const inputValue = dateToInputValue(value);

    // ── Shortcuts ──
    const todayStr = dateToInputValue(new Date());
    const yesterdayStr = dateToInputValue(new Date(Date.now() - 86400000));
    const startWeekStr = dateToInputValue(startOfWeek(new Date()));
    const startMonthStr = dateToInputValue(startOfMonth(new Date()));

    const isToday = inputValue === todayStr;
    const isYesterday = inputValue === yesterdayStr;
    const isStartOfWeek = inputValue === startWeekStr;
    const isStartOfMonth = inputValue === startMonthStr;

    const shortcuts: Array<{ label: string; value: string; active: boolean }> = [
      { label: 'Hoy', value: todayStr, active: isToday },
      { label: 'Ayer', value: yesterdayStr, active: isYesterday },
      { label: 'Inicio semana', value: startWeekStr, active: isStartOfWeek },
      { label: 'Inicio mes', value: startMonthStr, active: isStartOfMonth },
    ];

    return (
      <div className={cn('w-full', className)}>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            {label}
            {optional && (
              <span className="text-[9px] normal-case text-slate-400 ml-1.5">(opcional)</span>
            )}
          </label>
          {rightHint}
        </div>

        <div className="relative">
          <input
            ref={ref}
            type="date"
            value={inputValue}
            onChange={(e) => onChange(inputValueToDate(e.target.value))}
            disabled={disabled}
            min={min}
            max={max}
            aria-invalid={hasError}
            className={cn(
              'w-full h-10 pl-3 pr-10 text-sm rounded-md bg-white border outline-none transition-colors',
              'focus:ring-2 focus:ring-teal-500 focus:border-teal-500',
              'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
              hasError
                ? 'border-red-400 bg-red-50/30 focus:ring-red-500 focus:border-red-500'
                : 'border-slate-300',
            )}
          />
          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {showShortcuts && !disabled && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {shortcuts.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => onChange(inputValueToDate(s.value))}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded border transition-colors',
                  s.active
                    ? 'bg-teal-50 text-teal-700 border-teal-200 font-medium'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                )}
              >
                {s.label}
              </button>
            ))}
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
  },
);

DateField.displayName = 'DateField';
