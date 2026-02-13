import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package,
  Check,
  X,
  TrendingUp,
  DollarSign,
  Clock,
  MapPin,
  Plane,
  Truck,
  ChevronRight,
  Info,
  ShoppingCart,
  Calendar,
  History
} from 'lucide-react';
import type { Producto } from '../../../types/producto.types';

/**
 * Snapshot del producto seleccionado para requerimientos
 */
export interface ProductoRequerimientoSnapshot {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion?: string;
  // Stock por ubicación
  stockPeru: number;
  stockUSA: number;
  stockEnTransito: number;
  stockTotal: number;
  // Costos
  ultimoCostoUSD?: number;
  costoPromedioUSD?: number;
  precioVentaPEN?: number;
  // Última compra
  ultimaCompraFecha?: Date;
  ultimaCompraProveedor?: string;
  // Investigación
  tieneInvestigacion: boolean;
  investigacionVigente: boolean;
}

/**
 * Datos extendidos de stock y compras
 */
interface StockYComprasData {
  peru: number;
  usa: number;
  enTransito: number;
  ultimoCostoUSD?: number;
  costoPromedioUSD?: number;
  ultimaCompraFecha?: Date;
  ultimaCompraProveedor?: string;
}

interface ProductoSearchRequerimientosProps {
  productos: Producto[];
  value?: ProductoRequerimientoSnapshot | null;
  onChange: (producto: ProductoRequerimientoSnapshot | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  // Datos extendidos de stock y compras históricas
  stockYComprasData?: Map<string, StockYComprasData>;
}

export const ProductoSearchRequerimientos: React.FC<ProductoSearchRequerimientosProps> = ({
  productos,
  value,
  onChange,
  placeholder = 'Buscar producto por SKU, marca o nombre...',
  required = false,
  disabled = false,
  className = '',
  stockYComprasData
}) => {
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 300 });
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sincronizar valor inicial
  useEffect(() => {
    if (value?.sku && !inputValue) {
      setInputValue(`${value.sku} - ${value.marca} ${value.nombreComercial}`);
    }
  }, [value, inputValue]);

  // Click fuera para cerrar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsideDropdown = dropdownRef.current?.contains(target);

      if (!isInsideContainer && !isInsideDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Actualizar posición del dropdown
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setDropdownPosition({
            top: rect.bottom + 4,
            left: rect.left,
            width: Math.max(rect.width, 550)
          });
        }
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  // Filtrar productos
  useEffect(() => {
    if (inputValue.length >= 1) {
      const searchLower = inputValue.toLowerCase();
      const productosArr = Array.isArray(productos) ? productos : [];
      const filtered = productosArr.filter(p => {
        const sku = (p.sku ?? '').toLowerCase();
        const marca = (p.marca ?? '').toLowerCase();
        const nombreComercial = (p.nombreComercial ?? '').toLowerCase();
        return sku.includes(searchLower) ||
               marca.includes(searchLower) ||
               nombreComercial.includes(searchLower) ||
               `${marca} ${nombreComercial}`.toLowerCase().includes(searchLower);
      });

      setFilteredProductos(filtered.slice(0, 15));
      setHighlightedIndex(-1);
    } else {
      setFilteredProductos([]);
    }
  }, [inputValue, productos]);

  // Obtener datos de stock y compras - usa el Map externo o los datos del producto
  const getStockYCompras = useCallback((producto: Producto): StockYComprasData => {
    const data = stockYComprasData?.get(producto.id);
    if (data) return data;

    // Si no hay data externa, usar los campos del producto directamente
    return {
      peru: producto.stockPeru ?? 0,
      usa: producto.stockUSA ?? 0,
      enTransito: producto.stockTransito ?? 0,
      ultimoCostoUSD: producto.investigacion?.precioUSAPromedio,
      costoPromedioUSD: producto.investigacion?.precioUSAPromedio
    };
  }, [stockYComprasData]);

  // Calcular días desde última compra
  const getDiasDesdeUltimaCompra = (fecha?: Date) => {
    if (!fecha) return null;
    const ahora = new Date();
    const diff = ahora.getTime() - fecha.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setInputValue(valor);

    if (valor.length >= 1) {
      setIsOpen(true);
    }

    if (value) {
      onChange(null);
    }
  }, [value, onChange]);

  // Seleccionar producto
  const handleSelectProducto = (producto: Producto) => {
    const stockData = getStockYCompras(producto);
    const inv = producto.investigacion;

    const snapshot: ProductoRequerimientoSnapshot = {
      productoId: producto.id,
      sku: producto.sku,
      marca: producto.marca,
      nombreComercial: producto.nombreComercial,
      presentacion: producto.presentacion,
      stockPeru: stockData.peru,
      stockUSA: stockData.usa,
      stockEnTransito: stockData.enTransito,
      stockTotal: stockData.peru + stockData.usa + stockData.enTransito,
      ultimoCostoUSD: stockData.ultimoCostoUSD,
      costoPromedioUSD: stockData.costoPromedioUSD,
      precioVentaPEN: inv?.precioPERUPromedio, // Precio de venta promedio del mercado
      ultimaCompraFecha: stockData.ultimaCompraFecha,
      ultimaCompraProveedor: stockData.ultimaCompraProveedor,
      tieneInvestigacion: !!inv,
      investigacionVigente: inv?.estaVigente ?? false
    };

    onChange(snapshot);
    setInputValue(`${producto.sku} - ${producto.marca} ${producto.nombreComercial}`);
    setIsOpen(false);
  };

  // Limpiar
  const handleClear = () => {
    setInputValue('');
    onChange(null);
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredProductos.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredProductos.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredProductos[highlightedIndex]) {
          handleSelectProducto(filteredProductos[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Determinar estado de stock
  const getEstadoStock = (stockData: StockYComprasData) => {
    const total = stockData.peru + stockData.usa + stockData.enTransito;
    if (total === 0) return { label: 'Sin stock', color: 'text-red-600 bg-red-50' };
    if (stockData.peru > 0) return { label: 'Disponible Perú', color: 'text-green-600 bg-green-50' };
    if (stockData.usa > 0) return { label: 'Disponible USA', color: 'text-blue-600 bg-blue-50' };
    if (stockData.enTransito > 0) return { label: 'En tránsito', color: 'text-amber-600 bg-amber-50' };
    return { label: 'Requiere compra', color: 'text-purple-600 bg-purple-50' };
  };

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
          onClick={() => !isOpen && inputValue.length >= 1 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
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

        {/* Indicador */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {value ? (
            <div className="flex items-center space-x-1">
              <Check className="h-4 w-4 text-green-500" />
              {!disabled && (
                <button type="button" onClick={handleClear} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : inputValue && !disabled ? (
            <button type="button" onClick={handleClear} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[400px] overflow-y-auto"
          style={{
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            
            
            
          }}
        >
          {filteredProductos.length > 0 ? (
            <>
              {/* Header */}
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {filteredProductos.length} producto{filteredProductos.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-green-500" /> Perú
                    </span>
                    <span className="flex items-center gap-1">
                      <Plane className="h-3 w-3 text-blue-500" /> USA
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck className="h-3 w-3 text-amber-500" /> Tráns.
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Costo
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista */}
              {filteredProductos.map((producto, index) => {
                const stockData = getStockYCompras(producto);
                const estadoStock = getEstadoStock(stockData);
                const diasUltimaCompra = getDiasDesdeUltimaCompra(stockData.ultimaCompraFecha);
                const inv = producto.investigacion;
                const sinStock = stockData.peru + stockData.usa + stockData.enTransito === 0;

                return (
                  <button
                    key={producto.id}
                    type="button"
                    onClick={() => handleSelectProducto(producto)}
                    className={`
                      w-full px-4 py-3 text-left border-b border-gray-100 last:border-0 transition-colors
                      ${highlightedIndex === index ? 'bg-primary-50' : 'hover:bg-gray-50'}
                    `}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Info producto */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-primary-600 font-medium">
                            {producto.sku}
                          </span>
                          {inv?.estaVigente && (
                            <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-700">
                              <TrendingUp className="h-3 w-3 inline mr-0.5" />
                              Inv. vigente
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 text-xs rounded ${estadoStock.color}`}>
                            {estadoStock.label}
                          </span>
                        </div>
                        <div className="font-medium text-gray-900 mt-0.5 truncate">
                          {producto.marca} - {producto.nombreComercial}
                        </div>
                        <div className="text-xs text-gray-500">{producto.presentacion}</div>
                      </div>

                      {/* Métricas */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Stock por ubicación */}
                        <div className="flex items-center gap-1">
                          <div className="text-center min-w-[35px] px-1.5 py-1 bg-green-50 rounded">
                            <MapPin className="h-3 w-3 text-green-600 mx-auto" />
                            <div className="font-bold text-xs text-green-700">{stockData.peru}</div>
                          </div>
                          <div className="text-center min-w-[35px] px-1.5 py-1 bg-blue-50 rounded">
                            <Plane className="h-3 w-3 text-blue-600 mx-auto" />
                            <div className="font-bold text-xs text-blue-700">{stockData.usa}</div>
                          </div>
                          <div className="text-center min-w-[35px] px-1.5 py-1 bg-amber-50 rounded">
                            <Truck className="h-3 w-3 text-amber-600 mx-auto" />
                            <div className="font-bold text-xs text-amber-700">{stockData.enTransito}</div>
                          </div>
                        </div>

                        {/* Último costo */}
                        {stockData.ultimoCostoUSD && (
                          <div className="text-center min-w-[55px] px-2 py-1 bg-gray-100 rounded">
                            <div className="text-xs text-gray-500">Costo</div>
                            <div className="font-semibold text-gray-700 text-sm">
                              ${stockData.ultimoCostoUSD.toFixed(2)}
                            </div>
                          </div>
                        )}

                        {/* Última compra */}
                        {diasUltimaCompra !== null && (
                          <div className="text-center min-w-[45px] px-2 py-1 bg-purple-50 rounded">
                            <div className="text-xs text-purple-500">Últ.</div>
                            <div className="font-semibold text-purple-700 text-sm">
                              {diasUltimaCompra}d
                            </div>
                          </div>
                        )}

                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </div>

                    {/* Info adicional de última compra */}
                    {stockData.ultimaCompraProveedor && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <History className="h-3 w-3" />
                        <span>Última compra: {stockData.ultimaCompraProveedor}</span>
                        {stockData.ultimaCompraFecha && (
                          <span className="text-gray-400">
                            ({stockData.ultimaCompraFecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })})
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </>
          ) : inputValue.length >= 1 ? (
            <div className="px-4 py-6 text-center">
              <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No se encontraron productos con "{inputValue}"</p>
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500">
              Escribe para buscar productos...
            </div>
          )}
        </div>
      )}

      {/* Panel de info del producto seleccionado */}
      {value && (
        <div className="mt-2 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">
                Info para requerimiento
              </span>
            </div>
            {value.investigacionVigente && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                <TrendingUp className="h-3 w-3" />
                Investigación vigente
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-2">
            {/* Stock Perú */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3 text-green-500" /> Perú
              </p>
              <p className="font-bold text-lg text-green-600">{value.stockPeru}</p>
            </div>

            {/* Stock USA */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <Plane className="h-3 w-3 text-blue-500" /> USA
              </p>
              <p className="font-bold text-lg text-blue-600">{value.stockUSA}</p>
            </div>

            {/* En tránsito */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <Truck className="h-3 w-3 text-amber-500" /> Tránsito
              </p>
              <p className="font-bold text-lg text-amber-600">{value.stockEnTransito}</p>
            </div>

            {/* Último costo */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <DollarSign className="h-3 w-3" /> Últ. Costo
              </p>
              <p className="font-bold text-lg text-gray-700">
                {value.ultimoCostoUSD ? `$${value.ultimoCostoUSD.toFixed(2)}` : '-'}
              </p>
            </div>

            {/* Precio venta */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <ShoppingCart className="h-3 w-3" /> P. Venta
              </p>
              <p className="font-bold text-lg text-purple-600">
                {value.precioVentaPEN ? `S/${value.precioVentaPEN.toFixed(0)}` : '-'}
              </p>
            </div>
          </div>

          {/* Info última compra */}
          {value.ultimaCompraFecha && (
            <div className="mt-2 pt-2 border-t border-purple-200 flex items-center justify-between text-xs">
              <span className="text-gray-600 flex items-center gap-1">
                <History className="h-3 w-3" /> Última compra:
              </span>
              <span className="font-medium text-gray-700">
                {value.ultimaCompraProveedor && `${value.ultimaCompraProveedor} - `}
                {value.ultimaCompraFecha.toLocaleDateString('es-PE')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
