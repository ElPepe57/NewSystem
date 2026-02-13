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
  ExternalLink,
  History,
  Calendar,
  TrendingDown,
  ChevronRight
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

/**
 * Datos históricos de compra de un producto
 */
export interface HistorialCompraProducto {
  ultimaCompraFecha?: Date;
  ultimaCompraProveedor?: string;
  ultimoPrecioUSD?: number;
  precioPromedioUSD?: number;
  totalCompras?: number;
  tendenciaPrecio?: 'subiendo' | 'bajando' | 'estable';
  variacionPorcentaje?: number;
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
  // Datos históricos de compras por producto
  historialCompras?: Map<string, HistorialCompraProducto>;
  showHistorialCompra?: boolean;
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
  className = '',
  historialCompras,
  showHistorialCompra = true
}) => {
  const [filteredProductos, setFilteredProductos] = useState<Producto[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 300 });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sincronizar valor inicial
  useEffect(() => {
    if (value?.sku && !inputValue) {
      setInputValue(`${value.sku} - ${value.marca} ${value.nombreComercial}`);
      // Buscar producto completo para tener la investigación
      const prod = productos.find(p => p.id === value.productoId);
      if (prod) setSelectedProducto(prod);
    }
  }, [value, productos]);

  // Click fuera para cerrar (incluyendo el dropdown fijo)
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

  // Actualizar posición del dropdown cuando se abre
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setDropdownPosition({
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width
          });
        }
      };

      updatePosition();

      // Actualizar en scroll del modal
      const handleScroll = () => updatePosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);

      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [isOpen]);

  // Filtrar productos al escribir (con validación segura)
  useEffect(() => {
    if (inputValue.length >= 1) {
      const searchLower = inputValue.toLowerCase();
      const productosArr = Array.isArray(productos) ? productos : [];
      const filtered = productosArr.filter(p => {
        const sku = (p.sku ?? '').toLowerCase();
        const marca = (p.marca ?? '').toLowerCase();
        const nombreComercial = (p.nombreComercial ?? '').toLowerCase();
        // Buscar en todos los campos relevantes
        return sku.includes(searchLower) ||
               marca.includes(searchLower) ||
               nombreComercial.includes(searchLower) ||
               `${marca} ${nombreComercial}`.toLowerCase().includes(searchLower);
      });

      // Debug: ver cuántos productos hay
      console.log(`[ProductoAutocomplete] Búsqueda: "${inputValue}", Total productos: ${productosArr.length}, Filtrados: ${filtered.length}`);

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

    // Siempre abrir el dropdown cuando escribe (si tiene al menos 1 caracter)
    if (valor.length >= 1) {
      setIsOpen(true);
    }

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

  // Obtener historial de compra de un producto
  const getHistorialProducto = useCallback((productoId: string): HistorialCompraProducto | null => {
    return historialCompras?.get(productoId) ?? null;
  }, [historialCompras]);

  // Info de historial del producto seleccionado
  const historialInfo = useMemo(() => {
    if (!selectedProducto || !showHistorialCompra) return null;
    return getHistorialProducto(selectedProducto.id);
  }, [selectedProducto, showHistorialCompra, getHistorialProducto]);

  // Calcular días desde última compra
  const getDiasDesdeCompra = (fecha?: Date) => {
    if (!fecha) return null;
    const ahora = new Date();
    const diff = ahora.getTime() - fecha.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // Obtener estilo de tendencia
  const getTendenciaStyle = (tendencia?: 'subiendo' | 'bajando' | 'estable') => {
    switch (tendencia) {
      case 'subiendo':
        return { color: 'text-red-600', bg: 'bg-red-50', icon: TrendingUp };
      case 'bajando':
        return { color: 'text-green-600', bg: 'bg-green-50', icon: TrendingDown };
      default:
        return { color: 'text-gray-600', bg: 'bg-gray-50', icon: TrendingUp };
    }
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
          onFocus={() => {
            // Al hacer focus, si ya hay texto, mostrar el dropdown
            if (inputValue.length >= 1) {
              setIsOpen(true);
            }
          }}
          onClick={() => {
            // Al hacer click, si no está abierto y hay texto, abrir
            if (!isOpen && inputValue.length >= 1) {
              setIsOpen(true);
            }
          }}
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

      {/* Dropdown de resultados - posición fija para evitar recorte por overflow del modal */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 max-h-64 overflow-y-auto"
          style={{
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            width: dropdownPosition.width,
            top: dropdownPosition.top,
            left: dropdownPosition.left
          }}
        >
          {filteredProductos.length > 0 ? (
            <>
              {/* Header con cantidad de resultados */}
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 sticky top-0">
                {filteredProductos.length} producto{filteredProductos.length !== 1 ? 's' : ''} encontrado{filteredProductos.length !== 1 ? 's' : ''}
              </div>
              {filteredProductos.map((producto) => {
                const tieneInvestigacion = producto.investigacion?.estaVigente;
                const mejorPrecio = tieneInvestigacion ? getMejorProveedor(producto) : null;
                const historial = getHistorialProducto(producto.id);
                const diasDesdeCompra = historial ? getDiasDesdeCompra(historial.ultimaCompraFecha) : null;
                const tendenciaStyle = historial?.tendenciaPrecio ? getTendenciaStyle(historial.tendenciaPrecio) : null;

                return (
                  <button
                    key={producto.id}
                    type="button"
                    onClick={() => handleSelectProducto(producto)}
                    className="w-full px-4 py-3 text-left hover:bg-primary-50 border-b border-gray-100 last:border-0 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-mono text-sm text-primary-600">{producto.sku}</span>
                          {tieneInvestigacion && (
                            <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-700 flex items-center">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Investigado
                            </span>
                          )}
                          {historial && historial.totalCompras && historial.totalCompras > 0 && (
                            <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 text-purple-700 flex items-center">
                              <History className="h-3 w-3 mr-1" />
                              {historial.totalCompras} compras
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-gray-900 mt-0.5 truncate">
                          {producto.marca} - {producto.nombreComercial}
                        </div>
                        <div className="text-xs text-gray-500">
                          {producto.presentacion} {producto.dosaje} {producto.contenido}
                        </div>
                      </div>

                      {/* Métricas: Precio sugerido + historial */}
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {/* Precio histórico */}
                        {historial?.ultimoPrecioUSD && (
                          <div className="text-center min-w-[55px] px-2 py-1 bg-gray-100 rounded">
                            <div className="text-xs text-gray-500">Últ. precio</div>
                            <div className="font-semibold text-gray-700 text-sm">
                              ${historial.ultimoPrecioUSD.toFixed(2)}
                            </div>
                            {tendenciaStyle && historial.variacionPorcentaje && (
                              <div className={`text-xs ${tendenciaStyle.color} flex items-center justify-center`}>
                                {React.createElement(tendenciaStyle.icon, { className: 'h-2.5 w-2.5 mr-0.5' })}
                                {Math.abs(historial.variacionPorcentaje).toFixed(0)}%
                              </div>
                            )}
                          </div>
                        )}

                        {/* Días desde última compra */}
                        {diasDesdeCompra !== null && (
                          <div className={`text-center min-w-[45px] px-2 py-1 rounded ${
                            diasDesdeCompra > 90 ? 'bg-amber-50' : 'bg-blue-50'
                          }`}>
                            <div className="text-xs text-gray-500">Hace</div>
                            <div className={`font-semibold text-sm ${
                              diasDesdeCompra > 90 ? 'text-amber-600' : 'text-blue-600'
                            }`}>
                              {diasDesdeCompra}d
                            </div>
                          </div>
                        )}

                        {/* Precio sugerido si hay investigación */}
                        {mejorPrecio && (
                          <div className="text-center min-w-[60px] px-2 py-1 bg-green-50 rounded">
                            <div className="text-xs text-gray-500">Sug.</div>
                            <div className="flex items-center justify-center text-green-600">
                              <DollarSign className="h-3 w-3" />
                              <span className="font-bold text-sm">{mejorPrecio.precioConImpuesto.toFixed(2)}</span>
                            </div>
                            {mejorPrecio.impuesto && mejorPrecio.impuesto > 0 && (
                              <div className="text-xs text-amber-600">
                                +{mejorPrecio.impuesto}%
                              </div>
                            )}
                          </div>
                        )}

                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </div>

                    {/* Info de última compra */}
                    {historial?.ultimaCompraProveedor && (
                      <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center text-xs text-gray-500">
                        <History className="h-3 w-3 mr-1" />
                        <span>Último: {historial.ultimaCompraProveedor}</span>
                        {historial.ultimaCompraFecha && (
                          <span className="text-gray-400 ml-1">
                            ({historial.ultimaCompraFecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })})
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </>
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

      {/* Panel de historial de compras */}
      {showHistorialCompra && historialInfo && (historialInfo.ultimoPrecioUSD || historialInfo.ultimaCompraFecha) && (
        <div className="mt-2 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">
              Historial de Compras
            </span>
            {historialInfo.totalCompras && (
              <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                {historialInfo.totalCompras} compras previas
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3">
            {/* Último precio */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600">Último Precio</p>
              <p className="font-bold text-gray-900">
                ${historialInfo.ultimoPrecioUSD?.toFixed(2) || '-'}
              </p>
              {historialInfo.tendenciaPrecio && historialInfo.variacionPorcentaje && (
                <p className={`text-xs flex items-center justify-center ${
                  historialInfo.tendenciaPrecio === 'subiendo' ? 'text-red-600' :
                  historialInfo.tendenciaPrecio === 'bajando' ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {historialInfo.tendenciaPrecio === 'subiendo' ? (
                    <TrendingUp className="h-3 w-3 mr-0.5" />
                  ) : historialInfo.tendenciaPrecio === 'bajando' ? (
                    <TrendingDown className="h-3 w-3 mr-0.5" />
                  ) : null}
                  {historialInfo.tendenciaPrecio === 'subiendo' ? '+' : '-'}
                  {Math.abs(historialInfo.variacionPorcentaje).toFixed(1)}%
                </p>
              )}
            </div>

            {/* Precio promedio */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600">Precio Promedio</p>
              <p className="font-bold text-gray-900">
                ${historialInfo.precioPromedioUSD?.toFixed(2) || '-'}
              </p>
            </div>

            {/* Última compra */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600">Última Compra</p>
              <p className="font-medium text-gray-900">
                {historialInfo.ultimaCompraFecha
                  ? historialInfo.ultimaCompraFecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' })
                  : '-'
                }
              </p>
              {historialInfo.ultimaCompraFecha && (
                <p className="text-xs text-gray-500">
                  hace {getDiasDesdeCompra(historialInfo.ultimaCompraFecha)} días
                </p>
              )}
            </div>

            {/* Proveedor */}
            <div className="bg-white/60 rounded p-2 text-center">
              <p className="text-xs text-gray-600">Últ. Proveedor</p>
              <p className="font-medium text-gray-900 text-sm truncate" title={historialInfo.ultimaCompraProveedor}>
                {historialInfo.ultimaCompraProveedor || '-'}
              </p>
            </div>
          </div>

          {/* Comparación con precio sugerido */}
          {investigacionInfo?.mejorProveedor && historialInfo.ultimoPrecioUSD && (
            <div className="mt-2 pt-2 border-t border-purple-200">
              {(() => {
                const precioSugerido = investigacionInfo.mejorProveedor.precioConImpuesto;
                const precioAnterior = historialInfo.ultimoPrecioUSD;
                const diferencia = precioSugerido - precioAnterior;
                const porcentaje = (diferencia / precioAnterior) * 100;

                return (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">vs. precio sugerido actual:</span>
                    <span className={`font-medium ${diferencia > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {diferencia > 0 ? '+' : ''}{porcentaje.toFixed(1)}%
                      ({diferencia > 0 ? '+' : ''}${diferencia.toFixed(2)})
                    </span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
