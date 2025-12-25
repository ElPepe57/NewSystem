import React from 'react';
import { Badge } from '../../common';
import type { TipoCambio } from '../../../types/tipoCambio.types';

interface TipoCambioTableProps {
  tiposCambio: TipoCambio[];
}

export const TipoCambioTable: React.FC<TipoCambioTableProps> = ({ tiposCambio }) => {
  if (tiposCambio.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No hay tipos de cambio registrados</p>
      </div>
    );
  }

  const getFuenteBadge = (fuente: string) => {
    switch (fuente) {
      case 'sunat':
        return <Badge variant="success">SUNAT</Badge>;
      case 'bcrp':
        return <Badge variant="info">BCRP</Badge>;
      default:
        return <Badge variant="default">Manual</Badge>;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Fecha
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              TC Compra
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              TC Venta
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Promedio
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Fuente
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tiposCambio.map((tc) => {
            const promedio = ((tc.compra + tc.venta) / 2).toFixed(3);
            const fecha = tc.fecha?.toDate?.()?.toLocaleDateString('es-PE', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }) || '-';

            return (
              <tr key={tc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{fecha}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    S/ {tc.compra.toFixed(3)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-semibold text-gray-900">
                    S/ {tc.venta.toFixed(3)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-semibold text-primary-600">
                    S/ {promedio}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getFuenteBadge(tc.fuente)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
