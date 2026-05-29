/**
 * src/components/modules/usuarios/AprobarUsuarioModal.tsx
 * chk5.F4-USERS (2026-05-26) · Canon ACTO 5.1 v2 · ENRIQUECIDO.
 *
 * Aprueba un usuario pendiente · multi-rol obligatorio (NO single).
 * Info user · origen (invitado vs self-signup) · IP/UA si self-signup ·
 * RolesMultiSelect canon + 2 botones (Aprobar y configurar después / Aprobar y configurar).
 */
import { useState, useEffect } from 'react';
import { UserCheck, Globe, Mail, Info } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import RolesMultiSelect from './RolesMultiSelect';
import { getUserEstado } from '../../../types/auth.types';
import type { UserProfile, UserRole } from '../../../types/auth.types';

const functions = getFunctions();

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function AprobarUsuarioModal({ isOpen, onClose, user, onSuccess, onError }: Props) {
  const [rolesAsignados, setRolesAsignados] = useState<UserRole[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) setRolesAsignados([]);
  }, [isOpen]);

  if (!user) return null;
  const isValid = rolesAsignados.length > 0;
  const esSelfSignup = user.origen === 'self_signup';
  const estado = getUserEstado(user);

  const aprobar = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const fn = httpsCallable<{ uid: string; rolesAsignados: UserRole[] }, { success: boolean }>(
        functions,
        'approveUser',
      );
      await fn({ uid: user.uid, rolesAsignados });
      onSuccess?.(`"${user.displayName}" aprobado · email enviado`);
      onClose();
      // chk5.PERSONAS-v5.x-LINEAS · 2026-05-29 · se removió la auto-continuación a las
      // drill pages legacy (editar/laborales · editar/socio). Las relaciones laborales
      // y societarias se gestionan ahora desde el tab Relaciones del perfil (UserPanel).
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al aprobar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={() => aprobar()}
      title={`Aprobar · ${user.displayName}`}
      subtitle="Asigná roles antes de activar"
      icon={UserCheck}
      iconTone="emerald"
      size="md"
      submitLabel="Aprobar y activar"
      submitVariant="success-soft"
      submitIcon={UserCheck}
      loading={saving}
      disabled={!isValid}
    >
      <div className="space-y-4">
        {/* Info del usuario */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px]">
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="font-bold text-slate-900">{user.displayName}</div>
              <div className="text-slate-600">{user.email}</div>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
              estado === 'pendiente_aprobacion'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {estado}
            </span>
          </div>
          <div className="text-slate-500 mt-1">
            {user.fechaRegistro?.toDate?.()
              ? `Registró ${user.fechaRegistro.toDate().toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : 'Registró hace tiempo no determinado'}
          </div>
          {/* Origen */}
          <div className="mt-2 flex flex-wrap gap-1">
            {esSelfSignup ? (
              <span className="bg-orange-100 text-orange-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                <Globe className="w-2.5 h-2.5" /> Self-signup
              </span>
            ) : user.origen === 'invitacion_admin' ? (
              <span className="bg-sky-100 text-sky-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
                <Mail className="w-2.5 h-2.5" /> Invitado por admin
              </span>
            ) : (
              <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                Creación directa
              </span>
            )}
          </div>
        </div>

        {/* Aviso si self-signup */}
        {esSelfSignup && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Self-signup · trust bajo</strong>
              {user.ipRegistro && <><br />IP: <code className="bg-amber-100 px-1 rounded text-[10px]">{user.ipRegistro}</code></>}
              {user.userAgentRegistro && <><br />UA: <code className="bg-amber-100 px-1 rounded text-[10px]">{user.userAgentRegistro.slice(0, 50)}...</code></>}
              <br />Validá la identidad antes de aprobar.
            </div>
          </div>
        )}

        {/* RolesMultiSelect obligatorio */}
        <div>
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
            Asigná roles * <span className="text-slate-400 font-normal">(mínimo 1)</span>
          </div>
          <RolesMultiSelect value={rolesAsignados} onChange={setRolesAsignados} />
        </div>

        {/* Auto-continuación info */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-[11px] text-emerald-900 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            <strong>"Aprobar y configurar":</strong> tras aprobar te llevamos a configurar
            datos {rolesAsignados.includes('socio') ? 'de socio (D7)' : 'laborales'} de inmediato.<br />
            <strong>"Aprobar · configurar después":</strong> aprueba sin redirect · configurás más tarde desde la Ficha 360.
          </div>
        </div>
      </div>
    </FormModalV2>
  );
}
