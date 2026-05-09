/**
 * PillsRapidos · atajos rápidos de filtro · módulo Productos V2
 *
 * Mockup canónico: docs/mockups/productos/33-filtros-rapidos-pills.html
 *
 * Estados visuales:
 *   - Default: pill soft (bg-{color}-50)
 *   - Activo: pill solid (bg-{color}-600 + ring-2 ring-{color}-200)
 *   - Activo "Todos": dark (bg-slate-900)
 *   - Count = 0: disabled visualmente (slate-100 + cursor-not-allowed)
 */

import React from 'react';
import { Grid3x3, Check, AlertTriangle, Search, Package2, type LucideIcon } from 'lucide-react';

export type PillKey = 'todos' | 'activos' | 'stock_critico' | 'sin_investigar' | 'packs';

export interface PillCounts {
  todos: number;
  activos: number;
  stock_critico: number;
  sin_investigar: number;
  packs: number;
}

interface PillsRapidosProps {
  counts: PillCounts;
  active: PillKey;
  onChange: (key: PillKey) => void;
}

interface PillConfig {
  key: PillKey;
  label: string;
  icon: LucideIcon;
  variant: 'dark' | 'emerald' | 'rose' | 'amber' | 'purple';
}

const PILLS: PillConfig[] = [
  { key: 'todos', label: 'Todos', icon: Grid3x3, variant: 'dark' },
  { key: 'activos', label: 'Activos', icon: Check, variant: 'emerald' },
  { key: 'stock_critico', label: 'Stock crítico', icon: AlertTriangle, variant: 'rose' },
  { key: 'sin_investigar', label: 'Sin investigar', icon: Search, variant: 'amber' },
  { key: 'packs', label: 'Packs', icon: Package2, variant: 'purple' },
];

const VARIANT_STYLES = {
  dark: { soft: 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50', solid: 'bg-slate-900 text-white shadow-sm' },
  emerald: { soft: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100', solid: 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-200' },
  rose: { soft: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100', solid: 'bg-rose-600 text-white shadow-md ring-2 ring-rose-200' },
  amber: { soft: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100', solid: 'bg-amber-600 text-white shadow-md ring-2 ring-amber-200' },
  purple: { soft: 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100', solid: 'bg-purple-600 text-white shadow-md ring-2 ring-purple-200' },
};

const DISABLED_CLASSES = 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed';

export const PillsRapidos: React.FC<PillsRapidosProps> = ({ counts, active, onChange }) => {
  return (
    // Desktop ≥lg: flex-wrap normal · Mobile <lg: scroll horizontal con scrollbar-hide + fade-x-edges (F12)
    <div className="overflow-x-auto scrollbar-hide fade-x-edges lg:overflow-visible mb-3">
      <div className="flex items-center gap-2 lg:flex-wrap min-w-max lg:min-w-0">
      {PILLS.map(pill => {
        const count = counts[pill.key];
        const isActive = active === pill.key;
        const isDisabled = count === 0 && pill.key !== 'todos';
        const styles = VARIANT_STYLES[pill.variant];
        const baseClasses = isDisabled
          ? DISABLED_CLASSES
          : isActive
          ? styles.solid
          : styles.soft;

        return (
          <button
            key={pill.key}
            onClick={() => !isDisabled && onChange(pill.key)}
            disabled={isDisabled}
            type="button"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${baseClasses}`}
          >
            <pill.icon className="w-3 h-3" />
            <span>{pill.label}</span>
            <span className={`tabular-nums ${isActive ? 'text-white/70' : 'opacity-60'}`}>{count}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
};
