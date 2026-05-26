/**
 * src/components/modules/usuarios/EliminarUsuarioModal.tsx
 * chk5.F4-USERS (2026-05-26) · Canon ACTO 5.5 v2 · typed-confirm.
 *
 * Modal F6.A small (sm) · variant danger-soft. Usuario debe escribir el
 * email exacto del user a eliminar para confirmar · prevención de errores.
 */
import { useState, useEffect } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { userService } from '../../../services/user.service';
import type { UserProfile } from '../../../types/auth.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function EliminarUsuarioModal({ isOpen, onClose, user, onSuccess, onError }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) setConfirmText('');
  }, [isOpen]);

  if (!user) return null;
  const isValid = confirmText.trim().toLowerCase() === user.email.toLowerCase();

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await userService.deleteUser(user.uid);
      onSuccess?.(`Usuario "${user.displayName}" eliminado correctamente`);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Eliminar usuario"
      subtitle="Soft-delete · audit trail 90 días"
      icon={Trash2}
      iconTone="red"
      size="sm"
      submitLabel="Eliminar"
      submitVariant="danger-soft"
      submitIcon={Trash2}
      loading={saving}
      disabled={!isValid}
    >
      <div className="space-y-4">
        <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 text-[12px] text-rose-900">
          <div className="font-bold mb-1.5 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Acción crítica
          </div>
          <ul className="space-y-1 text-[11px] ml-4 list-disc">
            <li>Pierde acceso al sistema inmediatamente</li>
            <li>Sus permisos quedan revocados</li>
            <li>Queda auditado en logs por 90 días</li>
            <li>Si tiene rol planilla/socio · revisar dependencias</li>
          </ul>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px]">
          <div className="font-bold text-slate-900">{user.displayName}</div>
          <div className="text-slate-600">{user.email}</div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Escribí <strong className="text-rose-700">{user.email}</strong> para confirmar
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={user.email}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px] focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            autoFocus
          />
          {confirmText && !isValid && (
            <p className="text-[10px] text-rose-600 mt-1">El email no coincide</p>
          )}
        </div>
      </div>
    </FormModalV2>
  );
}
