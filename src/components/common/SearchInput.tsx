import React, { forwardRef, useState, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  /** Valor del input */
  value: string;
  /** Callback cuando cambia el valor */
  onChange: (value: string) => void;
  /** Placeholder del input */
  placeholder?: string;
  /** Mostrar boton de limpiar */
  showClear?: boolean;
  /** Estado de carga (buscando) */
  isSearching?: boolean;
  /** Tamano del input */
  size?: 'sm' | 'md' | 'lg';
  /** Clases adicionales para el contenedor */
  className?: string;
  /** Callback cuando se presiona Enter */
  onSearch?: (value: string) => void;
  /** Icono personalizado (reemplaza Search) */
  icon?: React.ReactNode;
  /** Posicion del icono */
  iconPosition?: 'left' | 'right';
}

const sizeStyles = {
  sm: {
    container: 'h-8',
    input: 'text-sm pl-8 pr-8',
    icon: 'h-4 w-4',
    iconLeft: 'left-2.5',
    clearBtn: 'right-2'
  },
  md: {
    container: 'h-10',
    input: 'text-sm pl-10 pr-10',
    icon: 'h-5 w-5',
    iconLeft: 'left-3',
    clearBtn: 'right-3'
  },
  lg: {
    container: 'h-12',
    input: 'text-base pl-12 pr-12',
    icon: 'h-6 w-6',
    iconLeft: 'left-4',
    clearBtn: 'right-4'
  }
};

/**
 * Input de busqueda con icono, boton de limpiar y estado de carga
 *
 * @example
 * <SearchInput
 *   value={searchTerm}
 *   onChange={setSearchTerm}
 *   placeholder="Buscar productos..."
 *   isSearching={loading}
 *   onSearch={(term) => fetchResults(term)}
 * />
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      placeholder = 'Buscar...',
      showClear = true,
      isSearching = false,
      size = 'md',
      className = '',
      onSearch,
      icon,
      iconPosition = 'left',
      disabled,
      ...props
    },
    ref
  ) => {
    const styles = sizeStyles[size];

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
      },
      [onChange]
    );

    const handleClear = useCallback(() => {
      onChange('');
    }, [onChange]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && onSearch) {
          onSearch(value);
        }
        if (e.key === 'Escape') {
          handleClear();
        }
      },
      [onSearch, value, handleClear]
    );

    const showClearButton = showClear && value && !isSearching;

    return (
      <div className={`relative ${styles.container} ${className}`}>
        {/* Icono de busqueda o personalizado */}
        <div
          className={`absolute ${styles.iconLeft} top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none`}
        >
          {isSearching ? (
            <Loader2 className={`${styles.icon} animate-spin`} />
          ) : icon ? (
            icon
          ) : (
            <Search className={styles.icon} />
          )}
        </div>

        {/* Input */}
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSearching}
          className={`
            w-full h-full ${styles.input}
            border border-gray-300 rounded-lg
            bg-white
            placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-colors
          `}
          {...props}
        />

        {/* Boton de limpiar */}
        {showClearButton && (
          <button
            type="button"
            onClick={handleClear}
            className={`
              absolute ${styles.clearBtn} top-1/2 -translate-y-1/2
              p-1 rounded-full
              text-gray-400 hover:text-gray-600 hover:bg-gray-100
              transition-colors
            `}
            aria-label="Limpiar búsqueda"
          >
            <X className={styles.icon} />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

/**
 * Componente de busqueda con filtros integrados
 */
export interface SearchWithFiltersProps extends SearchInputProps {
  /** Filtros a mostrar a la derecha */
  filters?: React.ReactNode;
  /** Mostrar contador de resultados */
  resultCount?: number;
  /** Label del contador */
  resultLabel?: string;
}

export const SearchWithFilters: React.FC<SearchWithFiltersProps> = ({
  filters,
  resultCount,
  resultLabel = 'resultados',
  className = '',
  ...searchProps
}) => {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${className}`}>
      <div className="flex-1">
        <SearchInput {...searchProps} />
      </div>
      {filters && <div className="flex items-center gap-2">{filters}</div>}
      {resultCount !== undefined && (
        <div className="flex items-center text-sm text-gray-500">
          <span className="font-medium text-gray-700">{resultCount}</span>
          <span className="ml-1">{resultLabel}</span>
        </div>
      )}
    </div>
  );
};
