/**
 * HubBody · Hub Kit L5 · cuerpo del shell hub. Resuelve los 2 layouts con UN componente:
 *
 *   Layout A · con `aside`  → grid main(2/3) + aside(1/3). Para dashboards operativos
 *                            con contexto persistente. En mobile el aside apila DEBAJO.
 *   Layout B · sin `aside`  → contenido full-width apilado (space-y-4). Para directorios,
 *                            tablas, estados financieros.
 *
 * Va DENTRO del shell (1 recuadro continuo · fondo bg-slate-50/30 · padding responsive).
 * El `max-w-6xl` lo aplica la página al envolver el HubShell, no este componente.
 *
 * Spec: docs/mockups/hub-kit-implementacion-v1.html (ACTO 1 = A · ACTO 2 = B · ACTO 6 = mobile).
 */
import React from 'react';

interface HubBodyProps {
  children: React.ReactNode;
  /** Si se pasa → Layout A (main + aside). Sin aside → Layout B (full-width). */
  aside?: React.ReactNode;
  className?: string;
}

export const HubBody: React.FC<HubBodyProps> = ({ children, aside, className = '' }) => {
  // Layout A · main(2) + aside(1) · aside apila debajo del main en mobile
  if (aside) {
    return (
      <div className={`bg-slate-50/30 px-4 sm:px-6 py-5 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">{children}</div>
          <aside className="md:col-span-1 space-y-4">{aside}</aside>
        </div>
      </div>
    );
  }

  // Layout B · full-width apilado
  return (
    <div className={`bg-slate-50/30 px-4 sm:px-6 py-5 space-y-4 ${className}`}>
      {children}
    </div>
  );
};
