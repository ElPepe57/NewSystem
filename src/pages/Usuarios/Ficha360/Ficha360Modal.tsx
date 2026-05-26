/**
 * src/pages/Usuarios/Ficha360/Ficha360Modal.tsx
 * chk5.F4-USERS (2026-05-25) · Ficha 360 como MODAL FLOTANTE.
 *
 * Canon decisión D8 (mockup integral v2 · ACTO 4 actualizado):
 * Ficha 360 deja de ser página drill (/usuarios/:uid/ficha) y se convierte
 * en modal canon F6.A flotante max-w-4xl con 5 tabs internos.
 *
 * Razón: consistencia con el resto del módulo (todos modales flotantes) ·
 * no perder contexto del listado · coherente con EnvioDetailModal canon ref #4.
 *
 * Reusa la lógica de carga de Ficha360.tsx (services userService +
 * datosLaboralesService + datosSocioService).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Shield, Briefcase, BriefcaseBusiness, Activity, ShieldCheck,
  Pencil, LogOut, AlertCircle, Loader, LayoutDashboard, ArrowRight,
  Monitor, Smartphone,
} from 'lucide-react';
import { userService } from '../../../services/user.service';
import { datosLaboralesService } from '../../../services/datosLaborales.service';
import { datosSocioService } from '../../../services/datosSocio.service';
import { sesionService } from '../../../services/sesion.service';
import {
  type UserProfile, type UserRole,
  ROLE_LABELS, PERMISOS, getUserRoles, getRolPrincipal,
  hasRole, getUserEstado, calcularPermisosEfectivos,
  ESTADO_LABELS, ESTADO_COLORS,
} from '../../../types/auth.types';
import type { DatosLaborales } from '../../../types/datosLaborales.types';
import type { DatosSocio } from '../../../types/datosSocio.types';
import type { SesionActiva } from '../../../types/sesion.types';
import { TIPO_PARTICIPACION_LABEL, TIPO_VALOR_LABEL } from '../../../types/datosSocio.types';
import { formatCurrencyPEN } from '../../../utils/format';

type TabFicha = 'resumen' | 'sub-perfiles' | 'sesiones' | 'auditoria' | 'accesos';

const ROLE_AVATAR_GRADIENT: Record<UserRole, string> = {
  admin: 'from-purple-500 to-purple-700',
  gerente: 'from-indigo-500 to-indigo-700',
  vendedor: 'from-sky-400 to-sky-600',
  comprador: 'from-amber-400 to-amber-600',
  almacenero: 'from-orange-400 to-orange-600',
  finanzas: 'from-teal-400 to-teal-600',
  supervisor: 'from-slate-400 to-slate-600',
  invitado: 'from-slate-300 to-slate-500',
  socio: 'from-violet-500 to-violet-700',
};

const ROLE_CHIP: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  gerente: 'bg-indigo-100 text-indigo-700',
  vendedor: 'bg-sky-100 text-sky-700',
  comprador: 'bg-amber-100 text-amber-700',
  almacenero: 'bg-orange-100 text-orange-700',
  finanzas: 'bg-teal-100 text-teal-700',
  supervisor: 'bg-slate-100 text-slate-700',
  invitado: 'bg-slate-100 text-slate-600',
  socio: 'bg-violet-100 text-violet-700',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  uid: string | null;
  /** Callback opcional · cuando user click "Editar" en footer */
  onRequestEdit?: (profile: UserProfile) => void;
  /** Callback opcional · cuando user click "Desconectar todas" */
  onRequestDisconnectAll?: (profile: UserProfile) => void;
}

