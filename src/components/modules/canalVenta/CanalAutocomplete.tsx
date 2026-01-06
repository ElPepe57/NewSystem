import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  Plus,
  X,
  Store,
  ShoppingBag,
  MessageCircle,
  Globe,
  Tag,
  MoreHorizontal,
  Instagram,
  Phone,
  Mail,
  Users,
  Percent
} from 'lucide-react';
import { Modal, Button, Input } from '../../common';
import { useCanalVentaStore } from '../../../store/canalVentaStore';
import { useAuthStore } from '../../../store/authStore';
import type { CanalVenta, CanalVentaFormData } from '../../../types/canalVenta.types';

// Mapeo de nombres de icono a componentes
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Store,
  ShoppingBag,
  MessageCircle,
  Globe,
  Tag,
  MoreHorizontal,
  Instagram,
  Phone,
  Mail,
  Users
};

interface CanalAutocompleteProps {
  value: string; // ID del canal o nombre legacy
  onChange: (canalId: string, canal?: CanalVenta) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const CanalAutocomplete: React.FC<CanalAutocompleteProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Buscar o crear canal...',
  required = false,
  error,
  disabled = false,
  className = ''
}) => {
  const user = useAuthStore(state => state.user);
  const {
    canales,
    canalesActivos,
    loading,
    fetchCanalesActivos,
    createCanal
  } = useCanalVentaStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCanalName, setNewCanalName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cargar canales activos al montar
  useEffect(() => {
    if (canalesActivos.length === 0) {
      fetchCanalesActivos();
    }
  }, [fetchCanalesActivos, canalesActivos.length]);

  // Encontrar el canal seleccionado actualmente
  const selectedCanal = useMemo(() => {
    if (!value) return null;
    // Buscar por ID primero
    let canal = canalesActivos.find(c => c.id === value);
    if (canal) return canal;
    // Buscar en todos los canales (incluidos inactivos)
    canal = canales.find(c => c.id === value);
    if (canal) return canal;
    // Buscar por nombre (para valores legacy)
    canal = canalesActivos.find(c => c.nombre.toLowerCase() === value.toLowerCase());
    if (canal) return canal;
    // Buscar por código
    canal = canalesActivos.find(c => c.codigo === value);
    return canal;
  }, [value, canalesActivos, canales]);

  // Sincronizar searchValue con el canal seleccionado
  useEffect(() => {
    if (selectedCanal && !isOpen) {
      setSearchValue(selectedCanal.nombre);
    } else if (!selectedCanal && value && !isOpen) {
      // Valor legacy que no se encontró como canal
      setSearchValue(value);
    } else if (!value) {
      setSearchValue('');
    }
  }, [selectedCanal, value, isOpen]);

  // Filtrar canales basados en búsqueda (con validación segura)
  const filteredCanales = useMemo(() => {
    const canalesArr = Array.isArray(canalesActivos) ? canalesActivos : [];
    if (!searchValue.trim()) return canalesArr.slice(0, 10);

    const searchTerm = searchValue.toLowerCase().trim();
    return canalesArr
      .filter(c => {
        const nombre = (c.nombre ?? '').toLowerCase();
        const codigo = (c.codigo ?? '').toLowerCase();
        const descripcion = (c.descripcion ?? '').toLowerCase();
        return nombre.includes(searchTerm) || codigo.includes(searchTerm) || descripcion.includes(searchTerm);
      })
      .sort((a, b) => {
        // Priorizar coincidencias al inicio del nombre
        const aNombre = (a.nombre ?? '').toLowerCase();
        const bNombre = (b.nombre ?? '').toLowerCase();
        const aStarts = aNombre.startsWith(searchTerm);
        const bStarts = bNombre.startsWith(searchTerm);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aNombre.localeCompare(bNombre);
      })
      .slice(0, 10);
  }, [searchValue, canalesActivos]);

  // Determinar si mostrar opción de crear
  const showCreateOption = useMemo(() => {
    if (!searchValue.trim()) return false;
    const exists = canalesActivos.some(
      c => c.nombre.toLowerCase() === searchValue.toLowerCase().trim()
    );
    return !exists;
  }, [searchValue, canalesActivos]);

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
        // Restaurar el valor del canal seleccionado
        if (selectedCanal) {
          setSearchValue(selectedCanal.nombre);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedCanal]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSelect = (canal: CanalVenta) => {
    setSearchValue(canal.nombre);
    onChange(canal.id, canal);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleOpenCreateModal = () => {
    setNewCanalName(searchValue.trim());
    setShowCreateModal(true);
    setIsOpen(false);
  };

  const handleCreateCanal = async () => {
    if (!user || !newCanalName.trim()) return;

    setIsCreating(true);
    try {
      const formData: CanalVentaFormData = {
        nombre: newCanalName.trim(),
        descripcion: '',
        comisionPorcentaje: 0,
        requiereEnvio: true,
        color: '#6b7280',
        icono: 'Tag',
        estado: 'activo'
      };

      const newId = await createCanal(formData, user.uid);

      // Refrescar canales activos
      await fetchCanalesActivos();

      // Seleccionar el nuevo canal
      const nuevoCanal = canalesActivos.find(c => c.id === newId);
      if (nuevoCanal) {
        onChange(newId, nuevoCanal);
        setSearchValue(nuevoCanal.nombre);
      } else {
        onChange(newId);
        setSearchValue(newCanalName.trim());
      }

      setShowCreateModal(false);
      setNewCanalName('');
    } catch (err) {
      console.error('Error creando canal:', err);
      alert(err instanceof Error ? err.message : 'Error al crear canal');
    } finally {
      setIsCreating(false);
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

    const totalItems = filteredCanales.length + (showCreateOption ? 1 : 0);

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
          if (highlightedIndex < filteredCanales.length) {
            handleSelect(filteredCanales[highlightedIndex]);
          } else if (showCreateOption) {
            handleOpenCreateModal();
          }
        } else if (filteredCanales.length > 0) {
          handleSelect(filteredCanales[0]);
        } else if (showCreateOption) {
          handleOpenCreateModal();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (selectedCanal) {
          setSearchValue(selectedCanal.nombre);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const handleClear = () => {
    setSearchValue('');
    onChange('', undefined);
    inputRef.current?.focus();
  };

  // Renderizar icono del canal
  const renderCanalIcon = (canal: CanalVenta) => {
    const IconComponent = iconMap[canal.icono || 'Tag'] || Tag;
    return (
      <span style={{ color: canal.color || '#6b7280' }}>
        <IconComponent className="h-4 w-4" />
      </span>
    );
  };

  // Renderizar badge de canal
  const renderCanalBadge = (canal: CanalVenta, size: 'sm' | 'md' = 'sm') => {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
        }`}
        style={{
          backgroundColor: `${canal.color || '#6b7280'}20`,
          color: canal.color || '#6b7280'
        }}
      >
        <span
          className={`rounded-full ${size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'}`}
          style={{ backgroundColor: canal.color || '#6b7280' }}
        />
        {canal.nombre}
      </span>
    );
  };

  // Highlight match en texto
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

  return (
    <div className={`relative w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-danger-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Input con badge del canal seleccionado */}
        <div
          className={`
            flex items-center w-full rounded-lg border
            ${error ? 'border-danger-300' : 'border-gray-300'}
            ${disabled ? 'bg-gray-100' : 'bg-white'}
            focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent
          `}
        >
          {selectedCanal && !isOpen ? (
            // Mostrar badge cuando hay canal seleccionado y no está editando
            <div className="flex items-center gap-2 pl-3 py-2 flex-1">
              {renderCanalBadge(selectedCanal, 'md')}
              {(selectedCanal.comisionPorcentaje || 0) > 0 && (
                <span className="text-xs text-gray-500 flex items-center gap-0.5">
                  <Percent className="h-3 w-3" />
                  {selectedCanal.comisionPorcentaje}%
                </span>
              )}
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={searchValue}
              onChange={handleInputChange}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1 px-3 py-2 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none disabled:cursor-not-allowed rounded-l-lg"
            />
          )}

          <div className="flex items-center pr-2 gap-1">
            {(searchValue || selectedCanal) && !disabled && (
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
              onClick={() => {
                if (!disabled) {
                  if (selectedCanal && !isOpen) {
                    setSearchValue(selectedCanal.nombre);
                  }
                  setIsOpen(!isOpen);
                  inputRef.current?.focus();
                }
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              tabIndex={-1}
              disabled={disabled}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Dropdown de opciones */}
      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-72 overflow-auto"
        >
          {loading ? (
            <div className="px-3 py-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : (
            <>
              {filteredCanales.length > 0 ? (
                filteredCanales.map((canal, index) => (
                  <button
                    key={canal.id}
                    type="button"
                    onClick={() => handleSelect(canal)}
                    className={`
                      w-full text-left px-3 py-2.5 flex items-center gap-3
                      ${highlightedIndex === index ? 'bg-primary-50' : 'hover:bg-gray-50'}
                      ${index === 0 ? 'rounded-t-lg' : ''}
                      ${index === filteredCanales.length - 1 && !showCreateOption ? 'rounded-b-lg' : ''}
                    `}
                  >
                    <div
                      className="p-1.5 rounded-lg"
                      style={{ backgroundColor: `${canal.color || '#6b7280'}20` }}
                    >
                      {renderCanalIcon(canal)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {highlightMatch(canal.nombre, searchValue)}
                      </div>
                      {canal.descripcion && (
                        <div className="text-xs text-gray-500 truncate">
                          {canal.descripcion}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(canal.comisionPorcentaje || 0) > 0 && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {canal.comisionPorcentaje}%
                        </span>
                      )}
                      {canal.esSistema && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          Sistema
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : searchValue.trim() && !showCreateOption ? (
                <div className="px-3 py-4 text-center text-gray-500 text-sm">
                  No se encontraron canales
                </div>
              ) : null}

              {/* Opción de crear nuevo */}
              {showCreateOption && (
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className={`
                    w-full text-left px-3 py-2.5 flex items-center gap-3
                    border-t border-gray-100
                    ${highlightedIndex === filteredCanales.length ? 'bg-primary-50' : 'hover:bg-gray-50'}
                    rounded-b-lg
                  `}
                >
                  <div className="p-1.5 rounded-lg bg-primary-100">
                    <Plus className="h-4 w-4 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm text-primary-600 font-medium">
                      Crear canal:
                    </span>
                    <span className="text-sm font-semibold text-primary-700 ml-1">
                      "{searchValue.trim()}"
                    </span>
                  </div>
                </button>
              )}

              {/* Sin resultados y sin opción de crear */}
              {filteredCanales.length === 0 && !showCreateOption && !searchValue.trim() && (
                <div className="px-3 py-4 text-center text-gray-500 text-sm">
                  Escribe para buscar o crear un canal
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-danger-600">{error}</p>
      )}

      {/* Modal para crear nuevo canal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewCanalName('');
        }}
        title="Crear Nuevo Canal de Venta"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Nombre del Canal"
            value={newCanalName}
            onChange={(e) => setNewCanalName(e.target.value)}
            placeholder="Ej: TikTok, Referidos, etc."
            autoFocus
          />

          <p className="text-sm text-gray-500">
            Puedes configurar más detalles (comisión, color, icono) desde la sección de Maestros después de crearlo.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false);
                setNewCanalName('');
              }}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateCanal}
              disabled={isCreating || !newCanalName.trim()}
            >
              {isCreating ? 'Creando...' : 'Crear Canal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
