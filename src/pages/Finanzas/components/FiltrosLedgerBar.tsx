/**
 * FiltrosLedgerBar — chk5.D-S3 · SF4
 *
 * Barra de filtros del ledger de movimientos · canon MOCK 7 §1 filtros + toolbar.
 * Pixel-perfect contra `docs/mockups/finanzas-vista-movimientos-v5.1.html`.
 *
 * Diseño N5 (filtros colapsables mobile · canon v8.0) · N6 (scroll horizontal
 * en mobile cuando hay muchas chips · canon v8.0).
 *
 * Componentes:
 *   - <FiltrosLedgerBar /> · filtros principales (búsqueda · rango · cuenta · tipo toggle)
 *     + chips filtros activos + botón limpiar
 *   - <ToolbarAgrupacion /> · toolbar inferior (count · agrupación Día/Sem/Mes/Cat + toggle vista)
 *
 * Estado:
 *   - controlled · padre maneja el FiltrosLedgerState
 *
 * NOTA: el rango fechas + cuenta selector usan componentes nativos por ahora.
 * En sprint futuro se pueden migrar a un date-picker + combobox propio del DS.
 */

import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Wallet,
  X,
  Filter,
  ChevronDown,
  List,
  GitCommit,
  CalendarRange,
  Eye,
} from 'lucide-react';
import type { AgrupacionLedger } from './LedgerMovimientos';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS · estado del ledger
// ═════════════════════════════════════════════════════════════════════════

export type TipoFiltroMovimiento = 'todos' | 'ingresos' | 'egresos' | 'conversiones' | 'transferencias';
export type VistaLedger = 'lista' | 'timeline' | 'calendario';

