import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Building2,
  Plus,
  Check,
  X,
  Loader2,
  Globe,
  ShoppingCart,
  Phone,
  Mail
} from 'lucide-react';
import { useProveedorStore } from '../../../store/proveedorStore';
import type { Proveedor, ProveedorFormData, TipoProveedor } from '../../../types/ordenCompra.types';

export interface ProveedorSnapshot {
  proveedorId: string;
  nombre: string;
  pais: string;
}

interface ProveedorAutocompleteProps {
  value?: ProveedorSnapshot | null;
  onChange: (proveedor: ProveedorSnapshot | null) => void;
  onCreateNew?: (data: ProveedorFormData) => Promise<Proveedor>;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowCreate?: boolean;
  filterPais?: string;
  className?: string;
}

export const ProveedorAutocomplete: React.FC<ProveedorAutocompleteProps> = ({
  value,
  onChange,
  onCreateNew,
  placeholder = 'Buscar proveedor...',
  required = false,
  disabled = false,
  allowCreate = true,
  filterPais,
  className = ''
}) => {
  const {
    proveedoresActivos,
    loading,
    fetchProveedoresActivos,
    createProveedor
  } = useProveedorStore();

  const [filteredProveedores, setFilteredProveedores] = useState<Proveedor[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nuevoProveedor, setNuevoProveedor] = useState<Partial<ProveedorFormData>>({
    tipo: 'distribuidor',
    pais: 'USA'
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar proveedores al montar
  useEffect(() => {
    if (proveedoresActivos.length === 0) {
      fetchProveedoresActivos();
    }
  }, []);

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

  // Filtrar proveedores al escribir
  useEffect(() => {
    let filtered = proveedoresActivos;

    // Filtrar por país si se especifica
    if (filterPais) {
      filtered = filtered.filter(p => p.pais === filterPais);
    }

    // Filtrar por búsqueda (con validación segura)
    if (inputValue.length >= 1) {
      const searchLower = inputValue.toLowerCase();
      filtered = filtered.filter(p => {
        const nombre = (p.nombre ?? '').toLowerCase();
        const pais = (p.pais ?? '').toLowerCase();
        return nombre.includes(searchLower) || pais.includes(searchLower);
      });
    }

    setFilteredProveedores(filtered);
  }, [inputValue, proveedoresActivos, filterPais]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setInputValue(valor);
    setIsOpen(true);

    // Limpiar selección si el usuario está editando
    if (value && valor !== value.nombre) {
      onChange(null);
    }
  }, [value, onChange]);

  // Seleccionar proveedor existente
  const handleSelectProveedor = (proveedor: Proveedor) => {
    const snapshot: ProveedorSnapshot = {
      proveedorId: proveedor.id,
      nombre: proveedor.nombre,
      pais: proveedor.pais
    };
    onChange(snapshot);
    setInputValue(proveedor.nombre);
    setIsOpen(false);
  };

  // Abrir formulario de creación
  const handleShowCreate = () => {
    setNuevoProveedor({
      nombre: inputValue,
      tipo: 'distribuidor',
      pais: 'USA'
    });
    setShowCreateForm(true);
  };

  // Crear nuevo proveedor
  const handleCreateProveedor = async () => {
    if (!nuevoProveedor.nombre) return;

    setCreando(true);
    try {
      // Si hay callback personalizado, usarlo
      if (onCreateNew) {
        const proveedor = await onCreateNew(nuevoProveedor as ProveedorFormData);
        const snapshot: ProveedorSnapshot = {
          proveedorId: proveedor.id,
          nombre: proveedor.nombre,
          pais: proveedor.pais
        };
        onChange(snapshot);
        setInputValue(proveedor.nombre);
      } else {
        // Usar el store por defecto (requiere userId del contexto de auth)
        // Este caso se maneja externamente
        console.warn('No onCreateNew provided for ProveedorAutocomplete');
      }

      setShowCreateForm(false);
      setIsOpen(false);
    } catch (error) {
      console.error('Error creando proveedor:', error);
    } finally {
      setCreando(false);
    }
  };

  // Limpiar selección
  const handleClear = () => {
    setInputValue('');
    onChange(null);
    inputRef.current?.focus();
  };

  // Obtener color por tipo
  const getColorByTipo = (tipo: TipoProveedor): string => {
    const colores: Record<TipoProveedor, string> = {
      fabricante: 'bg-purple-100 text-purple-800',
      distribuidor: 'bg-blue-100 text-blue-800',
      mayorista: 'bg-green-100 text-green-800',
      minorista: 'bg-gray-100 text-gray-800'
    };
    return colores[tipo] || colores.distribuidor;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input principal */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Building2 className="h-5 w-5 text-gray-400" />
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

        {/* Indicador de proveedor seleccionado o botón de limpiar */}
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
      {isOpen && !showCreateForm && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto">
          {filteredProveedores.length > 0 ? (
            <>
              {filteredProveedores.map((proveedor) => (
                <button
                  key={proveedor.id}
                  type="button"
                  onClick={() => handleSelectProveedor(proveedor)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{proveedor.nombre}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${getColorByTipo(proveedor.tipo)}`}>
                          {proveedor.tipo}
                        </span>
                      </div>
                      <div className="flex items-center mt-1 text-xs text-gray-500">
                        <Globe className="h-3 w-3 mr-1" />
                        {proveedor.pais}
                        {proveedor.contacto && (
                          <span className="ml-2">• {proveedor.contacto}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {/* Opción de crear nuevo */}
              {allowCreate && inputValue.length >= 2 && (
                <button
                  type="button"
                  onClick={handleShowCreate}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 text-primary-600 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear nuevo proveedor "{inputValue}"
                </button>
              )}
            </>
          ) : !loading && inputValue.length >= 1 ? (
            <div className="px-4 py-3">
              <div className="text-sm text-gray-500 mb-2">
                No se encontraron proveedores con "{inputValue}"
              </div>
              {allowCreate && (
                <button
                  type="button"
                  onClick={handleShowCreate}
                  className="w-full px-3 py-2 bg-primary-50 text-primary-600 rounded-md flex items-center justify-center hover:bg-primary-100"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear nuevo proveedor
                </button>
              )}
            </div>
          ) : filteredProveedores.length === 0 && !loading ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              Escribe para buscar proveedores...
            </div>
          ) : null}
        </div>
      )}

      {/* Formulario de creación rápida */}
      {showCreateForm && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Nuevo Proveedor</h4>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nombre del Proveedor *
              </label>
              <input
                type="text"
                value={nuevoProveedor.nombre || ''}
                onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  value={nuevoProveedor.tipo}
                  onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, tipo: e.target.value as TipoProveedor })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="distribuidor">Distribuidor</option>
                  <option value="fabricante">Fabricante</option>
                  <option value="mayorista">Mayorista</option>
                  <option value="minorista">Minorista</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  País *
                </label>
                <select
                  value={nuevoProveedor.pais}
                  onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, pais: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="USA">USA</option>
                  <option value="China">China</option>
                  <option value="Alemania">Alemania</option>
                  <option value="India">India</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Contacto
                </label>
                <input
                  type="text"
                  value={nuevoProveedor.contacto || ''}
                  onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, contacto: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Nombre del contacto"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={nuevoProveedor.email || ''}
                  onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="email@proveedor.com"
                />
              </div>
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
                onClick={handleCreateProveedor}
                disabled={!nuevoProveedor.nombre || creando}
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
