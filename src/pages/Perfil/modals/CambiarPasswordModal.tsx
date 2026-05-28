/**
 * CambiarPasswordModal · F10.F.1.N · 2026-05-27
 *
 * Modal canon FormModalV2 para cambiar contraseña del user logueado.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 11 (líneas 1199-1257).
 *
 * Estructura canon:
 *   - Header: iconTone="red" + Lock icon + título "Cambiar contraseña"
 *   - Body:
 *     · Nueva contraseña (input password + toggle visibility)
 *     · Confirmar contraseña
 *     · Validación inline: ≥6 chars · coinciden
 *     · Banner amber: "Las sesiones en otros dispositivos se cerrarán"
 *   - Footer: Cancelar + Guardar (variant danger-soft · icon Lock)
 *
 * Connector: userService.changeOwnPassword
 * onSuccess: notifica al user que sesiones se cerraron · redirect login opcional
 */
import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { FormModalV2 } from '../../../design-system';
import { userService } from '../../../services/user.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Callback opcional al éxito · default solo cierra el modal */
  onSuccess?: () => void;
}

export const CambiarPasswordModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const passwordsLongEnough = newPassword.length >= 6;
  const canSubmit = passwordsLongEnough && passwordsMatch && !saving;

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await userService.changeOwnPassword(newPassword);
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Error al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
      title="Cambiar contraseña"
      subtitle="Tu nueva contraseña debe tener al menos 6 caracteres"
      icon={Lock}
      iconTone="red"
      submitLabel={saving ? 'Cambiando...' : 'Cambiar contraseña'}
      submitVariant="danger-soft"
      submitIcon={Lock}
      loading={saving}
      disabled={!canSubmit}
      size="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-[12px] text-rose-800 inline-flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div>
          <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5 block">
            Nueva contraseña <span className="text-rose-600">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 pr-10 text-[13px]"
              placeholder="Mínimo 6 caracteres"
              autoFocus
              disabled={saving}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {newPassword.length > 0 && !passwordsLongEnough && (
            <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Mínimo 6 caracteres
            </p>
          )}
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5 block">
            Confirmar contraseña <span className="text-rose-600">*</span>
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-[13px]"
            placeholder="Repetí la nueva contraseña"
            disabled={saving}
          />
          {newPassword && confirmPassword && !passwordsMatch && (
            <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Las contraseñas no coinciden
            </p>
          )}
        </div>

        {/* Banner advertencia · canon mockup línea 1240 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-800 inline-flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Al cambiar tu contraseña, todas las sesiones activas en otros dispositivos se cerrarán
            automáticamente. Tu sesión actual se mantiene.
          </span>
        </div>
      </div>
    </FormModalV2>
  );
};

export default CambiarPasswordModal;
