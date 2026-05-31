/**
 * TabPermisos.tsx · chk5.PERSONAS-v5.7 · E3.4 (2026-05-28)
 *
 * Tab "Permisos" del UserPanel · muestra el rol, permisos efectivos y
 * configuración de seguridad del UserProfile.
 *
 * E3.4 entrega: VISTA estática (lectura). E4 agrega:
 *   - Cambiar rol (modal)
 *   - Suspender / reactivar (modal)
 *   - Reenviar invitación (acción)
 *   - Listado de sesiones activas (subscription a sessions/)
 *   - Botón "Forzar cierre de sesiones"
 *
 * Por ahora muestra:
 *   - Rol(es) actual(es) con labels y descripciones
 *   - Estado del usuario (activo · suspendido · etc) · color-coded
 *   - Permisos efectivos · contador + collapsible list
 *   - Permisos custom overrides (otorgados + revocados) · si los hay
 *   - Audit · invitadoPor · aprobadoPor · suspendidoPor (con uid)
 */

import React, { useState, useMemo } from 'react';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Mail,
  Calendar,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { UserProfile, UserRole } from '../../../types/auth.types';
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ESTADO_LABELS,
  ESTADO_COLORS,
  getUserEstado,
  getUserRoles,
  calcularPermisosEfectivos,
} from '../../../types/auth.types';

interface TabPermisosProps {
  user: UserProfile;
}

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; ring: string }> = {
  admin: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
  gerente: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-200' },
  vendedor: { bg: 'bg-sky-50', text: 'text-sky-700', ring: 'ring-sky-200' },
  comprador: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  almacenero: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  finanzas: { bg: 'bg-teal-50', text: 'text-teal-700', ring: 'ring-teal-200' },
  supervisor: { bg: 'bg-teal-50', text: 'text-teal-700', ring: 'ring-teal-200' },
  invitado: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200' },
  socio: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200' },
};

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

function fmtUid(uid: string | undefined): string {
  if (!uid) return '—';
  return uid.length > 12 ? `${uid.slice(0, 8)}…${uid.slice(-4)}` : uid;
}

