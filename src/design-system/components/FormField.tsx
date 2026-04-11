import React from 'react';
import { cn } from '../utils';
import { text } from '../tokens';

interface FormFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  horizontal?: boolean;
}

/**
 * FormField — Wrapper de campo de formulario.
 * Label + input + error + hint en un solo componente.
 */
export const FormField: React.FC<FormFieldProps> = ({
  label, error, hint, required, children, className, horizontal,
}) => (
  <div className={cn(horizontal ? 'flex items-center gap-3' : 'space-y-1.5', className)}>
    {label && (
      <label className={cn('text-sm font-medium text-slate-700', horizontal && 'min-w-[120px] flex-shrink-0')}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    )}
    <div className={horizontal ? 'flex-1' : ''}>
      {children}
      {error && <p className="text-sm text-red-600 mt-1" role="alert">{error}</p>}
      {hint && !error && <p className={cn(text.caption, 'mt-1')}>{hint}</p>}
    </div>
  </div>
);
