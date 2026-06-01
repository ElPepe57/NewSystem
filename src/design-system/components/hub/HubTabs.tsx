/**
 * HubTabs · Hub Kit L5 · tabs de sub-sección del shell hub.
 *
 * Fila border-b con el tab activo en border-b-2 + texto del COLOR DEL GRUPO
 * (chromeDe(grupo).tabActive · heredado). Scroll-x en mobile (canon N6 · nunca
 * wrap). Badge opcional con color SEMÁNTICO (default rose = urgencia/atención).
 *
 * Canon hub: la 1ª tab siempre es "Resumen" (dashboard ejecutivo) — eso lo decide
 * el módulo en el array `tabs`, no el componente.
 *
 * Spec: docs/mockups/hub-kit-implementacion-v1.html (ACTO 1/2/4).
 */
import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { chromeDe, type GrupoSidebar } from '../../grupoColor';

export type HubTabBadgeTono = 'rose' | 'amber' | 'emerald' | 'slate';

export interface HubTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Badge numérico/texto opcional (ej. nº de alertas). */
  badge?: string | number;
  /** Color del badge (semántico) · default 'rose' (urgencia). */
  badgeTono?: HubTabBadgeTono;
}

interface HubTabsProps {
  /** Grupo del sidebar → color del tab activo (heredado). */
  grupo: GrupoSidebar;
  tabs: HubTab[];
  /** id de la tab activa. */
  activa: string;
  onChange: (id: string) => void;
  className?: string;
}

// Clases LITERALES del badge por tono semántico (JIT-safe).
const BADGE: Record<HubTabBadgeTono, string> = {
  rose: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  slate: 'bg-slate-100 text-slate-700',
};

export const HubTabs: React.FC<HubTabsProps> = ({ grupo, tabs, activa, onChange, className = '' }) => {
  const C = chromeDe(grupo);

  return (
    <div className={`border-b border-slate-200 px-4 sm:px-6 ${className}`}>
      <div className="flex gap-1 overflow-x-auto -mb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const Ti = t.icon;
          const isActive = t.id === activa;
          const hayBadge = t.badge != null && t.badge !== '';
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`whitespace-nowrap px-3 py-2.5 text-[13px] border-b-2 flex items-center gap-1.5 transition-colors ${
                isActive
                  ? `${C.tabActive} font-semibold`
                  : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
              }`}
            >
              {Ti && <Ti className="w-4 h-4" />}
              {t.label}
              {hayBadge && (
                <span className={`text-[9px] ${BADGE[t.badgeTono ?? 'rose']} px-1.5 rounded-full font-bold tabular-nums`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
