/**
 * HubHeader · Hub Kit L5 · header banking-grade del shell hub.
 *
 * Icono tonal (cuadro con gradient del grupo) + h1 + subtítulo + acciones 3-tier (N10).
 * El icono y el primary CTA HEREDAN el color del grupo vía grupoColor.ts (Modelo A).
 *
 * Jerarquía 3-tier de acciones (canon N10):
 *   primary → color del módulo (1 sola · acción principal)
 *   config  → indigo (settings / políticas)
 *   neutral → blanco/slate (secundarias frecuentes · default)
 *
 * Spec: docs/mockups/hub-kit-implementacion-v1.html (ACTO 1/2/4).
 */
import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { chromeDe, type GrupoSidebar } from '../../grupoColor';

export interface HubHeaderAccion {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  /** Jerarquía cromática · default 'neutral'. Solo UNA acción debería ser 'primary'.
   *  'danger' (rose) = acción destructiva/delicada de header (ej. dar de baja). */
  tier?: 'primary' | 'config' | 'neutral' | 'danger';
  disabled?: boolean;
}

interface HubHeaderProps {
  /** Grupo del sidebar → color del icono tonal + del primary CTA (heredado). */
  grupo: GrupoSidebar;
  /** Icono lucide del módulo (va en el cuadro tonal). */
  icon: LucideIcon;
  titulo: string;
  subtitulo?: string;
  acciones?: HubHeaderAccion[];
  /** Contenido custom al inicio del área de acciones (antes de los botones · ej. selector de período). */
  extraActions?: React.ReactNode;
  className?: string;
}

const TIER_CONFIG = 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-medium';
const TIER_DANGER = 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-medium';
const TIER_NEUTRAL = 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium';

export const HubHeader: React.FC<HubHeaderProps> = ({
  grupo,
  icon: Icon,
  titulo,
  subtitulo,
  acciones = [],
  extraActions,
  className = '',
}) => {
  const C = chromeDe(grupo);

  return (
    <div className={`px-4 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4 flex-wrap ${className}`}>
      <div className="flex items-start gap-3 flex-1 min-w-[260px]">
        <div className={`w-11 h-11 rounded-xl ${C.headerIcon} flex items-center justify-center text-white flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{titulo}</h1>
          {subtitulo && <p className="text-[13px] text-slate-500 leading-snug max-w-2xl mt-0.5">{subtitulo}</p>}
        </div>
      </div>

      {(extraActions || acciones.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {extraActions}
          {acciones.map((a, i) => {
            const Ai = a.icon;
            const tier = a.tier ?? 'neutral';
            const tierClass =
              tier === 'primary' ? `${C.primaryBtn} font-semibold`
              : tier === 'config' ? TIER_CONFIG
              : tier === 'danger' ? TIER_DANGER
              : TIER_NEUTRAL;
            return (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                disabled={a.disabled}
                title={a.label}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${tierClass}`}
              >
                {Ai && <Ai className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{a.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
