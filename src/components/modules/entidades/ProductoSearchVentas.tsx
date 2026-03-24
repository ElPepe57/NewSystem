import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Check,
  X,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Calendar,
  Boxes,
  Lock,
  ChevronRight,
  Info,
  ScanLine
} from 'lucide-react';
import { BarcodeScanner } from '../../common/BarcodeScanner';
import type { ProductoDisponible } from '../../../types/venta.types';
import { useProductoDropdown } from '../../../hooks/useProductoDropdown';

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
  const [showScanner, setShowScanner] = useState(false);

  // Hook compartido: click-outside, posicionamiento, filtrado, teclado
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
  } = useProductoDropdown<ProductoDisponible>({
    items: Array.isArray(productos) ? productos : [],
    getSearchableText: (p) => `${p.sku ?? ''} ${p.marca ?? ''} ${p.nombreComercial ?? ''} ${p.presentacion ?? ''} ${p.contenido ?? ''} ${p.dosaje ?? ''} ${p.sabor ?? ''}`,
    getLabel: (p) => `${p.sku} - ${p.marca} ${p.nombreComercial}`,
    extraFilter: (p) => !(p as any).esPadre,
    maxResults: 15,
    minChars: 1,
    minDropdownWidth: 450,
    useFixed: true,
  });

  // Vincular callback de selección
  useEffect(() => {
    onSelectCallback.current = (producto: ProductoDisponible) => {
      handleSelectProducto(producto);
    };
  }, []);

  // Sincronizar valor inicial
  useEffect(() => {
    if (value?.sku && !inputValue) {
      setInputValue(`${value.sku} - ${value.marca} ${value.nombreComercial}`);
    }
  }, [value]);

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

  // Handler de escaneo de codigo de barras
  const handleBarcodeScan = useCallback((barcode: string) => {
    setShowScanner(false);
    const productosArr = Array.isArray(productos) ? productos : [];
    const found = productosArr.find(
      p => (p as any).codigoUPC === barcode || p.sku === barcode
    );
    if (found) {
      handleSelectProducto(found);
    } else {
      setInputValue(barcode);
      setIsOpen(true);
    }
  }, [productos]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    hookInputChange(e.target.value);
    if (value) onChange(null);
  }, [value, onChange, hookInputChange]);

  // Seleccionar producto
  const handleSelectProducto = (producto: ProductoDisponible) => {
    const stockExt = getStockExtendido(producto.productoId, producto);
    const diasVencer = getDiasParaVencer(stockExt.proximoVencimiento);
    const margen = calcularMargen(producto.precioSugerido || 0, stockExt.ctruPromedio);

    const snapshot: ProductoVentaSnapshot = {
      productoId: producto.productoId,
      sku: producto.sku,
      marca: producto.marca,
      nombreComercial: producto.nombreComercial,
      presentacion: producto.presentacion,
      stockDisponible: stockExt.disponible,
      stockReservado: stockExt.reservado,
      stockLibre: stockExt.libre,
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
    hookClear();
    onChange(null);
    inputRef.current?.focus();
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
      <div className="relative flex gap-2">
        <div className="relative flex-1">
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

        {/* Boton escanear */}
        {!disabled && !value && (
          <button
            type="button"
            onClick={() => setShowScanner(!showScanner)}
            title="Escanear codigo de barras"
            className={`px-3 py-2 border rounded-md shadow-sm transition-colors flex-shrink-0 ${
              showScanner
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'bg-white border-gray-300 text-gray-500 hover:text-primary-600 hover:border-primary-300 active:bg-gray-50'
            }`}
          >
            <ScanLine className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Scanner inline */}
      {showScanner && !disabled && !value && (
        <div className="mt-2 p-3 sm:p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-50 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Escanear codigo de barras</span>
            <button
              type="button"
              onClick={() => setShowScanner(false)}
              className="p-1 text-gray-400 hover:text-gray-600 active:bg-gray-100 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <BarcodeScanner
            onScan={handleBarcodeScan}
            mode="both"
            compact
            placeholder="Escanear o escribir UPC..."
          />
        </div>
      )}

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
              <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs text-gray-500">
                    {filteredProductos.length} producto{filteredProductos.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-400">
                    <span className="flex items-center gap-0.5">
                      <Boxes className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Stock
                    </span>
                    <span className="flex items-center gap-0.5">
                      <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Marg.
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Vence
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista de productos */}
              {filteredProductos.map((producto, index) => {
                const stockExt = getStockExtendido(producto.productoId, producto);
                const diasVencer = getDiasParaVencer(stockExt.proximoVencimiento);
                const margen = calcularMargen(producto.precioSugerido || 0, stockExt.ctruPromedio);
                const sinStockLibre = stockExt.libre <= 0;

                return (
                  <button
                    key={producto.productoId}
                    type="button"
                    onClick={() => handleSelectProducto(producto)}
                    className={`
                      w-full px-2.5 sm:px-4 py-2 sm:py-3 text-left border-b border-gray-100 last:border-0 transition-colors
                      ${highlightedIndex === index ? 'bg-primary-50' : 'hover:bg-gray-50'}
                      ${sinStockLibre ? 'opacity-60' : ''}
                    `}
                  >
                    {/* Top: SKU + badges + chevron */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap min-w-0">
                        <span className="font-mono text-xs sm:text-sm text-primary-600 font-medium flex-shrink-0">
                          {producto.sku}
                        </span>
                        {producto.investigacion && (
                          <span className="px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded bg-blue-100 text-blue-700 flex items-center flex-shrink-0">
                            <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
                            Inv
                          </span>
                        )}
                        {sinStockLibre && (
                          <span className="px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded bg-red-100 text-red-700 flex items-center flex-shrink-0">
                            <AlertTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
                            <span className="hidden sm:inline">Sin stock</span>
                            <span className="sm:hidden">0</span>
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-300 flex-shrink-0" />
                    </div>

                    {/* Product name + presentation + details */}
                    <div className="mt-0.5 sm:mt-1">
                      <div className="font-medium text-gray-900 text-xs sm:text-sm truncate">
                        {producto.marca} - {producto.nombreComercial}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500">
                        {[producto.presentacion, producto.contenido, producto.dosaje, producto.sabor].filter(Boolean).join(' · ')}
                      </div>
                    </div>

                    {/* Metrics row: compact horizontal pills */}
                    <div className="flex items-center gap-1 sm:gap-2 mt-1 sm:mt-1.5 flex-wrap">
                      {/* Stock */}
                      <div className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-50 rounded text-[10px] sm:text-xs">
                        <Boxes className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-400" />
                        <span className={`font-bold ${
                          stockExt.libre > 5 ? 'text-green-600' :
                          stockExt.libre > 0 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {stockExt.libre}
                        </span>
                        {stockExt.reservado > 0 && (
                          <span className="text-gray-400 flex items-center">
                            <Lock className="h-2 w-2 sm:h-2.5 sm:w-2.5 mr-0.5" />
                            {stockExt.reservado}
                          </span>
                        )}
                      </div>

                      {/* CTRU */}
                      {stockExt.ctruPromedio && (
                        <div className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 rounded text-[10px] sm:text-xs">
                          <span className="text-gray-500">CTRU:</span>
                          <span className="font-semibold text-gray-700">S/{stockExt.ctruPromedio.toFixed(0)}</span>
                        </div>
                      )}

                      {/* Margen */}
                      {margen !== null && (
                        <div className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${getMargenColor(margen)}`}>
                          {margen.toFixed(0)}%
                        </div>
                      )}

                      {/* Vencimiento */}
                      {diasVencer !== null && (
                        <div className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-bold ${getVencimientoColor(diasVencer)}`}>
                          {diasVencer}d
                        </div>
                      )}

                    </div>
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
        <div className="mt-2 p-2 sm:p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-blue-800">
              Info del producto
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3 mt-2">
            {/* Stock libre */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 flex items-center justify-center gap-0.5 sm:gap-1">
                <Boxes className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Stock libre
              </p>
              <p className={`font-bold text-sm sm:text-lg ${
                value.stockLibre > 5 ? 'text-green-600' :
                value.stockLibre > 0 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {value.stockLibre}
              </p>
              {value.stockReservado > 0 && (
                <p className="text-[10px] sm:text-xs text-gray-400 flex items-center justify-center gap-0.5">
                  <Lock className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                  {value.stockReservado} reserv.
                </p>
              )}
            </div>

            {/* CTRU */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 flex items-center justify-center gap-0.5 sm:gap-1">
                <DollarSign className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> CTRU
              </p>
              <p className="font-bold text-sm sm:text-lg text-gray-700">
                {value.ctruPromedio ? `S/${value.ctruPromedio.toFixed(2)}` : '-'}
              </p>
            </div>

            {/* Margen */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 flex items-center justify-center gap-0.5 sm:gap-1">
                <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Margen
              </p>
              <p className={`font-bold text-sm sm:text-lg ${
                value.margenEstimado
                  ? value.margenEstimado >= 20 ? 'text-green-600' :
                    value.margenEstimado >= 10 ? 'text-yellow-600' : 'text-red-600'
                  : 'text-gray-400'
              }`}>
                {value.margenEstimado ? `${value.margenEstimado.toFixed(1)}%` : '-'}
              </p>
            </div>

            {/* Vencimiento */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 flex items-center justify-center gap-0.5 sm:gap-1">
                <Calendar className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Vence
              </p>
              <p className={`font-bold text-sm sm:text-lg ${
                value.diasParaVencer
                  ? value.diasParaVencer <= 30 ? 'text-red-600' :
                    value.diasParaVencer <= 90 ? 'text-amber-600' : 'text-green-600'
                  : 'text-gray-400'
              }`}>
                {value.diasParaVencer ? `${value.diasParaVencer}d` : '-'}
              </p>
              {value.proximoVencimiento && (
                <p className="text-[10px] sm:text-xs text-gray-400">
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
