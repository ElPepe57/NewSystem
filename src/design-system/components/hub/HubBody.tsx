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
  /** Contenido full-width ARRIBA del grid (dentro del body). Ej: banner de borrador. */
  aboveGrid?: React.ReactNode;
  /** El contenido YA trae su propio padding → el body solo aporta el fondo (sin padding propio). */
  flush?: boolean;
  className?: string;
}

export const HubBody: React.FC<HubBodyProps> = ({ children, aside, aboveGrid, flush, className = '' }) => {
  const pad = flush ? '' : 'p-3 sm:p-4 md:p-6';
  // Layout A · main(2) + aside(1) · aside apila debajo del main en mobile
  if (aside) {
    return (
      <div className={`bg-slate-50/30 ${pad} space-y-4 ${className}`}>
        {aboveGrid}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">{children}</div>
          <aside className="md:col-span-1 space-y-4">{aside}</aside>
        </div>
      </div>
    );
  }

  // Layout B · full-width apilado (flush = el contenido auto-paddea · body solo aporta fondo)
  return (
    <div className={`bg-slate-50/30 ${pad} ${flush ? '' : 'space-y-4'} ${className}`}>
      {aboveGrid}
      {children}
    </div>
  );
};
