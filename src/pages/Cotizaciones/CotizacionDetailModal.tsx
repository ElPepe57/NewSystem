import React from 'react';
import {
  User,
  Phone,
  Package,
  Clock,
  Lock,
  CheckCircle,
  XCircle,
  DollarSign,
  MessageCircle,
  Download,
  Eye,
  Edit3,
  Copy,
  UserCheck,
  Undo2,
  ThumbsDown
} from 'lucide-react';
import { formatFecha } from '../../utils/dateFormatters';
import { formatCurrencyPEN, formatCurrency as formatCurrencyUtil } from '../../utils/format';
import { Modal, Badge, Button } from '../../components/common';
import type { Cotizacion, MotivoRechazo } from '../../types/cotizacion.types';
import type { MonedaTesoreria } from '../../types/tesoreria.types';

const MOTIVOS_RECHAZO: { value: MotivoRechazo; label: string }[] = [
  { value: 'precio_alto', label: 'Precio muy alto' },
  { value: 'encontro_mejor_opcion', label: 'Encontró mejor opción' },
  { value: 'sin_presupuesto', label: 'Sin presupuesto' },
  { value: 'producto_diferente', label: 'Quería otro producto' },
  { value: 'demora_entrega', label: 'Demora en entrega' },
  { value: 'cambio_necesidad', label: 'Ya no necesita' },
  { value: 'sin_respuesta', label: 'Sin respuesta' },
  { value: 'otro', label: 'Otro motivo' }
];

interface CotizacionDetailModalProps {
  isOpen: boolean;
  cotizacion: Cotizacion;
  generandoPdf: boolean;
  resolverNombreCanal: (canalId: string) => string;
  onClose: () => void;
  onEditar: (cotizacion: Cotizacion) => void;
  onDuplicar: (cotizacion: Cotizacion) => void;
  onDescargarPdf: (cotizacion: Cotizacion) => void;
  onAbrirPdf: (cotizacion: Cotizacion) => void;
  onWhatsApp: (cotizacion: Cotizacion) => void;
  onValidar: (cotizacion: Cotizacion) => void;
  onComprometerAdelanto: (cotizacion: Cotizacion) => void;
  onRegistrarPagoAdelanto: (cotizacion: Cotizacion) => void;
  onRevertirValidacion: (cotizacion: Cotizacion) => void;
  onConfirmar: (cotizacion: Cotizacion) => void;
  onRechazar: (cotizacion: Cotizacion) => void;
  onEliminar: (cotizacion: Cotizacion) => void;
}

