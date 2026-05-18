/**
 * FiltrosCCBar — chk5.D-S3.bis · SF4
 *
 * Barra de filtros para la sub-vista CC Entidades · canon MOCK 8 §1 filtros.
 * Pixel-perfect contra `docs/mockups/finanzas-vista-cc-entidades-v5.1.html`.
 *
 * Filtros canon:
 *   1. Búsqueda · texto sobre nombre · RUC · email
 *   2. Toggle tipo entidad · 6 opciones (Todas · Clientes · Proveedores · Colab · Empleados · TC)
 *   3. Aging dropdown · todos · 0-30d · 31-60d · +60d
 *   4. Checkbox "Solo con saldo" (default true)
 *
 * Mobile · N5 (collapsible) preservado del patrón de FiltrosLedgerBar SF4 anterior.
 */

import React, { useState } from 'react';
import { Search, Clock, Filter, ChevronDown, X } from 'lucide-react';
import type { TipoEntidadCC } from '../../../../types/cuentaCorriente.types';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export type FiltroTipoEntidad = 'todas' | TipoEntidadCC;
export type FiltroAging = 'todos' | 'd0_30' | 'd31_60' | 'd60_plus';

export interface FiltrosCCState {
  busqueda: string;
  tipoEntidad: FiltroTipoEntidad;
  aging: FiltroAging;
  soloConSaldo: boolean;
}

export interface FiltrosCCBarProps {
  state: FiltrosCCState;
  onChange: (state: FiltrosCCState) => void;
  /** Cantidad de filtros activos para mostrar en el collapsible mobile */
  activeCount: number;
  onLimpiarTodo: () => void;
}

// ═════════════════════════════════════════════════════════════════════════
// LABELS
// ═════════════════════════════════════════════════════════════════════════

const AGING_LABEL: Record<FiltroAging, string> = {
  todos: 'Todos',
  d0_30: '0-30 días',
  d31_60: '31-60 días',
  d60_plus: '+60 días',
};

const TIPO_TOGGLES: Array<{
  value: FiltroTipoEntidad;
  label: string;
  color: 'slate' | 'emerald' | 'rose' | 'purple' | 'indigo' | 'amber';
}> = [
  { value: 'todas', label: 'Todas', color: 'slate' },
  { value: 'cliente', label: 'Clientes', color: 'emerald' },
  { value: 'proveedor', label: 'Proveedores', color: 'rose' },
  { value: 'colaborador', label: 'Colab', color: 'purple' },
  { value: 'empleado', label: 'Empleados', color: 'indigo' },
  { value: 'tarjeta_credito', label: 'TC', color: 'amber' },
];

const TOGGLE_ACTIVE_BG: Record<string, string> = {
  slate: 'bg-slate-700 text-white',
  emerald: 'bg-emerald-600 text-white',
  rose: 'bg-rose-600 text-white',
  purple: 'bg-purple-600 text-white',
  indigo: 'bg-indigo-600 text-white',
  amber: 'bg-amber-600 text-white',
};

