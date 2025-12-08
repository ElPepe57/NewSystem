import React from 'react';
import { Modal } from '../../common';
import { Package, MapPin, TrendingUp, Calendar, Truck, Clock, History } from 'lucide-react';
import type { Unidad, Almacen } from '../../../types/producto.types';

interface UnidadDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  unidad: Unidad | null;
}

const almacenLabels: Record<Almacen, string> = {
  miami_1: 'Miami 1',
  miami_2: 'Miami 2',
  utah: 'Utah',
  peru_principal: 'Perú Principal',
  peru_secundario: 'Perú Secundario'
};

const tipoMovimientoLabels: Record<string, string> = {
  recepcion: 'Recepción',
  traslado: 'Traslado',
  asignacion: 'Asignación',
  entrega: 'Entrega',
  devolucion: 'Devolución',
  ajuste: 'Ajuste'
};

export const UnidadDetailsModal: React.FC<UnidadDetailsModalProps> = ({
  isOpen,
  onClose,
  unidad
}) => {
  if (!unidad) return null;

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalles de ${unidad.codigoUnidad}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Información General */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">SKU</div>
            <div className="text-lg font-semibold text-gray-900">{unidad.sku}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Código Unidad</div>
            <div className="text-lg font-mono font-semibold text-gray-900">{unidad.codigoUnidad}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Lote</div>
            <div className="text-base text-gray-900">{unidad.lote}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Estado Actual</div>
            <div className="text-base font-medium text-gray-900 capitalize">{unidad.estado.replace(/_/g, ' ')}</div>
          </div>
        </div>

        {/* Ubicación */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <MapPin className="h-5 w-5 text-gray-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Ubicación</h4>
          </div>
          <div className="text-lg text-gray-900">{almacenLabels[unidad.almacenActual]}</div>
        </div>

        {/* Costos */}
        <div className="bg-primary-50 p-4 rounded-lg">
          <div className="flex items-center mb-3">
            <TrendingUp className="h-5 w-5 text-primary-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Costos</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Costo USA</div>
              <div className="text-xl font-bold text-gray-900">${unidad.costoUSA.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">CTRU Dinámico</div>
              <div className="text-xl font-bold text-primary-600">S/ {unidad.ctruDinamico.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">TC Compra</div>
              <div className="text-base text-gray-900">{unidad.tcCompra.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">TC Pago</div>
              <div className="text-base text-gray-900">{unidad.tcPago.toFixed(3)}</div>
            </div>
          </div>
        </div>

        {/* Fechas */}
        <div>
          <div className="flex items-center mb-3">
            <Calendar className="h-5 w-5 text-gray-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Fechas Importantes</h4>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Origen:</span>
              <span className="ml-2 text-gray-900">{formatDate(unidad.fechaOrigen)}</span>
            </div>
            {unidad.fechaRecepcionUSA && (
              <div>
                <span className="text-gray-600">Recepción USA:</span>
                <span className="ml-2 text-gray-900">{formatDate(unidad.fechaRecepcionUSA)}</span>
              </div>
            )}
            {unidad.fechaLlegadaPeru && (
              <div>
                <span className="text-gray-600">Llegada Perú:</span>
                <span className="ml-2 text-gray-900">{formatDate(unidad.fechaLlegadaPeru)}</span>
              </div>
            )}
            {unidad.fechaVencimiento && (
              <div>
                <span className="text-gray-600">Vencimiento:</span>
                <span className="ml-2 text-gray-900">{formatDate(unidad.fechaVencimiento)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tracking */}
        {unidad.numeroTracking && (
          <div>
            <div className="flex items-center mb-3">
              <Truck className="h-5 w-5 text-gray-600 mr-2" />
              <h4 className="font-semibold text-gray-900">Tracking</h4>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Número:</span>
                <span className="ml-2 font-mono text-gray-900">{unidad.numeroTracking}</span>
              </div>
              {unidad.courier && (
                <div>
                  <span className="text-gray-600">Courier:</span>
                  <span className="ml-2 text-gray-900">{unidad.courier}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Historial */}
        <div>
          <div className="flex items-center mb-3">
            <History className="h-5 w-5 text-gray-600 mr-2" />
            <h4 className="font-semibold text-gray-900">Historial de Movimientos</h4>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {unidad.historial.map((movimiento, index) => (
              <div key={index} className="border-l-4 border-primary-500 pl-4 py-2 bg-gray-50 rounded-r">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">
                    {tipoMovimientoLabels[movimiento.tipo]}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(movimiento.fecha)}
                  </span>
                </div>
                <div className="text-sm text-gray-700">{movimiento.motivo}</div>
                {movimiento.observaciones && (
                  <div className="text-xs text-gray-500 mt-1">{movimiento.observaciones}</div>
                )}
                {movimiento.almacenOrigen && movimiento.almacenDestino && (
                  <div className="text-xs text-gray-600 mt-1">
                    {almacenLabels[movimiento.almacenOrigen]} → {almacenLabels[movimiento.almacenDestino]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};