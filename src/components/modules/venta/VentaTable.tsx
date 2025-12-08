import React from 'react';
import { ShoppingCart, Eye, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '../../common';
import type { Venta, EstadoVenta, CanalVenta } from '../../../types/venta.types';

interface VentaTableProps {
  ventas: Venta[];
  onView: (venta: Venta) => void;
  onDelete?: (venta: Venta) => void;
  loading?: boolean;
}

const estadoLabels: Record<EstadoVenta, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  cotizacion: { label: 'Cotización', variant: 'default' },
  confirmada: { label: 'Confirmada', variant: 'info' },
  asignada: { label: 'Asignada', variant: 'warning' },
  en_entrega: { label: 'En Entrega', variant: 'warning' },
  entregada: { label: 'Entregada', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'danger' }
};

const canalLabels: Record<CanalVenta, string> = {
  mercado_libre: 'ML',
  directo: 'Directo',
  otro: 'Otro'
};

export const VentaTable: React.FC<VentaTableProps> = ({
  ventas,
  onView,
  onDelete,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (ventas.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay ventas</h3>
        <p className="mt-1 text-sm text-gray-500">Comienza creando tu primera venta o cotización</p>
      </div>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleDateString('es-PE', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Número
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cliente
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Canal
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Productos
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Margen
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {ventas.map((venta) => {
            const estadoInfo = estadoLabels[venta.estado];
            const margenPositivo = venta.margenPromedio !== undefined && venta.margenPromedio > 0;
            
            return (
              <tr key={venta.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <ShoppingCart className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-mono font-medium text-gray-900">
                      {venta.numeroVenta}
                    </span>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{venta.nombreCliente}</div>
                  {venta.dniRuc && (
                    <div className="text-xs text-gray-500">{venta.dniRuc}</div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant="info" size="sm">
                    {canalLabels[venta.canal]}
                  </Badge>
                </td>
                
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {venta.productos.length} {venta.productos.length === 1 ? 'producto' : 'productos'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {venta.productos.slice(0, 2).map(p => p.marca).join(', ')}
                    {venta.productos.length > 2 && '...'}
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    S/ {venta.totalPEN.toFixed(2)}
                  </div>
                  {venta.utilidadBrutaPEN !== undefined && (
                    <div className={`text-xs ${venta.utilidadBrutaPEN >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      Util: S/ {venta.utilidadBrutaPEN.toFixed(2)}
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  {venta.margenPromedio !== undefined ? (
                    <div className="flex items-center">
                      {margenPositivo ? (
                        <TrendingUp className="h-4 w-4 text-success-500 mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-danger-500 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${
                        margenPositivo ? 'text-success-600' : 'text-danger-600'
                      }`}>
                        {venta.margenPromedio.toFixed(1)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={estadoInfo.variant}>
                    {estadoInfo.label}
                  </Badge>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {formatDate(venta.fechaCreacion)}
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onView(venta)}
                      className="text-primary-600 hover:text-primary-900"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    
                    {venta.estado === 'cotizacion' && onDelete && (
                      <button
                        onClick={() => onDelete(venta)}
                        className="text-danger-600 hover:text-danger-900"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};