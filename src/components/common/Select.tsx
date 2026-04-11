import React, { useId } from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  options,
  className = '',
  id: providedId,
  ...props
}) => {
  const generatedId = useId();
  const selectId = providedId || generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <select
        id={selectId}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        className={`block w-full rounded-lg border ${error ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-teal-500'} px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed transition-colors ${className}`}
        {...props}
      >
        <option value="">Seleccionar...</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600" role="alert">{error}</p>
      )}
      {!error && helperText && (
        <p id={helperId} className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
};
