import React from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Info, Zap, ArrowRight, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface Insight {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  icon: 'trending-up' | 'trending-down' | 'alert-triangle' | 'info' | 'zap' | 'check';
  titulo: string;
  descripcion: string;
  impacto?: string;
  accion?: { label: string; link: string };
}

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    titleColor: 'text-rose-900',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-900',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-900',
  },
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-900',
  },
};

const ICONS = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'alert-triangle': AlertTriangle,
  'info': Info,
  'zap': Zap,
  'check': CheckCircle,
};

export const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
  const config = SEVERITY_CONFIG[insight.severity];
  const Icon = ICONS[insight.icon];

  return (
    <div className={`${config.bg} ${config.border} border rounded-xl p-4 flex items-start gap-3`}>
      <div className={`${config.iconBg} rounded-lg p-2 flex-shrink-0`}>
        <Icon className={`h-4 w-4 ${config.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={`font-semibold text-sm ${config.titleColor}`}>{insight.titulo}</h4>
          {insight.impacto && (
            <span className={`text-xs font-bold ${config.iconColor} flex-shrink-0`}>
              {insight.impacto}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{insight.descripcion}</p>
        {insight.accion && (
          <Link
            to={insight.accion.link}
            className={`inline-flex items-center gap-1 mt-2 text-xs font-medium ${config.iconColor} hover:underline`}
          >
            {insight.accion.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
};
