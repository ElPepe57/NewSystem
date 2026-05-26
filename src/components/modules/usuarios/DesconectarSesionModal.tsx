/**
 * src/components/modules/usuarios/DesconectarSesionModal.tsx
 * chk5.F4-USERS (2026-05-26) · Canon ACTO 5.4 v2.
 *
 * Desconecta TODAS las sesiones del user específico (no una sola · esa
 * acción está en Ficha 360 tab Sesiones · por sesión individual).
 * Llama a CF desconectarTodasSesiones (revokeRefreshTokens).
 */
import { useState } from 'react';
import { LogOut, AlertTriangle } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { sesionService } from '../../../services/sesion.service';
import type { UserProfile } from '../../../types/auth.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function DesconectarSesionModal({ isOpen, onClose, user, onSuccess, onError }: Props) {
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await sesionService.desconectarTodasDeUsuario(user.uid);
      onSuccess?.(`Sesiones de "${user.displayName}" cerradas`);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al desconectar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={`Desconectar sesiones · ${user.displayName}`}
      subtitle="Cierra todas las sesiones activas del usuario"
      icon={LogOut}
      iconTone="amber"
      size="sm"
      submitLabel="Desconectar"
      submitVariant="primary-soft"
      submitIcon={LogOut}
      loading={saving}
    >
      <div className="space-y-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px]">
          <div className="font-bold text-slate-900">{user.displayName}</div>
          <div className="text-slate-600">{user.email}</div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            Esta acción cierra <strong>todas las sesiones activas</strong> del usuario.
            Deberá ingresar de nuevo en cada dispositivo.
          </div>
        </div>
      </div>
    </FormModalV2>
  );
}
