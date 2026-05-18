/**
 * FiltrosGastosBar · barra filtros canon · Gastos rework v4
 *
 * chk5.C-UX-PASS (2026-05-11) · refactor con canon v8.0:
 *   - N4 · color cross-módulo por origen/bloque/estado (consistencia visual)
 *   - N5 · filtros COLAPSABLES en mobile (<sm: 640px)
 *   - "Todos" implícito · si ningún chip activo del grupo · sin botón "Todos" explícito
 *   - 1 chip "Limpiar filtros" al final si hay activos (en vez de 3 botones "Todos")
 *
 * Pixel-perfect contra mockup `gastos-rework-v4-responsive-color.html`.
 */

import React, { useState } from 'react';
import {
  Search, X, ChevronDown, Filter,
  Check, Clock, Hourglass, XCircle,
  Package, ShoppingBag, Calendar,
  Edit3, Truck,
} from 'lucide-react';
import type { EstadoGasto } from '../../../types/gasto.types';
import type { BloqueCosto } from '../../../types/categoriaCosto.types';
import type { OrigenGasto } from '../utils/origenGasto';

export type OrdenGasto = 'fecha_desc' | 'monto_desc' | 'monto_asc' | 'proveedor';

interface FiltrosGastosBarProps {
  estadoActivo: EstadoGasto | '';
  bloqueActivo: BloqueCosto | '';
  origenActivo: OrigenGasto | '';
  searchTerm: string;
  orden: OrdenGasto;
  totalResultados: number;
  totalMontoPEN: number;
  conteosEstado?: Partial<Record<EstadoGasto, number>>;
  conteosBloque?: Partial<Record<BloqueCosto, number>>;
  conteosOrigen?: Partial<Record<OrigenGasto, number>>;
  hayFiltrosActivos: boolean;
  onCambiarEstado: (estado: EstadoGasto | '') => void;
  onCambiarBloque: (bloque: BloqueCosto | '') => void;
  onCambiarOrigen: (origen: OrigenGasto | '') => void;
  onCambiarSearchTerm: (term: string) => void;
  onCambiarOrden: (orden: OrdenGasto) => void;
  onLimpiarTodo: () => void;
}

interface ChipConfig<T extends string> {
  id: T;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Color canon v8.0 N4 · activo + inactivo */
  classes: { activo: string; inactivo: string };
}

// ────────────────────────────────────────────────────────────────────────────
// canon v8.0 N4 · COLORES SEMÁNTICOS por concepto (cross-módulo consistente)
// ────────────────────────────────────────────────────────────────────────────

