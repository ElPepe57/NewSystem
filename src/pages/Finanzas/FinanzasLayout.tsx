/**
 * FinanzasLayout — S57 Fase C+ · Shell unificado del hub Finanzas
 *
 * Envuelve las 3 sub-vistas (Overview, Saldos, Cash flow) bajo un mismo
 * header con tabs sticky, eliminando la sensación de "módulos aislados".
 *
 * Estilo Stripe/Mercury: header global "Finanzas" + sub-tabs persistentes
 * + contenido específico via <Outlet />.
 *
 * Cada página hija puede declarar sus propios `actions` (botones del header)
 * usando `useOutletContext<FinanzasOutletContext>()` y llamando `setActions`
 * dentro de un useEffect.
 */

import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { ChartPie, Handshake, ArrowRightLeft, Coins } from 'lucide-react';
import { PageShell, PageHeader } from '../../design-system';
import { cn } from '../../design-system';
import { FinanzasKPIBar } from './FinanzasKPIBar';

// ─── Outlet context type ───────────────────────────────────────────────

export interface FinanzasOutletContext {
  /**
   * Declara los actions (botones) que el layout mostrará en el header.
   * Llamar dentro de un useEffect; recordar resetear con `null` en cleanup.
   */
  setActions: (actions: React.ReactNode) => void;
}

// ─── Tabs config ───────────────────────────────────────────────────────

const TABS = [
  { path: '/finanzas', label: 'Overview', icon: ChartPie, end: true },
  { path: '/finanzas/saldos', label: 'Saldos', icon: Handshake, end: false },
  { path: '/finanzas/cash-flow', label: 'Cash flow', icon: ArrowRightLeft, end: false },
];

const SUBTITLES: Record<string, string> = {
  '/finanzas': 'Vista financiera consolidada',
  '/finanzas/saldos': 'Cuentas corrientes por entidad',
  '/finanzas/cash-flow': 'Movimientos por cuenta bancaria',
};

// ─── Componente ────────────────────────────────────────────────────────

const FinanzasLayout: React.FC = () => {
  const location = useLocation();
  const [actions, setActions] = useState<React.ReactNode>(null);
  const subtitle = SUBTITLES[location.pathname] ?? 'Hub financiero';

  return (
    <PageShell>
      <PageHeader
        title="Finanzas"
        subtitle={subtitle}
        icon={Coins}
        actions={actions}
      />

      {/* Tabs sticky — debajo del header global */}
      <div className="sticky top-0 z-10 bg-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-slate-200 mb-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'text-[13px] px-4 py-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-teal-600 text-teal-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700',
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* KPI strip compartido — visible en las 3 sub-vistas */}
      <FinanzasKPIBar />

      {/* Contenido específico de la sub-vista */}
      <Outlet context={{ setActions } satisfies FinanzasOutletContext} />
    </PageShell>
  );
};

export default FinanzasLayout;
