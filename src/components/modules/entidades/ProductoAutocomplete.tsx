import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Package,
  Search,
  Check,
  X,
  Loader2,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Lightbulb,
  Star,
  ExternalLink
} from 'lucide-react';
import type { Producto, InvestigacionMercado } from '../../../types/producto.types';

export interface ProductoSnapshot {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
}

interface SugerenciaProveedor {
  nombreProveedor: string;
  precioUSD: number;
  precioConImpuesto: number;
  impuesto?: number;
  url?: string;
  disponibilidad?: string;
}

interface ProductoAutocompleteProps {
  productos: Producto[];
  value?: ProductoSnapshot | null;
  onChange: (producto: ProductoSnapshot | null, sugerencia?: SugerenciaProveedor | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showInvestigacionSugerencia?: boolean;
  proveedorSeleccionado?: string;
  className?: string;
}

export const ProductoAutocomplete: React.FC<ProductoAutocompleteProps> = ({
  productos,
  value,
  onChange,
  placeholder = 'Buscar producto por SKU, marca o nombre...',
  required = false,
  disabled = false,
  showInvestigacionSugerencia = true,
  proveedorSeleccionado,
  className = ''
}) => {
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar valor inicial
  useEffect(() => {
    if (value?.sku && !inputValue) {
      setInputValue(`${value.sku} - ${value.marca} ${value.nombreComercial}`);
      // Buscar producto completo para tener la investigación
      const prod = productos.find(p => p.id === value.productoId);
      if (prod) setSelectedProducto(prod);
    }
  }, [value, productos]);

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

  // Filtrar productos al escribir
  useEffect(() => {
    if (inputValue.length >= 1) {
      const searchLower = inputValue.toLowerCase();
      const filtered = productos.filter(p =>
        p.sku.toLowerCase().includes(searchLower) ||
        p.marca.toLowerCase().includes(searchLower) ||
        p.nombreComercial.toLowerCase().includes(searchLower)
      );
      setFilteredProductos(filtered.slice(0, 20)); // Limitar a 20 resultados
    } else {
      setFilteredProductos([]);
    }
  }, [inputValue, productos]);

  // Obtener mejor proveedor de la investigación
  const getMejorProveedor = useCallback((producto: Producto): SugerenciaProveedor | null => {
    const inv = producto.investigacion;
    if (!inv?.proveedoresUSA?.length) return null;

    // Filtrar por proveedor seleccionado si existe
    let proveedores = inv.proveedoresUSA;
    if (proveedorSeleccionado) {
      const proveedorMatch = proveedores.find(p =>
        p.nombre.toLowerCase().includes(proveedorSeleccionado.toLowerCase())
      );
      if (proveedorMatch) {
        const impuestoDecimal = (proveedorMatch.impuesto || 0) / 100;
        return {
          nombreProveedor: proveedorMatch.nombre,
          precioUSD: proveedorMatch.precio,
          precioConImpuesto: proveedorMatch.precio * (1 + impuestoDecimal),
          impuesto: proveedorMatch.impuesto,
          url: proveedorMatch.url,
          disponibilidad: proveedorMatch.disponibilidad
        };
      }
    }

    // Si no, buscar el mejor precio
    const mejorProveedor = proveedores.reduce((mejor, actual) => {
      const precioMejor = mejor.precio * (1 + (mejor.impuesto || 0) / 100);
      const precioActual = actual.precio * (1 + (actual.impuesto || 0) / 100);
      return precioActual < precioMejor ? actual : mejor;
    }, proveedores[0]);

    if (!mejorProveedor) return null;

    const impuestoDecimal = (mejorProveedor.impuesto || 0) / 100;
    return {
      nombreProveedor: mejorProveedor.nombre,
      precioUSD: mejorProveedor.precio,
      precioConImpuesto: mejorProveedor.precio * (1 + impuestoDecimal),
      impuesto: mejorProveedor.impuesto,
      url: mejorProveedor.url,
      disponibilidad: mejorProveedor.disponibilidad
    };
  }, [proveedorSeleccionado]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setInputValue(valor);
    setIsOpen(true);

    // Limpiar selección si el usuario está editando
    if (value) {
      onChange(null);
      setSelectedProducto(null);
    }
  }, [value, onChange]);

  // Seleccionar producto
  const handleSelectProducto = (producto: Producto) => {
    const snapshot: ProductoSnapshot = {
      productoId: producto.id,
      sku: producto.sku,
      marca: producto.marca,
      nombreComercial: producto.nombreComercial,
      presentacion: producto.presentacion
    };

    const sugerencia = getMejorProveedor(producto);
    setSelectedProducto(producto);
    onChange(snapshot, sugerencia);
    setInputValue(`${producto.sku} - ${producto.marca} ${producto.nombreComercial}`);
    setIsOpen(false);
  };

