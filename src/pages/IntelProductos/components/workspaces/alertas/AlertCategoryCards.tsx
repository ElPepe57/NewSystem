/**
 * AlertCategoryCards · 4 category cards filtrables · Workspace Alertas
 *
 * chk5.B10b (S3.6 M1.bis · Cost Intelligence) · pixel-perfect contra mockup
 * `cost-intelligence-alertas.html · Sec 1 · Panel 1`.
 *
 * 4 cards (Variance · Pipeline · FX · Stock) clickeables que actúan como
 * filtros por categoría. Stock queda placeholder gris hasta integrar módulo
 * Inventario (DEUDA-B10b-STOCK).
 */

import React from 'react';
import { TrendingUp, Clock, DollarSign, Package } from 'lucide-react';
import type { AlertaCategoria, AlertasConsolidadas } from '../../../utils/costIntelligence';
import { ALERTA_CATEGORIA_LABELS } from '../../../utils/costIntelligence';

interface AlertCategoryCardsProps {
  consolidadas: AlertasConsolidadas;
  categoriaSeleccionada: AlertaCategoria | null;
  onSeleccionar: (categoria: AlertaCategoria | null) => void;
}

interface CategoryVariant {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  bgIcon: string;
  textPrimary: string;
  textSecondary: string;
  isPlaceholder?: boolean;
}

const VARIANTS: Record<AlertaCategoria, CategoryVariant> = {
  variance: {
    icon: TrendingUp,
    bg: 'bg-rose-50/50',
    border: 'border-rose-200',
    bgIcon: 'bg-white border-rose-300',
    textPrimary: 'text-rose-700',
    textSecondary: 'text-rose-600',
  },
  pipeline: {
    icon: Clock,
    bg: 'bg-amber-50/50',
    border: 'border-amber-200',
    bgIcon: 'bg-white border-amber-300',
    textPrimary: 'text-amber-700',
    textSecondary: 'text-amber-600',
  },
  fx: {
    icon: DollarSign,
    bg: 'bg-sky-50/50',
    border: 'border-sky-200',
    bgIcon: 'bg-white border-sky-300',
    textPrimary: 'text-sky-700',
    textSecondary: 'text-sky-600',
  },
  stock: {
    icon: Package,
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    bgIcon: 'bg-white border-slate-300',
    textPrimary: 'text-slate-400',
    textSecondary: 'text-slate-400',
    isPlaceholder: true,
  },
};

export const AlertCategoryCards: React.FC<AlertCategoryCardsProps> = ({
  consolidadas,
  categoriaSeleccionada,
  onSeleccionar,
}) => {
  const order: AlertaCategoria[] = ['variance', 'pipeline', 'fx', 'stock'];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {order.map((cat) => {
        const v = VARIANTS[cat];
        const count = consolidadas.countByCategoria[cat] ?? 0;
        const Icon = v.icon;
        const isActive = categoriaSeleccionada === cat;

        // Sub-texto por categoría
        let subText = '';
        if (v.isPlaceholder) {
          subText = 'Próximo · DEUDA';
        } else if (count === 0) {
          subText = 'Sin alertas';
        } else if (cat === 'variance') {
          const criticas = consolidadas.alertas.filter((a) => a.category === 'variance' && a.severity === 'critica').length;
          const altas = consolidadas.alertas.filter((a) => a.category === 'variance' && a.severity === 'alta').length;
          subText = [criticas && `${criticas} crítica${criticas > 1 ? 's' : ''}`, altas && `${altas} alta${altas > 1 ? 's' : ''}`]
            .filter(Boolean).join(' · ') || `${count} alerta${count > 1 ? 's' : ''}`;
        } else if (cat === 'pipeline') {
          subText = `SKUs estancados >threshold`;
        } else if (cat === 'fx') {
          subText = 'Desviación SBS';
        }

        const clickable = !v.isPlaceholder;

        return (
          <button
            type="button"
            key={cat}
            onClick={() => clickable && onSeleccionar(isActive ? null : cat)}
            disabled={!clickable}
            className={`${v.bg} border ${v.border} rounded-xl p-3 transition-all text-left ${
              clickable ? 'hover:-translate-y-[1px]' : 'opacity-50 cursor-default'
            } ${isActive ? 'ring-2 ring-teal-500' : ''}`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`w-6 h-6 rounded-md ${v.bgIcon} border flex items-center justify-center`}>
                <Icon className={`w-3 h-3 ${v.textPrimary}`} />
              </div>
              <span className={`text-[10px] font-bold ${v.textPrimary} uppercase tracking-wider`}>
                {ALERTA_CATEGORIA_LABELS[cat]}
              </span>
            </div>
            <div className={`text-lg font-bold tabular-nums ${v.textPrimary}`}>
              {v.isPlaceholder ? '—' : count}
            </div>
            <div className={`text-[10px] mt-0.5 ${v.textSecondary}`}>{subText}</div>
          </button>
        );
      })}
    </div>
  );
};
