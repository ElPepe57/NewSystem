import { useState, useRef, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';

interface ChipMultiSelectProps {
  label?: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  placeholder?: string;
  allowCreate?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ChipMultiSelect({
  label,
  value = [],
  onChange,
  options,
  placeholder = 'Buscar...',
  allowCreate = true,
  disabled = false,
  className = ''
}: ChipMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = searchTerm
    ? options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const showCreateOption = allowCreate && searchTerm.trim().length >= 2 &&
    !options.some(o => o.toLowerCase() === searchTerm.trim().toLowerCase());

  const toggle = (item: string) => {
    if (value.includes(item)) {
      onChange(value.filter(v => v !== item));
    } else {
      onChange([...value, item]);
    }
  };

  const handleCreate = () => {
    const trimmed = searchTerm.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setSearchTerm('');
    }
  };

  const remove = (item: string) => {
    onChange(value.filter(v => v !== item));
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}

      {/* Chips seleccionados */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(item => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700 border border-primary-200"
            >
              {item}
              {!disabled && (
                <button type="button" onClick={() => remove(item)} className="hover:text-primary-900">
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Botón para abrir */}
      {!disabled && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left text-sm text-gray-500 hover:border-primary-400 transition-colors flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />
          {placeholder}
        </button>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-hidden">
          {/* Buscar */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>

          <div className="max-h-44 overflow-auto">
            {/* Crear nuevo */}
            {showCreateOption && (
              <button
                type="button"
                onClick={handleCreate}
                className="w-full px-3 py-2 flex items-center gap-2 text-left text-sm hover:bg-primary-50 text-primary-600 border-b border-gray-100"
              >
                <Plus className="w-4 h-4" />
                Crear "{searchTerm.trim()}"
              </button>
            )}

            {/* Opciones */}
            {filteredOptions.map(option => {
              const isSelected = value.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggle(option)}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm transition-colors ${
                    isSelected ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-primary-500 border-primary-500' : 'border-gray-300'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {option}
                </button>
              );
            })}

            {filteredOptions.length === 0 && !showCreateOption && (
              <div className="px-3 py-3 text-center text-sm text-gray-500">
                Sin coincidencias
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