const TOGGLE_INACTIVE_TEXT: Record<string, string> = {
  slate: 'text-slate-700 hover:bg-slate-50',
  emerald: 'text-emerald-700 hover:bg-emerald-50',
  rose: 'text-rose-700 hover:bg-rose-50',
  purple: 'text-purple-700 hover:bg-purple-50',
  indigo: 'text-indigo-700 hover:bg-indigo-50',
  amber: 'text-amber-700 hover:bg-amber-50',
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const FiltrosCCBar: React.FC<FiltrosCCBarProps> = ({
  state,
  onChange,
  activeCount,
  onLimpiarTodo,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [agingOpen, setAgingOpen] = useState(false);

  const tipoActual = TIPO_TOGGLES.find((t) => t.value === state.tipoEntidad) ?? TIPO_TOGGLES[0];

  return (
    <div className="border-b border-slate-200 px-6 py-3 bg-slate-50/50 space-y-2">
      {/* Mobile collapsible toggle · N5 */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="sm:hidden w-full flex items-center justify-between"
        aria-expanded={mobileOpen}
      >
        <span className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-[12px] font-bold text-slate-700">Filtros</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeCount > 0
                ? 'bg-teal-100 text-teal-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {activeCount > 0 ? `${activeCount} activos` : 'Sin filtros'}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
            mobileOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Row principal · responsive */}
      <div className={`${mobileOpen ? 'block' : 'hidden'} sm:flex flex-wrap items-center gap-2`}>
        {/* Búsqueda */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={state.busqueda}
            onChange={(e) => onChange({ ...state, busqueda: e.target.value })}
            placeholder="Buscar entidad · RUC · email..."
            className="w-full pl-9 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
          />
        </div>

        {/* Toggle tipo entidad · 6 opciones · scroll horizontal mobile (N6) */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-0.5 overflow-x-auto scrollbar-hide">
          {TIPO_TOGGLES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ ...state, tipoEntidad: t.value })}
              className={`text-[10px] px-2 py-1 rounded transition-colors whitespace-nowrap ${
                state.tipoEntidad === t.value
                  ? `font-bold ${TOGGLE_ACTIVE_BG[t.color]}`
                  : `font-medium ${TOGGLE_INACTIVE_TEXT[t.color]}`
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Aging dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAgingOpen((v) => !v)}
            className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg flex items-center gap-1.5"
          >
            <Clock className="w-3 h-3" />
            Aging: <strong className="text-slate-900">{AGING_LABEL[state.aging]}</strong>
            <ChevronDown className="w-3 h-3" />
          </button>
          {agingOpen && (
            <div
              className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-[160px]"
              onMouseLeave={() => setAgingOpen(false)}
            >
              {(Object.entries(AGING_LABEL) as Array<[FiltroAging, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    onChange({ ...state, aging: value });
                    setAgingOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[11px] hover:bg-slate-50 ${
                    state.aging === value ? 'bg-emerald-50 text-emerald-700 font-bold' : ''
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Checkbox solo con saldo */}
        <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={state.soloConSaldo}
            onChange={(e) => onChange({ ...state, soloConSaldo: e.target.checked })}
            className="rounded text-teal-600 focus:ring-teal-500"
          />
          <span>Solo con saldo</span>
        </label>
      </div>

      {/* Chips filtros activos */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
          <span className="text-slate-500">Activos:</span>
          {state.busqueda.trim() && (
            <ActiveChip
              label={`"${state.busqueda.trim()}"`}
              onClear={() => onChange({ ...state, busqueda: '' })}
            />
          )}
          {state.tipoEntidad !== 'todas' && (
            <ActiveChip
              label={tipoActual.label}
              onClear={() => onChange({ ...state, tipoEntidad: 'todas' })}
            />
          )}
          {state.aging !== 'todos' && (
            <ActiveChip
              label={`Aging ${AGING_LABEL[state.aging]}`}
              onClear={() => onChange({ ...state, aging: 'todos' })}
            />
          )}
          {!state.soloConSaldo && (
            <ActiveChip
              label="Incluye sin saldo"
              onClear={() => onChange({ ...state, soloConSaldo: true })}
            />
          )}
          <button
            type="button"
            onClick={onLimpiarTodo}
            className="text-rose-600 hover:underline ml-1"
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
};

interface ActiveChipProps {
  label: string;
  onClear: () => void;
}

const ActiveChip: React.FC<ActiveChipProps> = ({ label, onClear }) => (
  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
    {label}
    <button type="button" onClick={onClear} aria-label="Quitar filtro">
      <X className="w-2.5 h-2.5" />
    </button>
  </span>
);

// ═════════════════════════════════════════════════════════════════════════
// HELPERS PARA EL PADRE
// ═════════════════════════════════════════════════════════════════════════

export function defaultFiltrosCC(): FiltrosCCState {
  return {
    busqueda: '',
    tipoEntidad: 'todas',
    aging: 'todos',
    soloConSaldo: true,
  };
}

export function contarFiltrosCCActivos(f: FiltrosCCState): number {
  let count = 0;
  if (f.busqueda.trim()) count++;
  if (f.tipoEntidad !== 'todas') count++;
  if (f.aging !== 'todos') count++;
  if (!f.soloConSaldo) count++;
  return count;
}
