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
  Users
} from 'lucide-react';
import { Button } from '../../components/common';
import { FormModalV2 } from '../../design-system';
import { ProductoSearchRequerimientos, type ProductoRequerimientoSnapshot } from '../../components/modules/entidades/ProductoSearchRequerimientos';
import { ClienteAutocomplete } from '../../components/modules/entidades/ClienteAutocomplete';
import type { ClienteSnapshot } from '../../types/entidadesMaestras.types';
import type { RequerimientoFormData, OrigenRequerimiento } from '../../types/requerimiento.types';
import type { Producto } from '../../types/producto.types';
import { getDescripcionProducto } from '../../utils/producto.helpers';
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
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={onCrearRequerimiento}
      title="Nuevo Requerimiento de Compra"
      subtitle={tcDelDia ? `TC del día: S/ ${tcDelDia.venta.toFixed(3)}` : 'Solicitud de compra · demanda · aprobación'}
      icon={ClipboardList}
      iconTone="blue"
      size="xl"
      submitLabel="Crear Requerimiento"
      submitIcon={Check}
      loading={isSubmitting}
      disabled={!formData.productos?.length || (formData.origen === 'administrativo' && formData.subtipo === 'apuesta' && !formData.tesis?.trim())}
      footerExtras={
        formData.productos && formData.productos.length > 0
          ? <span className="text-[12px] text-slate-500">{formData.productos.length} producto(s) · <strong className="text-slate-900 tabular-nums">$ {formData.productos.reduce((sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada, 0).toFixed(2)} USD</strong></span>
          : <span className="text-[12px] text-amber-600">Agrega al menos un producto</span>
      }
    >
      <div className="space-y-6">
        {/* Prioridad */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="text-sm font-medium text-slate-700">Prioridad</label>
          <div className="flex space-x-2">
            {(['baja', 'media', 'alta'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onFormDataChange({ ...formData, prioridad: p })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  formData.prioridad === p
                    ? p === 'alta' ? 'bg-red-500 text-white shadow-md'
                    : p === 'media' ? 'bg-yellow-500 text-white shadow-md'
                    : 'bg-slate-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p === 'alta' && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Origen del requerimiento (F4 · 2 orígenes + subtipo) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Origen del requerimiento</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {[
              { id: 'administrativo', label: 'Administrativo', sublabel: 'La empresa decide comprar', icon: <Building2 className="h-5 w-5" /> },
              { id: 'demanda_comprometida', label: 'Demanda comprometida', sublabel: 'Cliente comprometido', icon: <Users className="h-5 w-5" /> }
            ].map((o) => (
              <button
                key={o.id}
                onClick={() => onFormDataChange({
                  ...formData,
                  origen: o.id as OrigenRequerimiento,
                  subtipo: o.id === 'administrativo' ? (formData.subtipo || 'restock') : undefined,
                  tesis: o.id === 'administrativo' ? formData.tesis : undefined,
                  nombreClienteSolicitante: o.id === 'demanda_comprometida' ? formData.nombreClienteSolicitante : undefined,
                  clienteId: o.id === 'demanda_comprometida' ? formData.clienteId : undefined,
                  clienteNombre: o.id === 'demanda_comprometida' ? formData.clienteNombre : undefined
                })}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  formData.origen === o.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className={formData.origen === o.id ? 'text-blue-600' : 'text-slate-400'}>
                  {o.icon}
                </div>
                <div className="mt-2 font-medium text-slate-900">{o.label}</div>
                <div className="text-xs text-slate-500">{o.sublabel}</div>
              </button>
            ))}
          </div>

          {/* Subtipo (solo Administrativo) */}
          {formData.origen === 'administrativo' && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-slate-500">Subtipo:</span>
              {([
                { id: 'restock', label: 'Restock' },
                { id: 'manual', label: 'Manual' },
                { id: 'apuesta', label: 'Apuesta' }
              ] as const).map((s) => (
                <button
                  key={s.id}
                  onClick={() => onFormDataChange({ ...formData, subtipo: s.id, tesis: s.id === 'apuesta' ? formData.tesis : undefined })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    formData.subtipo === s.id
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Tesis (solo apuesta · obligatoria) */}
          {formData.origen === 'administrativo' && formData.subtipo === 'apuesta' && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tesis de la apuesta <span className="text-rose-500">*</span>
                <span className="text-slate-400 font-normal ml-1">(obligatoria · por que apostas a este producto)</span>
              </label>
              <textarea
                value={formData.tesis || ''}
                onChange={(e) => onFormDataChange({ ...formData, tesis: e.target.value })}
                rows={2}
                maxLength={400}
                placeholder="Demanda incierta pero plausible: margen, interes en cotizaciones, tendencia..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              />
              <div className="text-[10px] text-slate-400 mt-0.5 text-right">
                {(formData.tesis || '').trim().split(/\s+/).filter(Boolean).length} palabras (~60 sugerido)
              </div>
            </div>
          )}

          {/* Cliente (solo Demanda comprometida) */}
          {formData.origen === 'demanda_comprometida' && (
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
        <div className="bg-slate-50 rounded-xl p-5 border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-900 flex items-center">
              <Package className="h-5 w-5 mr-2 text-teal-600" />
              Agregar Productos
            </h4>
            <div className="flex items-center gap-2">
              {formData.productos && formData.productos.length > 0 && (
                <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm font-medium">
                  {formData.productos.length} agregado(s)
                </span>
              )}
              <button
                type="button"
                onClick={onAbrirCrearProducto}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
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
            <div className="bg-white rounded-xl border-2 border-teal-200 overflow-hidden">
              {/* Info del producto */}
              {(() => {
                const selectedProd = productos.find(p => p.id === productoTemp.productoId);
                return selectedProd ? (
                  <div className="p-4 bg-teal-50 border-b border-teal-100">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-medium text-teal-600 bg-teal-100 px-2 py-0.5 rounded">
                          {selectedProd.sku}
                        </span>
                        <h5 className="font-semibold text-slate-900 mt-1">
                          {selectedProd.marca} {selectedProd.nombreComercial}
                        </h5>
                        <p className="text-sm text-slate-500">
                          {getDescripcionProducto(selectedProd)}
                        </p>
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

              {/* Investigacion de mercado */}
              {loadingInvestigacion ? (
                <div className="p-4 flex items-center justify-center text-teal-600">
                  <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                  Analizando historial de precios...
                </div>
              ) : infoProductoSeleccionado && infoProductoSeleccionado.historial.length > 0 ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-1 text-emerald-500" />
                      Analisis de Mercado
                    </span>
                    <button
                      type="button"
                      onClick={() => onShowHistorialChange(showHistorial ? null : productoTemp.productoId)}
                      className="text-xs text-teal-600 hover:underline"
                    >
                      {showHistorial ? 'Ocultar detalle' : 'Ver historial'}
                    </button>
                  </div>

                  {/* Metricas de precio */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-slate-500">Ultimo</div>
                      <div className="font-bold text-slate-900">${infoProductoSeleccionado.ultimoPrecioUSD.toFixed(2)}</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-emerald-600">Minimo</div>
                      <div className="font-bold text-emerald-700">${infoProductoSeleccionado.precioMinimoUSD.toFixed(2)}</div>
                    </div>
                    <div className="bg-sky-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-sky-600">Promedio</div>
                      <div className="font-bold text-sky-700">${infoProductoSeleccionado.precioPromedioUSD.toFixed(2)}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-red-600">Maximo</div>
                      <div className="font-bold text-red-700">${infoProductoSeleccionado.precioMaximoUSD.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Proveedor recomendado */}
                  {infoProductoSeleccionado.proveedorRecomendado && (
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Check className="h-5 w-5 text-emerald-500 mr-2" />
                          <div>
                            <div className="text-xs text-emerald-600">Proveedor recomendado</div>
                            <div className="font-semibold text-emerald-800">
                              {infoProductoSeleccionado.proveedorRecomendado.nombre}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-emerald-700">
                            ${infoProductoSeleccionado.proveedorRecomendado.ultimoPrecioUSD.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Historial expandido */}
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
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-0 text-center font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Precio USD
                      {infoProductoSeleccionado?.proveedorRecomendado && (
                        <span className="text-emerald-600 ml-1">(sugerido)</span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={productoTemp.precioEstimadoUSD || ''}
                        onChange={(e) => onProductoTempChange({ ...productoTemp, precioEstimadoUSD: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-0"
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
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-0"
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
                  <label className="block text-xs font-medium text-slate-600 mb-1">URL de referencia (opcional)</label>
                  <input
                    type="text"
                    value={productoTemp.urlReferencia}
                    onChange={(e) => onProductoTempChange({ ...productoTemp, urlReferencia: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-0 text-sm"
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
              <h4 className="font-semibold text-slate-900">
                Productos en este requerimiento
              </h4>
              <div className="text-sm text-slate-500">
                Total estimado: <span className="font-bold text-slate-900">
                  ${formData.productos.reduce((sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada, 0).toFixed(2)}
                </span>
                {tcDelDia && (
                  <span className="text-slate-400 ml-2">
                    (S/ {(formData.productos.reduce((sum, p) => sum + (p.precioEstimadoUSD || 0) * p.cantidadSolicitada, 0) * tcDelDia.venta).toFixed(2)})
                  </span>
                )}
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
                      <div className="bg-teal-100 text-teal-700 w-10 h-10 rounded-lg flex items-center justify-center font-bold">
                        {prod.cantidadSolicitada}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">
                          {producto?.marca} {producto?.nombreComercial}
                        </div>
                        {detailStr && (
                          <div className="text-xs text-slate-400">{detailStr}</div>
                        )}
                        <div className="text-sm text-slate-500">
                          {producto?.sku}
                          {prod.proveedorSugerido && ` • ${prod.proveedorSugerido}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">${subtotal.toFixed(2)}</div>
                        {prod.precioEstimadoUSD && (
                          <div className="text-xs text-slate-500">${prod.precioEstimadoUSD} c/u</div>
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
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Justificacion
            <span className="text-slate-400 font-normal ml-1">(opcional)</span>
          </label>
          <textarea
            value={formData.justificacion || ''}
            onChange={(e) => onFormDataChange({ ...formData, justificacion: e.target.value })}
            rows={2}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-teal-500 focus:ring-0 resize-none"
            placeholder="Ej: Reponer stock agotado, cliente urgente, precio especial encontrado..."
          />
        </div>

      </div>
    </FormModalV2>
  );
};
