import React from 'react';
import { Package, TrendingUp, MapPin, Calendar, Clock } from 'lucide-react';
import { Badge } from '../../common';
import type { Unidad, EstadoUnidad } from '../../../types/unidad.types';

interface UnidadTableProps {
  unidades: Unidad[];
  onViewDetails: (unidad: Unidad) => void;
  loading?: boolean;
}

const estadoLabels: Record<EstadoUnidad, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  recibida_usa: { label: 'Recibida USA', variant: 'info' },
  en_transito_usa: { label: 'En Tránsito USA', variant: 'warning' },
  en_transito_peru: { label: 'En Tránsito a Perú', variant: 'warning' },
  disponible_peru: { label: 'Disponible', variant: 'success' },
  reservada: { label: 'Reservada', variant: 'warning' },
  asignada_pedido: { label: 'Asignada a Pedido', variant: 'warning' },
  vendida: { label: 'Vendida', variant: 'default' },
  vencida: { label: 'Vencida', variant: 'danger' },
  danada: { label: 'Dañada', variant: 'danger' }
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

  const formatDate = (timestamp: unknown) => {
    if (!timestamp) return '-';
    // Handle Firestore Timestamp
    const ts = timestamp as { toDate?: () => Date };
    if (ts.toDate) {
      const date = ts.toDate();
      return date.toLocaleDateString('es-PE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    return '-';
  };

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
            const estadoInfo = estadoLabels[unidad.estado] || { label: unidad.estado, variant: 'default' as const };

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
