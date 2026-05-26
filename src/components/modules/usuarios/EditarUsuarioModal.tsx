/**
 * src/components/modules/usuarios/EditarUsuarioModal.tsx
 * chk5.F4-USERS (2026-05-26) · Canon ACTO 3.1 v2 · Camino 3 híbrido.
 *
 * Modal compacto edita datos básicos + RolesMultiSelect + cards drill
 * para sub-perfiles (NO embebe forms ricos · esos van en drill pages).
 * Reemplaza el modal 'edit-permisos' legacy con tabs internas embebidas.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pencil, Briefcase, BriefcaseBusiness, ChevronRight, Trash2,
} from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import RolesMultiSelect from './RolesMultiSelect';
import { userService } from '../../../services/user.service';
import { datosLaboralesService } from '../../../services/datosLaborales.service';
import { datosSocioService } from '../../../services/datosSocio.service';
import { useAuthStore } from '../../../store/authStore';
import {
  type UserProfile, type UserRole,
  getUserRoles, calcularPermisosDeRoles, hasRole,
} from '../../../types/auth.types';
import type { DatosLaborales } from '../../../types/datosLaborales.types';
import type { DatosSocio } from '../../../types/datosSocio.types';

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
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.userProfile);
  const isSelf = user?.uid === currentUser?.uid;

  const [displayName, setDisplayName] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cargo, setCargo] = useState('');
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [datosLab, setDatosLab] = useState<DatosLaborales | null>(null);
  const [datosSoc, setDatosSoc] = useState<DatosSocio | null>(null);
  const [saving, setSaving] = useState(false);

  // Cargar datos al abrir
  useEffect(() => {
    if (!isOpen || !user) {
      setDisplayName('');
      setTelefono('');
      setCargo('');
      setRoles([]);
      setDatosLab(null);
      setDatosSoc(null);
      return;
    }
    setDisplayName(user.displayName || '');
    setTelefono(user.telefono || '');
    setCargo(user.cargo || '');
    const initialRoles = getUserRoles(user);
    setRoles(initialRoles.length > 0 ? initialRoles : ['invitado']);

    // Cargar sub-perfiles en paralelo
    Promise.all([
      datosLaboralesService.get(user.uid).catch(() => null),
      datosSocioService.get(user.uid).catch(() => null),
    ]).then(([lab, soc]) => {
      setDatosLab(lab);
      setDatosSoc(soc);
    });
  }, [isOpen, user]);

  if (!user) return null;

  const tieneRolPlanilla = roles.some((r) =>
    ['vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor'].includes(r));
  const tieneRolSocio = roles.includes('socio');

  const handleSave = async () => {
    if (saving) return;
    const rolesAGuardar = isSelf ? getUserRoles(user) : roles;
    if (rolesAGuardar.length === 0) {
      onError?.('Seleccioná al menos un rol · el usuario quedaría sin permisos.');
      return;
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
              Roles asignados {isSelf && <span className="text-amber-700 font-normal">· auto-edición · no editable</span>}
            </div>
          </div>
          <RolesMultiSelect value={roles} onChange={setRoles} disabled={isSelf} />
        </section>

        {/* ─── SUB-PERFILES · drill cards ─── */}
        <section>
          <div className="text-[10px] uppercase tracking-wider text-slate-700 font-bold mb-2">
            Sub-perfiles · drill a página dedicada
          </div>
          <div className="space-y-2">
            {/* Datos socio */}
            {tieneRolSocio ? (
              <button
                type="button"
                onClick={() => goToDrill(`/usuarios/${user.uid}/editar/socio`)}
                className="w-full bg-violet-50/50 border border-violet-200 hover:bg-violet-50 hover:border-violet-300 rounded-lg p-3 flex items-center gap-3 text-left transition-colors"
              >
                <Briefcase className="w-5 h-5 text-violet-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-slate-900">Datos de socio (D7)</div>
                  <div className="text-[10px] text-violet-700 truncate">
                    {datosSoc
                      ? `${datosSoc.tipoParticipacion} · ${datosSoc.porcentajeParticipacion}% participación`
                      : 'No configurado todavía · click para crear'}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${datosSoc ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {datosSoc ? 'CONFIGURADO' : 'PENDIENTE'}
                </span>
                <ChevronRight className="w-4 h-4 text-violet-600 flex-shrink-0" />
              </button>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-3 flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-slate-400" />
                <div className="flex-1">
                  <div className="text-[12px] font-bold text-slate-500">Datos de socio</div>
                  <div className="text-[10px] text-slate-400">No aplica · sin rol socio asignado</div>
                </div>
                <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded">N/A</span>
              </div>
            )}

            {/* Datos laborales */}
            {tieneRolPlanilla ? (
              <button
                type="button"
                onClick={() => goToDrill(`/usuarios/${user.uid}/editar/laborales`)}
                className="w-full bg-sky-50/50 border border-sky-200 hover:bg-sky-50 hover:border-sky-300 rounded-lg p-3 flex items-center gap-3 text-left transition-colors"
              >
                <BriefcaseBusiness className="w-5 h-5 text-sky-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-slate-900">Datos laborales</div>
                  <div className="text-[10px] text-sky-700 truncate">
                    {datosLab
                      ? `${datosLab.area || 'Sin área'} · ${datosLab.modalidad || 'sin modalidad'}`
                      : 'No configurado todavía · click para crear'}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${datosLab ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {datosLab ? 'CONFIGURADO' : 'PENDIENTE'}
                </span>
                <ChevronRight className="w-4 h-4 text-sky-600 flex-shrink-0" />
              </button>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-3 flex items-center gap-3">
                <BriefcaseBusiness className="w-5 h-5 text-slate-400" />
                <div className="flex-1">
                  <div className="text-[12px] font-bold text-slate-500">Datos laborales</div>
                  <div className="text-[10px] text-slate-400">No aplica · sin rol de planilla</div>
                </div>
                <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded">N/A</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </FormModalV2>
  );
}
