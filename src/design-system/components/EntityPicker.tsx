import React, { useState, useMemo } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { cn } from '../utils';

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

export interface EntityPickerGroup<T> {
  id: string;
  label: string;
  items: T[];
}

interface EntityPickerProps<T> {
  /** Items a mostrar (cuando no hay agrupación) */
  items?: T[];
  /** Items agrupados (cuando se quiere separar por categorías) */
  groups?: EntityPickerGroup<T>[];
  /** Item seleccionado actualmente (o null) */
  selected: T | null;
  /** Callback al seleccionar un item */
  onSelect: (item: T) => void;
  /** Función para renderizar cada card */
  renderCard: (item: T, isSelected: boolean) => React.ReactNode;
  /** Función para extraer el ID único de cada item */
  getItemId: (item: T) => string;
  /** Función que devuelve el texto buscable de un item */
  getSearchText?: (item: T) => string;
  /** Placeholder del input de búsqueda */
  searchPlaceholder?: string;
  /** Mostrar barra de búsqueda (default: true si hay >5 items) */
  showSearch?: boolean;
  /** Callback para crear una nueva entidad inline */
  onCreateNew?: () => void;
  /** Etiqueta del botón crear nuevo */
  createNewLabel?: string;
  /** Mensaje cuando no hay items */
  emptyMessage?: string;
  /** Estado de carga */
  loading?: boolean;
  /** Altura máxima del container (scrollable) */
  maxHeight?: string;
  /** Variante visual */
  variant?: 'list' | 'grid';
  /** ClassName adicional */
  className?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// EntityPicker — Main export
// ════════════════════════════════════════════════════════════════════════════

/**
 * EntityPicker<T> — Selector genérico con búsqueda + cards ricos + quick-add.
 *
 * Usado para elegir: proveedor, colaborador, casilla, cliente, producto, etc.
 *
 * Soporta 2 modos:
 *   - `items`: lista plana
 *   - `groups`: lista agrupada por categoría (ej. Viajeros / Couriers)
 *
 * Ejemplo:
 *   <EntityPicker<Colaborador>
 *     groups={[
 *       { id: 'viajeros', label: 'Viajeros internos', items: viajeros },
 *       { id: 'couriers', label: 'Couriers internacionales', items: couriers },
 *     ]}
 *     selected={selectedColaborador}
 *     onSelect={setColaborador}
 *     getItemId={c => c.id}
 *     getSearchText={c => c.nombre + ' ' + c.alias}
 *     renderCard={(c, isSel) => <ColaboradorCard data={c} selected={isSel} />}
 *     onCreateNew={() => openCreateModal()}
 *     createNewLabel="Crear nuevo colaborador"
 *   />
 */
export function EntityPicker<T>({
  items,
  groups,
  selected,
  onSelect,
  renderCard,
  getItemId,
  getSearchText,
  searchPlaceholder = 'Buscar...',
  showSearch: showSearchProp,
  onCreateNew,
  createNewLabel = 'Crear nuevo',
  emptyMessage = 'No hay elementos disponibles',
  loading = false,
  maxHeight = '24rem',
  variant = 'list',
  className,
}: EntityPickerProps<T>) {
  const [search, setSearch] = useState('');

  const totalItems = useMemo(() => {
    if (groups) return groups.reduce((sum, g) => sum + g.items.length, 0);
    return items?.length ?? 0;
  }, [groups, items]);

  const showSearch = showSearchProp ?? totalItems > 5;

  // ─── Filter by search ────────────────────────────────────────────────────
  const filterItems = (list: T[]): T[] => {
    if (!search.trim() || !getSearchText) return list;
    const q = search.toLowerCase().trim();
    return list.filter((item) => getSearchText(item).toLowerCase().includes(q));
  };

  const filteredGroups = useMemo(() => {
    if (!groups) return undefined;
    return groups
      .map((g) => ({ ...g, items: filterItems(g.items) }))
      .filter((g) => g.items.length > 0);
  }, [groups, search, getSearchText]);

  const filteredItems = useMemo(() => {
    if (!items) return undefined;
    return filterItems(items);
  }, [items, search, getSearchText]);

  const visibleCount = filteredGroups
    ? filteredGroups.reduce((sum, g) => sum + g.items.length, 0)
    : filteredItems?.length ?? 0;

  const selectedId = selected ? getItemId(selected) : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Search */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </div>
      )}

      {/* Container */}
      <div
        className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col"
        style={{ maxHeight }}
      >
        <div className="overflow-y-auto flex-1">
          {/* Loading */}
          {loading && (
            <div className="p-6 text-center text-sm text-slate-500">
              Cargando...
            </div>
          )}

          {/* Empty */}
          {!loading && visibleCount === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">
              {search ? `No hay resultados para "${search}"` : emptyMessage}
            </div>
          )}

          {/* Grouped list */}
          {!loading && filteredGroups && filteredGroups.length > 0 && (
            <div className="divide-y divide-slate-100">
              {filteredGroups.map((group) => (
                <div key={group.id}>
                  <div className="bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    ─── {group.label} ───
                  </div>
                  <div
                    className={cn(
                      variant === 'grid' && 'grid grid-cols-2 gap-2 p-2',
                      variant === 'list' && 'divide-y divide-slate-100'
                    )}
                  >
                    {group.items.map((item) => (
                      <ItemRow
                        key={getItemId(item)}
                        item={item}
                        isSelected={getItemId(item) === selectedId}
                        onSelect={onSelect}
                        renderCard={renderCard}
                        variant={variant}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flat list */}
          {!loading && filteredItems && filteredItems.length > 0 && (
            <div
              className={cn(
                variant === 'grid' && 'grid grid-cols-2 gap-2 p-2',
                variant === 'list' && 'divide-y divide-slate-100'
              )}
            >
              {filteredItems.map((item) => (
                <ItemRow
                  key={getItemId(item)}
                  item={item}
                  isSelected={getItemId(item) === selectedId}
                  onSelect={onSelect}
                  renderCard={renderCard}
                  variant={variant}
                />
              ))}
            </div>
          )}
        </div>

        {/* Create new button */}
        {onCreateNew && (
          <div className="p-2 bg-slate-50 border-t border-slate-200 flex-shrink-0">
            <button
              type="button"
              onClick={onCreateNew}
              className="w-full p-2 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded-lg flex items-center justify-center gap-2 border border-dashed border-teal-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {createNewLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Internal: ItemRow
// ════════════════════════════════════════════════════════════════════════════

interface ItemRowProps<T> {
  item: T;
  isSelected: boolean;
  onSelect: (item: T) => void;
  renderCard: (item: T, isSelected: boolean) => React.ReactNode;
  variant: 'list' | 'grid';
}

function ItemRow<T>({ item, isSelected, onSelect, renderCard, variant }: ItemRowProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn(
        'w-full text-left transition-all',
        variant === 'list' && 'block p-3 hover:bg-slate-50',
        variant === 'list' && isSelected && 'bg-teal-50 border-l-4 border-l-teal-500',
        variant === 'grid' && 'p-3 rounded-lg border-2',
        variant === 'grid' && isSelected && 'border-teal-500 bg-teal-50',
        variant === 'grid' && !isSelected && 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">{renderCard(item, isSelected)}</div>
        {isSelected && variant === 'list' && (
          <Check className="w-5 h-5 text-teal-600 flex-shrink-0" />
        )}
      </div>
    </button>
  );
}
