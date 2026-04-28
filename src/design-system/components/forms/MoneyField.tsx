/**
 * MoneyField — S58 Fase 2 · Input de monto con formato live
 *
 * Estilo banking:
 *  - Símbolo S/ o US$ pegado a la izquierda
 *  - Formato live mientras escribes: 1234.5 → 1,234.50
 *  - Alineación derecha (estándar contable)
 *  - Equivalente automático opcional debajo (S/ X ≈ US$ Y)
 *  - Solo dígitos, punto y coma. Otros chars ignorados.
 */

import React, { forwardRef } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '../../utils';

export interface MoneyFieldProps {
  /** Etiqueta. */
  label: string;
  /** Valor numérico controlado. */
  value: number | undefined;
  /** Callback con el nuevo valor numérico. */
  onChange: (value: number | undefined) => void;
  /** Moneda actual · controla símbolo. */
  moneda: 'PEN' | 'USD';
  /** Placeholder · default '0.00'. */
  placeholder?: string;
  /** Hint debajo. */
  hint?: string;
  /** Equivalente en otra moneda · si presente, sustituye el hint. */
  equivalente?: { valor: number; moneda: 'PEN' | 'USD'; tcUsado?: number };
  /** Error inline. */
  error?: string;
  /** Optional badge label. */
  optional?: boolean;
  /** Slot a la derecha del label. */
  rightHint?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

// ─── Helpers de formato ────────────────────────────────────────────────

/** Convierte un número a string con formato 1,234.56 (2 decimales fijos). */
function formatNumber(n: number | undefined): string {
  if (n === undefined || isNaN(n)) return '';
  return n.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Sanitiza un string permitiendo solo dígitos y un punto decimal.
 *  Retorna el número parseado o undefined si vacío. */
function parseInput(raw: string): number | undefined {
  // Permitir solo dígitos, punto y coma
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(/,/g, '');
  if (cleaned === '') return undefined;
  // Si tiene más de un punto, mantener solo el primero
  const parts = cleaned.split('.');
  const normalized = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
  const num = parseFloat(normalized);
  return isNaN(num) ? undefined : num;
}

// ─── Componente ────────────────────────────────────────────────────────

export const MoneyField = forwardRef<HTMLInputElement, MoneyFieldProps>(
  (
    {
      label,
      value,
      onChange,
      moneda,
      placeholder = '0.00',
      hint,
      equivalente,
      error,
      optional,
      rightHint,
      disabled,
      className,
      autoFocus,
    },
    ref,
  ) => {
    const [rawInput, setRawInput] = React.useState<string>(formatNumber(value));
    const [isFocused, setIsFocused] = React.useState(false);

    // Sincroniza si el value externo cambia (ej: reset del form)
    React.useEffect(() => {
      if (!isFocused) {
        setRawInput(formatNumber(value));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const symbol = moneda === 'USD' ? 'US$' : 'S/';
    const symbolPadding = moneda === 'USD' ? 'pl-12' : 'pl-10';
    const hasError = !!error;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setRawInput(raw);
      const parsed = parseInput(raw);
      onChange(parsed);
    };

    const handleBlur = () => {
      setIsFocused(false);
      // Reformatear al perder foco
      setRawInput(formatNumber(value));
    };

    const handleFocus = () => {
      setIsFocused(true);
      // Mostrar valor "raw" (sin formato) para edición
      if (value !== undefined) {
        setRawInput(value.toString());
      }
    };

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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium pointer-events-none">
            {symbol}
          </span>
          <input
            ref={ref}
            type="text"
            inputMode="decimal"
            value={rawInput}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            aria-invalid={hasError}
            className={cn(
              'w-full h-10 pr-3 text-sm rounded-md bg-white border outline-none transition-colors',
              'focus:ring-2 focus:ring-teal-500 focus:border-teal-500',
              'placeholder:text-slate-400',
              'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
              'tabular-nums font-medium text-right',
              symbolPadding,
              hasError
                ? 'border-red-400 bg-red-50/30 focus:ring-red-500 focus:border-red-500'
                : 'border-slate-300',
            )}
          />
        </div>

        {hasError ? (
          <div className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1">
            <CircleAlert className="w-3 h-3 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : equivalente && value !== undefined && value !== 0 ? (
          <div className="text-[11px] text-slate-500 mt-1.5 text-right tabular-nums">
            ≈{' '}
            <span className="font-medium text-slate-700">
              {equivalente.moneda === 'USD' ? 'US$' : 'S/'}{' '}
              {formatNumber(equivalente.valor)}
            </span>
            {equivalente.tcUsado && (
              <span className="text-slate-400"> al TC {equivalente.tcUsado.toFixed(3)}</span>
            )}
          </div>
        ) : hint ? (
          <div className="text-[11px] text-slate-500 mt-1.5">{hint}</div>
        ) : null}
      </div>
    );
  },
);

MoneyField.displayName = 'MoneyField';
