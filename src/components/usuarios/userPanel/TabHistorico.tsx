/**
 * TabHistorico.tsx · chk5.PERSONAS-v5.6 · E3.4 (2026-05-28)
 *
 * Tab "Histórico" del UserPanel · timeline cronológico de eventos del user
 * y sus relaciones laborales. Audit trail visual.
 *
 * Eventos mostrados (derivados de la data existente):
 *   - Creación inicial del usuario (UserProfile.fechaCreacion)
 *   - Invitación enviada (fechaInvitacion + invitadoPor)
 *   - Registro completado (fechaRegistro)
 *   - Aprobación (fechaAprobacion + aprobadoPor)
 *   - Suspensión / archivado (fechaSuspension / fechaArchivado)
 *   - Por cada RelacionLaboral:
 *     · Creación (fechaCreacion + creadoPor)
 *     · Modificaciones (fechaModificacion + modificadoPor · si existe)
 *     · Pausa (detectada por estado=pausada · pre-E5 sin fecha exacta)
 *     · Finalización (fechaFin + motivoFin + notaMotivoFin)
 *     · Reclasificación (motivoFin='reclasificacion' + relacionAnteriorId)
 *
 * Ordenados por fecha DESC · más reciente primero.
 * Cada evento tiene icon + color semántico + actor (uid) + descripción.
 */

import React, { useMemo } from 'react';
import {
  UserPlus,
  Mail,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  StopCircle,
  RefreshCw,
  XCircle,
  Archive,
  Briefcase as BriefcaseIcon,
} from 'lucide-react';
import type { UserProfile } from '../../../types/auth.types';
import type { RelacionLaboral } from '../../../types/relacionLaboral.types';
import {
  TIPO_RELACION_LABELS,
  MOTIVO_FIN_LABELS,
} from '../../../types/relacionLaboral.types';

interface TabHistoricoProps {
  user: UserProfile;
  relaciones: RelacionLaboral[];
}

interface EventoTimeline {
  id: string;
  fechaMs: number;
  icon: React.FC<{ className?: string }>;
  iconColor: string;
  bgColor: string;
  titulo: string;
  descripcion?: string;
  actor?: string;
}

