import React, { useMemo, useState } from 'react';
import {
  Package,
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Badge } from '../../common';
import type { Unidad, EstadoUnidad } from '../../../types/unidad.types';

interface UnidadesDesgloseProps {
  unidades: Unidad[];
  productoNombre: string;
  onUnidadClick?: (unidad: Unidad) => void;
}

const estadoConfig: Record<EstadoUnidad, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' | 'default'; color: string }> = {
  'recibida_usa': { label: 'Recibida USA', variant: 'info', color: 'bg-blue-100 text-blue-800' },
  'en_transito_usa': { label: 'Tránsito USA', variant: 'warning', color: 'bg-amber-100 text-amber-800' },
  'en_transito_peru': { label: 'Tránsito Perú', variant: 'warning', color: 'bg-amber-100 text-amber-800' },
  'disponible_peru': { label: 'Disponible', variant: 'success', color: 'bg-green-100 text-green-800' },
  'reservada': { label: 'Reservada', variant: 'default', color: 'bg-purple-100 text-purple-800' },
  'vendida': { label: 'Vendida', variant: 'default', color: 'bg-gray-100 text-gray-800' },
  'vencida': { label: 'Vencida', variant: 'danger', color: 'bg-red-100 text-red-800' },
  'danada': { label: 'Dañada', variant: 'danger', color: 'bg-red-100 text-red-800' }
};

export const UnidadesDesglose: React.FC<UnidadesDesgloseProps> = ({
  unidades,
  productoNombre,
  onUnidadClick
}) => {
  const [vistaAgrupada, setVistaAgrupada] = useState(true);

  // Agrupar unidades por estado y almacén
  const unidadesAgrupadas = useMemo(() => {
    const grupos: Record<string, {
      estado: EstadoUnidad;
      almacenId: string;
      almacenNombre: string;
      pais: 'USA' | 'Peru';
      unidades: Unidad[];
      valorTotal: number;
    }> = {};

    unidades.forEach(unidad => {
      const key = `${unidad.estado}-${unidad.almacenId}`;
      if (!grupos[key]) {
        grupos[key] = {
          estado: unidad.estado,
          almacenId: unidad.almacenId,
          almacenNombre: unidad.almacenNombre,
          pais: unidad.pais,
          unidades: [],
          valorTotal: 0
        };
      }
      grupos[key].unidades.push(unidad);
      grupos[key].valorTotal += unidad.costoUnitarioUSD;
    });

    // Ordenar por estado (primero disponibles)
    const ordenEstados: EstadoUnidad[] = [
      'disponible_peru', 'recibida_usa', 'en_transito_peru', 'en_transito_usa',
      'reservada', 'vendida', 'vencida', 'danada'
    ];

    return Object.values(grupos).sort((a, b) => {
      return ordenEstados.indexOf(a.estado) - ordenEstados.indexOf(b.estado);
    });
  }, [unidades]);

  // Calcular días para vencer
  const calcularDiasParaVencer = (fecha: any): number => {
    if (!fecha || !fecha.toDate) return 999;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencimiento = fecha.toDate();
    vencimiento.setHours(0, 0, 0, 0);
    const diffTime = vencimiento.getTime() - hoy.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getColorVencimiento = (dias: number): string => {
    if (dias < 0) return 'text-red-600 bg-red-50';
    if (dias <= 30) return 'text-amber-600 bg-amber-50';
    if (dias <= 90) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const formatFecha = (timestamp: any): string => {
    if (!timestamp || !timestamp.toDate) return '-';
    return timestamp.toDate().toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (unidades.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-gray-500">
        <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm">No hay unidades que mostrar para este filtro</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      {/* Header del desglose */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {unidades.length} unidades de {productoNombre}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVistaAgrupada(true)}
            className={`text-xs px-2 py-1 rounded ${
              vistaAgrupada
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Agrupada
          </button>
          <button
            onClick={() => setVistaAgrupada(false)}
            className={`text-xs px-2 py-1 rounded ${
              !vistaAgrupada
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Detallada
          </button>
        </div>
      </div>

      {vistaAgrupada ? (
        /* Vista agrupada por estado/almacén */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {unidadesAgrupadas.map((grupo) => {
            const config = estadoConfig[grupo.estado] || estadoConfig['vendida'];

            return (
              <div
                key={`${grupo.estado}-${grupo.almacenId}`}
                className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={config.variant} size="sm">
                    {config.label}
                  </Badge>
                  <span className="text-lg font-bold text-gray-900">
                    {grupo.unidades.length}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                  <MapPin className="h-3 w-3" />
                  <span>{grupo.pais === 'USA' ? '🇺🇸' : '🇵🇪'} {grupo.almacenNombre}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Valor total:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(grupo.valorTotal)}
                  </span>
                </div>

                {/* Mini lista de lotes */}
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">Lotes:</div>
                  <div className="flex flex-wrap gap-1">
                    {[...new Set(grupo.unidades.map(u => u.lote))].slice(0, 3).map(lote => (
                      <span
                        key={lote}
                        className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                      >
                        {lote}
                      </span>
                    ))}
                    {[...new Set(grupo.unidades.map(u => u.lote))].length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{[...new Set(grupo.unidades.map(u => u.lote))].length - 3} más
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista detallada - tabla de unidades individuales */
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Lote
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Almacén
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Vencimiento
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Costo USD
                  </th>
                  {onUnidadClick && (
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Acción
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unidades
                  .sort((a, b) => {
                    // Ordenar por fecha de vencimiento (FEFO)
                    const fechaA = a.fechaVencimiento?.toDate?.()?.getTime() || Infinity;
                    const fechaB = b.fechaVencimiento?.toDate?.()?.getTime() || Infinity;
                    return fechaA - fechaB;
                  })
                  .map((unidad, idx) => {
                    const config = estadoConfig[unidad.estado] || estadoConfig['vendida'];
                    const diasVencer = calcularDiasParaVencer(unidad.fechaVencimiento);
                    const colorVencimiento = getColorVencimiento(diasVencer);

                    return (
                      <tr
                        key={unidad.id}
                        className={`hover:bg-gray-50 ${onUnidadClick ? 'cursor-pointer' : ''}`}
                        onClick={() => onUnidadClick?.(unidad)}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">#{idx + 1}</span>
                            <span className="text-sm font-mono text-gray-900">
                              {unidad.lote}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${config.color}`}>
                            {config.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <span>{unidad.pais === 'USA' ? '🇺🇸' : '🇵🇪'}</span>
                            <span className="truncate max-w-[100px]">{unidad.almacenNombre}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-900">
                              {formatFecha(unidad.fechaVencimiento)}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded w-fit ${colorVencimiento}`}>
                              {diasVencer < 0
                                ? `Vencido hace ${Math.abs(diasVencer)}d`
                                : diasVencer === 0
                                  ? 'Vence hoy'
                                  : `${diasVencer}d restantes`
                              }
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(unidad.costoUnitarioUSD)}
                          </span>
                        </td>
                        {onUnidadClick && (
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnidadClick(unidad);
                              }}
                              className="p-1 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
