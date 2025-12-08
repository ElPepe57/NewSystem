import React from 'react';
import { Package, Eye, Pencil, Trash2, TrendingUp, AlertCircle } from 'lucide-react';
import { Badge } from '../../common';
import type { OrdenCompra, EstadoOrden } from '../../../types/ordenCompra.types';

interface OrdenCompraTableProps {
  ordenes: OrdenCompra[];
  onView: (orden: OrdenCompra) => void;
  onEdit?: (orden: OrdenCompra) => void;
  onDelete?: (orden: OrdenCompra) => void;
  loading?: boolean;
}

const estadoLabels: Record<EstadoOrden, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
  borrador: { label: 'Borrador', variant: 'default' },
  enviada: { label: 'Enviada', variant: 'info' },
  pagada: { label: 'Pagada', variant: 'warning' },
  en_transito: { label: 'En Tránsito', variant: 'warning' },
  recibida: { label: 'Recibida', variant: 'success' },
  cancelada: { label: 'Cancelada', variant: 'danger' }
};

export const OrdenCompraTable: React.FC<OrdenCompraTableProps> = ({
  ordenes,
  onView,
  onEdit,
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

  if (ordenes.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay órdenes de compra</h3>
        <p className="mt-1 text-sm text-gray-500">Comienza creando tu primera orden</p>
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
              Número Orden
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Proveedor
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Productos
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha Creación
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {ordenes.map((orden) => {
            const estadoInfo = estadoLabels[orden.estado];
            
            return (
              <tr key={orden.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Package className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-mono font-medium text-gray-900">
                      {orden.numeroOrden}
                    </span>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{orden.nombreProveedor}</div>
                </td>
                
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {orden.productos.length} {orden.productos.length === 1 ? 'producto' : 'productos'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {orden.productos.slice(0, 2).map(p => p.marca).join(', ')}
                    {orden.productos.length > 2 && '...'}
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    ${orden.totalUSD.toFixed(2)}
                  </div>
                  {orden.totalPEN && (
                    <div className="text-xs text-gray-500">
                      S/ {orden.totalPEN.toFixed(2)}
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={estadoInfo.variant}>
                    {estadoInfo.label}
                  </Badge>
                  {orden.diferenciaCambiaria && Math.abs(orden.diferenciaCambiaria) > 0 && (
                    <div className="flex items-center mt-1">
                      <TrendingUp className="h-3 w-3 text-warning-500 mr-1" />
                      <span className="text-xs text-warning-600">
                        Dif. FX
                      </span>
                    </div>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {formatDate(orden.fechaCreacion)}
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onView(orden)}
                      className="text-primary-600 hover:text-primary-900"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    
                    {orden.estado === 'borrador' && onEdit && (
                      <button
                        onClick={() => onEdit(orden)}
                        className="text-gray-600 hover:text-gray-900"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    
                    {orden.estado === 'borrador' && onDelete && (
                      <button
                        onClick={() => onDelete(orden)}
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