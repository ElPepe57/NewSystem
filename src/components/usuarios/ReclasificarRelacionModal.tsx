/**
 * ReclasificarRelacionModal.tsx · chk5.PERSONAS-v5.6 · E5.2 (2026-05-28)
 *
 * Modal canon v5.6 · RECLASIFICACIÓN ATÓMICA de una RelacionLaboral.
 *
 * Caso de uso típico:
 *   - Carlos era 'honorarios' (consultor externo)
 *   - Decide unirse al staff como 'empleado'
 *   - Admin reclasifica · esto debe:
 *     1. Cerrar la relación 'honorarios' con motivoFin='reclasificacion'
 *        (snapshot inmutable preservado)
 *     2. Crear nueva relación 'empleado' con relacionAnteriorId apuntando
 *        a la cerrada (rastrea la cadena)
 *   - Ambas operaciones en una sola transacción (writeBatch · E1).
 *
 * RESTRICCIONES:
 *   - nuevoTipo DEBE ser distinto al tipo actual
 *   - La relación a reclasificar NO puede estar finalizada
 *   - Si la relación está pausada · se reclasifica desde pausada también
 *     (raro pero técnicamente válido)
 *
 * NO se exponen TODOS los campos del wizard de creación · solo los críticos:
 *   - Nuevo tipo (obligatorio · != actual)
 *   - Nuevo subTipo (opcional)
 *   - Nuevo cargo (opcional)
 *   - Nuevo monto/moneda (opcional)
 *   - Nota del motivo (opcional · va a notaMotivoFin)
 *
 * Los datos específicos completos (entidadMaestroRef · datos de socio · etc)
 * se editan después desde el UserPanel sobre la relación recién creada.
 */

