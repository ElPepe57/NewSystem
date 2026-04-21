/**
 * SubEnviosTimeline — Compuesto que muestra todas las sub-tandas de un envío
 * T1 (casos A/B/D) en formato timeline vertical.
 *
 * Ensambla:
 *   - Header con contador + botón "+ Agregar tanda"
 *   - Línea vertical del timeline (SubEnviosTimelineLinea)
 *   - N SubEnvioTimelineItem (uno por tanda, ordenados por secuencia)
 *   - Pool de "unidades sin asignar" visible cuando hay unidades del envío
 *     que aún no están en ninguna tanda
 *   - AgregarTandaModal integrado (abre/cierra con estado local)
 *
 * Este compuesto NO llama a servicios directamente. Recibe el envío completo
 * como prop y dispara callbacks:
 *   - onAgregarTanda(payload)        — el padre llama crearSubTandaT1
 *   - onTransicionarTanda(id, estado) — el padre llama transicionarSubEnvio
 *   - onEliminarTanda(id)            — el padre llama eliminarSubTanda
 *   - onReportarIncidencia(id)       — el padre abre modal incidencia
 *
 * Ubicación típica: dentro de `EnvioDetailModal` → tab "Operaciones" cuando
 * el envío es de tipo T1 (A/B/D).
 */
import React, { useMemo, useState } from 'react';
import { Package, Plus, CheckCircle2, Truck, Clock, PackageCheck } from 'lucide-react';
import type { Envio, SubEnvioT1, EstadoSubEnvio } from '../../../types/envio.types';
import { SubEnvioTimelineItem, SubEnviosTimelineLinea } from './SubEnvioTimelineItem';
import type { SubEnvioTimelineItemProductoInfo } from './SubEnvioTimelineItem';
import {
  AgregarTandaModal,
  type AgregarTandaModalResult,
  type AgregarTandaModalUnidad,
} from './AgregarTandaModal';
import { cn } from '../../../design-system';

// ════════════════════════════════════════════════════════════════════════════
// Tipos
// ════════════════════════════════════════════════════════════════════════════

export interface SubEnviosTimelineProductoMeta {
  productoId: string;
  nombre: string;
  emoji?: string;
}

export interface SubEnviosTimelineProps {
  /** Envío padre con `unidades[]` y opcional `subEnvios[]` */
  envio: Envio;
  /** Metadata de productos del envío (para emoji + nombre) — desnormalizada */
  productosMeta: Record<string, SubEnviosTimelineProductoMeta>;
  /** Callback al confirmar "+ Agregar tanda" (padre llama crearSubTandaT1) */
  onAgregarTanda?: (result: AgregarTandaModalResult) => void | Promise<void>;
  /** Callback al transicionar una tanda (padre llama transicionarSubEnvio) */
  onTransicionarTanda?: (subEnvioId: string, nuevoEstado: EstadoSubEnvio) => void | Promise<void>;
  /** Callback al eliminar una tanda pendiente */
  onEliminarTanda?: (subEnvioId: string) => void | Promise<void>;
  /** Callback al reportar incidencia sobre una tanda (abre modal incidencia) */
  onReportarIncidencia?: (subEnvioId: string) => void;
  /** Callback al editar tracking/unidades de una tanda (pendiente/en_transito) */
  onEditarTanda?: (subEnvio: SubEnvioT1) => void;

  /** Contexto de reclamos para tandas tipo='reemplazo' — map reclamoId → numero */
  reclamoNumeroMap?: Record<string, string>;
  /** CTRU preservado por sub-tanda de reemplazo — map subEnvioId → label */
  ctruPreservadoMap?: Record<string, string>;

