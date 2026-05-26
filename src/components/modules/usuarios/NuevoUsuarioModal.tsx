/**
 * src/components/modules/usuarios/NuevoUsuarioModal.tsx
 * chk5.F4-USERS (2026-05-26) · Canon ACTO 2.1 v2.
 *
 * Admin crea usuario completo · email + nombre + password inicial +
 * RolesMultiSelect + sub-perfiles drill (laborales · socio).
 * Al guardar · user queda 'activo' inmediatamente.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, ArrowRight, BriefcaseBusiness, Briefcase, Info } from 'lucide-react';
import { FormModalV2 } from '../../../design-system/components/FormModalV2';
import RolesMultiSelect from './RolesMultiSelect';
import { userService } from '../../../services/user.service';
import {
  evaluatePasswordStrength,
  strengthBarColor,
  strengthTextColor,
} from '../../../utils/passwordStrength';
import type { UserRole } from '../../../types/auth.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string, createdUid?: string) => void;
  onError?: (message: string) => void;
}

export default function NuevoUsuarioModal({ isOpen, onClose, onSuccess, onError }: Props) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forceChangePw, setForceChangePw] = useState(true);
  const [cargo, setCargo] = useState('');
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setDisplayName('');
      setTelefono('');
      setPassword('');
      setShowPassword(false);
      setForceChangePw(true);
      setCargo('');
      setRoles([]);
      setLocalError(null);
    }
  }, [isOpen]);

  const passwordStrength = evaluatePasswordStrength(password);
  const tieneRolPlanilla = roles.some((r) => ['vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor'].includes(r));
  const tieneRolSocio = roles.includes('socio');

  const isValid =
    email.trim() !== '' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    displayName.trim().length >= 3 &&
    password.length >= 6 &&
    roles.length > 0;

  const handleCreate = async (continuarADrill: boolean) => {
    setLocalError(null);
    if (!isValid) {
      setLocalError('Completá todos los campos requeridos');
      return;
    }
    setSaving(true);
    try {
      // Crear con primer rol (CF createUser solo soporta single role)
      const rolPrincipal = roles[0];
      const createdUser = await userService.createUser(
        email.trim().toLowerCase(),
        password,
        displayName.trim(),
        rolPrincipal,
      );

      // Si hay 2+ roles · agregar el array completo + cargo + telefono
      if (createdUser.uid) {
        const updates: Record<string, unknown> = {};
        if (roles.length > 1) updates.roles = roles;
        if (cargo.trim()) updates.cargo = cargo.trim();
        if (telefono.trim()) updates.telefono = telefono.trim();
        if (Object.keys(updates).length > 0) {
          await userService.updateProfile(createdUser.uid, updates);
        }
      }

      onSuccess?.(`Usuario "${displayName}" creado correctamente`, createdUser.uid);
      onClose();

      // Auto-continuación a drill page
      if (continuarADrill && createdUser.uid) {
        if (tieneRolSocio) {
          navigate(`/usuarios/${createdUser.uid}/editar/socio`);
        } else if (tieneRolPlanilla) {
          navigate(`/usuarios/${createdUser.uid}/editar/laborales`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear';
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  };

  const showDrillOption = tieneRolPlanilla || tieneRolSocio;

  return (
    <FormModalV2
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={() => handleCreate(showDrillOption)}
      title="Nuevo usuario"
      subtitle="Admin crea con todos los datos · queda activo inmediatamente"
      icon={UserPlus}
      iconTone="purple"
      size="lg"
      submitLabel={showDrillOption ? 'Crear y configurar sub-perfil' : 'Crear usuario'}
      submitVariant="primary"
      submitIcon={showDrillOption ? ArrowRight : UserPlus}
      loading={saving}
      disabled={!isValid}
      footerExtras={
        showDrillOption ? (
          <button
            type="button"
            onClick={() => handleCreate(false)}
            disabled={!isValid || saving}
            className="text-[11px] text-purple-700 hover:text-purple-900 font-bold underline disabled:opacity-50"
          >
            Crear · configurar sub-perfil después
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
              <label className="block text-[11px] text-slate-600 uppercase font-bold mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@empresa.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px] focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 uppercase font-bold mb-1">Nombre completo *</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nombre Apellido"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px]"
              />
            </div>
            <div className="relative">
              <label className="block text-[11px] text-slate-600 uppercase font-bold mb-1">Password inicial *</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px] pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-[31px] text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              {password.length > 0 && (
                <>
                  <div className="mt-1.5 flex gap-1">
                    {[1, 2, 3, 4].map((seg) => (
                      <div
                        key={seg}
                        className={`h-1 flex-1 rounded-full ${
                          seg <= passwordStrength.filled ? strengthBarColor(passwordStrength.color) : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${strengthTextColor(passwordStrength.color)}`}>
                    {passwordStrength.message}
                  </div>
                </>
              )}
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
            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-600 uppercase font-bold mb-1">Cargo / Puesto</label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Socio fundador · Gerente comercial · etc"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-[12px]"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 mt-3 text-[11px] text-slate-600">
            <input type="checkbox" checked={forceChangePw} onChange={(e) => setForceChangePw(e.target.checked)} />
            <span>Forzar cambio de password en primer login (UX nice-to-have · próxima versión)</span>
          </label>
        </section>

        {/* ─── ROLES ─── */}
        <section>
          <div className="text-[10px] uppercase tracking-wider text-slate-700 font-bold mb-2">
            Roles · multi-selección *
          </div>
          <RolesMultiSelect value={roles} onChange={setRoles} />
        </section>

        {/* ─── SUB-PERFILES DRILL ─── */}
        {showDrillOption && (
          <section>
            <div className="text-[10px] uppercase tracking-wider text-slate-700 font-bold mb-2">
              Sub-perfiles activos (completar después de crear)
            </div>
            <div className="space-y-2">
              {tieneRolPlanilla && (
                <div className="bg-sky-50/50 border border-sky-200 rounded-lg p-3 flex items-center gap-3 text-[12px]">
                  <BriefcaseBusiness className="w-5 h-5 text-sky-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">Datos laborales</div>
                    <div className="text-[10px] text-slate-500">fecha ingreso · contrato · modalidad · vacaciones</div>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">PENDIENTE</span>
                </div>
              )}
              {tieneRolSocio && (
                <div className="bg-violet-50/50 border border-violet-200 rounded-lg p-3 flex items-center gap-3 text-[12px]">
                  <Briefcase className="w-5 h-5 text-violet-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">Datos de socio (D7)</div>
                    <div className="text-[10px] text-slate-500">tipo participación · % · aportes de valor · vesting</div>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">PENDIENTE</span>
                </div>
              )}
            </div>
            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[10px] text-emerald-900 flex items-start gap-2">
              <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>"Crear y configurar sub-perfil" te lleva al drill después de crear el usuario.</span>
            </div>
          </section>
        )}

        {localError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-lg text-[11px]">
            {localError}
          </div>
        )}
      </div>
    </FormModalV2>
  );
}
