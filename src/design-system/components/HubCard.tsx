/**
 * HubCard — card de entidad unificada del Design System (canon L3).
 *
 * Mockup canónico: docs/mockups/ds-piezas-compartidas-f2-v1.html (pieza 2).
 *
 * Reemplaza gradualmente a DataCard / CompraCard / GastoCard / EnvioCard: una sola
 * card para cualquier entidad de listado, ensamblada por slots en vez de re-inventarse
 * por módulo. La consistencia vive en el componente, no en la disciplina.
 *
 * Slots: ícono tonal · título + código + meta · monto · estado · acciones.
 * Capacidades: sub-filas anidadas (expandible) · selección (checkbox) · estados
 * (normal/hover/selected/loading). El color del ícono/acento lo decide el módulo.
 *
 * No maneja estado de selección/expansión por sí mismo (controlado por props/callbacks),
 * salvo que `subRows` se pase sin control de `expanded` (entonces usa estado interno).
 */
import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, ChevronDown, Check } from 'lucide-react';
import { cn } from '../utils';
import { StatusBadge } from './StatusBadge';
import type { StatusVariant } from '../tokens';

// ════════════════════════════════════════════════════════════════════════════
// Color tonal del ícono (heredado del grupo del módulo · default blue=Comercial)
// ════════════════════════════════════════════════════════════════════════════

export type HubCardColor = 'blue' | 'teal' | 'violet' | 'orange' | 'indigo' | 'slate' | 'amber' | 'emerald' | 'rose';

const ICON_TONE: Record<HubCardColor, { bg: string; text: string; ring: string; amount: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-500/30 border-blue-300', amount: 'text-blue-700' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-600', ring: 'ring-teal-500/30 border-teal-300', amount: 'text-teal-700' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-500/30 border-violet-300', amount: 'text-violet-700' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-500/30 border-orange-300', amount: 'text-orange-700' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-500/30 border-indigo-300', amount: 'text-indigo-700' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-400/30 border-slate-300', amount: 'text-slate-800' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-500/30 border-amber-300', amount: 'text-amber-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-500/30 border-emerald-300', amount: 'text-emerald-700' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-500/30 border-rose-300', amount: 'text-rose-700' },
};

// ════════════════════════════════════════════════════════════════════════════
// Props
// ════════════════════════════════════════════════════════════════════════════

export interface HubCardProps {
  /** Ícono tonal a la izquierda (lucide). */
  icon?: LucideIcon;
  /** Color del grupo del módulo (tinte del ícono + monto + anillos). Default blue (Comercial). */
  color?: HubCardColor;
  /** Título principal de la entidad. */
  title: React.ReactNode;
  /** Código mono opcional (ej. "OC-2026-014"). */
  code?: string;
  /** Meta secundaria (ej. "3 productos · 78 unidades · hace 2 días"). */
  meta?: React.ReactNode;
  /** Monto prominente a la derecha (ej. "$1,381.00"). */
  amount?: React.ReactNode;
  /** Estado (badge a la derecha). */
  status?: { label: string; variant: StatusVariant };
  /** Acciones (botones/menú) a la derecha del monto. */
  actions?: React.ReactNode;
  /** Click sobre la card (abre detalle · muestra chevron). */
  onClick?: () => void;

  /** Sub-filas anidadas (sub-órdenes, tandas, líneas). Su presencia muestra el chevron de expandir. */
  subRows?: React.ReactNode;
  /** Controla expansión (controlado). Si se omite y hay subRows, usa estado interno. */
  expanded?: boolean;
  /** Callback al togglear expansión (controlado). */
  onToggleExpand?: (expanded: boolean) => void;
  /** Expandido por defecto (modo no-controlado). */
  defaultExpanded?: boolean;

  /** Habilita checkbox de selección masiva. */
  selectable?: boolean;
  /** Estado de selección (controlado). */
  selected?: boolean;
  /** Callback al togglear selección. */
  onSelect?: (selected: boolean) => void;

