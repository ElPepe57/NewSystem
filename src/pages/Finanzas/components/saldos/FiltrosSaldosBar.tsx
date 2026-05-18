/**
 * FiltrosSaldosBar — chk5.D-S3.ter · SF4
 *
 * Barra de filtros para la sub-vista Saldos · canon MOCK 6 §1 filtros.
 *
 * Filtros canon:
 *   1. Búsqueda · nombre · banco · N° · CCI · titular
 *   2. Tipo dropdown · 7 opciones (Todos + 6 kinds)
 *   3. Moneda toggle · Todas / PEN / USD
 *   4. Titular dropdown · Todos / Empresa / Personal / Recaudador
 *   5. Checkbox "Solo activas" (default true)
 *   6. Link "Limpiar filtros"
 *
 * Toolbar inferior (export separado):
 *   - Resumen "8 productos · S/ 86,420 + $ 4,820"
 *   - Agrupar por: Titular · Tipo · Moneda · Banco
 *   - Toggle vista lista/grid
 */

import React, { useState } from 'react';
import {
  Search,
  Layers,
  User,
  Filter,
  ChevronDown,
  X,
  List,
  Grid,
} from 'lucide-react';
import {
  KIND_LABEL_CORTO,
  TITULAR_GRUPO_LABEL,
  type FiltrosSaldosState,
  type KindProductoSaldo,
  type TitularGrupo,
  type GrupoSaldos,
} from './saldosHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS · FILTROS
// ═════════════════════════════════════════════════════════════════════════

export interface FiltrosSaldosBarProps {
  state: FiltrosSaldosState;
  onChange: (state: FiltrosSaldosState) => void;
  activeCount: number;
  onLimpiarTodo: () => void;
}

const KIND_OPCIONES: Array<{ value: 'todos' | KindProductoSaldo; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'cuenta_bancaria', label: KIND_LABEL_CORTO.cuenta_bancaria },
  { value: 'wallet_digital', label: KIND_LABEL_CORTO.wallet_digital },
  { value: 'tarjeta_credito', label: KIND_LABEL_CORTO.tarjeta_credito },
  { value: 'tarjeta_debito', label: KIND_LABEL_CORTO.tarjeta_debito },
  { value: 'caja_efectivo', label: KIND_LABEL_CORTO.caja_efectivo },
  { value: 'caja_recaudadora', label: KIND_LABEL_CORTO.caja_recaudadora },
];

const TITULAR_OPCIONES: Array<{ value: 'todos' | TitularGrupo; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'empresa', label: TITULAR_GRUPO_LABEL.empresa },
  { value: 'personal', label: TITULAR_GRUPO_LABEL.personal },
  { value: 'recaudador', label: TITULAR_GRUPO_LABEL.recaudador },
];

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE FILTROS
// ═════════════════════════════════════════════════════════════════════════

