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
import { Package, Plus } from 'lucide-react';
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

  return (
    <div className={cn('bg-white border border-slate-200 rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>📅</span>
          <h4 className="text-sm font-semibold text-slate-900">
            Tandas del proveedor ({subEnvios.length})
          </h4>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            {resumenTandas.entregado > 0 && (
              <span>· {resumenTandas.entregado} ✓</span>
            )}
            {resumenTandas.en_transito > 0 && (
              <span>· {resumenTandas.en_transito} 🚚</span>
            )}
            {resumenTandas.pendiente > 0 && (
              <span>· {resumenTandas.pendiente} ⏳</span>
            )}
            {resumenTandas.entregado_parcial > 0 && (
              <span className="text-amber-700 font-medium">
                · {resumenTandas.entregado_parcial} ⚠️
              </span>
            )}
          </div>
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
