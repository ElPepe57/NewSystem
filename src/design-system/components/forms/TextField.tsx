/**
 * TextField — S58 Fase 2 · Input de texto base banking-grade
 *
 * Estilo Stripe Atlas / Mercury:
 *  - Label uppercase tracking-wider text-[11px]
 *  - Input h-10 con focus-ring teal-500
 *  - Hint debajo en text-[11px] slate
 *  - Error inline con icono · sustituye al hint cuando hay error
 *  - Right-slot opcional para badges (ej: "Sugerido · TC del día")
 *
 * Compatible con react-hook-form vía Controller (uncontrolled).
 */

import React, { forwardRef } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '../../utils';

export interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  /** Etiqueta uppercase (ej: "Concepto"). */
  label: string;
  /** Valor controlado. */
  value: string;
  /** Callback con el valor nuevo. */
  onChange: (value: string) => void;
  /** Texto debajo cuando NO hay error (ej: "Mínimo 5 caracteres"). */
  hint?: string;
  /** Mensaje de error · si presente, oculta hint y aplica estilo rojo. */
  error?: string;
  /** Marca el campo como opcional (chip junto al label). */
  optional?: boolean;
  /** Slot a la derecha del label (ej: badge "Default · hoy"). */
  rightHint?: React.ReactNode;
  /** Slot dentro del input al inicio (ej: símbolo "S/"). */
  leadingSlot?: React.ReactNode;
  /** Slot dentro del input al final (ej: icono Calendar). */
  trailingSlot?: React.ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      value,
      onChange,
      hint,
      error,
      optional,
      rightHint,
      leadingSlot,
      trailingSlot,
      className,
      disabled,
      placeholder,
      type = 'text',
      ...rest
    },
    ref,
  ) => {
    const hasError = !!error;
    return (
      <div className={cn('w-full', className)}>
        {/* Label row */}
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            {label}
            {optional && (
              <span className="text-[9px] normal-case text-slate-400 ml-1.5">(opcional)</span>
            )}
          </label>
          {rightHint}
        </div>

        {/* Input wrapper */}
        <div className="relative">
          {leadingSlot && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium pointer-events-none">
              {leadingSlot}
            </span>
          )}
          <input
            ref={ref}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={hasError}
            className={cn(
              'w-full h-10 text-sm rounded-md bg-white border outline-none transition-colors',
              'focus:ring-2 focus:ring-teal-500 focus:border-teal-500',
              'placeholder:text-slate-400',
              'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
              leadingSlot ? 'pl-10' : 'pl-3',
              trailingSlot ? 'pr-10' : 'pr-3',
              hasError
                ? 'border-red-400 bg-red-50/30 focus:ring-red-500 focus:border-red-500'
                : 'border-slate-300',
            )}
            {...rest}
          />
          {trailingSlot && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {trailingSlot}
            </span>
          )}
        </div>

        {/* Error o hint */}
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

TextField.displayName = 'TextField';
