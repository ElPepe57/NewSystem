/**
 * MiPerfil · F10.F.1.I-FIX · 2026-05-27
 *
 * PIXEL-PERFECT REWRITE · canon v9.0 M1 · copy-paste literal del mockup
 * perfil-v5.4-personalizado.html ACTO 1 (líneas 91-160).
 *
 * Página /perfil del usuario · vista PERSONALIZADA POR ROL.
 *
 * Canon visual literal mockup:
 *  - Container: bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden
 *  - Breadcrumb: px-6 py-2.5 border-b border-slate-200 bg-slate-50 (canon S9.D1 · 2 niveles)
 *  - Header: avatar XL 80px gradient purple-500→purple-700 · botón camera white
 *  - Email line: combinada "email · activo desde mes año"
 *  - Multi-rol chips: rounded-full inline-flex items-center gap-1
 *  - Acciones header: 2 botones (Cambiar contraseña neutral + Editar perfil primary purple)
 *  - Tabs: 3 sub-tabs scroll-x mobile · active border-b-2 border-purple-600 text-purple-700
 *    icons: layout-dashboard · user · activity
 *  - Body: contextual por rol y tab activo
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Camera,
  Save,
  Lock,
  Shield,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Activity,
  Clock,
  Edit2,
  X,
  ChevronRight,
  LayoutDashboard,
  User,
  Briefcase,
  AlertTriangle,
  Gift,
  Key,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { userService, PERMISOS_INFO } from '../../services/user.service';
import { datosLaboralesService } from '../../services/datosLaborales.service';
import { datosSocioService } from '../../services/datosSocio.service';
import { planillaService } from '../../services/planilla.service';
import { calculoIncentivoService } from '../../services/calculoIncentivo.service';
import { ROLE_LABELS } from '../../types/auth.types';
import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { DatosLaborales } from '../../types/datosLaborales.types';
import type { DatosSocio } from '../../types/datosSocio.types';
import type { Boleta, CalculoIncentivoMes } from '../../types/planilla.types';
import {
  PendientesAccionables,
  MisDatosLaboralesCard,
  MisBoletasRecientes,
  MisIncentivos,
  MiCapitalSocio,
  MisSesionesActivas,
  ResumenEmpleado,
  ResumenAdmin,
  ResumenSocio,
  CardIdentidadEditable,
  CardMultiRolRica,
  // F10.F.1.O · Etapa 5 · Banners + Empty/Loading/Error + filtros timeline
  BannerContextual,
  EmptyStateCanon,
  LoadingSkeletonCanon,
  ErrorStateCanon,
  TimelineActividadFiltros,
  type PendienteItem,
} from './components';
// F10.F.1.N · 4 modales canon FormModalV2
import {
  CambiarPasswordModal,
  EditarAvatarModal,
  DesconectarSesionConfirmModal,
  SolicitarAdelantoModal,
} from './modals';
import type { SesionActiva } from '../../types/sesion.types';
// chk5.AUTH-LINK (2026-05-28) · sección Métodos de inicio de sesión
import { MetodosInicioSesion } from '../../components/auth/MetodosInicioSesion';

interface ActividadReciente {
  id: string;
  tipo: string;
  descripcion: string;
  fecha: Date;
  modulo?: string;
}

type TabActiva = 'resumen' | 'info' | 'actividad';

// Canon mockup ACTO 1 · líneas 142-150 · labels + icons literales
const TABS: Array<{ id: TabActiva; label: string; breadcrumb: string; icon: React.ElementType }> = [
  { id: 'resumen', label: 'Resumen', breadcrumb: 'Resumen', icon: LayoutDashboard },
  { id: 'info', label: 'Mi información', breadcrumb: 'Mi información', icon: User },
  { id: 'actividad', label: 'Actividad & seguridad', breadcrumb: 'Actividad & seguridad', icon: Activity },
];

// Canon mockup ACTO 1 · chips multi-rol literal · "purple" para admin · "violet" para socio
// Override del ROLE_CHIP_COLOR de auth.types para matchear mockup pixel-perfect.
const ROLE_CHIP_MOCKUP: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  admin: { bg: 'bg-purple-100 text-purple-700', text: 'Admin', icon: Shield },
  gerente: { bg: 'bg-purple-100 text-purple-700', text: 'Gerente', icon: Shield },
  socio: { bg: 'bg-violet-100 text-violet-700', text: 'Socio', icon: Briefcase },
  vendedor: { bg: 'bg-sky-100 text-sky-700', text: 'Vendedor', icon: Briefcase },
  comprador: { bg: 'bg-amber-100 text-amber-700', text: 'Comprador', icon: Briefcase },
  almacenero: { bg: 'bg-emerald-100 text-emerald-700', text: 'Almacenero', icon: Briefcase },
  finanzas: { bg: 'bg-teal-100 text-teal-700', text: 'Finanzas', icon: Briefcase },
  supervisor: { bg: 'bg-teal-100 text-teal-700', text: 'Supervisor', icon: Briefcase },
  invitado: { bg: 'bg-slate-100 text-slate-600', text: 'Invitado', icon: User },
};

const MES_CORTO = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const getIniciales = (nombre?: string): string => {
  if (!nombre) return 'U';
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'U';
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

export const MiPerfil: React.FC = () => {
  const { profile, roles, displayName, isAdmin, isSocio, canManageUsers } = usePermissions();
  const fetchUserProfile = useAuthStore((state) => state.fetchUserProfile);

  // ─── State · UI ────────────────────────────────────────────────────────
  const [tabActiva, setTabActiva] = useState<TabActiva>('resumen');

  // Editar nombre
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // F10.F.1.N · Modales canon FormModalV2
  const [showCambiarPassword, setShowCambiarPassword] = useState(false);
  const [showEditarAvatar, setShowEditarAvatar] = useState(false);
  const [showSolicitarAdelanto, setShowSolicitarAdelanto] = useState(false);
  const [sesionADesconectar, setSesionADesconectar] = useState<SesionActiva | null>(null);
  const [showDesconectarTodas, setShowDesconectarTodas] = useState(false);
  const [sesionesCount, setSesionesCount] = useState(0);

  // F10.F.1.O · Etapa 5 · filtro chip del timeline actividad + error state
  const [filtroModulo, setFiltroModulo] = useState<string>('');
  const [errorActividades, setErrorActividades] = useState<string | null>(null);

  // Mensajes generales
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── State · datos cargados ────────────────────────────────────────────
  const [datosLaborales, setDatosLaborales] = useState<DatosLaborales | null>(null);
  const [datosSocio, setDatosSocio] = useState<DatosSocio | null>(null);
  const [boletas, setBoletas] = useState<Boleta[]>([]);
  const [calculosIncentivo, setCalculosIncentivo] = useState<CalculoIncentivoMes[]>([]);
  const [actividades, setActividades] = useState<ActividadReciente[]>([]);
  const [loadingDatos, setLoadingDatos] = useState(true);
  const [loadingActividades, setLoadingActividades] = useState(true);
  const [contadorAdelantosPendientes, setContadorAdelantosPendientes] = useState(0);

  // ─── Auto-hide mensajes ────────────────────────────────────────────────
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // ─── Cargar datos del perfil ───────────────────────────────────────────
  useEffect(() => {
    if (!profile?.uid) return;
    let cancelled = false;
    const cargar = async () => {
      setLoadingDatos(true);
      try {
        const [dl, ds, bo, ci] = await Promise.all([
          datosLaboralesService.get(profile.uid).catch(() => null),
          isSocio ? datosSocioService.get(profile.uid).catch(() => null) : Promise.resolve(null),
          planillaService.getBoletasPorEmpleado(profile.uid, 5).catch(() => []),
          calculoIncentivoService.listUsuario(profile.uid, 12).catch(() => []),
        ]);
        if (cancelled) return;
        setDatosLaborales(dl);
        setDatosSocio(ds);
        setBoletas(bo);
        setCalculosIncentivo(ci);

        if (canManageUsers) {
          try {
            const ref = collection(db, 'adelantos');
            const q = query(ref, where('estado', '==', 'pendiente'), fbLimit(20));
            const snap = await getDocs(q);
            if (!cancelled) setContadorAdelantosPendientes(snap.size);
          } catch {
            /* silent */
          }
        }
      } finally {
        if (!cancelled) setLoadingDatos(false);
      }
    };
    cargar();
    return () => {
      cancelled = true;
    };
  }, [profile?.uid, isSocio, canManageUsers]);

  // ─── Cargar actividad reciente ─────────────────────────────────────────
  useEffect(() => {
    if (!profile?.uid) return;
    let cancelled = false;
    const cargar = async () => {
      setLoadingActividades(true);
      setErrorActividades(null);
      try {
        const q = query(
          collection(db, 'audit_logs'),
          where('userId', '==', profile.uid),
          orderBy('timestamp', 'desc'),
          fbLimit(20),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const items: ActividadReciente[] = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            tipo: data.action || data.tipo || 'acción',
            descripcion: data.description || data.descripcion || data.details || 'Sin descripción',
            fecha: data.timestamp?.toDate?.() || new Date(),
            modulo: data.module || data.modulo || data.collection || undefined,
          };
        });
        setActividades(items);
      } catch (err: any) {
        console.error('Error cargando actividades:', err);
        if (!cancelled) setErrorActividades(err?.message || 'No pudimos cargar el historial de actividad');
      } finally {
        if (!cancelled) setLoadingActividades(false);
      }
    };
    cargar();
    return () => {
      cancelled = true;
    };
  }, [profile?.uid]);

  // ─── Construir lista de pendientes contextual al rol ───────────────────
  const pendientes = useMemo<PendienteItem[]>(() => {
    if (!profile) return [];
    const items: PendienteItem[] = [];

    const boletasBorrador = boletas.filter((b) => b.estado === 'borrador');
    if (boletasBorrador.length > 0) {
      items.push({
        id: 'boleta_borrador',
        tipo: 'boleta_sin_firmar',
        titulo: `Tienes ${boletasBorrador.length} boleta${boletasBorrador.length > 1 ? 's' : ''} en borrador`,
        descripcion: 'Revisalas antes del cierre del mes',
        chipLabel: 'BORRADOR',
        tinte: 'sky',
        onAction: () => setTabActiva('info'),
      });
    }

    if (isSocio && !datosSocio && !loadingDatos) {
      items.push({
        id: 'datos_socio',
        tipo: 'datos_socio_incompleto',
        titulo: 'Datos de socio pendientes',
        descripcion: 'Tu participación aún no está configurada · contactá al admin',
        chipLabel: 'PENDIENTE',
        tinte: 'rose',
        onAction: () => setTabActiva('info'),
      });
    }

    if (canManageUsers && contadorAdelantosPendientes > 0) {
      items.push({
        id: 'adelantos_pendientes',
        tipo: 'adelanto_aprobar',
        titulo: `${contadorAdelantosPendientes} adelanto${contadorAdelantosPendientes > 1 ? 's' : ''} por aprobar`,
        descripcion: 'Empleados esperando respuesta · revisar antes de fin de mes',
        chipLabel: 'PEND. ADMIN',
        tinte: 'amber',
        onAction: () => {
          window.location.href = '/planilla?tab=adelantos';
        },
      });
    }

    return items;
  }, [profile, boletas, isSocio, datosSocio, loadingDatos, canManageUsers, contadorAdelantosPendientes]);

  // ─── Handlers ──────────────────────────────────────────────────────────
  const handleStartEditName = () => {
    setNewName(displayName || '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!profile?.uid || !newName.trim()) return;
    setSavingName(true);
    setError(null);
    try {
      await userService.updateProfile(profile.uid, { displayName: newName.trim() });
      await fetchUserProfile(profile.uid);
      setSuccess('Nombre actualizado correctamente');
      setEditingName(false);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar nombre');
    } finally {
      setSavingName(false);
    }
  };

  // F10.F.1.N · La lógica de upload de foto + cambio de password vive ahora
  // dentro de los modales canon EditarAvatarModal y CambiarPasswordModal.
  // Ver src/pages/Perfil/modals/* para los handlers

  // Permisos agrupados
  const permisosAgrupados = userService.getPermisosAgrupados();
  const misPermisos = profile?.permisos || [];

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const tabActivaCfg = TABS.find((t) => t.id === tabActiva)!;
  const tieneRolEmpleado = datosLaborales !== null;
  const iniciales = getIniciales(displayName);

  // "Activo desde mar 2024" · canon mockup línea 115
  const fechaCreacion = profile.fechaCreacion?.toDate?.();
  const activoDesdeLabel = fechaCreacion
    ? `activo desde ${MES_CORTO[fechaCreacion.getMonth() + 1]} ${fechaCreacion.getFullYear()}`
    : 'activo';

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      {/* Canon mockup ACTO 1 · línea 91 · copy-paste literal */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
        {/* ═══════════════════════════════════════════════════════════════
            §A · BREADCRUMB canon S9.D1 · 2 niveles · línea 93-99 mockup
            ═══════════════════════════════════════════════════════════════ */}
        <div className="px-6 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
          <div className="flex items-center text-[12px] flex-1 min-w-0">
            <a className="text-slate-500 hover:text-purple-700 cursor-pointer flex-shrink-0">Inicio</a>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
            {tabActiva === 'resumen' ? (
              <span className="text-slate-900 font-semibold truncate">Mi perfil</span>
            ) : (
              <>
                <a
                  className="text-slate-500 hover:text-purple-700 cursor-pointer flex-shrink-0"
                  onClick={() => setTabActiva('resumen')}
                >
                  Mi perfil
                </a>
                <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
                <span className="text-slate-900 font-semibold truncate">{tabActivaCfg.breadcrumb}</span>
              </>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            §B · HEADER · avatar XL gradient purple · línea 102-137 mockup
            ═══════════════════════════════════════════════════════════════ */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-1 min-w-[280px]">
            {/* Avatar XL 80px · gradient purple-500→purple-700 · línea 105-112 */}
            <div className="relative group flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-bold text-[28px] shadow-md overflow-hidden">
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  iniciales
                )}
              </div>
              <button
                onClick={() => setShowEditarAvatar(true)}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm hover:bg-slate-50"
                title="Cambiar foto"
                aria-label="Cambiar foto de perfil"
              >
                <Camera className="w-3.5 h-3.5 text-slate-600" />
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {editingName ? (
                  <div className="inline-flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full max-w-[260px] px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-2xl font-bold tracking-tight"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName || !newName.trim()}
                      className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex-shrink-0"
                      aria-label="Guardar nombre"
                    >
                      {savingName ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 flex-shrink-0"
                      aria-label="Cancelar edición"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">{displayName}</h1>
                    <button
                      onClick={handleStartEditName}
                      className="p-1 text-slate-400 hover:text-purple-600 rounded transition-colors flex-shrink-0"
                      title="Editar nombre"
                      aria-label="Editar nombre"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
              {/* Email line combinada · canon mockup línea 115 */}
              <p className="text-[12px] text-slate-500 mt-0.5">
                {profile.email} · {activoDesdeLabel}
              </p>
              {/* Multi-rol badges · canon mockup línea 117-125 */}
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {roles.map((r) => {
                  const chip = ROLE_CHIP_MOCKUP[r] || ROLE_CHIP_MOCKUP.invitado;
                  const Icon = chip.icon;
                  return (
                    <span
                      key={r}
                      className={`${chip.bg} text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1`}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {ROLE_LABELS[r] || chip.text}
                    </span>
                  );
                })}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    profile.activo
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {profile.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>

          {/* Acciones header · canon 3-tier · canon mockup línea 129-136
              Ocultas durante edición de nombre · evita competir por espacio con el input. */}
          {!editingName && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setShowCambiarPassword(true)}
              className="text-[12px] font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              Cambiar contraseña
            </button>
            <button
              type="button"
              onClick={handleStartEditName}
              className="text-[12px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Editar perfil
            </button>
          </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            §C · TABS · canon mockup línea 140-152 · 3 sub-tabs scroll-x
            ═══════════════════════════════════════════════════════════════ */}
        <div
          className="px-6 border-b border-slate-200 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex gap-1 whitespace-nowrap">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tabActiva === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTabActiva(t.id)}
                  className={`px-4 py-2.5 text-[12px] border-b-2 flex items-center gap-1.5 ${
                    active
                      ? 'font-bold border-purple-600 text-purple-700'
                      : 'font-medium border-transparent text-slate-600 hover:text-purple-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            §D · BODY · contextual por rol y tab activo
            ═══════════════════════════════════════════════════════════════ */}
        <div className="p-6 space-y-5">
          {/* Mensajes globales */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg flex justify-between items-start gap-3 text-[13px]">
              <span className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </span>
              <button
                onClick={() => setError(null)}
                className="text-rose-500 hover:text-rose-700 flex-shrink-0"
                aria-label="Cerrar mensaje"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex justify-between items-center text-[13px]">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {success}
              </span>
              <button
                onClick={() => setSuccess(null)}
                className="text-emerald-500 hover:text-emerald-700"
                aria-label="Cerrar mensaje"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ───── TAB · RESUMEN · contextual por rol ─────
              Renderiza los 3 wrappers en orden según los roles del usuario:
                1. ResumenAdmin · si tiene permiso gestionar usuarios (admin/gerente)
                2. ResumenEmpleado · si tiene datosLaborales configurados
                3. ResumenSocio · si tiene rol socio
              Un user multi-rol (ej. admin+socio) ve los 3 bloques concatenados. */}
          {tabActiva === 'resumen' && (
            <div className="space-y-5">
              {/* F10.F.1.O · Banners contextuales canon ACTO 15
                  Aparecen según contexto · auto-detectados sin config manual */}
              {(() => {
                const banners: React.ReactNode[] = [];

                // Banner gratificación · solo si tiene datosLaborales
                if (tieneRolEmpleado) {
                  const hoy = new Date();
                  const jul15 = new Date(hoy.getFullYear(), 6, 15);
                  const dic15 = new Date(hoy.getFullYear(), 11, 15);
                  const julProx = jul15 > hoy ? jul15 : new Date(hoy.getFullYear() + 1, 6, 15);
                  const dicProx = dic15 > hoy ? dic15 : new Date(hoy.getFullYear() + 1, 11, 15);
                  const proxima = julProx < dicProx ? julProx : dicProx;
                  const dias = Math.ceil((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                  // Solo mostrar si la próxima gratif está en <=30 días
                  if (dias <= 30 && datosLaborales?.salarioBase) {
                    const mesGratif = proxima.getMonth() === 6 ? 'julio' : 'diciembre';
                    banners.push(
                      <BannerContextual
                        key="gratif"
                        tone="indigo"
                        icon={Gift}
                        titulo={`Tu gratificación de ${mesGratif} en ${dias} día${dias !== 1 ? 's' : ''}`}
                        descripcion={
                          <>
                            Estimado: <span className="font-bold tabular-nums">S/ {datosLaborales.salarioBase.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span>
                          </>
                        }
                      />,
                    );
                  }
                }

                // Banner password expira · si fechaCreacion existe y han pasado >70 días
                // (Heurística simple sin campo fechaUltimoCambioPassword)
                const fechaCreacion = profile.fechaCreacion?.toDate?.();
                if (fechaCreacion) {
                  const diasDesdeCreacion = Math.floor((Date.now() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
                  const diasParaExpirar = 90 - diasDesdeCreacion;
                  if (diasDesdeCreacion >= 70 && diasParaExpirar <= 20 && diasParaExpirar > 0) {
                    banners.push(
                      <BannerContextual
                        key="password"
                        tone="rose"
                        icon={Key}
                        titulo={`Tu contraseña expira en ${diasParaExpirar} día${diasParaExpirar !== 1 ? 's' : ''}`}
                        descripcion={`Última actualización: hace ${diasDesdeCreacion} días · cambiarla cada 90 días por seguridad`}
                        accionLabel="Cambiar ahora"
                        onAction={() => setShowCambiarPassword(true)}
                      />,
                    );
                  }
                }

                return banners.length > 0 ? <div className="space-y-2">{banners}</div> : null;
              })()}

              {/* Pendientes accionables · siempre que haya alguno */}
              <PendientesAccionables pendientes={pendientes} />

              {/* Vista admin · contadores de bandeja + KPI strip admin + quick actions */}
              {canManageUsers && <ResumenAdmin />}

              {/* Vista empleado · banner + KPI strip empleado + quick actions + cross-link */}
              {tieneRolEmpleado && (
                <ResumenEmpleado
                  datosLaborales={datosLaborales}
                  boletas={boletas}
                  calculosIncentivo={calculosIncentivo}
                  contadorPendientes={pendientes.length}
                />
              )}

              {/* Vista socio · banner ROI + KPI strip socio + distribuciones + cross-link */}
              {isSocio && <ResumenSocio uid={profile.uid} datosSocio={datosSocio} />}

              {/* Cards detalle (empleado) · datos laborales + incentivos lado a lado + boletas full */}
              {tieneRolEmpleado && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <MisDatosLaboralesCard datos={datosLaborales} mostrarSueldo />
                    <MisIncentivos calculos={calculosIncentivo} loading={loadingDatos} />
                  </div>
                  <MisBoletasRecientes boletas={boletas} loading={loadingDatos} />
                </>
              )}

              {/* Empty state · admin puro sin laboral ni socio */}
              {!canManageUsers && !tieneRolEmpleado && !isSocio && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 text-center text-slate-500 text-[13px]">
                  <Shield className="w-8 h-8 mx-auto mb-2 text-purple-300" />
                  <div className="font-semibold text-slate-700">Sin sub-perfiles configurados</div>
                  <div className="text-[11px] mt-1">
                    Tu cuenta aún no tiene datos laborales ni de socio · contactá al admin si corresponde.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ───── TAB · MI INFORMACIÓN ─────
              Canon v5.4 ACTO 5 · Identidad editable inline + Multi-rol rica + Permisos efectivos
              Sub-perfiles detallados (datos laborales · capital socio) viven en sub-páginas
              dedicadas (/perfil/mi-planilla · /perfil/mi-capital) accesibles desde sidebar. */}
          {tabActiva === 'info' && (
            <div className="space-y-5">
              {/* F10.F.1.J-SIDEBAR.3 · Card identidad editable inline · canon mockup v5.4 línea 595 */}
              <CardIdentidadEditable />

              {/* F10.F.1.J-SIDEBAR.3 · Card multi-rol rica · canon mockup v5.4 línea 651 */}
              <CardMultiRolRica />

              {/* Sub-perfiles · vista resumida (drill profundo vive en sub-páginas /perfil/mi-X) */}
              {tieneRolEmpleado && <MisDatosLaboralesCard datos={datosLaborales} mostrarSueldo />}
              {isSocio && <MiCapitalSocio datos={datosSocio} />}

              {/* Card "Permisos efectivos" · canon mockup ACTO 8 · líneas 931-989 */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-slate-700" />
                    Mis permisos efectivos
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {misPermisos.length} de {Object.keys(PERMISOS_INFO).length} permisos
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(permisosAgrupados).map(([grupo, permisos]) => {
                    const permisosDelGrupo = permisos.filter(({ permiso }) =>
                      misPermisos.includes(permiso),
                    );
                    const totalGrupo = permisos.length;
                    const tieneAlguno = permisosDelGrupo.length > 0;
                    return (
                      <div
                        key={grupo}
                        className={`${
                          tieneAlguno
                            ? 'bg-emerald-50/40 border border-emerald-200'
                            : 'bg-slate-50/40 border border-slate-200'
                        } rounded-lg p-3`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-bold text-slate-900">{grupo}</span>
                          <span
                            className={`text-[10px] font-bold ${
                              tieneAlguno ? 'text-emerald-700' : 'text-slate-500'
                            }`}
                          >
                            {permisosDelGrupo.length}/{totalGrupo}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-600">
                          {permisosDelGrupo.length > 0
                            ? permisosDelGrupo.map((p) => p.info.label).slice(0, 4).join(' · ') +
                              (permisosDelGrupo.length > 4 ? ` · +${permisosDelGrupo.length - 4} más` : '')
                            : 'Sin acceso a este módulo'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[10px] text-slate-500 italic">
                  Los permisos se derivan automáticamente de tus roles asignados. Para modificarlos, contactá al
                  admin del sistema.
                </div>
              </div>
            </div>
          )}

          {/* ───── TAB · ACTIVIDAD & SEGURIDAD ───── */}
          {tabActiva === 'actividad' && (
            <div className="space-y-5">
              {/* Card contraseña · canon mockup ACTO 9 · líneas 1010-1025
                  F10.F.1.N · ahora abre modal canon CambiarPasswordModal */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-rose-700" />
                    Contraseña
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCambiarPassword(true)}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Lock className="w-3 h-3" />
                    Cambiar contraseña
                  </button>
                </div>
                <div className="text-[11px] text-slate-600">
                  Última actualización: <strong>—</strong>
                </div>
                <div className="text-[10px] text-amber-700 mt-1 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Recomendado actualizar cada 90 días
                </div>
              </div>

              {/* chk5.AUTH-LINK (2026-05-28) · Métodos de inicio de sesión
                  Permite vincular/desvincular Google + email-password. */}
              <MetodosInicioSesion />

              {/* Sesiones activas · con callbacks a modales canon F10.F.1.N */}
              <MisSesionesActivas
                uid={profile.uid}
                onSolicitarDesconectar={(s) => setSesionADesconectar(s)}
                onSolicitarDesconectarTodas={() => {
                  // sesionesCount se actualiza via callback de MisSesionesActivas (próx iteración)
                  // Por ahora · pasar count=1 como placeholder seguro · el modal verifica internamente
                  setSesionesCount(Math.max(1, sesionesCount));
                  setShowDesconectarTodas(true);
                }}
                onSesionCerrada={() => setSuccess('Sesión cerrada correctamente')}
              />

              {/* Timeline actividad reciente · canon mockup ACTO 10 · líneas 1107-1186
                  F10.F.1.O · agregados filtros chip + skeleton loading + empty/error canon */}
              {loadingActividades ? (
                <LoadingSkeletonCanon variant="timeline" rows={5} />
              ) : errorActividades ? (
                <ErrorStateCanon
                  titulo="No pudimos cargar tu historial"
                  descripcion={errorActividades}
                  onRetry={() => {
                    // Forzar reload del effect cambiando una key · simplemente recargar la página
                    window.location.reload();
                  }}
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="text-[14px] font-bold text-slate-900 inline-flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-slate-700" />
                      Actividad reciente
                    </h3>
                  </div>

                  {/* Filtros chip · canon mockup ACTO 10 línea 1109 · solo si hay actividades */}
                  {actividades.length > 0 && (() => {
                    const contadores: Record<string, number> = { todos: actividades.length };
                    actividades.forEach((a) => {
                      const mod = (a.modulo || '').replace(/^\//, '');
                      if (mod) contadores[mod] = (contadores[mod] || 0) + 1;
                    });
                    return (
                      <TimelineActividadFiltros
                        filtroActivo={filtroModulo}
                        onFiltroChange={setFiltroModulo}
                        contadores={contadores}
                      />
                    );
                  })()}

                  {actividades.length === 0 ? (
                    <EmptyStateCanon
                      icon={Activity}
                      tone="slate"
                      titulo="Sin actividad registrada"
                      descripcion="A medida que usés el sistema · las acciones quedarán acá."
                      compacto
                    />
                  ) : (() => {
                    const filtradas = filtroModulo
                      ? actividades.filter((a) => (a.modulo || '').replace(/^\//, '') === filtroModulo)
                      : actividades;
                    if (filtradas.length === 0) {
                      return (
                        <div className="py-6 text-center">
                          <p className="text-[12px] text-slate-500">
                            Sin actividad en módulo <strong className="text-slate-700">{filtroModulo}</strong>
                          </p>
                          <button
                            onClick={() => setFiltroModulo('')}
                            className="mt-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded inline-flex items-center gap-1"
                          >
                            Mostrar todas
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-0">
                        {filtradas.map((act, idx) => (
                          <div
                            key={act.id}
                            className={`flex gap-3 ${
                              idx === 0
                                ? 'pb-3 border-b border-slate-100'
                                : idx === filtradas.length - 1
                                ? 'pt-3'
                                : 'py-3 border-b border-slate-100'
                            }`}
                          >
                            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Clock className="w-4 h-4 text-slate-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-bold text-slate-900 capitalize leading-tight">
                                {act.tipo}
                              </div>
                              <div className="text-[11px] text-slate-600 truncate">{act.descripcion}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {act.fecha.toLocaleDateString('es-PE', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                                {act.modulo && ` · /${act.modulo}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          F10.F.1.N · Modales canon FormModalV2
          Renderizados a nivel root para evitar issues de stacking context
          ═══════════════════════════════════════════════════════════════ */}
      <CambiarPasswordModal
        isOpen={showCambiarPassword}
        onClose={() => setShowCambiarPassword(false)}
        onSuccess={() => setSuccess('Contraseña cambiada · sesiones en otros dispositivos cerradas')}
      />
      <EditarAvatarModal
        isOpen={showEditarAvatar}
        onClose={() => setShowEditarAvatar(false)}
        onSuccess={() => setSuccess('Foto de perfil actualizada')}
      />
      <SolicitarAdelantoModal
        isOpen={showSolicitarAdelanto}
        onClose={() => setShowSolicitarAdelanto(false)}
        onSuccess={(id) => setSuccess(`Adelanto ${id} solicitado · esperando aprobación admin`)}
      />
      {sesionADesconectar && (
        <DesconectarSesionConfirmModal
          mode="individual"
          isOpen={!!sesionADesconectar}
          sesion={sesionADesconectar}
          onClose={() => setSesionADesconectar(null)}
          onSuccess={() => setSuccess('Sesión desconectada correctamente')}
        />
      )}
      {showDesconectarTodas && (
        <DesconectarSesionConfirmModal
          mode="all"
          isOpen={showDesconectarTodas}
          uid={profile.uid}
          cantidad={Math.max(1, sesionesCount)}
          onClose={() => setShowDesconectarTodas(false)}
          onSuccess={() => setSuccess('Otras sesiones desconectadas correctamente')}
        />
      )}
    </div>
  );
};

export default MiPerfil;
