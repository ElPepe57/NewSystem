/**
 * FiltrosGastosBar · TAREA-GASTOS-PAGE-V2 F2
 *
 * Barra de filtros del modulo Gastos siguiendo el patron canonico de la
 * 6a referencia del sistema (FiltrosFinanzasBar · S58e).
 *
 * Layout · 2 filas:
 *   FILA 1: chips ESTADO + chips BLOQUE (toggleables · color por dominio)
 *   FILA 2: busqueda + orden + limpiar
 *
 * Replica el patron visual sin reusar el componente de Finanzas
 * (que esta acoplado al dominio CC: por_cobrar/por_pagar/etc).
 */

import React from 'react';
import { Search, X } from 'lucide-react';
import type { EstadoGasto } from '../../../types/gasto.types';
import type { BloqueCosto } from '../../../types/categoriaCosto.types';

export type OrdenGasto = 'fecha_desc' | 'monto_desc' | 'monto_asc' | 'proveedor';

interface FiltrosGastosBarProps {
  estadoActivo: EstadoGasto | '';
  bloqueActivo: BloqueCosto | '';
  searchTerm: string;
  orden: OrdenGasto;
  totalResultados: number;
  totalMontoPEN: number;
  // Conteos opcionales para mostrar al lado de cada chip
  conteosEstado?: Partial<Record<EstadoGasto, number>>;
  conteosBloque?: Partial<Record<BloqueCosto, number>>;
  hayFiltrosActivos: boolean;
  onCambiarEstado: (estado: EstadoGasto | '') => void;
  onCambiarBloque: (bloque: BloqueCosto | '') => void;
  onCambiarSearchTerm: (term: string) => void;
  onCambiarOrden: (orden: OrdenGasto) => void;
  onLimpiarTodo: () => void;
}

const CHIPS_ESTADO: Array<{
  id: EstadoGasto;
  label: string;
  emoji: string;
  classes: { activo: string; inactivo: string };
}> = [
  {
    id: 'pagado',
    label: 'Pagado',
    emoji: '✓',
    classes: {
      activo: 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50',
    },
  },
  {
    id: 'pendiente',
    label: 'Pendiente',
    emoji: '⏰',
    classes: {
      activo: 'bg-amber-100 text-amber-700 ring-2 ring-amber-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-50',
    },
  },
  {
    id: 'parcial',
    label: 'Parcial',
    emoji: '◐',
    classes: {
      activo: 'bg-sky-100 text-sky-700 ring-2 ring-sky-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-sky-50',
    },
  },
  {
    id: 'cancelado',
    label: 'Cancelado',
    emoji: '✕',
    classes: {
      activo: 'bg-rose-100 text-rose-700 ring-2 ring-rose-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-rose-50',
    },
  },
];

const CHIPS_BLOQUE: Array<{
  id: BloqueCosto;
  label: string;
  emoji: string;
  classes: { activo: string; inactivo: string };
}> = [
  {
    id: 'importacion',
    label: 'Importación',
    emoji: '📦',
    classes: {
      activo: 'bg-blue-100 text-blue-700 ring-2 ring-blue-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-blue-50',
    },
  },
  {
    id: 'venta',
    label: 'Venta',
    emoji: '🛒',
    classes: {
      activo: 'bg-purple-100 text-purple-700 ring-2 ring-purple-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-purple-50',
    },
  },
  {
    id: 'periodo',
    label: 'Período',
    emoji: '📅',
    classes: {
      activo: 'bg-amber-100 text-amber-700 ring-2 ring-amber-300',
      inactivo: 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-50',
    },
  },
];

const OPCIONES_ORDEN: Array<{ value: OrdenGasto; label: string }> = [
  { value: 'fecha_desc', label: 'Más recientes' },
  { value: 'monto_desc', label: 'Mayor monto' },
  { value: 'monto_asc', label: 'Menor monto' },
  { value: 'proveedor', label: 'Proveedor A-Z' },
];

const formatPEN = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n);

export const FiltrosGastosBar: React.FC<FiltrosGastosBarProps> = ({
  estadoActivo,
  bloqueActivo,
  searchTerm,
  orden,
  totalResultados,
  totalMontoPEN,
  conteosEstado,
  conteosBloque,
  hayFiltrosActivos,
  onCambiarEstado,
  onCambiarBloque,
  onCambiarSearchTerm,
  onCambiarOrden,
  onLimpiarTodo,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Fila 1 · Chips de estado y bloque */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-2">
        {/* Estado */}
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-1">Estado</div>
        <button
          type="button"
          onClick={() => onCambiarEstado('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            estadoActivo === ''
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Todos
        </button>
        {CHIPS_ESTADO.map((chip) => {
          const isActivo = estadoActivo === chip.id;
          const count = conteosEstado?.[chip.id];
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onCambiarEstado(chip.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isActivo ? chip.classes.activo : chip.classes.inactivo
              }`}
            >
              <span>{chip.emoji}</span>
              <span>{chip.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span className={`text-[10px] tabular-nums ${isActivo ? 'opacity-80' : 'opacity-60'}`}>
                  · {count}
                </span>
              )}
            </button>
          );
        })}

        <div className="w-px h-5 bg-slate-200 mx-2"></div>

        {/* Bloque (modelo de 3 niveles) */}
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-1">Bloque</div>
        <button
          type="button"
          onClick={() => onCambiarBloque('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            bloqueActivo === ''
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Todos
        </button>
        {CHIPS_BLOQUE.map((chip) => {
          const isActivo = bloqueActivo === chip.id;
          const count = conteosBloque?.[chip.id];
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onCambiarBloque(chip.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isActivo ? chip.classes.activo : chip.classes.inactivo
              }`}
            >
              <span>{chip.emoji}</span>
              <span>{chip.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span className={`text-[10px] tabular-nums ${isActivo ? 'opacity-80' : 'opacity-60'}`}>
                  · {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Fila 2 · Búsqueda + orden + limpiar + total */}
      <div className="border-t border-slate-100 px-4 py-2.5 flex flex-wrap items-center gap-3">
        {/* Búsqueda */}
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onCambiarSearchTerm(e.target.value)}
            placeholder="Buscar por descripción, proveedor, número..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>

        {/* Orden */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="uppercase tracking-wider text-slate-500 font-bold">Orden</span>
          <select
            value={orden}
            onChange={(e) => onCambiarOrden(e.target.value as OrdenGasto)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-amber-400"
          >
            {OPCIONES_ORDEN.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {/* Limpiar */}
        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={onLimpiarTodo}
            className="text-xs text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1 px-2 py-1.5 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar filtros
          </button>
        )}

        {/* Total */}
        <div className="ml-auto text-xs text-slate-600">
          <span className="font-bold tabular-nums text-slate-900">{totalResultados}</span> gastos ·{' '}
          <span className="font-bold tabular-nums text-slate-900">{formatPEN(totalMontoPEN)}</span>
        </div>
      </div>
    </div>
  );
};