const CHIPS_ESTADO: ChipConfig<EstadoGasto>[] = [
  { id: 'pagado',    label: 'Pagado',    Icon: Check,
    classes: { activo: 'bg-emerald-100 text-emerald-800 border border-emerald-300 ring-2 ring-emerald-200',
               inactivo: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' } },
  { id: 'pendiente', label: 'Pendiente', Icon: Clock,
    classes: { activo: 'bg-amber-100 text-amber-800 border border-amber-300 ring-2 ring-amber-200',
               inactivo: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' } },
  { id: 'parcial',   label: 'Parcial',   Icon: Hourglass,
    classes: { activo: 'bg-sky-100 text-sky-800 border border-sky-300 ring-2 ring-sky-200',
               inactivo: 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100' } },
  { id: 'cancelado', label: 'Cancelado', Icon: XCircle,
    classes: { activo: 'bg-rose-100 text-rose-800 border border-rose-300 ring-2 ring-rose-200',
               inactivo: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' } },
];

const CHIPS_BLOQUE: ChipConfig<BloqueCosto>[] = [
  { id: 'producto', label: 'Producto', Icon: Package,
    classes: { activo: 'bg-blue-100 text-blue-800 border border-blue-300 ring-2 ring-blue-200',
               inactivo: 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' } },
  { id: 'venta',    label: 'Venta',    Icon: ShoppingBag,
    classes: { activo: 'bg-purple-100 text-purple-800 border border-purple-300 ring-2 ring-purple-200',
               inactivo: 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100' } },
  { id: 'periodo',  label: 'Período',  Icon: Calendar,
    classes: { activo: 'bg-amber-100 text-amber-800 border border-amber-300 ring-2 ring-amber-200',
               inactivo: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' } },
];

const CHIPS_ORIGEN: ChipConfig<OrigenGasto>[] = [
  { id: 'manual', label: 'Manual', Icon: Edit3,
    classes: { activo: 'bg-slate-200 text-slate-800 border border-slate-400 ring-2 ring-slate-300',
               inactivo: 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200' } },
  { id: 'oc',     label: 'OC',     Icon: Package,
    classes: { activo: 'bg-blue-100 text-blue-800 border border-blue-300 ring-2 ring-blue-200',
               inactivo: 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' } },
  { id: 'envio',  label: 'Envío',  Icon: Truck,
    classes: { activo: 'bg-purple-100 text-purple-800 border border-purple-300 ring-2 ring-purple-200',
               inactivo: 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100' } },
  { id: 'venta',  label: 'Venta',  Icon: ShoppingBag,
    classes: { activo: 'bg-emerald-100 text-emerald-800 border border-emerald-300 ring-2 ring-emerald-200',
               inactivo: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' } },
];

const OPCIONES_ORDEN: Array<{ value: OrdenGasto; label: string }> = [
  { value: 'fecha_desc', label: 'Más recientes' },
  { value: 'monto_desc', label: 'Mayor monto' },
  { value: 'monto_asc',  label: 'Menor monto' },
  { value: 'proveedor',  label: 'Proveedor A-Z' },
];

const formatPEN = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n);

export const FiltrosGastosBar: React.FC<FiltrosGastosBarProps> = ({
  estadoActivo,
  bloqueActivo,
  origenActivo,
  searchTerm,
  orden,
  totalResultados,
  totalMontoPEN,
  conteosEstado,
  conteosBloque,
  conteosOrigen,
  hayFiltrosActivos,
  onCambiarEstado,
  onCambiarBloque,
  onCambiarOrigen,
  onCambiarSearchTerm,
  onCambiarOrden,
  onLimpiarTodo,
}) => {
  // chk5.C-UX-PASS · canon v8.0 N5 · estado de colapso mobile
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Conteo de filtros activos (para badge en header mobile colapsado)
  const filtrosActivosCount = [estadoActivo, bloqueActivo, origenActivo].filter(Boolean).length
    + (searchTerm.trim() ? 1 : 0);

  // Helper para renderizar un grupo de chips · canon v8.0 N4 · "Todos" implícito
  // (sin botón "Todos" explícito · click en chip activo lo desactiva)
  const renderChipGroup = <T extends string>(
    label: string,
    chips: ChipConfig<T>[],
    activeId: T | '',
    onChange: (id: T | '') => void,
    conteos?: Partial<Record<T, number>>,
  ) => (
    <>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-1">{label}</div>
      {chips.map(({ id, label: chipLabel, Icon, classes }) => {
        const isActivo = activeId === id;
        const count = conteos?.[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(isActivo ? '' : id)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
              isActivo ? classes.activo : classes.inactivo
            }`}
            title={isActivo ? `Quitar filtro ${chipLabel}` : `Filtrar por ${chipLabel}`}
          >
            <Icon className="w-3 h-3" />
            <span>{chipLabel}</span>
            {typeof count === 'number' && count > 0 && (
              <span className={`text-[10px] tabular-nums ${isActivo ? 'opacity-90' : 'opacity-70'}`}>
                · {count}
              </span>
            )}
          </button>
        );
      })}
    </>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* canon v8.0 N5 · header colapsable en mobile · solo visible <sm: */}
      <button
        type="button"
        onClick={() => setMobileExpanded((e) => !e)}
        className="sm:hidden w-full px-4 py-3 flex items-center justify-between border-b border-slate-200"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-bold text-slate-700">Filtros</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
            filtrosActivosCount > 0
              ? 'bg-teal-100 text-teal-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {filtrosActivosCount > 0 ? `${filtrosActivosCount} activos` : 'Sin filtros'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${mobileExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Fila 1 · Chips · canon v8.0 N4 color semántico · oculta en mobile si colapsado */}
      <div className={`${mobileExpanded ? 'flex' : 'hidden'} sm:flex px-3 sm:px-4 py-3 flex-wrap items-center gap-2`}>
        {renderChipGroup('Origen', CHIPS_ORIGEN, origenActivo, onCambiarOrigen, conteosOrigen)}
        <div className="hidden sm:block w-px h-5 bg-slate-200 mx-2" />
        {renderChipGroup('Bloque', CHIPS_BLOQUE, bloqueActivo, onCambiarBloque, conteosBloque)}
        <div className="hidden sm:block w-px h-5 bg-slate-200 mx-2" />
        {renderChipGroup('Estado', CHIPS_ESTADO, estadoActivo, onCambiarEstado, conteosEstado)}

        {/* canon v8.0 · UN solo botón "Limpiar filtros" si hay activos (no 3 "Todos") */}
        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={onLimpiarTodo}
            className="ml-auto text-xs text-slate-500 hover:text-slate-900 font-medium inline-flex items-center gap-1 px-2 py-1 hover:bg-slate-100 rounded-lg"
            title="Limpiar todos los filtros"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpiar filtros</span>
            <span className="sm:hidden">Limpiar</span>
          </button>
        )}
      </div>

      {/* Fila 2 · Búsqueda + orden + total · siempre visible (también mobile) */}
      <div className="border-t border-slate-100 bg-slate-50/50 px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-[160px] sm:min-w-[200px] sm:max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onCambiarSearchTerm(e.target.value)}
            placeholder="Buscar por descripción, proveedor, número..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="hidden sm:inline uppercase tracking-wider text-slate-500 font-bold">Orden</span>
          <select
            value={orden}
            onChange={(e) => onCambiarOrden(e.target.value as OrdenGasto)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-teal-400"
          >
            {OPCIONES_ORDEN.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-xs text-slate-600 tabular-nums">
          <span className="font-bold text-slate-900">{totalResultados}</span>
          <span className="hidden sm:inline"> gastos</span>
          <span className="text-slate-400 mx-1">·</span>
          <span className="font-bold text-slate-900">{formatPEN(totalMontoPEN)}</span>
        </div>
      </div>
    </div>
  );
};
