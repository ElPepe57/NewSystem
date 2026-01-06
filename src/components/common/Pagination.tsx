import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  /** Pagina actual (1-indexed) */
  currentPage: number;
  /** Total de items */
  totalItems: number;
  /** Items por pagina */
  pageSize: number;
  /** Callback cuando cambia la pagina */
  onPageChange: (page: number) => void;
  /** Callback cuando cambia el tamano de pagina */
  onPageSizeChange?: (size: number) => void;
  /** Opciones de tamano de pagina */
  pageSizeOptions?: number[];
  /** Mostrar selector de tamano de pagina */
  showPageSizeSelector?: boolean;
  /** Mostrar info de items */
  showItemsInfo?: boolean;
  /** Clases adicionales */
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelector = true,
  showItemsInfo = true,
  className = ''
}) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generar rango de paginas a mostrar
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
      // Mostrar todas las paginas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Siempre mostrar primera pagina
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      // Paginas alrededor de la actual
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Siempre mostrar ultima pagina
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value);
    onPageSizeChange?.(newSize);
    // Ajustar pagina actual si es necesario
    const newTotalPages = Math.ceil(totalItems / newSize);
    if (currentPage > newTotalPages) {
      onPageChange(Math.max(1, newTotalPages));
    }
  };

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-white border-t border-gray-200 ${className}`}>
      {/* Info de items y selector de tamano */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        {showItemsInfo && (
          <span>
            Mostrando <span className="font-medium text-gray-900">{startItem}</span> a{' '}
            <span className="font-medium text-gray-900">{endItem}</span> de{' '}
            <span className="font-medium text-gray-900">{totalItems}</span> resultados
          </span>
        )}

        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="pageSize" className="text-gray-500">
              Mostrar:
            </label>
            <select
              id="pageSize"
              value={pageSize}
              onChange={handlePageSizeChange}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Controles de paginacion */}
      <div className="flex items-center gap-1">
        {/* Primera pagina */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title="Primera página"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        {/* Pagina anterior */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Numeros de pagina */}
        <div className="flex items-center gap-1 px-2">
          {pageNumbers.map((page, index) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`min-w-[2rem] h-8 px-2 rounded-md text-sm font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Pagina siguiente */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Ultima pagina */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title="Última página"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

/** Opciones para el hook usePagination */
export interface UsePaginationOptions<T> {
  items: T[];
  initialItemsPerPage?: number;
}

/** Hook para manejar estado de paginacion */
export const usePagination = <T,>(
  optionsOrItems: UsePaginationOptions<T> | T[],
  initialPageSize: number = 25
) => {
  // Soportar ambas sintaxis: objeto de opciones o array directo
  const items = Array.isArray(optionsOrItems)
    ? optionsOrItems
    : (optionsOrItems?.items || []);
  const initialSize = Array.isArray(optionsOrItems)
    ? initialPageSize
    : (optionsOrItems?.initialItemsPerPage || initialPageSize);

  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(initialSize);

  // Asegurar que items siempre sea un array
  const safeItems = Array.isArray(items) ? items : [];

  // Calcular total de páginas
  const totalPages = Math.max(1, Math.ceil(safeItems.length / itemsPerPage));

  // Calcular items paginados
  const paginatedItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return safeItems.slice(start, end);
  }, [safeItems, currentPage, itemsPerPage]);

  // Resetear a pagina 1 cuando cambian los items
  React.useEffect(() => {
    setCurrentPage(1);
  }, [safeItems.length]);

  // Ajustar página actual si excede el total
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const setPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const setPageSize = (size: number) => {
    setItemsPerPage(size);
    setCurrentPage(1);
  };

  return {
    currentPage,
    itemsPerPage,
    pageSize: itemsPerPage, // Alias para compatibilidad
    totalPages,
    totalItems: safeItems.length,
    paginatedItems,
    setPage,
    setItemsPerPage: setPageSize,
    onPageChange: setPage, // Alias para compatibilidad
    onPageSizeChange: setPageSize // Alias para compatibilidad
  };
};
