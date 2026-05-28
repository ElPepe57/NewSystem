/**
 * RelacionModals.tsx · chk5.PERSONAS-v5.6 · E5.1 (2026-05-28)
 *
 * Conjunto de modales operativos para acciones sobre una RelacionLaboral:
 *   - PausarRelacionModal   · vigente/prueba → pausada (con motivo)
 *   - ReanudarRelacionModal · pausada → vigente (confirm simple)
 *   - FinalizarRelacionModal · vigente/pausada → finalizada (motivoFin + nota + snapshot)
 *   - EditarRelacionModal   · cambios a campos editables (cargo · monto · subtipo · notas)
 *
 * El modal de Reclasificar (atómico · cierra A + crea B) vive separado en
 * ReclasificarRelacionModal.tsx (E5.2 · más complejo).
 *
 * El wizard de Agregar nueva relación vive en AgregarRelacionWizard.tsx
 * (E5.3 · 2 pasos).
 *
 * Cada modal:
 *   - Es props-driven (relacion + isOpen + onClose + onSuccess + onError)
 *   - Llama al método correspondiente del relacionesLaboralesService (E1)
 *   - Loading state en el botón submit
 *   - Validación inline · error banner rose si aplica
 *   - ESC + click overlay cierran
 *   - Color semántico canon por tipo de relación (teal/sky/purple/amber)
 */

