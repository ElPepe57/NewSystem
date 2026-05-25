/**
 * BannerEstadoNegocio · canon v5.2 chk5.E-C · Sprint C
 *
 * Banner al tope del tab Resumen · 3 estados (Saludable / Atención / Crítico)
 * con icon + estado + razones objetivas (grid 4) + acciones contextuales.
 *
 * Pixel-perfect contra docs/mockups/contabilidad-banner-salud-v5.2.html
 */

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Check,
  BarChart3,
} from 'lucide-react';
import type {
  ResultadoEstadoNegocio,
  EstadoNegocio,
  RazonEstado,
} from '../../../utils/contabilidadInsights';

interface Props {
  resultado: ResultadoEstadoNegocio;
  /** Período display · ej. "Mayo 2026" */
  periodo: string;
  /** Callback para acción "Ver indicadores" */
  onVerIndicadores?: () => void;
  /** Callback para acción "Ver alertas" */
  onVerAlertas?: () => void;
}

// Color signature por estado
const ESTADO_STYLES: Record<
  EstadoNegocio,
  {
    label: string;
    gradient: string;
    ring: string;
    iconBg: string;
    iconShadow: string;
    titleColor: string;
    subtitleColor: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  saludable: {
    label: 'Saludable',
    gradient: 'bg-gradient-to-r from-emerald-50 via-emerald-100/40 to-emerald-50',
    ring: 'ring-2 ring-emerald-200',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
    iconShadow: 'shadow-lg shadow-emerald-200',
    titleColor: 'text-emerald-900',
    subtitleColor: 'text-emerald-700',
    Icon: CheckCircle2,
  },
  atencion: {
    label: 'Atención',
    gradient: 'bg-gradient-to-r from-amber-50 via-amber-100/40 to-amber-50',
    ring: 'ring-2 ring-amber-200',
    iconBg: 'bg-gradient-to-br from-amber-500 to-amber-700',
    iconShadow: 'shadow-lg shadow-amber-200',
    titleColor: 'text-amber-900',
    subtitleColor: 'text-amber-700',
    Icon: AlertTriangle,
  },
  critico: {
    label: 'Crítico',
    gradient: 'bg-gradient-to-r from-rose-50 via-rose-100/40 to-rose-50',
    ring: 'ring-2 ring-rose-300',
    iconBg: 'bg-gradient-to-br from-rose-600 to-rose-800',
    iconShadow: 'shadow-lg shadow-rose-200',
    titleColor: 'text-rose-900',
    subtitleColor: 'text-rose-700',
    Icon: AlertOctagon,
  },
};

// Color signature de razón individual (card 2.5)
const RAZON_STYLES: Record<
  RazonEstado['polaridad'],
  {
    bgRing: string;
    titleColor: string;
    iconColor: string;
    metaColor: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  ok: {
    bgRing: 'ring-1 ring-emerald-200/60',
    titleColor: 'text-emerald-700',
    iconColor: 'text-emerald-700',
    metaColor: 'text-slate-500',
    Icon: Check,
  },
  warning: {
    bgRing: 'ring-1 ring-amber-300/80',
    titleColor: 'text-amber-700',
    iconColor: 'text-amber-700',
    metaColor: 'text-amber-700',
    Icon: AlertCircle,
  },
  critico: {
    bgRing: 'ring-1 ring-rose-300/80',
    titleColor: 'text-rose-700',
    iconColor: 'text-rose-700',
    metaColor: 'text-rose-700',
    Icon: AlertCircle,
  },
};

export const BannerEstadoNegocio: React.FC<Props> = ({
  resultado,
  periodo,
  onVerIndicadores,
}) => {
  const style = ESTADO_STYLES[resultado.estado];
  const Icon = style.Icon;
  const tieneAcciones = resultado.acciones && resultado.acciones.length > 0;

  return (
    <section className={`${style.gradient} ${style.ring} rounded-2xl p-5`}>
      <div className="flex items-start gap-4 flex-wrap">
        {/* Icon + estado */}
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div
            className={`w-14 h-14 rounded-2xl ${style.iconBg} flex items-center justify-center text-white flex-shrink-0 ${style.iconShadow}`}
          >
            <Icon className="w-7 h-7" />
          </div>
          <div>
            <div className={`text-[11px] uppercase tracking-wider ${style.subtitleColor} font-bold`}>
              Estado del negocio
            </div>
            <div className={`text-[22px] font-bold ${style.titleColor} leading-tight`}>
              {style.label}
            </div>
            <div className={`text-[11px] ${style.subtitleColor}`}>
              {periodo} · {resultado.indicadoresOK} de {resultado.indicadoresTotal} señales positivas
            </div>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="flex items-center gap-2">
          {onVerIndicadores && (
            <button
              type="button"
              onClick={onVerIndicadores}
              className={
                resultado.estado === 'saludable'
                  ? 'text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-1'
                  : 'text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg flex items-center gap-1'
              }
            >
              <BarChart3 className="w-3 h-3" />
              Ver indicadores
            </button>
          )}
        </div>
      </div>

      {/* Razones objetivas · grid 4 */}
      {resultado.razones.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
          {resultado.razones.slice(0, 4).map((r, i) => {
            const rs = RAZON_STYLES[r.polaridad];
            const Icon = rs.Icon;
            return (
              <div key={i} className={`bg-white/80 ${rs.bgRing} rounded-lg p-2.5`}>
                <div className={`text-[10px] ${rs.titleColor} font-bold flex items-center gap-1 mb-0.5`}>
                  <Icon className={`w-3 h-3 ${rs.iconColor}`} />
                  {r.titulo}
                </div>
                <div className="text-[12px] font-bold text-slate-900 tabular-nums">
                  {r.valor}
                </div>
                <div className={`text-[9px] ${rs.metaColor}`}>{r.meta}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Acciones sugeridas · solo si estado != saludable */}
      {tieneAcciones && resultado.estado !== 'saludable' && (
        <div
          className={`mt-4 pt-3 border-t ${
            resultado.estado === 'critico' ? 'border-rose-200/60' : 'border-amber-200/60'
          } ${
            resultado.estado === 'critico' ? 'bg-rose-50/50' : 'bg-amber-50/50'
          } -mx-5 -mb-5 px-5 py-3 rounded-b-2xl`}
        >
          <div
            className={`text-[10px] uppercase tracking-wider font-bold mb-1.5 ${
              resultado.estado === 'critico' ? 'text-rose-700' : 'text-amber-700'
            }`}
          >
            {resultado.estado === 'critico' ? 'Acciones urgentes' : 'Acciones sugeridas'}
          </div>
          <ul
            className={`text-[11px] space-y-1 list-disc ml-4 ${
              resultado.estado === 'critico' ? 'text-rose-900' : 'text-amber-900'
            }`}
          >
            {resultado.acciones!.slice(0, 4).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default BannerEstadoNegocio;
