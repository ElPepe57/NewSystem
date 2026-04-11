import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  hint,
  icon,
  className = '',
  id: providedId,
  ...props
}) => {
  const generatedId = useId();
  const inputId = providedId || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
        )}

        <input
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`block w-full rounded-lg border ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-teal-500'} ${icon ? 'pl-10' : 'pl-3'} pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed transition-colors ${className}`}
          {...props}
        />
      </div>

      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">{error}</p>
      )}
      {!error && helperText && (
        <p id={helperId} className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
      {!error && !helperText && hint && (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
};
