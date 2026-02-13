import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Package,
  Search,
  Check,
  X,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Calendar,
  Boxes,
  Lock,
  ChevronRight,
  Info
} from 'lucide-react';
import type { ProductoDisponible } from '../../../types/venta.types';

/**
 * Snapshot del producto seleccionado para ventas
 */
export interface ProductoVentaSnapshot {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  stockDisponible: number;
  stockReservado: number;
  stockLibre: number;  // disponible - reservado
  precioSugerido: number;
  ctruPromedio?: number;
  margenEstimado?: number;
  proximoVencimiento?: Date;
  diasParaVencer?: number;
}

/**
 * Props extendidas para el componente de búsqueda en Ventas
 */
interface ProductoSearchVentasProps {
  productos: ProductoDisponible[];
  value?: ProductoVentaSnapshot | null;
  onChange: (producto: ProductoVentaSnapshot | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  // Datos adicionales de stock real y vencimiento
  stockData?: Map<string, {
    disponible: number;
    reservado: number;
    proximoVencimiento?: Date;
    ctruPromedio?: number;
  }>;
}

export const ProductoSearchVentas: React.FC<ProductoSearchVentasProps> = ({
  productos,
  value,
  onChange,
  placeholder = 'Buscar producto por SKU, marca o nombre...',
  required = false,
  disabled = false,
  className = '',
  stockData
}) => {
  const [filteredProductos, setFilteredProductos] = useState<ProductoDisponible[]>([]);
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
            width: Math.max(rect.width, 450) // Mínimo 450px para mostrar toda la info
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

  // Filtrar productos al escribir
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

  // Obtener datos extendidos de stock para un producto
  const getStockExtendido = useCallback((productoId: string, productoBase: ProductoDisponible) => {
    const data = stockData?.get(productoId);
    return {
      disponible: data?.disponible ?? productoBase.unidadesDisponibles,
      reservado: data?.reservado ?? 0,
      libre: (data?.disponible ?? productoBase.unidadesDisponibles) - (data?.reservado ?? 0),
      proximoVencimiento: data?.proximoVencimiento,
      ctruPromedio: data?.ctruPromedio ?? productoBase.investigacion?.ctruEstimado
    };
  }, [stockData]);

  // Calcular días para vencer
  const getDiasParaVencer = (fecha?: Date) => {
    if (!fecha) return null;
    const ahora = new Date();
    const diff = fecha.getTime() - ahora.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Calcular margen estimado
  const calcularMargen = (precio: number, ctru?: number) => {
    if (!ctru || ctru === 0 || precio === 0) return null;
    return ((precio - ctru) / precio) * 100;
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
  const handleSelectProducto = (producto: ProductoDisponible) => {
    const stockExt = getStockExtendido(producto.productoId, producto);
    const diasVencer = getDiasParaVencer(stockExt.proximoVencimiento);
    const margen = calcularMargen(producto.precioSugerido, stockExt.ctruPromedio);

    const snapshot: ProductoVentaSnapshot = {
      productoId: producto.productoId,
      sku: producto.sku,
      marca: producto.marca,
      nombreComercial: producto.nombreComercial,
      presentacion: producto.presentacion,
      stockDisponible: stockExt.disponible,
      stockReservado: stockExt.reservado,
      stockLibre: stockExt.libre,
      precioSugerido: producto.precioSugerido,
      ctruPromedio: stockExt.ctruPromedio,
      margenEstimado: margen ?? undefined,
      proximoVencimiento: stockExt.proximoVencimiento,
      diasParaVencer: diasVencer ?? undefined
    };

    onChange(snapshot);
    setInputValue(`${producto.sku} - ${producto.marca} ${producto.nombreComercial}`);
    setIsOpen(false);
  };

  // Limpiar selección
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

  // Obtener color del margen
  const getMargenColor = (margen: number) => {
    if (margen >= 25) return 'text-green-600 bg-green-50';
    if (margen >= 15) return 'text-emerald-600 bg-emerald-50';
    if (margen >= 10) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  // Obtener color de vencimiento
  const getVencimientoColor = (dias: number) => {
    if (dias <= 30) return 'text-red-600 bg-red-50';
    if (dias <= 90) return 'text-amber-600 bg-amber-50';
    return 'text-green-600 bg-green-50';
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

        {/* Indicador de selección */}
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
                    {filteredProductos.length} producto{filteredProductos.length !== 1 ? 's' : ''} encontrado{filteredProductos.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Boxes className="h-3 w-3" /> Stock
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Margen
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Vence
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de productos */}
              {filteredProductos.map((producto, index) => {
                const stockExt = getStockExtendido(producto.productoId, producto);
                const diasVencer = getDiasParaVencer(stockExt.proximoVencimiento);
                const margen = calcularMargen(producto.precioSugerido, stockExt.ctruPromedio);
                const sinStockLibre = stockExt.libre <= 0;

                return (
                  <button
                    key={producto.productoId}
                    type="button"
                    onClick={() => handleSelectProducto(producto)}
                    className={`
                      w-full px-4 py-3 text-left border-b border-gray-100 last:border-0 transition-colors
                      ${highlightedIndex === index ? 'bg-primary-50' : 'hover:bg-gray-50'}
                      ${sinStockLibre ? 'opacity-60' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Info principal del producto */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-primary-600 font-medium">
                            {producto.sku}
                          </span>
                          {producto.investigacion && (
                            <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700 flex items-center">
                              <TrendingUp className="h-3 w-3 mr-0.5" />
                              Inv
                            </span>
                          )}
                          {sinStockLibre && (
                            <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 flex items-center">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />
                              Sin stock
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-gray-900 mt-0.5 truncate">
                          {producto.marca} - {producto.nombreComercial}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {producto.presentacion}
                        </div>
                      </div>

                      {/* Métricas contextuales */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Stock */}
                        <div className="text-center min-w-[60px]">
                          <div className="flex items-center justify-center gap-1">
                            <Boxes className="h-3 w-3 text-gray-400" />
                            <span className={`font-bold text-sm ${
                              stockExt.libre > 5 ? 'text-green-600' :
                              stockExt.libre > 0 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                              {stockExt.libre}
                            </span>
                          </div>
                          {stockExt.reservado > 0 && (
                            <div className="flex items-center justify-center text-xs text-gray-400 mt-0.5">
                              <Lock className="h-2.5 w-2.5 mr-0.5" />
                              {stockExt.reservado}
                            </div>
                          )}
                        </div>

                        {/* CTRU */}
                        {stockExt.ctruPromedio && (
                          <div className="text-center min-w-[55px] px-2 py-1 bg-gray-100 rounded">
                            <div className="text-xs text-gray-500">CTRU</div>
                            <div className="font-semibold text-gray-700 text-sm">
                              S/{stockExt.ctruPromedio.toFixed(0)}
                            </div>
                          </div>
                        )}

                        {/* Margen */}
                        {margen !== null && (
                          <div className={`text-center min-w-[50px] px-2 py-1 rounded ${getMargenColor(margen)}`}>
                            <div className="text-xs opacity-80">Marg.</div>
                            <div className="font-bold text-sm">
                              {margen.toFixed(0)}%
                            </div>
                          </div>
                        )}

                        {/* Vencimiento */}
                        {diasVencer !== null && (
                          <div className={`text-center min-w-[50px] px-2 py-1 rounded ${getVencimientoColor(diasVencer)}`}>
                            <div className="text-xs opacity-80">Vence</div>
                            <div className="font-bold text-sm">
                              {diasVencer}d
                            </div>
                          </div>
                        )}

                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </div>

                    {/* Precio sugerido */}
                    {producto.precioSugerido > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Precio sugerido:</span>
                        <span className="font-semibold text-primary-600">
                          S/ {producto.precioSugerido.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </>
          ) : inputValue.length >= 1 ? (
            <div className="px-4 py-6 text-center">
              <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No se encontraron productos con "{inputValue}"
              </p>
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
        <div className="mt-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                Información del producto
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-2">
            {/* Stock libre */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <Boxes className="h-3 w-3" /> Stock libre
              </p>
              <p className={`font-bold text-lg ${
                value.stockLibre > 5 ? 'text-green-600' :
                value.stockLibre > 0 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {value.stockLibre}
              </p>
              {value.stockReservado > 0 && (
                <p className="text-xs text-gray-400 flex items-center justify-center gap-0.5">
                  <Lock className="h-2.5 w-2.5" />
                  {value.stockReservado} reserv.
                </p>
              )}
            </div>

            {/* CTRU */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <DollarSign className="h-3 w-3" /> CTRU Prom.
              </p>
              <p className="font-bold text-lg text-gray-700">
                {value.ctruPromedio ? `S/${value.ctruPromedio.toFixed(2)}` : '-'}
              </p>
            </div>

            {/* Margen */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3" /> Margen Est.
              </p>
              <p className={`font-bold text-lg ${
                value.margenEstimado
                  ? value.margenEstimado >= 20 ? 'text-green-600' :
                    value.margenEstimado >= 10 ? 'text-yellow-600' : 'text-red-600'
                  : 'text-gray-400'
              }`}>
                {value.margenEstimado ? `${value.margenEstimado.toFixed(1)}%` : '-'}
              </p>
            </div>

            {/* Vencimiento */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                <Calendar className="h-3 w-3" /> Vencimiento
              </p>
              <p className={`font-bold text-lg ${
                value.diasParaVencer
                  ? value.diasParaVencer <= 30 ? 'text-red-600' :
                    value.diasParaVencer <= 90 ? 'text-amber-600' : 'text-green-600'
                  : 'text-gray-400'
              }`}>
                {value.diasParaVencer ? `${value.diasParaVencer}d` : '-'}
              </p>
              {value.proximoVencimiento && (
                <p className="text-xs text-gray-400">
                  {value.proximoVencimiento.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
