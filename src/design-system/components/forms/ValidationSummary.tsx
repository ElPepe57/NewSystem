/**
 * ValidationSummary — S58 Fase 2 · Banner de errores al hacer submit
 *
 * Aparece arriba del formulario CUANDO el usuario intenta submit y hay errores.
 * Lista los errores con link al campo (focus + scroll).
 *
 * En estado normal, los errores viven INLINE en cada campo (TextField error prop).
 * Este banner es el sumario al fallar el submit.
 */

import React from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '../../utils';

export interface ValidationError {
  /** Nombre del campo (ej: "concepto"). Se usa para query selector. */
  field: string;
  /** Etiqueta humana (ej: "Concepto"). */
  label: string;
  /** Mensaje del error. */
  message: string;
}

export interface ValidationSummaryProps {
  errors: ValidationError[];
  /** Texto del título · default "Hay {N} errores que corregir". */
  title?: string;
  className?: string;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  errors,
  title,
  className,
}) => {
  if (errors.length === 0) return null;

  const handleErrorClick = (field: string) => {
    // Buscar input/select por name attribute o data-field
    const el =
      document.querySelector<HTMLElement>(`[name="${field}"]`) ||
      document.querySelector<HTMLElement>(`[data-field="${field}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }
  };

  const computedTitle =
    title ?? `Hay ${errors.length} error${errors.length !== 1 ? 'es' : ''} que corregir`;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'bg-red-50 border border-red-200 rounded-md p-3',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <CircleAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-red-800 font-semibold mb-1.5">
            {computedTitle}
          </div>
          <ul className="text-[11px] text-red-700 space-y-0.5 ml-1 list-disc list-inside">
            {errors.map((err, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => handleErrorClick(err.field)}
                  className="underline hover:text-red-900 font-medium"
                >
                  {err.label}
                </button>{' '}
                · {err.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
