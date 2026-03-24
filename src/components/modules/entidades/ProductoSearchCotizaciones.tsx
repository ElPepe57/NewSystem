import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Check,
  X,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Clock,
  Boxes,
  MapPin,
  Plane,
  ChevronRight,
  Info,
  Truck,
  ScanLine
} from 'lucide-react';
import { BarcodeScanner } from '../../common/BarcodeScanner';
import type { ProductoDisponible } from '../../../types/venta.types';
import { useProductoDropdown } from '../../../hooks/useProductoDropdown';

/**
 * Snapshot del producto seleccionado para cotizaciones
 */
export interface ProductoCotizacionSnapshot {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  // Disponibilidad
  stockPeru: number;
  stockUSA: number;
  stockTotal: number;
  fuenteRecomendada: 'peru' | 'usa_viajero' | 'usa_almacen' | 'origen_viajero' | 'origen_almacen' | 'virtual';
  // Precios de referencia
  precioPERUMin?: number;
  precioPERUPromedio?: number;
  precioPERUMax?: number;
  precioEntrada?: number;
  // Tiempos
  tiempoEntregaEstimado: number; // días
  mensajeDisponibilidad: string;
}

/**
 * Info extendida de disponibilidad multi-almacén
 */
interface DisponibilidadExtendida {
  peru: number;
  usa: number;
  enTransito: number;
  tiempoEstimadoDias: number;
  proximoViajeDias?: number;
  viajeroNombre?: string;
}

interface ProductoSearchCotizacionesProps {
  productos: ProductoDisponible[];
  value?: ProductoCotizacionSnapshot | null;
  onChange: (producto: ProductoCotizacionSnapshot | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  // Datos de disponibilidad multi-almacén
  disponibilidadData?: Map<string, DisponibilidadExtendida>;
}

export const ProductoSearchCotizaciones: React.FC<ProductoSearchCotizacionesProps> = ({
  productos,
  value,
  onChange,
  placeholder = 'Buscar producto por SKU, marca o nombre...',
  required = false,
  disabled = false,
  className = '',
  disponibilidadData
}) => {
  const [showScanner, setShowScanner] = useState(false);

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
  } = useProductoDropdown<ProductoDisponible>({
    items: Array.isArray(productos) ? productos : [],
    getSearchableText: (p) => `${p.sku ?? ''} ${p.marca ?? ''} ${p.nombreComercial ?? ''} ${p.presentacion ?? ''} ${p.contenido ?? ''} ${p.dosaje ?? ''} ${p.sabor ?? ''}`,
    getLabel: (p) => `${p.sku} - ${p.marca} ${p.nombreComercial}`,
    extraFilter: (p) => !(p as any).esPadre,
    maxResults: 15,
    minChars: 1,
    minDropdownWidth: 500,
    useFixed: true,
  });

  useEffect(() => {
    onSelectCallback.current = (producto: ProductoDisponible) => {
      handleSelectProducto(producto);
    };
  }, []);

  useEffect(() => {
    if (value?.sku && !inputValue) {
      setInputValue(`${value.sku} - ${value.marca} ${value.nombreComercial}`);
    }
  }, [value]);

  // Obtener disponibilidad extendida
  const getDisponibilidad = useCallback((productoId: string, productoBase: ProductoDisponible): DisponibilidadExtendida => {
    const data = disponibilidadData?.get(productoId);
    if (data) return data;

    // Usar datos del producto (incluye Peru y USA)
    return {
      peru: productoBase.unidadesDisponibles,
      usa: productoBase.unidadesUSA ?? 0,
      enTransito: productoBase.unidadesEnTransito ?? 0,
      tiempoEstimadoDias: productoBase.unidadesDisponibles > 0 ? 1
        : (productoBase.unidadesUSA ?? 0) > 0 ? 25
        : 15
    };
  }, [disponibilidadData]);

