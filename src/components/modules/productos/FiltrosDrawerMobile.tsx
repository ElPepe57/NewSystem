import React, { useState, useEffect } from 'react';
import { X, Filter, ChevronDown } from 'lucide-react';
import { Button } from '../../common';
import type { EstadoProducto } from '../../../types/producto.types';

interface Filters {
  estado: EstadoProducto | '';
  grupo: string;
  marca: string;
  stockStatus: 'todos' | 'critico' | 'agotado' | '';
  investigacion: string;
  tipoProductoId: string;
  categoriaId: string;
  etiquetaId: string;
}

interface FiltrosDrawerMobileProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Filters;
  onApply: (filters: Filters) => void;
  onClear: () => void;
  uniqueMarcas: string[];
  uniqueGrupos: string[];
  tiposProducto: { id: string; nombre: string }[];
  categorias: { id: string; nombre: string }[];
  etiquetas: { id: string; nombre: string }[];
  resultCount: number;
}

export const FiltrosDrawerMobile: React.FC<FiltrosDrawerMobileProps> = ({
  isOpen,
  onClose,
  filters: externalFilters,
  onApply,
  onClear,
  uniqueMarcas,
  uniqueGrupos,
  tiposProducto,
  categorias,
  etiquetas,
  resultCount,
}) => {
  // Local copy to preview changes before applying
  const [localFilters, setLocalFilters] = useState<Filters>(externalFilters);
  const [marcaSearch, setMarcaSearch] = useState('');

  useEffect(() => {
    if (isOpen) setLocalFilters(externalFilters);
  }, [isOpen, externalFilters]);

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  const filteredMarcas = marcaSearch
    ? uniqueMarcas.filter(m => m.toLowerCase().includes(marcaSearch.toLowerCase()))
    : uniqueMarcas.slice(0, 10);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 sm:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 sm:hidden animate-slide-up">
        <div className="bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClear}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Limpiar
              </button>
              <button type="button" onClick={onClose}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 px-4 py-4 space-y-5">
            {/* Estado — Pills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: '', label: 'Todos' },
                  { value: 'activo', label: 'Activos' },
                  { value: 'inactivo', label: 'Inactivos' },
                  { value: 'descontinuado', label: 'Descontinuados' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLocalFilters(prev => ({ ...prev, estado: opt.value as any }))}
                    className={`px-3 py-2 text-sm rounded-lg font-medium min-h-[44px] transition-colors ${
                      localFilters.estado === opt.value
                        ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock — Pills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stock</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: '', label: 'Todos' },
                  { value: 'critico', label: 'Crítico' },
                  { value: 'agotado', label: 'Agotado' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLocalFilters(prev => ({ ...prev, stockStatus: opt.value as any }))}
                    className={`px-3 py-2 text-sm rounded-lg font-medium min-h-[44px] transition-colors ${
                      localFilters.stockStatus === opt.value
                        ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Marca — Search + checkboxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Marca</label>
              <input
                type="text"
                value={marcaSearch}
                onChange={(e) => setMarcaSearch(e.target.value)}
                placeholder="Buscar marca..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 min-h-[44px]"
              />
              <div className="max-h-32 overflow-y-auto space-y-1">
                <button
                  type="button"
                  onClick={() => setLocalFilters(prev => ({ ...prev, marca: '' }))}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg min-h-[44px] ${
                    !localFilters.marca ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50'
                  }`}
                >
                  Todas las marcas
                </button>
                {filteredMarcas.map(marca => (
                  <button
                    key={marca}
                    type="button"
                    onClick={() => setLocalFilters(prev => ({ ...prev, marca }))}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg min-h-[44px] ${
                      localFilters.marca === marca ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50'
                    }`}
                  >
                    {marca}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo de Producto — Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Producto</label>
              <select
                value={localFilters.tipoProductoId}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, tipoProductoId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[44px]"
              >
                <option value="">Todos los tipos</option>
                {tiposProducto.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>

            {/* Categoría — Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
              <select
                value={localFilters.categoriaId}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, categoriaId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[44px]"
              >
                <option value="">Todas las categorías</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            {/* Etiqueta — Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Etiqueta</label>
              <select
                value={localFilters.etiquetaId}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, etiquetaId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[44px]"
              >
                <option value="">Todas las etiquetas</option>
                {etiquetas.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </div>

            {/* Investigación — Pills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Investigación</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: '', label: 'Todas' },
                  { value: 'sin_investigar', label: 'Sin investigar' },
                  { value: 'vigente', label: 'Vigente' },
                  { value: 'vencida', label: 'Vencida' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLocalFilters(prev => ({ ...prev, investigacion: opt.value }))}
                    className={`px-3 py-2 text-sm rounded-lg font-medium min-h-[44px] transition-colors ${
                      localFilters.investigacion === opt.value
                        ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer sticky */}
          <div className="border-t px-4 py-3 bg-white">
            <Button
              variant="primary"
              className="w-full min-h-[48px] text-base"
              onClick={handleApply}
            >
              Aplicar filtros ({resultCount} productos)
            </Button>
          </div>
        </div>
      </div>

      {/* Animation */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
};
