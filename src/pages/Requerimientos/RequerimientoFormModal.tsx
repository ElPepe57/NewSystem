import React from 'react';
import {
  ClipboardList,
  Package,
  Plus,
  PlusCircle,
  Check,
  XCircle,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Building2,
  Target,
  Users,
  Lightbulb
} from 'lucide-react';
import { Button, Modal } from '../../components/common';
import { ProductoSearchRequerimientos, type ProductoRequerimientoSnapshot } from '../../components/modules/entidades/ProductoSearchRequerimientos';
import { ClienteAutocomplete } from '../../components/modules/entidades/ClienteAutocomplete';
import type { ClienteSnapshot } from '../../types/entidadesMaestras.types';
import type { RequerimientoFormData, TipoSolicitante } from '../../types/expectativa.types';
import type { Producto } from '../../types/producto.types';
import type { InvestigacionProducto } from './requerimientos.types';

interface RequerimientoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: Partial<RequerimientoFormData>;
  onFormDataChange: (data: Partial<RequerimientoFormData>) => void;
  productoSnapshot: ProductoRequerimientoSnapshot | null;
  onProductoSnapshotChange: (snapshot: ProductoRequerimientoSnapshot | null) => void;
  productoTemp: {
    productoId: string;
    cantidadSolicitada: number;
    precioEstimadoUSD: number;
    proveedorSugerido: string;
    urlReferencia: string;
  };
  onProductoTempChange: (temp: RequerimientoFormModalProps['productoTemp']) => void;
  productos: Producto[];
  investigacionMercado: Map<string, InvestigacionProducto>;
  loadingInvestigacion: boolean;
  showHistorial: string | null;
  onShowHistorialChange: (id: string | null) => void;
  tcDelDia: { venta: number; compra: number } | null;
  isSubmitting: boolean;
  onAgregarProducto: () => void;
  onRemoverProducto: (index: number) => void;
  onCrearRequerimiento: () => void;
  onAbrirCrearProducto: () => void;
}

