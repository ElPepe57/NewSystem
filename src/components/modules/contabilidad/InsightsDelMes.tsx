/**
 * InsightsDelMes · canon v5.2 chk5.E-C · Sprint C
 *
 * Card con 4-6 hallazgos automáticos del mes · narrativos · cross-link contextual.
 *
 * Pixel-perfect contra docs/mockups/contabilidad-insights-mes-v5.2.html
 */

import React from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Zap,
  Repeat,
  AlertCircle,
  CreditCard,
  Clock,
  Package,
  AlertOctagon,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Insight, InsightPolaridad } from '../../../utils/contabilidadInsights';

interface Props {
  insights: Insight[];
  /** Período display · ej. "Mayo 2026" */
  periodo: string;
}

// Map de iconName (string) → componente lucide
const ICON_MAP: Record<string, LucideIcon> = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  zap: Zap,
  repeat: Repeat,
  'alert-circle': AlertCircle,
  'credit-card': CreditCard,
  clock: Clock,
  package: Package,
  'alert-octagon': AlertOctagon,
};

// Styles por polaridad
const POLARIDAD_STYLES: Record<
  InsightPolaridad,
  {
    label: string;
    rowBg: string;
    iconBg: string;
    iconBorder: string;
    iconColor: string;
    titleColor: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  positivo: {
    label: 'POSITIVO',
    rowBg: 'hover:bg-emerald-50/20',
    iconBg: 'bg-emerald-50',
    iconBorder: 'border-emerald-200',
    iconColor: 'text-emerald-700',
    titleColor: 'text-slate-900',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
  },
  neutral: {
    label: 'NEUTRAL',
    rowBg: 'hover:bg-slate-50/40',
    iconBg: 'bg-sky-50',
    iconBorder: 'border-sky-200',
    iconColor: 'text-sky-700',
    titleColor: 'text-slate-900',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
  },
  atencion: {
    label: 'ATENCIÓN',
    rowBg: 'bg-amber-50/20 hover:bg-amber-50/30',
    iconBg: 'bg-amber-50',
    iconBorder: 'border-amber-300',
    iconColor: 'text-amber-700',
    titleColor: 'text-amber-900',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  critico: {
    label: 'CRÍTICO',
    rowBg: 'bg-rose-50/20 hover:bg-rose-50/30',
    iconBg: 'bg-rose-50',
    iconBorder: 'border-rose-300',
    iconColor: 'text-rose-700',
    titleColor: 'text-rose-900',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
  },
};

export const InsightsDelMes: React.FC<Props> = ({ insights, periodo }) => {
  const navigate = useNavigate();

  if (insights.length === 0) {
    return null; // No renderizar si no hay insights
  }

  // Conteo por polaridad para el footer
  const conteo = insights.reduce(
    (acc, i) => {
      acc[i.polaridad]++;
      return acc;
    },
    { positivo: 0, neutral: 0, atencion: 0, critico: 0 } as Record<InsightPolaridad, number>,
  );

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          Insights del mes · {periodo}
        </h3>
        <span className="text-[10px] text-slate-500">
          Generado automáticamente · {insights.length} {insights.length === 1 ? 'hallazgo' : 'hallazgos'}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {insights.map((i) => {
          const style = POLARIDAD_STYLES[i.polaridad];
          const Icon = ICON_MAP[i.iconName] || AlertCircle;
          return (
            <div
              key={i.id}
              className={`px-5 py-3 flex items-start gap-3 transition-colors ${style.rowBg}`}
            >
              <div
                className={`w-8 h-8 rounded-lg ${style.iconBg} border ${style.iconBorder} flex items-center justify-center flex-shrink-0`}
              >
                <Icon className={`w-4 h-4 ${style.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[12px] font-semibold ${style.titleColor} mb-0.5`}>
                  {i.titulo}
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{i.descripcion}</p>
                {i.crossLink && (
                  <button
                    type="button"
                    onClick={() => navigate(i.crossLink!.ruta)}
                    className={`text-[10px] hover:underline font-bold mt-1.5 flex items-center gap-1 ${style.titleColor}`}
                  >
                    {i.crossLink.label} <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              <span
                className={`text-[9px] ${style.badgeBg} ${style.badgeText} px-1.5 py-0.5 rounded font-bold whitespace-nowrap`}
              >
                {style.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer conteo */}
      <div className="bg-slate-50 px-5 py-2 border-t border-slate-200 flex items-center justify-between text-[10px] flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {conteo.positivo > 0 && (
            <span className="text-emerald-700 font-bold">{conteo.positivo} positivo{conteo.positivo > 1 ? 's' : ''}</span>
          )}
          {conteo.neutral > 0 && (
            <span className="text-sky-700 font-bold">{conteo.neutral} neutral{conteo.neutral > 1 ? 'es' : ''}</span>
          )}
          {conteo.atencion > 0 && (
            <span className="text-amber-700 font-bold">{conteo.atencion} atención</span>
          )}
          {conteo.critico > 0 && (
            <span className="text-rose-700 font-bold">{conteo.critico} crítico{conteo.critico > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </section>
  );
};

export default InsightsDelMes;
