/**
 * src/components/modules/usuarios/DesconectarTodasModal.tsx
 * chk5.F4-USERS (2026-05-26) · Canon ACTO 5.6 v2 · emergencia.
 *
 * Desconecta TODAS las sesiones del SISTEMA (de todos los usuarios).
 * Usado solo en emergencia de seguridad. Typed-confirm "DESCONECTAR".
 */
import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import { sesionService } from '../../../services/sesion.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function DesconectarTodasModal({ isOpen, onClose, onSuccess, onError }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [forzarReset, setForzarReset] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfirmText('');
      setForzarReset(false);
    }
  }, [isOpen]);

  const isValid = confirmText.trim().toUpperCase() === 'DESCONECTAR';

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const result = await sesionService.desconectarTodasSistema();
      onSuccess?.(`${result.count} sesiones cerradas en todo el sistema`);
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
      title="Desconectar TODAS las sesiones del sistema"
      subtitle="Acción de emergencia · todos los usuarios"
      icon={ShieldAlert}
      iconTone="red"
      size="sm"
      submitLabel="Desconectar todas"
      submitVariant="danger-soft"
      submitIcon={ShieldAlert}
      loading={saving}
      disabled={!isValid}
    >
      <div className="space-y-3">
        <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 text-[11px] text-rose-900">
          <div className="font-bold mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Acción de emergencia
          </div>
          <p className="text-[11px]">
            Todas las sesiones activas del sistema se cerrarán inmediatamente.
            Todos los usuarios deberán ingresar de nuevo. Usar solo en caso de
            incidente de seguridad (compromise de credenciales · acceso no autorizado).
          </p>
        </div>

        <label className="flex items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            checked={forzarReset}
            onChange={(e) => setForzarReset(e.target.checked)}
          />
          <span>Forzar reset de password para todos (no implementado · próxima versión)</span>
        </label>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Escribí <strong className="text-rose-700">DESCONECTAR</strong> para confirmar
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DESCONECTAR"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px] focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            autoFocus
          />
        </div>
      </div>
    </FormModalV2>
  );
}
