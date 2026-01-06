import React from 'react';
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
  ShoppingCart
} from 'lucide-react';
import { Badge } from '../../common';
import { useUserName } from '../../../hooks/useUserNames';
import type { Unidad, EstadoUnidad } from '../../../types/unidad.types';

interface UnidadDetailsModalProps {
  unidad: Unidad;
  onClose: () => void;
}

const estadoConfig: Record<EstadoUnidad, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'default' }> = {
  'recibida_usa': { label: 'Recibida USA', variant: 'info' },
  'en_transito_usa': { label: 'En Tránsito USA', variant: 'warning' },
  'en_transito_peru': { label: 'En Tránsito → Perú', variant: 'warning' },
  'disponible_peru': { label: 'Disponible Perú', variant: 'success' },
  'reservada': { label: 'Reservada', variant: 'default' },
  'vendida': { label: 'Vendida', variant: 'default' },
  'vencida': { label: 'Vencida', variant: 'danger' },
  'danada': { label: 'Dañada', variant: 'danger' }
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
  onClose
}) => {
  // Resolver nombres de usuario
  const creadoPorNombre = useUserName(unidad.creadoPor);
  const actualizadoPorNombre = useUserName(unidad.actualizadoPor);

  const formatDate = (timestamp: any): string => {
    if (!timestamp || !timestamp.toDate) return '-';
    return timestamp.toDate().toLocaleString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number, currency: 'USD' | 'PEN' = 'USD'): string => {
    const prefix = currency === 'USD' ? '$' : 'S/';
    return `${prefix}${amount.toFixed(2)}`;
  };

  // Calcular días para vencer
  const calcularDiasParaVencer = (): number => {
    if (!unidad.fechaVencimiento || !unidad.fechaVencimiento.toDate) return 999;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencimiento = unidad.fechaVencimiento.toDate();
    vencimiento.setHours(0, 0, 0, 0);
    const diffTime = vencimiento.getTime() - hoy.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const diasParaVencer = calcularDiasParaVencer();
  const estadoInfo = estadoConfig[unidad.estado] || { label: unidad.estado, variant: 'default' as const };

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
            <span className="text-lg">{unidad.pais === 'USA' ? '🇺🇸' : '🇵🇪'}</span>
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
