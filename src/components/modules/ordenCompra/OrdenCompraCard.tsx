import React, { useMemo, useState } from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import { Package, User, Calendar, DollarSign, MapPin, Truck, Box, TrendingUp, CreditCard, ChevronDown, ChevronUp, Clock, RotateCcw } from 'lucide-react';
import { Badge, Button, StatusTimeline } from '../../common';
import type { TimelineStep, NextAction } from '../../common';
import type { OrdenCompra, EstadoOrden, EstadoPagoOC } from '../../../types/ordenCompra.types';

interface OrdenCompraCardProps {
  orden: OrdenCompra;
  onCambiarEstado?: (nuevoEstado: EstadoOrden) => void;
  onRegistrarPago?: () => void;
  onRecibirOrden?: () => void;
  onRevertirRecepciones?: () => void;
}

const estadoLabels: Record<EstadoOrden, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  borrador: { label: 'Borrador', variant: 'default' },
  enviada: { label: 'Enviada', variant: 'info' },
  en_transito: { label: 'En Tránsito', variant: 'warning' },
  recibida_parcial: { label: 'Recibida Parcial', variant: 'warning' },
  recibida: { label: 'Recibida', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'danger' }
};

const estadoPagoLabels: Record<EstadoPagoOC, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  pendiente: { label: 'Pendiente de Pago', variant: 'danger' },
  pago_parcial: { label: 'Pago Parcial', variant: 'warning' },
  pagada: { label: 'Pagada', variant: 'success' }
};

