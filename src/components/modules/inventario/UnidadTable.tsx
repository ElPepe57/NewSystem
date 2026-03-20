import React from 'react';
import { formatFecha as formatDate } from '../../../utils/dateFormatters';
import { Package, TrendingUp, MapPin, Calendar, Clock } from 'lucide-react';
import { Badge } from '../../common';
import type { Unidad, EstadoUnidad } from '../../../types/unidad.types';
import { getLabelEstadoUnidad, esEstadoEnOrigen, esEstadoEnTransitoOrigen } from '../../../utils/multiOrigen.helpers';

interface UnidadTableProps {
  unidades: Unidad[];
  onViewDetails: (unidad: Unidad) => void;
  loading?: boolean;
}

const getEstadoVariant = (estado: EstadoUnidad): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (esEstadoEnOrigen(estado)) return 'info';
  if (esEstadoEnTransitoOrigen(estado)) return 'warning';
  switch (estado) {
    case 'en_transito_peru': return 'warning';
    case 'disponible_peru': return 'success';
    case 'reservada': return 'warning';
    case 'asignada_pedido': return 'warning';
    case 'vendida': return 'default';
    case 'vencida': return 'danger';
    case 'danada': return 'danger';
    default: return 'default';
  }
};

export const UnidadTable: React.FC<UnidadTableProps> = ({
  unidades,
  onViewDetails,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (unidades.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay unidades</h3>
        <p className="mt-1 text-sm text-gray-500">Comienza recibiendo inventario</p>
      </div>
    );
  }


  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              ID / SKU
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Lote
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Almacén
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              CTRU
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha Recepción
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Vencimiento
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {unidades.map((unidad) => {
            const estadoInfo = {
              label: getLabelEstadoUnidad(unidad.estado, unidad.paisOrigen || unidad.pais),
              variant: getEstadoVariant(unidad.estado)
            };

            return (
              <tr key={unidad.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Package className="h-4 w-4 text-gray-400 mr-2" />
                    <div>
                      <span className="text-sm font-mono font-medium text-gray-900">
                        {unidad.productoSKU}
                      </span>
                      <div className="text-xs text-gray-500">
                        {unidad.id.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{unidad.lote}</div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                    <div>
                      <span className="text-sm text-gray-900">
                        {unidad.almacenNombre}
                      </span>
                      <div className="text-xs text-gray-500">{unidad.pais}</div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={estadoInfo.variant}>
                    {estadoInfo.label}
                  </Badge>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <TrendingUp className="h-4 w-4 text-gray-400 mr-1" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        S/ {(unidad.ctruDinamico || unidad.ctruInicial || 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        ${unidad.costoUnitarioUSD.toFixed(2)} {unidad.tcPago ? `× ${unidad.tcPago.toFixed(3)}` : ''}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                    <span className="text-sm text-gray-900">
                      {formatDate(unidad.fechaRecepcion)}
                    </span>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  {unidad.fechaVencimiento ? (
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-900">
                        {formatDate(unidad.fechaVencimiento)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onViewDetails(unidad)}
                    className="text-primary-600 hover:text-primary-900"
                  >
                    Ver Detalles
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
