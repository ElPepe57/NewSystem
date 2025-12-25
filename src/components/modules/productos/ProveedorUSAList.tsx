import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, ExternalLink, Package, DollarSign, Truck, Percent, Building2, Check, X, Loader2, Globe } from 'lucide-react';
import { Button, Input } from '../../common';
import { useProveedorStore } from '../../../store/proveedorStore';
import { useAuthStore } from '../../../store/authStore';
import type { ProveedorUSAFormData } from '../../../types/producto.types';
import type { Proveedor, ProveedorFormData, TipoProveedor } from '../../../types/ordenCompra.types';

interface ProveedorUSAListProps {
  proveedores: ProveedorUSAFormData[];
  onChange: (proveedores: ProveedorUSAFormData[]) => void;
  disabled?: boolean;
  /** Sugerencias adicionales de proveedores (de la base de datos - legacy) */
  sugerenciasProveedores?: string[];
}

export const ProveedorUSAList: React.FC<ProveedorUSAListProps> = ({
  proveedores,
  onChange,
  disabled = false,
  sugerenciasProveedores = []
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const user = useAuthStore(state => state.user);

  // Store de proveedores del Gestor Maestro
  const {
    proveedoresActivos,
    loading: loadingProveedores,
    fetchProveedoresActivos,
    createProveedor
  } = useProveedorStore();

  // Cargar proveedores del Gestor Maestro al montar
  useEffect(() => {
    if (proveedoresActivos.length === 0) {
      fetchProveedoresActivos();
    }
  }, []);

  // Filtrar solo proveedores USA
  const proveedoresUSA = useMemo(() => {
    return proveedoresActivos.filter(p => p.pais === 'USA');
  }, [proveedoresActivos]);

  const handleAddProveedor = () => {
    const newProveedor: ProveedorUSAFormData = {
      id: `prov-${Date.now()}`,
      nombre: '',
      precio: 0,
      disponibilidad: 'desconocido'
    };
    onChange([...proveedores, newProveedor]);
    setExpandedId(newProveedor.id);
  };

  const handleRemoveProveedor = (id: string) => {
    onChange(proveedores.filter(p => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdateProveedor = (id: string, updates: Partial<ProveedorUSAFormData>) => {
    onChange(proveedores.map(p =>
      p.id === id ? { ...p, ...updates } : p
    ));
  };

  const calcularPromedio = () => {
    if (proveedores.length === 0) return 0;
    const total = proveedores.reduce((sum, p) => sum + (p.precio || 0), 0);
    return total / proveedores.length;
  };

  const calcularMinMax = () => {
    if (proveedores.length === 0) return { min: 0, max: 0 };
    const precios = proveedores.map(p => p.precio || 0).filter(p => p > 0);
    if (precios.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...precios),
      max: Math.max(...precios)
    };
  };

  const { min, max } = calcularMinMax();
  const promedio = calcularPromedio();

  return (
    <div className="space-y-4">
      {/* Header con estadísticas */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-blue-600" />
          <h4 className="font-medium text-gray-900">Proveedores USA</h4>
          <span className="text-sm text-gray-500">({proveedores.length})</span>
        </div>
        {proveedores.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">
              Min: <span className="font-medium text-green-600">${min.toFixed(2)}</span>
            </span>
            <span className="text-gray-500">
              Max: <span className="font-medium text-red-600">${max.toFixed(2)}</span>
            </span>
            <span className="text-gray-500">
              Prom: <span className="font-medium text-blue-600">${promedio.toFixed(2)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Lista de proveedores */}
      <div className="space-y-3">
        {proveedores.map((proveedor, index) => (
          <div
            key={proveedor.id}
            className={`border rounded-lg transition-all ${
              expandedId === proveedor.id ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-white'
            }`}
          >
            {/* Fila compacta */}
            <div
              className="p-3 flex items-center gap-3 cursor-pointer"
              onClick={() => setExpandedId(expandedId === proveedor.id ? null : proveedor.id)}
            >
              <span className="text-sm font-medium text-gray-400 w-6">#{index + 1}</span>

              <div className="flex-1 grid grid-cols-4 gap-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <span className={proveedor.nombre ? 'font-medium' : 'text-gray-400 italic'}>
                    {proveedor.nombre || 'Sin nombre'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <span className={`font-medium ${
                    proveedor.precio === min && min > 0 ? 'text-green-600' :
                    proveedor.precio === max && max > 0 ? 'text-red-600' : 'text-gray-700'
                  }`}>
                    ${(proveedor.precio || 0).toFixed(2)}
                  </span>
                  {proveedor.precio === min && min > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Mejor</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600 text-sm">
                    {proveedor.impuesto ? `${proveedor.impuesto}% tax` : 'Sin tax'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {proveedor.url && (
                    <a
                      href={proveedor.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    proveedor.disponibilidad === 'en_stock' ? 'bg-green-100 text-green-700' :
                    proveedor.disponibilidad === 'bajo_stock' ? 'bg-yellow-100 text-yellow-700' :
                    proveedor.disponibilidad === 'sin_stock' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {proveedor.disponibilidad === 'en_stock' ? 'En stock' :
                     proveedor.disponibilidad === 'bajo_stock' ? 'Bajo stock' :
                     proveedor.disponibilidad === 'sin_stock' ? 'Sin stock' : '?'}
                  </span>
                </div>
              </div>

              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveProveedor(proveedor.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Detalles expandidos */}
            {expandedId === proveedor.id && (
              <ProveedorExpandido
                proveedor={proveedor}
                proveedoresUSA={proveedoresUSA}
                loadingProveedores={loadingProveedores}
                disabled={disabled}
                onUpdate={(updates) => handleUpdateProveedor(proveedor.id, updates)}
                onClose={() => setExpandedId(null)}
                onCreateProveedor={async (data) => {
                  if (!user) return;
                  try {
                    await createProveedor(data, user.uid);
                  } catch (error) {
                    console.error('Error creando proveedor:', error);
                  }
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Botón agregar */}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          onClick={handleAddProveedor}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Proveedor USA
        </Button>
      )}

      {proveedores.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          No hay proveedores registrados. Agrega al menos uno para calcular precios.
        </p>
      )}
    </div>
  );
};

// Componente para la sección expandida con el autocomplete de proveedores
interface ProveedorExpandidoProps {
  proveedor: ProveedorUSAFormData;
  proveedoresUSA: Proveedor[];
  loadingProveedores: boolean;
  disabled: boolean;
  onUpdate: (updates: Partial<ProveedorUSAFormData>) => void;
  onClose: () => void;
  onCreateProveedor: (data: ProveedorFormData) => Promise<void>;
}

const ProveedorExpandido: React.FC<ProveedorExpandidoProps> = ({
  proveedor,
  proveedoresUSA,
  loadingProveedores,
  disabled,
  onUpdate,
  onClose,
  onCreateProveedor
}) => {
  const [inputValue, setInputValue] = useState(proveedor.nombre || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nuevoProveedor, setNuevoProveedor] = useState<Partial<ProveedorFormData>>({
    nombre: '',
    tipo: 'distribuidor',
    pais: 'USA'
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtrar proveedores por búsqueda
  const proveedoresFiltrados = useMemo(() => {
    if (inputValue.length < 1) return proveedoresUSA;
    const searchLower = inputValue.toLowerCase();
    return proveedoresUSA.filter(p =>
      p.nombre.toLowerCase().includes(searchLower) ||
      p.codigo?.toLowerCase().includes(searchLower)
    );
  }, [inputValue, proveedoresUSA]);

  // Click fuera para cerrar dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setShowCreateForm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setInputValue(valor);
    setIsDropdownOpen(true);
    onUpdate({ nombre: valor });
  };

  const handleSelectProveedor = (prov: Proveedor) => {
    setInputValue(prov.nombre);
    onUpdate({ nombre: prov.nombre, proveedorId: prov.id });
    setIsDropdownOpen(false);
  };

  const handleShowCreate = () => {
    setNuevoProveedor({
      nombre: inputValue,
      tipo: 'distribuidor',
      pais: 'USA'
    });
    setShowCreateForm(true);
    setIsDropdownOpen(false);
  };

  const handleCreateAndSelect = async () => {
    if (!nuevoProveedor.nombre) return;
    setCreando(true);
    try {
      await onCreateProveedor(nuevoProveedor as ProveedorFormData);
      setInputValue(nuevoProveedor.nombre);
      onUpdate({ nombre: nuevoProveedor.nombre });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setCreando(false);
    }
  };

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
    <div className="px-3 pb-3 pt-0 border-t border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        {/* Autocomplete de Proveedor conectado al Gestor Maestro */}
        <div ref={containerRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del proveedor
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {loadingProveedores ? (
                <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="ej: Amazon, iHerb..."
              disabled={disabled}
              className={`
                block w-full pl-9 pr-8 py-2 border rounded-lg text-sm
                focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
                ${proveedor.nombre ? 'border-green-300 bg-green-50' : 'border-gray-300'}
              `}
            />
            {proveedor.nombre && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Check className="h-4 w-4 text-green-500" />
              </div>
            )}
          </div>

          {/* Dropdown de proveedores del Gestor Maestro */}
          {isDropdownOpen && !showCreateForm && (
            <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-auto">
              {proveedoresFiltrados.length > 0 ? (
                <>
                  {proveedoresFiltrados.slice(0, 10).map((prov) => (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => handleSelectProveedor(prov)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            {prov.codigo && (
                              <span className="text-xs text-gray-400 font-mono">{prov.codigo}</span>
                            )}
                            <span className="font-medium text-gray-900 text-sm">{prov.nombre}</span>
                            <span className={`px-1.5 py-0.5 text-xs rounded ${getColorByTipo(prov.tipo)}`}>
                              {prov.tipo}
                            </span>
                          </div>
                          {prov.contacto && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {prov.contacto}
                            </div>
                          )}
                        </div>
                        {prov.metricas?.ordenesCompra > 0 && (
                          <span className="text-xs text-gray-400">
                            {prov.metricas.ordenesCompra} órdenes
                          </span>
                        )}
                      </div>
                    </button>
                  ))}

                  {/* Opción de crear nuevo */}
                  {inputValue.length >= 2 && (
                    <button
                      type="button"
                      onClick={handleShowCreate}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 text-primary-600 flex items-center border-t border-gray-200"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Crear proveedor "{inputValue}"
                    </button>
                  )}
                </>
              ) : inputValue.length >= 1 ? (
                <div className="px-3 py-2">
                  <div className="text-sm text-gray-500 mb-2">
                    No se encontraron proveedores
                  </div>
                  <button
                    type="button"
                    onClick={handleShowCreate}
                    className="w-full px-3 py-1.5 bg-primary-50 text-primary-600 rounded text-sm flex items-center justify-center hover:bg-primary-100"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Crear "{inputValue}"
                  </button>
                </div>
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">
                  {loadingProveedores ? 'Cargando proveedores...' : 'Escribe para buscar...'}
                </div>
              )}
            </div>
          )}

          {/* Formulario de creación rápida */}
          {showCreateForm && (
            <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium text-gray-900 text-sm">Nuevo Proveedor USA</h5>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={nuevoProveedor.nombre || ''}
                  onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, nombre: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  placeholder="Nombre del proveedor"
                  autoFocus
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={nuevoProveedor.tipo}
                    onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, tipo: e.target.value as TipoProveedor })}
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                  >
                    <option value="distribuidor">Distribuidor</option>
                    <option value="fabricante">Fabricante</option>
                    <option value="mayorista">Mayorista</option>
                    <option value="minorista">Minorista</option>
                  </select>

                  <input
                    type="email"
                    value={nuevoProveedor.email || ''}
                    onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, email: e.target.value })}
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder="Email (opcional)"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAndSelect}
                    disabled={!nuevoProveedor.nombre || creando}
                    className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 disabled:opacity-50"
                  >
                    {creando ? 'Creando...' : 'Crear'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <Input
          label="Precio (USD)"
          name="precio"
          type="number"
          step="0.01"
          value={proveedor.precio || ''}
          onChange={(e) => onUpdate({
            precio: parseFloat(e.target.value) || 0
          })}
          disabled={disabled}
        />

        <div className="flex items-end gap-2">
          <Input
            label="Impuesto USA (%)"
            name="impuesto"
            type="number"
            step="0.01"
            min="0"
            max="15"
            value={proveedor.impuesto || ''}
            onChange={(e) => onUpdate({
              impuesto: parseFloat(e.target.value) || 0
            })}
            placeholder="ej: 8.25"
            helperText="Sales tax del estado"
            disabled={disabled}
          />
          <div className="pb-2">
            <Percent className="h-5 w-5 text-gray-400" />
          </div>
        </div>

        <Input
          label="URL del producto"
          name="url"
          type="url"
          value={proveedor.url || ''}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://..."
          disabled={disabled}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Disponibilidad
          </label>
          <select
            value={proveedor.disponibilidad || 'desconocido'}
            onChange={(e) => onUpdate({
              disponibilidad: e.target.value as ProveedorUSAFormData['disponibilidad']
            })}
            disabled={disabled}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="desconocido">Desconocido</option>
            <option value="en_stock">En stock</option>
            <option value="bajo_stock">Bajo stock</option>
            <option value="sin_stock">Sin stock</option>
          </select>
        </div>

        <div className="flex items-end gap-2">
          <Input
            label="Envío estimado (USD)"
            name="envioEstimado"
            type="number"
            step="0.01"
            value={proveedor.envioEstimado || ''}
            onChange={(e) => onUpdate({
              envioEstimado: parseFloat(e.target.value) || 0
            })}
            disabled={disabled}
          />
          <div className="pb-2">
            <Truck className="h-5 w-5 text-gray-400" />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas
          </label>
          <textarea
            value={proveedor.notas || ''}
            onChange={(e) => onUpdate({ notas: e.target.value })}
            placeholder="Observaciones sobre este proveedor..."
            rows={2}
            disabled={disabled}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Botón para cerrar/confirmar edición */}
        <div className="md:col-span-2 flex justify-end pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