import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { relacionesLaboralesService } from '../../services/relacionesLaborales.service';
import type {
  RelacionLaboral,
  TipoRelacion,
  SubTipoRelacion,
} from '../../types/relacionLaboral.types';
import {
  TIPO_RELACION_LABELS,
  TIPO_RELACION_ICONS,
  TIPO_RELACION_COLORS,
} from '../../types/relacionLaboral.types';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface ReclasificarRelacionModalProps {
  isOpen: boolean;
  relacion: RelacionLaboral | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

const TIPOS_DISPONIBLES: TipoRelacion[] = ['empleado', 'honorarios', 'socio', 'externo'];

const SUBTIPOS_POR_TIPO: Record<TipoRelacion, string[]> = {
  empleado: ['full_time', 'medio_tiempo', 'por_horas', 'tercerizado', 'practicante', 'aprendiz'],
  honorarios: ['consultor', 'asesor', 'profesional_servicios', 'freelance'],
  socio: ['fundador', 'inversor', 'minoritario', 'estrategico'],
  externo: [
    'contacto_proveedor',
    'contacto_cliente',
    'cliente_vip',
    'tercerizado_logistico',
    'colaborador_marketing',
    'contacto_marca',
    'auditor_externo',
    'otro',
  ],
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const ReclasificarRelacionModal: React.FC<ReclasificarRelacionModalProps> = ({
  isOpen,
  relacion,
  onClose,
  onSuccess,
  onError,
}) => {
  const currentUser = useAuthStore((s) => s.userProfile);
  const [nuevoTipo, setNuevoTipo] = useState<TipoRelacion | ''>('');
  const [nuevoSubTipo, setNuevoSubTipo] = useState<string>('');
  const [nuevoCargo, setNuevoCargo] = useState('');
  const [nuevoMonto, setNuevoMonto] = useState<number | null>(null);
  const [nuevaMoneda, setNuevaMoneda] = useState<'PEN' | 'USD'>('PEN');
  const [notaMotivo, setNotaMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state al abrir/cambiar la relación
  React.useEffect(() => {
    if (isOpen && relacion) {
      setNuevoTipo('');
      setNuevoSubTipo('');
      setNuevoCargo('');
      setNuevoMonto(null);
      setNuevaMoneda(relacion.monedaReferencia ?? 'PEN');
      setNotaMotivo('');
      setError(null);
    }
  }, [isOpen, relacion]);

  // ESC handler
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !relacion) return null;

  const colorsActual = TIPO_RELACION_COLORS[relacion.tipo];
  const colorsNuevo = nuevoTipo ? TIPO_RELACION_COLORS[nuevoTipo as TipoRelacion] : null;
  const subTiposNuevo = nuevoTipo ? SUBTIPOS_POR_TIPO[nuevoTipo as TipoRelacion] : [];

  const tipoValido = nuevoTipo && nuevoTipo !== relacion.tipo;
  const puedeSubmit = tipoValido && !submitting;

  const handleSubmit = async () => {
    if (!nuevoTipo) {
      setError('Elegí el nuevo tipo de relación');
      return;
    }
    if (nuevoTipo === relacion.tipo) {
      setError(
        `El nuevo tipo debe ser distinto al actual (${TIPO_RELACION_LABELS[relacion.tipo]}). Para editar campos de la misma relación, usá "Editar".`,
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await relacionesLaboralesService.reclasificar(
        {
          relacionAnteriorId: relacion.id,
          nuevoTipo: nuevoTipo as TipoRelacion,
          nuevoSubTipo: (nuevoSubTipo || undefined) as SubTipoRelacion | undefined,
          nuevoCargoDisplay: nuevoCargo.trim() || undefined,
          nuevoMontoMensualReferencia:
            nuevoMonto !== null && nuevoMonto > 0 ? nuevoMonto : undefined,
          notaMotivo: notaMotivo.trim() || undefined,
        },
        currentUser?.uid ?? 'system',
      );
      onSuccess(
        `Reclasificada · ${TIPO_RELACION_LABELS[relacion.tipo]} → ${TIPO_RELACION_LABELS[nuevoTipo as TipoRelacion]}`,
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al reclasificar';
      setError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Reclasificar relación</h2>
              <p className="text-xs text-slate-500">
                Transición atómica · cierra la actual + crea la nueva con audit trail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Banner explicativo · canon v5.6 */}
          <div className="bg-indigo-50 ring-1 ring-indigo-200 rounded-lg p-3 text-xs text-indigo-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Operación atómica:</strong> la relación actual se cerrará (motivoFin=reclasificacion ·
              snapshot inmutable) y se creará una nueva del tipo elegido. Ambas quedan vinculadas en el
              histórico para trazabilidad.
            </div>
          </div>

          {/* §1 · Estado ANTES (la relación que se cierra) */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-rose-700 mb-2">
              SE CERRARÁ ESTA RELACIÓN
            </div>
            <div className={`${colorsActual.bg} ring-1 ${colorsActual.ring} rounded-xl p-3 opacity-90`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{TIPO_RELACION_ICONS[relacion.tipo]}</span>
                <span className={`text-sm font-bold ${colorsActual.text}`}>
                  {TIPO_RELACION_LABELS[relacion.tipo]}
                </span>
                {relacion.cargoDisplay && (
                  <span className={`text-sm ${colorsActual.text} opacity-80`}>
                    · {relacion.cargoDisplay}
                  </span>
                )}
                <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-bold ml-auto">
                  CERRARÁ
                </span>
              </div>
              {relacion.montoMensualReferencia !== undefined && relacion.montoMensualReferencia > 0 && (
                <div className={`text-[11px] ${colorsActual.text} opacity-80`}>
                  Monto actual:{' '}
                  <strong className="tabular-nums">
                    {relacion.monedaReferencia === 'USD' ? '$' : 'S/'}
                    {relacion.montoMensualReferencia.toLocaleString('es-PE')}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Flecha visual */}
          <div className="flex justify-center">
            <div className="bg-slate-100 rounded-full px-3 py-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <ArrowRight className="w-3.5 h-3.5" /> SE CREARÁ NUEVA
            </div>
          </div>

          {/* §2 · Nueva relación (form) */}
          <div className="space-y-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 mb-1">
              NUEVA RELACIÓN
            </div>

            {/* Nuevo tipo */}
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
                Tipo nuevo *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {TIPOS_DISPONIBLES.map((t) => {
                  const colors = TIPO_RELACION_COLORS[t];
                  const isCurrent = t === relacion.tipo;
                  const isSelected = nuevoTipo === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        if (isCurrent) return;
                        setNuevoTipo(t);
                        setNuevoSubTipo('');
                      }}
                      disabled={isCurrent}
                      className={`text-left p-2 rounded-lg transition-all ${
                        isSelected
                          ? `${colors.bg} ring-2 ${colors.ring} ${colors.text}`
                          : isCurrent
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed line-through'
                            : 'bg-white ring-1 ring-slate-200 hover:ring-slate-300 text-slate-700'
                      }`}
                      title={isCurrent ? 'Mismo tipo que la actual · no aplica' : `Reclasificar a ${TIPO_RELACION_LABELS[t]}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{TIPO_RELACION_ICONS[t]}</span>
                        <span className="text-xs font-semibold">{TIPO_RELACION_LABELS[t]}</span>
                      </div>
                      {isCurrent && (
                        <div className="text-[9px] text-slate-400 mt-0.5">actual</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subtipo · si hay tipo elegido */}
            {nuevoTipo && (
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
                  Subtipo (opcional)
                </label>
                <select
                  value={nuevoSubTipo}
                  onChange={(e) => setNuevoSubTipo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">— ninguno —</option>
                  {subTiposNuevo.map((st) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cargo */}
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
                Cargo nuevo (opcional)
              </label>
              <input
                type="text"
                value={nuevoCargo}
                onChange={(e) => setNuevoCargo(e.target.value)}
                placeholder="Ej. Account Manager · Sales Lead..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            {/* Monto */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
                  Monto mensual (opcional)
                </label>
                <input
                  type="number"
                  value={nuevoMonto ?? ''}
                  onChange={(e) => setNuevoMonto(e.target.value ? Number(e.target.value) : null)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
                  Moneda
                </label>
                <select
                  value={nuevaMoneda}
                  onChange={(e) => setNuevaMoneda(e.target.value as 'PEN' | 'USD')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="PEN">PEN (S/)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            {/* Nota motivo */}
            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
                Motivo del cambio (opcional)
              </label>
              <textarea
                rows={2}
                value={notaMotivo}
                onChange={(e) => setNotaMotivo(e.target.value)}
                placeholder="Ej. Pasa a planilla full-time desde el 1 de junio..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">
                Se guardará en la relación cerrada (notaMotivoFin) y en la nueva (notas).
              </p>
            </div>
          </div>

          {/* Preview de transición */}
          {nuevoTipo && colorsNuevo && tipoValido && (
            <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 mb-1.5">
                Preview · ¿qué pasará?
              </div>
              <div className="text-xs text-emerald-900 flex items-center gap-1.5 flex-wrap">
                <span className={`${colorsActual.bg} ${colorsActual.text} px-1.5 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1`}>
                  {TIPO_RELACION_ICONS[relacion.tipo]} {TIPO_RELACION_LABELS[relacion.tipo]}
                </span>
                <span className="text-emerald-700">se cierra</span>
                <ArrowRight className="w-3 h-3" />
                <span className={`${colorsNuevo.bg} ${colorsNuevo.text} px-1.5 py-0.5 rounded text-[10px] font-semibold inline-flex items-center gap-1`}>
                  {TIPO_RELACION_ICONS[nuevoTipo as TipoRelacion]} {TIPO_RELACION_LABELS[nuevoTipo as TipoRelacion]}
                </span>
                <span className="text-emerald-700">se crea (vinculada con la anterior)</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-2.5 text-xs text-rose-900 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!puedeSubmit}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Reclasificar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReclasificarRelacionModal;
