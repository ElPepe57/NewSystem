import React, { useState, useMemo } from 'react';
import { Search, Package, GitBranch, ChevronRight } from 'lucide-react';
import type { Producto } from '../../../types/producto.types';

interface BuscadorGrupoProductoProps {
  productos: Producto[];
  onSelect: (producto: Producto) => void;
  onCancel: () => void;
}

/**
 * Paso 1 del Flujo 3: buscar un grupo/producto existente para agregar variante.
 */
export const BuscadorGrupoProducto: React.FC<BuscadorGrupoProductoProps> = ({
  productos,
  onSelect,
  onCancel,
}) => {
  const [search, setSearch] = useState('');

  // Get unique groups and independent products
  const resultados = useMemo(() => {
    if (search.length < 2) return [];
    const term = search.toLowerCase();

    // Find matching products
    const matches = productos.filter(p => {
      if (p.estado !== 'activo') return false;
      return (p.marca || '').toLowerCase().includes(term) ||
        (p.nombreComercial || '').toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term);
    });

    // Group by grupoVarianteId — show one representative per group
    const seen = new Set<string>();
    const grouped: { producto: Producto; variantesExistentes: string[] }[] = [];

    matches.forEach(p => {
      const gid = p.grupoVarianteId;
      if (gid && !seen.has(gid)) {
        seen.add(gid);
        const siblings = productos.filter(s => s.grupoVarianteId === gid && s.estado === 'activo');
        const labels = siblings.map(s => s.varianteLabel || s.contenido || s.sku).filter(Boolean);
        const principal = siblings.find(s => s.esPrincipalGrupo) || siblings[0];
        grouped.push({ producto: principal, variantesExistentes: labels });
      } else if (!gid && !seen.has(p.id)) {
        seen.add(p.id);
        grouped.push({ producto: p, variantesExistentes: [] });
      }
    });

    return grouped.slice(0, 10);
  }, [productos, search]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">Agregar variante a grupo existente</h3>
        <p className="text-sm text-gray-500 mt-1">Paso 1 de 2 — Busca el producto</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por marca, nombre o SKU..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
          autoFocus
        />
      </div>

      {search.length >= 2 && (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {resultados.length > 0 ? resultados.map(({ producto, variantesExistentes }) => (
            <button
              key={producto.id}
              type="button"
              onClick={() => onSelect(producto)}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-gray-900 text-sm truncate">
                      {producto.marca} — {producto.nombreComercial}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{producto.sku}</span>
                    {producto.presentacion && <span>· {producto.presentacion}</span>}
                    {producto.dosaje && <span>· {producto.dosaje}</span>}
                  </div>
                  {variantesExistentes.length > 0 ? (
                    <div className="flex items-center gap-1 mt-1.5">
                      <GitBranch className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-green-600">
                        Variantes: {variantesExistentes.join(' · ')}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-500 mt-1.5">Sin variantes (se creará grupo al agregar)</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
              </div>
            </button>
          )) : (
            <p className="text-center text-sm text-gray-400 py-6">No se encontraron productos</p>
          )}
        </div>
      )}

      {search.length < 2 && (
        <p className="text-center text-sm text-gray-400 py-6">Escribe al menos 2 caracteres para buscar</p>
      )}

      <div className="flex justify-start pt-2">
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </button>
      </div>
    </div>
  );
};
