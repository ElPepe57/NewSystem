/**
 * EmptyStateBusqueda · estado vacío cuando hay productos en BD pero NINGUNO matchea
 * la búsqueda + filtros aplicados.
 *
 * Mockup canónico: docs/mockups/productos/03-page-listado-vacio-busqueda.html
 *
 * Diseño:
 *   - Card normal (no dashed) con emoji 🔍
 *   - Mensaje con el término buscado destacado
 *   - Lista textual de filtros activos
 *   - 3 acciones: Limpiar búsqueda · Limpiar todos los filtros · Crear producto "{término}"
 */

import React from 'react';
import { X, FilterX, Plus } from 'lucide-react';

interface EmptyStateBusquedaProps {
  searchTerm: string;
  filtrosActivosTexto?: string;
  onLimpiarBusqueda?: () => void;
  onLimpiarFiltros?: () => void;
  onCrearProducto?: (nombre: string) => void;
}

export const EmptyStateBusqueda: React.FC<EmptyStateBusquedaProps> = ({
  searchTerm,
  filtrosActivosTexto,
  onLimpiarBusqueda,
  onLimpiarFiltros,
  onCrearProducto,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
      <div className="text-5xl mb-4">🔍</div>
      <h2 className="text-base font-bold text-slate-900 mb-1">No encontramos productos</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-1">
        No hay resultados para <strong className="text-slate-700">"{searchTerm}"</strong>{' '}
        {filtrosActivosTexto ? 'con los filtros aplicados' : ''}.
      </p>
      {filtrosActivosTexto && <p className="text-xs text-slate-400 mb-5">Filtros activos: {filtrosActivosTexto}</p>}

      <div className="flex items-center justify-center gap-2 text-xs flex-wrap">
        {onLimpiarBusqueda && searchTerm && (
          <button
            onClick={onLimpiarBusqueda}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg flex items-center gap-1.5"
            type="button"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar búsqueda
          </button>
        )}
        {onLimpiarFiltros && filtrosActivosTexto && (
          <button
            onClick={onLimpiarFiltros}
            className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-medium rounded-lg flex items-center gap-1.5"
            type="button"
          >
            <FilterX className="w-3.5 h-3.5" />
            Limpiar todos los filtros
          </button>
        )}
        {onCrearProducto && searchTerm && (
          <>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => onCrearProducto(searchTerm)}
              className="text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
              type="button"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear producto "{searchTerm}"
            </button>
          </>
        )}
      </div>
    </div>
  );
};