  /** Skeleton de carga. */
  loading?: boolean;
  className?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// HubCard
// ════════════════════════════════════════════════════════════════════════════

export const HubCard: React.FC<HubCardProps> = ({
  icon: Icon,
  color = 'blue',
  title,
  code,
  meta,
  amount,
  status,
  actions,
  onClick,
  subRows,
  expanded,
  onToggleExpand,
  defaultExpanded = false,
  selectable = false,
  selected = false,
  onSelect,
  loading = false,
  className,
}) => {
  const tone = ICON_TONE[color];
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? internalExpanded;
  const hasSubRows = !!subRows;

  if (loading) {
    return (
      <div className={cn('bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3', className)}>
        <div className="w-10 h-10 rounded-lg bg-slate-100 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-2.5 w-40 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isExpanded;
    if (onToggleExpand) onToggleExpand(next);
    else setInternalExpanded(next);
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(!selected);
  };

  const interactive = !!onClick;

  return (
    <div
      className={cn(
        'bg-white border rounded-xl overflow-hidden transition-colors',
        selected ? cn('border-2', tone.ring, 'bg-blue-50/30') : 'border-slate-200',
        interactive && !selected && 'hover:border-blue-300',
        className,
      )}
    >
      {/* Fila principal */}
      <div
        className={cn('p-3.5 flex items-center gap-3', interactive && 'cursor-pointer', hasSubRows && 'bg-slate-50/50')}
        onClick={onClick}
      >
        {selectable && (
          <button
            type="button"
            onClick={handleSelect}
            aria-label={selected ? 'Deseleccionar' : 'Seleccionar'}
            className={cn(
              'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
              selected ? cn('bg-blue-600 border-blue-600 text-white') : 'border-slate-300 hover:border-blue-400',
            )}
          >
            {selected && <Check className="w-3.5 h-3.5" />}
          </button>
        )}

        {Icon && (
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', tone.bg, tone.text)}>
            <Icon className="w-5 h-5" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {code && <span className="text-[13px] font-semibold text-slate-900">{code}</span>}
            {code && title && <span className="text-[11px] text-slate-400">·</span>}
            <span className={cn('text-[13px] truncate', code ? 'text-slate-600' : 'font-semibold text-slate-900')}>{title}</span>
          </div>
          {meta && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{meta}</div>}
        </div>

        {(amount || status) && (
          <div className="text-right flex-shrink-0">
            {amount && <div className={cn('text-[14px] font-bold tabular-nums', tone.amount)}>{amount}</div>}
            {status && (
              <div className="mt-0.5">
                <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
              </div>
            )}
          </div>
        )}

        {actions && <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>{actions}</div>}

        {hasSubRows ? (
          <button type="button" onClick={toggleExpand} aria-label={isExpanded ? 'Colapsar' : 'Expandir'} className="flex-shrink-0 text-slate-400 hover:text-slate-700 p-1">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : interactive ? (
          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
        ) : null}
      </div>

      {/* Sub-filas */}
      {hasSubRows && isExpanded && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">{subRows}</div>
      )}
    </div>
  );
};

/**
 * HubCardSubRow — fila de sub-entidad dentro de una HubCard (para el slot `subRows`).
 * Layout consistente: dot de estado · label · badge · monto.
 */
export const HubCardSubRow: React.FC<{
  dotColor?: string;
  label: React.ReactNode;
  status?: { label: string; variant: StatusVariant };
  amount?: React.ReactNode;
  onClick?: () => void;
}> = ({ dotColor = 'bg-slate-400', label, status, amount, onClick }) => (
  <div
    className={cn('px-3.5 py-2.5 flex items-center gap-3 text-[12px]', onClick && 'cursor-pointer hover:bg-slate-50')}
    onClick={onClick}
  >
    <span className={cn('w-1.5 h-1.5 rounded-full ml-1 flex-shrink-0', dotColor)} />
    <span className="text-slate-700 flex-1 min-w-0 truncate">{label}</span>
    {status && <StatusBadge variant={status.variant}>{status.label}</StatusBadge>}
    {amount && <span className="tabular-nums text-slate-600 flex-shrink-0">{amount}</span>}
  </div>
);