export const OrdenCompraCard: React.FC<OrdenCompraCardProps> = ({
  orden,
  onCambiarEstado,
  onRegistrarPago,
  onRecibirOrden,
  onRevertirRecepciones
}) => {
  const [showHistory, setShowHistory] = useState(false);


  const estadoInfo = estadoLabels[orden.estado];
  const estadoPagoInfo = estadoPagoLabels[orden.estadoPago || 'pendiente'];

  // Generar pasos del timeline (5 pasos con recibida_parcial)
  const timelineSteps: TimelineStep[] = useMemo(() => {
    const estadoIndex: Record<string, number> = {
      'borrador': 0,
      'enviada': 1,
      'en_transito': 2,
      'recibida_parcial': 3,
      'recibida': 4,
      'cancelada': -1
    };

    const currentIndex = estadoIndex[orden.estado] ?? 0;
    const isCancelled = orden.estado === 'cancelada';
    const hasParcial = orden.recepcionesParciales && orden.recepcionesParciales.length > 0;

    return [
      {
        id: 'borrador',
        label: 'Borrador',
        date: orden.fechaCreacion,
        status: isCancelled ? 'skipped' : currentIndex >= 0 ? 'completed' : 'pending'
      },
      {
        id: 'enviada',
        label: 'Enviada',
        date: orden.fechaEnviada,
        status: isCancelled ? 'skipped' : currentIndex > 1 ? 'completed' : currentIndex === 1 ? 'current' : 'pending'
      },
      {
        id: 'en_transito',
        label: 'En Tránsito',
        date: orden.fechaEnTransito,
        status: isCancelled ? 'skipped' : currentIndex > 2 ? 'completed' : currentIndex === 2 ? 'current' : 'pending'
      },
      {
        id: 'recibida_parcial',
        label: 'Parcial',
        date: orden.fechaPrimeraRecepcion,
        status: isCancelled ? 'skipped'
          : currentIndex > 3 ? (hasParcial ? 'completed' : 'skipped')
          : currentIndex === 3 ? 'current'
          : 'pending'
      },
      {
        id: 'recibida',
        label: 'Recibida',
        date: orden.fechaRecibida,
        status: isCancelled ? 'skipped' : currentIndex === 4 ? 'completed' : 'pending'
      }
    ];
  }, [orden]);

  // Determinar la siguiente acción basada en el estado
  const nextAction: NextAction | undefined = useMemo(() => {
    if (orden.estado === 'cancelada' || orden.estado === 'recibida') return undefined;

    const actions: Record<string, NextAction> = {
      borrador: {
        label: 'Marcar como Enviada',
        description: 'Indica que la orden fue enviada al proveedor',
        buttonText: onCambiarEstado ? 'Enviar' : undefined,
        onClick: onCambiarEstado ? () => onCambiarEstado('enviada') : undefined,
        variant: 'primary'
      },
      enviada: {
        label: 'Poner en Tránsito',
        description: 'Registra el tracking y marca la orden en camino',
        buttonText: onCambiarEstado ? 'En Tránsito' : undefined,
        onClick: onCambiarEstado ? () => onCambiarEstado('en_transito') : undefined,
        variant: 'warning'
      },
      en_transito: {
        label: 'Recibir Productos',
        description: 'Registra los productos recibidos y genera inventario',
        buttonText: onRecibirOrden ? 'Recibir' : undefined,
        onClick: onRecibirOrden,
        variant: 'success'
      },
      recibida_parcial: {
        label: 'Recibir Más Productos',
        description: 'Registrar siguiente entrega de productos',
        buttonText: onRecibirOrden ? 'Recibir Más' : undefined,
        onClick: onRecibirOrden,
        variant: 'warning'
      }
    };

    return actions[orden.estado];
  }, [orden.estado, onCambiarEstado, onRecibirOrden]);

  // Determinar siguientes acciones posibles (solo estado logístico)
  const getAccionesDisponibles = () => {
    const acciones: Array<{ estado: EstadoOrden; label: string }> = [];

    if (orden.estado === 'borrador') {
      acciones.push({ estado: 'enviada', label: 'Marcar como Enviada' });
    } else if (orden.estado === 'enviada') {
      acciones.push({ estado: 'en_transito', label: 'Poner en Tránsito' });
    }

    return acciones;
  };

  // Progreso por producto (para recibida_parcial)
  const tieneRecepcionesParciales = orden.recepcionesParciales && orden.recepcionesParciales.length > 0;
  const totalOrdenado = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
  const totalRecibido = orden.productos.reduce((sum, p) => sum + (p.cantidadRecibida || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <Package className="h-8 w-8 text-primary-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{orden.numeroOrden}</h2>
              <p className="text-sm text-gray-600">{orden.nombreProveedor}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={estadoInfo.variant} size="lg">
            {estadoInfo.label}
          </Badge>
          <Badge variant={estadoPagoInfo.variant}>
            <CreditCard className="h-3 w-3 mr-1" />
            {estadoPagoInfo.label}
          </Badge>
        </div>
      </div>

      {/* Timeline de Estado */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <StatusTimeline
          steps={timelineSteps}
          nextAction={nextAction}
          orientation="horizontal"
          showDates={true}
          compact={false}
        />
      </div>

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Calendar className="h-5 w-5 text-gray-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Fechas</h4>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Creación:</span>
              <span className="text-gray-900">{formatDate(orden.fechaCreacion)}</span>
            </div>
            {orden.fechaEnviada && (
              <div className="flex justify-between">
                <span className="text-gray-600">Enviada:</span>
                <span className="text-gray-900">{formatDate(orden.fechaEnviada)}</span>
              </div>
            )}
            {orden.fechaPago && (
              <div className="flex justify-between">
                <span className="text-gray-600">Pagada:</span>
                <span className="text-gray-900">{formatDate(orden.fechaPago)}</span>
              </div>
            )}
            {orden.fechaPrimeraRecepcion && (
              <div className="flex justify-between">
                <span className="text-gray-600">Primera recepción:</span>
                <span className="text-gray-900">{formatDate(orden.fechaPrimeraRecepcion)}</span>
              </div>
            )}
            {orden.fechaRecibida && (
              <div className="flex justify-between">
                <span className="text-gray-600">Recibida completa:</span>
                <span className="text-gray-900">{formatDate(orden.fechaRecibida)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-primary-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <DollarSign className="h-5 w-5 text-primary-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Totales</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal Productos:</span>
              <span className="font-semibold">${orden.subtotalUSD.toFixed(2)}</span>
            </div>
            {orden.impuestoUSD && orden.impuestoUSD > 0 && (
              <div className="flex justify-between text-sm text-amber-700">
                <span>Tax / Impuesto ({((orden.impuestoUSD / orden.subtotalUSD) * 100).toFixed(2)}%):</span>
                <span className="font-medium">${orden.impuestoUSD.toFixed(2)}</span>
              </div>
            )}
            {orden.gastosEnvioUSD && orden.gastosEnvioUSD > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Gastos de Envío:</span>
                <span>${orden.gastosEnvioUSD.toFixed(2)}</span>
              </div>
            )}
            {orden.otrosGastosUSD && orden.otrosGastosUSD > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Otros Gastos:</span>
                <span>${orden.otrosGastosUSD.toFixed(2)}</span>
              </div>
            )}
            {orden.descuentoUSD && orden.descuentoUSD > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Descuento:</span>
                <span className="font-medium">-${orden.descuentoUSD.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-primary-200 pt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Total USD:</span>
                <span className="text-xl font-bold text-primary-600">${orden.totalUSD.toFixed(2)}</span>
              </div>
            </div>
            {orden.totalPEN && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total PEN (TC {orden.tcPago?.toFixed(3)}):</span>
                <span className="text-lg font-semibold text-gray-900">S/ {orden.totalPEN.toFixed(2)}</span>
              </div>
            )}
            {orden.diferenciaCambiaria && Math.abs(orden.diferenciaCambiaria) > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Diferencia Cambiaria:</span>
                <span className={`font-semibold flex items-center ${
                  orden.diferenciaCambiaria > 0 ? 'text-danger-600' : 'text-success-600'
                }`}>
                  <TrendingUp className="h-4 w-4 mr-1" />
                  S/ {Math.abs(orden.diferenciaCambiaria).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Productos con Costo Real */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Productos ({orden.productos.length})</h4>

        {/* Calcular desglose de costos por producto */}
        {(() => {
          const tc = orden.tcCompra || orden.tcPago || 3.70;
          const totalUnidades = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
          const costoBaseTotal = orden.productos.reduce((sum, p) => sum + (p.costoUnitario * p.cantidad), 0);

          // Componentes de costo
          const impuestoTotal = orden.impuestoUSD || 0;
          const envioTotal = orden.gastosEnvioUSD || 0;
          const otrosTotal = orden.otrosGastosUSD || 0;
          const descuentoTotal = orden.descuentoUSD || 0;

          // Impuesto: uniforme por unidad
          const impuestoPorUnidad = totalUnidades > 0 ? impuestoTotal / totalUnidades : 0;
          // Envío, otros, descuento: proporcional al costo base
          const costosProrrateo = envioTotal + otrosTotal - descuentoTotal;

          const hasImpuesto = impuestoTotal > 0;
          const hasEnvio = envioTotal > 0;
          const hasOtros = otrosTotal > 0;
          const hasDescuento = descuentoTotal > 0;

          return (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500">Cant.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                      <div>Precio Base</div>
                      <div className="text-[10px] font-normal text-gray-400">unitario</div>
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                      <div>Desglose</div>
                      <div className="text-[10px] font-normal text-gray-400">por unidad</div>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-emerald-700 bg-emerald-50">
                      <div>Costo Real</div>
                      <div className="text-[10px] font-normal text-emerald-600">unitario</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orden.productos.map((producto, index) => {
                    // Proporcional al costo base de este producto
                    const proporcion = costoBaseTotal > 0 ? producto.costoUnitario / costoBaseTotal : 0;
                    const envioPorUd = envioTotal * proporcion;
                    const otrosPorUd = otrosTotal * proporcion;
                    const descuentoPorUd = descuentoTotal * proporcion;
                    const totalAdicional = impuestoPorUnidad + envioPorUd + otrosPorUd - descuentoPorUd;
                    const costoRealUnitario = producto.costoUnitario + totalAdicional;
                    const costoRealUnitarioPEN = costoRealUnitario * tc;

                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-gray-900">{producto.marca} {producto.nombreComercial}</div>
                          <div className="flex items-center flex-wrap gap-x-1.5 text-[10px] text-gray-500 mt-0.5">
                            <span className="font-mono text-gray-400">{producto.sku}</span>
                            {producto.presentacion && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span>{producto.presentacion}</span>
                              </>
                            )}
                            {producto.contenido && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span>{producto.contenido}</span>
                              </>
                            )}
                            {producto.dosaje && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span>{producto.dosaje}</span>
                              </>
                            )}
                            {producto.sabor && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span>{producto.sabor}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                            {producto.cantidad}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-right text-sm text-gray-600">
                          ${producto.costoUnitario.toFixed(2)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <div className="space-y-0.5 text-[11px]">
                            {hasImpuesto && (
                              <div className="text-amber-600">+${impuestoPorUnidad.toFixed(2)} <span className="text-[9px] text-amber-500">tax</span></div>
                            )}
                            {hasEnvio && (
                              <div className="text-blue-600">+${envioPorUd.toFixed(2)} <span className="text-[9px] text-blue-400">envío</span></div>
                            )}
                            {hasOtros && (
                              <div className="text-gray-500">+${otrosPorUd.toFixed(2)} <span className="text-[9px] text-gray-400">otros</span></div>
                            )}
                            {hasDescuento && (
                              <div className="text-emerald-600">-${descuentoPorUd.toFixed(2)} <span className="text-[9px] text-emerald-500">desc.</span></div>
                            )}
                            {!hasImpuesto && !hasEnvio && !hasOtros && !hasDescuento && (
                              <div className="text-gray-400">-</div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right bg-emerald-50">
                          <div className="text-sm font-bold text-emerald-700">${costoRealUnitario.toFixed(2)}</div>
                          <div className="text-xs text-emerald-600">S/ {costoRealUnitarioPEN.toFixed(2)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-3 py-2 text-sm font-medium text-gray-700">Total</td>
                    <td className="px-2 py-2 text-center text-sm font-semibold text-gray-700">{totalUnidades}</td>
                    <td className="px-2 py-2 text-right text-sm font-medium text-gray-700">${orden.subtotalUSD.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="space-y-0.5 text-[11px]">
                        {hasImpuesto && <div className="text-amber-700 font-medium">+${impuestoTotal.toFixed(2)} <span className="text-[9px]">tax</span></div>}
                        {hasEnvio && <div className="text-blue-700 font-medium">+${envioTotal.toFixed(2)} <span className="text-[9px]">envío</span></div>}
                        {hasOtros && <div className="text-gray-600 font-medium">+${otrosTotal.toFixed(2)} <span className="text-[9px]">otros</span></div>}
                        {hasDescuento && <div className="text-emerald-700 font-medium">-${descuentoTotal.toFixed(2)} <span className="text-[9px]">desc.</span></div>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right bg-emerald-100">
                      <div className="text-base font-bold text-emerald-800">${orden.totalUSD.toFixed(2)}</div>
                      <div className="text-sm font-semibold text-emerald-700">S/ {(orden.totalUSD * tc).toFixed(2)}</div>
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Leyenda explicativa */}
              <div className="px-3 py-2 bg-blue-50 border-t border-blue-200">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="text-blue-700">
                    <strong>TC:</strong> S/ {tc.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-blue-600">
                  * Tax uniforme por unidad · Envío, otros y descuento prorrateados por costo base
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tracking */}
      {orden.numeroTracking && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Truck className="h-5 w-5 text-gray-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Información de Envío</h4>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Tracking:</span>
              <span className="ml-2 font-mono text-gray-900">{orden.numeroTracking}</span>
            </div>
            {orden.courier && (
              <div>
                <span className="text-gray-600">Courier:</span>
                <span className="ml-2 text-gray-900">{orden.courier}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Almacén y observaciones */}
      {(orden.almacenDestino || orden.observaciones) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orden.almacenDestino && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <MapPin className="h-5 w-5 text-gray-600 mr-2" />
                <h4 className="font-semibold text-gray-900">Almacén Destino</h4>
              </div>
              <p className="text-gray-900">
                {orden.nombreAlmacenDestino || orden.almacenDestino}
              </p>
            </div>
          )}
          
          {orden.observaciones && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Observaciones</h4>
              <p className="text-sm text-gray-700">{orden.observaciones}</p>
            </div>
          )}
        </div>
      )}

      {/* Progreso de recepción por producto */}
      {(orden.estado === 'recibida_parcial' || tieneRecepcionesParciales) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">Progreso de Recepción</h4>
            <span className="text-sm font-medium text-gray-600">
              {totalRecibido}/{totalOrdenado} unidades ({totalOrdenado > 0 ? ((totalRecibido / totalOrdenado) * 100).toFixed(0) : 0}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${totalRecibido >= totalOrdenado ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${totalOrdenado > 0 ? (totalRecibido / totalOrdenado) * 100 : 0}%` }}
            />
          </div>
          <div className="space-y-2">
            {orden.productos.map(p => {
              const recibido = p.cantidadRecibida || 0;
              const pct = p.cantidad > 0 ? (recibido / p.cantidad) * 100 : 0;
              return (
                <div key={p.productoId} className="flex items-center gap-3 text-sm">
                  <div className="w-40 truncate text-gray-700" title={p.nombreComercial}>{p.nombreComercial}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="w-24 text-right text-gray-600">
                    <span className={recibido >= p.cantidad ? 'text-green-600 font-medium' : ''}>
                      {recibido}/{p.cantidad}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Historial de recepciones */}
          {orden.recepcionesParciales && orden.recepcionesParciales.length > 0 && (
            <div className="border rounded-lg">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span>Historial de recepciones ({orden.recepcionesParciales.length})</span>
                </div>
                {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showHistory && (
                <div className="border-t divide-y">
                  {orden.recepcionesParciales.map(rec => (
                    <div key={rec.id} className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">Recepción #{rec.numero}</span>
                        <span className="text-xs text-gray-500">{formatDate(rec.fecha)}</span>
                      </div>
                      <div className="text-gray-600">
                        {rec.totalUnidadesRecepcion} unidades: {rec.productosRecibidos.map(pr => {
                          const prod = orden.productos.find(p => p.productoId === pr.productoId);
                          return `${prod?.nombreComercial || pr.productoId} (${pr.cantidadRecibida})`;
                        }).join(', ')}
                      </div>
                      {rec.observaciones && (
                        <div className="text-xs text-gray-500 mt-1">{rec.observaciones}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center flex-wrap gap-3 pt-4 border-t">
        {/* Acciones de estado logístico */}
        {getAccionesDisponibles().map(accion => (
          <Button
            key={accion.estado}
            variant="primary"
            onClick={() => onCambiarEstado?.(accion.estado)}
          >
            {accion.label}
          </Button>
        ))}

        {/* Botón de pago */}
        {orden.estado !== 'cancelada' && orden.estadoPago !== 'pagada' && onRegistrarPago && (
          <Button
            variant="secondary"
            onClick={onRegistrarPago}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {orden.estadoPago === 'pago_parcial' ? 'Registrar Pago Adicional' : 'Registrar Pago'}
          </Button>
        )}

        {/* Botón de recibir orden */}
        {(['en_transito', 'enviada', 'recibida_parcial'].includes(orden.estado)) && onRecibirOrden && (
          <Button
            variant={orden.estado === 'recibida_parcial' ? 'warning' : 'primary'}
            onClick={onRecibirOrden}
          >
            <Box className="h-4 w-4 mr-2" />
            {orden.estado === 'recibida_parcial' ? 'Recibir Más Productos' : 'Recibir Productos'}
          </Button>
        )}

        {/* Botón revertir recepciones (solo cuando hay recepciones) */}
        {(['recibida_parcial', 'recibida'].includes(orden.estado)) && onRevertirRecepciones && (orden.recepcionesParciales?.length ?? 0) > 0 && (
          <Button
            variant="danger"
            onClick={onRevertirRecepciones}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Revertir Recepciones
          </Button>
        )}
      </div>
    </div>
  );
};