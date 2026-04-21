/**
 * EntityDetailShell — Plantilla completa para el detalle de una entidad.
 *
 * Patrón canónico S52 — ver `docs/DESIGN_PATTERNS.md` → Anatomía de un detalle.
 *
 * Es la plantilla de Capa 3 que orquesta las 4 piezas del patrón OC:
 *   1. EntityHeader (título + badges)
 *   2. EntityPipeline (estados)
 *   3. NextActionBanner (próxima acción)
 *   4. KpiRow (fila de métricas)
 *   + Zona DINÁMICA intercambiable (children) que es donde va el detalle
 *     o la vista embedded de una acción activa.
 *
 * Estructura renderizada:
 *   ┌─── ZONA FIJA (siempre visible) ───────────────────────────┐
 *   │  <EntityHeader />       ← header slot                      │
 *   │  <EntityPipeline />     ← pipeline slot (opcional)        │
 *   │  <NextActionBanner />   ← banner slot (opcional)          │
 *   │  <KpiRow />             ← kpis slot (opcional)            │
 *   ├───────────────────────────────────────────────────────────┤
 *   │                                                            │
 *   │  ZONA DINÁMICA (children)                                  │
 *   │  Aquí va el detalle O la vista embedded de la acción.      │
 *   │  Usar useEmbeddableView para controlar qué se renderiza.   │
 *   │                                                            │
 *   └───────────────────────────────────────────────────────────┘
 *
 * USO TÍPICO (alineado al estándar OC):
 *
 *   const vista = useEmbeddableView<'detalle' | 'confirmando'>('detalle');
 *
 *   return (
 *     <EntityDetailShell
 *       header={<EntityHeader titulo="OC-2026-001" badges={<StatusBadge>Pendiente</StatusBadge>} />}
 *       pipeline={<EntityPipeline steps={pipelineSteps} />}
 *       nextAction={
 *         <NextActionBanner
 *           label="Confirmar OC"
 *           buttonText="Confirmar"
 *           onClick={() => vista.switchTo('confirmando')}
 *         />
 *       }
 *       kpis={<KpiRow items={kpiItems} />}
 *     >
 *       {vista.current === 'detalle' && <DetalleProductosYCargos />}
 *       {vista.current === 'confirmando' && (
 *         <ConfirmarOCModal embedded onClose={vista.back} {...} />
 *       )}
 *     </EntityDetailShell>
 *   );
 *
 * Los slots son OPCIONALES — una entidad simple puede no tener pipeline o
 * no tener banner. Pero si los usás, SIEMPRE usá estos componentes (no los
 * reemplaces por JSX inline).
 */
import React from 'react';
import { cn } from '../utils';

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────

export interface EntityDetailShellProps {
  /** Slot obligatorio: <EntityHeader /> con título + badges */
  header: React.ReactNode;
  /** Slot opcional: <EntityPipeline /> con estados de la entidad */
  pipeline?: React.ReactNode;
  /** Slot opcional: <NextActionBanner /> con la próxima acción */
  nextAction?: React.ReactNode;
  /** Slot opcional: <KpiRow /> con la fila de métricas */
  kpis?: React.ReactNode;
  /** Zona dinámica (detalle completo, vista embedded de acción, etc.) */
  children: React.ReactNode;
  /** Clase adicional para el contenedor exterior */
  className?: string;
  /** Clase para la zona dinámica (ej. `space-y-4` si se quiere espaciado) */
  contentClassName?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────────────────────

export const EntityDetailShell: React.FC<EntityDetailShellProps> = ({
  header,
  pipeline,
  nextAction,
  kpis,
  children,
  className,
  contentClassName,
}) => {
  return (
    <div className={cn('space-y-5', className)}>
      {/* ─── ZONA FIJA ─── */}
      <div className="space-y-4">
        {header}
        {pipeline}
        {nextAction}
        {kpis}
      </div>

      {/* ─── ZONA DINÁMICA ─── */}
      <div className={cn('space-y-4', contentClassName)}>{children}</div>
    </div>
  );
};
