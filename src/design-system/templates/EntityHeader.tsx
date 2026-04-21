/**
 * EntityHeader — Encabezado del detalle de una entidad.
 *
 * Patrón canónico S52 — ver `docs/DESIGN_PATTERNS.md` → Patrón 1.
 *
 * Estructura (derivada del estándar OrdenCompraCard):
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  [breadcrumb]                                                  │
 *   │  Título grande font-mono                [badges alineados     │
 *   │  Subtítulo opcional                      derecha]              │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * USO:
 *   <EntityHeader
 *     breadcrumb="Órdenes de Compra"
 *     titulo="OC-2026-001"
 *     subtitulo="Amazon · USA"
 *     badges={
 *       <>
 *         <StatusBadge variant="warning">Pendiente</StatusBadge>
 *         <StatusBadge variant="danger">No pagada</StatusBadge>
 *       </>
 *     }
 *   />
 *
 * REEMPLAZA:
 *   - Header custom en OrdenCompraCard (con breadcrumb+titulo+badges inline)
 *   - Header con gradient sky en EnvioDetailModal
 *   - Header con text-2xl font-bold en VentaCard
 *
 * Si tu header necesita elementos especiales (ej. botón de cambio de moneda,
 * ícono clickeable), pásalos como `accionesHeader` prop. No inventes un header
 * nuevo por módulo.
 */
import React from 'react';
import { cn } from '../utils';

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────

export interface EntityHeaderProps {
  /** Breadcrumb chiquito arriba del título (ej. "Órdenes de Compra > OC-001") */
  breadcrumb?: string;
  /** Título principal (ej. "OC-2026-001", "ENV-2026-200") — se renderiza mono */
  titulo: string;
  /** Subtítulo opcional debajo (ej. proveedor, cliente, ruta corta) */
  subtitulo?: string;
  /** Slot para badges alineados a la derecha (StatusBadge, chips custom) */
  badges?: React.ReactNode;
  /** Acciones adicionales al extremo derecho (ej. botón de cerrar, menú kebab) */
  accionesHeader?: React.ReactNode;
  /** Clase adicional */
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────────────────────

export const EntityHeader: React.FC<EntityHeaderProps> = ({
  breadcrumb,
  titulo,
  subtitulo,
  badges,
  accionesHeader,
  className,
}) => {
  return (
    <div className={cn('flex items-start justify-between gap-4 flex-wrap', className)}>
      {/* Columna izquierda: breadcrumb + título + subtítulo */}
      <div className="min-w-0 flex-1">
        {breadcrumb && (
          <div className="text-xs font-mono text-slate-500 mb-1 truncate">
            {breadcrumb}
          </div>
        )}
        <h2 className="text-2xl font-bold font-mono text-slate-900 truncate">
          {titulo}
        </h2>
        {subtitulo && (
          <div className="text-sm text-slate-600 mt-1 truncate">{subtitulo}</div>
        )}
      </div>

      {/* Columna derecha: badges + acciones */}
      {(badges || accionesHeader) && (
        <div className="flex items-start gap-2 flex-shrink-0 flex-wrap">
          {badges && (
            <div className="flex items-center gap-2 flex-wrap">{badges}</div>
          )}
          {accionesHeader && (
            <div className="flex items-center gap-1">{accionesHeader}</div>
          )}
        </div>
      )}
    </div>
  );
};
