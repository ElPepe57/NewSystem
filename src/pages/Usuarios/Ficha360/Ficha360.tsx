/**
 * Ficha 360 · chk5.F2-SUB-PERFILES (2026-05-24)
 *
 * Página propia · ruta `/usuarios/:uid/ficha`
 *
 * Vista completa de TODO lo que una persona ES en el sistema:
 *  - Datos básicos (foto · nombre · email · DNI · teléfono)
 *  - Chips multi-rol
 *  - 4 cards de resumen: Permisos · Datos laborales · Datos socio · Actividad
 *  - Resumen de actividad últimos 30 días
 *
 * Pixel-perfect contra mockup `modelo-personas-v5.2.html` ESTADO A3.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight, ArrowLeft, Edit2, Lock, Key, Briefcase, Landmark,
  Activity, Shield, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { userService } from '../../../services/user.service';
import { datosLaboralesService } from '../../../services/datosLaborales.service';
import { datosSocioService } from '../../../services/datosSocio.service';
import {
  type UserProfile,
  type UserRole,
  ROLE_LABELS,
  PERMISOS,
  getUserRoles,
  hasRole,
  hasAnyRole,
} from '../../../types/auth.types';
import type { DatosLaborales } from '../../../types/datosLaborales.types';
import type { DatosSocio } from '../../../types/datosSocio.types';
import { formatCurrencyPEN } from '../../../utils/format';
import {
  TIPO_PARTICIPACION_LABEL,
  TIPO_VALOR_LABEL,
} from '../../../types/datosSocio.types';

const ROLE_CHIP_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  gerente: 'bg-indigo-100 text-indigo-700',
  vendedor: 'bg-sky-100 text-sky-700',
  comprador: 'bg-amber-100 text-amber-700',
  almacenero: 'bg-orange-100 text-orange-700',
  finanzas: 'bg-teal-100 text-teal-700',
  supervisor: 'bg-slate-100 text-slate-700',
  socio: 'bg-violet-100 text-violet-700',
  invitado: 'bg-slate-100 text-slate-600',
};

export default function Ficha360() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.userProfile);
  const isAdmin = hasAnyRole(currentUser, ['admin', 'gerente']);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [datosLab, setDatosLab] = useState<DatosLaborales | null>(null);
  const [datosSoc, setDatosSoc] = useState<DatosSocio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [user, datosL, datosS] = await Promise.all([
          userService.getByUid(uid),
          datosLaboralesService.get(uid).catch(() => null),
          datosSocioService.get(uid).catch(() => null),
        ]);
        if (cancelled) return;
        if (!user) {
          setError('Usuario no encontrado');
          return;
        }
        setProfile(user);
        setDatosLab(datosL);
        setDatosSoc(datosS);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar ficha');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Guard · solo admin/gerente puede ver fichas (también el propio user puede ver SU ficha)
  const canView = isAdmin || currentUser?.uid === uid;
  if (!canView) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-900">Acceso restringido</div>
            <div className="text-[12px] text-rose-700">Solo admin · gerente · o el propio usuario pueden ver esta ficha.</div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 text-center py-12">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
        <p className="text-[13px] text-slate-600">Cargando ficha 360...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-900">{error || 'Usuario no encontrado'}</div>
            <Link to="/usuarios" className="text-[12px] text-rose-700 underline mt-1 inline-block">Volver a Usuarios</Link>
          </div>
        </div>
      </div>
    );
  }

  const roles = getUserRoles(profile);
  // chk5.F3-FIX-FICHA · admin tiene acceso total · cuenta TODOS los permisos del sistema
  // (porque DEFAULT_PERMISOS.admin = Object.values(PERMISOS) · puede tener .permisos
  // vacío si nunca fue actualizado · pero ESO no es "0 permisos" sino "todos heredados")
  const totalPermisosDelSistema = Object.values(PERMISOS).length;
  const totalPermisos = hasRole(profile, 'admin')
    ? totalPermisosDelSistema
    : (profile.permisos?.length ?? 0);
  // Etiquetas pedagógicas para cada estado
  const tieneRolPlanilla = hasAnyRole(profile, ['vendedor', 'gerente', 'comprador', 'almacenero', 'finanzas', 'supervisor']);
  const tieneRolSocio = hasRole(profile, 'socio');
  const ultimaConexion = profile.ultimaConexion?.toDate();
  const hoy = new Date();
  const diasDesdeConexion = ultimaConexion
    ? Math.floor((hoy.getTime() - ultimaConexion.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const conexionLabel = diasDesdeConexion === null
    ? 'Sin registro'
    : diasDesdeConexion === 0
    ? 'Hoy'
    : diasDesdeConexion === 1
    ? 'Ayer'
    : diasDesdeConexion < 7
    ? `Hace ${diasDesdeConexion} días`
    : `Hace ${Math.floor(diasDesdeConexion / 7)} semanas`;

  // Iniciales para avatar
  const iniciales = profile.displayName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-4 md:p-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Breadcrumb */}
        <div className="border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-3 bg-slate-50">
          <div className="flex items-center text-[12px] flex-1 min-w-0">
            <Link to="/" className="text-slate-500 hover:text-purple-700">Inicio</Link>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
            <Link to="/usuarios" className="text-slate-500 hover:text-purple-700">Usuarios</Link>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
            <span className="text-slate-900 font-semibold truncate">{profile.displayName}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/usuarios')}
            className="text-[11px] font-semibold text-slate-600 hover:bg-white border border-slate-200 px-2 py-1 rounded inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> Volver
          </button>
        </div>

        {/* Header de ficha · avatar big + identidad + roles + acciones */}
        <div className="px-4 sm:px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-purple-50/40 to-violet-50/40">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold text-[28px] flex-shrink-0">
              {iniciales || '?'}
            </div>
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-[20px] sm:text-[24px] font-bold text-slate-900">{profile.displayName}</h1>
                {profile.activo ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">activo</span>
                ) : (
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold">inactivo</span>
                )}
              </div>
              <div className="text-[11px] sm:text-[12px] text-slate-600 mb-2">
                {profile.email}
                {profile.cargo && <span> · {profile.cargo}</span>}
              </div>
              {/* Chips multi-rol */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {roles.map((r) => (
                  <span
                    key={r}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${ROLE_CHIP_COLORS[r] ?? 'bg-slate-100 text-slate-600'}`}
                  >
                    {ROLE_LABELS[r]}
                    {r === 'socio' && datosSoc && (
                      <span className="text-violet-900">· {datosSoc.porcentajeParticipacion}%</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => navigate(`/usuarios?edit=${profile.uid}`)}
                  className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded inline-flex items-center gap-1.5 hover:bg-slate-50"
                >
                  <Edit2 className="w-3 h-3" /> Editar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4 cards de resumen · SIEMPRE visibles · canon mockup A3 · responsive grid */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1 · Permisos · siempre */}
            <div className="bg-white border border-purple-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Key className="w-4 h-4 text-purple-700" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-purple-700 font-bold">PERMISOS</span>
              </div>
              <div className="text-[20px] font-bold tabular-nums text-purple-900">{totalPermisos}</div>
              <div className="text-[10px] text-slate-500">
                {hasRole(profile, 'admin')
                  ? `de ${totalPermisosDelSistema} · admin total`
                  : `${roles.length} rol${roles.length === 1 ? '' : 'es'} · ${roles.map((r) => ROLE_LABELS[r]).join(' · ')}`}
              </div>
            </div>

            {/* 2 · Datos laborales · siempre · 3 estados: tiene datos · rol pero sin completar · no aplica */}
            {datosLab ? (
              <div className="bg-white border border-sky-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-sky-700" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">PLANILLA</span>
                </div>
                <div className="text-[14px] font-bold text-sky-900 truncate">{profile.cargo || datosLab.area || 'Empleado'}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  desde {datosLab.fechaIngreso.toDate().toLocaleDateString('es-PE')}
                  {datosLab.salarioBase && ` · ${formatCurrencyPEN(datosLab.salarioBase)}/mes`}
                </div>
              </div>
            ) : tieneRolPlanilla ? (
              <div className="bg-white border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-amber-700" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">PLANILLA</span>
                </div>
                <div className="text-[14px] font-bold text-amber-900">Pendiente</div>
                <div className="text-[10px] text-amber-600">Completar datos laborales</div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">PLANILLA</span>
                </div>
                <div className="text-[14px] font-bold text-slate-400">N/A</div>
                <div className="text-[10px] text-slate-400">Sin rol de planilla</div>
              </div>
            )}

            {/* 3 · Datos socio · siempre · 3 estados */}
            {datosSoc ? (
              <div className="bg-white border border-violet-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Landmark className="w-4 h-4 text-violet-700" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">SOCIO</span>
                </div>
                <div className="text-[20px] font-bold tabular-nums text-violet-900">{datosSoc.porcentajeParticipacion}%</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {datosSoc.rolEnNegocio || 'Socio'} · {TIPO_PARTICIPACION_LABEL[datosSoc.tipoParticipacion].split(' ·')[0]}
                </div>
              </div>
            ) : tieneRolSocio ? (
              <div className="bg-white border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Landmark className="w-4 h-4 text-amber-700" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">SOCIO</span>
                </div>
                <div className="text-[14px] font-bold text-amber-900">Pendiente</div>
                <div className="text-[10px] text-amber-600">Completar datos de socio</div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Landmark className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">SOCIO</span>
                </div>
                <div className="text-[14px] font-bold text-slate-400">N/A</div>
                <div className="text-[10px] text-slate-400">No es socio del negocio</div>
              </div>
            )}

            {/* 4 · Actividad · siempre */}
            <div className="bg-white border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-emerald-700" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">CONEXIÓN</span>
              </div>
              <div className="text-[14px] font-bold text-emerald-900 truncate">{conexionLabel}</div>
              <div className="text-[10px] text-slate-500 truncate">
                {ultimaConexion ? ultimaConexion.toLocaleDateString('es-PE') : 'Sin registro'}
              </div>
            </div>
          </div>

          {/* Sección · detalle datos laborales si existe */}
          {datosLab && (
            <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-sky-50 to-sky-100/40 px-4 py-2.5 border-b border-sky-200/50">
                <h3 className="text-[12px] font-bold text-sky-900 flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5" />
                  Datos laborales
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
                <div className="p-3">
                  <div className="text-[9px] uppercase font-bold text-slate-500">Tipo</div>
                  <div className="text-[13px] font-semibold text-slate-900 capitalize">{datosLab.tipo}</div>
                </div>
                <div className="p-3">
                  <div className="text-[9px] uppercase font-bold text-slate-500">Sueldo base</div>
                  <div className="text-[13px] font-semibold text-slate-900 tabular-nums">
                    {datosLab.salarioBase ? `${datosLab.monedaSalario} ${datosLab.salarioBase.toLocaleString('es-PE')}` : '—'}
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-[9px] uppercase font-bold text-slate-500">Contrato</div>
                  <div className="text-[13px] font-semibold text-slate-900">{datosLab.tipoContrato || '—'}</div>
                </div>
                <div className="p-3">
                  <div className="text-[9px] uppercase font-bold text-slate-500">Modalidad</div>
                  <div className="text-[13px] font-semibold text-slate-900 capitalize">{datosLab.modalidad || '—'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Sección · detalle datos socio si existe */}
          {datosSoc && (
            <div className="bg-white border border-violet-200 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-violet-50 to-violet-100/40 px-4 py-2.5 border-b border-violet-200/50">
                <h3 className="text-[12px] font-bold text-violet-900 flex items-center gap-2">
                  <Landmark className="w-3.5 h-3.5" />
                  Datos de socio · participación canon D7
                </h3>
              </div>
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-violet-50/40 rounded p-2">
                    <div className="text-[9px] uppercase font-bold text-violet-700">% PARTICIPACIÓN</div>
                    <div className="text-[16px] font-bold tabular-nums text-violet-900">{datosSoc.porcentajeParticipacion}%</div>
                  </div>
                  <div className="bg-violet-50/40 rounded p-2">
                    <div className="text-[9px] uppercase font-bold text-violet-700">DESDE</div>
                    <div className="text-[12px] font-semibold text-slate-900">{datosSoc.fechaIngresoNegocio.toDate().toLocaleDateString('es-PE')}</div>
                  </div>
                  <div className="bg-violet-50/40 rounded p-2">
                    <div className="text-[9px] uppercase font-bold text-violet-700">TIPO</div>
                    <div className="text-[12px] font-semibold text-slate-900">{TIPO_PARTICIPACION_LABEL[datosSoc.tipoParticipacion].split(' ·')[0]}</div>
                  </div>
                </div>

                {datosSoc.aporteDeValor && (
                  <div className="bg-amber-50/40 border border-amber-200 rounded p-3">
                    <div className="text-[10px] uppercase font-bold text-amber-700 mb-1.5">APORTE DE VALOR</div>
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      {datosSoc.aporteDeValor.tiposDeValor.map((t) => (
                        <span key={t} className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                          {TIPO_VALOR_LABEL[t]}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] text-slate-700 mb-1">{datosSoc.aporteDeValor.descripcion}</div>
                    {datosSoc.aporteDeValor.valuacionEstimadaPEN && (
                      <div className="text-[11px] text-amber-900 font-semibold">
                        Valuación estimada: {formatCurrencyPEN(datosSoc.aporteDeValor.valuacionEstimadaPEN)}
                      </div>
                    )}
                    {datosSoc.aporteDeValor.vesting && datosSoc.aporteDeValor.vesting.tipoVesting !== 'inmediato' && (
                      <div className="text-[10px] text-violet-700 mt-1">
                        Vesting {datosSoc.aporteDeValor.vesting.tipoVesting} · {datosSoc.aporteDeValor.vesting.mesesVesting}m
                        {datosSoc.aporteDeValor.vesting.mesesCliff && ` (cliff ${datosSoc.aporteDeValor.vesting.mesesCliff}m)`}
                      </div>
                    )}
                  </div>
                )}

                {datosSoc.notas && (
                  <div className="text-[11px] text-slate-600 italic px-2">{datosSoc.notas}</div>
                )}
              </div>
            </div>
          )}

          {/* Cross-link a Inversionistas si es socio */}
          {hasRole(profile, 'socio') && (
            <div className="bg-violet-50/30 border border-violet-200 rounded-lg p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Landmark className="w-4 h-4 text-violet-700 flex-shrink-0" />
                <span className="text-[12px] text-violet-900">
                  Ver capital comprometido · ROI · trayectoria en el módulo Inversionistas
                </span>
              </div>
              <Link
                to="/inversionistas"
                className="text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1 flex-shrink-0"
              >
                Ver ejecutiva <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
