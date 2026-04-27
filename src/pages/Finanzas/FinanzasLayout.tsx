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

import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  ChartPie,
  Handshake,
  ArrowRightLeft,
  type LucideIcon,
} from 'lucide-react';
import { PageShell, PageHeader } from '../../design-system';
import { cn } from '../../design-system';
import { FinanzasKPIBar } from './FinanzasKPIBar';

// ─── Tabs config ───────────────────────────────────────────────────────

const TABS = [
  { path: '/finanzas', label: 'Overview', icon: ChartPie, end: true },
  { path: '/finanzas/saldos', label: 'Saldos', icon: Handshake, end: false },
  { path: '/finanzas/cash-flow', label: 'Cash flow', icon: ArrowRightLeft, end: false },
];

/**
 * Identidad visual + propósito de cada sub-vista. Lo que aterriza
 * la diferencia entre las 3 cuando el usuario llega.
 *
 *  - Overview  → ChartPie : pantalla de mando ejecutiva
 *  - Saldos    → Handshake: relaciones con entidades (CxC + CxP)
 *  - Cash flow → ArrowRightLeft: dinero entrando y saliendo
 */
interface VistaConfig {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  /** Frase ancla que explica para qué sirve esta vista (1 oración). */
  intro: string;
}

const VISTAS: Record<string, VistaConfig> = {
  '/finanzas': {
    title: 'Finanzas · Overview',
    subtitle: 'Pantalla de mando · Decisiones rápidas con un solo vistazo',
    icon: ChartPie,
    intro:
      'Tu salud financiera de un vistazo: lo que tienes, lo que te deben, lo que debes y cómo se mueve el flujo este mes.',
  },
  '/finanzas/saldos': {
    title: 'Finanzas · Saldos',
    subtitle: 'Quién te debe · A quién le debes',
    icon: Handshake,
    intro:
      'Vista relacional por entidad: clientes, proveedores, colaboradores y empleados con saldo. Aquí gestionas la cobranza y los pagos.',
  },
  '/finanzas/cash-flow': {
    title: 'Finanzas · Cash flow',
    subtitle: 'El dinero entrando y saliendo de tus cuentas',
    icon: ArrowRightLeft,
    intro:
      'Cada movimiento real de dinero por cuenta bancaria, caja y billeteras. Conversiones, transferencias internas y tarjetas viven aquí.',
  },
};

const VISTA_FALLBACK: VistaConfig = {
  title: 'Finanzas',
  subtitle: 'Hub financiero',
  icon: ChartPie,
  intro: '',
};

// ─── Componente ────────────────────────────────────────────────────────
//
// IMPORTANTE: Este layout NO tiene state ni Outlet context.
// Cada sub-vista renderiza sus propios actions inline (no en el header
// global). Esto evita re-renders del layout cuando las hijas montan/
// desmontan, lo cual causaba un bug en React 18 + StrictMode + React
// Router donde el Outlet quedaba congelado en la sub-vista anterior.

const FinanzasLayout: React.FC = () => {
  const location = useLocation();
  const vista = VISTAS[location.pathname] ?? VISTA_FALLBACK;

  return (
    <PageShell>
      <PageHeader
        title={vista.title}
        subtitle={vista.subtitle}
        icon={vista.icon}
      />

      {/* Tabs sticky — debajo del header global */}
      <div className="sticky top-0 z-10 bg-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-slate-200">
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

      {/* Intro line — aclara qué hace esta sub-vista en 1 oración */}
      {vista.intro && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 mt-3 mb-4 flex items-start gap-2.5">
          <vista.icon className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
          <p className="text-[12px] text-slate-700 leading-relaxed">
            {vista.intro}
          </p>
        </div>
      )}

      {/* KPI strip compartido — visible en las 3 sub-vistas */}
      <FinanzasKPIBar />

      {/* Contenido específico de la sub-vista */}
      <Outlet />
    </PageShell>
  );
};

export default FinanzasLayout;
