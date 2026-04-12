import React from 'react';
import { Pagination, usePagination } from '../../common';
import { DataTable } from '../../../design-system';
import type { DataTableColumn } from '../../../design-system';
import type { InventarioValorizado } from '../../../types/reporte.types';

interface InventarioValorizadoTableProps {
  inventario: InventarioValorizado[];
}

export const InventarioValorizadoTable: React.FC<InventarioValorizadoTableProps> = ({ inventario }) => {
  const {
    currentPage,
    itemsPerPage,
    setPage,
    setItemsPerPage,
    paginatedItems: inventarioPaginado
  } = usePagination({
    items: inventario,
    initialItemsPerPage: 10
  });

  if (inventario.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No hay inventario disponible
      </div>
    );
  }

  const UbicacionCell = ({ item }: { item: InventarioValorizado }) => {
    if (item.unidadesPorPais) {
      return (
        <div className="flex items-center justify-center space-x-2 text-xs">
          {Object.entries(item.unidadesPorPais)
            .filter(([, v]) => v > 0)
            .map(([pais, cantidad]) => (
              <span
                key={pais}
                className={`px-2 py-1 rounded ${
                  pais === 'Peru' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                }`}
              >
                {pais}: {cantidad}
              </span>
            ))}
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center space-x-2 text-xs">
        {(item.unidadesMiami ?? 0) > 0 && (
          <span className="px-2 py-1 bg-sky-100 text-sky-800 rounded">
            Origen: {item.unidadesMiami}
          </span>
        )}
        {(item.unidadesPeru ?? 0) > 0 && (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded">
            Destino: {item.unidadesPeru}
          </span>
        )}
      </div>
    );
  };

  const columns: DataTableColumn<InventarioValorizado>[] = [
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
      key: 'disponibles',
      header: 'Disponibles',
      align: 'right',
      render: (item) => (
        <span className="text-sm font-semibold text-emerald-600">{item.unidadesDisponibles}</span>
      ),
    },
    {
      key: 'asignadas',
      header: 'Asignadas',
      align: 'right',
      render: (item) => (
        <span className="text-sm text-amber-600">{item.unidadesAsignadas}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (item) => (
        <span className="text-sm font-semibold text-slate-900">{item.unidadesTotal}</span>
      ),
    },
    {
      key: 'costoProm',
      header: 'Costo Prom.',
      align: 'right',
      hideOnMobile: true,
      render: (item) => (
        <span className="text-sm text-slate-600">S/ {item.costoPromedioUnidad.toFixed(2)}</span>
      ),
    },
    {
      key: 'valorTotal',
      header: 'Valor Total',
      align: 'right',
      render: (item) => (
        <span className="text-sm font-bold text-teal-600">S/ {item.valorTotalPEN.toFixed(2)}</span>
      ),
    },
    {
      key: 'ubicacion',
      header: 'Ubicacion',
      align: 'center',
      hideOnMobile: true,
      render: (item) => <UbicacionCell item={item} />,
    },
  ];

  return (
    <div>
      {/* Mobile: Card layout */}
      <div className="sm:hidden space-y-2">
        {inventarioPaginado.map((item) => (
          <div key={item.productoId} className="border border-slate-100 rounded-lg p-2.5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-900 truncate">
                  {item.marca} {item.nombreComercial}
                </div>
                <div className="text-[10px] text-slate-400">{item.sku}</div>
              </div>
              <div className="text-xs font-bold text-teal-600 shrink-0">
                S/ {item.valorTotalPEN.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-3 gap-1.5 flex-1 text-[10px]">
                <div>
                  <span className="text-slate-400">Disp.</span>
                  <div className="font-semibold text-emerald-600">{item.unidadesDisponibles}</div>
                </div>
                <div>
                  <span className="text-slate-400">Asig.</span>
                  <div className="font-semibold text-amber-600">{item.unidadesAsignadas}</div>
                </div>
                <div>
                  <span className="text-slate-400">Total</span>
                  <div className="font-semibold text-slate-900">{item.unidadesTotal}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.unidadesPorPais ? (
                  Object.entries(item.unidadesPorPais).filter(([, v]) => v > 0).map(([pais, cantidad]) => (
                    <span key={pais} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                      pais === 'Peru' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {pais === 'Peru' ? 'PE' : pais === 'USA' ? 'US' : pais.substring(0, 3).toUpperCase()}:{cantidad}
                    </span>
                  ))
                ) : (
                  <>
                    {(item.unidadesMiami ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded text-[9px] font-medium">
                        Origen:{item.unidadesMiami}
                      </span>
                    )}
                    {(item.unidadesPeru ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-medium">
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

      {/* Desktop: DataTable */}
      <div className="hidden sm:block">
        <DataTable<InventarioValorizado>
          columns={columns}
          data={inventarioPaginado}
          keyExtractor={(item) => item.productoId}
        />
      </div>

      {/* Paginacion */}
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