export interface FiltrosLedgerState {
  /** Texto búsqueda · matchea contra concepto, referencia, número mov, tercero */
  busqueda: string;
  /** Fecha inicio (incluido) */
  fechaInicio: Date;
  /** Fecha fin (incluido) */
  fechaFin: Date;
  /** ID de cuenta filtrada · null = todas */
  cuentaId: string | null;
  /** Tipo de movimiento filtrado */
  tipo: TipoFiltroMovimiento;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS · formato
// ═════════════════════════════════════════════════════════════════════════

function fmtFechaCorta(d: Date): string {
  return d
    .toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
    .replace('.', '');
}

function fmtRangoFechas(inicio: Date, fin: Date): string {
  return `${fmtFechaCorta(inicio)} al ${fmtFechaCorta(fin)}`;
}

// ═════════════════════════════════════════════════════════════════════════
// FILTROS LEDGER BAR
// ═════════════════════════════════════════════════════════════════════════

export interface FiltrosLedgerBarProps {
  state: FiltrosLedgerState;
  onChange: (state: FiltrosLedgerState) => void;
  /** Lista de cuentas disponibles para el select · {id, nombre, moneda} */
  cuentas: Array<{ id: string; nombre: string; moneda?: string }>;
  /** Cuántos filtros están activos (calculado por el padre) · usado en mobile collapse */
  activeCount: number;
  /** Callback para limpiar TODOS los filtros · vuelve a defaults */
  onLimpiarTodo: () => void;
}

export const FiltrosLedgerBar: React.FC<FiltrosLedgerBarProps> = ({
  state,
  onChange,
  cuentas,
  activeCount,
  onLimpiarTodo,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [cuentaPickerOpen, setCuentaPickerOpen] = useState(false);

  const cuentaActual = cuentas.find((c) => c.id === state.cuentaId);

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

      {/* Filtros row · siempre visible en desktop · collapse en mobile */}
      <div
        className={`${
          mobileOpen ? 'block' : 'hidden'
        } sm:flex flex-wrap items-center gap-2`}
      >
        {/* Búsqueda */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={state.busqueda}
            onChange={(e) => onChange({ ...state, busqueda: e.target.value })}
            placeholder="Buscar referencia · tercero · concepto · monto..."
            className="w-full pl-9 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200"
          />
        </div>

        {/* Rango fechas · simplificado con dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setDatePickerOpen((v) => !v)}
            className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg flex items-center gap-1.5"
          >
            <Calendar className="w-3 h-3" />
            {fmtRangoFechas(state.fechaInicio, state.fechaFin)}
            <ChevronDown className="w-3 h-3" />
          </button>
          {datePickerOpen && (
            <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-20 w-[280px]">
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={fmtDateInput(state.fechaInicio)}
                    onChange={(e) =>
                      onChange({ ...state, fechaInicio: new Date(e.target.value) })
                    }
                    className="w-full mt-1 px-2 py-1.5 text-[12px] border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={fmtDateInput(state.fechaFin)}
                    onChange={(e) =>
                      onChange({ ...state, fechaFin: new Date(e.target.value) })
                    }
                    className="w-full mt-1 px-2 py-1.5 text-[12px] border border-slate-200 rounded"
                  />
                </div>
                <div className="flex gap-1 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const hoy = new Date();
                      const inicio = new Date(hoy);
                      inicio.setDate(1);
                      onChange({ ...state, fechaInicio: inicio, fechaFin: hoy });
                      setDatePickerOpen(false);
                    }}
                    className="text-[10px] text-teal-700 hover:bg-teal-50 px-2 py-1 rounded flex-1"
                  >
                    Este mes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const hoy = new Date();
                      const inicio = new Date(hoy);
                      inicio.setDate(inicio.getDate() - 30);
                      onChange({ ...state, fechaInicio: inicio, fechaFin: hoy });
                      setDatePickerOpen(false);
                    }}
                    className="text-[10px] text-teal-700 hover:bg-teal-50 px-2 py-1 rounded flex-1"
                  >
                    Últimos 30d
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatePickerOpen(false)}
                    className="text-[10px] text-slate-500 hover:bg-slate-100 px-2 py-1 rounded"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cuenta selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setCuentaPickerOpen((v) => !v)}
            className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg flex items-center gap-1.5"
          >
            <Wallet className="w-3 h-3" />
            Cuenta:{' '}
            <strong className="text-slate-900">
              {cuentaActual ? cuentaActual.nombre : 'Todas'}
            </strong>
            <ChevronDown className="w-3 h-3" />
          </button>
          {cuentaPickerOpen && (
            <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-[240px] max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  onChange({ ...state, cuentaId: null });
                  setCuentaPickerOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[11px] hover:bg-slate-50 ${
                  state.cuentaId === null ? 'bg-teal-50 text-teal-700 font-bold' : ''
                }`}
              >
                Todas las cuentas
              </button>
              {cuentas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange({ ...state, cuentaId: c.id });
                    setCuentaPickerOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[11px] hover:bg-slate-50 flex items-center justify-between ${
                    state.cuentaId === c.id ? 'bg-teal-50 text-teal-700 font-bold' : ''
                  }`}
                >
                  <span className="truncate">{c.nombre}</span>
                  {c.moneda && (
                    <span className="text-[9px] text-slate-500 ml-2">{c.moneda}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tipo toggle (4 opciones) · canon mockup */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
          <TipoToggleButton
            label="Todos"
            active={state.tipo === 'todos'}
            color="teal"
            onClick={() => onChange({ ...state, tipo: 'todos' })}
          />
          <TipoToggleButton
            label="+ Ingresos"
            active={state.tipo === 'ingresos'}
            color="emerald"
            onClick={() => onChange({ ...state, tipo: 'ingresos' })}
          />
          <TipoToggleButton
            label="− Egresos"
            active={state.tipo === 'egresos'}
            color="rose"
            onClick={() => onChange({ ...state, tipo: 'egresos' })}
          />
          <TipoToggleButton
            label="↔ Internos"
            active={state.tipo === 'conversiones' || state.tipo === 'transferencias'}
            color="indigo"
            onClick={() => onChange({ ...state, tipo: 'conversiones' })}
          />
        </div>
      </div>

      {/* Chips filtros activos · siempre visible si activeCount > 0 */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
          <span className="text-slate-500">Activos:</span>
          {state.busqueda.trim() && (
            <ActiveChip
              label={`"${state.busqueda.trim()}"`}
              onClear={() => onChange({ ...state, busqueda: '' })}
              color="slate"
            />
          )}
          <ActiveChip label={fmtRangoFechas(state.fechaInicio, state.fechaFin)} color="teal" />
          {cuentaActual && (
            <ActiveChip
              label={cuentaActual.nombre}
              onClear={() => onChange({ ...state, cuentaId: null })}
              color="slate"
            />
          )}
          {state.tipo !== 'todos' && (
            <ActiveChip
              label={state.tipo}
              onClear={() => onChange({ ...state, tipo: 'todos' })}
              color="slate"
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

// ═════════════════════════════════════════════════════════════════════════
// TOOLBAR AGRUPACIÓN + VISTA
// ═════════════════════════════════════════════════════════════════════════

export interface ToolbarAgrupacionProps {
  /** Resumen · "142 movimientos · S/ 32K ingresos · S/ 24K egresos" */
  resumen: string;
  agrupacion: AgrupacionLedger;
  onAgrupacionChange: (a: AgrupacionLedger) => void;
  vista: VistaLedger;
  onVistaChange: (v: VistaLedger) => void;
}

export const ToolbarAgrupacion: React.FC<ToolbarAgrupacionProps> = ({
  resumen,
  agrupacion,
  onAgrupacionChange,
  vista,
  onVistaChange,
}) => {
  return (
    <div className="border-b border-slate-200 px-6 py-2 flex items-center justify-between bg-white gap-3 flex-wrap">
      {/* Resumen + agrupación toggle */}
      <div className="flex items-center gap-2 text-[11px] flex-wrap">
        <span className="text-slate-500">{resumen}</span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-700">Agrupar:</span>
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 overflow-x-auto scrollbar-hide">
          <AgrupacionButton
            label="Día"
            active={agrupacion === 'dia'}
            onClick={() => onAgrupacionChange('dia')}
          />
          <AgrupacionButton
            label="Semana"
            active={agrupacion === 'semana'}
            onClick={() => onAgrupacionChange('semana')}
          />
          <AgrupacionButton
            label="Mes"
            active={agrupacion === 'mes'}
            onClick={() => onAgrupacionChange('mes')}
          />
          <AgrupacionButton
            label="Categoría"
            active={agrupacion === 'categoria'}
            onClick={() => onAgrupacionChange('categoria')}
          />
        </div>
      </div>

      {/* Vista toggle (lista / timeline / calendario) */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
        <VistaButton
          icon={List}
          active={vista === 'lista'}
          title="Vista listado"
          onClick={() => onVistaChange('lista')}
        />
        <VistaButton
          icon={GitCommit}
          active={vista === 'timeline'}
          title="Vista timeline"
          onClick={() => onVistaChange('timeline')}
        />
        <VistaButton
          icon={CalendarRange}
          active={vista === 'calendario'}
          title="Vista calendario"
          onClick={() => onVistaChange('calendario')}
        />
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═════════════════════════════════════════════════════════════════════════

interface TipoToggleButtonProps {
  label: string;
  active: boolean;
  color: 'teal' | 'emerald' | 'rose' | 'indigo';
  onClick: () => void;
}

const TIPO_TOGGLE_ACTIVE: Record<TipoToggleButtonProps['color'], string> = {
  teal: 'bg-teal-600 text-white',
  emerald: 'bg-emerald-600 text-white',
  rose: 'bg-rose-600 text-white',
  indigo: 'bg-indigo-600 text-white',
};

const TIPO_TOGGLE_INACTIVE: Record<TipoToggleButtonProps['color'], string> = {
  teal: 'text-teal-700 hover:bg-teal-50',
  emerald: 'text-emerald-700 hover:bg-emerald-50',
  rose: 'text-rose-700 hover:bg-rose-50',
  indigo: 'text-indigo-700 hover:bg-indigo-50',
};

const TipoToggleButton: React.FC<TipoToggleButtonProps> = ({
  label,
  active,
  color,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-[10px] font-${
      active ? 'bold' : 'medium'
    } px-2 py-1 rounded transition-colors whitespace-nowrap ${
      active ? TIPO_TOGGLE_ACTIVE[color] : TIPO_TOGGLE_INACTIVE[color]
    }`}
  >
    {label}
  </button>
);

interface ActiveChipProps {
  label: string;
  color: 'teal' | 'slate';
  onClear?: () => void;
}

const CHIP_BG: Record<ActiveChipProps['color'], string> = {
  teal: 'bg-teal-100 text-teal-700',
  slate: 'bg-slate-100 text-slate-700',
};

const ActiveChip: React.FC<ActiveChipProps> = ({ label, color, onClear }) => (
  <span
    className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${CHIP_BG[color]}`}
  >
    {label}
    {onClear && (
      <button type="button" onClick={onClear} aria-label="Quitar filtro">
        <X className="w-2.5 h-2.5" />
      </button>
    )}
  </span>
);

interface AgrupacionButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const AgrupacionButton: React.FC<AgrupacionButtonProps> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1 text-[11px] rounded transition-colors whitespace-nowrap ${
      active
        ? 'bg-white text-teal-700 shadow-sm font-bold'
        : 'text-slate-600 hover:bg-slate-50 font-medium'
    }`}
  >
    {label}
  </button>
);

interface VistaButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  title: string;
  onClick: () => void;
}

const VistaButton: React.FC<VistaButtonProps> = ({ icon: Icon, active, title, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`p-1 rounded transition-colors ${
      active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:bg-white'
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
  </button>
);

// ═════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═════════════════════════════════════════════════════════════════════════

function fmtDateInput(d: Date): string {
  // YYYY-MM-DD para <input type="date">
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Suprime warning de import no usado · Eye se reservó para futura extensión
void Eye;
