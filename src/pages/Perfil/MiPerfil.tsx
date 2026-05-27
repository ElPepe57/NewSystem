/**
 * MiPerfil · F10.F.1.A · 2026-05-27
 *
 * Página /perfil del usuario · vista PERSONALIZADA POR ROL.
 * Refactor v5.4 contra mockup canon perfil-v5.4-personalizado.html (16 actos desktop + 6 mobile).
 *
 * Canon visual:
 *  - Breadcrumb 2 niveles · Inicio › Mi Perfil (canon S9.D1)
 *  - Header banking-grade · icon purple gradient (cuenta personal)
 *  - Avatar 80px (64px mobile) · multi-rol chips
 *  - 3 tabs · Resumen · Mi información · Actividad
 *  - Sub-componentes condicionados por rol (datosLaborales · datosSocio)
 *  - Mobile-responsive · canon 2026-05-27 (touch ≥44px · stack 1-col · safe-area)
 *
 * Variantes por rol:
 *  - Empleado (no admin)        · Resumen muestra pendientes + boletas + incentivos + laborales
 *  - Admin                      · Resumen muestra pendientes admin + KPIs estratégicos
 *  - Socio                      · Resumen incluye MiCapitalSocio card
 *  - Mixto (admin + socio)      · Combina ambas
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  User,
  Camera,
  Save,
  Lock,
  Eye,
  EyeOff,
  Shield,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Activity,
  Clock,
  Edit2,
  X,
  ChevronRight,
  Home,
  Briefcase,
  ShieldAlert,
  Coins,
  Mail,
  Phone,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { userService, PERMISOS_INFO } from '../../services/user.service';
import { sesionService } from '../../services/sesion.service';
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
  type PendienteItem,
} from './components';

interface ActividadReciente {
  id: string;
  tipo: string;
  descripcion: string;
  fecha: Date;
  modulo?: string;
}

type TabActiva = 'resumen' | 'info' | 'actividad';

const TABS: Array<{ id: TabActiva; label: string; breadcrumb: string; icon: React.ElementType }> = [
  { id: 'resumen', label: 'Resumen', breadcrumb: 'Resumen', icon: Home },
  { id: 'info', label: 'Mi información', breadcrumb: 'Mi información', icon: User },
  { id: 'actividad', label: 'Actividad', breadcrumb: 'Actividad', icon: Activity },
];

// Color canon por rol · alineado a sistema (admin=red · socio=violet · resto=neutral chip slate)
const ROLE_CHIP_COLOR: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 ring-red-200',
  gerente: 'bg-purple-100 text-purple-700 ring-purple-200',
  vendedor: 'bg-sky-100 text-sky-700 ring-sky-200',
  comprador: 'bg-amber-100 text-amber-700 ring-amber-200',
  almacenero: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  finanzas: 'bg-teal-100 text-teal-700 ring-teal-200',
  supervisor: 'bg-teal-100 text-teal-700 ring-teal-200',
  invitado: 'bg-slate-100 text-slate-600 ring-slate-200',
  socio: 'bg-violet-100 text-violet-700 ring-violet-200',
};

export const MiPerfil: React.FC = () => {
  const { profile, role, roles, displayName, isAdmin, isSocio, canManageUsers } = usePermissions();
  const fetchUserProfile = useAuthStore((state) => state.fetchUserProfile);

  // ─── State · UI ────────────────────────────────────────────────────────
  const [tabActiva, setTabActiva] = useState<TabActiva>('resumen');

  // Editar nombre
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Cambiar contraseña
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Foto
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ─── Cargar datos del perfil (sub-perfiles + boletas + incentivos) ─────
  useEffect(() => {
    if (!profile?.uid) return;

    let cancelled = false;
    const cargar = async () => {
      setLoadingDatos(true);
      try {
        // En paralelo · cada uno puede fallar individualmente sin bloquear el resto
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

        // Si es admin · cargar adelantos pendientes para pendientes accionables
        if (canManageUsers) {
          try {
            const ref = collection(db, 'adelantos');
            const q = query(ref, where('estado', '==', 'pendiente'), fbLimit(20));
            const snap = await getDocs(q);
            if (!cancelled) setContadorAdelantosPendientes(snap.size);
          } catch {
            /* silent · no bloquea */
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

  // ─── Cargar actividad reciente (auditoría) ─────────────────────────────
  useEffect(() => {
    if (!profile?.uid) return;
    let cancelled = false;
    const cargar = async () => {
      setLoadingActividades(true);
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
      } catch (err) {
        console.error('Error cargando actividades:', err);
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

    // Pendiente · password expirado (TODOS) · heurística simple por última conexión
    // En producción se ataría a un flag fechaUltimoCambioPassword en UserProfile.

    // Pendiente · boletas en borrador del empleado mismo
    const boletasBorrador = boletas.filter((b) => b.estado === 'borrador');
    if (boletasBorrador.length > 0) {
      items.push({
        id: 'boleta_sin_aprobar',
        tipo: 'boleta_sin_firmar',
        titulo: `Tienes ${boletasBorrador.length} boleta${boletasBorrador.length > 1 ? 's' : ''} en borrador`,
        descripcion: 'Revisalas antes del cierre del mes.',
        ctaLabel: 'Ver boletas',
        onAction: () => setTabActiva('info'),
        severidad: 'media',
      });
    }

    // Pendiente · socio sin datosSocio (configuración incompleta)
    if (isSocio && !datosSocio && !loadingDatos) {
      items.push({
        id: 'datos_socio',
        tipo: 'datos_socio_incompleto',
        titulo: 'Datos de socio pendientes',
        descripcion: 'Tu participación aún no está configurada. Contactá al admin.',
        ctaLabel: 'Ver info',
        onAction: () => setTabActiva('info'),
        severidad: 'alta',
      });
    }

    // Pendiente · admin con adelantos por aprobar
    if (canManageUsers && contadorAdelantosPendientes > 0) {
      items.push({
        id: 'adelantos_pendientes',
        tipo: 'adelanto_aprobar',
        titulo: `${contadorAdelantosPendientes} adelanto${contadorAdelantosPendientes > 1 ? 's' : ''} por aprobar`,
        descripcion: 'Empleados están esperando respuesta sobre sus solicitudes.',
        ctaLabel: 'Ir a Planilla',
        onAction: () => {
          window.location.href = '/planilla?tab=adelantos';
        },
        severidad: 'alta',
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.uid) return;
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen no puede superar 2MB');
      return;
    }

    setUploadingPhoto(true);
    setError(null);
    try {
      await userService.uploadProfilePhoto(profile.uid, file);
      await fetchUserProfile(profile.uid);
      setSuccess('Foto de perfil actualizada');
    } catch (err: any) {
      setError(err.message || 'Error al subir foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setSavingPassword(true);
    setError(null);
    try {
      await userService.changeOwnPassword(newPassword);
      setSuccess('Contraseña cambiada correctamente · sesiones cerradas en otros dispositivos');
      setShowPasswordSection(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Error al cambiar contraseña');
    } finally {
      setSavingPassword(false);
    }
  };

  // ─── Permisos agrupados (para tab info) ────────────────────────────────
  const permisosAgrupados = userService.getPermisosAgrupados();
  const misPermisos = profile?.permisos || [];

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  const tabActivaCfg = TABS.find((t) => t.id === tabActiva)!;
  const tieneRolEmpleado = datosLaborales !== null;

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* ═══════════════════════════════════════════════════════════════
            §A · BREADCRUMB canon S9.D1 · 2 niveles dinámicos
            Default (resumen):  Inicio › Mi Perfil
            Sub-tab activa:     Inicio › Mi Perfil › {tab.breadcrumb}
            ═══════════════════════════════════════════════════════════════ */}
        <div className="border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-3 bg-slate-50">
          <div className="flex items-center text-[12px] flex-1 min-w-0">
            <a className="text-slate-500 hover:text-violet-700 cursor-pointer flex-shrink-0">Inicio</a>
            <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
            {tabActiva === 'resumen' ? (
              <span className="text-slate-900 font-semibold truncate">Mi Perfil</span>
            ) : (
              <>
                <a
                  className="text-slate-500 hover:text-violet-700 cursor-pointer flex-shrink-0"
                  onClick={() => setTabActiva('resumen')}
                >
                  Mi Perfil
                </a>
                <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
                <span className="text-slate-900 font-semibold truncate">{tabActivaCfg.breadcrumb}</span>
              </>
            )}
          </div>
          <span className="text-[10px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded font-bold hidden sm:inline-flex items-center gap-1 flex-shrink-0">
            <User className="w-3 h-3" />
            Cuenta personal
          </span>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            §B · HEADER banking-grade · purple gradient + avatar + multi-rol
            ═══════════════════════════════════════════════════════════════ */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
          <div className="flex items-start gap-3 sm:gap-4 flex-wrap">
            {/* Avatar · 64px mobile · 80px desktop · canon */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 p-0.5 shadow-lg shadow-violet-200">
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={displayName}
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-white flex items-center justify-center">
                    <span className="text-xl sm:text-2xl font-bold text-violet-700">
                      {displayName?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 p-1.5 bg-violet-600 text-white rounded-lg shadow-md hover:bg-violet-700 transition-colors disabled:opacity-50 min-w-[28px] min-h-[28px] flex items-center justify-center"
                title="Cambiar foto"
                aria-label="Cambiar foto de perfil"
              >
                {uploadingPhoto ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            {/* Info · nombre + email + multi-rol */}
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                {editingName ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-base sm:text-lg font-bold min-h-[40px]"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName || !newName.trim()}
                      className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 min-w-[40px] min-h-[40px] flex items-center justify-center"
                      aria-label="Guardar nombre"
                    >
                      {savingName ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 min-w-[40px] min-h-[40px] flex items-center justify-center"
                      aria-label="Cancelar edición"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                      {displayName}
                    </h1>
                    <button
                      onClick={handleStartEditName}
                      className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                      title="Editar nombre"
                      aria-label="Editar nombre"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
              <div className="text-[12px] sm:text-[13px] text-slate-500 flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {profile.email}
                </span>
                {profile.telefono && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {profile.telefono}
                    </span>
                  </>
                )}
              </div>

              {/* Multi-rol chips · wrap mobile */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {roles.map((r) => (
                  <span
                    key={r}
                    className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-bold rounded-full ring-1 ${
                      ROLE_CHIP_COLOR[r] || ROLE_CHIP_COLOR.invitado
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </span>
                ))}
                {profile.activo ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 rounded-full font-bold">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-rose-100 text-rose-700 rounded-full font-bold">
                    <XCircle className="w-2.5 h-2.5" />
                    Inactivo
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            §C · TABS · canon N6 scroll-x mobile · 44px touch
            ═══════════════════════════════════════════════════════════════ */}
        <div className="border-b border-slate-200 bg-slate-50/50">
          <div
            className="flex gap-1 px-2 sm:px-4 overflow-x-auto pb-0 -mb-px"
            style={{ scrollbarWidth: 'none' }}
          >
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tabActiva === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTabActiva(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-[12px] sm:text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors min-h-[44px] ${
                    active
                      ? 'border-violet-600 text-violet-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60'
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
            §D · CONTENT · mensajes + tabs body
            ═══════════════════════════════════════════════════════════════ */}
        <div className="p-4 sm:p-5 md:p-6 space-y-4 bg-slate-50/30">
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

          {/* ───── TAB · RESUMEN ───── */}
          {tabActiva === 'resumen' && (
            <div className="space-y-4">
              {/* Pendientes accionables (si hay) */}
              <PendientesAccionables pendientes={pendientes} />

              {/* Grid cards condicionales por rol · 1-col mobile · 2-col desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Empleado · datos laborales + boletas + incentivos */}
                {tieneRolEmpleado && (
                  <>
                    <MisDatosLaboralesCard datos={datosLaborales} mostrarSueldo />
                    <MisIncentivos calculos={calculosIncentivo} loading={loadingDatos} />
                  </>
                )}

                {/* Socio · capital */}
                {isSocio && <MiCapitalSocio datos={datosSocio} />}

                {/* Admin · KPIs estratégicos placeholder · TODO future */}
                {isAdmin && !tieneRolEmpleado && !isSocio && (
                  <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5 text-center text-slate-500 text-[13px]">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-violet-300" />
                    <div className="font-semibold text-slate-700">Vista de admin</div>
                    <div className="text-[11px] mt-1">
                      Tu cuenta es 100% administrativa · sin datos laborales o de socio.
                    </div>
                  </div>
                )}
              </div>

              {/* Mis boletas · ocupa full width abajo */}
              {tieneRolEmpleado && (
                <MisBoletasRecientes boletas={boletas} loading={loadingDatos} />
              )}
            </div>
          )}

          {/* ───── TAB · MI INFORMACIÓN ───── */}
          {tabActiva === 'info' && (
            <div className="space-y-4">
              {/* Sub-perfiles · cards apiladas */}
              {tieneRolEmpleado && <MisDatosLaboralesCard datos={datosLaborales} mostrarSueldo />}
              {isSocio && <MiCapitalSocio datos={datosSocio} />}

              {/* Mis Permisos · canon F4 cards apiladas */}
              <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-700" />
                  <span className="text-[11px] uppercase tracking-wider text-slate-700 font-bold">
                    Mis permisos
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold tabular-nums">
                    {misPermisos.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 p-px">
                  {Object.entries(permisosAgrupados).map(([grupo, permisos]) => {
                    const permisosDelGrupo = permisos.filter(({ permiso }) =>
                      misPermisos.includes(permiso),
                    );
                    const totalGrupo = permisos.length;

                    return (
                      <div key={grupo} className="bg-white p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-slate-800 text-[12px] uppercase tracking-wider">
                            {grupo}
                          </h4>
                          <span className="text-[10px] text-slate-500 tabular-nums font-bold">
                            {permisosDelGrupo.length}/{totalGrupo}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {permisos.map(({ permiso, info }) => {
                            const tiene = misPermisos.includes(permiso);
                            return (
                              <div
                                key={permiso}
                                className={`flex items-center gap-2 text-[12px] ${
                                  tiene ? 'text-slate-700' : 'text-slate-300'
                                }`}
                              >
                                {tiene ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                                )}
                                <span className="leading-tight">{info.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Seguridad · Cambio de password */}
              <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-700" />
                  <span className="text-[11px] uppercase tracking-wider text-slate-700 font-bold">
                    Seguridad
                  </span>
                  {!showPasswordSection && (
                    <button
                      onClick={() => setShowPasswordSection(true)}
                      className="ml-auto text-[11px] font-semibold text-violet-700 hover:bg-violet-50 border border-violet-200 px-2.5 py-1 rounded inline-flex items-center gap-1 min-h-[28px]"
                    >
                      <Lock className="w-3 h-3" />
                      Cambiar contraseña
                    </button>
                  )}
                </div>

                <div className="p-4 sm:p-5">
                  {showPasswordSection ? (
                    <div className="space-y-4 max-w-md">
                      <div>
                        <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5">
                          Nueva contraseña
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 pr-10 text-[14px] min-h-[44px]"
                            placeholder="Mínimo 6 caracteres"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-700 mb-1.5">
                          Confirmar contraseña
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-[14px] min-h-[44px]"
                          placeholder="Repetí la contraseña"
                        />
                      </div>

                      {newPassword && confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-[12px] text-rose-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Las contraseñas no coinciden
                        </p>
                      )}

                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-700 flex items-start gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>
                          Al cambiar tu contraseña, todas las sesiones en otros dispositivos se cerrarán
                          automáticamente.
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setShowPasswordSection(false);
                            setNewPassword('');
                            setConfirmPassword('');
                          }}
                          className="px-4 py-2.5 text-[13px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors min-h-[44px]"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleChangePassword}
                          disabled={
                            savingPassword ||
                            !newPassword ||
                            newPassword !== confirmPassword ||
                            newPassword.length < 6
                          }
                          className="flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors min-h-[44px]"
                        >
                          {savingPassword ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] text-slate-500">
                      Mantenete seguro · cambiá tu contraseña periódicamente o ante cualquier sospecha.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ───── TAB · ACTIVIDAD ───── */}
          {tabActiva === 'actividad' && (
            <div className="space-y-4">
              {/* Sesiones activas */}
              <MisSesionesActivas uid={profile.uid} />

              {/* Timeline actividad reciente */}
              <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-700" />
                  <span className="text-[11px] uppercase tracking-wider text-slate-700 font-bold">
                    Actividad reciente
                  </span>
                </div>

                {loadingActividades ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : actividades.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <Activity className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-[13px] font-semibold text-slate-700">Sin actividad registrada aún</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      A medida que usés el sistema, las acciones quedarán acá.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {actividades.map((act) => (
                      <div
                        key={act.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13px] font-semibold text-slate-900 capitalize leading-tight">
                              {act.tipo}
                            </p>
                            {act.modulo && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-bold uppercase tracking-wider">
                                {act.modulo}
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-slate-600 truncate mt-0.5">{act.descripcion}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                            {act.fecha.toLocaleDateString('es-PE', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MiPerfil;
