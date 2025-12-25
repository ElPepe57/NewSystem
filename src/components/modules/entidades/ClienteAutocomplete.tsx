import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Plus,
  AlertCircle,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { useClienteStore } from '../../../store/clienteStore';
import type { Cliente, ClienteFormData, ClienteSnapshot } from '../../../types/entidadesMaestras.types';

interface ClienteAutocompleteProps {
  value?: ClienteSnapshot | null;
  onChange: (cliente: ClienteSnapshot | null) => void;
  onCreateNew?: (data: Partial<ClienteFormData>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowCreate?: boolean;
  className?: string;
}

// Configuración de búsqueda inteligente
const MIN_CHARS_BUSQUEDA = 2;
const DEBOUNCE_MS = 150; // Reducido porque ahora es búsqueda local

export const ClienteAutocomplete: React.FC<ClienteAutocompleteProps> = ({
  value,
  onChange,
  onCreateNew,
  placeholder = 'Buscar cliente por nombre, teléfono o DNI...',
  required = false,
  disabled = false,
  allowCreate = true,
  className = ''
}) => {
  const {
    resultadosBusqueda,
    duplicadosDetectados,
    buscando,
    cacheActualizado,
    buscar,
    buscarLocal,
    cargarCacheInicial,
    detectarDuplicados,
    limpiarBusqueda,
    getOrCreate
  } = useClienteStore();

  // Pre-cargar caché al montar el componente
  useEffect(() => {
    cargarCacheInicial();
  }, [cargarCacheInicial]);

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState<Partial<ClienteFormData>>({
    canalOrigen: 'whatsapp',
    tipoCliente: 'persona'
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

  // Búsqueda inteligente con debounce optimizado
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

    // Solo buscar si hay mínimo de caracteres
    if (valor.length >= MIN_CHARS_BUSQUEDA) {
      // Si hay caché, búsqueda inmediata (es local y rápida)
      if (cacheActualizado) {
        debounceRef.current = setTimeout(() => {
          buscar(valor);
        }, DEBOUNCE_MS);
      } else {
        // Sin caché, usar debounce más largo
        debounceRef.current = setTimeout(() => {
          buscar(valor);
        }, 300);
      }
    } else {
      limpiarBusqueda();
    }
  }, [value, onChange, buscar, limpiarBusqueda, cacheActualizado]);

  // Seleccionar cliente existente
  const handleSelectCliente = (cliente: Cliente) => {
    const snapshot: ClienteSnapshot = {
      clienteId: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email,
      dniRuc: cliente.dniRuc
    };
    onChange(snapshot);
    setInputValue(cliente.nombre);
    setIsOpen(false);
    limpiarBusqueda();
  };

  // Abrir formulario de creación
  const handleShowCreate = () => {
    setNuevoCliente({
      nombre: inputValue,
      canalOrigen: 'whatsapp',
      tipoCliente: 'persona'
    });
    setShowCreateForm(true);

    // Detectar duplicados
    if (inputValue.length >= 2) {
      detectarDuplicados({ nombre: inputValue } as ClienteFormData);
    }
  };

  // Crear nuevo cliente
  const handleCreateCliente = async () => {
    if (!nuevoCliente.nombre) return;

    setCreando(true);
    try {
      if (onCreateNew) {
        onCreateNew(nuevoCliente);
      }
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creando cliente:', error);
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

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input principal */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {buscando ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
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

        {/* Indicador de cliente seleccionado o botón de limpiar */}
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

      {/* Info del cliente seleccionado */}
      {value && (
        <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500">
          {value.telefono && (
            <span className="flex items-center">
              <Phone className="h-3 w-3 mr-1" />
              {value.telefono}
            </span>
          )}
          {value.email && (
            <span className="flex items-center">
              <Mail className="h-3 w-3 mr-1" />
              {value.email}
            </span>
          )}
          {value.dniRuc && (
            <span className="flex items-center">
              <User className="h-3 w-3 mr-1" />
              {value.dniRuc}
            </span>
          )}
        </div>
      )}

      {/* Dropdown de resultados */}
      {isOpen && !showCreateForm && inputValue.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto">
          {/* Mensaje si faltan caracteres */}
          {inputValue.length < MIN_CHARS_BUSQUEDA ? (
            <div className="px-4 py-3 text-sm text-gray-400 text-center">
              Escribe al menos {MIN_CHARS_BUSQUEDA} caracteres para buscar
            </div>
          ) : buscando ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Buscando...
            </div>
          ) : resultadosBusqueda.length > 0 ? (
            <>
              {resultadosBusqueda.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => handleSelectCliente(cliente)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{cliente.nombre}</div>
                      <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                        {cliente.telefono && (
                          <span className="flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            {cliente.telefono}
                          </span>
                        )}
                        {cliente.dniRuc && (
                          <span className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {cliente.dniRuc}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {cliente.metricas.totalCompras > 0 && (
                        <span>{cliente.metricas.totalCompras} compras</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              {/* Opción de crear nuevo */}
              {allowCreate && (
                <button
                  type="button"
                  onClick={handleShowCreate}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 text-primary-600 flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear nuevo cliente "{inputValue}"
                </button>
              )}
            </>
          ) : (
            <div className="px-4 py-3">
              <div className="text-sm text-gray-500 mb-2">
                No se encontraron clientes con "{inputValue}"
              </div>
              {allowCreate && (
                <button
                  type="button"
                  onClick={handleShowCreate}
                  className="w-full px-3 py-2 bg-primary-50 text-primary-600 rounded-md flex items-center justify-center hover:bg-primary-100"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear nuevo cliente
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formulario de creación rápida */}
      {showCreateForm && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Nuevo Cliente</h4>
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
                  <div className="font-medium text-amber-800">Posibles duplicados</div>
                  {duplicadosDetectados.map((dup, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectCliente(dup.entidad)}
                      className="block text-amber-700 hover:underline"
                    >
                      {dup.entidad.nombre} ({dup.campo}: {dup.valorCoincidente})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={nuevoCliente.nombre || ''}
                onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Teléfono (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={nuevoCliente.telefono || ''}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="999 123 456"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  DNI/RUC
                </label>
                <input
                  type="text"
                  value={nuevoCliente.dniRuc || ''}
                  onChange={(e) => setNuevoCliente({ ...nuevoCliente, dniRuc: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="12345678"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Canal de origen
              </label>
              <select
                value={nuevoCliente.canalOrigen}
                onChange={(e) => setNuevoCliente({ ...nuevoCliente, canalOrigen: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="mercadolibre">MercadoLibre</option>
                <option value="referido">Referido</option>
                <option value="web">Web</option>
                <option value="otro">Otro</option>
              </select>
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
                onClick={handleCreateCliente}
                disabled={!nuevoCliente.nombre || creando}
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
