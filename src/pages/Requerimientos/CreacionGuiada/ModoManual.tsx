/**
 * ModoManual · F4+ · Creación guiada · modo Manual (mockup acto 4).
 *
 * El ÚNICO modo que busca a mano (intuición · producto existente). Reusa el buscador
 * inteligente + el form de captura del RequerimientoFormModal original (ProductoSearch +
 * campos cantidad/precio/precio-venta/proveedor + lista de agregados + driver de demanda).
 * Crea un req subtipo=manual.
 *
 * Toda la lógica (snapshot, investigación de mercado, agregar/remover) sigue viviendo en
 * Requerimientos.tsx · este componente solo presenta. Es el cuerpo legacy ENVUELTO, no
 * reescrito (canon de cobertura · no se rompe lo que funciona).
 */
import React from 'react';
import {
  Package,
  PlusCircle,
  Plus,
  XCircle,
  RefreshCw,
  TrendingUp,
  Check,
  AlertCircle,
  Info,
  Zap,
} from 'lucide-react';
import { Button } from '../../../components/common';
import { ProductoSearchRequerimientos, type ProductoRequerimientoSnapshot } from '../../../components/modules/entidades/ProductoSearchRequerimientos';
import { DriverSelector } from '../components/DriverSelector';
import type { RequerimientoFormData } from '../../../types/requerimiento.types';
import type { Producto } from '../../../types/producto.types';
import { getDescripcionProducto } from '../../../utils/producto.helpers';
import type { InvestigacionProducto } from '../requerimientos.types';

interface ProductoTemp {
  productoId: string;
  cantidadSolicitada: number;
  precioEstimadoUSD: number;
  precioVentaPEN: number;
  proveedorSugerido: string;
  urlReferencia: string;
}

interface Props {
  formData: Partial<RequerimientoFormData>;
  onFormDataChange: (data: Partial<RequerimientoFormData>) => void;
  productoSnapshot: ProductoRequerimientoSnapshot | null;
  onProductoSnapshotChange: (snapshot: ProductoRequerimientoSnapshot | null) => void;
  productoTemp: ProductoTemp;
  onProductoTempChange: (temp: ProductoTemp) => void;
  productos: Producto[];
  investigacionMercado: Map<string, InvestigacionProducto>;
  loadingInvestigacion: boolean;
  showHistorial: string | null;
  onShowHistorialChange: (id: string | null) => void;
  tcDelDia: { venta: number; compra: number } | null;
  onAgregarProducto: () => void;
  onRemoverProducto: (index: number) => void;
  onAbrirCrearProducto: () => void;
}

