/**
 * SubEnvioTimelineItem — Átomo que representa una sub-tanda individual
 * en el timeline de sub-envíos de un envío T1 (casos A/B/D).
 *
 * Layout:
 *   Círculo con icono/número a la izquierda (color según estado)
 *   Card a la derecha con:
 *     - Header: "Tanda N" + estado badge + fecha + tracking
 *     - Body: lista de unidades (agrupadas por producto)
 *     - Footer: acciones contextuales según estado
 *
 * Estados visuales:
 *   pendiente            → gris, chevron, acciones: Marcar en_transito / Eliminar / Editar
 *   en_transito          → azul ring, acciones: Marcar entregado / Reportar incidencia
 *   entregado            → emerald, candado (readonly)
 *   entregado_parcial    → amber, warning icon + indicación de incidencia
 *   cancelada            → slate, opacity-50
 *
 * Tandas `tipo='reemplazo'` (D-16) tienen badge violet + referencia al reclamo
 * origen + nota "CTRU preservado" (reemplazo gratuito por convención).
 */
import React from 'react';
import {
  Truck,
  Check,
  Clock,
  AlertTriangle,
  Lock,
  X,
  RotateCcw,
  Pencil,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../../design-system';
import type { SubEnvioT1, EstadoSubEnvio } from '../../../types/envio.types';

// ════════════════════════════════════════════════════════════════════════════
// Tipos auxiliares
// ════════════════════════════════════════════════════════════════════════════

export interface SubEnvioTimelineItemProductoInfo {
  productoId: string;
  nombre: string;
  emoji?: string;
  cantidad: number;
}

export interface SubEnvioTimelineItemProps {
  /** Sub-tanda a renderizar */
  subEnvio: SubEnvioT1;
  /** Info de productos contenidos en esta tanda (desnormalizada del envío padre) */
  productos: SubEnvioTimelineItemProductoInfo[];

  /** Acciones contextuales (se muestran según el estado de la tanda) */
  onMarcarEnTransito?: (subEnvio: SubEnvioT1) => void;
  onMarcarEntregado?: (subEnvio: SubEnvioT1) => void;
  onReportarIncidencia?: (subEnvio: SubEnvioT1) => void;
  onEditar?: (subEnvio: SubEnvioT1) => void;
  onEliminar?: (subEnvio: SubEnvioT1) => void;

  /** Contexto del reclamo si tipo='reemplazo' (D-16) */
  reclamoNumero?: string;
  /** Resumen de lo que se preserva (ej: "$42.00 CTRU original") */
  ctruPreservadoLabel?: string;

  /** Clase adicional */
  className?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Config visual por estado
// ════════════════════════════════════════════════════════════════════════════

interface EstadoConfig {
  dotBg: string;         // Background del círculo izquierdo
  dotIcon: React.ElementType | null;
  dotText?: string;      // Texto dentro del círculo (ej: secuencia)
  cardBorder: string;    // Borde del card
  cardBg?: string;
  badgeBg: string;
  badgeText: string;
  badgeIcon: React.ElementType | null;
  badgeLabel: string;
  readonly?: boolean;    // Si no se permite edición (entregado, cancelada)
}

function getConfigForEstado(estado: EstadoSubEnvio): EstadoConfig {
  switch (estado) {
    case 'pendiente':
      return {
        dotBg: 'bg-slate-300',
        dotIcon: Clock,
        cardBorder: 'border border-dashed border-slate-300',
        cardBg: 'bg-white',
        badgeBg: 'bg-slate-100',
        badgeText: 'text-slate-700',
        badgeIcon: Clock,
        badgeLabel: 'Pendiente',
      };
    case 'en_transito':
      return {
        dotBg: 'bg-blue-500',
        dotIcon: Truck,
        cardBorder: 'border-2 border-blue-300',
        cardBg: 'bg-white',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-800',
        badgeIcon: Truck,
        badgeLabel: 'En tránsito',
      };
    case 'entregado':
      return {
        dotBg: 'bg-emerald-500',
        dotIcon: Check,
        cardBorder: 'border border-emerald-200',
        cardBg: 'bg-emerald-50/30',
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-emerald-800',
        badgeIcon: Check,
        badgeLabel: 'Entregado',
        readonly: true,
      };
    case 'entregado_parcial':
      return {
        dotBg: 'bg-amber-500',
        dotIcon: AlertTriangle,
        cardBorder: 'border-2 border-amber-300',
        cardBg: 'bg-amber-50/30',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-800',
        badgeIcon: AlertTriangle,
        badgeLabel: 'Entregado parcial',
      };
    case 'cancelada':
      return {
        dotBg: 'bg-slate-400',
        dotIcon: X,
        cardBorder: 'border border-slate-200',
        cardBg: 'bg-slate-50 opacity-60',
        badgeBg: 'bg-slate-200',
        badgeText: 'text-slate-700',
        badgeIcon: X,
        badgeLabel: 'Cancelada',
        readonly: true,
      };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers de formato
// ════════════════════════════════════════════════════════════════════════════

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatFecha(ts: any): string {
  if (!ts) return '';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return `${String(date.getDate()).padStart(2, '0')}-${MESES[date.getMonth()]}`;
  } catch {
    return '';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════════════════════════

export const SubEnvioTimelineItem: React.FC<SubEnvioTimelineItemProps> = ({
  subEnvio,
  productos,
  onMarcarEnTransito,
  onMarcarEntregado,
  onReportarIncidencia,
  onEditar,
  onEliminar,
  reclamoNumero,
  ctruPreservadoLabel,
  className,
}) => {
  const cfg = getConfigForEstado(subEnvio.estado);
  const DotIcon = cfg.dotIcon;
  const BadgeIcon = cfg.badgeIcon;
  const totalUnidades = productos.reduce((sum, p) => sum + p.cantidad, 0);
  const esReemplazo = subEnvio.tipo === 'reemplazo';

  // Fecha a mostrar depende del estado
  const fechaLabel = (() => {
    if (subEnvio.estado === 'entregado' || subEnvio.estado === 'entregado_parcial') {
      return subEnvio.fechaEntrega ? `Entregado · ${formatFecha(subEnvio.fechaEntrega)}` : 'Entregado';
    }
    if (subEnvio.estado === 'en_transito') {
      return subEnvio.fechaEstimadaEntrega
        ? `En tránsito · estimado ${formatFecha(subEnvio.fechaEstimadaEntrega)}`
        : 'En tránsito';
    }
    if (subEnvio.estado === 'pendiente') {
      return subEnvio.fechaEstimadaEntrega
        ? `Pendiente · estimado ${formatFecha(subEnvio.fechaEstimadaEntrega)}`
        : 'Pendiente';
    }
    return '';
  })();

  return (
    <div className={cn('relative pl-10 pb-4', className)}>
      {/* Círculo izquierdo (sobre la línea vertical del timeline) */}
      <div
        className={cn(
          'absolute left-0 top-1 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold',
          cfg.dotBg,
          esReemplazo && 'bg-violet-500' // override para reemplazos
        )}
        aria-label={`Tanda ${subEnvio.secuencia} · ${cfg.badgeLabel}`}
      >
        {esReemplazo ? (
          <span className="text-[9px]" aria-hidden>📦</span>
        ) : DotIcon ? (
          <DotIcon className="w-3.5 h-3.5" aria-hidden />
        ) : (
          <span>{subEnvio.secuencia}</span>
        )}
      </div>

      {/* Card con info */}
      <div className={cn('rounded-lg p-3', cfg.cardBorder, cfg.cardBg)}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-slate-900">Tanda {subEnvio.secuencia}</span>
            {esReemplazo && (
              <span className="text-[10px] px-1.5 py-0.5 bg-violet-200 text-violet-900 rounded font-bold">
                📦 REEMPLAZO
              </span>
            )}
            <span className="text-xs text-slate-500 truncate">{fechaLabel}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Badge de estado */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                cfg.badgeBg,
                cfg.badgeText
              )}
            >
              {BadgeIcon && <BadgeIcon className="w-3 h-3" aria-hidden />}
              {cfg.badgeLabel}
            </span>
            {/* Tracking si hay */}
            {subEnvio.numeroTrackingProveedor && (
              <span className="text-xs font-mono text-slate-500">
                {subEnvio.numeroTrackingProveedor}
              </span>
            )}
            {cfg.readonly && <Lock className="w-3 h-3 text-slate-400" aria-hidden />}
          </div>
        </div>

        {/* Body: lista de productos con cantidad */}
        <div className="space-y-1 text-sm text-slate-700">
          {productos.map((p) => (
            <div key={p.productoId} className="flex items-center gap-2">
              {p.emoji && (
                <span className="text-lg flex-shrink-0" aria-hidden>
                  {p.emoji}
                </span>
              )}
              <span className="truncate">
                {p.cantidad} unidad{p.cantidad !== 1 ? 'es' : ''} · {p.nombre}
              </span>
            </div>
          ))}
          {productos.length === 0 && (
            <div className="text-xs text-slate-400 italic">
              {totalUnidades === 0 ? 'Sin unidades asignadas' : `${totalUnidades} unidades`}
            </div>
          )}
        </div>

        {/* Vínculo al reclamo si es reemplazo */}
        {esReemplazo && (reclamoNumero || ctruPreservadoLabel) && (
          <div className="mt-2 p-2 bg-white rounded border border-violet-200 text-xs">
            {reclamoNumero && (
              <div className="flex items-center gap-2 text-violet-800">
                <span aria-hidden>🔗</span>
                <span>
                  Vinculada al reclamo{' '}
                  <span className="font-mono font-bold">{reclamoNumero}</span>
                </span>
              </div>
            )}
            {ctruPreservadoLabel && (
              <div className="text-slate-600 mt-1">
                CTRU preservado: <strong>{ctruPreservadoLabel}</strong> · sin asiento contable
              </div>
            )}
          </div>
        )}

        {/* Footer: acciones contextuales según estado */}
        {!cfg.readonly && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {subEnvio.estado === 'pendiente' && (
              <>
                {onMarcarEnTransito && (
                  <button
                    type="button"
                    onClick={() => onMarcarEnTransito(subEnvio)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Truck className="w-3 h-3" aria-hidden /> Marcar en tránsito
                  </button>
                )}
                {onEditar && (
                  <button
                    type="button"
                    onClick={() => onEditar(subEnvio)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-colors"
                  >
                    <Pencil className="w-3 h-3" aria-hidden /> Editar
                  </button>
                )}
                {onEliminar && (
                  <button
                    type="button"
                    onClick={() => onEliminar(subEnvio)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white border border-red-200 text-red-700 rounded hover:bg-red-50 transition-colors"
                  >
                    <X className="w-3 h-3" aria-hidden /> Eliminar tanda
                  </button>
                )}
              </>
            )}

            {subEnvio.estado === 'en_transito' && (
              <>
                {onMarcarEntregado && (
                  <button
                    type="button"
                    onClick={() => onMarcarEntregado(subEnvio)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                  >
                    <Check className="w-3 h-3" aria-hidden /> Marcar entregado
                  </button>
                )}
                {onReportarIncidencia && (
                  <button
                    type="button"
                    onClick={() => onReportarIncidencia(subEnvio)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition-colors"
                  >
                    <AlertTriangle className="w-3 h-3" aria-hidden /> Reportar incidencia
                  </button>
                )}
                {onEditar && (
                  <button
                    type="button"
                    onClick={() => onEditar(subEnvio)}
                    className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline ml-auto"
                  >
                    <Pencil className="w-3 h-3" aria-hidden /> Editar tracking
                  </button>
                )}
              </>
            )}

            {subEnvio.estado === 'entregado_parcial' && onReportarIncidencia && (
              <button
                type="button"
                onClick={() => onReportarIncidencia(subEnvio)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
              >
                <AlertTriangle className="w-3 h-3" aria-hidden /> Gestionar incidencia
              </button>
            )}
          </div>
        )}

        {/* Nota readonly para estados terminales */}
        {cfg.readonly && subEnvio.estado !== 'cancelada' && (
          <div className="text-[10px] text-slate-400 mt-1 italic">
            Solo lectura · hecho consumado
          </div>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Componente auxiliar: línea vertical del timeline (úsalo como wrapper)
// ════════════════════════════════════════════════════════════════════════════

export const SubEnviosTimelineLinea: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="relative">
    <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-200" aria-hidden />
    {children}
  </div>
);

// Exportar icon auxiliar que puede ser útil en el compuesto
export { ChevronRight };
