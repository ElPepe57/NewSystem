/**
 * EntityPipeline — Pipeline horizontal de estados para el detalle de una entidad.
 *
 * Patrón canónico S52 — ver `docs/DESIGN_PATTERNS.md` → Patrón 2.
 *
 * Generaliza el `PipelineGrandeOC` privado de OrdenCompraCard. Muestra N nodos
 * conectados por líneas horizontales con fechas debajo de cada nodo y progreso
 * visual (emerald cuando completado, línea slate cuando pendiente).
 *
 * Estructura:
 *   ○───────●───────◉───────○───────○
 *   Borrador Confir. Despch. Recibida Compl.
 *   05-abr  10-abr  → ?    —       —
 *
 *   ● = completado (check blanco sobre fondo emerald)
 *   ◉ = actual (dot blanco sobre fondo emerald)
 *   ○ = pendiente (dash sobre fondo slate)
 *
 * USO:
 *   <EntityPipeline
 *     steps={[
 *       { id: 'borrador', label: 'Borrador', fecha: oc.fechaCreacion, status: 'completed' },
 *       { id: 'confirmada', label: 'Confirmada', fecha: oc.fechaEnviada, status: 'completed' },
 *       { id: 'despachada', label: 'En despacho', fecha: oc.fechaDespachada, status: 'current' },
 *       { id: 'completada', label: 'Completada', fecha: oc.fechaRecibida, status: 'pending' },
 *     ]}
 *   />
 *
 * REEMPLAZA:
 *   - `PipelineGrandeOC` privado en OrdenCompraCard (línea 793)
 *   - Variantes manuales en EnvioDetailModal / VentaCard
 *   - Marca `StatusTimeline` como deprecated (migrar consumidores)
 *
 * NO USAR PARA:
 *   - Ruta geográfica origen→destino (eso es `<RouteVisual>`)
 *   - Pipeline de módulo en cabecera de /lista (eso es `<PipelineHeader>`)
 *
 * Este es el pipeline de ESTADOS dentro del detalle de una entidad.
 */
import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../utils';

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────

export type EntityPipelineStepStatus = 'completed' | 'current' | 'pending' | 'skipped';

export interface EntityPipelineStep {
  /** ID único del paso (para React key) */
  id: string;
  /** Label corto (ej. "Borrador", "Confirmada") */
  label: string;
  /** Fecha del paso (Firestore Timestamp, Date, o null) */
  fecha?: { toDate?: () => Date } | Date | null | undefined;
  /** Estado visual del paso */
  status: EntityPipelineStepStatus;
}

export interface EntityPipelineProps {
  /** Lista ordenada de pasos (3-6 recomendado) */
  steps: EntityPipelineStep[];
  /** Tamaño visual — 'md' por default (matching OC) */
  size?: 'sm' | 'md' | 'lg';
  /** Clase adicional */
  className?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const fmtFecha = (d: EntityPipelineStep['fecha']): string => {
  if (!d) return '—';
  try {
    const date =
      typeof (d as { toDate?: () => Date }).toDate === 'function'
        ? (d as { toDate: () => Date }).toDate()
        : (d as Date);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  } catch {
    return '—';
  }
};

const SIZE_CLASSES = {
  sm: { circle: 'w-6 h-6', check: 'w-3 h-3', dot: 'w-1.5 h-1.5', label: 'text-[11px]', fecha: 'text-[10px]' },
  md: { circle: 'w-8 h-8', check: 'w-4 h-4', dot: 'w-2 h-2', label: 'text-xs', fecha: 'text-[11px]' },
  lg: { circle: 'w-10 h-10', check: 'w-5 h-5', dot: 'w-2.5 h-2.5', label: 'text-sm', fecha: 'text-xs' },
};

// ────────────────────────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────────────────────────

export const EntityPipeline: React.FC<EntityPipelineProps> = ({
  steps,
  size = 'md',
  className,
}) => {
  const sz = SIZE_CLASSES[size];

  return (
    <div className={cn('flex items-start justify-between gap-2 py-2', className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const isSkipped = step.status === 'skipped';
        const isCompleted = step.status === 'completed';
        const isCurrent = step.status === 'current';
        const isPending = step.status === 'pending';

        // La línea al siguiente step es emerald si este está completed o current
        const siguiente = steps[i + 1];
        const lineaEmerald = isCompleted && siguiente && siguiente.status !== 'pending' && !isSkipped;

        return (
          <React.Fragment key={step.id}>
            {/* Nodo */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={cn(
                  'rounded-full flex items-center justify-center transition-colors',
                  sz.circle,
                  isCompleted && 'bg-emerald-500 text-white',
                  isCurrent && 'bg-emerald-500 text-white',
                  isPending && 'bg-slate-200 text-slate-400',
                  isSkipped && 'bg-slate-100 text-slate-300'
                )}
              >
                {isCompleted && <CheckCircle2 className={sz.check} strokeWidth={3} />}
                {isCurrent && (
                  <span className={cn('rounded-full bg-white', sz.dot)} />
                )}
                {isPending && <span className="text-xs">—</span>}
                {isSkipped && <span className="text-xs">×</span>}
              </div>
              {/* Label */}
              <div
                className={cn(
                  'font-medium mt-2 text-center whitespace-nowrap',
                  sz.label,
                  isCompleted && 'text-slate-700',
                  isCurrent && 'text-slate-900',
                  isPending && 'text-slate-400',
                  isSkipped && 'text-slate-300 line-through'
                )}
              >
                {step.label}
              </div>
              {/* Fecha */}
              <div
                className={cn(
                  'mt-0.5 tabular-nums',
                  sz.fecha,
                  isCompleted && 'text-slate-500',
                  isCurrent && 'text-slate-500',
                  isPending && 'text-slate-300',
                  isSkipped && 'text-slate-300'
                )}
              >
                {isCurrent && !step.fecha ? '→ ?' : fmtFecha(step.fecha)}
              </div>
            </div>
            {/* Línea de conexión */}
            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-0.5 mt-4 rounded-full transition-colors',
                  lineaEmerald ? 'bg-emerald-400' : 'bg-slate-200'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
