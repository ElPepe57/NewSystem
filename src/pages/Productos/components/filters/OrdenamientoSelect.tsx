/**
 * OrdenamientoSelect · Select de ordenamiento ampliado (Fase G · mockup #43)
 *
 * 12 opciones agrupadas en 5 categorías:
 *   - Métricas comerciales (4: margen / ROI / multiplicador / utilidad/u)
 *   - Velocidad (2: ventas 30d / 90d)
 *   - Stock (2: mayor stock / stock crítico primero)
 *   - Identidad (3: nombre / marca / SKU)
 *   - Actividad (1: más recientes)
 *
 * Más:
 *   - Selector items por página (20/50/100/Todos)
 *   - Botón invertir orden (asc/desc)
 */

import React from 'react';
import { ArrowUpDown } from 'lucide-react';

export type SortKey =
  // Métricas comerciales
  | 'margen_desc' | 'roi_desc' | 'multiplicador_desc' | 'utilidad_desc'
  // Velocidad
  | 'ventas_30d' | 'ventas_90d'
  // Stock
  | 'stock_desc' | 'stock_critico'
  // Identidad
  | 'nombre_asc' | 'marca_asc' | 'sku_asc'
  // Actividad
  | 'recientes';

export type PageSize = 20 | 50 | 100 | 'all';

interface OrdenamientoSelectProps {
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
  pageSize: PageSize;
  onChangeSort: (key: SortKey) => void;
  onChangeDirection: (dir: 'asc' | 'desc') => void;
  onChangePageSize: (size: PageSize) => void;
}

const SORT_DEFAULTS: Record<SortKey, 'asc' | 'desc'> = {
  margen_desc: 'desc',
  roi_desc: 'desc',
  multiplicador_desc: 'desc',
  utilidad_desc: 'desc',
  ventas_30d: 'desc',
  ventas_90d: 'desc',
  stock_desc: 'desc',
  stock_critico: 'asc',
  nombre_asc: 'asc',
  marca_asc: 'asc',
  sku_asc: 'asc',
  recientes: 'desc',
};

export const OrdenamientoSelect: React.FC<OrdenamientoSelectProps> = ({
  sortKey,
  sortDirection,
  pageSize,
  onChangeSort,
  onChangeDirection,
  onChangePageSize,
}) => {
  const handleChangeSort = (newKey: SortKey) => {
    onChangeSort(newKey);
    onChangeDirection(SORT_DEFAULTS[newKey]); // resetear dirección al default cada vez que cambia el campo
  };

  const handleInvertir = () => {
    onChangeDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Items por página */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-slate-500">Mostrar:</span>
        <select
          value={String(pageSize)}
          onChange={e => onChangePageSize(e.target.value === 'all' ? 'all' : (parseInt(e.target.value) as PageSize))}
          className="px-2 py-1 text-[10px] border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {/* Ordenamiento */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-slate-500">Ordenar por:</span>
        <select
          value={sortKey}
          onChange={e => handleChangeSort(e.target.value as SortKey)}
          className="px-2 py-1 text-[11px] border border-amber-300 rounded bg-amber-50 text-amber-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <optgroup label="📊 Métricas comerciales">
            <option value="margen_desc">Mayor margen</option>
            <option value="roi_desc">Mayor ROI</option>
            <option value="multiplicador_desc">Multiplicador</option>
            <option value="utilidad_desc">Mayor utilidad/u</option>
          </optgroup>
          <optgroup label="📈 Velocidad">
            <option value="ventas_30d">Más vendidos (30d)</option>
            <option value="ventas_90d">Más vendidos (90d)</option>
          </optgroup>
          <optgroup label="📦 Stock">
            <option value="stock_desc">Mayor stock disponible</option>
            <option value="stock_critico">Stock crítico primero</option>
          </optgroup>
          <optgroup label="🔠 Identidad">
            <option value="nombre_asc">Nombre A-Z</option>
            <option value="marca_asc">Marca A-Z</option>
            <option value="sku_asc">SKU</option>
          </optgroup>
          <optgroup label="🕒 Actividad">
            <option value="recientes">Más recientes</option>
          </optgroup>
        </select>

        <button
          type="button"
          onClick={handleInvertir}
          className={`p-1 rounded ${
            sortDirection === SORT_DEFAULTS[sortKey] ? 'text-slate-500 hover:bg-slate-100' : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
          }`}
          title={`Orden actual: ${sortDirection === 'asc' ? 'ascendente ↑' : 'descendente ↓'} · click para invertir`}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