import React, { useState } from 'react';
import {
  X,
  Pause,
  Play,
  Square,
  Edit2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { relacionesLaboralesService } from '../../services/relacionesLaborales.service';
import type {
  RelacionLaboral,
  MotivoFinRelacion,
} from '../../types/relacionLaboral.types';
import {
  TIPO_RELACION_LABELS,
  TIPO_RELACION_ICONS,
  TIPO_RELACION_COLORS,
  MOTIVO_FIN_LABELS,
} from '../../types/relacionLaboral.types';

// ═════════════════════════════════════════════════════════════════════════
// HELPER · ModalShell (wrapper común)
// ═════════════════════════════════════════════════════════════════════════

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo?: string;
  icon: React.FC<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  titulo,
  subtitulo,
  icon: Icon,
  iconColor,
  children,
  footer,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">{titulo}</h2>
              {subtitulo && <p className="text-xs text-slate-500 truncate">{subtitulo}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 flex-shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          {footer}
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// PROPS comunes
// ═════════════════════════════════════════════════════════════════════════

interface BaseModalProps {
  isOpen: boolean;
  relacion: RelacionLaboral | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// 1. PausarRelacionModal
// ═════════════════════════════════════════════════════════════════════════

export const PausarRelacionModal: React.FC<BaseModalProps> = ({
  isOpen,
  relacion,
  onClose,
  onSuccess,
  onError,
}) => {
  const currentUser = useAuthStore((s) => s.userProfile);
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMotivo('');
      setError(null);
    }
  }, [isOpen]);

  if (!relacion) return null;
  const colors = TIPO_RELACION_COLORS[relacion.tipo];

  const handleSubmit = async () => {
    if (motivo.trim().length < 5) {
      setError('El motivo es obligatorio (mín 5 caracteres)');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await relacionesLaboralesService.pausar(relacion.id, motivo.trim(), currentUser?.uid ?? 'system');
      onSuccess(`Relación ${TIPO_RELACION_LABELS[relacion.tipo]} pausada · ${motivo.trim()}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al pausar';
      setError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      titulo="Pausar relación"
      subtitulo={`${TIPO_RELACION_LABELS[relacion.tipo]}${relacion.cargoDisplay ? ` · ${relacion.cargoDisplay}` : ''}`}
      icon={Pause}
      iconColor="bg-amber-100 text-amber-700"
      footer={
        <>
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
            disabled={submitting}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
            Pausar
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        La relación pasará a estado <strong className="text-amber-700">pausada</strong>. Podés reanudarla
        después sin perder el histórico.
      </p>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
          Motivo de la pausa *
        </label>
        <textarea
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. Licencia de maternidad · Sabbatical 3 meses · Suspensión por revisión..."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
        />
        <p className="text-[10px] text-slate-500 mt-0.5">Se agregará a las notas de la relación.</p>
      </div>
      <div className={`${colors.bg} ring-1 ${colors.ring} rounded-lg p-3 text-xs ${colors.text} flex items-start gap-2`}>
        <span className="text-base flex-shrink-0">{TIPO_RELACION_ICONS[relacion.tipo]}</span>
        <span>
          La pausa <strong>NO afecta</strong> el snapshot inmutable · los datos vigentes se preservan
          y se restauran al reanudar.
        </span>
      </div>
      {error && (
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-2.5 text-xs text-rose-900 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </ModalShell>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// 2. ReanudarRelacionModal
// ═════════════════════════════════════════════════════════════════════════

export const ReanudarRelacionModal: React.FC<BaseModalProps> = ({
  isOpen,
  relacion,
  onClose,
  onSuccess,
  onError,
}) => {
  const currentUser = useAuthStore((s) => s.userProfile);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  if (!relacion) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await relacionesLaboralesService.reanudar(relacion.id, currentUser?.uid ?? 'system');
      onSuccess(`Relación ${TIPO_RELACION_LABELS[relacion.tipo]} reanudada`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al reanudar';
      setError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      titulo="Reanudar relación"
      subtitulo={`${TIPO_RELACION_LABELS[relacion.tipo]}${relacion.cargoDisplay ? ` · ${relacion.cargoDisplay}` : ''}`}
      icon={Play}
      iconColor="bg-emerald-100 text-emerald-700"
      footer={
        <>
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
            disabled={submitting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Reanudar
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        La relación volverá a estado <strong className="text-emerald-700">vigente</strong> con los mismos
        datos que tenía antes de la pausa.
      </p>
      {error && (
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-2.5 text-xs text-rose-900 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </ModalShell>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// 3. FinalizarRelacionModal · canon v5.6 snapshot inmutable
// ═════════════════════════════════════════════════════════════════════════

const MOTIVOS_DISPONIBLES_POR_TIPO: Record<string, MotivoFinRelacion[]> = {
  empleado: ['renuncia', 'despido', 'fin_contrato', 'reclasificacion', 'jubilacion', 'otro'],
  honorarios: ['fin_contrato', 'reclasificacion', 'otro'],
  socio: ['venta_participacion', 'otro'],
  externo: ['fin_contrato', 'otro'],
};

export const FinalizarRelacionModal: React.FC<BaseModalProps> = ({
  isOpen,
  relacion,
  onClose,
  onSuccess,
  onError,
}) => {
  const currentUser = useAuthStore((s) => s.userProfile);
  const [motivoFin, setMotivoFin] = useState<MotivoFinRelacion>('fin_contrato');
  const [notaMotivoFin, setNotaMotivoFin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && relacion) {
      const motivosValidos = MOTIVOS_DISPONIBLES_POR_TIPO[relacion.tipo] ?? ['otro'];
      setMotivoFin(motivosValidos[0]);
      setNotaMotivoFin('');
      setError(null);
    }
  }, [isOpen, relacion]);

  if (!relacion) return null;
  const motivos = MOTIVOS_DISPONIBLES_POR_TIPO[relacion.tipo] ?? ['otro'];

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await relacionesLaboralesService.finalizar(
        {
          relacionId: relacion.id,
          motivoFin,
          notaMotivoFin: notaMotivoFin.trim() || undefined,
        },
        currentUser?.uid ?? 'system',
      );
      onSuccess(`Relación ${TIPO_RELACION_LABELS[relacion.tipo]} finalizada · ${MOTIVO_FIN_LABELS[motivoFin]}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al finalizar';
      setError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      titulo="Finalizar relación"
      subtitulo={`${TIPO_RELACION_LABELS[relacion.tipo]}${relacion.cargoDisplay ? ` · ${relacion.cargoDisplay}` : ''}`}
      icon={Square}
      iconColor="bg-rose-100 text-rose-700"
      footer={
        <>
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
            disabled={submitting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
            Finalizar
          </button>
        </>
      }
    >
      <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 text-xs text-rose-900 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Atención:</strong> al finalizar, la relación queda <strong>inmutable</strong>. Se genera un
          snapshot de los datos actuales para auditoría · no se puede revertir.
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
          Motivo de finalización *
        </label>
        <select
          value={motivoFin}
          onChange={(e) => setMotivoFin(e.target.value as MotivoFinRelacion)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          {motivos.map((m) => (
            <option key={m} value={m}>
              {MOTIVO_FIN_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
          Nota / detalle (opcional)
        </label>
        <textarea
          rows={2}
          value={notaMotivoFin}
          onChange={(e) => setNotaMotivoFin(e.target.value)}
          placeholder="Detalles adicionales del cierre..."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
      </div>
      {error && (
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-2.5 text-xs text-rose-900 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </ModalShell>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// 4. EditarRelacionModal · campos editables · NO cambia tipo ni userId
// ═════════════════════════════════════════════════════════════════════════

export const EditarRelacionModal: React.FC<BaseModalProps> = ({
  isOpen,
  relacion,
  onClose,
  onSuccess,
  onError,
}) => {
  const currentUser = useAuthStore((s) => s.userProfile);
  const [cargoDisplay, setCargoDisplay] = useState('');
  const [montoMensualReferencia, setMontoMensualReferencia] = useState<number | null>(null);
  const [monedaReferencia, setMonedaReferencia] = useState<'PEN' | 'USD'>('PEN');
  const [subTipo, setSubTipo] = useState<string>('');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && relacion) {
      setCargoDisplay(relacion.cargoDisplay ?? '');
      setMontoMensualReferencia(relacion.montoMensualReferencia ?? null);
      setMonedaReferencia(relacion.monedaReferencia ?? 'PEN');
      setSubTipo(relacion.subTipo ?? '');
      setNotas(relacion.notas ?? '');
      setError(null);
    }
  }, [isOpen, relacion]);

  if (!relacion) return null;
  const colors = TIPO_RELACION_COLORS[relacion.tipo];

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await relacionesLaboralesService.update(
        relacion.id,
        {
          cargoDisplay: cargoDisplay.trim() || undefined,
          montoMensualReferencia:
            montoMensualReferencia !== null && montoMensualReferencia > 0 ? montoMensualReferencia : undefined,
          monedaReferencia:
            montoMensualReferencia !== null && montoMensualReferencia > 0 ? monedaReferencia : undefined,
          subTipo: (subTipo || undefined) as RelacionLaboral['subTipo'],
          notas: notas.trim() || undefined,
        },
        currentUser?.uid ?? 'system',
      );
      onSuccess('Cambios guardados');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al editar';
      setError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      titulo="Editar relación"
      subtitulo={`${TIPO_RELACION_LABELS[relacion.tipo]}${relacion.cargoDisplay ? ` · ${relacion.cargoDisplay}` : ''}`}
      icon={Edit2}
      iconColor={`${colors.bg} ${colors.text}`}
      footer={
        <>
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
            disabled={submitting}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit2 className="w-3.5 h-3.5" />}
            Guardar
          </button>
        </>
      }
    >
      <p className="text-xs text-slate-500">
        El tipo de relación y la fecha de inicio NO se pueden cambiar (usá Reclasificar para eso).
      </p>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
          Cargo / título
        </label>
        <input
          type="text"
          value={cargoDisplay}
          onChange={(e) => setCargoDisplay(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
            Monto mensual
          </label>
          <input
            type="number"
            value={montoMensualReferencia ?? ''}
            onChange={(e) => setMontoMensualReferencia(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm tabular-nums"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
            Moneda
          </label>
          <select
            value={monedaReferencia}
            onChange={(e) => setMonedaReferencia(e.target.value as 'PEN' | 'USD')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="PEN">PEN (S/)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
          Subtipo (opcional)
        </label>
        <input
          type="text"
          value={subTipo}
          onChange={(e) => setSubTipo(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          placeholder="Ej. full_time · consultor · fundador..."
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-1 block">
          Notas
        </label>
        <textarea
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        />
      </div>
      {error && (
        <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-2.5 text-xs text-rose-900 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </ModalShell>
  );
};
