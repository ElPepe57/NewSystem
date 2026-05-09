/**
 * InventarioPills · pills rápidos canónicos del módulo Inventario (chk4.7c)
 *
 * Patrón visual: idéntico al `PillsRapidos` del design-system (Productos).
 * Diferencia: 5 pills propios del dominio Inventario:
 *   - todos · disponibles · stock_critico · vencen_pronto · en_transito
 *
 * Candidato a promover a versión genérica del design-system cuando M1.bis,
 * M2 (Ventas) u otros módulos requieran pills similares con keys distintas.
 * Por ahora se mantiene page-scoped para evitar abstracción prematura.
 *
 * Mockup canónico: docs/mockups/stock-canon-s3.6-X.html
 */

import React from 'react';
import { Grid3x3, Check, AlertTriangle, Clock, Truck, type LucideIcon } from 'lucide-react';

export type PillInventario = 'todos' | 'disponibles' | 'stock_critico' | 'vencen_pronto' | 'en_transito';

export interface PillInventarioCounts {
  todos: number;
  disponibles: number;
  stock_critico: number;
  vencen_pronto: number;
  en_transito: number;
}

interface InventarioPillsProps {
  counts: PillInventarioCounts;
  active: PillInventario;
  onChange: (key: PillInventario) => void;
}

interface PillConfig {
  key: PillInventario;
  label: string;
  icon: LucideIcon;
  variant: 'dark' | 'emerald' | 'rose' | 'amber' | 'sky';
}

const PILLS: PillConfig[] = [
  { key: 'todos',          label: 'Todos',         icon: Grid3x3,        variant: 'dark' },
  { key: 'disponibles',    label: 'Disponibles',   icon: Check,          variant: 'emerald' },
  { key: 'stock_critico',  label: 'Stock crítico', icon: AlertTriangle,  variant: 'rose' },
  { key: 'vencen_pronto',  label: 'Vencen pronto', icon: Clock,          variant: 'amber' },
  { key: 'en_transito',    label: 'En tránsito',   icon: Truck,          variant: 'sky' },
];

const VARIANT_STYLES = {
  dark:    { soft: 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
             solid: 'bg-slate-900 text-white shadow-sm' },
  emerald: { soft: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
             solid: 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-200' },
  rose:    { soft: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100',
             solid: 'bg-rose-600 text-white shadow-md ring-2 ring-rose-200' },
  amber:   { soft: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
             solid: 'bg-amber-600 text-white shadow-md ring-2 ring-amber-200' },
  sky:     { soft: 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100',
             solid: 'bg-sky-600 text-white shadow-md ring-2 ring-sky-200' },
};

const DISABLED_CLASSES = 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed';

export const InventarioPills: React.FC<InventarioPillsProps> = ({ counts, active, onChange }) => {
  return (
    <div className="overflow-x-auto scrollbar-hide lg:overflow-visible">
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
              <span className={`tabular-nums ${isActive ? 'text-white/70' : 'opacity-60'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