export const CotizacionDetailModal: React.FC<CotizacionDetailModalProps> = ({
  isOpen,
  cotizacion,
  generandoPdf,
  resolverNombreCanal,
  onClose,
  onEditar,
  onDuplicar,
  onDescargarPdf,
  onAbrirPdf,
  onWhatsApp,
  onValidar,
  onComprometerAdelanto,
  onRegistrarPagoAdelanto,
  onRevertirValidacion,
  onConfirmar,
  onRechazar,
  onEliminar
}) => {
  const formatCurrency = (amount: number): string => formatCurrencyPEN(amount);
  const formatCurrencyBimoneda = (amount: number, moneda: MonedaTesoreria): string =>
    formatCurrencyUtil(amount, moneda as 'USD' | 'PEN');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cotización ${cotizacion.numeroCotizacion}`}
      size="xl"
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Header: Estado y Total */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg">
          <div className="flex items-center gap-4">
            <Badge
              variant={
                cotizacion.estado === 'nueva' ? 'default' :
                cotizacion.estado === 'validada' ? 'info' :
                cotizacion.estado === 'con_abono' ? 'success' :
                cotizacion.estado === 'confirmada' ? 'success' :
                cotizacion.estado === 'rechazada' ? 'danger' :
                cotizacion.estado === 'vencida' ? 'warning' : 'default'
              }
              size="lg"
            >
              {cotizacion.estado === 'nueva' ? 'Nueva' :
               cotizacion.estado === 'validada' ? 'Validada' :
               cotizacion.estado === 'con_abono' ? 'Con Abono' :
               cotizacion.estado === 'confirmada' ? 'Confirmada' :
               cotizacion.estado === 'rechazada' ? 'Rechazada' :
               cotizacion.estado === 'vencida' ? 'Vencida' : cotizacion.estado}
            </Badge>
            <span className="text-sm text-gray-600">
              Canal: <span className="font-medium">{resolverNombreCanal(cotizacion.canal)}</span>
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-primary-600">{formatCurrency(cotizacion.totalPEN)}</p>
          </div>
        </div>

        {/* Información del Cliente */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h4 className="font-semibold text-gray-700 flex items-center gap-2">
              <User className="h-4 w-4" />
              Información del Cliente
            </h4>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Nombre</p>
              <p className="font-medium text-gray-900">{cotizacion.nombreCliente}</p>
            </div>
            {cotizacion.telefonoCliente && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Teléfono</p>
                <p className="font-medium text-gray-900 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {cotizacion.telefonoCliente}
                </p>
              </div>
            )}
            {cotizacion.emailCliente && (
              <div>
                <p className="text-xs text-gray-500 uppercase">Email</p>
                <p className="font-medium text-gray-900">{cotizacion.emailCliente}</p>
              </div>
            )}
            {cotizacion.dniRuc && (
              <div>
                <p className="text-xs text-gray-500 uppercase">DNI/RUC</p>
                <p className="font-medium text-gray-900">{cotizacion.dniRuc}</p>
              </div>
            )}
            {cotizacion.direccionEntrega && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase">Dirección de Entrega</p>
                <p className="font-medium text-gray-900">{cotizacion.direccionEntrega}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabla de Productos */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h4 className="font-semibold text-gray-700 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Productos ({cotizacion.productos.length})
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cant.</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">P. Unit.</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cotizacion.productos.map((producto, idx) => {
                  const sinStock = producto.requiereStock || (producto.stockDisponible !== undefined && producto.stockDisponible < producto.cantidad);
                  return (
                    <tr key={idx} className={sinStock ? 'bg-amber-50' : ''}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{producto.sku}</div>
                        <div className="text-xs text-gray-500">{producto.marca} - {producto.nombreComercial}</div>
                        {producto.presentacion && (
                          <div className="text-xs text-gray-400">{producto.presentacion}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {producto.stockDisponible !== undefined ? (
                          <Badge variant={sinStock ? 'warning' : 'success'} size="sm">
                            {Math.max(0, producto.stockDisponible)}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{producto.cantidad}</td>
                      <td className="px-4 py-3 text-right text-sm">{formatCurrency(producto.precioUnitario)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(producto.subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Totales */}
          <div className="bg-gray-50 px-4 py-3 border-t">
            <div className="flex flex-col items-end gap-1">
              <div className="flex justify-between w-48">
                <span className="text-sm text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatCurrency(cotizacion.subtotalPEN)}</span>
              </div>
              {cotizacion.descuento && cotizacion.descuento > 0 && (
                <div className="flex justify-between w-48">
                  <span className="text-sm text-gray-600">Descuento:</span>
                  <span className="font-medium text-red-600">-{formatCurrency(cotizacion.descuento)}</span>
                </div>
              )}
              {cotizacion.costoEnvio && cotizacion.costoEnvio > 0 && (
                <div className="flex justify-between w-48">
                  <span className="text-sm text-gray-600">Envío:</span>
                  <span className="font-medium">{formatCurrency(cotizacion.costoEnvio)}</span>
                </div>
              )}
              {cotizacion.incluyeEnvio && (
                <div className="flex justify-between w-48">
                  <span className="text-sm text-gray-600">Envío:</span>
                  <span className="font-medium text-green-600">GRATIS</span>
                </div>
              )}
              <div className="flex justify-between w-48 pt-2 border-t mt-1">
                <span className="font-semibold">TOTAL:</span>
                <span className="font-bold text-lg text-primary-600">{formatCurrency(cotizacion.totalPEN)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Historial del Flujo */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h4 className="font-semibold text-gray-700 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Historial del Flujo
            </h4>
          </div>
          <div className="p-4">
            <div className="relative">
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200"></div>
              <div className="space-y-4">
                <div className="flex items-start gap-3 relative">
                  <div className="w-4 h-4 rounded-full bg-gray-400 border-2 border-white z-10"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Cotización creada</p>
                    <p className="text-xs text-gray-500">{formatFecha(cotizacion.fechaCreacion)}</p>
                  </div>
                </div>

                {cotizacion.fechaValidacion && (
                  <div className="flex items-start gap-3 relative">
                    <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white z-10"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Cliente validó interés</p>
                      <p className="text-xs text-gray-500">{formatFecha(cotizacion.fechaValidacion)}</p>
                    </div>
                  </div>
                )}

                {cotizacion.fechaAdelanto && cotizacion.adelanto && (
                  <div className="flex items-start gap-3 relative">
                    <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-white z-10"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Adelanto registrado: {
                          cotizacion.adelanto.moneda === 'USD'
                            ? `${formatCurrency(cotizacion.adelanto.montoEquivalentePEN || 0)} (${formatCurrencyBimoneda(cotizacion.adelanto.monto, 'USD')})`
                            : formatCurrency(cotizacion.adelanto.monto)
                        }
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFecha(cotizacion.fechaAdelanto)} - {cotizacion.adelanto.metodoPago}
                        {cotizacion.adelanto.moneda === 'USD' && cotizacion.adelanto.tipoCambio && (
                          <span className="ml-1">(TC: {cotizacion.adelanto.tipoCambio.toFixed(3)})</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {cotizacion.fechaConfirmacion && (
                  <div className="flex items-start gap-3 relative">
                    <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white z-10"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Confirmada como venta</p>
                      <p className="text-xs text-gray-500">{formatFecha(cotizacion.fechaConfirmacion)}</p>
                      {cotizacion.numeroVenta && (
                        <p className="text-xs font-medium text-green-600">{cotizacion.numeroVenta}</p>
                      )}
                    </div>
                  </div>
                )}

                {cotizacion.fechaRechazo && (
                  <div className="flex items-start gap-3 relative">
                    <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white z-10"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Rechazada</p>
                      <p className="text-xs text-gray-500">{formatFecha(cotizacion.fechaRechazo)}</p>
                    </div>
                  </div>
                )}

                {cotizacion.fechaVencimiento && (
                  <div className="flex items-start gap-3 relative">
                    <div className={`w-4 h-4 rounded-full border-2 border-white z-10 ${
                      cotizacion.estado === 'vencida' ? 'bg-amber-500' : 'bg-gray-300'
                    }`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {cotizacion.estado === 'vencida' ? 'Venció' : 'Vence'}
                      </p>
                      <p className="text-xs text-gray-500">{formatFecha(cotizacion.fechaVencimiento)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reserva de Stock */}
        {cotizacion.reservaStock && (
          <div className={`border rounded-lg overflow-hidden ${
            cotizacion.reservaStock.tipoReserva === 'fisica' ? 'border-green-200' : 'border-purple-200'
          }`}>
            <div className={`px-4 py-2 border-b ${
              cotizacion.reservaStock.tipoReserva === 'fisica' ? 'bg-green-50' : 'bg-purple-50'
            }`}>
              <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Reserva de Stock
                <Badge variant={cotizacion.reservaStock.tipoReserva === 'fisica' ? 'success' : 'warning'}>
                  {cotizacion.reservaStock.tipoReserva === 'fisica' ? 'Física' : 'Virtual'}
                </Badge>
              </h4>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Fecha Reserva</p>
                  <p className="font-medium">{formatFecha(cotizacion.reservaStock.fechaReserva)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Vigencia Hasta</p>
                  <p className="font-medium">{formatFecha(cotizacion.reservaStock.vigenciaHasta)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Duración</p>
                  <p className="font-medium">{cotizacion.reservaStock.horasVigencia}h</p>
                </div>
              </div>

              {cotizacion.reservaStock.productosReservados.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Productos Reservados</p>
                  <div className="space-y-1">
                    {cotizacion.reservaStock.productosReservados.map((pr, idx) => (
                      <div key={idx} className="flex justify-between text-sm bg-gray-50 px-2 py-1 rounded">
                        <span>{pr.sku || `Producto ${idx + 1}`}</span>
                        <span className="font-medium">{pr.cantidad} uds</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cotizacion.reservaStock.tipoReserva === 'virtual' && cotizacion.reservaStock.stockVirtual && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm font-medium text-purple-800 mb-2">Esperando Stock</p>
                  {cotizacion.reservaStock.stockVirtual.productosVirtuales?.map((pv, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{pv.sku || `Producto ${idx + 1}`}</span>
                      <span className="font-medium text-purple-600">{pv.cantidadRequerida} uds pendientes</span>
                    </div>
                  ))}
                  {cotizacion.reservaStock.stockVirtual.fechaEstimadaStock && (
                    <p className="text-xs text-purple-600 mt-2">
                      Estimado: {formatFecha(cotizacion.reservaStock.stockVirtual.fechaEstimadaStock)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rechazo */}
        {cotizacion.rechazo && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-2">
              <ThumbsDown className="h-4 w-4" />
              Información del Rechazo
            </h4>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-red-600 uppercase">Motivo</p>
                <p className="font-medium text-red-800">
                  {MOTIVOS_RECHAZO.find(m => m.value === cotizacion.rechazo?.motivo)?.label || cotizacion.rechazo.motivo}
                </p>
              </div>
              {cotizacion.rechazo.descripcion && (
                <div>
                  <p className="text-xs text-red-600 uppercase">Descripción</p>
                  <p className="text-sm text-red-700">{cotizacion.rechazo.descripcion}</p>
                </div>
              )}
              {cotizacion.rechazo.precioEsperado && (
                <div>
                  <p className="text-xs text-red-600 uppercase">Precio Esperado</p>
                  <p className="font-medium text-red-800">{formatCurrency(cotizacion.rechazo.precioEsperado)}</p>
                </div>
              )}
              {cotizacion.rechazo.competidor && (
                <div>
                  <p className="text-xs text-red-600 uppercase">Competidor</p>
                  <p className="text-sm text-red-700">{cotizacion.rechazo.competidor}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Venta Creada */}
        {cotizacion.estado === 'confirmada' && cotizacion.numeroVenta && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Venta Creada
            </h4>
            <p className="text-lg font-bold text-green-700 mt-1">{cotizacion.numeroVenta}</p>
          </div>
        )}

        {/* Observaciones */}
        {cotizacion.observaciones && (
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold text-gray-700 mb-2">Observaciones</h4>
            <p className="text-sm text-gray-600">{cotizacion.observaciones}</p>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="mt-6 pt-4 border-t space-y-3">
        {/* Acciones de PDF y comunicación */}
        <div className="flex gap-2 flex-wrap">
          {['nueva', 'validada', 'pendiente_adelanto'].includes(cotizacion.estado) && (
            <Button variant="outline" onClick={() => onEditar(cotizacion)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          <Button variant="outline" onClick={() => onDuplicar(cotizacion)}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicar
          </Button>
          <Button variant="outline" onClick={() => onDescargarPdf(cotizacion)} disabled={generandoPdf}>
            <Download className="h-4 w-4 mr-2" />
            {generandoPdf ? 'Generando...' : 'Descargar PDF'}
          </Button>
          <Button variant="outline" onClick={() => onAbrirPdf(cotizacion)} disabled={generandoPdf}>
            <Eye className="h-4 w-4 mr-2" />
            Ver PDF
          </Button>
          {cotizacion.telefonoCliente && (
            <Button variant="outline" onClick={() => onWhatsApp(cotizacion)}>
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
          )}
        </div>

        {/* Acciones del flujo */}
        <div className="flex gap-2 flex-wrap">
          {cotizacion.estado === 'nueva' && (
            <>
              <Button variant="primary" onClick={() => onValidar(cotizacion)}>
                <UserCheck className="h-4 w-4 mr-2" />
                Validar (sin adelanto)
              </Button>
              <Button variant="secondary" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => onComprometerAdelanto(cotizacion)}>
                <Lock className="h-4 w-4 mr-2" />
                Comprometer Adelanto
              </Button>
              <Button variant="danger" onClick={() => onRechazar(cotizacion)}>
                <ThumbsDown className="h-4 w-4 mr-2" />
                Rechazar
              </Button>
            </>
          )}
          {cotizacion.estado === 'validada' && (
            <>
              <Button variant="success" onClick={() => onConfirmar(cotizacion)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Venta
              </Button>
              <Button variant="secondary" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => onComprometerAdelanto(cotizacion)}>
                <Lock className="h-4 w-4 mr-2" />
                Comprometer Adelanto
              </Button>
              <Button variant="outline" onClick={() => onRevertirValidacion(cotizacion)}>
                <Undo2 className="h-4 w-4 mr-2" />
                Revertir
              </Button>
              <Button variant="danger" onClick={() => onRechazar(cotizacion)}>
                <ThumbsDown className="h-4 w-4 mr-2" />
                Rechazar
              </Button>
            </>
          )}
          {cotizacion.estado === 'pendiente_adelanto' && (
            <>
              <Button variant="success" onClick={() => onRegistrarPagoAdelanto(cotizacion)}>
                <DollarSign className="h-4 w-4 mr-2" />
                Registrar Pago
              </Button>
              <Button variant="danger" onClick={() => onRechazar(cotizacion)}>
                <ThumbsDown className="h-4 w-4 mr-2" />
                Rechazar
              </Button>
            </>
          )}
          {(cotizacion.estado === 'adelanto_pagado' || cotizacion.estado === 'con_abono') && (
            <Button variant="success" onClick={() => onConfirmar(cotizacion)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Venta
            </Button>
          )}
          {(cotizacion.estado === 'nueva' || cotizacion.estado === 'rechazada') && (
            <Button variant="outline" onClick={() => onEliminar(cotizacion)}>
              <XCircle className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
