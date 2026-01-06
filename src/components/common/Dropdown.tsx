import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// ============= Tipos =============

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  /** Items del menu */
  items: DropdownItem[];
  /** Callback cuando se selecciona un item */
  onSelect: (itemId: string) => void;
  /** Elemento trigger (boton que abre el dropdown) */
  trigger: React.ReactNode;
  /** Posicion del menu */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Ancho del menu */
  width?: 'auto' | 'trigger' | number;
  /** Clases adicionales */
  className?: string;
}

export interface DropdownSelectProps {
  /** Opciones disponibles */
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
  /** Valor seleccionado */
  value: string;
  /** Callback cuando cambia la seleccion */
  onChange: (value: string) => void;
  /** Placeholder cuando no hay seleccion */
  placeholder?: string;
  /** Tamano */
  size?: 'sm' | 'md' | 'lg';
  /** Deshabilitado */
  disabled?: boolean;
  /** Clases adicionales */
  className?: string;
}

// ============= Estilos =============

const positionStyles = {
  'bottom-left': 'top-full left-0 mt-1',
  'bottom-right': 'top-full right-0 mt-1',
  'top-left': 'bottom-full left-0 mb-1',
  'top-right': 'bottom-full right-0 mb-1'
};

const sizeStyles = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base'
};

// ============= Componentes =============

/**
 * Menu Dropdown
 *
 * @example
 * <Dropdown
 *   items={[
 *     { id: 'edit', label: 'Editar', icon: <Pencil /> },
 *     { id: 'delete', label: 'Eliminar', icon: <Trash />, danger: true }
 *   ]}
 *   onSelect={(id) => handleAction(id)}
 *   trigger={<Button variant="outline">Acciones</Button>}
 * />
 */
export const Dropdown: React.FC<DropdownProps> = ({
  items,
  onSelect,
  trigger,
  position = 'bottom-left',
  width = 'auto',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleItemClick = useCallback(
    (item: DropdownItem) => {
      if (item.disabled || item.divider) return;
      onSelect(item.id);
      setIsOpen(false);
    },
    [onSelect]
  );

  const getWidth = () => {
    if (width === 'auto') return 'min-w-[160px]';
    if (width === 'trigger') return 'w-full';
    return `w-[${width}px]`;
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Trigger */}
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {/* Menu */}
      {isOpen && (
        <div
          className={`
            absolute z-50 ${positionStyles[position]} ${getWidth()}
            bg-white rounded-lg shadow-lg border border-gray-200
            py-1 overflow-hidden
            animate-in fade-in-0 zoom-in-95 duration-150
          `}
        >
          {items.map((item, index) => {
            if (item.divider) {
              return <div key={index} className="my-1 border-t border-gray-100" />;
            }

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                className={`
                  w-full px-4 py-2 text-left text-sm
                  flex items-center gap-2
                  ${item.disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                  transition-colors
                `}
              >
                {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Dropdown tipo Select
 *
 * @example
 * <DropdownSelect
 *   options={[
 *     { value: 'asc', label: 'Ascendente' },
 *     { value: 'desc', label: 'Descendente' }
 *   ]}
 *   value={sortOrder}
 *   onChange={setSortOrder}
 *   placeholder="Ordenar por..."
 * />
 */
export const DropdownSelect: React.FC<DropdownSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  size = 'md',
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
    },
    [onChange]
  );

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          ${sizeStyles[size]}
          w-full flex items-center justify-between gap-2
          border border-gray-300 rounded-lg bg-white
          text-left
          ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'hover:border-gray-400'}
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          transition-colors
        `}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
            {selectedOption?.label || placeholder}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Options */}
      {isOpen && (
        <div
          className={`
            absolute z-50 top-full left-0 right-0 mt-1
            bg-white rounded-lg shadow-lg border border-gray-200
            py-1 max-h-60 overflow-auto
            animate-in fade-in-0 zoom-in-95 duration-150
          `}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`
                w-full px-4 py-2 text-left text-sm
                flex items-center justify-between gap-2
                ${option.value === value ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}
                transition-colors
              `}
            >
              <span className="flex items-center gap-2">
                {option.icon}
                {option.label}
              </span>
              {option.value === value && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Menu de acciones para filas de tabla
 */
export const ActionsDropdown: React.FC<{
  actions: Array<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    danger?: boolean;
    disabled?: boolean;
  }>;
  onAction: (actionId: string) => void;
}> = ({ actions, onAction }) => {
  return (
    <Dropdown
      items={actions}
      onSelect={onAction}
      position="bottom-right"
      trigger={
        <button
          type="button"
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      }
    />
  );
};