export const ModoManual: React.FC<Props> = ({
  formData,
  onFormDataChange,
  productoSnapshot,
  onProductoSnapshotChange,
  productoTemp,
  onProductoTempChange,
  productos,
  investigacionMercado,
  loadingInvestigacion,
  showHistorial,
  onShowHistorialChange,
  tcDelDia,
  onAgregarProducto,
  onRemoverProducto,
  onAbrirCrearProducto,
}) => {
  const infoProductoSeleccionado = productoTemp.productoId ? investigacionMercado.get(productoTemp.productoId) : null;

  return (
    <div className="space-y-4">
      {/* Hint · intuición */}
      <div className="bg-slate-50 ring-1 ring-slate-200 rounded-xl p-3 text-[12px] text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        Para tu <b>intuición</b>: un producto que ya tenés y querés reponer aunque el motor no lo marque.
      </div>

      {/* Buscador de productos inteligente */}
      <div className="bg-slate-50 rounded-xl p-5 border">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-slate-900 flex items-center">
            <Package className="h-5 w-5 mr-2 text-blue-600" />
            Buscar producto existente
          </h4>
          <div className="flex items-center gap-2">
            {formData.productos && formData.productos.length > 0 && (
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                {formData.productos.length} agregado(s)
              </span>
            )}
            <button
              type="button"
              onClick={onAbrirCrearProducto}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Crear Producto
            </button>
          </div>
        </div>

        <div className="mb-4">
          <ProductoSearchRequerimientos
            productos={productos}
            value={productoSnapshot}
            onChange={onProductoSnapshotChange}
            placeholder="SKU, marca o nombre…"
          />
        </div>

        {/* Producto seleccionado · vista expandida */}
        {productoTemp.productoId && (
          <div className="bg-white rounded-xl border-2 border-blue-200 overflow-hidden">
            {(() => {
              const selectedProd = productos.find((p) => p.id === productoTemp.productoId);
              return selectedProd ? (
                <div className="p-4 bg-blue-50 border-b border-blue-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{selectedProd.sku}</span>
                      <h5 className="font-semibold text-slate-900 mt-1">
                        {selectedProd.marca} {selectedProd.nombreComercial}
                      </h5>
                      <p className="text-sm text-slate-500">{getDescripcionProducto(selectedProd)}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Stock actual</div>
                      <div className={`text-lg font-bold ${(selectedProd.stockDisponible || 0) <= (selectedProd.stockMinimo || 5) ? 'text-red-600' : 'text-emerald-600'}`}>
                        {selectedProd.stockDisponible || 0}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Investigación de mercado */}
            {loadingInvestigacion ? (
              <div className="p-4 flex items-center justify-center text-blue-600">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                Analizando historial de precios...
              </div>
            ) : infoProductoSeleccionado && infoProductoSeleccionado.historial.length > 0 ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1 text-emerald-500" />
                    Análisis de Mercado
                  </span>
                  <button
                    type="button"
                    onClick={() => onShowHistorialChange(showHistorial ? null : productoTemp.productoId)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {showHistorial ? 'Ocultar detalle' : 'Ver historial'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  <div className="bg-slate-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-500">Último</div>
                    <div className="font-bold text-slate-900">${infoProductoSeleccionado.ultimoPrecioUSD.toFixed(2)}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-emerald-600">Mínimo</div>
                    <div className="font-bold text-emerald-700">${infoProductoSeleccionado.precioMinimoUSD.toFixed(2)}</div>
                  </div>
                  <div className="bg-sky-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-sky-600">Promedio</div>
                    <div className="font-bold text-sky-700">${infoProductoSeleccionado.precioPromedioUSD.toFixed(2)}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-red-600">Máximo</div>
                    <div className="font-bold text-red-700">${infoProductoSeleccionado.precioMaximoUSD.toFixed(2)}</div>
                  </div>
                </div>

                {infoProductoSeleccionado.proveedorRecomendado && (
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Check className="h-5 w-5 text-emerald-500 mr-2" />
                        <div>
                          <div className="text-xs text-emerald-600">Proveedor recomendado</div>
                          <div className="font-semibold text-emerald-800">{infoProductoSeleccionado.proveedorRecomendado.nombre}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-700">${infoProductoSeleccionado.proveedorRecomendado.ultimoPrecioUSD.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {showHistorial === productoTemp.productoId && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs font-medium text-slate-500 mb-2">Historial de compras</div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {infoProductoSeleccionado.historial.map((h, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                          <span className="text-slate-700">{h.proveedorNombre}</span>
                          <span className="font-medium text-slate-900">${h.costoUnitarioUSD.toFixed(2)}</span>
                          <span className="text-slate-500 text-xs">{h.fechaCompra.toLocaleDateString('es-PE')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : productoTemp.productoId && !loadingInvestigacion ? (
              <div className="p-4 bg-amber-50 border-t border-amber-100">
                <div className="flex items-center text-amber-700">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span className="text-sm">Producto nuevo - Sin historial de compras</span>
                </div>
              </div>
            ) : null}

            {/* Campos de entrada */}
            <div className="p-4 border-t bg-slate-50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={productoTemp.cantidadSolicitada}
                    onChange={(e) => onProductoTempChange({ ...productoTemp, cantidadSolicitada: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-0 text-center font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Precio USD
                    {infoProductoSeleccionado?.proveedorRecomendado && <span className="text-emerald-600 ml-1">(sugerido)</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={productoTemp.precioEstimadoUSD || ''}
                      onChange={(e) => onProductoTempChange({ ...productoTemp, precioEstimadoUSD: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-0"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Precio venta
                    <span className="text-slate-400 font-normal ml-1">(opcional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">S/</span>
                    <input
                      type="number"
                      step="0.01"
                      value={productoTemp.precioVentaPEN || ''}
                      onChange={(e) => onProductoTempChange({ ...productoTemp, precioVentaPEN: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-0"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Proveedor</label>
                  <input
                    type="text"
                    value={productoTemp.proveedorSugerido}
                    onChange={(e) => onProductoTempChange({ ...productoTemp, proveedorSugerido: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-0"
                    placeholder="Amazon, iHerb..."
                  />
                </div>
              </div>

              {/* Hint de margen en vivo */}
              {(() => {
                if (!productoTemp.precioVentaPEN || !productoTemp.precioEstimadoUSD || !tcDelDia) return null;
                const costoLandedPEN = productoTemp.precioEstimadoUSD * tcDelDia.venta;
                const utilidadPEN = productoTemp.precioVentaPEN - costoLandedPEN;
                const margenPct = productoTemp.precioVentaPEN > 0 ? (utilidadPEN / productoTemp.precioVentaPEN) * 100 : 0;
                const negativo = utilidadPEN < 0;
                return (
                  <div className={`mt-3 text-xs flex items-center gap-1.5 ${negativo ? 'text-rose-600' : 'text-emerald-700'}`}>
                    <TrendingUp className="h-3.5 w-3.5" />
                    Margen estimado: <span className="font-semibold tabular-nums">S/ {utilidadPEN.toFixed(2)}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold tabular-nums">{margenPct.toFixed(0)}%</span>
                    <span className="text-slate-400 font-normal">(vs. costo S/ {costoLandedPEN.toFixed(2)} c/u · sin flete/impuesto)</span>
                  </div>
                );
              })()}

              {/* URL opcional */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">URL de referencia (opcional)</label>
                <input
                  type="text"
                  value={productoTemp.urlReferencia}
                  onChange={(e) => onProductoTempChange({ ...productoTemp, urlReferencia: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-0 text-sm"
                  placeholder="https://www.amazon.com/..."
                />
              </div>

              <div className="mt-3 flex justify-end">
                <Button variant="primary" onClick={onAgregarProducto} disabled={!productoTemp.productoId}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar producto
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Driver de demanda (capa de medición #4) */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
          <Zap className="h-3 w-3" />
          Driver de demanda
          <span className="ml-1 text-[9px] text-slate-400 normal-case font-normal">(¿qué lo generó? · opcional)</span>
        </label>
        <DriverSelector value={formData.driverDemanda} onChange={(d) => onFormDataChange({ ...formData, driverDemanda: d })} />
      </div>

      {/* Tesis opcional */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Tesis / justificación
          <span className="text-slate-400 font-normal ml-1">(opcional)</span>
        </label>
        <textarea
          value={formData.justificacion || ''}
          onChange={(e) => onFormDataChange({ ...formData, justificacion: e.target.value })}
          rows={2}
          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-0 resize-none"
          placeholder="Tu lectura del mercado: por qué reponés esto aunque el motor no lo marque…"
        />
      </div>

      {/* Lista de productos agregados */}
      {formData.productos && formData.productos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-900">Productos en este requerimiento</h4>
            <div className="text-sm text-slate-500">
              Total estimado:{' '}
              <span className="font-bold text-slate-900">
                ${formData.productos.reduce((sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada, 0).toFixed(2)}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {formData.productos.map((prod, index) => {
              const producto = productos.find((p) => p.id === prod.productoId);
              const subtotal = (prod.precioEstimadoUSD || 0) * prod.cantidadSolicitada;
              const detailStr = producto ? getDescripcionProducto(producto) : '';
              return (
                <div key={index} className="flex items-center justify-between bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 text-blue-700 w-10 h-10 rounded-lg flex items-center justify-center font-bold">
                      {prod.cantidadSolicitada}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        {producto?.marca} {producto?.nombreComercial}
                      </div>
                      {detailStr && <div className="text-xs text-slate-400">{detailStr}</div>}
                      <div className="text-sm text-slate-500">
                        {producto?.sku}
                        {prod.proveedorSugerido && ` • ${prod.proveedorSugerido}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">${subtotal.toFixed(2)}</div>
                      {prod.precioEstimadoUSD && <div className="text-xs text-slate-500">${prod.precioEstimadoUSD} c/u</div>}
                      {prod.precioVentaPEN ? <div className="text-xs text-emerald-600">Venta S/ {prod.precioVentaPEN} c/u</div> : null}
                    </div>
                    <button
                      onClick={() => onRemoverProducto(index)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModoManual;