function fmtFechaHora(ms: number): string {
  return new Date(ms).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtUidShort(uid: string | undefined): string {
  if (!uid) return 'sistema';
  if (uid === 'system-migration-v5.6') return 'migración v5.6';
  return uid.length > 12 ? `${uid.slice(0, 8)}…` : uid;
}

export const TabHistorico: React.FC<TabHistoricoProps> = ({ user, relaciones }) => {
  const eventos = useMemo<EventoTimeline[]>(() => {
    const list: EventoTimeline[] = [];

    // ── User · ciclo de vida ─────────────────────────────────────────────
    if (user.fechaCreacion) {
      list.push({
        id: `user-creado-${user.uid}`,
        fechaMs: user.fechaCreacion.toMillis(),
        icon: UserPlus,
        iconColor: 'text-emerald-700',
        bgColor: 'bg-emerald-50 ring-emerald-200',
        titulo: 'Usuario creado',
        descripcion:
          user.origen === 'invitacion_admin'
            ? 'Por invitación de admin'
            : user.origen === 'self_signup'
              ? 'Self-signup desde portal público'
              : 'Creación directa',
      });
    }

    if (user.fechaInvitacion) {
      list.push({
        id: `user-invitado-${user.uid}`,
        fechaMs: user.fechaInvitacion.toMillis(),
        icon: Mail,
        iconColor: 'text-sky-700',
        bgColor: 'bg-sky-50 ring-sky-200',
        titulo: 'Invitación enviada',
        descripcion: 'Email enviado · esperando que el user clickee el link',
        actor: user.invitadoPor ? fmtUidShort(user.invitadoPor) : undefined,
      });
    }

    if (user.fechaRegistro) {
      list.push({
        id: `user-registrado-${user.uid}`,
        fechaMs: user.fechaRegistro.toMillis(),
        icon: CheckCircle,
        iconColor: 'text-teal-700',
        bgColor: 'bg-teal-50 ring-teal-200',
        titulo: 'Registro completado',
        descripcion: 'El usuario configuró su contraseña / completó el formulario',
      });
    }

    if (user.fechaAprobacion) {
      list.push({
        id: `user-aprobado-${user.uid}`,
        fechaMs: user.fechaAprobacion.toMillis(),
        icon: CheckCircle,
        iconColor: 'text-emerald-700',
        bgColor: 'bg-emerald-50 ring-emerald-200',
        titulo: 'Cuenta aprobada',
        descripcion: 'El admin activó la cuenta para operar',
        actor: user.aprobadoPor ? fmtUidShort(user.aprobadoPor) : undefined,
      });
    }

    if (user.fechaSuspension) {
      list.push({
        id: `user-suspendido-${user.uid}`,
        fechaMs: user.fechaSuspension.toMillis(),
        icon: XCircle,
        iconColor: 'text-rose-700',
        bgColor: 'bg-rose-50 ring-rose-200',
        titulo: 'Cuenta suspendida',
        descripcion: user.motivoSuspension || 'Suspensión sin motivo registrado',
        actor: user.suspendidoPor ? fmtUidShort(user.suspendidoPor) : undefined,
      });
    }

    if (user.fechaArchivado) {
      list.push({
        id: `user-archivado-${user.uid}`,
        fechaMs: user.fechaArchivado.toMillis(),
        icon: Archive,
        iconColor: 'text-slate-700',
        bgColor: 'bg-slate-50 ring-slate-200',
        titulo: 'Cuenta archivada',
        descripcion: 'Soft delete · datos preservados 90d para auditoría',
        actor: user.archivadoPor ? fmtUidShort(user.archivadoPor) : undefined,
      });
    }

    // ── Eventos por relación ─────────────────────────────────────────────
    for (const r of relaciones) {
      const tipoLabel = TIPO_RELACION_LABELS[r.tipo];
      const cargoSuf = r.cargoDisplay ? ` · ${r.cargoDisplay}` : '';

      // Creación de relación
      if (r.fechaCreacion) {
        list.push({
          id: `rel-creada-${r.id}`,
          fechaMs: r.fechaCreacion.toMillis(),
          icon: BriefcaseIcon,
          iconColor: 'text-emerald-700',
          bgColor: 'bg-emerald-50 ring-emerald-200',
          titulo: `Relación ${tipoLabel} agregada${cargoSuf}`,
          descripcion: r.relacionAnteriorId
            ? 'Reclasificación desde relación anterior'
            : r.estado === 'prueba'
              ? 'Iniciada en período de prueba'
              : undefined,
          actor: fmtUidShort(r.creadoPor),
        });
      }

      // Modificación reciente
      if (r.fechaModificacion && r.modificadoPor) {
        list.push({
          id: `rel-modif-${r.id}-${r.fechaModificacion.toMillis()}`,
          fechaMs: r.fechaModificacion.toMillis(),
          icon: RefreshCw,
          iconColor: 'text-indigo-700',
          bgColor: 'bg-indigo-50 ring-indigo-200',
          titulo: `Cambios en relación ${tipoLabel}`,
          descripcion: r.estado === 'pausada'
            ? 'Pausada'
            : r.estado === 'vigente' && r.fechaFin
              ? 'Reanudada'
              : 'Datos actualizados',
          actor: fmtUidShort(r.modificadoPor),
        });
      }

      // Finalización
      if (r.estado === 'finalizada' && r.fechaFin) {
        const icon = r.motivoFin === 'reclasificacion' ? RefreshCw : StopCircle;
        const iconColor = r.motivoFin === 'reclasificacion' ? 'text-indigo-700' : 'text-rose-700';
        const bgColor = r.motivoFin === 'reclasificacion' ? 'bg-indigo-50 ring-indigo-200' : 'bg-rose-50 ring-rose-200';

        list.push({
          id: `rel-fin-${r.id}`,
          fechaMs: r.fechaFin.toMillis(),
          icon,
          iconColor,
          bgColor,
          titulo: r.motivoFin === 'reclasificacion'
            ? `Reclasificada · ${tipoLabel}`
            : `Relación ${tipoLabel} finalizada${cargoSuf}`,
          descripcion: r.motivoFin
            ? `${MOTIVO_FIN_LABELS[r.motivoFin]}${r.notaMotivoFin ? ` · "${r.notaMotivoFin}"` : ''}`
            : r.notaMotivoFin || undefined,
          actor: r.modificadoPor ? fmtUidShort(r.modificadoPor) : undefined,
        });
      }
    }

    // Ordenar por fecha DESC
    list.sort((a, b) => b.fechaMs - a.fechaMs);
    return list;
  }, [user, relaciones]);

  return (
    <div className="p-5">
      {eventos.length === 0 ? (
        <div className="bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-xl p-6 text-center">
          <BriefcaseIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <div className="text-sm font-bold text-slate-700">Sin eventos registrados</div>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Los eventos del usuario y sus relaciones aparecerán aquí cronológicamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3 relative">
          {/* Línea vertical timeline */}
          <div className="absolute left-[15px] top-0 bottom-0 w-px bg-slate-200" />

          {eventos.map((e, idx) => {
            const Icon = e.icon;
            return (
              <div key={e.id} className="flex items-start gap-3 relative">
                {/* Icon node */}
                <div
                  className={`w-8 h-8 rounded-full ${e.bgColor} ring-2 ring-white flex items-center justify-center flex-shrink-0 relative z-10`}
                >
                  <Icon className={`w-4 h-4 ${e.iconColor}`} />
                </div>

                {/* Event card */}
                <div className={`flex-1 min-w-0 ${e.bgColor} ring-1 rounded-lg p-3`}>
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-slate-900">{e.titulo}</span>
                    <span className="text-[10px] text-slate-500 tabular-nums flex-shrink-0 mt-0.5">
                      {fmtFechaHora(e.fechaMs)}
                    </span>
                  </div>
                  {e.descripcion && (
                    <div className="text-xs text-slate-700 mt-0.5">{e.descripcion}</div>
                  )}
                  {e.actor && (
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      por <strong>{e.actor}</strong>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer info */}
      <div className="mt-4 text-[10px] text-slate-500 text-center pt-3 border-t border-slate-100">
        Timeline derivado de los audit fields del usuario y relaciones laborales · inmutable.
      </div>
    </div>
  );
};

export default TabHistorico;
