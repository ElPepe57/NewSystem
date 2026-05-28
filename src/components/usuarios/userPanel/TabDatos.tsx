/**
 * TabDatos.tsx · chk5.PERSONAS-v5.7 · E3.4 (2026-05-28)
 *
 * Tab "Datos personales" del UserPanel · vista de datos del UserProfile.
 *
 * E3.4 entrega: VISTA estática (lectura) con todos los campos del UserProfile.
 *   - Identidad: nombre · email · teléfono · cargo · foto
 *   - Audit fields: origen · invitadoPor · fechas de creación · registro · aprobación
 *   - Tracking: IP/UA del registro (si self-signup)
 *
 * El inline-edit Notion-style se difiere a E4 (cuando exista el shell /usuarios
 * que invoca este panel) · acá los campos son read-only con tooltip explicativo.
 *
 * NOTA · esta vista está pensada para que el ADMIN vea los datos del User.
 * El user dueño edita sus propios datos en /perfil (módulo separado · no acá).
 */

import React from 'react';
import { Mail, Phone, Briefcase as BriefcaseIcon, Calendar, MapPin, User as UserIcon, Globe } from 'lucide-react';
import type { UserProfile } from '../../../types/auth.types';

interface TabDatosProps {
  user: UserProfile;
}

function fmtFecha(ts: { toDate?: () => Date } | undefined | null): string {
  if (!ts || !ts.toDate) return '—';
  return ts.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtFechaHora(ts: { toDate?: () => Date } | undefined | null): string {
  if (!ts || !ts.toDate) return '—';
  return ts.toDate().toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface CampoProps {
  label: string;
  value: React.ReactNode;
  icon?: React.FC<{ className?: string }>;
  empty?: boolean;
}

const Campo: React.FC<CampoProps> = ({ label, value, icon: Icon, empty }) => (
  <div className="bg-white ring-1 ring-slate-200 rounded-lg p-3">
    <div className="flex items-center gap-1.5 mb-1">
      {Icon && <Icon className="w-3 h-3 text-slate-400" />}
      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{label}</span>
    </div>
    <div className={`text-sm ${empty ? 'text-slate-400 italic' : 'text-slate-900 font-medium'} break-words`}>
      {empty ? '— sin completar —' : value}
    </div>
  </div>
);

export const TabDatos: React.FC<TabDatosProps> = ({ user }) => {
  return (
    <div className="p-5 space-y-4">
      {/* ═══ Identidad ═══ */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2">Identidad</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Campo label="Nombre completo" value={user.displayName} icon={UserIcon} empty={!user.displayName} />
          <Campo label="Email" value={user.email} icon={Mail} empty={!user.email} />
          <Campo label="Teléfono" value={user.telefono} icon={Phone} empty={!user.telefono} />
          <Campo label="Cargo (perfil)" value={user.cargo} icon={BriefcaseIcon} empty={!user.cargo} />
        </div>
      </div>

      {/* ═══ Audit · ciclo de vida ═══ */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2">Ciclo de vida</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Campo
            label="Origen"
            value={
              user.origen === 'invitacion_admin'
                ? 'Invitación de admin'
                : user.origen === 'self_signup'
                  ? 'Self-signup público'
                  : user.origen === 'creacion_directa'
                    ? 'Creación directa por admin'
                    : 'Legacy · sin origen'
            }
            empty={!user.origen}
          />
          <Campo label="Fecha de creación" value={fmtFecha(user.fechaCreacion)} icon={Calendar} />
          {user.fechaInvitacion && (
            <Campo label="Invitado el" value={fmtFechaHora(user.fechaInvitacion)} icon={Calendar} />
          )}
          {user.fechaRegistro && (
            <Campo label="Completó registro" value={fmtFechaHora(user.fechaRegistro)} icon={Calendar} />
          )}
          {user.fechaAprobacion && (
            <Campo label="Aprobado el" value={fmtFechaHora(user.fechaAprobacion)} icon={Calendar} />
          )}
          {user.ultimaConexion && (
            <Campo label="Última conexión" value={fmtFechaHora(user.ultimaConexion)} icon={Calendar} />
          )}
        </div>
      </div>

      {/* ═══ Suspensión · solo si aplica ═══ */}
      {(user.fechaSuspension || user.motivoSuspension) && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-rose-700 mb-2">
            Suspensión activa
          </div>
          <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3 space-y-1.5">
            {user.fechaSuspension && (
              <div className="text-xs text-rose-900">
                <span className="opacity-70">Desde:</span>{' '}
                <strong>{fmtFechaHora(user.fechaSuspension)}</strong>
              </div>
            )}
            {user.motivoSuspension && (
              <div className="text-xs text-rose-900 italic">"{user.motivoSuspension}"</div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Tracking · self-signup ═══ */}
      {user.origen === 'self_signup' && (user.ipRegistro || user.userAgentRegistro) && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2">
            Tracking del registro
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {user.ipRegistro && (
              <Campo label="IP de registro" value={user.ipRegistro} icon={Globe} />
            )}
            {user.emailVerificado !== undefined && (
              <Campo
                label="Email verificado"
                value={user.emailVerificado ? '✓ Sí' : '✗ No verificado'}
                icon={Mail}
              />
            )}
          </div>
          {user.userAgentRegistro && (
            <div className="bg-slate-50 ring-1 ring-slate-200 rounded-lg p-3 mt-2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
                User-Agent
              </div>
              <div className="text-[11px] text-slate-600 font-mono break-all">
                {user.userAgentRegistro}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ Hint · edit en E4 ═══ */}
      <div className="bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-lg p-3 text-[11px] text-slate-600 flex items-start gap-2">
        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
        <span>
          <strong className="text-slate-700">Edición inline-style Notion:</strong> click en campo para editar
          (próximamente · E4). Por ahora la edición se hace desde el shell /usuarios.
        </span>
      </div>
    </div>
  );
};

export default TabDatos;
