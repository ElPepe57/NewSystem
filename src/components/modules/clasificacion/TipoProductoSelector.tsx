import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, FlaskConical, Check } from 'lucide-react';
import { useTipoProductoStore } from '../../../store/tipoProductoStore';
import { useAuthStore } from '../../../store/authStore';
import type { TipoProducto, TipoProductoSnapshot } from '../../../types/tipoProducto.types';

interface TipoProductoSelectorProps {
  value?: string;                    // ID del tipo seleccionado
  onChange: (tipoId: string | undefined, snapshot?: TipoProductoSnapshot) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  error?: string;
}

export function TipoProductoSelector({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Buscar tipo de producto...',
  className = '',
  error
}: TipoProductoSelectorProps) {
  const { user } = useAuthStore();
  const { tiposActivos, fetchTiposActivos, crearRapido, loading } = useTipoProductoStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateOption, setShowCreateOption] = useState(false);
  const [creating, setCreating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar tipos activos al montar
  useEffect(() => {
    if (tiposActivos.length === 0) {
      fetchTiposActivos();
    }
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Obtener tipo seleccionado
  const tipoSeleccionado = tiposActivos.find(t => t.id === value);

  // Filtrar tipos por busqueda
  const tiposFiltrados = tiposActivos.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.nombre.toLowerCase().includes(term) ||
      t.codigo.toLowerCase().includes(term) ||
      t.alias?.some(a => a.toLowerCase().includes(term))
    );
  });

  // Mostrar opcion de crear si no hay coincidencia exacta
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const existeExacto = tiposActivos.some(
        t => t.nombre.toLowerCase() === searchTerm.toLowerCase()
      );
      setShowCreateOption(!existeExacto);
    } else {
      setShowCreateOption(false);
    }
  }, [searchTerm, tiposActivos]);

  // Seleccionar tipo
  const handleSelect = (tipo: TipoProducto) => {
    const snapshot: TipoProductoSnapshot = {
      tipoProductoId: tipo.id,
      codigo: tipo.codigo,
      nombre: tipo.nombre
    };
    onChange(tipo.id, snapshot);
    setSearchTerm('');
    setIsOpen(false);
  };

  // Crear nuevo tipo rapido
  const handleCreateNew = async () => {
    if (!user || !searchTerm.trim()) return;

    setCreating(true);
    try {
      const nuevoTipo = await crearRapido(searchTerm.trim(), user.uid);
      const snapshot: TipoProductoSnapshot = {
        tipoProductoId: nuevoTipo.id,
        codigo: nuevoTipo.codigo,
        nombre: nuevoTipo.nombre
      };
      onChange(nuevoTipo.id, snapshot);
      setSearchTerm('');
      setIsOpen(false);
    } catch (error) {
      console.error('Error al crear tipo:', error);
    } finally {
      setCreating(false);
    }
  };

  // Limpiar seleccion
  const handleClear = () => {
    onChange(undefined, undefined);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <FlaskConical className="inline-block w-4 h-4 mr-1 text-gray-400" />
        Tipo de Producto
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Input/Display */}
      <div className="relative">
        {tipoSeleccionado ? (
          // Mostrar tipo seleccionado
          <div
            className={`
              flex items-center justify-between px-3 py-2 border rounded-lg bg-white
              ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary-400'}
              ${error ? 'border-red-300' : 'border-gray-300'}
            `}
            onClick={() => !disabled && setIsOpen(!isOpen)}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-mono">{tipoSeleccionado.codigo}</span>
              <span className="font-medium text-gray-900">{tipoSeleccionado.nombre}</span>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        ) : (
          // Input de busqueda
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              className={`
                w-full pl-10 pr-4 py-2 border rounded-lg
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}
                ${error ? 'border-red-300' : 'border-gray-300'}
              `}
            />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {loading ? (
            <div className="px-4 py-3 text-center text-gray-500">
              Cargando...
            </div>
          ) : (
            <>
              {/* Opcion de crear nuevo */}
              {showCreateOption && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  disabled={creating}
                  className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-primary-50 border-b border-gray-100 text-primary-600"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {creating ? 'Creando...' : `Crear "${searchTerm}"`}
                  </span>
                </button>
              )}

              {/* Lista de tipos */}
              {tiposFiltrados.length > 0 ? (
                tiposFiltrados.map((tipo) => (
                  <button
                    key={tipo.id}
                    type="button"
                    onClick={() => handleSelect(tipo)}
                    className={`
                      w-full px-4 py-2 flex items-center justify-between text-left
                      hover:bg-gray-50 transition-colors
                      ${tipo.id === value ? 'bg-primary-50' : ''}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono">{tipo.codigo}</span>
                      <span className="text-gray-900">{tipo.nombre}</span>
                    </div>
                    {tipo.id === value && (
                      <Check className="w-4 h-4 text-primary-600" />
                    )}
                  </button>
                ))
              ) : (
                !showCreateOption && (
                  <div className="px-4 py-3 text-center text-gray-500">
                    No se encontraron tipos
                  </div>
                )
              )}

              {/* Sugerencias rapidas si no hay busqueda */}
              {!searchTerm && tiposActivos.length > 0 && (
                <div className="px-3 py-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400 uppercase">Tipos frecuentes</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tiposActivos.slice(0, 6).map((tipo) => (
                      <button
                        key={tipo.id}
                        type="button"
                        onClick={() => handleSelect(tipo)}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700"
                      >
                        {tipo.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Hint */}
      <p className="mt-1 text-xs text-gray-500">
        El tipo agrupa productos similares de diferentes marcas (ej: Omega 3, Colageno)
      </p>
    </div>
  );
}
