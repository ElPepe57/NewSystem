import React from 'react';
import { formatFecha as formatDate, calcularDiasParaVencer as calcularDiasParaVencerUtil } from '../../../utils/dateFormatters';
import { Modal } from '../../common';
import {
  Package,
  MapPin,
  TrendingUp,
  Calendar,
  Truck,
  Clock,
  History,
  DollarSign,
  AlertTriangle,
  ShoppingCart,
  Unlock
} from 'lucide-react';
import { Badge, Button } from '../../common';
import { useUserName } from '../../../hooks/useUserNames';
import type { Unidad, EstadoUnidad } from '../../../types/unidad.types';
import { getLabelEstadoUnidad, esEstadoEnOrigen, esEstadoEnTransitoOrigen, getPaisEmoji } from '../../../utils/multiOrigen.helpers';

interface UnidadDetailsModalProps {
  unidad: Unidad;
  productoInfo?: { presentacion?: string; contenido?: string; dosaje?: string; sabor?: string };
  onClose: () => void;
  onLiberarReserva?: (unidad: Unidad) => void;
}

const getEstadoVariant = (estado: EstadoUnidad): 'success' | 'info' | 'warning' | 'danger' | 'default' => {
  if (esEstadoEnOrigen(estado)) return 'info';
  if (esEstadoEnTransitoOrigen(estado)) return 'warning';
  switch (estado) {
    case 'en_transito_peru': return 'warning';
    case 'disponible_peru': return 'success';
    case 'reservada': return 'default';
    case 'asignada_pedido': return 'warning';
    case 'vendida': return 'default';
    case 'vencida': return 'danger';
    case 'danada': return 'danger';
    default: return 'default';
  }
};

const tipoMovimientoLabels: Record<string, { label: string; color: string }> = {
  recepcion: { label: 'Recepción', color: 'bg-green-500' },
  transferencia: { label: 'Transferencia', color: 'bg-blue-500' },
  reserva: { label: 'Reserva', color: 'bg-purple-500' },
  venta: { label: 'Venta', color: 'bg-primary-500' },
  ajuste: { label: 'Ajuste', color: 'bg-gray-500' },
  vencimiento: { label: 'Vencimiento', color: 'bg-red-500' },
  daño: { label: 'Daño', color: 'bg-red-500' }
};

