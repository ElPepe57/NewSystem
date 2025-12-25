import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';

interface AutocompleteInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  createLabel?: string;
  className?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  label,
  value,
  onChange,
  suggestions,
  placeholder = 'Escribe para buscar...',
  required = false,
  error,
  helperText,
  disabled = false,
  allowCreate = true,
  createLabel = 'Crear nuevo',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sincronizar valor externo con input
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filtrar sugerencias basadas en el input
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return suggestions.slice(0, 10);

    const searchTerm = inputValue.toLowerCase().trim();
    return suggestions
      .filter(s => s.toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        // Priorizar coincidencias al inicio
        const aStarts = a.toLowerCase().startsWith(searchTerm);
        const bStarts = b.toLowerCase().startsWith(searchTerm);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 10);
  }, [inputValue, suggestions]);

  // Determinar si mostrar opción de crear nuevo
  const showCreateOption = useMemo(() => {
    if (!allowCreate || !inputValue.trim()) return false;
    const exists = suggestions.some(
      s => s.toLowerCase() === inputValue.toLowerCase().trim()
    );
    return !exists;
  }, [allowCreate, inputValue, suggestions]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue);
    onChange(selectedValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleCreateNew = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue) {
      onChange(trimmedValue);
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    const totalItems = filteredSuggestions.length + (showCreateOption ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          if (highlightedIndex < filteredSuggestions.length) {
            handleSelect(filteredSuggestions[highlightedIndex]);
          } else if (showCreateOption) {
            handleCreateNew();
          }
        } else if (showCreateOption) {
          handleCreateNew();
        } else if (filteredSuggestions.length > 0) {
          handleSelect(filteredSuggestions[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const handleBlur = () => {
    // Pequeño delay para permitir click en opciones
    setTimeout(() => {
      if (inputValue.trim() && inputValue !== value) {
        // Si el valor cambió y no está en sugerencias, usar el valor actual
        const exists = suggestions.some(
          s => s.toLowerCase() === inputValue.toLowerCase().trim()
        );
        if (exists) {
          // Encontrar el valor exacto con el caso correcto
          const exactMatch = suggestions.find(
            s => s.toLowerCase() === inputValue.toLowerCase().trim()
          );
          if (exactMatch) {
            onChange(exactMatch);
            setInputValue(exactMatch);
          }
        } else if (allowCreate) {
          onChange(inputValue.trim());
        } else {
          // Revertir al valor original si no se permite crear
          setInputValue(value);
        }
      }
    }, 200);
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            block w-full rounded-lg border pr-16
            ${error ? 'border-danger-300' : 'border-gray-300'}
            pl-3 py-2 text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
          `}
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              tabIndex={-1}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            tabIndex={-1}
            disabled={disabled}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown de sugerencias */}
      {isOpen && !disabled && (filteredSuggestions.length > 0 || showCreateOption) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className={`
                w-full text-left px-3 py-2 text-sm
                ${highlightedIndex === index ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}
                ${index === 0 ? 'rounded-t-lg' : ''}
                ${index === filteredSuggestions.length - 1 && !showCreateOption ? 'rounded-b-lg' : ''}
              `}
            >
              {highlightMatch(suggestion, inputValue)}
            </button>
          ))}

          {showCreateOption && (
            <button
              type="button"
              onClick={handleCreateNew}
              className={`
                w-full text-left px-3 py-2 text-sm flex items-center gap-2
                border-t border-gray-100
                ${highlightedIndex === filteredSuggestions.length ? 'bg-primary-50 text-primary-700' : 'text-primary-600 hover:bg-gray-50'}
                rounded-b-lg
              `}
            >
              <Plus className="h-4 w-4" />
              {createLabel}: <span className="font-medium">"{inputValue.trim()}"</span>
            </button>
          )}
        </div>
      )}

      {/* Mensaje cuando no hay sugerencias */}
      {isOpen && !disabled && filteredSuggestions.length === 0 && !showCreateOption && inputValue.trim() && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 p-3"
        >
          <p className="text-sm text-gray-500 text-center">No se encontraron coincidencias</p>
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-danger-600">{error}</p>
      )}

      {!error && helperText && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
};

// Helper para resaltar coincidencias en el texto
const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;

  const searchTerm = query.toLowerCase().trim();
  const index = text.toLowerCase().indexOf(searchTerm);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <span className="font-semibold text-primary-600">
        {text.slice(index, index + searchTerm.length)}
      </span>
      {text.slice(index + searchTerm.length)}
    </>
  );
};
