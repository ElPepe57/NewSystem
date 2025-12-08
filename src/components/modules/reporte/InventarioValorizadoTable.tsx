import React from 'react';
import { Package } from 'lucide-react';
import type { InventarioValorizado } from '../../../types/reporte.types';

interface InventarioValorizadoTableProps {
  inventario: InventarioValorizado[];
}

export const InventarioValorizadoTable: React.FC<InventarioValorizadoTableProps> = ({ inventario }) => {
  if (inventario.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay inventario disponible
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Producto
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Disponibles
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Asignadas
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Total
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Costo Prom.
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Valor Total
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
              Ubicación
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {inventario.map((item) => (
            <tr key={item.productoId} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center">
                  <Package className="h-4 w-4 text-gray-400 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {item.marca} {item.nombreComercial}
                    </div>
                    <div className="text-xs text-gray-500">{item.sku}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-success-600">
                {item.unidadesDisponibles}
              </td>
              <td className="px-4 py-3 text-right text-sm text-warning-600">
                {item.unidadesAsignadas}
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                {item.unidadesTotal}
              </td>
              <td className="px-4 py-3 text-right text-sm text-gray-600">
                S/ {item.costoPromedioUnidad.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-primary-600">
                S/ {item.valorTotalPEN.toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center space-x-2 text-xs">
                  {item.unidadesMiami > 0 && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      M: {item.unidadesMiami}
                    </span>
                  )}
                  {item.unidadesUtah > 0 && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                      U: {item.unidadesUtah}
                    </span>
                  )}
                  {item.unidadesPeru > 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                      P: {item.unidadesPeru}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};