import React from 'react';
import { Pagination, usePagination } from '../../common';
import type { InventarioValorizado } from '../../../types/reporte.types';

interface InventarioValorizadoTableProps {
  inventario: InventarioValorizado[];
}

export const InventarioValorizadoTable: React.FC<InventarioValorizadoTableProps> = ({ inventario }) => {
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    setPage,
    setItemsPerPage,
    paginatedItems: inventarioPaginado
  } = usePagination({
    items: inventario,
    initialItemsPerPage: 10
  });

  if (inventario.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay inventario disponible
      </div>
    );
  }

  return (
    <div>
      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-2">
        {inventarioPaginado.map((item) => (
          <div key={item.productoId} className="border border-gray-100 rounded-lg p-2.5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {item.marca} {item.nombreComercial}
                </div>
                <div className="text-[10px] text-gray-400">{item.sku}</div>
              </div>
              <div className="text-xs font-bold text-primary-600 shrink-0">
                S/ {item.valorTotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Unidades */}
              <div className="grid grid-cols-3 gap-1.5 flex-1 text-[10px]">
                <div>
                  <span className="text-gray-400">Disp.</span>
                  <div className="font-semibold text-success-600">{item.unidadesDisponibles}</div>
                </div>
                <div>
                  <span className="text-gray-400">Asig.</span>
                  <div className="font-semibold text-warning-600">{item.unidadesAsignadas}</div>
                </div>
                <div>
                  <span className="text-gray-400">Total</span>
                  <div className="font-semibold text-gray-900">{item.unidadesTotal}</div>
                </div>
              </div>
              {/* Ubicación badges - genérico por país */}
              <div className="flex items-center gap-1 shrink-0">
                {item.unidadesPorPais ? (
                  Object.entries(item.unidadesPorPais).filter(([, v]) => v > 0).map(([pais, cantidad]) => (
                    <span key={pais} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      pais === 'Peru' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {pais === 'Peru' ? 'PE' : pais === 'USA' ? 'US' : pais.substring(0, 3).toUpperCase()}:{cantidad}
                    </span>
                  ))
                ) : (
                  <>
                    {(item.unidadesMiami ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-medium">
                        Origen:{item.unidadesMiami}
                      </span>
                    )}
                    {(item.unidadesPeru ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-medium">
                        Destino:{item.unidadesPeru}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden sm:block overflow-x-auto">
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
            {inventarioPaginado.map((item) => (
              <tr key={item.productoId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">
                    {item.marca} {item.nombreComercial}
                  </div>
                  <div className="text-xs text-gray-500">{item.sku}</div>
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
                    {item.unidadesPorPais ? (
                      Object.entries(item.unidadesPorPais).filter(([, v]) => v > 0).map(([pais, cantidad]) => (
                        <span key={pais} className={`px-2 py-1 rounded ${
                          pais === 'Peru' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {pais}: {cantidad}
                        </span>
                      ))
                    ) : (
                      <>
                        {(item.unidadesMiami ?? 0) > 0 && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            Origen: {item.unidadesMiami}
                          </span>
                        )}
                        {(item.unidadesPeru ?? 0) > 0 && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                            Destino: {item.unidadesPeru}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {inventario.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={inventario.length}
          pageSize={itemsPerPage}
          onPageChange={setPage}
          onPageSizeChange={setItemsPerPage}
        />
      )}
    </div>
  );
};