  // Determinar fuente recomendada y mensaje
  const getFuenteYMensaje = (disp: DisponibilidadExtendida): { fuente: 'peru' | 'usa_viajero' | 'usa_almacen' | 'origen_viajero' | 'origen_almacen' | 'virtual'; mensaje: string; dias: number } => {
    if (disp.peru > 0) {
      return {
        fuente: 'peru',
        mensaje: 'Disponible inmediato',
        dias: 1
      };
    }
    if (disp.usa > 0) {
      if (disp.proximoViajeDias !== undefined && disp.proximoViajeDias <= 15) {
        return {
          fuente: 'origen_viajero',
          mensaje: disp.viajeroNombre
            ? `${disp.viajeroNombre} viaja en ${disp.proximoViajeDias}d`
            : `Viajero en ${disp.proximoViajeDias} días`,
          dias: disp.proximoViajeDias + 3
        };
      }
      return {
        fuente: 'origen_almacen',
        mensaje: 'Stock en origen (sin viaje programado)',
        dias: 20
      };
    }
    if (disp.enTransito > 0) {
      return {
        fuente: 'origen_almacen',
        mensaje: 'En tránsito a Perú',
        dias: disp.tiempoEstimadoDias
      };
    }
    return {
      fuente: 'virtual',
      mensaje: 'Requiere compra',
      dias: 25
    };
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    hookInputChange(e.target.value);
    if (value) onChange(null);
  }, [value, onChange, hookInputChange]);

  // Seleccionar producto
  const handleSelectProducto = (producto: ProductoDisponible) => {
    const disp = getDisponibilidad(producto.productoId, producto);
    const { fuente, mensaje, dias } = getFuenteYMensaje(disp);
    const inv = producto.investigacion;

    const snapshot: ProductoCotizacionSnapshot = {
      productoId: producto.productoId,
      sku: producto.sku,
      marca: producto.marca,
      nombreComercial: producto.nombreComercial,
      presentacion: producto.presentacion,
      stockPeru: disp.peru,
      stockUSA: disp.usa,
      stockTotal: disp.peru + disp.usa + disp.enTransito,
      fuenteRecomendada: fuente,
      precioPERUMin: inv?.precioPERUMin,
      precioPERUPromedio: inv?.precioPERUPromedio,
      precioPERUMax: inv?.precioPERUMax,
      precioEntrada: inv?.precioEntrada,
      tiempoEntregaEstimado: dias,
      mensajeDisponibilidad: mensaje
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

  // Handler de escaneo de codigo de barras
  const handleBarcodeScan = useCallback((barcode: string) => {
    setShowScanner(false);
    const productosArr = Array.isArray(productos) ? productos : [];
    // Buscar por codigoUPC o SKU
    const found = productosArr.find(
      p => (p as any).codigoUPC === barcode || p.sku === barcode
    );
    if (found) {
      handleSelectProducto(found);
    } else {
      // Poner el barcode en el input como fallback de búsqueda
      setInputValue(barcode);
      setIsOpen(true);
    }
  }, [productos]);

  // Colores según disponibilidad
  const getDisponibilidadStyle = (fuente: string) => {
    switch (fuente) {
      case 'peru':
        return { bg: 'bg-green-100', text: 'text-green-700', icon: MapPin };
      case 'usa_viajero':
      case 'origen_viajero':
        return { bg: 'bg-blue-100', text: 'text-blue-700', icon: Plane };
      case 'usa_almacen':
      case 'origen_almacen':
        return { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: Plane };
      case 'virtual':
      default:
        return { bg: 'bg-amber-100', text: 'text-amber-700', icon: Truck };
    }
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

        {/* Boton escanear - touch friendly */}
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

      {/* Scanner popover - fullwidth on mobile */}
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
                      <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Entrega
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista */}
              {filteredProductos.map((producto, index) => {
                const disp = getDisponibilidad(producto.productoId, producto);
                const { fuente, mensaje, dias } = getFuenteYMensaje(disp);
                const dispStyle = getDisponibilidadStyle(fuente);
                const inv = producto.investigacion;
                const sinStock = disp.peru + disp.usa + disp.enTransito === 0;

                return (
                  <button
                    key={producto.productoId}
                    type="button"
                    onClick={() => handleSelectProducto(producto)}
                    className={`
                      w-full px-2.5 sm:px-4 py-2 sm:py-3 text-left border-b border-gray-100 last:border-0 transition-colors
                      ${highlightedIndex === index ? 'bg-primary-50' : 'hover:bg-gray-50'}
                      ${sinStock ? 'opacity-70' : ''}
                    `}
                  >
                    {/* Top: SKU + badge + chevron */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap min-w-0">
                        <span className="font-mono text-xs sm:text-sm text-primary-600 font-medium flex-shrink-0">
                          {producto.sku}
                        </span>
                        {inv && (
                          <span className="px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded bg-blue-100 text-blue-700 flex items-center flex-shrink-0">
                            <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
                            <span className="hidden sm:inline">Precios ref.</span>
                            <span className="sm:hidden">Ref.</span>
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-300 flex-shrink-0" />
                    </div>

                    {/* Product name + presentation */}
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
                      {/* Stock Perú */}
                      <div className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-50 rounded text-[10px] sm:text-xs">
                        <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600" />
                        <span className="font-bold text-green-700">{disp.peru}</span>
                      </div>

                      {/* Stock USA */}
                      <div className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-50 rounded text-[10px] sm:text-xs">
                        <Plane className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-600" />
                        <span className="font-bold text-blue-700">{disp.usa}</span>
                      </div>

                      {/* Tiempo entrega */}
                      <div className={`flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs ${dispStyle.bg}`}>
                        <Clock className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${dispStyle.text}`} />
                        <span className={`font-bold ${dispStyle.text}`}>{dias}d</span>
                      </div>

                      {/* Precio referencia */}
                      {inv && (
                        <div className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 rounded text-[10px] sm:text-xs">
                          <span className="text-gray-500">Ref:</span>
                          <span className="font-semibold text-gray-700">S/{inv.precioPERUPromedio.toFixed(0)}</span>
                        </div>
                      )}

                    </div>

                    {/* Mensaje de disponibilidad */}
                    <div className="mt-1 sm:mt-1.5">
                      <span className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs ${dispStyle.bg} ${dispStyle.text}`}>
                        {React.createElement(dispStyle.icon, { className: 'h-2.5 w-2.5 sm:h-3 sm:w-3' })}
                        {mensaje}
                      </span>
                    </div>
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
        <div className="mt-2 p-2 sm:p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-indigo-800 truncate">
                Info para cotizar
              </span>
            </div>
            <span className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs flex-shrink-0 ${
              getDisponibilidadStyle(value.fuenteRecomendada).bg
            } ${getDisponibilidadStyle(value.fuenteRecomendada).text}`}>
              {React.createElement(getDisponibilidadStyle(value.fuenteRecomendada).icon, { className: 'h-2.5 w-2.5 sm:h-3 sm:w-3' })}
              <span className="hidden sm:inline">{value.mensajeDisponibilidad}</span>
              <span className="sm:hidden">{value.fuenteRecomendada === 'peru' ? 'Inmediato' : value.fuenteRecomendada === 'virtual' ? 'Comprar' : 'Origen'}</span>
            </span>
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

            {/* Tiempo entrega */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600 flex items-center justify-center gap-0.5 sm:gap-1">
                <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Entrega
              </p>
              <p className="font-bold text-sm sm:text-lg text-indigo-600">{value.tiempoEntregaEstimado}d</p>
            </div>

            {/* Precio referencia promedio */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600">Prom.</p>
              <p className="font-bold text-sm sm:text-lg text-gray-700">
                {value.precioPERUPromedio ? `S/${value.precioPERUPromedio.toFixed(0)}` : '-'}
              </p>
            </div>

            {/* Precio entrada */}
            <div className="bg-white/60 rounded p-1.5 sm:p-2 text-center">
              <p className="text-[10px] sm:text-xs text-gray-600">Entrada</p>
              <p className="font-bold text-sm sm:text-lg text-amber-600">
                {value.precioEntrada ? `S/${value.precioEntrada.toFixed(0)}` : '-'}
              </p>
            </div>
          </div>

          {/* Rango de precios si hay investigación */}
          {value.precioPERUMin && value.precioPERUMax && (
            <div className="mt-2 pt-2 border-t border-indigo-200">
              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                <span className="text-gray-600">Rango mercado:</span>
                <span className="font-medium text-gray-700">
                  S/{value.precioPERUMin.toFixed(0)} - S/{value.precioPERUMax.toFixed(0)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
