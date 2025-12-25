import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Warehouse,
  MapPin,
  Check,
  X,
  Loader2,
  Plane,
  Calendar
} from 'lucide-react';
import { useAlmacenStore } from '../../../store/almacenStore';
import type { Almacen } from '../../../types/almacen.types';

export interface AlmacenSnapshot {
  almacenId: string;
  nombre: string;
  ciudad: string;
  estado?: string;
  pais: string;
}

interface AlmacenAutocompleteProps {
  value?: AlmacenSnapshot | null;
  onChange: (almacen: AlmacenSnapshot | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  filterPais?: 'USA' | 'Peru';
  soloViajeros?: boolean;
  className?: string;
}

export const AlmacenAutocomplete: React.FC<AlmacenAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Buscar almacén...',
  required = false,
  disabled = false,
  filterPais,
  soloViajeros = false,
  className = ''
}) => {
  const { almacenes, fetchAlmacenes, loading } = useAlmacenStore();
  const [filteredAlmacenes, setFilteredAlmacenes] = useState<Almacen[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar almacenes al montar
  useEffect(() => {
    if (almacenes.length === 0) {
      fetchAlmacenes();
    }
  }, []);

  // Sincronizar valor inicial
  useEffect(() => {
    if (value?.nombre && !inputValue) {
      setInputValue(`${value.nombre} - ${value.ciudad}${value.estado ? `, ${value.estado}` : ''}`);
    }
  }, [value]);

  // Click fuera para cerrar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrar almacenes
  useEffect(() => {
    let filtered = almacenes.filter(a => a.estadoAlmacen === 'activo');

    // Filtrar por país si se especifica
    if (filterPais) {
      filtered = filtered.filter(a => a.pais === filterPais);
    }

    // Filtrar solo viajeros si se especifica
    if (soloViajeros) {
      filtered = filtered.filter(a => a.esViajero);
    }

    // Filtrar por búsqueda
    if (inputValue.length >= 1) {
      const searchLower = inputValue.toLowerCase();
      filtered = filtered.filter(a =>
        a.nombre.toLowerCase().includes(searchLower) ||
        a.ciudad?.toLowerCase().includes(searchLower) ||
        a.estado?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredAlmacenes(filtered);
  }, [inputValue, almacenes, filterPais, soloViajeros]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setInputValue(valor);
    setIsOpen(true);

    // Limpiar selección si el usuario está editando
    if (value) {
      onChange(null);
    }
  }, [value, onChange]);

  // Seleccionar almacén
  const handleSelectAlmacen = (almacen: Almacen) => {
    const snapshot: AlmacenSnapshot = {
      almacenId: almacen.id,
      nombre: almacen.nombre,
      ciudad: almacen.ciudad || '',
      estado: almacen.estado,
      pais: almacen.pais
    };
    onChange(snapshot);
    setInputValue(`${almacen.nombre} - ${almacen.ciudad}${almacen.estado ? `, ${almacen.estado}` : ''}`);
    setIsOpen(false);
  };

  // Limpiar selección
  const handleClear = () => {
    setInputValue('');
    onChange(null);
    inputRef.current?.focus();
  };

  // Formatear próximo viaje
  const formatProximoViaje = (fecha: any) => {
    if (!fecha) return null;
    const date = fecha.toDate?.() || new Date(fecha);
    const dias = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (dias < 0) return null;
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    return `En ${dias} días`;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input principal */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Warehouse className="h-5 w-5 text-gray-400" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            block w-full pl-10 pr-10 py-2 border rounded-md shadow-sm
            focus:ring-primary-500 focus:border-primary-500
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            ${value ? 'border-green-300 bg-green-50' : 'border-gray-300'}
          `}
        />

        {/* Indicador de almacén seleccionado o botón de limpiar */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {value ? (
            <div className="flex items-center space-x-1">
              <Check className="h-4 w-4 text-green-500" />
              {!disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : inputValue && !disabled ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown de resultados */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto">
          {filteredAlmacenes.length > 0 ? (
            filteredAlmacenes.map((almacen) => {
              const proximoViaje = almacen.esViajero ? formatProximoViaje(almacen.proximoViaje) : null;

              return (
                <button
                  key={almacen.id}
                  type="button"
                  onClick={() => handleSelectAlmacen(almacen)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{almacen.nombre}</span>
                        {almacen.esViajero && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 text-purple-800 flex items-center">
                            <Plane className="h-3 w-3 mr-1" />
                            Viajero
                          </span>
                        )}
                      </div>
                      <div className="flex items-center mt-1 text-xs text-gray-500">
                        <MapPin className="h-3 w-3 mr-1" />
                        {almacen.ciudad}{almacen.estado && `, ${almacen.estado}`} - {almacen.pais}
                      </div>
                    </div>
                    {proximoViaje && (
                      <div className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        <Calendar className="h-3 w-3 mr-1" />
                        {proximoViaje}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          ) : !loading ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              {inputValue.length >= 1
                ? `No se encontraron almacenes con "${inputValue}"`
                : 'Escribe para buscar almacenes...'}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