export default function Ficha360Modal({ isOpen, onClose, uid, onRequestEdit, onRequestDisconnectAll }: Props) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [datosLab, setDatosLab] = useState<DatosLaborales | null>(null);
  const [datosSoc, setDatosSoc] = useState<DatosSocio | null>(null);
  const [sesiones, setSesiones] = useState<SesionActiva[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabFicha>('resumen');

  useEffect(() => {
    if (!isOpen || !uid) {
      setProfile(null);
      setDatosLab(null);
      setDatosSoc(null);
      setSesiones([]);
      setTab('resumen');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [user, datosL, datosS, sess] = await Promise.all([
          userService.getByUid(uid),
          datosLaboralesService.get(uid).catch(() => null),
          datosSocioService.get(uid).catch(() => null),
          sesionService.listActivasByUid(uid).catch(() => [] as SesionActiva[]),
        ]);
        if (cancelled) return;
        if (!user) {
          setError('Usuario no encontrado');
          return;
        }
        setProfile(user);
        setDatosLab(datosL);
        setDatosSoc(datosS);
        setSesiones(sess);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar ficha');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, uid]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/30">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal container */}
      <div className="relative bg-white rounded-2xl ring-1 ring-slate-200 w-full max-w-4xl flex flex-col overflow-hidden shadow-2xl" style={{ maxHeight: '88vh' }}>
        {loading || !profile ? (
          <div className="p-16 text-center">
            {error ? (
              <>
                <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                <p className="text-[14px] font-bold text-slate-900">{error}</p>
                <button onClick={onClose} className="mt-4 text-[12px] text-slate-600 underline">Cerrar</button>
              </>
            ) : (
              <Loader className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
            )}
          </div>
        ) : (
          <>
            {/* ─── HEADER STICKY · avatar + nombre + estado + acciones ─── */}
            {(() => {
              const rolPrincipal = getRolPrincipal(profile) || 'invitado';
              const estado = getUserEstado(profile);
              const colors = ESTADO_COLORS[estado];
              const roles = getUserRoles(profile);
              const isMulti = roles.length > 1;
              return (
                <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-start gap-4 flex-shrink-0">
                  <div className={`w-14 h-14 bg-gradient-to-br ${ROLE_AVATAR_GRADIENT[rolPrincipal]} rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0`}>
                    {profile.displayName?.substring(0, 2).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h1 className="text-[18px] font-bold text-slate-900 truncate">{profile.displayName}</h1>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                        {ESTADO_LABELS[estado].toUpperCase()}
                      </span>
                      {isMulti && (
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded">
                          MULTI-ROL
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {profile.email}
                      {profile.cargo ? ` · ${profile.cargo}` : ''}
                    </p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {roles.map((r) => (
                        <span key={r} className={`text-[10px] font-medium px-2 py-0.5 rounded ${ROLE_CHIP[r]}`}>
                          {ROLE_LABELS[r]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {onRequestEdit && (
                      <button
                        onClick={() => onRequestEdit(profile)}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-[12px] font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                    )}
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ─── TABS INTERNOS STICKY ─── */}
            <div className="border-b border-slate-200 px-3 sm:px-6 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
              <div className="flex gap-1 whitespace-nowrap">
                {([
                  { id: 'resumen' as TabFicha, label: 'Resumen', Icon: LayoutDashboard, badge: null },
                  { id: 'sub-perfiles' as TabFicha, label: 'Sub-perfiles', Icon: Briefcase, badge: null },
                  { id: 'sesiones' as TabFicha, label: 'Sesiones', Icon: Monitor, badge: sesiones.length || null },
                  { id: 'auditoria' as TabFicha, label: 'Auditoría', Icon: Activity, badge: null },
                  { id: 'accesos' as TabFicha, label: 'Accesos', Icon: ShieldCheck, badge: null },
                ]).map(({ id, label, Icon, badge }) => {
                  const isActive = tab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={`px-3 sm:px-4 py-2.5 text-[12px] font-${isActive ? 'bold' : 'medium'} border-b-2 transition-colors flex items-center gap-1.5 ${
                        isActive ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-600 hover:text-purple-600'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                      {badge !== null && (
                        <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px]">{badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── BODY SCROLLABLE ─── */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
              {tab === 'resumen' && <TabResumen profile={profile} datosLab={datosLab} datosSoc={datosSoc} />}
              {tab === 'sub-perfiles' && <TabSubPerfiles profile={profile} datosLab={datosLab} datosSoc={datosSoc} navigate={navigate} onClose={onClose} />}
              {tab === 'sesiones' && <TabSesiones sesiones={sesiones} onClose={onClose} />}
              {tab === 'auditoria' && <TabAuditoria navigate={navigate} onClose={onClose} />}
              {tab === 'accesos' && <TabAccesos profile={profile} />}
            </div>

            {/* ─── FOOTER STICKY ─── */}
            <div className="px-5 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              {onRequestDisconnectAll ? (
                <button
                  onClick={() => onRequestDisconnectAll(profile)}
                  className="text-[11px] text-rose-600 font-bold flex items-center gap-1 hover:text-rose-800"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Desconectar todas las sesiones
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="text-[12px] text-slate-600 font-medium px-3 py-1.5">
                  Cerrar
                </button>
                {onRequestEdit && (
                  <button
                    onClick={() => onRequestEdit(profile)}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar usuario
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES POR TAB
// ═══════════════════════════════════════════════════════════════════════

function TabResumen({ profile, datosLab, datosSoc }: { profile: UserProfile; datosLab: DatosLaborales | null; datosSoc: DatosSocio | null }) {
  const permisos = calcularPermisosEfectivos(profile);
  const totalPermisos = Object.keys(PERMISOS).length;
  const isAdmin = hasRole(profile, 'admin');
  const permisosShow = isAdmin ? totalPermisos : permisos.length;

  return (
    <div className="space-y-5">
      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-purple-50/40 ring-1 ring-purple-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-purple-600" />
            <span className="text-[11px] uppercase font-bold text-purple-700">PERMISOS</span>
          </div>
          <div className="text-2xl font-bold text-purple-900 tabular-nums">{permisosShow} / {totalPermisos}</div>
          <div className="text-[11px] text-purple-700 mt-1">{isAdmin ? 'Admin · todos' : 'permisos efectivos'}</div>
        </div>
        <div className="bg-violet-50/40 ring-1 ring-violet-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-4 h-4 text-violet-600" />
            <span className="text-[11px] uppercase font-bold text-violet-700">SOCIO</span>
          </div>
          {datosSoc ? (
            <>
              <div className="text-2xl font-bold text-violet-900 tabular-nums">{datosSoc.porcentajeParticipacion}%</div>
              <div className="text-[11px] text-violet-700 mt-1">{TIPO_PARTICIPACION_LABEL[datosSoc.tipoParticipacion]}</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-slate-400 tabular-nums">N/A</div>
              <div className="text-[11px] text-slate-500 mt-1">Sin sub-perfil de socio</div>
            </>
          )}
        </div>
        <div className="bg-sky-50/40 ring-1 ring-sky-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BriefcaseBusiness className="w-4 h-4 text-sky-600" />
            <span className="text-[11px] uppercase font-bold text-sky-700">PLANILLA</span>
          </div>
          {datosLab ? (
            <>
              <div className="text-2xl font-bold text-sky-900 tabular-nums">{datosLab.modalidad || '—'}</div>
              <div className="text-[11px] text-sky-700 mt-1">{datosLab.area || 'sin área'}</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-slate-400 tabular-nums">N/A</div>
              <div className="text-[11px] text-slate-500 mt-1">Sin sub-perfil laboral</div>
            </>
          )}
        </div>
        <div className="bg-emerald-50/40 ring-1 ring-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span className="text-[11px] uppercase font-bold text-emerald-700">ACTIVIDAD 7D</span>
          </div>
          <div className="text-2xl font-bold text-emerald-900 tabular-nums">—</div>
          <div className="text-[11px] text-emerald-700 mt-1">ver tab Auditoría</div>
        </div>
      </div>

      {/* Datos básicos */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-700 font-bold mb-3">Datos básicos</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          <div className="flex justify-between"><span className="text-slate-600">Email</span><span className="font-medium text-slate-900 truncate">{profile.email}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Teléfono</span><span className="font-medium text-slate-900">{profile.telefono || '—'}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Cargo</span><span className="font-medium text-slate-900">{profile.cargo || '—'}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Estado</span><span className="font-bold text-emerald-700">{getUserEstado(profile)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Origen</span><span className="font-medium text-slate-900">{profile.origen || 'creación directa'}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Fecha alta</span><span className="font-medium text-slate-900">
            {profile.fechaCreacion?.toDate?.()?.toLocaleDateString('es-PE') || '—'}
          </span></div>
        </div>
      </div>
    </div>
  );
}

function TabSubPerfiles({ profile, datosLab, datosSoc, navigate, onClose }: { profile: UserProfile; datosLab: DatosLaborales | null; datosSoc: DatosSocio | null; navigate: (path: string) => void; onClose: () => void }) {
  return (
    <div className="space-y-4">
      {/* Datos socio · si existe o si tiene rol socio */}
      {(datosSoc || hasRole(profile, 'socio')) && (
        <div className="bg-violet-50/40 border border-violet-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-violet-600" />
              <h3 className="text-[13px] font-bold text-slate-900">Datos de socio (D7)</h3>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${datosSoc ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {datosSoc ? 'CONFIGURADO' : 'PENDIENTE'}
            </span>
          </div>
          {datosSoc ? (
            <div className="space-y-1.5 text-[12px]">
              <div className="flex justify-between"><span className="text-slate-600">Tipo</span><span className="font-bold text-violet-900">{TIPO_PARTICIPACION_LABEL[datosSoc.tipoParticipacion]}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">% participación</span><span className="font-bold text-violet-900 tabular-nums">{datosSoc.porcentajeParticipacion}%</span></div>
              {datosSoc.aporteDeValor && (
                <div className="pt-2 border-t border-violet-100">
                  <span className="text-[10px] text-violet-700">Tipos de valor:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {datosSoc.aporteDeValor.tiposDeValor.map((t) => (
                      <span key={t} className="bg-violet-100 text-violet-700 text-[9px] px-1.5 py-0.5 rounded">{TIPO_VALOR_LABEL[t]}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-amber-800">El usuario tiene rol "socio" pero aún no tiene datos de socio configurados.</p>
          )}
          <button
            onClick={() => { onClose(); navigate(`/usuarios/${profile.uid}/editar/socio`); }}
            className="mt-3 w-full bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5"
          >
            <Pencil className="w-3 h-3" />
            {datosSoc ? 'Editar datos de socio' : 'Configurar datos de socio'}
          </button>
        </div>
      )}

      {/* Datos laborales */}
      {datosLab ? (
        <div className="bg-sky-50/40 border border-sky-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="w-4 h-4 text-sky-600" />
              <h3 className="text-[13px] font-bold text-slate-900">Datos laborales</h3>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded">CONFIGURADO</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <div className="flex justify-between"><span className="text-slate-600">Área</span><span className="font-bold text-sky-900">{datosLab.area || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Contrato</span><span className="font-bold text-sky-900">{datosLab.tipoContrato || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Modalidad</span><span className="font-bold text-sky-900">{datosLab.modalidad || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Sueldo</span><span className="font-bold text-sky-900 tabular-nums">{formatCurrencyPEN(datosLab.salarioBase || 0)}</span></div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center">
          <BriefcaseBusiness className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-[12px] font-bold text-slate-500">Sin datos laborales</p>
          <p className="text-[10px] text-slate-400 mt-1">El usuario no tiene sub-perfil de planilla configurado</p>
        </div>
      )}
    </div>
  );
}

function TabSesiones({ sesiones, onClose }: { sesiones: SesionActiva[]; onClose: () => void }) {
  if (sesiones.length === 0) {
    return (
      <div className="text-center py-8">
        <Monitor className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-[13px] font-bold text-slate-900">Sin sesiones activas</p>
        <p className="text-[11px] text-slate-500 mt-1">El usuario no está conectado ahora mismo</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 mb-3">
        {sesiones.length} {sesiones.length === 1 ? 'sesión activa' : 'sesiones activas'}
      </div>
      {sesiones.map((s) => (
        <div
          key={s.id}
          className={`border rounded-lg p-3 text-[11px] ${
            s.esActual ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {s.os.includes('iOS') || s.os.includes('Android') ? (
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Monitor className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="font-bold text-slate-900">{s.device}</span>
            {s.esActual && <span className="ml-auto text-[9px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded">ACTUAL</span>}
          </div>
          <div className="text-[10px] text-slate-500">
            {s.ip && `IP ${s.ip} · `}
            {s.pais && `${s.pais} · `}
            última actividad {s.lastActive?.toDate?.()?.toLocaleString('es-PE') || '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

function TabAuditoria({ navigate, onClose }: { navigate: (path: string) => void; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="text-center py-6">
        <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-[13px] font-bold text-slate-900 mb-1">Auditoría completa en módulo dedicado</p>
        <p className="text-[11px] text-slate-500 mb-4">
          Timeline detallada · logs de cambios · filtros · exports CSV
        </p>
        <button
          onClick={() => { onClose(); navigate('/auditoria'); }}
          className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-[12px] font-bold px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
        >
          <ShieldCheck className="w-4 h-4" />
          Abrir módulo Auditoría
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function TabAccesos({ profile }: { profile: UserProfile }) {
  const roles = getUserRoles(profile);
  const permisos = calcularPermisosEfectivos(profile);
  const totalPermisos = Object.keys(PERMISOS).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] uppercase font-bold text-purple-700 mb-2">Por rol · {permisos.length} permisos</div>
          <div className="space-y-1 text-[11px]">
            {roles.length === 0 ? (
              <div className="text-[11px] text-slate-500 p-3 bg-slate-50 rounded">Sin roles asignados</div>
            ) : (
              roles.map((r) => (
                <div key={r} className={`flex items-center justify-between p-2 rounded ${ROLE_CHIP[r]}`}>
                  <span>{ROLE_LABELS[r]}</span>
                  <span className="text-[10px] font-bold">{r === 'admin' ? `${totalPermisos} perm.` : 'rol activo'}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-emerald-700 mb-2">Overrides otorgados</div>
          {profile.permisosCustom?.otorgados && profile.permisosCustom.otorgados.length > 0 ? (
            <div className="space-y-1 text-[11px]">
              {profile.permisosCustom.otorgados.map((p) => (
                <div key={p} className="p-2 bg-emerald-50 text-emerald-900 rounded">{p}</div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 p-3 bg-slate-50 rounded">Ninguno</div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-rose-700 mb-2">Overrides revocados</div>
          {profile.permisosCustom?.revocados && profile.permisosCustom.revocados.length > 0 ? (
            <div className="space-y-1 text-[11px]">
              {profile.permisosCustom.revocados.map((p) => (
                <div key={p} className="p-2 bg-rose-50 text-rose-900 rounded">{p}</div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 p-3 bg-slate-50 rounded">Ninguno</div>
          )}
        </div>
      </div>
      <div className="text-[10px] text-slate-600 pt-3 border-t border-slate-100">
        Configurable desde tab Configuración → Permisos custom (overrides)
      </div>
    </div>
  );
}
