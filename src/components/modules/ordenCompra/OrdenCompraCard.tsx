import React from 'react';
import { Package, User, Calendar, DollarSign, MapPin, Truck, Box, TrendingUp } from 'lucide-react';
import { Badge, Button } from '../../common';
import type { OrdenCompra, EstadoOrden } from '../../../types/ordenCompra.types';

interface OrdenCompraCardProps {
  orden: OrdenCompra;
  onCambiarEstado?: (nuevoEstado: EstadoOrden) => void;
  onRecibirOrden?: () => void;
}

const estadoLabels: Record<EstadoOrden, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  borrador: { label: 'Borrador', variant: 'default' },
  enviada: { label: 'Enviada', variant: 'info' },
  pagada: { label: 'Pagada', variant: 'warning' },
  en_transito: { label: 'En Tránsito', variant: 'warning' },
  recibida: { label: 'Recibida', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'danger' }
};

export const OrdenCompraCard: React.FC<OrdenCompraCardProps> = ({
  orden,
  onCambiarEstado,
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

  // Determinar siguientes acciones posibles
  const getAccionesDisponibles = () => {
    const acciones: Array<{ estado: EstadoOrden; label: string }> = [];
    
    if (orden.estado === 'borrador') {
      acciones.push({ estado: 'enviada', label: 'Marcar como Enviada' });
    } else if (orden.estado === 'enviada') {
      acciones.push({ estado: 'pagada', label: 'Marcar como Pagada' });
    } else if (orden.estado === 'pagada') {
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
        <Badge variant={estadoInfo.variant} size="lg">
          {estadoInfo.label}
        </Badge>
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
            {orden.fechaPagada && (
              <div className="flex justify-between">
                <span className="text-gray-600">Pagada:</span>
                <span className="text-gray-900">{formatDate(orden.fechaPagada)}</span>
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
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">${orden.subtotalUSD.toFixed(2)}</span>
            </div>
            {orden.gastosEnvioUSD && orden.gastosEnvioUSD > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Envío:</span>
                <span>${orden.gastosEnvioUSD.toFixed(2)}</span>
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
      <div className="flex items-center space-x-3 pt-4 border-t">
        {getAccionesDisponibles().map(accion => (
          <Button
            key={accion.estado}
            variant="primary"
            onClick={() => onCambiarEstado?.(accion.estado)}
          >
            {accion.label}
          </Button>
        ))}
        
        {orden.estado === 'en_transito' && !orden.inventarioGenerado && onRecibirOrden && (
          <Button
            variant="success"
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