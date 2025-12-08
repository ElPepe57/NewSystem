import React from 'react';
import { ShoppingCart, User, Calendar, DollarSign, TrendingUp, Package, Truck, MapPin } from 'lucide-react';
import { Badge, Button } from '../../common';
import type { Venta, EstadoVenta } from '../../../types/venta.types';

interface VentaCardProps {
  venta: Venta;
  onConfirmar?: () => void;
  onAsignarInventario?: () => void;
  onMarcarEnEntrega?: () => void;
  onMarcarEntregada?: () => void;
  onCancelar?: () => void;
}

const estadoLabels: Record<EstadoVenta, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  cotizacion: { label: 'Cotización', variant: 'default' },
  confirmada: { label: 'Confirmada', variant: 'info' },
  asignada: { label: 'Asignada', variant: 'warning' },
  en_entrega: { label: 'En Entrega', variant: 'warning' },
  entregada: { label: 'Entregada', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'danger' }
};

export const VentaCard: React.FC<VentaCardProps> = ({
  venta,
  onConfirmar,
  onAsignarInventario,
  onMarcarEnEntrega,
  onMarcarEntregada,
  onCancelar
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

  const estadoInfo = estadoLabels[venta.estado];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <ShoppingCart className="h-8 w-8 text-primary-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{venta.numeroVenta}</h2>
              <p className="text-sm text-gray-600">{venta.nombreCliente}</p>
            </div>
          </div>
        </div>
        <Badge variant={estadoInfo.variant} size="lg">
          {estadoInfo.label}
        </Badge>
      </div>

      {/* Información del Cliente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <User className="h-5 w-5 text-gray-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Cliente</h4>
          </div>
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-600">Nombre:</span> <span className="text-gray-900 ml-2">{venta.nombreCliente}</span></div>
            {venta.dniRuc && <div><span className="text-gray-600">DNI/RUC:</span> <span className="text-gray-900 ml-2">{venta.dniRuc}</span></div>}
            {venta.emailCliente && <div><span className="text-gray-600">Email:</span> <span className="text-gray-900 ml-2">{venta.emailCliente}</span></div>}
            {venta.telefonoCliente && <div><span className="text-gray-600">Teléfono:</span> <span className="text-gray-900 ml-2">{venta.telefonoCliente}</span></div>}
            {venta.direccionEntrega && <div><span className="text-gray-600">Dirección:</span> <span className="text-gray-900 ml-2">{venta.direccionEntrega}</span></div>}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Calendar className="h-5 w-5 text-gray-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Fechas</h4>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Creación:</span>
              <span className="text-gray-900">{formatDate(venta.fechaCreacion)}</span>
            </div>
            {venta.fechaConfirmacion && (
              <div className="flex justify-between">
                <span className="text-gray-600">Confirmación:</span>
                <span className="text-gray-900">{formatDate(venta.fechaConfirmacion)}</span>
              </div>
            )}
            {venta.fechaAsignacion && (
              <div className="flex justify-between">
                <span className="text-gray-600">Asignación:</span>
                <span className="text-gray-900">{formatDate(venta.fechaAsignacion)}</span>
              </div>
            )}
            {venta.fechaEntrega && (
              <div className="flex justify-between">
                <span className="text-gray-600">Entrega:</span>
                <span className="text-gray-900">{formatDate(venta.fechaEntrega)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Totales y Rentabilidad */}
      <div className="bg-primary-50 p-4 rounded-lg">
        <div className="flex items-center mb-2">
          <DollarSign className="h-5 w-5 text-primary-600 mr-2" />
          <h4 className="font-semibold text-gray-900">Totales</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">S/ {venta.subtotalPEN.toFixed(2)}</span>
            </div>
            {venta.descuento && venta.descuento > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Descuento:</span>
                <span className="text-danger-600">- S/ {venta.descuento.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-primary-200 pt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Total:</span>
                <span className="text-xl font-bold text-primary-600">S/ {venta.totalPEN.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          {venta.utilidadBrutaPEN !== undefined && (
            <div className="space-y-2 border-l border-primary-200 pl-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Costo Total:</span>
                <span className="font-semibold">S/ {venta.costoTotalPEN?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Utilidad Bruta:</span>
                <span className={`font-semibold ${venta.utilidadBrutaPEN >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  S/ {venta.utilidadBrutaPEN.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Margen:</span>
                <div className="flex items-center">
                  <TrendingUp className={`h-4 w-4 mr-1 ${venta.margenPromedio! >= 0 ? 'text-success-500' : 'text-danger-500'}`} />
                  <span className={`text-lg font-bold ${venta.margenPromedio! >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {venta.margenPromedio?.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Productos */}
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Productos ({venta.productos.length})</h4>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Producto</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Cant.</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Precio</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
                {venta.estado !== 'cotizacion' && venta.estado !== 'confirmada' && (
                  <>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Costo</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Margen</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {venta.productos.map((producto, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{producto.marca} {producto.nombreComercial}</div>
                    <div className="text-xs text-gray-500">{producto.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">{producto.cantidad}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">S/ {producto.precioUnitario.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">S/ {producto.subtotal.toFixed(2)}</td>
                  {venta.estado !== 'cotizacion' && venta.estado !== 'confirmada' && (
                    <>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {producto.costoTotalUnidades ? `S/ ${producto.costoTotalUnidades.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {producto.margenReal !== undefined ? (
                          <span className={producto.margenReal >= 0 ? 'text-success-600' : 'text-danger-600'}>
                            {producto.margenReal.toFixed(1)}%
                          </span>
                        ) : '-'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observaciones */}
      {venta.observaciones && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">Observaciones</h4>
          <p className="text-sm text-gray-700">{venta.observaciones}</p>
        </div>
      )}

      {/* Acciones */}
      {venta.estado !== 'entregada' && venta.estado !== 'cancelada' && (
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-3">
            {venta.estado === 'cotizacion' && onConfirmar && (
              <Button variant="primary" onClick={onConfirmar}>
                Confirmar Venta
              </Button>
            )}
            
            {venta.estado === 'confirmada' && onAsignarInventario && (
              <Button variant="primary" onClick={onAsignarInventario}>
                <Package className="h-4 w-4 mr-2" />
                Asignar Inventario (FEFO)
              </Button>
            )}
            
            {venta.estado === 'asignada' && onMarcarEnEntrega && (
              <Button variant="primary" onClick={onMarcarEnEntrega}>
                <Truck className="h-4 w-4 mr-2" />
                Marcar en Entrega
              </Button>
            )}
            
            {venta.estado === 'en_entrega' && onMarcarEntregada && (
              <Button variant="success" onClick={onMarcarEntregada}>
                Marcar como Entregada
              </Button>
            )}
          </div>
          
          {onCancelar && (
            <Button variant="danger" onClick={onCancelar}>
              Cancelar Venta
            </Button>
          )}
        </div>
      )}
    </div>
  );
};