import React, { useMemo } from 'react';
import { Package, User, Calendar, DollarSign, MapPin, Truck, Box, TrendingUp, CreditCard } from 'lucide-react';
import { Badge, Button, StatusTimeline } from '../../common';
import type { TimelineStep, NextAction } from '../../common';
import type { OrdenCompra, EstadoOrden, EstadoPago } from '../../../types/ordenCompra.types';

interface OrdenCompraCardProps {
  orden: OrdenCompra;
  onCambiarEstado?: (nuevoEstado: EstadoOrden) => void;
  onRegistrarPago?: () => void;
  onRecibirOrden?: () => void;
}

const estadoLabels: Record<EstadoOrden, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  borrador: { label: 'Borrador', variant: 'default' },
  enviada: { label: 'Enviada', variant: 'info' },
  en_transito: { label: 'En Tránsito', variant: 'warning' },
  recibida: { label: 'Recibida', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'danger' }
};

const estadoPagoLabels: Record<EstadoPago, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  pendiente: { label: 'Pendiente de Pago', variant: 'danger' },
  pago_parcial: { label: 'Pago Parcial', variant: 'warning' },
  pagada: { label: 'Pagada', variant: 'success' }
};

export const OrdenCompraCard: React.FC<OrdenCompraCardProps> = ({
  orden,
  onCambiarEstado,
  onRegistrarPago,
  onRecibirOrden
}) => {
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleString('es-PE', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const estadoInfo = estadoLabels[orden.estado];
  const estadoPagoInfo = estadoPagoLabels[orden.estadoPago || 'pendiente'];

  // Generar pasos del timeline
  const timelineSteps: TimelineStep[] = useMemo(() => {
    const estadoIndex: Record<string, number> = {
      'borrador': 0,
      'enviada': 1,
      'en_transito': 2,
      'recibida': 3,
      'cancelada': -1
    };

    const currentIndex = estadoIndex[orden.estado] ?? 0;
    const isCancelled = orden.estado === 'cancelada';

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
        id: 'recibida',
        label: 'Recibida',
        date: orden.fechaRecibida,
        status: isCancelled ? 'skipped' : currentIndex === 3 ? 'completed' : 'pending'
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
        label: 'Recibir Orden',
        description: 'Confirma la recepción y genera inventario',
        buttonText: onRecibirOrden ? 'Recibir' : undefined,
        onClick: onRecibirOrden,
        variant: 'success'
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
            {orden.fechaRecibida && (
              <div className="flex justify-between">
                <span className="text-gray-600">Recibida:</span>
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

      {/* Productos */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Productos ({orden.productos.length})</h4>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Cantidad</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Costo Unit.</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orden.productos.map((producto, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{producto.marca} {producto.nombreComercial}</div>
                    <div className="text-xs text-gray-500">{producto.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">{producto.cantidad}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">${producto.costoUnitario.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">${producto.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
              <p className="text-gray-900">{orden.almacenDestino}</p>
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
        {(orden.estado === 'en_transito' || orden.estado === 'enviada') && !orden.inventarioGenerado && onRecibirOrden && (
          <Button
            variant="primary"
            onClick={onRecibirOrden}
          >
            <Box className="h-4 w-4 mr-2" />
            Recibir y Generar Inventario
          </Button>
        )}
      </div>
    </div>
  );
};