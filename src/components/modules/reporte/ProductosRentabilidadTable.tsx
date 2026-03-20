import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Pagination, usePagination } from '../../common';
import type { ProductoRentabilidad } from '../../../types/reporte.types';

interface ProductosRentabilidadTableProps {
  productos: ProductoRentabilidad[];
}

export const ProductosRentabilidadTable: React.FC<ProductosRentabilidadTableProps> = ({ productos }) => {
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    setPage,
    setItemsPerPage,
    paginatedItems: productosPaginados
  } = usePagination({
    items: productos,
    initialItemsPerPage: 10
  });

  if (productos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay datos de ventas para mostrar
      </div>
    );
  }

  return (
    <div>
      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-2">
        {productosPaginados.map((producto) => (
          <div key={producto.productoId} className="border border-gray-100 rounded-lg p-2.5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {producto.marca} {producto.nombreComercial}
                </div>
                <div className="text-[10px] text-gray-400">{producto.sku}</div>
              </div>
              <div className="flex items-center shrink-0">
                {producto.margenPromedio >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-success-500 mr-0.5" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-danger-500 mr-0.5" />
                )}
                <span className={`text-xs font-bold ${
                  producto.margenPromedio >= 0 ? 'text-success-600' : 'text-danger-600'
                }`}>
                  {producto.margenPromedio.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <div>
                <span className="text-gray-400">Uds</span>
                <div className="font-semibold text-gray-900">{producto.unidadesVendidas}</div>
              </div>
              <div>
                <span className="text-gray-400">Ventas</span>
                <div className="font-semibold text-gray-900">S/ {producto.ventasTotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <span className="text-gray-400">Utilidad</span>
                <div className="font-semibold text-success-600">S/ {producto.utilidadPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
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
                Unidades
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Ventas
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Costo
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Utilidad
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Margen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {productosPaginados.map((producto) => (
              <tr key={producto.productoId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">
                    {producto.marca} {producto.nombreComercial}
                  </div>
                  <div className="text-xs text-gray-500">{producto.sku}</div>
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">
                  {producto.unidadesVendidas}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  S/ {producto.ventasTotalPEN.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  S/ {producto.costoTotalPEN.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-success-600">
                  S/ {producto.utilidadPEN.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end">
                    {producto.margenPromedio >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-success-500 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-danger-500 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${
                      producto.margenPromedio >= 0 ? 'text-success-600' : 'text-danger-600'
                    }`}>
                      {producto.margenPromedio.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {productos.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={productos.length}
          pageSize={itemsPerPage}
          onPageChange={setPage}
          onPageSizeChange={setItemsPerPage}
        />
      )}
    </div>
  );
};
