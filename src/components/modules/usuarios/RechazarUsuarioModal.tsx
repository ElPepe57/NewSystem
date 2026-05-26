/**
 * src/components/modules/usuarios/RechazarUsuarioModal.tsx
 * chk5.F4-USERS (2026-05-26) · Canon ACTO 5.2 v2 · typed-confirm + motivo.
 *
 * Llama a CF rejectUser · marca user como archivado + envía email "expirada"
 * con el motivo. Solo aplicable a users en estado pendiente_aprobacion.
 */
import { useState, useEffect } from 'react';
import { UserX, AlertTriangle } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import type { UserProfile } from '../../../types/auth.types';

const functions = getFunctions();

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function RechazarUsuarioModal({ isOpen, onClose, user, onSuccess, onError }: Props) {
  const [motivo, setMotivo] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMotivo('');
      setConfirmText('');
    }
  }, [isOpen]);

  if (!user) return null;
  const isValid = motivo.trim().length >= 10 && confirmText.trim().toUpperCase() === 'RECHAZAR';

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const fn = httpsCallable<{ uid: string; motivo: string }, { success: boolean }>(
        functions,
        'rejectUser',
      );
      await fn({ uid: user.uid, motivo: motivo.trim() });
      onSuccess?.(`Usuario "${user.displayName}" rechazado · email enviado`);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al rechazar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Rechazar · ${user.displayName}`}
      subtitle="El usuario recibirá un email con el motivo"
      icon={UserX}
      iconTone="red"
      size="sm"
      submitLabel="Rechazar"
      submitVariant="danger-soft"
      submitIcon={UserX}
      loading={saving}
      disabled={!isValid}
    >
      <div className="space-y-3">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-[11px] text-rose-900 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            Esta acción es permanente. El usuario recibirá un email notificando
            el rechazo · y no podrá re-registrarse con el mismo email durante 90 días.
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px]">
          <div className="font-bold text-slate-900">{user.displayName}</div>
          <div className="text-slate-600">{user.email}</div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Motivo (visible al usuario) <span className="text-slate-400">· min 10 caracteres</span>
          </label>
          <textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="No corresponde al equipo de Vita Skin..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[11px] resize-none"
            autoFocus
          />
          {motivo && motivo.trim().length < 10 && (
            <p className="text-[10px] text-rose-600 mt-1">El motivo debe tener al menos 10 caracteres</p>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Escribí <strong className="text-rose-700">RECHAZAR</strong> para confirmar
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RECHAZAR"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px] focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
          />
        </div>
      </div>
    </FormModalV2>
  );
}
