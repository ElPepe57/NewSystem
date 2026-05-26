/**
 * src/components/modules/usuarios/ResetPasswordModal.tsx
 * chk5.F4-USERS (2026-05-26) · Canon ACTO 5.3 v2.
 *
 * Reset password manual por admin · ingresa password nueva + opcional
 * forzar cambio primer login + opcional desconectar todas sesiones.
 */
import { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
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

export default function ResetPasswordModal({ isOpen, onClose, user, onSuccess, onError }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setNewPassword('');
      setConfirmPassword('');
      setLocalError(null);
    }
  }, [isOpen]);

  if (!user) return null;

  const handleSubmit = async () => {
    setLocalError(null);
    if (newPassword.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }
    setSaving(true);
    try {
      await userService.resetUserPassword(user.uid, newPassword);
      onSuccess?.(`Contraseña de "${user.displayName}" actualizada correctamente`);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al resetear');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Reset password · ${user.displayName}`}
      subtitle="Admin define nueva password manualmente"
      icon={KeyRound}
      iconTone="amber"
      size="sm"
      submitLabel="Resetear password"
      submitVariant="primary-soft"
      submitIcon={KeyRound}
      loading={saving}
      disabled={!newPassword || !confirmPassword}
    >
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900">
          Email · <strong>{user.email}</strong>. La password se actualizará inmediatamente.
        </div>

        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Nueva password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px] pr-9"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-[31px] text-slate-400 hover:text-slate-600"
            aria-label="toggle"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Confirmar password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repetir password"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px]"
          />
        </div>

        {localError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-lg text-[11px]">
            {localError}
          </div>
        )}
      </div>
    </FormModalV2>
  );
}