export const FiltrosSaldosBar: React.FC<FiltrosSaldosBarProps> = ({
  state,
  onChange,
  activeCount,
  onLimpiarTodo,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tipoOpen, setTipoOpen] = useState(false);
  const [titularOpen, setTitularOpen] = useState(false);

  const tipoLabel =
    KIND_OPCIONES.find((o) => o.value === state.kindFiltro)?.label ?? 'Todos';
  const titularLabel =
    TITULAR_OPCIONES.find((o) => o.value === state.titularFiltro)?.label ?? 'Todos';

  return (
    <div className="border-b border-slate-200 px-6 py-3 bg-slate-50/50 space-y-2">
      {/* Mobile collapsible · N5 */}
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
              activeCount > 0 ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {activeCount > 0 ? `${activeCount} activos` : 'Sin filtros'}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${mobileOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div className={`${mobileOpen ? 'block' : 'hidden'} sm:flex flex-wrap items-center gap-2`}>
        {/* Búsqueda */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={state.busqueda}
            onChange={(e) => onChange({ ...state, busqueda: e.target.value })}
            placeholder="Buscar cuenta · banco · N° · CCI · titular..."
            className="w-full pl-9 pr-3 py-2 text-[12px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200"
          />
        </div>

        {/* Tipo dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTipoOpen((v) => !v)}
            className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg flex items-center gap-1.5"
          >
            <Layers className="w-3 h-3" />
            Tipo: <span className="font-bold text-slate-900">{tipoLabel}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {tipoOpen && (
            <div
              className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-[200px]"
              onMouseLeave={() => setTipoOpen(false)}
            >
              {KIND_OPCIONES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange({ ...state, kindFiltro: o.value });
                    setTipoOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[11px] hover:bg-slate-50 ${
                    state.kindFiltro === o.value ? 'bg-teal-50 text-teal-700 font-bold' : ''
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Moneda toggle · 3 opciones */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
          {(['todas', 'PEN', 'USD'] as const).map((m) => {
            const active = state.monedaFiltro === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ ...state, monedaFiltro: m })}
                className={`text-[10px] px-2 py-1 rounded transition-colors whitespace-nowrap ${
                  active ? 'font-bold bg-teal-600 text-white' : 'font-medium text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m === 'todas' ? 'Todas' : m}
              </button>
            );
          })}
        </div>

        {/* Titular dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTitularOpen((v) => !v)}
            className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg flex items-center gap-1.5"
          >
            <User className="w-3 h-3" />
            Titular: <span className="font-bold text-slate-900">{titularLabel}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {titularOpen && (
            <div
              className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-[200px]"
              onMouseLeave={() => setTitularOpen(false)}
            >
              {TITULAR_OPCIONES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange({ ...state, titularFiltro: o.value });
                    setTitularOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[11px] hover:bg-slate-50 ${
                    state.titularFiltro === o.value ? 'bg-teal-50 text-teal-700 font-bold' : ''
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Solo activas */}
        <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={state.soloActivas}
            onChange={(e) => onChange({ ...state, soloActivas: e.target.checked })}
            className="rounded text-teal-600 focus:ring-teal-500"
          />
          <span>Solo activas</span>
        </label>

        {/* Limpiar · alineado a la derecha */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onLimpiarTodo}
            className="text-[11px] text-rose-600 hover:underline sm:ml-auto"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Chips activos · siempre visible si hay alguno */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
          <span className="text-slate-500">Activos:</span>
          {state.busqueda.trim() && (
            <ActiveChip
              label={`"${state.busqueda.trim()}"`}
              onClear={() => onChange({ ...state, busqueda: '' })}
            />
          )}
          {state.kindFiltro !== 'todos' && (
            <ActiveChip
              label={tipoLabel}
              onClear={() => onChange({ ...state, kindFiltro: 'todos' })}
            />
          )}
          {state.monedaFiltro !== 'todas' && (
            <ActiveChip
              label={state.monedaFiltro}
              onClear={() => onChange({ ...state, monedaFiltro: 'todas' })}
            />
          )}
          {state.titularFiltro !== 'todos' && (
            <ActiveChip
              label={titularLabel}
              onClear={() => onChange({ ...state, titularFiltro: 'todos' })}
            />
          )}
          {!state.soloActivas && (
            <ActiveChip
              label="Incluye inactivas"
              onClear={() => onChange({ ...state, soloActivas: true })}
            />
          )}
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
// TOOLBAR AGRUPACIÓN · canon mockup §1 toolbar inferior
// ═════════════════════════════════════════════════════════════════════════

export type VistaSaldos = 'lista' | 'grid';

export interface ToolbarAgruparSaldosProps {
  /** Resumen "8 productos · S/ 86,420 + $ 4,820" */
  resumen: string;
  agrupacion: GrupoSaldos;
  onAgrupacionChange: (g: GrupoSaldos) => void;
  vista: VistaSaldos;
  onVistaChange: (v: VistaSaldos) => void;
}

export const ToolbarAgruparSaldos: React.FC<ToolbarAgruparSaldosProps> = ({
  resumen,
  agrupacion,
  onAgrupacionChange,
  vista,
  onVistaChange,
}) => {
  const OPCIONES: Array<{ value: GrupoSaldos; label: string }> = [
    { value: 'titular', label: 'Titular' },
    { value: 'tipo', label: 'Tipo' },
    { value: 'moneda', label: 'Moneda' },
    { value: 'banco', label: 'Banco' },
  ];

  return (
    <div className="border-b border-slate-200 px-6 py-2 flex items-center justify-between bg-white gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-[11px] flex-wrap">
        <span className="text-slate-500">{resumen}</span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-700">Agrupar por:</span>
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 overflow-x-auto scrollbar-hide">
          {OPCIONES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onAgrupacionChange(o.value)}
              className={`px-3 py-1 text-[11px] rounded transition-colors whitespace-nowrap ${
                agrupacion === o.value
                  ? 'bg-white text-teal-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:bg-slate-50 font-medium'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => onVistaChange('lista')}
          title="Vista listado"
          aria-label="Vista listado"
          className={`p-1 rounded transition-colors ${
            vista === 'lista' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:bg-white'
          }`}
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onVistaChange('grid')}
          title="Vista grilla"
          aria-label="Vista grilla"
          className={`p-1 rounded transition-colors ${
            vista === 'grid' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:bg-white'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