  // Usar sugerencia de precio
  const handleUsarSugerencia = (sugerencia: SugerenciaProveedor) => {
    if (selectedProducto) {
      const snapshot: ProductoSnapshot = {
        productoId: selectedProducto.id,
        sku: selectedProducto.sku,
        marca: selectedProducto.marca,
        nombreComercial: selectedProducto.nombreComercial,
        presentacion: selectedProducto.presentacion
      };
      onChange(snapshot, sugerencia);
    }
  };

  // Limpiar selección
  const handleClear = () => {
    setInputValue('');
    onChange(null);
    setSelectedProducto(null);
    inputRef.current?.focus();
  };

  // Info de investigación del producto seleccionado
  const investigacionInfo = useMemo(() => {
    if (!selectedProducto?.investigacion) return null;
    const inv = selectedProducto.investigacion;
    return {
      vigente: inv.estaVigente,
      mejorProveedor: getMejorProveedor(selectedProducto),
      margenEstimado: inv.margenEstimado,
      ctruEstimado: inv.ctruEstimado
    };
  }, [selectedProducto, getMejorProveedor]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input principal */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Package className="h-5 w-5 text-gray-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => inputValue.length >= 1 && setIsOpen(true)}
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

        {/* Indicador de producto seleccionado */}
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
        <div className="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-80 overflow-auto">
          {filteredProductos.length > 0 ? (
            filteredProductos.map((producto) => {
              const tieneInvestigacion = producto.investigacion?.estaVigente;
              const mejorPrecio = tieneInvestigacion ? getMejorProveedor(producto) : null;

              return (
                <button
                  key={producto.id}
                  type="button"
                  onClick={() => handleSelectProducto(producto)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm text-primary-600">{producto.sku}</span>
                        {tieneInvestigacion && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-700 flex items-center">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Investigado
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-gray-900 mt-0.5">
                        {producto.marca} - {producto.nombreComercial}
                      </div>
                      <div className="text-xs text-gray-500">
                        {producto.presentacion} {producto.dosaje} {producto.contenido}
                      </div>
                    </div>

                    {/* Precio sugerido si hay investigación */}
                    {mejorPrecio && (
                      <div className="text-right ml-3">
                        <div className="flex items-center text-green-600">
                          <DollarSign className="h-3 w-3" />
                          <span className="font-bold">{mejorPrecio.precioConImpuesto.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {mejorPrecio.nombreProveedor}
                        </div>
                        {mejorPrecio.impuesto && mejorPrecio.impuesto > 0 && (
                          <div className="text-xs text-amber-600">
                            +{mejorPrecio.impuesto}% tax
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          ) : inputValue.length >= 1 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              No se encontraron productos con "{inputValue}"
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500">
              Escribe para buscar productos...
            </div>
          )}
        </div>
      )}

      {/* Panel de sugerencia de investigación */}
      {showInvestigacionSugerencia && investigacionInfo && investigacionInfo.mejorProveedor && (
        <div className="mt-2 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                Sugerencia de Investigación
              </span>
            </div>
            {investigacionInfo.mejorProveedor.url && (
              <a
                href={investigacionInfo.mejorProveedor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
              >
                Ver en {investigacionInfo.mejorProveedor.nombreProveedor}
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3 mt-2">
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600">Proveedor</p>
              <p className="font-medium text-gray-900 text-sm">
                {investigacionInfo.mejorProveedor.nombreProveedor}
              </p>
            </div>
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600">Precio USD</p>
              <p className="font-bold text-green-600">
                ${investigacionInfo.mejorProveedor.precioConImpuesto.toFixed(2)}
              </p>
              {investigacionInfo.mejorProveedor.impuesto && investigacionInfo.mejorProveedor.impuesto > 0 && (
                <p className="text-xs text-amber-600">
                  (${investigacionInfo.mejorProveedor.precioUSD.toFixed(2)} + {investigacionInfo.mejorProveedor.impuesto}% tax)
                </p>
              )}
            </div>
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600">CTRU Estimado</p>
              <p className="font-medium text-gray-900">
                S/{investigacionInfo.ctruEstimado?.toFixed(2) || '-'}
              </p>
            </div>
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600">Margen Est.</p>
              <p className={`font-bold ${
                (investigacionInfo.margenEstimado || 0) >= 20 ? 'text-green-600' : 'text-amber-600'
              }`}>
                {investigacionInfo.margenEstimado?.toFixed(1) || '-'}%
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleUsarSugerencia(investigacionInfo.mejorProveedor!)}
            className="mt-2 w-full py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors flex items-center justify-center"
          >
            <Star className="h-4 w-4 mr-1" />
            Usar este precio sugerido
          </button>
        </div>
      )}
    </div>
  );
};
