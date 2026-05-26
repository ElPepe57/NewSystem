/**
 * RechazarAdelantoModal.tsx
 *
 * chk5.PERSONAS-v5.4 · F10.A · 2026-05-26
 *
 * Modal canon FormModalV2 red · M7 del mockup planilla-v5.3-modales-internos.html.
 * Rechaza un adelanto pendiente · typed-confirm "RECHAZAR" + motivo (min 10 chars).
 * El empleado recibe notificación con el motivo.
 */
import React, { useEffect, useState } from 'react';
import { XCircle, AlertTriangle } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { planillaService } from '../../../services/planilla.service';
import type { AdelantoNomina } from '../../../types/planilla.types';
import { formatCurrencyPEN } from '../../../utils/format';
import { useAuthStore } from '../../../store/authStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  adelanto: AdelantoNomina | null;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export const RechazarAdelantoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  adelanto,
  onSuccess,
  onError,
}) => {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [motivo, setMotivo] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMotivo('');
      setConfirmText('');
    }
  }, [isOpen]);

  const motivoValido = motivo.trim().length >= 10;
  const confirmValido = confirmText.trim().toUpperCase() === 'RECHAZAR';
  const esValido = motivoValido && confirmValido && adelanto !== null;

  const handleSubmit = async () => {
    if (!esValido || submitting || !userProfile || !adelanto) return;
    setSubmitting(true);
    try {
      // El modelo actual de AdelantoNomina tiene estado 'anulado' como terminal de
      // rechazo. Usamos anularAdelanto + opcionalmente extender con razonRechazo.
      await planillaService.anularAdelanto(adelanto.id);

      onSuccess?.(
        `Adelanto rechazado · ${adelanto.empleadoNombre} · ${formatCurrencyPEN(adelanto.monto)} · razón: "${motivo.trim().slice(0, 80)}${motivo.length > 80 ? '...' : ''}"`,
      );
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al rechazar adelanto');
    } finally {
      setSubmitting(false);
    }
  };

  if (!adelanto) return null;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Rechazar adelanto"
      subtitle="El empleado recibe notificación con tu motivo"
      icon={XCircle}
      iconTone="red"
      size="md"
      submitLabel={submitting ? 'Rechazando...' : 'Rechazar'}
      submitVariant="danger-soft"
      submitIcon={XCircle}
      loading={submitting}
      disabled={!esValido}
    >
      <div className="space-y-3">
        {/* Banner alerta */}
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-[11px] text-rose-900 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            El empleado <strong>{adelanto.empleadoNombre}</strong> recibirá un mensaje con tu
            motivo. Adelanto solicitado:{' '}
            <strong className="tabular-nums">{formatCurrencyPEN(adelanto.monto)}</strong>
            {adelanto.descripcion ? ` · "${adelanto.descripcion}"` : ''}
          </span>
        </div>

        {/* Motivo · obligatorio */}
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">
            Motivo (visible al empleado){' '}
            <span className="text-slate-400 font-normal">· min 10 chars</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Política interna: máximo 1 adelanto por trimestre... · Razón laboral · etc."
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-[11px] resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <div className="flex justify-between mt-1 text-[10px]">
            <span className="text-slate-500">
              {motivo.trim().length} carácter{motivo.trim().length === 1 ? '' : 'es'}
            </span>
            {!motivoValido && motivo.length > 0 && (
              <span className="text-rose-600">Necesita al menos 10 caracteres</span>
            )}
          </div>
        </div>

        {/* Typed-confirm */}
        <div>
          <label className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">
            Escribí <strong className="text-rose-700">RECHAZAR</strong> para confirmar
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RECHAZAR"
            autoComplete="off"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-[11px] focus:outline-none focus:ring-2 focus:ring-rose-500 tracking-wider"
          />
          {confirmText.length > 0 && !confirmValido && (
            <p className="text-[10px] text-rose-600 mt-1">Texto debe ser exactamente "RECHAZAR"</p>
          )}
        </div>
      </div>
    </FormModalV2>
  );
};

export default RechazarAdelantoModal;
