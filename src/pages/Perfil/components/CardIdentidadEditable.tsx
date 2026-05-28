/**
 * CardIdentidadEditable · F10.F.1.J-SIDEBAR.3 · 2026-05-27
 *
 * Card del Tab Mi Información con datos personales editables inline.
 * Pixel-perfect canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 5 (líneas 595-648).
 *
 * Estructura canon:
 *   - Header: h3 "Datos de identidad" + chip "VERIFICADO" emerald
 *   - Grid 1/2 cols con ítems editables inline (pattern Notion)
 *
 * Items:
 *   - Nombre completo · editable
 *   - Email · readonly + verified check
 *   - DNI · editable (próximo: campo en UserProfile)
 *   - Teléfono · editable
 *   - Cargo · editable
 *   - Activo desde · readonly (derivado de fechaCreacion)
 *   - Último acceso · readonly (derivado de ultimaConexion)
 */
import React from 'react';
import { User } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { userService } from '../../../services/user.service';
import { usePermissions } from '../../../hooks/usePermissions';
import { InlineEditField } from './InlineEditField';

const MES_LARGO = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const formatFechaLarga = (d?: Date | null): string => {
  if (!d) return '—';
  return `${d.getDate()} ${MES_LARGO[d.getMonth() + 1]} ${d.getFullYear()}`;
};

const formatFechaRelativa = (d?: Date | null): string => {
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const minutos = Math.floor(diff / 60000);
  if (minutos < 1) return 'hace segundos';
  if (minutos < 60) return `hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} hora${horas > 1 ? 's' : ''}`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `hace ${dias} día${dias > 1 ? 's' : ''}`;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const validateTelefono = (v: string): string | null => {
  if (!v) return null; // permitir vaciar
  if (v.length < 6) return 'Mínimo 6 caracteres';
  if (!/^[+()0-9\s-]+$/.test(v)) return 'Solo números, espacios, +, (), -';
  return null;
};

const validateDNI = (v: string): string | null => {
  if (!v) return null;
  if (!/^\d{6,12}$/.test(v)) return 'DNI: 6-12 dígitos numéricos';
  return null;
};

export const CardIdentidadEditable: React.FC = () => {
  const { profile, displayName } = usePermissions();
  const fetchUserProfile = useAuthStore((state) => state.fetchUserProfile);

  if (!profile) return null;

  const fechaCreacion = profile.fechaCreacion?.toDate?.();
  const ultimaConexion = profile.ultimaConexion?.toDate?.();
  const emailVerificado = profile.emailVerificado ?? false;

  // Guardar cualquier campo del perfil
  const saveField = async (field: 'displayName' | 'telefono' | 'cargo', value: string) => {
    await userService.updateProfile(profile.uid, { [field]: value });
    await fetchUserProfile(profile.uid);
  };

  // DNI · NO existe campo en UserProfile actual · feature flag
  // TODO: agregar `dni?: string` a UserProfile en futura sub-fase
  const dniSupported = false;

  return (
    // Canon mockup ACTO 5 · línea 596 · copy-paste literal
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
          <User className="w-4 h-4 text-purple-700" />
          Datos de identidad
        </h3>
        {emailVerificado && (
          <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded uppercase">
            VERIFICADO
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
        <InlineEditField
          label="Nombre completo"
          value={displayName}
          onSave={(v) => saveField('displayName', v)}
          placeholder="Sin nombre · click para agregar"
        />
        <InlineEditField
          label="Email"
          value={profile.email}
          readOnly
          verified={emailVerificado}
        />
        {dniSupported && (
          <InlineEditField
            label="DNI"
            value={(profile as any).dni}
            onSave={(v) => userService.updateProfile(profile.uid, { ...(({} as any)), dni: v } as any)}
            placeholder="Sin DNI · click para agregar"
            tabular
            inputType="tel"
            validate={validateDNI}
            maxLength={12}
          />
        )}
        <InlineEditField
          label="Teléfono"
          value={profile.telefono}
          onSave={(v) => saveField('telefono', v)}
          placeholder="Sin teléfono · click para agregar"
          tabular
          inputType="tel"
          validate={validateTelefono}
          maxLength={20}
        />
        <InlineEditField
          label="Cargo"
          value={profile.cargo}
          onSave={(v) => saveField('cargo', v)}
          placeholder="Sin cargo · click para agregar"
          maxLength={60}
        />
        <InlineEditField
          label="Activo desde"
          value={formatFechaLarga(fechaCreacion)}
          readOnly
        />
        <InlineEditField
          label="Último acceso"
          value={formatFechaRelativa(ultimaConexion)}
          readOnly
        />
      </div>
    </div>
  );
};

export default CardIdentidadEditable;
