/**
 * FiltrosCashFlowBar — chk5.D-S3.quater · SF5
 *
 * Barra de filtros canon MOCK 9 §1 · selector de horizonte + checkboxes
 * de escenarios visibles + botón filtros avanzados.
 *
 * Estado controlled · padre maneja FiltrosCashFlowState.
 */

import React from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import type { FiltrosCashFlowState, EscenarioCashFlow, HorizonteCashFlow } from './cashFlowHelpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface FiltrosCashFlowBarProps {
  state: FiltrosCashFlowState;
  onChange: (state: FiltrosCashFlowState) => void;
  /** Click "Filtros avanzados" · placeholder S4 */
  onFiltrosAvanzados?: () => void;
}

const HORIZONTES: Array<{ value: HorizonteCashFlow; label: string }> = [
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
  { value: 90, label: '90d' },
];

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const FiltrosCashFlowBar: React.FC<FiltrosCashFlowBarProps> = ({
  state,
  onChange,
  onFiltrosAvanzados,
}) => {
  const toggleEscenario = (esc: EscenarioCashFlow) => {
    const next = new Set(state.escenariosVisibles);
    if (next.has(esc)) {
      // No permitir desmarcar 'base' (siempre activo)
      if (esc === 'base') return;
      next.delete(esc);
    } else {
      next.add(esc);
    }
    onChange({ ...state, escenariosVisibles: next });
  };

  return (
    <div className="border-b border-slate-200 px-6 py-3 bg-slate-50/50 flex flex-wrap items-center gap-2">
      {/* Horizonte toggle */}
      <span className="text-[11px] font-bold text-slate-700">Horizonte:</span>
      <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5">
        {HORIZONTES.map((h) => (
          <button
            key={h.value}
            type="button"
            onClick={() => onChange({ ...state, horizonte: h.value })}
            className={`px-3 py-1 text-[11px] rounded transition-colors whitespace-nowrap ${
              state.horizonte === h.value
                ? 'font-bold bg-teal-600 text-white'
                : 'font-medium text-slate-600 hover:bg-slate-50'
            }`}
          >
            {h.label}
          </button>
        ))}
      </div>

      <span className="text-slate-300 mx-2 hidden sm:inline">·</span>

      {/* Escenarios visibles */}
      <span className="text-[11px] font-bold text-slate-700">Escenarios:</span>
      <div className="flex items-center gap-1 flex-wrap">
        <EscenarioToggle
          label="Optimista +15%"
          color="emerald"
          active={state.escenariosVisibles.has('optimista')}
          onClick={() => toggleEscenario('optimista')}
        />
        <EscenarioToggle
          label="Base"
          color="indigo"
          active={state.escenariosVisibles.has('base')}
          onClick={() => toggleEscenario('base')}
          destacado
        />
        <EscenarioToggle
          label="Pesimista −20%"
          color="rose"
          active={state.escenariosVisibles.has('pesimista')}
          onClick={() => toggleEscenario('pesimista')}
        />
      </div>

      <button
        type="button"
        onClick={onFiltrosAvanzados}
        className="ml-auto text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
      >
        <Filter className="w-3 h-3" />
        Filtros avanzados
        <ChevronDown className="w-3 h-3" />
      </button>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

interface EscenarioToggleProps {
  label: string;
  color: 'emerald' | 'indigo' | 'rose';
  active: boolean;
  destacado?: boolean;
  onClick: () => void;
}

const ESC_BG: Record<EscenarioToggleProps['color'], string> = {
  emerald: 'bg-emerald-50',
  indigo: 'bg-indigo-50',
  rose: 'bg-rose-50',
};

const ESC_RING_ACTIVE: Record<EscenarioToggleProps['color'], string> = {
  emerald: 'ring-emerald-200',
  indigo: 'ring-indigo-400',
  rose: 'ring-rose-200',
};

const ESC_TEXT: Record<EscenarioToggleProps['color'], string> = {
  emerald: 'text-emerald-900',
  indigo: 'text-indigo-900',
  rose: 'text-rose-900',
};

const ESC_CHECKBOX_TEXT: Record<EscenarioToggleProps['color'], string> = {
  emerald: 'text-emerald-600',
  indigo: 'text-indigo-600',
  rose: 'text-rose-600',
};

const EscenarioToggle: React.FC<EscenarioToggleProps> = ({
  label,
  color,
  active,
  destacado,
  onClick,
}) => (
  <label
    className={`flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer ring-${
      destacado ? '2' : '1'
    } ${ESC_BG[color]} ${
      active ? ESC_RING_ACTIVE[color] : 'ring-slate-200 opacity-50'
    }`}
  >
    <input
      type="checkbox"
      checked={active}
      onChange={onClick}
      className={`rounded ${ESC_CHECKBOX_TEXT[color]}`}
    />
    <span className={`text-[10px] font-bold ${ESC_TEXT[color]}`}>{label}</span>
  </label>
);
