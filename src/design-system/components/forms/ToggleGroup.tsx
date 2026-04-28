/**
 * ToggleGroup — S58 Fase 2 · Selector excluyente 2-4 opciones
 *
 * Estilo banking:
 *  - Pill container bg-slate-100, opciones rounded internamente
 *  - Activo: bg-white shadow-sm, color de la opción
 *  - Inactivos: text-slate-500 hover:text-slate-700
 *  - Soporta opcionalmente icono por opción
 *
 * Reemplaza al `<select>` cuando hay 2-4 opciones excluyentes.
 * Visualmente más claro y rápido de elegir.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils';

export interface ToggleOption<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Color del texto cuando está activo (default: 'teal'). */
  activeColor?: 'teal' | 'emerald' | 'red' | 'amber' | 'sky' | 'slate';
}

export interface ToggleGroupProps<T extends string = string> {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: ToggleOption<T>[];
  optional?: boolean;
  hint?: string;
  error?: string;
  rightHint?: React.ReactNode;
  /** Tamaño compacto (sm) o normal (md). Default: md. */
  size?: 'sm' | 'md';
  /** Estirar para ocupar todo el ancho (cada opción flex-1). Default: true. */
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
}

const ACTIVE_COLOR_CLASSES: Record<NonNullable<ToggleOption['activeColor']>, string> = {
  teal: 'text-teal-700',
  emerald: 'text-emerald-700',
  red: 'text-red-700',
  amber: 'text-amber-700',
  sky: 'text-sky-700',
  slate: 'text-slate-900',
};

export function ToggleGroup<T extends string = string>({
  label,
  value,
  onChange,
  options,
  optional,
  hint,
  error,
  rightHint,
  size = 'md',
  fullWidth = true,
  className,
  disabled,
}: ToggleGroupProps<T>) {
  const hasError = !!error;
  const sizeClasses =
    size === 'sm'
      ? 'text-[11px] py-1 px-2.5 gap-1'
      : 'text-[12px] py-1.5 px-3 gap-1.5';

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            {label}
            {optional && (
              <span className="text-[9px] normal-case text-slate-400 ml-1.5">(opcional)</span>
            )}
          </span>
          {rightHint}
        </div>
      )}

      <div
        className={cn(
          'flex bg-slate-100 rounded-lg p-1',
          fullWidth ? 'w-full' : 'w-fit',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        role="radiogroup"
      >
        {options.map((opt) => {
          const isActive = opt.value === value;
          const Icon = opt.icon;
          const activeColor = opt.activeColor ?? 'teal';
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                'rounded transition-all flex items-center justify-center font-medium whitespace-nowrap',
                sizeClasses,
                fullWidth && 'flex-1',
                isActive
                  ? `bg-white shadow-sm font-semibold ${ACTIVE_COLOR_CLASSES[activeColor]}`
                  : 'text-slate-500 hover:text-slate-700',
                disabled && 'cursor-not-allowed',
              )}
            >
              {Icon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
              {opt.label}
            </button>
          );
        })}
      </div>

      {hasError ? (
        <div className="text-[11px] text-red-600 mt-1.5">{error}</div>
      ) : hint ? (
        <div className="text-[11px] text-slate-500 mt-1.5">{hint}</div>
      ) : null}
    </div>
  );
}
