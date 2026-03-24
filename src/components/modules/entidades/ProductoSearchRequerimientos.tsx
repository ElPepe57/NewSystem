import React, { useState, useEffect, useCallback } from 'react';
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
import { useProductoDropdown } from '../../../hooks/useProductoDropdown';

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
  // Hook compartido
  const {
    containerRef,
    inputRef,
    dropdownRef,
    inputValue,
    setInputValue,
    isOpen,
    setIsOpen,
    filteredItems: filteredProductos,
    highlightedIndex,
    dropdownPosition,
    handleInputChange: hookInputChange,
    handleKeyDown,
    handleSelect: hookSelect,
    handleClear: hookClear,
    onSelectCallback,
  } = useProductoDropdown<Producto>({
    items: Array.isArray(productos) ? productos : [],
    getSearchableText: (p) => `${p.sku ?? ''} ${p.marca ?? ''} ${p.nombreComercial ?? ''}`,
    getLabel: (p) => `${p.sku} - ${p.marca} ${p.nombreComercial}`,
    extraFilter: (p) => !p.esPadre,
    maxResults: 15,
    minChars: 1,
    minDropdownWidth: 550,
    useFixed: true,
  });

  useEffect(() => {
    onSelectCallback.current = (producto: Producto) => {
      handleSelectProducto(producto);
    };
  }, []);

  useEffect(() => {
    if (value?.sku && !inputValue) {
      setInputValue(`${value.sku} - ${value.marca} ${value.nombreComercial}`);
    }
  }, [value]);

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
    hookInputChange(e.target.value);
    if (value) onChange(null);
  }, [value, onChange, hookInputChange]);

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
    hookClear();
    onChange(null);
    inputRef.current?.focus();
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
        <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none">
          <Package className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
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
            block w-full pl-8 sm:pl-10 pr-10 py-2 text-sm sm:text-base border rounded-md shadow-sm
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
              <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs text-gray-500">
                    {filteredProductos.length} producto{filteredProductos.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs text-gray-400">
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500" /> PE
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Plane className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-500" /> US
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Truck className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-500" /> Trán.
                    </span>
                    <span className="flex items-center gap-0.5">
                      <DollarSign className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Costo
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
                      w-full px-2.5 sm:px-4 py-2 sm:py-3 text-left border-b border-gray-100 last:border-0 transition-colors
                      ${highlightedIndex === index ? 'bg-primary-50' : 'hover:bg-gray-50'}
                    `}
                  >
                    {/* Top: SKU + badges + chevron */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap min-w-0">
                        <span className="font-mono text-xs sm:text-sm text-primary-600 font-medium flex-shrink-0">
                          {producto.sku}
                        </span>
                        {inv?.estaVigente && (
                          <span className="px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded bg-green-100 text-green-700 flex items-center flex-shrink-0">
                            <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
                            <span className="hidden sm:inline">Inv. vigente</span>
                            <span className="sm:hidden">Inv.</span>
                          </span>
                        )}
                        <span className={`px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded flex-shrink-0 ${estadoStock.color}`}>
                          {estadoStock.label}
                        </span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-300 flex-shrink-0" />
                    </div>

                    {/* Product name + presentation */}
                    <div className="mt-0.5 sm:mt-1">
                      <div className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                        {producto.marca} - {producto.nombreComercial}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                        {[producto.presentacion, producto.contenido, producto.dosaje, producto.sabor].filter(Boolean).join(' · ') || 'Sin detalle'}
                      </div>
                    </div>

                    {/* Metrics row: compact horizontal pills */}
                    <div className="flex items-center gap-1 sm:gap-2 mt-1 sm:mt-1.5 flex-wrap">
                      {/* Stock Perú */}
                      <div className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-50 rounded text-[10px] sm:text-xs">
                        <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600" />
                        <span className="font-bold text-green-700">{stockData.peru}</span>
                      </div>

                      {/* Stock USA */}
                      <div className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-50 rounded text-[10px] sm:text-xs">
                        <Plane className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-600" />
                        <span className="font-bold text-blue-700">{stockData.usa}</span>
                      </div>

                      {/* En tránsito */}
                      <div className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-50 rounded text-[10px] sm:text-xs">
                        <Truck className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-600" />
                        <span className="font-bold text-amber-700">{stockData.enTransito}</span>
                      </div>

                      {/* Último costo */}
                      {stockData.ultimoCostoUSD && (
                        <div className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 rounded text-[10px] sm:text-xs">
                          <span className="text-gray-500">Costo:</span>
                          <span className="font-semibold text-gray-700">${stockData.ultimoCostoUSD.toFixed(2)}</span>
                        </div>
                      )}

                      {/* Última compra */}
                      {diasUltimaCompra !== null && (
                        <div className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-50 rounded text-[10px] sm:text-xs font-semibold text-purple-700">
                          {diasUltimaCompra}d
                        </div>
                      )}
                    </div>

                    {/* Info adicional de última compra */}
                    {stockData.ultimaCompraProveedor && (
                      <div className="mt-1 sm:mt-1.5 pt-1 sm:pt-1.5 border-t border-gray-100 flex items-center text-[10px] sm:text-xs text-gray-500 truncate">
                        <History className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 flex-shrink-0" />
                        <span className="truncate">Última: {stockData.ultimaCompraProveedor}</span>
                        {stockData.ultimaCompraFecha && (
                          <span className="text-gray-400 ml-1 flex-shrink-0">
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
        <div className="mt-2 p-2 sm:p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-purple-800 truncate">
                Info para requerimiento
              </span>
            </div>
            {value.investigacionVigente && (
              <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-green-100 text-green-700 flex-shrink-0">
                <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="hidden sm:inline">Investigación vigente</span>
                <span className="sm:hidden">Inv.</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
            {/* Stock Perú */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 flex items-center justify-center gap-0.5 sm:gap-1">
                <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-500" /> Perú
              </p>
              <p className="font-bold text-sm sm:text-lg text-green-600">{value.stockPeru}</p>
            </div>

            {/* Stock USA */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 flex items-center justify-center gap-0.5 sm:gap-1">
                <Plane className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-500" /> USA
              </p>
              <p className="font-bold text-sm sm:text-lg text-blue-600">{value.stockUSA}</p>
            </div>

            {/* En tránsito */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 flex items-center justify-center gap-0.5 sm:gap-1">
                <Truck className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-500" /> Tráns.
              </p>
              <p className="font-bold text-sm sm:text-lg text-amber-600">{value.stockEnTransito}</p>
            </div>

            {/* Último costo */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 flex items-center justify-center gap-0.5 sm:gap-1">
                <DollarSign className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Costo
              </p>
              <p className="font-bold text-sm sm:text-lg text-gray-700">
                {value.ultimoCostoUSD ? `$${value.ultimoCostoUSD.toFixed(2)}` : '-'}
              </p>
            </div>

            {/* Precio venta */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 flex items-center justify-center gap-0.5 sm:gap-1">
                <ShoppingCart className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Venta
              </p>
              <p className="font-bold text-sm sm:text-lg text-purple-600">
                {value.precioVentaPEN ? `S/${value.precioVentaPEN.toFixed(0)}` : '-'}
              </p>
            </div>
          </div>

          {/* Info última compra */}
          {value.ultimaCompraFecha && (
            <div className="mt-2 pt-2 border-t border-purple-200 flex items-center justify-between text-[10px] sm:text-xs gap-1">
              <span className="text-gray-600 flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                <History className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Última:
              </span>
              <span className="font-medium text-gray-700 truncate">
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
