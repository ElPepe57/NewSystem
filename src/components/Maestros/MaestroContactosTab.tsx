/**
 * MaestroContactosTab.tsx · chk5.PERSONAS-v5.8 · E7 (2026-05-28)
 *
 * Sub-sección "Contactos" reusable para el detalle de un Maestro
 * (proveedor · cliente · marca). Muestra los Users externos vinculados
 * mediante RelacionLaboral.entidadMaestroRef · canon v5.8.
 *
 * Modo de uso:
 *   import { MaestroContactosTab } from '@/components/maestros/MaestroContactosTab';
 *
 *   <MaestroContactosTab
 *     maestroTipo="proveedor"
 *     maestroId="abc123"
 *     maestroNombre="Skin Labs SAC"
 *   />
 *
 * El componente:
 *   - Hace fetch con relacionesLaboralesService.getContactosByMaestro (E1)
 *   - Hace lookup en parallel de los UserProfile (display name · email · photo)
 *   - Renderiza cards con avatar gradient + info + acciones email/whatsapp/perfil
 *   - Click en "Ver perfil" → UserPanel del contacto
 *   - Empty state canon N9 con CTA explicativa
 *
 * Auto-refresh: NO se suscribe a cambios. Padre puede pasar refreshKey
 * incrementado para forzar re-fetch (ej. después de vincular nuevo contacto).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Mail,
  Phone,
  MessageCircle,
  ExternalLink,
  Loader2,
  UserPlus,
  AlertCircle,
} from 'lucide-react';
import { db } from '../../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '../../config/collections';
import { relacionesLaboralesService } from '../../services/relacionesLaborales.service';
import type { RelacionLaboral, TipoEntidadMaestro } from '../../types/relacionLaboral.types';
import type { UserProfile } from '../../types/auth.types';
import { UserPanel } from '../usuarios/UserPanel';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface MaestroContactosTabProps {
  maestroTipo: TipoEntidadMaestro;
  maestroId: string;
  /** Nombre del Maestro · para empty states + CTA */
  maestroNombre: string;
  /** Si se incrementa · fuerza re-fetch (ej. tras vincular nuevo contacto) */
  refreshKey?: number;
  /** Callback opcional al click "Agregar contacto" · padre puede abrir wizard */
  onAgregarContacto?: () => void;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function fmtFecha(ts: { toDate?: () => Date } | undefined | null): string {
  if (!ts || !ts.toDate) return '—';
  return ts.toDate().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function diasEntre(ts: { toMillis: () => number } | undefined): string {
  if (!ts) return '—';
  const ms = ts.toMillis();
  const dias = Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
  if (dias < 30) return `${dias}d`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `${meses}m`;
  const anios = Math.floor(meses / 12);
  return `${anios}a`;
}

function getIniciales(displayName: string | undefined): string {
  if (!displayName) return '?';
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ═════════════════════════════════════════════════════════════════════════
// TIPO interno · contacto enriquecido (relación + user)
// ═════════════════════════════════════════════════════════════════════════

interface ContactoEnriquecido {
  relacion: RelacionLaboral;
  user: UserProfile | null;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const MaestroContactosTab: React.FC<MaestroContactosTabProps> = ({
  maestroTipo,
  maestroId,
  maestroNombre,
  refreshKey,
  onAgregarContacto,
}) => {
  const [contactos, setContactos] = useState<ContactoEnriquecido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelUid, setPanelUid] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const relaciones = await relacionesLaboralesService.getContactosByMaestro(maestroTipo, maestroId);
      // Fetch parallel UserProfile de cada relación
      const enriched = await Promise.all(
        relaciones.map(async (rel): Promise<ContactoEnriquecido> => {
          try {
            const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, rel.userId));
            const user = userSnap.exists() ? ({ uid: userSnap.id, ...userSnap.data() } as UserProfile) : null;
            return { relacion: rel, user };
          } catch {
            return { relacion: rel, user: null };
          }
        }),
      );
      setContactos(enriched);
    } catch (err) {
      console.error('[MaestroContactosTab] error:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar contactos');
    } finally {
      setLoading(false);
    }
  }, [maestroTipo, maestroId]);

  useEffect(() => {
    if (!maestroId) return;
    void cargar();
  }, [maestroId, refreshKey, cargar]);

  // ═══ Loading ═══
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  // ═══ Error ═══
  if (error) {
    return (
      <div className="bg-rose-50 ring-1 ring-rose-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-bold text-rose-900">Error al cargar contactos</div>
          <div className="text-xs text-rose-700 mt-0.5">{error}</div>
          <button
            type="button"
            onClick={() => void cargar()}
            className="mt-2 text-xs font-semibold text-rose-700 hover:underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ═══ Empty state ═══
  if (contactos.length === 0) {
    return (
      <div className="bg-slate-50 ring-1 ring-dashed ring-slate-300 rounded-xl p-6 text-center">
        <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
        <div className="text-sm font-bold text-slate-700">Sin contactos vinculados aún</div>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          {maestroNombre
            ? `${maestroNombre} no tiene contactos humanos vinculados (sales rep · account manager · etc).`
            : 'Esta entidad no tiene contactos vinculados.'}{' '}
          Si hay personas que te atienden directamente · agregalas como contactos para tenerlas en el sistema.
        </p>
        {onAgregarContacto && (
          <button
            type="button"
            onClick={onAgregarContacto}
            className="mt-3 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Agregar primer contacto
          </button>
        )}
      </div>
    );
  }

  // ═══ Lista de contactos ═══
  return (
    <div className="space-y-3">
      {/* Header con count + CTA agregar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-purple-700" />
            Personas que trabajan en {maestroNombre}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {contactos.length} contacto{contactos.length !== 1 ? 's' : ''} vinculado{contactos.length !== 1 ? 's' : ''}
            {' '}como User externo
          </p>
        </div>
        {onAgregarContacto && (
          <button
            type="button"
            onClick={onAgregarContacto}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Agregar contacto
          </button>
        )}
      </div>

      {/* Grid de cards · 1 col mobile · 2 cols desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {contactos.map(({ relacion, user }) => {
          const displayName = user?.displayName ?? 'Usuario desconocido';
          const email = user?.email;
          const telefono = user?.telefono;
          const rolEnEntidad = relacion.entidadMaestroRef?.rolEnEntidad;
          const fechaVinc = relacion.entidadMaestroRef?.fechaVinculacion;
          const subTipo = relacion.subTipo;

          return (
            <div
              key={relacion.id}
              className="bg-white ring-1 ring-slate-200 rounded-2xl p-4 hover:ring-purple-300 hover:shadow-md transition cursor-pointer group"
              onClick={() => setPanelUid(relacion.userId)}
            >
              <div className="flex items-start gap-3 mb-3">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={displayName}
                    className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {getIniciales(user?.displayName)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 truncate">{displayName}</div>
                  {rolEnEntidad && (
                    <div className="text-xs text-slate-500 truncate">{rolEnEntidad}</div>
                  )}
                  {!rolEnEntidad && subTipo && (
                    <div className="text-xs text-slate-500 truncate capitalize">
                      {subTipo.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Datos de contacto · email + teléfono */}
              <div className="space-y-1 text-xs">
                {email && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{email}</span>
                  </div>
                )}
                {telefono && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="tabular-nums">{telefono}</span>
                  </div>
                )}
                {fechaVinc && (
                  <div className="flex items-center gap-2 text-slate-500 text-[10px] mt-1">
                    Vinculado desde {fmtFecha(fechaVinc)} · {diasEntre(fechaVinc)}
                  </div>
                )}
              </div>

              {/* Acciones inline · stopPropagation para no abrir UserPanel al click */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setPanelUid(relacion.userId)}
                  className="text-[11px] text-purple-700 hover:underline font-semibold flex items-center gap-1"
                >
                  Ver perfil completo
                  <ExternalLink className="w-3 h-3" />
                </button>
                <div className="flex items-center gap-1">
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                      title={`Email a ${email}`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {telefono && (
                    <a
                      href={`https://wa.me/${telefono.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 hover:bg-emerald-50 rounded text-emerald-600"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* UserPanel para ver perfil completo del contacto */}
      <UserPanel
        userId={panelUid}
        onClose={() => setPanelUid(null)}
      />
    </div>
  );
};

export default MaestroContactosTab;
