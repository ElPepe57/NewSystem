import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Pagination, usePagination } from '../../common';
import { DataTable } from '../../../design-system';
import type { DataTableColumn } from '../../../design-system';
import type { ProductoRentabilidad } from '../../../types/reporte.types';

interface ProductosRentabilidadTableProps {
  productos: ProductoRentabilidad[];
}

export const ProductosRentabilidadTable: React.FC<ProductosRentabilidadTableProps> = ({ productos }) => {
  const {
    currentPage,
    itemsPerPage,
    setPage,
    setItemsPerPage,
    paginatedItems: productosPaginados
  } = usePagination({
    items: productos,
    initialItemsPerPage: 10
  });

  if (productos.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No hay datos de ventas para mostrar
      </div>
    );
  }

  const columns: DataTableColumn<ProductoRentabilidad>[] = [
    {
      key: 'producto',
      header: 'Producto',
      render: (item) => (
        <div>
          <div className="text-sm font-medium text-slate-900">
            {item.marca} {item.nombreComercial}
          </div>
          <div className="text-xs text-slate-500">{item.sku}</div>
        </div>
      ),
    },
    {
      key: 'unidades',
      header: 'Unidades',
      align: 'right',
      render: (item) => (
        <span className="text-sm text-slate-900">{item.unidadesVendidas}</span>
      ),
    },
    {
      key: 'ventas',
      header: 'Ventas',
      align: 'right',
      render: (item) => (
        <span className="text-sm font-semibold text-slate-900">
          S/ {item.ventasTotalPEN.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'costo',
      header: 'Costo',
      align: 'right',
      hideOnMobile: true,
      render: (item) => (
        <span className="text-sm text-slate-600">
          S/ {item.costoTotalPEN.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'utilidad',
      header: 'Utilidad',
      align: 'right',
      render: (item) => (
        <span className="text-sm font-semibold text-emerald-600">
          S/ {item.utilidadPEN.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'margen',
      header: 'Margen',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end">
          {item.margenPromedio >= 0 ? (
            <TrendingUp className="h-4 w-4 text-emerald-500 mr-1" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
          )}
          <span className={`text-sm font-medium ${
            item.margenPromedio >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {item.margenPromedio.toFixed(1)}%
          </span>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-2">
        {productosPaginados.map((producto) => (
          <div key={producto.productoId} className="border border-slate-100 rounded-lg p-2.5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-900 truncate">
                  {producto.marca} {producto.nombreComercial}
                </div>
                <div className="text-[10px] text-slate-400">{producto.sku}</div>
              </div>
              <div className="flex items-center shrink-0">
                {producto.margenPromedio >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500 mr-0.5" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500 mr-0.5" />
                )}
                <span className={`text-xs font-bold ${
                  producto.margenPromedio >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {producto.margenPromedio.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <div>
                <span className="text-slate-400">Uds</span>
                <div className="font-semibold text-slate-900">{producto.unidadesVendidas}</div>
              </div>
              <div>
                <span className="text-slate-400">Ventas</span>
                <div className="font-semibold text-slate-900">S/ {producto.ventasTotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <span className="text-slate-400">Utilidad</span>
                <div className="font-semibold text-emerald-600">S/ {producto.utilidadPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: DataTable */}
      <div className="hidden sm:block">
        <DataTable<ProductoRentabilidad>
          columns={columns}
          data={productosPaginados}
          keyExtractor={(item) => item.productoId}
        />
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