export const UnidadDetailsModal: React.FC<UnidadDetailsModalProps> = ({
  unidad,
  productoInfo,
  onClose,
  onLiberarReserva
}) => {
  // Resolver nombres de usuario
  const creadoPorNombre = useUserName(unidad.creadoPor);
  const actualizadoPorNombre = useUserName(unidad.actualizadoPor);

  const formatCurrency = (amount: number, currency: 'USD' | 'PEN' = 'USD'): string => {
    const prefix = currency === 'USD' ? '$' : 'S/';
    return `${prefix}${amount.toFixed(2)}`;
  };

  const diasParaVencer = calcularDiasParaVencerUtil(unidad.fechaVencimiento) ?? 999;
  const estadoInfo = {
    label: getLabelEstadoUnidad(unidad.estado, unidad.paisOrigen || unidad.pais),
    variant: getEstadoVariant(unidad.estado)
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Unidad: ${unidad.lote}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Header con estado */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{unidad.productoSKU}</div>
              <div className="text-sm text-gray-500">{unidad.productoNombre}</div>
              {productoInfo && (productoInfo.presentacion || productoInfo.contenido || productoInfo.dosaje || productoInfo.sabor) && (
                <div className="text-xs text-gray-400">
                  {[productoInfo.presentacion, productoInfo.contenido, productoInfo.dosaje, productoInfo.sabor].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          </div>
          <Badge variant={estadoInfo.variant} size="lg">
            {estadoInfo.label}
          </Badge>
        </div>

        {/* Información General */}
        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Lote</div>
            <div className="font-mono font-medium text-gray-900">{unidad.lote}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Orden de Compra</div>
            <div className="font-medium text-gray-900">{unidad.ordenCompraNumero}</div>
          </div>
        </div>

        {/* Ubicación */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-5 w-5 text-blue-600" />
            <h4 className="font-semibold text-gray-900">Ubicación Actual</h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{getPaisEmoji(unidad.pais)}</span>
            <span className="text-lg font-medium text-gray-900">{unidad.almacenNombre}</span>
          </div>
        </div>

        {/* Costos */}
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold text-gray-900">Información de Costos</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500">Costo USD</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(unidad.costoUnitarioUSD, 'USD')}
              </div>
            </div>
            {unidad.costoFleteUSD !== undefined && unidad.costoFleteUSD > 0 && (
              <div>
                <div className="text-xs text-gray-500">Flete USD</div>
                <div className="text-lg font-bold text-gray-900">
                  {formatCurrency(unidad.costoFleteUSD, 'USD')}
                </div>
              </div>
            )}
            {unidad.ctruDinamico !== undefined && (
              <div>
                <div className="text-xs text-gray-500">CTRU Dinámico</div>
                <div className="text-lg font-bold text-green-600">
                  {formatCurrency(unidad.ctruDinamico, 'PEN')}
                </div>
              </div>
            )}
            {unidad.tcPago !== undefined && (
              <div>
                <div className="text-xs text-gray-500">TC Pago</div>
                <div className="text-lg font-medium text-gray-900">
                  {unidad.tcPago.toFixed(3)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fechas */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-gray-600" />
            <h4 className="font-semibold text-gray-900">Fechas Importantes</h4>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Recepción</div>
              <div className="text-sm font-medium text-gray-900">
                {formatDate(unidad.fechaRecepcion)}
              </div>
            </div>
            <div className={`p-3 rounded-lg ${
              diasParaVencer < 0 ? 'bg-red-50' :
              diasParaVencer <= 30 ? 'bg-amber-50' :
              diasParaVencer <= 90 ? 'bg-yellow-50' :
              'bg-gray-50'
            }`}>
              <div className="text-xs text-gray-500">Vencimiento</div>
              <div className="text-sm font-medium text-gray-900">
                {formatDate(unidad.fechaVencimiento)}
              </div>
              {diasParaVencer !== 999 && (
                <div className={`text-xs mt-1 font-medium ${
                  diasParaVencer < 0 ? 'text-red-600' :
                  diasParaVencer <= 30 ? 'text-amber-600' :
                  diasParaVencer <= 90 ? 'text-yellow-600' :
                  'text-gray-600'
                }`}>
                  {diasParaVencer < 0
                    ? `Vencido hace ${Math.abs(diasParaVencer)} días`
                    : diasParaVencer === 0
                      ? 'Vence hoy'
                      : `${diasParaVencer} días restantes`
                  }
                </div>
              )}
            </div>
            {unidad.fechaVenta && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500">Venta</div>
                <div className="text-sm font-medium text-gray-900">
                  {formatDate(unidad.fechaVenta)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Venta (si aplica) */}
        {unidad.ventaId && (
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
              <h4 className="font-semibold text-gray-900">Información de Venta</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500">Número de Venta</div>
                <div className="font-medium text-gray-900">{unidad.ventaNumero}</div>
              </div>
              {unidad.precioVentaPEN !== undefined && (
                <div>
                  <div className="text-xs text-gray-500">Precio de Venta</div>
                  <div className="font-bold text-purple-600">
                    {formatCurrency(unidad.precioVentaPEN, 'PEN')}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reserva (si aplica) */}
        {unidad.estado === 'reservada' && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h4 className="font-semibold text-gray-900">Unidad Reservada</h4>
                </div>
                {(unidad as any).reservadaPara ? (
                  <div className="text-sm text-gray-600">
                    Reservada para cotización: <span className="font-mono text-xs">{(unidad as any).reservadaPara}</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    Reservada sin cotización asociada
                  </div>
                )}
                {unidad.fechaReserva && (
                  <div className="text-xs text-gray-500 mt-1">
                    Desde: {formatDate(unidad.fechaReserva)}
                  </div>
                )}
              </div>
              {onLiberarReserva && (
                <Button
                  variant="warning"
                  size="sm"
                  onClick={() => onLiberarReserva(unidad)}
                >
                  <Unlock className="h-4 w-4 mr-1" />
                  Liberar Reserva
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Historial de Movimientos */}
        {unidad.movimientos && unidad.movimientos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="h-5 w-5 text-gray-600" />
              <h4 className="font-semibold text-gray-900">
                Historial de Movimientos ({unidad.movimientos.length})
              </h4>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {unidad.movimientos.map((movimiento, index) => {
                const tipoInfo = tipoMovimientoLabels[movimiento.tipo] || {
                  label: movimiento.tipo,
                  color: 'bg-gray-500'
                };

                return (
                  <div
                    key={movimiento.id || index}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 ${tipoInfo.color}`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{tipoInfo.label}</span>
                        <span className="text-xs text-gray-500">
                          {formatDate(movimiento.fecha)}
                        </span>
                      </div>
                      {movimiento.observaciones && (
                        <div className="text-sm text-gray-600 mt-1">
                          {movimiento.observaciones}
                        </div>
                      )}
                      {movimiento.documentoRelacionado && (
                        <div className="text-xs text-gray-500 mt-1">
                          Ref: {movimiento.documentoRelacionado.numero}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Auditoría */}
        <div className="text-xs text-gray-400 pt-4 border-t">
          <div>Creado: {formatDate(unidad.fechaCreacion)} por {creadoPorNombre}</div>
          {unidad.fechaActualizacion && (
            <div>
              Última actualización: {formatDate(unidad.fechaActualizacion)} por {actualizadoPorNombre}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
