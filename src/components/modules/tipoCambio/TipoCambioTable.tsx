import React from 'react';
import { Pencil, Trash2, TrendingUp, TrendingDown, Calendar, AlertTriangle } from 'lucide-react';
import { Badge } from '../../common';
import type { TipoCambio, FuenteTC } from '../../../types/tipoCambio.types';

interface TipoCambioTableProps {
  tiposCambio: TipoCambio[];
  onEdit: (tc: TipoCambio) => void;
  onDelete: (tc: TipoCambio) => void;
  loading?: boolean;
}

const fuenteLabels: Record<FuenteTC, string> = {
  manual: 'Manual',
  api_sunat: 'SUNAT',
  api_sbs: 'SBS',
  api_net: 'APIs.net.pe',
  promedio: 'Promedio'
};

export const TipoCambioTable: React.FC<TipoCambioTableProps> = ({
  tiposCambio,
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

  if (tiposCambio.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay tipos de cambio</h3>
        <p className="mt-1 text-sm text-gray-500">Comienza registrando el TC del día</p>
      </div>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleDateString('es-PE', { 
      weekday: 'short',
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
              Fecha
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Compra
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Venta
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Promedio
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Variación
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fuente
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tiposCambio.map((tc) => {
            const variacionPositiva = tc.variacionCompra !== undefined && tc.variacionCompra > 0;
            const variacionNegativa = tc.variacionCompra !== undefined && tc.variacionCompra < 0;
            
            return (
              <tr key={tc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-900">
                      {formatDate(tc.fecha)}
                    </span>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-mono font-medium text-gray-900">
                    {tc.compra.toFixed(3)}
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-mono font-medium text-gray-900">
                    {tc.venta.toFixed(3)}
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-mono font-semibold text-primary-600">
                    {tc.promedio.toFixed(3)}
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  {tc.variacionCompra !== undefined ? (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center">
                        {variacionPositiva && <TrendingUp className="h-4 w-4 text-success-500 mr-1" />}
                        {variacionNegativa && <TrendingDown className="h-4 w-4 text-danger-500 mr-1" />}
                        <span className={`text-sm font-medium ${
                          variacionPositiva ? 'text-success-600' : 
                          variacionNegativa ? 'text-danger-600' : 
                          'text-gray-600'
                        }`}>
                          {variacionPositiva ? '+' : ''}{tc.variacionCompra.toFixed(2)}%
                        </span>
                      </div>
                      {tc.alertaVariacion && (
                        <AlertTriangle className="h-4 w-4 text-warning-500" title="Variación mayor a 3%" />
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant="info" size="sm">
                    {fuenteLabels[tc.fuente]}
                  </Badge>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onEdit(tc)}
                      className="text-primary-600 hover:text-primary-900"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => onDelete(tc)}
                      className="text-danger-600 hover:text-danger-900"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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