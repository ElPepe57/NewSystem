/**
 * WorkspaceSwitcher · pills canon · Cost Intelligence
 *
 * chk5.B6 (S3.6 M1.bis · Cost Intelligence) · refactor pixel-perfect contra
 * canon Productos V2 `PillsRapidos`. Reemplaza el grid de cards anterior
 * por pills compactos color-coded:
 *
 *   - Pill activo: bg-slate-900 text-white shadow-sm (canon)
 *   - Pills inactivos: bg-{color}-50 text-{color}-700 border border-{color}-200
 *   - Keyboard hints kbd (1-5) integrados en cada pill
 *   - Count opcional por workspace (badges count futuros)
 *
 * Mobile: scroll horizontal (overflow-x-auto)
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Sec 1+3
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, DollarSign, GitBranch, Zap, TrendingUp } from 'lucide-react';

export type WorkspaceId = 'catalogo' | 'costos' | 'pipeline' | 'alertas' | 'forecast';

interface WorkspaceConfig {
  id: WorkspaceId;
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Color tokens · solo se aplica si el workspace está inactivo */
  color: 'teal' | 'amber' | 'purple' | 'rose' | 'sky';
}

const WORKSPACES: readonly WorkspaceConfig[] = [
  { id: 'catalogo', path: '',         label: 'Catálogo',  icon: LayoutGrid, color: 'teal' },
  { id: 'costos',   path: 'costos',   label: 'Costos',    icon: DollarSign, color: 'amber' },
  { id: 'pipeline', path: 'pipeline', label: 'Pipeline',  icon: GitBranch,  color: 'purple' },
  { id: 'alertas',  path: 'alertas',  label: 'Alertas',   icon: Zap,        color: 'rose' },
  { id: 'forecast', path: 'forecast', label: 'Forecast',  icon: TrendingUp, color: 'sky' },
] as const;

// Clases literales para Tailwind JIT
const INACTIVE_BY_COLOR: Record<WorkspaceConfig['color'], string> = {
  teal:   'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100',
  amber:  'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
  purple: 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100',
  rose:   'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100',
  sky:    'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100',
};

interface WorkspaceSwitcherProps {
  activeId: WorkspaceId;
  /** Count opcional para mostrar al lado del label (ej. alertas: 7) */
  counts?: Partial<Record<WorkspaceId, number>>;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ activeId, counts }) => {
  const navigate = useNavigate();

  const navigateTo = React.useCallback((path: string) => {
    navigate(path ? `/intel-productos/${path}` : '/intel-productos');
  }, [navigate]);

  // Keyboard nav 1-5 cambia workspace (canon · descubrible via KeyboardHints)
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      const idx = ['1', '2', '3', '4', '5'].indexOf(e.key);
      if (idx >= 0 && idx < WORKSPACES.length) {
        e.preventDefault();
        navigateTo(WORKSPACES[idx].path);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateTo]);

  return (
    <div className="flex items-center gap-2 flex-wrap mb-3 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
      {WORKSPACES.map((ws, idx) => {
        const isActive = ws.id === activeId;
        const Icon = ws.icon;
        const count = counts?.[ws.id];
        const baseClasses = 'flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all';
        const activeClasses = 'bg-slate-900 text-white shadow-sm';
        const inactiveClasses = INACTIVE_BY_COLOR[ws.color];

        return (
          <button
            key={ws.id}
            type="button"
            onClick={() => navigateTo(ws.path)}
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
            title={`${ws.label} · presiona ${idx + 1}`}
          >
            <Icon className="w-3 h-3" />
            {ws.label}
            {count !== undefined && count > 0 && (
              <span className={`tabular-nums ${isActive ? 'text-white/70' : 'opacity-60'}`}>
                {count}
              </span>
            )}
            <kbd className={`ml-0.5 text-[8px] font-mono px-1 py-0.5 rounded ${
              isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {idx + 1}
            </kbd>
          </button>
        );
      })}
    </div>
  );
};

export { WORKSPACES };
