import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Tag,
  Plus,
  AlertCircle,
  Check,
  X,
  Loader2,
  Globe,
  Package
} from 'lucide-react';
import { useMarcaStore } from '../../../store/marcaStore';
import type { Marca, MarcaFormData, MarcaSnapshot } from '../../../types/entidadesMaestras.types';

interface MarcaAutocompleteProps {
  value?: MarcaSnapshot | null;
  onChange: (marca: MarcaSnapshot | null) => void;
  onCreateNew?: (data: Partial<MarcaFormData>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowCreate?: boolean;
  defaultTipoMarca?: 'farmaceutica' | 'suplementos' | 'cosmetica' | 'tecnologia' | 'otro';
  className?: string;
}

export const MarcaAutocomplete: React.FC<MarcaAutocompleteProps> = ({
  value,
  onChange,
  onCreateNew,
  placeholder = 'Buscar marca...',
  required = false,
  disabled = false,
  allowCreate = true,
  defaultTipoMarca = 'farmaceutica',
  className = ''
}) => {
  const {
    resultadosBusqueda,
    duplicadosDetectados,
    buscando,
    buscar,
    detectarDuplicados,
    limpiarBusqueda
  } = useMarcaStore();

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [nuevaMarca, setNuevaMarca] = useState<Partial<MarcaFormData>>({
    tipoMarca: defaultTipoMarca
  });
  const [creando, setCreando] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincronizar valor inicial
  useEffect(() => {
    if (value?.nombre && !inputValue) {
      setInputValue(value.nombre);
    }
  }, [value]);

  // Click fuera para cerrar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateForm(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Búsqueda con debounce
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setInputValue(valor);
    setIsOpen(true);

    // Limpiar selección si el usuario está editando
    if (value && valor !== value.nombre) {
      onChange(null);
    }

    // Debounce para búsqueda
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (valor.length >= 2) {
      debounceRef.current = setTimeout(() => {
        buscar(valor);
      }, 300);
    } else {
      limpiarBusqueda();
    }
  }, [value, onChange, buscar, limpiarBusqueda]);

  // Seleccionar marca existente
  const handleSelectMarca = (marca: Marca) => {
    const snapshot: MarcaSnapshot = {
      marcaId: marca.id,
      nombre: marca.nombre
    };
    onChange(snapshot);
    setInputValue(marca.nombre);
    setIsOpen(false);
    limpiarBusqueda();
  };

  // Abrir formulario de creación
  const handleShowCreate = () => {
    setNuevaMarca({
      nombre: inputValue,
      tipoMarca: defaultTipoMarca
    });
    setShowCreateForm(true);

    // Detectar duplicados
    if (inputValue.length >= 2) {
      detectarDuplicados(inputValue);
    }
  };

  // Crear nueva marca
  const handleCreateMarca = async () => {
    if (!nuevaMarca.nombre) return;

    setCreando(true);
    try {
      if (onCreateNew) {
        onCreateNew(nuevaMarca);
      }
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creando marca:', error);
    } finally {
      setCreando(false);
    }
  };

  // Limpiar selección
  const handleClear = () => {
    setInputValue('');
    onChange(null);
    limpiarBusqueda();
    inputRef.current?.focus();
  };

  // Obtener color por tipo
  const getColorByTipo = (tipo: string): string => {
    const colores: Record<string, string> = {
      farmaceutica: 'bg-blue-100 text-blue-800',
      suplementos: 'bg-green-100 text-green-800',
      cosmetica: 'bg-pink-100 text-pink-800',
      tecnologia: 'bg-purple-100 text-purple-800',
      otro: 'bg-gray-100 text-gray-800'
    };
    return colores[tipo] || colores.otro;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input principal */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {buscando ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Tag className="h-5 w-5 text-gray-400" />
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

        {/* Indicador de marca seleccionada o botón de limpiar */}
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
      {isOpen && !showCreateForm && (inputValue.length >= 2 || resultadosBusqueda.length > 0) && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto">
          {resultadosBusqueda.length > 0 ? (
            <>
              {resultadosBusqueda.map((marca) => (
                <button
                  key={marca.id}
                  type="button"
                  onClick={() => handleSelectMarca(marca)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{marca.nombre}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${getColorByTipo(marca.tipoMarca)}`}>
                          {marca.tipoMarca}
                        </span>
                      </div>
                      {marca.paisOrigen && (
                        <div className="flex items-center mt-1 text-xs text-gray-500">
                          <Globe className="h-3 w-3 mr-1" />
                          {marca.paisOrigen}
                        </div>
                      )}
                    </div>
                    {marca.metricas.productosActivos > 0 && (
                      <div className="flex items-center text-xs text-gray-400">
                        <Package className="h-3 w-3 mr-1" />
                        {marca.metricas.productosActivos}
                      </div>
                    )}
                  </div>
                </button>
              ))}

              {/* Opción de crear nueva */}
              {allowCreate && (
                <button
                  type="button"
                  onClick={handleShowCreate}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 text-primary-600 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear nueva marca "{inputValue}"
                </button>
              )}
            </>
          ) : !buscando && inputValue.length >= 2 ? (
            <div className="px-4 py-3">
              <div className="text-sm text-gray-500 mb-2">
                No se encontraron marcas con "{inputValue}"
              </div>
              {allowCreate && (
                <button
                  type="button"
                  onClick={handleShowCreate}
                  className="w-full px-3 py-2 bg-primary-50 text-primary-600 rounded-md flex items-center justify-center hover:bg-primary-100"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear nueva marca
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Formulario de creación rápida */}
      {showCreateForm && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Nueva Marca</h4>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Alerta de duplicados */}
          {duplicadosDetectados.length > 0 && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 mr-2" />
                <div className="text-sm">
                  <div className="font-medium text-amber-800">Marcas similares existentes</div>
                  {duplicadosDetectados.map((dup, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectMarca(dup.entidad)}
                      className="block text-amber-700 hover:underline"
                    >
                      {dup.entidad.nombre} ({dup.similitud}% similar)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nombre de la Marca *
              </label>
              <input
                type="text"
                value={nuevaMarca.nombre || ''}
                onChange={(e) => setNuevaMarca({ ...nuevaMarca, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tipo de Marca
                </label>
                <select
                  value={nuevaMarca.tipoMarca}
                  onChange={(e) => setNuevaMarca({ ...nuevaMarca, tipoMarca: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="farmaceutica">Farmacéutica</option>
                  <option value="suplementos">Suplementos</option>
                  <option value="cosmetica">Cosmética</option>
                  <option value="tecnologia">Tecnología</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  País de Origen
                </label>
                <input
                  type="text"
                  value={nuevaMarca.paisOrigen || ''}
                  onChange={(e) => setNuevaMarca({ ...nuevaMarca, paisOrigen: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="USA, Alemania..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Descripción (opcional)
              </label>
              <input
                type="text"
                value={nuevaMarca.descripcion || ''}
                onChange={(e) => setNuevaMarca({ ...nuevaMarca, descripcion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Breve descripción de la marca"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateMarca}
                disabled={!nuevaMarca.nombre || creando}
                className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {creando ? 'Creando...' : 'Crear y Seleccionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