  /** Loading externo (durante operación de servicio) */
  loading?: boolean;
  /** Clase adicional */
  className?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Componente
// ════════════════════════════════════════════════════════════════════════════

export const SubEnviosTimeline: React.FC<SubEnviosTimelineProps> = ({
  envio,
  productosMeta,
  onAgregarTanda,
  onTransicionarTanda,
  onEliminarTanda,
  onReportarIncidencia,
  onEditarTanda,
  reclamoNumeroMap,
  ctruPreservadoMap,
  loading: loadingExt = false,
  className,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const loading = loadingExt || submitting;

  const subEnvios = envio.subEnvios ?? [];
  const totalUnidades = envio.unidades?.length ?? 0;

  // ─── Derivados ────────────────────────────────────────────────────────────

  // IDs de unidades ya asignadas a sub-tandas normales (no incluye reemplazos
  // para permitir que reemplazos "reusen" unidadId de la original).
  const unidadesAsignadasIds = useMemo(() => {
    const set = new Set<string>();
    for (const se of subEnvios) {
      if (se.tipo === 'normal') {
        se.unidadesIds.forEach((uid) => set.add(uid));
      }
    }
    return set;
  }, [subEnvios]);

  // Unidades sin asignar a ninguna tanda normal (pool disponible)
  const unidadesSinAsignar: AgregarTandaModalUnidad[] = useMemo(() => {
    return (envio.unidades ?? [])
      .filter((u) => !unidadesAsignadasIds.has(u.unidadId))
      .map((u) => {
        const meta = productosMeta[u.productoId];
        return {
          unidadId: u.unidadId,
          productoId: u.productoId,
          productoNombre: meta?.nombre || u.sku || u.productoId,
          productoEmoji: meta?.emoji,
          codigoUnidad: u.codigoUnidad || u.unidadId.slice(-6).toUpperCase(),
        };
      });
  }, [envio.unidades, unidadesAsignadasIds, productosMeta]);

  // Cuenta de tandas por estado
  const resumenTandas = useMemo(() => {
    const counts: Record<EstadoSubEnvio, number> = {
      pendiente: 0,
      en_transito: 0,
      entregado: 0,
      entregado_parcial: 0,
      cancelada: 0,
    };
    for (const se of subEnvios) {
      counts[se.estado] = (counts[se.estado] || 0) + 1;
    }
    return counts;
  }, [subEnvios]);

  // Convertir SubEnvioT1.unidadesIds → SubEnvioTimelineItemProductoInfo[]
  // (para renderizar la lista de productos dentro del item del timeline)
  const productosPorTanda = useMemo(() => {
    const map = new Map<string, SubEnvioTimelineItemProductoInfo[]>();
    for (const se of subEnvios) {
      const grouped = new Map<string, number>();
      for (const uid of se.unidadesIds) {
        const u = envio.unidades?.find((x) => x.unidadId === uid);
        if (!u) continue;
        grouped.set(u.productoId, (grouped.get(u.productoId) || 0) + 1);
      }
      const items: SubEnvioTimelineItemProductoInfo[] = [];
      for (const [productoId, cantidad] of grouped.entries()) {
        const meta = productosMeta[productoId];
        items.push({
          productoId,
          nombre: meta?.nombre || productoId,
          emoji: meta?.emoji,
          cantidad,
        });
      }
      map.set(se.id, items);
    }
    return map;
  }, [subEnvios, envio.unidades, productosMeta]);

  // Ordenar tandas por secuencia ascendente para el timeline
  const tandasOrdenadas = useMemo(
    () => [...subEnvios].sort((a, b) => a.secuencia - b.secuencia),
    [subEnvios]
  );

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAgregarTanda = async (result: AgregarTandaModalResult) => {
    if (!onAgregarTanda) return;
    setSubmitting(true);
    try {
      await onAgregarTanda(result);
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const puedeAgregar = !!onAgregarTanda && unidadesSinAsignar.length > 0 && !loading;

  // ─── Empty state: envío sin tandas aún ────────────────────────────────────
  if (subEnvios.length === 0) {
    return (
      <div className={cn('bg-white border border-slate-200 rounded-xl p-5', className)}>
        <div className="flex items-center gap-3 mb-3">
          <Package className="w-5 h-5 text-slate-500 flex-shrink-0" aria-hidden />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-slate-900">Tandas del proveedor</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Este envío aún no tiene tandas registradas. Si el proveedor despacha en múltiples
              entregas, puedes fraccionarlo ahora o al recibir.
            </p>
          </div>
        </div>
        {onAgregarTanda && totalUnidades > 0 && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 text-sm px-3 py-2 border-2 border-dashed border-violet-300 text-violet-700 rounded-lg hover:border-violet-400 hover:bg-violet-50 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden /> Fraccionar en tandas
          </button>
        )}

        {/* Modal al fraccionar por primera vez */}
        {onAgregarTanda && (
          <AgregarTandaModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            unidadesDisponibles={unidadesSinAsignar}
            subtitulo={`Envío ${envio.numeroEnvio}`}
            onConfirm={handleAgregarTanda}
            loading={submitting}
          />
        )}
      </div>
    );
  }

  // S47 — Totales de unidades por pipeline stage (para progress bar global)
  const unidadesPorEstado = useMemo(() => {
    let confirmadas = 0;
    let enTransito = 0;
    let recibidasParcial = 0;
    let recibidasCompletas = 0;
    for (const se of subEnvios) {
      const n = se.unidadesIds.length;
      if (se.estado === 'pendiente') confirmadas += n;
      else if (se.estado === 'en_transito') enTransito += n;
      else if (se.estado === 'entregado_parcial') recibidasParcial += n;
      else if (se.estado === 'entregado') recibidasCompletas += n;
    }
    const totalAsignadas = confirmadas + enTransito + recibidasParcial + recibidasCompletas;
    return { confirmadas, enTransito, recibidasParcial, recibidasCompletas, totalAsignadas };
  }, [subEnvios]);

  const pctGlobal = totalUnidades > 0
    ? Math.round((unidadesPorEstado.recibidasCompletas / totalUnidades) * 100)
    : 0;

  return (
    <div className={cn('bg-white border border-slate-200 rounded-xl overflow-hidden', className)}>
      {/* Header con título + acción */}
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>📅</span>
          <h4 className="text-sm font-semibold text-slate-900">
            Tandas del proveedor ({subEnvios.length})
          </h4>
          <span className="text-xs text-slate-500">
            · {unidadesPorEstado.recibidasCompletas}/{totalUnidades} unidades recibidas
          </span>
        </div>
        {onAgregarTanda && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={!puedeAgregar}
            className={cn(
              'text-xs px-3 py-1.5 rounded transition-colors inline-flex items-center gap-1.5',
              puedeAgregar
                ? 'bg-violet-600 text-white hover:bg-violet-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
            title={
              unidadesSinAsignar.length === 0
                ? 'Todas las unidades del envío ya están asignadas a tandas'
                : 'Agregar nueva tanda de despacho'
            }
          >
            <Plus className="w-3.5 h-3.5" aria-hidden /> Agregar tanda
          </button>
        )}
      </div>

      {/* S47 — Pipeline horizontal 4 etapas (mockup envios-transversal-s43.html) */}
      <div className="px-5 py-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200">
        <div className="grid grid-cols-4 gap-2">
          <PipelineEtapa
            icon={Clock}
            label="Confirmado"
            cantidad={resumenTandas.pendiente}
            unidades={unidadesPorEstado.confirmadas}
            color="amber"
            activo={resumenTandas.pendiente > 0}
          />
          <PipelineEtapa
            icon={Truck}
            label="En tránsito"
            cantidad={resumenTandas.en_transito}
            unidades={unidadesPorEstado.enTransito}
            color="sky"
            activo={resumenTandas.en_transito > 0}
          />
          <PipelineEtapa
            icon={Package}
            label="Recibido parcial"
            cantidad={resumenTandas.entregado_parcial}
            unidades={unidadesPorEstado.recibidasParcial}
            color="purple"
            activo={resumenTandas.entregado_parcial > 0}
          />
          <PipelineEtapa
            icon={CheckCircle2}
            label="Recibido completo"
            cantidad={resumenTandas.entregado}
            unidades={unidadesPorEstado.recibidasCompletas}
            color="emerald"
            activo={resumenTandas.entregado > 0}
          />
        </div>
        {/* Progress bar global de unidades */}
        <div className="mt-3 flex items-center gap-2">
          <PackageCheck className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
              style={{ width: `${pctGlobal}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-700 tabular-nums min-w-[3rem] text-right">
            {pctGlobal}%
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-5">
        <SubEnviosTimelineLinea>
          {tandasOrdenadas.map((se) => (
            <SubEnvioTimelineItem
              key={se.id}
              subEnvio={se}
              productos={productosPorTanda.get(se.id) || []}
              onMarcarEnTransito={
                onTransicionarTanda
                  ? () => onTransicionarTanda(se.id, 'en_transito')
                  : undefined
              }
              onMarcarEntregado={
                onTransicionarTanda
                  ? () => onTransicionarTanda(se.id, 'entregado')
                  : undefined
              }
              onReportarIncidencia={
                onReportarIncidencia ? () => onReportarIncidencia(se.id) : undefined
              }
              onEditar={onEditarTanda ? () => onEditarTanda(se) : undefined}
              onEliminar={onEliminarTanda ? () => onEliminarTanda(se.id) : undefined}
              reclamoNumero={
                se.reclamoId && reclamoNumeroMap ? reclamoNumeroMap[se.reclamoId] : undefined
              }
              ctruPreservadoLabel={
                ctruPreservadoMap ? ctruPreservadoMap[se.id] : undefined
              }
            />
          ))}
        </SubEnviosTimelineLinea>

        {/* Pool unidades sin asignar (solo informativo, el picker vive en el modal) */}
        {unidadesSinAsignar.length > 0 && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              <Package className="w-3.5 h-3.5 text-slate-500" aria-hidden />
              <span className="font-medium text-slate-700">Unidades sin asignar a tandas</span>
            </div>
            <span className="text-xs font-bold text-amber-700 tabular-nums">
              {unidadesSinAsignar.length} de {totalUnidades}
            </span>
          </div>
        )}

        {unidadesSinAsignar.length === 0 && totalUnidades > 0 && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <span aria-hidden>✓</span>
            <span>Todas las {totalUnidades} unidades del envío están asignadas a tandas.</span>
          </div>
        )}
      </div>

      {/* Modal + Agregar tanda */}
      {onAgregarTanda && (
        <AgregarTandaModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          unidadesDisponibles={unidadesSinAsignar}
          subtitulo={`Envío ${envio.numeroEnvio}`}
          onConfirm={handleAgregarTanda}
          loading={submitting}
        />
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PipelineEtapa — S47 · una columna del pipeline horizontal 4 etapas
// ════════════════════════════════════════════════════════════════════════════

interface PipelineEtapaProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  cantidad: number;          // Número de tandas en esta etapa
  unidades: number;          // Total unidades en esta etapa
  color: 'amber' | 'sky' | 'purple' | 'emerald';
  activo: boolean;
}

const PipelineEtapa: React.FC<PipelineEtapaProps> = ({
  icon: Icon,
  label,
  cantidad,
  unidades,
  color,
  activo,
}) => {
  const colorMap: Record<PipelineEtapaProps['color'], { bg: string; border: string; text: string; iconBg: string; iconFg: string }> = {
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   iconBg: 'bg-amber-100',   iconFg: 'text-amber-600' },
    sky:     { bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-800',     iconBg: 'bg-sky-100',     iconFg: 'text-sky-600' },
    purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-800',  iconBg: 'bg-purple-100',  iconFg: 'text-purple-600' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', iconBg: 'bg-emerald-100', iconFg: 'text-emerald-600' },
  };
  const c = colorMap[color];
  return (
    <div
      className={cn(
        'rounded-lg border p-2.5 transition-all',
        activo ? `${c.bg} ${c.border}` : 'bg-slate-50/50 border-slate-200 opacity-60'
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', activo ? c.iconBg : 'bg-slate-100')}>
          <Icon className={cn('w-3.5 h-3.5', activo ? c.iconFg : 'text-slate-400')} />
        </div>
        <span className={cn('text-[10px] font-semibold uppercase tracking-wide truncate', activo ? c.text : 'text-slate-400')}>
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-lg font-bold tabular-nums', activo ? c.text : 'text-slate-400')}>
          {cantidad}
        </span>
        <span className={cn('text-[10px]', activo ? c.text : 'text-slate-400')}>
          {cantidad === 1 ? 'tanda' : 'tandas'}
        </span>
      </div>
      <div className={cn('text-[10px] mt-0.5', activo ? 'text-slate-500' : 'text-slate-400')}>
        {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
      </div>
    </div>
  );
};
