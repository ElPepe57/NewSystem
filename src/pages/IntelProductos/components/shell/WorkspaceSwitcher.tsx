/**
 * WorkspaceSwitcher · 5 tabs analíticos · Cost Intelligence
 *
 * Patrón Notion/Linear · subviews por URL · keyboard 1-5 cambia workspace.
 * Cada workspace muestra opcionalmente un badge con count (alertas, etc).
 *
 * Mockup canónico: docs/mockups/cost-intelligence-vision-s3.6.html · Sección 1
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, DollarSign, GitBranch, Zap, TrendingUp } from 'lucide-react';

export type WorkspaceId = 'catalogo' | 'costos' | 'pipeline' | 'alertas' | 'forecast';

interface WorkspaceConfig {
  id: WorkspaceId;
  path: string;          // URL slug (sin /intel-productos prefix)
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  // Color tokens: aplicados solo cuando el workspace está activo
  activeColor: 'teal' | 'amber' | 'purple' | 'rose' | 'sky';
}

const WORKSPACES: readonly WorkspaceConfig[] = [
  {
    id: 'catalogo',
    path: '',
    label: 'Catálogo',
    icon: LayoutGrid,
    description: 'Lista valorizada · density-first',
    activeColor: 'teal',
  },
  {
    id: 'costos',
    path: 'costos',
    label: 'Costos',
    icon: DollarSign,
    description: 'Time-series · variance · TCPA',
    activeColor: 'amber',
  },
  {
    id: 'pipeline',
    path: 'pipeline',
    label: 'Pipeline',
    icon: GitBranch,
    description: '6 etapas valorización · capital atrapado',
    activeColor: 'purple',
  },
  {
    id: 'alertas',
    path: 'alertas',
    label: 'Alertas',
    icon: Zap,
    description: 'Anomaly detection · variance threshold',
    activeColor: 'rose',
  },
  {
    id: 'forecast',
    path: 'forecast',
    label: 'Forecast',
    icon: TrendingUp,
    description: 'Proyecciones 30/60/90d · what-if',
    activeColor: 'sky',
  },
] as const;

// Mapping de color tokens a clases Tailwind (literales para que JIT detecte)
const ACTIVE_CLASSES: Record<WorkspaceConfig['activeColor'], { border: string; bg: string; text: string; iconText: string }> = {
  teal:   { border: 'border-teal-300',   bg: 'bg-teal-50',   text: 'text-teal-900',   iconText: 'text-teal-700' },
  amber:  { border: 'border-amber-300',  bg: 'bg-amber-50',  text: 'text-amber-900',  iconText: 'text-amber-700' },
  purple: { border: 'border-purple-300', bg: 'bg-purple-50', text: 'text-purple-900', iconText: 'text-purple-700' },
  rose:   { border: 'border-rose-300',   bg: 'bg-rose-50',   text: 'text-rose-900',   iconText: 'text-rose-700' },
  sky:    { border: 'border-sky-300',    bg: 'bg-sky-50',    text: 'text-sky-900',    iconText: 'text-sky-700' },
};

const INACTIVE_CLASSES = {
  border: 'border-slate-200',
  bg: 'bg-white hover:bg-slate-50',
  text: 'text-slate-700',
  iconText: 'text-slate-500',
};

interface WorkspaceSwitcherProps {
  activeId: WorkspaceId;
  /** Badges opcionales con count para mostrar al lado del label (ej. alertas: 3) */
  badges?: Partial<Record<WorkspaceId, number>>;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ activeId, badges }) => {
  const navigate = useNavigate();

  const handleClick = (path: string) => {
    navigate(path ? `/intel-productos/${path}` : '/intel-productos');
  };

  // Keyboard nav 1-5 cambia workspace
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignorar si el foco está en un input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      const key = e.key;
      const idx = ['1', '2', '3', '4', '5'].indexOf(key);
      if (idx >= 0 && idx < WORKSPACES.length) {
        e.preventDefault();
        handleClick(WORKSPACES[idx].path);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {WORKSPACES.map((ws, idx) => {
        const isActive = ws.id === activeId;
        const classes = isActive ? ACTIVE_CLASSES[ws.activeColor] : INACTIVE_CLASSES;
        const Icon = ws.icon;
        const badge = badges?.[ws.id];
        return (
          <button
            key={ws.id}
            type="button"
            onClick={() => handleClick(ws.path)}
            className={`relative border rounded-lg p-3 text-left transition-colors ${classes.border} ${classes.bg}`}
            title={`${ws.label} · presiona ${idx + 1}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${classes.iconText}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${classes.text}`}>
                  {ws.label}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {badge !== undefined && badge > 0 && (
                  <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                    {badge}
                  </span>
                )}
                <kbd className="hidden sm:inline-block text-[8px] font-mono font-bold bg-slate-800 text-white px-1 py-0.5 rounded">
                  {idx + 1}
                </kbd>
              </div>
            </div>
            <div className={`text-[10px] ${classes.iconText}`}>{ws.description}</div>
          </button>
        );
      })}
    </div>
  );
};

export { WORKSPACES };
