/**
 * ProductosListV2 · contenedor de la lista de cards de Productos V2
 *
 * Layout:
 *   - Header tabla (12 cols, sticky-top opcional) con select-all checkbox
 *   - Cada fila → ProductoRowCard
 *   - Agrupa hermanas por grupoVarianteId (muestra solo el principal del grupo
 *     con avatares apilados de las demás variantes)
 *
 * Mockup canónico: docs/mockups/productos/01-page-listado.html (vista normal)
 *                  + estados granulares 10-10f
 */

import React, { useMemo } from 'react';
import type { Producto } from '../../../../types/producto.types';
import { ProductoRowCard } from './ProductoRowCard';

interface ProductosListV2Props {
  productos: Producto[];
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onClickProducto?: (producto: Producto) => void;
  onView?: (producto: Producto) => void;
  onActions?: (producto: Producto, anchorRef: HTMLElement) => void;
  onCrearOC?: (producto: Producto) => void;
  onReInvestigar?: (producto: Producto) => void;
  onRestaurar?: (producto: Producto) => void;
  onEliminarDefinitivo?: (producto: Producto) => void;
}

export const ProductosListV2: React.FC<ProductosListV2Props> = ({
  productos,
  selectedIds,
  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onClickProducto,
  onView,
  onActions,
  onCrearOC,
  onReInvestigar,
  onRestaurar,
  onEliminarDefinitivo,
}) => {
  // Agrupa por grupoVarianteId: si N productos comparten id, muestra solo el principal
  // (esPrincipalGrupo o el primero que aparezca) y el resto son "hermanos" para los avatares
  const { displayables, hermanasMap } = useMemo(() => {
    const grupos = new Map<string, Producto[]>();
    const sinGrupo: Producto[] = [];

    productos.forEach(p => {
      const grupoId = p.grupoVarianteId;
      if (!grupoId) {
        sinGrupo.push(p);
      } else {
        const arr = grupos.get(grupoId) ?? [];
        arr.push(p);
        grupos.set(grupoId, arr);
      }
    });

    const displayables: Producto[] = [...sinGrupo];
    const hermanasMap = new Map<string, Producto[]>();

    grupos.forEach(grupo => {
      // Principal: esPrincipalGrupo === true · si no, el primero
      const principal = grupo.find(p => p.esPrincipalGrupo === true) ?? grupo[0];
      displayables.push(principal);
      hermanasMap.set(principal.id, grupo);
    });

    return { displayables, hermanasMap };
  }, [productos]);

  const totalDisplayable = displayables.length;
  const allSelected = totalDisplayable > 0 && displayables.every(p => selectedIds.has(p.id));
  const someSelected = displayables.some(p => selectedIds.has(p.id)) && !allSelected;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelectAll(displayables.map(p => p.id));
    } else {
      onClearSelection();
    }
  };

  // Title de la columna 2 cambia si hay packs visibles vs no
  const tienePacks = displayables.some(p => p.esPack === true);
  const colVariantesLabel = tienePacks ? 'Componentes · Stock' : 'Variantes · Stock';

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header tabla */}
      <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        <div className="col-span-1">
          <input
            type="checkbox"
            checked={allSelected}
            ref={el => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={handleSelectAll}
            className="rounded border-slate-300 text-teal-600 w-3.5 h-3.5"
            aria-label="Seleccionar todos"
          />
        </div>
        <div className="col-span-4">Producto</div>
        <div className="col-span-2 text-right">{colVariantesLabel}</div>
        <div className="col-span-2 text-right">Precio venta</div>
        <div className="col-span-2 text-right">Margen</div>
        <div className="col-span-1 text-right">Acciones</div>
      </div>

      {/* Filas */}
      <div className="divide-y divide-slate-100">
        {displayables.map(producto => (
          <ProductoRowCard
            key={producto.id}
            producto={producto}
            hermanasGrupo={hermanasMap.get(producto.id) ?? []}
            selected={selectedIds.has(producto.id)}
            onSelectChange={(_id, _sel) => onToggleSelected(producto.id)}
            onClick={onClickProducto}
            onView={onView}
            onActions={onActions}
            onCrearOC={onCrearOC}
            onReInvestigar={onReInvestigar}
            onRestaurar={onRestaurar}
            onEliminarDefinitivo={onEliminarDefinitivo}
          />
        ))}
      </div>

      {/* Footer tabla · contador */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 tabular-nums flex items-center justify-between">
        <span>
          Mostrando <strong className="text-slate-700">{totalDisplayable}</strong> producto{totalDisplayable === 1 ? '' : 's'}
        </span>
        {selectedIds.size > 0 && (
          <span className="text-teal-700 font-bold">{selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}</span>
        )}
      </div>
    </div>
  );
};
