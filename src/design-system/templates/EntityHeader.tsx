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
  /**
   * Breadcrumb: línea chiquita arriba del título. Puede ser string simple
   * (ej. "OC-2026-001") o ReactNode si querés poner ícono+texto.
   * Formato OC: <><Package className="w-3.5 h-3.5" /> <span>{numero}</span></>
   */
  breadcrumb?: React.ReactNode;
  /** Título principal (ej. "Orden de compra OC-2026-001") */
  titulo: string;
  /**
   * Subtítulo opcional debajo. Puede ser string simple o ReactNode si
   * querés tonos diferenciados (ej. proveedor en slate-500, país en slate-400).
   */
  subtitulo?: React.ReactNode;
  /**
   * Slot para badges alineados a la derecha. Render libre — el caller decide
   * si apila horizontal o vertical.
   *
   * Patrón canónico OC: stack vertical (flex-col) con 2 badges (estado + pago).
   */
  badges?: React.ReactNode;
  /** Acciones adicionales al extremo derecho (ej. botón cerrar, menú kebab) */
  accionesHeader?: React.ReactNode;
  /** Clase adicional para el contenedor */
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
    <div
      className={cn(
        // Mobile / viewport angosto: columnas apiladas (título arriba, badges+acciones abajo).
        // md+ (≥768px): layout original side-by-side.
        'flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4',
        className
      )}
    >
      {/* Columna izquierda: breadcrumb + título + subtítulo */}
      <div className="min-w-0 flex-1">
        {breadcrumb && (
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono">
            {breadcrumb}
          </div>
        )}
        <h2 className="text-xl font-semibold text-slate-900 break-words">
          {titulo}
        </h2>
        {subtitulo && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>
        )}
      </div>

      {/* Columna derecha: badges + acciones.
          - En mobile/narrow: ocupa el ancho disponible y permite wrap natural.
          - En md+: vuelve a flex-shrink-0 sin wrap (look original). */}
      {(badges || accionesHeader) && (
        <div className="flex items-center gap-2 flex-wrap md:items-start md:flex-nowrap md:flex-shrink-0">
          {badges}
          {accionesHeader && (
            <div className="flex items-center gap-1 flex-wrap md:flex-nowrap">
              {accionesHeader}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