export const RequerimientoFormModal: React.FC<RequerimientoFormModalProps> = ({
  isOpen,
  onClose,
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
  isSubmitting,
  onAgregarProducto,
  onRemoverProducto,
  onCrearRequerimiento,
  onAbrirCrearProducto
}) => {
  const infoProductoSeleccionado = productoTemp.productoId
    ? investigacionMercado.get(productoTemp.productoId)
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
    >
      <div className="space-y-6">
        {/* Header con contexto */}
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <ClipboardList className="h-6 w-6 mr-2 text-primary-600" />
              Nuevo Requerimiento de Compra
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {tcDelDia && `TC del dia: S/ ${tcDelDia.venta.toFixed(3)}`}
            </p>
          </div>
          {/* Prioridad visual */}
          <div className="flex space-x-2">
            {(['baja', 'media', 'alta'] as const).map((p) => (
              <button
                key={p}
                onClick={() => onFormDataChange({ ...formData, prioridad: p })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  formData.prioridad === p
                    ? p === 'alta' ? 'bg-red-500 text-white shadow-md'
                    : p === 'media' ? 'bg-yellow-500 text-white shadow-md'
                    : 'bg-gray-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p === 'alta' && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Solicitante - Cards visuales */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Quien solicita este requerimiento?</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            {[
              { id: 'administracion', label: 'Administracion', sublabel: 'Mantener stock', icon: <Building2 className="h-5 w-5" />, color: 'gray' },
              { id: 'ventas', label: 'Ventas', sublabel: 'Equipo comercial', icon: <Target className="h-5 w-5" />, color: 'green' },
              { id: 'cliente', label: 'Cliente', sublabel: 'Pedido especifico', icon: <Users className="h-5 w-5" />, color: 'blue' },
              { id: 'investigacion', label: 'Investigacion', sublabel: 'Producto nuevo', icon: <Lightbulb className="h-5 w-5" />, color: 'yellow' }
            ].map((tipo) => (
              <button
                key={tipo.id}
                onClick={() => onFormDataChange({
                  ...formData,
                  tipoSolicitante: tipo.id as TipoSolicitante,
                  nombreClienteSolicitante: tipo.id !== 'cliente' ? undefined : formData.nombreClienteSolicitante,
                  clienteId: tipo.id !== 'cliente' ? undefined : formData.clienteId,
                  clienteNombre: tipo.id !== 'cliente' ? undefined : formData.clienteNombre
                })}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  formData.tipoSolicitante === tipo.id
                    ? `border-${tipo.color}-500 bg-${tipo.color}-50 shadow-md`
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`${formData.tipoSolicitante === tipo.id ? `text-${tipo.color}-600` : 'text-gray-400'}`}>
                  {tipo.icon}
                </div>
                <div className="mt-2 font-medium text-gray-900">{tipo.label}</div>
                <div className="text-xs text-gray-500">{tipo.sublabel}</div>
              </button>
            ))}
          </div>
          {/* Campo de cliente inteligente con autocompletado */}
          {formData.tipoSolicitante === 'cliente' && (
            <div className="mt-3">
              <ClienteAutocomplete
                value={formData.clienteId ? {
                  clienteId: formData.clienteId,
                  nombre: formData.clienteNombre || formData.nombreClienteSolicitante || '',
                } as ClienteSnapshot : null}
                onChange={(cliente) => {
                  if (cliente) {
                    onFormDataChange({
                      ...formData,
                      clienteId: cliente.clienteId,
                      clienteNombre: cliente.nombre,
                      nombreClienteSolicitante: cliente.nombre
                    });
                  } else {
                    onFormDataChange({
                      ...formData,
                      clienteId: undefined,
                      clienteNombre: undefined,
                      nombreClienteSolicitante: undefined
                    });
                  }
                }}
                placeholder="Buscar cliente por nombre, telefono o DNI..."
                allowCreate
              />
            </div>
          )}
        </div>

        {/* Buscador de productos inteligente */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900 flex items-center">
              <Package className="h-5 w-5 mr-2 text-primary-600" />
              Agregar Productos
            </h4>
            <div className="flex items-center gap-2">
              {formData.productos && formData.productos.length > 0 && (
                <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">
                  {formData.productos.length} agregado(s)
                </span>
              )}
              <button
                type="button"
                onClick={onAbrirCrearProducto}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                Crear Producto
              </button>
            </div>
          </div>

          {/* Buscador inteligente de productos */}
          <div className="mb-4">
            <ProductoSearchRequerimientos
              productos={productos}
              value={productoSnapshot}
              onChange={onProductoSnapshotChange}
              placeholder="Buscar producto por SKU, marca o nombre..."
            />
          </div>

          {/* Producto seleccionado - Vista expandida */}
          {productoTemp.productoId && (
            <div className="bg-white rounded-xl border-2 border-primary-200 overflow-hidden">
              {/* Info del producto */}
              {(() => {
                const selectedProd = productos.find(p => p.id === productoTemp.productoId);
                return selectedProd ? (
                  <div className="p-4 bg-primary-50 border-b border-primary-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-medium text-primary-600 bg-primary-100 px-2 py-0.5 rounded">
                          {selectedProd.sku}
                        </span>
                        <h5 className="font-semibold text-gray-900 mt-1">
                          {selectedProd.marca} {selectedProd.nombreComercial}
                        </h5>
                        <p className="text-sm text-gray-500">
                          {selectedProd.presentacion} • {selectedProd.contenido}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Stock actual</div>
                        <div className={`text-lg font-bold ${(selectedProd.stockDisponible || 0) <= (selectedProd.stockMinimo || 5) ? 'text-red-600' : 'text-green-600'}`}>
                          {selectedProd.stockDisponible || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Investigacion de mercado */}
              {loadingInvestigacion ? (
                <div className="p-4 flex items-center justify-center text-primary-600">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  Analizando historial de precios...
                </div>
              ) : infoProductoSeleccionado && infoProductoSeleccionado.historial.length > 0 ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
                      Analisis de Mercado
                    </span>
                    <button
                      type="button"
                      onClick={() => onShowHistorialChange(showHistorial ? null : productoTemp.productoId)}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      {showHistorial ? 'Ocultar detalle' : 'Ver historial'}
                    </button>
                  </div>

                  {/* Metricas de precio */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Ultimo</div>
                      <div className="font-bold text-gray-900">${infoProductoSeleccionado.ultimoPrecioUSD.toFixed(2)}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-green-600">Minimo</div>
                      <div className="font-bold text-green-700">${infoProductoSeleccionado.precioMinimoUSD.toFixed(2)}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-blue-600">Promedio</div>
                      <div className="font-bold text-blue-700">${infoProductoSeleccionado.precioPromedioUSD.toFixed(2)}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-red-600">Maximo</div>
                      <div className="font-bold text-red-700">${infoProductoSeleccionado.precioMaximoUSD.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Proveedor recomendado */}
                  {infoProductoSeleccionado.proveedorRecomendado && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Check className="h-5 w-5 text-green-500 mr-2" />
                          <div>
                            <div className="text-xs text-green-600">Proveedor recomendado</div>
                            <div className="font-semibold text-green-800">
                              {infoProductoSeleccionado.proveedorRecomendado.nombre}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-700">
                            ${infoProductoSeleccionado.proveedorRecomendado.ultimoPrecioUSD.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Historial expandido */}
                  {showHistorial === productoTemp.productoId && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs font-medium text-gray-500 mb-2">Historial de compras</div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {infoProductoSeleccionado.historial.map((h, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-gray-700">{h.proveedorNombre}</span>
                            <span className="font-medium text-gray-900">${h.costoUnitarioUSD.toFixed(2)}</span>
                            <span className="text-gray-500 text-xs">{h.fechaCompra.toLocaleDateString('es-PE')}</span>
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
              <div className="p-4 border-t bg-gray-50">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={productoTemp.cantidadSolicitada}
                      onChange={(e) => onProductoTempChange({ ...productoTemp, cantidadSolicitada: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-0 text-center font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Precio USD
                      {infoProductoSeleccionado?.proveedorRecomendado && (
                        <span className="text-green-600 ml-1">(sugerido)</span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={productoTemp.precioEstimadoUSD || ''}
                        onChange={(e) => onProductoTempChange({ ...productoTemp, precioEstimadoUSD: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-0"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
                    <input
                      type="text"
                      value={productoTemp.proveedorSugerido}
                      onChange={(e) => onProductoTempChange({ ...productoTemp, proveedorSugerido: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-0"
                      placeholder="Amazon, iHerb..."
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="primary"
                      onClick={onAgregarProducto}
                      disabled={!productoTemp.productoId}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                </div>

                {/* URL opcional */}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">URL de referencia (opcional)</label>
                  <input
                    type="text"
                    value={productoTemp.urlReferencia}
                    onChange={(e) => onProductoTempChange({ ...productoTemp, urlReferencia: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-0 text-sm"
                    placeholder="https://www.amazon.com/..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lista de productos agregados */}
        {formData.productos && formData.productos.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">
                Productos en este requerimiento
              </h4>
              <div className="text-sm text-gray-500">
                Total estimado: <span className="font-bold text-gray-900">
                  ${formData.productos.reduce((sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada, 0).toFixed(2)}
                </span>
                {tcDelDia && (
                  <span className="text-gray-400 ml-2">
                    (S/ {(formData.productos.reduce((sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada, 0) * tcDelDia.venta).toFixed(2)})
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {formData.productos.map((prod, index) => {
                const producto = productos.find((p) => p.id === prod.productoId);
                const subtotal = (prod.precioEstimadoUSD || 0) * prod.cantidadSolicitada;
                const detailParts = [producto?.presentacion, producto?.contenido, producto?.dosaje, producto?.sabor].filter(Boolean);
                const detailStr = detailParts.join(' · ');
                return (
                  <div key={index} className="flex items-center justify-between bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-center space-x-4">
                      <div className="bg-primary-100 text-primary-700 w-10 h-10 rounded-lg flex items-center justify-center font-bold">
                        {prod.cantidadSolicitada}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {producto?.marca} {producto?.nombreComercial}
                        </div>
                        {detailStr && (
                          <div className="text-xs text-gray-400">{detailStr}</div>
                        )}
                        <div className="text-sm text-gray-500">
                          {producto?.sku}
                          {prod.proveedorSugerido && ` • ${prod.proveedorSugerido}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">${subtotal.toFixed(2)}</div>
                        {prod.precioEstimadoUSD && (
                          <div className="text-xs text-gray-500">${prod.precioEstimadoUSD} c/u</div>
                        )}
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

        {/* Justificacion */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Justificacion
            <span className="text-gray-400 font-normal ml-1">(opcional)</span>
          </label>
          <textarea
            value={formData.justificacion || ''}
            onChange={(e) => onFormDataChange({ ...formData, justificacion: e.target.value })}
            rows={2}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-0 resize-none"
            placeholder="Ej: Reponer stock agotado, cliente urgente, precio especial encontrado..."
          />
        </div>

        {/* Footer con acciones y resumen */}
        <div className="flex items-center justify-between pt-4 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
          <div className="text-sm text-gray-500">
            {formData.productos && formData.productos.length > 0 ? (
              <span>
                <strong className="text-gray-900">{formData.productos.length}</strong> producto(s) •
                <strong className="text-gray-900 ml-1">
                  ${formData.productos.reduce((sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada, 0).toFixed(2)} USD
                </strong>
              </span>
            ) : (
              <span className="text-amber-600">Agrega al menos un producto</span>
            )}
          </div>
          <div className="flex space-x-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={onCrearRequerimiento}
              disabled={isSubmitting || !formData.productos?.length}
              className="px-6"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Crear Requerimiento
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