export const TabPermisos: React.FC<TabPermisosProps> = ({ user }) => {
  const [showAllPermisos, setShowAllPermisos] = useState(false);

  const estado = getUserEstado(user);
  const colorsEstado = ESTADO_COLORS[estado];
  const roles = getUserRoles(user);
  const permisosEfectivos = useMemo(() => calcularPermisosEfectivos(user), [user]);

  return (
    <div className="p-5 space-y-4">
      {/* ═══ Estado del usuario ═══ */}
      <div className={`${colorsEstado.bg} ${colorsEstado.text} ring-1 ${colorsEstado.border} rounded-xl p-4`}>
        <div className="flex items-center gap-2 mb-1">
          {estado === 'activo' ? (
            <CheckCircle className="w-4 h-4" />
          ) : estado === 'suspendido' || estado === 'archivado' ? (
            <XCircle className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span className="text-[10px] uppercase tracking-wider font-bold">ESTADO DEL USUARIO</span>
        </div>
        <div className="text-base font-bold">{ESTADO_LABELS[estado]}</div>
        {estado === 'pendiente_aprobacion' && (
          <div className="text-xs mt-1 opacity-80">
            El usuario completó el formulario · esperando aprobación del admin para activarse.
          </div>
        )}
        {estado === 'invitado_no_registrado' && (
          <div className="text-xs mt-1 opacity-80">
            La invitación fue enviada · el usuario aún no clickeó el link del email.
          </div>
        )}
        {estado === 'suspendido' && user.motivoSuspension && (
          <div className="text-xs mt-1 opacity-80 italic">"{user.motivoSuspension}"</div>
        )}
      </div>

      {/* ═══ Rol(es) asignados ═══ */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <Shield className="w-3 h-3" /> Roles asignados ({roles.length})
        </div>
        {roles.length === 0 ? (
          <div className="bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-lg p-3 text-xs text-slate-500 italic text-center">
            Sin roles asignados · acceso muy limitado
          </div>
        ) : (
          <div className="space-y-2">
            {roles.map((r) => {
              const colors = ROLE_COLORS[r];
              return (
                <div key={r} className={`${colors.bg} ring-1 ${colors.ring} rounded-lg p-3`}>
                  <div className={`text-sm font-bold ${colors.text}`}>{ROLE_LABELS[r]}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{ROLE_DESCRIPTIONS[r]}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ Permisos custom · overrides ═══ */}
      {user.permisosCustom && (
        (user.permisosCustom.otorgados?.length || user.permisosCustom.revocados?.length) ? (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-600" /> Overrides custom
            </div>
            <div className="space-y-2">
              {user.permisosCustom.otorgados?.length > 0 && (
                <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 mb-1.5">
                    + Otorgados extra ({user.permisosCustom.otorgados.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {user.permisosCustom.otorgados.map((p) => (
                      <span
                        key={p}
                        className="text-[10px] bg-white text-emerald-700 ring-1 ring-emerald-200 px-1.5 py-0.5 rounded font-mono"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  {user.permisosCustom.motivoOtorgados && (
                    <div className="text-[11px] text-emerald-800 mt-1.5 italic">
                      "{user.permisosCustom.motivoOtorgados}"
                    </div>
                  )}
                </div>
              )}
              {user.permisosCustom.revocados?.length > 0 && (
                <div className="bg-rose-50 ring-1 ring-rose-200 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-rose-700 mb-1.5">
                    − Revocados ({user.permisosCustom.revocados.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {user.permisosCustom.revocados.map((p) => (
                      <span
                        key={p}
                        className="text-[10px] bg-white text-rose-700 ring-1 ring-rose-200 px-1.5 py-0.5 rounded font-mono line-through"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  {user.permisosCustom.motivoRevocados && (
                    <div className="text-[11px] text-rose-800 mt-1.5 italic">
                      "{user.permisosCustom.motivoRevocados}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null
      )}

      {/* ═══ Permisos efectivos (collapsible) ═══ */}
      <div>
        <button
          type="button"
          onClick={() => setShowAllPermisos((s) => !s)}
          className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2 hover:text-slate-900"
        >
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Permisos efectivos ({permisosEfectivos.length})
          </span>
          {showAllPermisos ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        {showAllPermisos && (
          <div className="bg-slate-50 ring-1 ring-slate-200 rounded-lg p-3">
            <div className="flex flex-wrap gap-1">
              {permisosEfectivos.map((p) => (
                <span
                  key={p}
                  className="text-[10px] bg-white text-slate-700 ring-1 ring-slate-200 px-1.5 py-0.5 rounded font-mono"
                >
                  {p}
                </span>
              ))}
            </div>
            {permisosEfectivos.length === 0 && (
              <div className="text-xs text-slate-500 italic text-center py-2">Sin permisos efectivos</div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Audit · quién hizo qué ═══ */}
      {(user.invitadoPor || user.aprobadoPor || user.suspendidoPor || user.archivadoPor) && (
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-2">Audit trail</div>
          <div className="bg-slate-50 ring-1 ring-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
            {user.invitadoPor && (
              <div className="flex items-center gap-2">
                <Mail className="w-3 h-3 text-slate-400" />
                <span className="text-slate-600">Invitado por:</span>
                <span className="text-slate-900 font-mono">{fmtUid(user.invitadoPor)}</span>
                {user.fechaInvitacion && (
                  <span className="text-slate-500 ml-auto">{fmtFechaHora(user.fechaInvitacion)}</span>
                )}
              </div>
            )}
            {user.aprobadoPor && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                <span className="text-slate-600">Aprobado por:</span>
                <span className="text-slate-900 font-mono">{fmtUid(user.aprobadoPor)}</span>
                {user.fechaAprobacion && (
                  <span className="text-slate-500 ml-auto">{fmtFechaHora(user.fechaAprobacion)}</span>
                )}
              </div>
            )}
            {user.suspendidoPor && (
              <div className="flex items-center gap-2">
                <XCircle className="w-3 h-3 text-rose-600" />
                <span className="text-slate-600">Suspendido por:</span>
                <span className="text-slate-900 font-mono">{fmtUid(user.suspendidoPor)}</span>
                {user.fechaSuspension && (
                  <span className="text-slate-500 ml-auto">{fmtFechaHora(user.fechaSuspension)}</span>
                )}
              </div>
            )}
            {user.archivadoPor && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span className="text-slate-600">Archivado por:</span>
                <span className="text-slate-900 font-mono">{fmtUid(user.archivadoPor)}</span>
                {user.fechaArchivado && (
                  <span className="text-slate-500 ml-auto">{fmtFechaHora(user.fechaArchivado)}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Hint · acciones en E4 ═══ */}
      <div className="bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-lg p-3 text-[11px] text-slate-600">
        <strong className="text-slate-700">Próximamente (E4):</strong> cambiar rol · suspender/reactivar ·
        reenviar invitación · forzar cierre de sesiones · listado de sesiones activas.
      </div>
    </div>
  );
};

export default TabPermisos;
