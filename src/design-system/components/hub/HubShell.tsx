/**
 * HubShell · Hub Kit L5 · card contenedor canónico de un módulo hub.
 *
 * Envuelve toda la anatomía del módulo (HubTopBar → HubHeader → HubKpiStrip →
 * HubTabs → HubBody) en UN recuadro continuo. El body va DENTRO (nunca cards
 * sueltas afuera del shell).
 *
 * Spec: docs/mockups/hub-kit-implementacion-v1.html
 * Tokens: radius.shell (rounded-2xl) · elevation.resting (shadow-sm) · border.default.
 */
import React from 'react';

interface HubShellProps {
  children: React.ReactNode;
  /** Override de clases (raro · el shell no debería necesitarlo). */
  className?: string;
}

export const HubShell: React.FC<HubShellProps> = ({ children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);
