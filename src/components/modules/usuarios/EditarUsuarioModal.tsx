/**
 * src/components/modules/usuarios/EditarUsuarioModal.tsx
 * chk5.F4-USERS (2026-05-26) · Canon ACTO 3.1 v2 · Camino 3 híbrido.
 *
 * Modal compacto edita datos básicos + RolesMultiSelect + cards drill
 * para sub-perfiles (NO embebe forms ricos · esos van en drill pages).
 * Reemplaza el modal 'edit-permisos' legacy con tabs internas embebidas.
 */
import { useState, useEffect } from 'react';
import {
  Pencil, Trash2, AlertTriangle, Users,
} from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import RolesMultiSelect from './RolesMultiSelect';
import { userService } from '../../../services/user.service';
import { useAuthStore } from '../../../store/authStore';
import {
  type UserProfile, type UserRole,
  getUserRoles, calcularPermisosDeRoles,
} from '../../../types/auth.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  onRequestDelete?: (user: UserProfile) => void;
}

export default function EditarUsuarioModal({
  isOpen, onClose, user, onSuccess, onError, onRequestDelete,
}: Props) {
  const currentUser = useAuthStore((s) => s.userProfile);
  const isSelf = user?.uid === currentUser?.uid;

  const [displayName, setDisplayName] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cargo, setCargo] = useState('');
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [saving, setSaving] = useState(false);

  // Cargar datos al abrir
  useEffect(() => {
    if (!isOpen || !user) {
      setDisplayName('');
      setTelefono('');
      setCargo('');
      setRoles([]);
      return;
    }
    setDisplayName(user.displayName || '');
    setTelefono(user.telefono || '');
    setCargo(user.cargo || '');
    const initialRoles = getUserRoles(user);
    setRoles(initialRoles.length > 0 ? initialRoles : ['invitado']);
  }, [isOpen, user]);

  if (!user) return null;

  const handleSave = async () => {
    if (saving) return;
    const rolesAGuardar = roles;
    if (rolesAGuardar.length === 0) {
      onError?.('Seleccioná al menos un rol · el usuario quedaría sin permisos.');
      return;
    }

    // chk5.F4-USERS · 2026-05-26 · auto-protección admin
    // Si admin se está auto-editando · NO puede quitarse el rol admin
    // (perdería acceso al sistema · no podría volver a entrar).
    // SÍ puede agregar/quitar cualquier otro rol (socio · planilla · etc.).
    // Si quiere ser degradado · pedile a OTRO admin que lo edite a él.
    if (isSelf) {
      const wasAdmin = getUserRoles(user).includes('admin');
      const willBeAdmin = rolesAGuardar.includes('admin');
      if (wasAdmin && !willBeAdmin) {
        onError?.('No podés quitarte el rol admin a vos mismo · perderías acceso al sistema. Pedile a otro admin que te lo quite.');
        return;
      }
    }

    setSaving(true);
    try {
      const rolPrincipal = rolesAGuardar[0];
      const permisos = calcularPermisosDeRoles(rolesAGuardar);

      // CF compat (single role)
      await userService.updateRoleAndPermisos(user.uid, rolPrincipal, permisos);

      // Complementar con array completo + perfil
      const updates: Record<string, unknown> = {};
      if (rolesAGuardar.length > 1) updates.roles = rolesAGuardar;
      if (displayName.trim() !== user.displayName) updates.displayName = displayName.trim();
      if (telefono.trim() !== (user.telefono || '')) updates.telefono = telefono.trim();
      if (cargo.trim() !== (user.cargo || '')) updates.cargo = cargo.trim();
      if (Object.keys(updates).length > 0) {
        await userService.updateProfile(user.uid, updates);
      }

      onSuccess?.(`"${displayName || user.displayName}" actualizado correctamente`);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const goToDrill = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSave}
      title={`Editar · ${user.displayName}`}
      subtitle={user.email + (isSelf ? ' · auto-edición' : '')}
      icon={Pencil}
      iconTone="purple"
      size="md"
      submitLabel="Guardar cambios"
      submitVariant="primary"
      loading={saving}
      footerExtras={
        onRequestDelete && !isSelf ? (
          <button
            type="button"
            onClick={() => { onClose(); setTimeout(() => onRequestDelete(user), 100); }}
            className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Eliminar usuario
          </button>
        ) : null
      }
    >
      <div className="space-y-5">
        {/* ─── DATOS BÁSICOS ─── */}
        <section>
          <div className="text-[10px] uppercase tracking-wider text-slate-700 font-bold mb-2">Datos básicos</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-600 uppercase font-bold mb-1">
                Email <span className="text-slate-400 font-normal">(no editable)</span>
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[12px] text-slate-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 uppercase font-bold mb-1">Nombre completo</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 uppercase font-bold mb-1">Teléfono</label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+51 999..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 uppercase font-bold mb-1">Cargo / Puesto</label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Gerente · Vendedor · etc"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px]"
              />
            </div>
          </div>
        </section>

        {/* ─── ROLES ─── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-700 font-bold">
              Roles asignados
              {isSelf && (
                <span className="text-amber-700 font-normal">
                  {' '}· auto-edición · el rol admin no se puede quitar
                </span>
              )}
            </div>
          </div>
          <RolesMultiSelect value={roles} onChange={setRoles} />
          {isSelf && (
            <div className="mt-2 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                Te estás editando a vos mismo · podés agregar/quitar roles (socio · planilla · etc) ·
                pero <strong>no podés quitarte el rol admin</strong> · perderías acceso al sistema.
                Si querés ser degradado · pedile a otro admin que te lo quite.
              </span>
            </div>
          )}
        </section>

        {/* ─── RELACIONES · gestión en el modelo nuevo (RelacionLaboral) ───
            chk5.PERSONAS-v5.x-LINEAS · 2026-05-29 · Las cards legacy "Datos de
            socio" + "Datos laborales" (modelo viejo de sub-perfiles singulares)
            se eliminaron. Esos datos ahora viven en las RelacionLaboral · se
            gestionan desde el tab Relaciones del perfil (UserPanel · "Ver perfil").
            Este modal queda enfocado solo en datos básicos + roles del UserProfile. */}
        <section>
          <div className="bg-slate-50 ring-1 ring-slate-200 rounded-lg p-3 flex items-start gap-2.5">
            <Users className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Relaciones laborales y societarias.</strong> El cargo,
              sueldo, equity, línea de negocio y demás datos de cada vínculo (empleado · socio ·
              honorarios) se gestionan desde el <strong>tab Relaciones</strong> del perfil ·
              cerrá este modal y abrí <strong>"Ver perfil"</strong>. Acá solo se editan los datos
              básicos y los roles del sistema.
            </div>
          </div>
        </section>
      </div>
    </FormModalV2>
  );
}
