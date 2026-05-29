import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Shield, UserCheck, UserX, Edit2, X, Eye, Search,
  Key, LogOut, Trash2, Clock, CheckCircle, Loader2, MoreHorizontal,
  // chk5.F4-USERS · iconos de roles (avatares + chips)
  Briefcase, ShoppingCart, Package, Wallet, Landmark, User as UserIcon, Moon,
  // chk5.F4-USERS · iconos de tabs internas
  BriefcaseBusiness, ShieldCheck,
  Settings as SettingsIcon, LayoutDashboard, MailPlus,
  // chk5.PERSONAS-v5.3 · F2 · banners cross-link
  ArrowRight,
  // chk5.PERSONAS-v5.4 · F10.D · breadcrumb canon S9.D1 + exportar
  ChevronRight, Download,
} from 'lucide-react';
// chk5.PERSONAS-v5.7 · E4.1 (2026-05-28) · UserPanel reemplaza Ficha360Modal
// como camino canon para ver el detalle de un usuario. Ficha360Modal queda
// en deprecation soft · se elimina en E10.
import { UserPanel } from '../../components/usuarios/UserPanel';
import { relacionesLaboralesService } from '../../services/relacionesLaborales.service';
import type { RelacionLaboral } from '../../types/relacionLaboral.types';
import {
  TIPO_RELACION_LABELS,
  TIPO_RELACION_ICONS,
  TIPO_RELACION_COLORS,
  getRelacionesActivas as getRelacionesActivasHelper,
} from '../../types/relacionLaboral.types';
// chk5.PERSONAS-v5.7 · E4.3 · Wizard "Nuevo colaborador" 4 pasos canon v5.7
import { CrearUsuarioWizard } from '../../components/usuarios/CrearUsuarioWizard';
// chk5.PERSONAS-v5.7 · E4.4 · Borrador canon (banner de continuar/descartar)
import { borradorWizardService } from '../../services/borradorWizard.service';
import type { BorradorWizard } from '../../types/borradorWizard.types';
// chk5.PERSONAS-v5.7 · E5.1 · Modales operativos del UserPanel (Pausar · Reanudar · Finalizar · Editar)
import {
  PausarRelacionModal,
  ReanudarRelacionModal,
  FinalizarRelacionModal,
  EditarRelacionModal,
} from '../../components/usuarios/RelacionModals';
// chk5.PERSONAS-v5.7 · E5.2 · ReclasificarRelacionModal · transición atómica
import { ReclasificarRelacionModal } from '../../components/usuarios/ReclasificarRelacionModal';
// chk5.PERSONAS-v5.7 · E5.3 · AgregarRelacionWizard · 2 pasos · 2ª/Nª relación
import { AgregarRelacionWizard } from '../../components/usuarios/AgregarRelacionWizard';
import type { LucideIcon } from 'lucide-react';
import { PageShell } from '../../design-system';
import { userService } from '../../services/user.service';
import { useAuthStore } from '../../store/authStore';
import type { UserProfile, UserRole } from '../../types/auth.types';
import { ROLE_LABELS, hasRole, getRolPrincipal, getUserRoles, hasAnyRole } from '../../types/auth.types';
// chk5.PERSONAS-v5.3 · 2026-05-26 · F2 · 3 sub-tabs (Directorio + Accesos + Configuración)
// TabSocios y TabPlanilla ELIMINADOS · reemplazados por chips filtro + banners cross-link
import TabAccesos from '../../components/modules/usuarios/TabAccesos';
import TabConfiguracion from '../../components/modules/usuarios/TabConfiguracion';
import InvitarPorEmailModal from '../../components/modules/usuarios/InvitarPorEmailModal';
// chk5.PERSONAS-v5.7 · E4.1 · Ficha360Modal reemplazado por UserPanel canon F6-E
// El componente Ficha360Modal sigue exportado para retrocompatibilidad pero NO se
// invoca desde acá. Se elimina en E10 cuando todos los consumidores hayan migrado.
// import Ficha360Modal from './Ficha360/Ficha360Modal'; // @deprecated chk5.PERSONAS-v5.7
// chk5.F4-USERS · 2026-05-26 · Fase 5-BIS · 8 modales operativos canon FormModalV2
import NuevoUsuarioModal from '../../components/modules/usuarios/NuevoUsuarioModal';
import EditarUsuarioModal from '../../components/modules/usuarios/EditarUsuarioModal';
import AprobarUsuarioModal from '../../components/modules/usuarios/AprobarUsuarioModal';
import RechazarUsuarioModal from '../../components/modules/usuarios/RechazarUsuarioModal';
import ResetPasswordModal from '../../components/modules/usuarios/ResetPasswordModal';
import EliminarUsuarioModal from '../../components/modules/usuarios/EliminarUsuarioModal';
import DesconectarSesionModal from '../../components/modules/usuarios/DesconectarSesionModal';
import DesconectarTodasModal from '../../components/modules/usuarios/DesconectarTodasModal';

// chk5.PERSONAS-v5.3 · 2026-05-26 · F2 · 3 tabs (Directorio + Accesos + Configuración)
// 'directorio' reemplaza 'resumen' · 'socios' y 'planilla' eliminados (ahora son chips filtro)
type TabActiva = 'directorio' | 'accesos' | 'configuracion';

// Filtro de rol extendido: soporta valores agregados 'planilla' (todos los empleados)
// y 'otros' (invitados). Canon mockup usuarios-v5.3-hub.html (chips filtro).
type FiltroRol = UserRole | 'all' | 'planilla' | 'otros';

// Roles considerados "Planilla" (empleados con boleta de pago)
const ROLES_PLANILLA: UserRole[] = ['vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor', 'gerente'];

// chk5.F4-USERS · 2026-05-26 · ModalType final · 10 estados operativos canon
type ModalType =
  | 'none'
  | 'create'                  // canon ACTO 2.1 · NuevoUsuarioModal
  | 'edit-permisos'           // canon ACTO 3.1 · EditarUsuarioModal
  | 'delete-confirm'          // canon ACTO 5.5 · EliminarUsuarioModal
  | 'reset-password'          // canon ACTO 5.3 · ResetPasswordModal
  | 'disconnect-confirm'      // canon ACTO 5.4 · DesconectarSesionModal
  | 'disconnect-all-confirm'  // canon ACTO 5.6 · DesconectarTodasModal
  | 'approve-user'            // canon ACTO 5.1 · AprobarUsuarioModal
  | 'reject-user';            // canon ACTO 5.2 · RechazarUsuarioModal

export const Usuarios: React.FC = () => {
  const navigate = useNavigate();
  // ─── Estado del shell ─────────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [modalType, setModalType] = useState<ModalType>('none');
  const currentUser = useAuthStore(state => state.userProfile);

  // ─── Búsqueda y filtros ───────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<FiltroRol>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // ─── chk5.PERSONAS-v5.3 · F2 · navegación interna (3 tabs) ───────────
  const [tabActiva, setTabActiva] = useState<TabActiva>('directorio');
  const [invitarOpen, setInvitarOpen] = useState(false);
  // chk5.PERSONAS-v5.7 · E4.1 · UserPanel reemplaza Ficha360Modal como detalle canon
  // El state legacy fichaModalUid queda como fallback comentado · se elimina en E10.
  const [panelUid, setPanelUid] = useState<string | null>(null);
  // chk5.PERSONAS-v5.7 · E4.1 · cache de relaciones por uid · usado para chips
  // multi-relación en las cards y para multi-rol stats. Bulk fetch al cargar users.
  const [relacionesByUid, setRelacionesByUid] = useState<Record<string, RelacionLaboral[]>>({});
  // chk5.PERSONAS-v5.7 · E4.3 · Wizard "Nuevo colaborador" 4 pasos
  const [wizardOpen, setWizardOpen] = useState(false);
  // chk5.PERSONAS-v5.7 · E4.4 · Borrador del wizard (banner Continuar/Descartar)
  const [borradorColaborador, setBorradorColaborador] = useState<BorradorWizard | null>(null);
  // chk5.PERSONAS-v5.7 · E5.1 · Modales operativos de RelacionLaboral
  // Cada modal mantiene la relacion seleccionada · al cerrar la libera
  const [pausarRel, setPausarRel] = useState<RelacionLaboral | null>(null);
  const [reanudarRel, setReanudarRel] = useState<RelacionLaboral | null>(null);
  const [finalizarRel, setFinalizarRel] = useState<RelacionLaboral | null>(null);
  const [editarRel, setEditarRel] = useState<RelacionLaboral | null>(null);
  // chk5.PERSONAS-v5.7 · E5.2 · Reclasificar relación (atómico)
  const [reclasificarRel, setReclasificarRel] = useState<RelacionLaboral | null>(null);
  // chk5.PERSONAS-v5.7 · E5.3 · Agregar nueva relación a user existente · uid del user
  const [agregarRelUid, setAgregarRelUid] = useState<string | null>(null);

  /**
   * chk5.PERSONAS-v5.7 · E5.1 · Refresca el cache de relaciones de un usuario
   * después de una mutación (pausar/reanudar/finalizar/editar). Re-fetch
   * solo del usuario afectado · no del bulk completo.
   */
  const refrescarRelacionesUser = async (userId: string) => {
    try {
      const rels = await relacionesLaboralesService.listByUser(userId);
      setRelacionesByUid((prev) => ({ ...prev, [userId]: rels }));
    } catch (err) {
      console.warn('[Usuarios] error refrescando relaciones de user:', userId, err);
    }
  };
  // Cleanup chk5.F4-USERS · 2026-05-26 · state legacy (newUser · editPermisos ·
  // editRoles · editDatosLab/Soc · approveRole · newPassword · etc) eliminado ·
  // cada modal canon FormModalV2 maneja su propio estado internamente.

  const fetchUsuarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getAll();
      setUsuarios(data);
      // chk5.PERSONAS-v5.7 · E4.1 · bulk fetch de relaciones por user
      // No bloquea el render principal · se carga en background
      void fetchRelacionesBulk(data.map((u) => u.uid));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * chk5.PERSONAS-v5.7 · E4.1 · Carga relaciones de TODOS los users en paralelo
   * y construye el mapa { uid → RelacionLaboral[] } usado para chips multi-relación.
   * Sin bloqueo · permite que el shell renderice mientras se cargan.
   */
  const fetchRelacionesBulk = async (uids: string[]) => {
    if (uids.length === 0) return;
    const results = await Promise.allSettled(
      uids.map((uid) => relacionesesLaboralesPorUid(uid)),
    );
    const map: Record<string, RelacionLaboral[]> = {};
    results.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        map[uids[i]] = res.value;
      } else {
        map[uids[i]] = [];
      }
    });
    setRelacionesByUid(map);
  };

  /** Helper · wrapper para llamada · tipado seguro */
  const relacionesesLaboralesPorUid = async (uid: string): Promise<RelacionLaboral[]> => {
    try {
      return await relacionesLaboralesService.listByUser(uid);
    } catch {
      return [];
    }
  };

  useEffect(() => {
    fetchUsuarios();
    // chk5.PERSONAS-v5.7 · E4.4 · cargar borrador del wizard si existe
    if (currentUser?.uid) {
      void borradorWizardService
        .get(currentUser.uid, 'colaborador')
        .then(setBorradorColaborador)
        .catch(() => setBorradorColaborador(null));
    }
  }, [currentUser?.uid]);

  /**
   * chk5.PERSONAS-v5.7 · E4.4 · Refresca el state del borrador.
   * Usado al cerrar el wizard (pueden haber quedado cambios) o al descartar.
   */
  const refreshBorrador = async () => {
    if (!currentUser?.uid) return;
    try {
      const b = await borradorWizardService.get(currentUser.uid, 'colaborador');
      setBorradorColaborador(b);
    } catch {
      setBorradorColaborador(null);
    }
  };

  /**
   * chk5.PERSONAS-v5.7 · E4.4 · Descarta el borrador desde el banner sin abrir el wizard.
   */
  const handleDescartarBorrador = async () => {
    if (!currentUser?.uid) return;
    if (!confirm('¿Descartar el borrador del nuevo colaborador? Los datos se perderán.')) return;
    try {
      await borradorWizardService.delete(currentUser.uid, 'colaborador');
      setBorradorColaborador(null);
      setSuccess('Borrador descartado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descartar el borrador');
    }
  };

  // chk5.PERSONAS-v5.3 · F2 · deep-link reading: ?filterRole=socio activa chip
  // automáticamente al entrar desde /inversionistas o /planilla
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawFilter = params.get('filterRole');
    if (!rawFilter) return;
    const valid: FiltroRol[] = ['all', 'planilla', 'otros', 'admin', 'gerente', 'vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor', 'socio', 'invitado'];
    if (valid.includes(rawFilter as FiltroRol)) {
      setFilterRole(rawFilter as FiltroRol);
    }
  }, []);

  // Auto-hide success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS · solo apertura de modales (su lógica vive dentro de cada modal)
  // chk5.F4-USERS · 2026-05-26 · post-cleanup · ~250 líneas legacy eliminadas
  // ═══════════════════════════════════════════════════════════════════════

  const handleOpenEditPermisos = (usuario: UserProfile) => {
    setSelectedUser(usuario);
    setModalType('edit-permisos');
  };

  const handleOpenDeleteConfirm = (usuario: UserProfile) => {
    setSelectedUser(usuario);
    setModalType('delete-confirm');
  };

  const handleOpenResetPassword = (usuario: UserProfile) => {
    setSelectedUser(usuario);
    setModalType('reset-password');
  };

  const handleOpenDisconnect = (usuario: UserProfile) => {
    setSelectedUser(usuario);
    setModalType('disconnect-confirm');
  };

  const handleOpenApprove = (usuario: UserProfile) => {
    setSelectedUser(usuario);
    setModalType('approve-user');
  };

  const handleOpenReject = (usuario: UserProfile) => {
    setSelectedUser(usuario);
    setModalType('reject-user');
  };

  // chk5.PERSONAS-v5.4 · F10.D · Exportar usuarios a CSV canon header
  const handleExportarUsuarios = () => {
    if (usuarios.length === 0) {
      setError('No hay usuarios para exportar');
      return;
    }
    const headers = ['UID', 'Nombre', 'Email', 'Roles', 'Activo', 'Origen'];
    const rows = usuarios.map((u) => [
      u.uid,
      `"${(u.displayName ?? '').replace(/"/g, '""')}"`,
      u.email ?? '',
      `"${getUserRoles(u).join(', ')}"`,
      u.activo ? 'sí' : 'no',
      u.origen ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccess(`${usuarios.length} usuarios exportados a CSV`);
  };

  // Toggle simple activo/inactivo (sin modal · llama service directo)
  const handleToggleActivo = async (uid: string, activo: boolean) => {
    if (uid === currentUser?.uid) {
      setError('No puedes desactivar tu propia cuenta');
      return;
    }
    try {
      await userService.setActivo(uid, activo);
      await fetchUsuarios();
      setSuccess(activo ? 'Usuario activado' : 'Usuario desactivado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al togglear');
    }
  };

  // Filtrar usuarios (con validación segura)
  // chk5.PERSONAS-v5.3 · F2 · filtro extendido para soportar 'planilla' (agregado)
  // y 'otros' (invitados) además de UserRole individual.
  const filteredUsuarios = useMemo(() => {
    const usuariosArr = Array.isArray(usuarios) ? usuarios : [];
    const term = searchTerm.toLowerCase();
    return usuariosArr.filter(usuario => {
      // Filtro de búsqueda
      const displayName = (usuario.displayName ?? '').toLowerCase();
      const email = (usuario.email ?? '').toLowerCase();
      const matchesSearch = searchTerm === '' ||
        displayName.includes(term) ||
        email.includes(term);

      // Filtro de rol · usa hasRole para multi-rol-aware
      let matchesRole = false;
      if (filterRole === 'all') {
        matchesRole = true;
      } else if (filterRole === 'planilla') {
        // Agregado: cualquiera con un rol de empleado (canon mockup chip "Planilla")
        matchesRole = ROLES_PLANILLA.some((r) => hasRole(usuario, r));
      } else if (filterRole === 'otros') {
        matchesRole = hasRole(usuario, 'invitado');
      } else {
        matchesRole = hasRole(usuario, filterRole);
      }

      // Filtro de estado
      const matchesStatus = filterStatus === 'all' ||
        (filterStatus === 'active' && usuario.activo) ||
        (filterStatus === 'inactive' && !usuario.activo);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [usuarios, searchTerm, filterRole, filterStatus]);

  const roleBadgeColor: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-800',
    gerente: 'bg-indigo-100 text-indigo-800',
    vendedor: 'bg-sky-100 text-sky-800',
    comprador: 'bg-amber-100 text-amber-800',
    almacenero: 'bg-orange-100 text-orange-800',
    finanzas: 'bg-teal-100 text-teal-800',
    supervisor: 'bg-slate-100 text-slate-700',
    invitado: 'bg-slate-100 text-slate-600',
    socio: 'bg-violet-100 text-violet-800',
  };

  // chk5.F3-FIX-USUARIOS · iconos lucide por rol (chips de roles con icono pequeño)
  const ROLE_ICON: Record<UserRole, LucideIcon> = {
    admin: Shield,
    gerente: UserCheck,
    vendedor: Briefcase,
    comprador: ShoppingCart,
    almacenero: Package,
    finanzas: Wallet,
    supervisor: Eye,
    invitado: UserIcon,
    socio: Landmark,
  };

  // chk5.F3-FIX-USUARIOS · gradient color del avatar circular por rol principal
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

  // Estadísticas
  const pendientes = useMemo(() =>
    usuarios.filter(u => !u.activo && hasRole(u, 'invitado')),
    [usuarios]
  );
  const stats = {
    total: usuarios.length,
    activos: usuarios.filter(u => u.activo).length,
    inactivos: usuarios.filter(u => !u.activo).length,
    pendientes: pendientes.length,
  };

  // Conteo por rol (dinámico)
  const roleStats = useMemo(() => {
    const counts: Partial<Record<UserRole, number>> = {};
    const allRoles: UserRole[] = ['admin', 'gerente', 'vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor', 'invitado', 'socio'];
    allRoles.forEach(role => {
      const count = usuarios.filter(u => hasRole(u, role)).length;
      if (count > 0) counts[role] = count;
    });
    return counts;
  }, [usuarios]);

  // chk5.PERSONAS-v5.3 · F2 · conteos agregados para chips canon (Planilla=empleados · Otros=invitados)
  // IMPORTANTE: este useMemo debe estar ANTES del early return `if (loading)` para no
  // violar la regla de orden de hooks de React.
  const planillaCount = useMemo(
    () => usuarios.filter((u) => ROLES_PLANILLA.some((r) => hasRole(u, r))).length,
    [usuarios]
  );

  // Agrupar permisos
  const permisosAgrupados = userService.getPermisosAgrupados();

  // chk5.PERSONAS-v5.7 · E4.2 · Stats por TIPO DE RELACIÓN (modelo v5.6)
  // Cuenta users que tienen al menos 1 relación vigente del tipo X.
  // Un user puede contar en múltiples (empleado + socio).
  // IMPORTANTE · debe estar ANTES del early return `if (loading)` · misma regla
  // que el resto de useMemo del componente (canon React hooks order · evita
  // "Rendered more hooks than during the previous render").
  const relacionStats = useMemo(() => {
    const counts = { empleado: 0, honorarios: 0, socio: 0, externo: 0, multiRelacion: 0 };
    Object.values(relacionesByUid).forEach((rels) => {
      const vigentes = rels.filter((r) => r.estado !== 'finalizada');
      const tipos = new Set(vigentes.map((r) => r.tipo));
      if (tipos.has('empleado')) counts.empleado++;
      if (tipos.has('honorarios')) counts.honorarios++;
      if (tipos.has('socio')) counts.socio++;
      if (tipos.has('externo')) counts.externo++;
      if (vigentes.length > 1) counts.multiRelacion++;
    });
    return counts;
  }, [relacionesByUid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // chk5.F3-FIX · KPIs canon v5.2 · TOTAL · ACTIVOS · SOCIOS · MULTI-ROL
  const sociosCount = roleStats['socio'] ?? 0;
  const multiRolCount = usuarios.filter((u) => getUserRoles(u).length > 1).length;
  const otrosCount = roleStats['invitado'] ?? 0;

  // chk5.PERSONAS-v5.7 · E4.2 · Indica si ya hay data de relaciones cargada
  // (para mostrar "—" en KPIs mientras cargan en background)
  // No es hook · es derivada simple · puede vivir después del early return.
  const relacionesCargadas = Object.keys(relacionesByUid).length > 0;

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          {/* §A · BREADCRUMB canon S9.D1 · 3 niveles · Inicio › Administración › Usuarios */}
          <div className="border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-3 bg-slate-50">
            <div className="flex items-center text-[12px] flex-1 min-w-0">
              <a className="text-slate-500 hover:text-purple-700 cursor-pointer flex-shrink-0">Inicio</a>
              <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
              <span className="text-slate-500 flex-shrink-0">Administración</span>
              <ChevronRight className="w-3 h-3 text-slate-300 mx-1.5 flex-shrink-0" />
              <span className="text-slate-900 font-semibold truncate">Usuarios</span>
            </div>
          </div>

          {/* §B · HEADER canon mockup usuarios-v5.3-hub.html línea 67-81
              Icon chip plano · h1 text-[20px] · subtítulo canon · 3 acciones (Exportar · Invitar · Nuevo) */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-[260px]">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[20px] font-bold text-slate-900">Usuarios</h1>
                  <p className="text-[12px] text-slate-500 leading-snug">
                    Directorio central de personas · roles · accesos · configuración del sistema
                  </p>
                </div>
              </div>
              {/* Acciones canon mockup · Exportar (neutral) · Invitar email (indigo) · Nuevo usuario (purple primary) */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={handleExportarUsuarios}
                  aria-label="Exportar usuarios a CSV"
                  title="Exportar usuarios a CSV"
                  className="text-[12px] font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exportar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInvitarOpen(true)}
                  className="text-[12px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  title="Invitar por email · canon mockup ACTO 2.2"
                >
                  <MailPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Invitar por email</span>
                </button>
                {/* chk5.PERSONAS-v5.8 · E5 · Botón "Nuevo colaborador" removido del header.
                    El alta ahora nace desde cada módulo:
                      - Empleados → /planilla "+ Nuevo empleado"
                      - Socios    → /inversionistas "+ Nuevo socio"
                    El wizard general (CrearUsuarioWizard) sigue disponible
                    pero solo se abre desde el banner de borrador legacy. */}
              </div>
            </div>
          </div>

          {/* §B-bis · TABS internas · canon mockup usuarios-v5.3-hub.html línea 83-96
              3 sub-tabs: Resumen · Accesos & seguridad · Configuración · scroll-x mobile N6 */}
          <div className="border-b border-slate-200 px-3 sm:px-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="flex gap-1 whitespace-nowrap">
              {([
                { id: 'directorio' as TabActiva, label: 'Resumen', Icon: LayoutDashboard, badge: null },
                { id: 'accesos' as TabActiva, label: 'Accesos & seguridad', Icon: ShieldCheck, badge: null },
                { id: 'configuracion' as TabActiva, label: 'Configuración', Icon: SettingsIcon, badge: null },
              ]).map(({ id, label, Icon, badge }) => {
                const isActive = tabActiva === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTabActiva(id)}
                    className={`px-3 sm:px-4 py-2.5 text-[12px] font-${isActive ? 'bold' : 'medium'} border-b-2 transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'border-purple-600 text-purple-700'
                        : 'border-transparent text-slate-600 hover:text-purple-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                    {badge !== null && (
                      <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB · RESUMEN · banner pendientes + KPIs + chips filtro + listado */}
          {/* Canon mockup usuarios-v5.3-hub.html línea 97-135                  */}
          {/* ════════════════════════════════════════════════════════════ */}
          {tabActiva === 'directorio' && (<>

          {/* §C · BANNER pendientes · canon mockup línea 98-106 · ARRIBA del KPI strip */}
          {stats.pendientes > 0 && (
            <div className="mx-4 sm:mx-6 mt-5 bg-gradient-to-r from-amber-50 to-orange-50 ring-1 ring-amber-300 rounded-xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-amber-900 mb-0.5">
                  {stats.pendientes} usuario{stats.pendientes > 1 ? 's' : ''} esperan aprobación
                </div>
                <div className="text-[11px] text-amber-800 truncate">
                  {pendientes.map((u) => u.displayName || u.email).join(' · ')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setFilterStatus('inactive'); setFilterRole('invitado'); }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap flex-shrink-0"
              >
                Ver pendientes →
              </button>
            </div>
          )}

          {/* §D · KPI STRIP canon N1+N2 · 5 cards mockup línea 109-135
              (Total · Activos · Pendientes · Socios · Multi-rol) */}
          <div className="px-4 sm:px-6 mt-5 grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/40 ring-1 ring-purple-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-purple-700 font-bold">TOTAL</span>
                <Users className="w-3.5 h-3.5 text-purple-700" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-purple-900">{stats.total}</div>
              <div className="text-[10px] text-purple-700 truncate">
                {stats.activos} activos · {stats.inactivos} inactivos
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">ACTIVOS</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-emerald-900">{stats.activos}</div>
              <div className="text-[10px] text-emerald-700 truncate">
                {stats.total > 0 ? `${Math.round((stats.activos / stats.total) * 100)}% del total` : '—'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">PENDIENTES</span>
                <Clock className="w-3.5 h-3.5 text-amber-700" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-amber-900">{stats.pendientes}</div>
              <div className="text-[10px] text-amber-700 truncate">
                {stats.pendientes > 0 ? 'requieren aprobación' : 'sin pendientes'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">SOCIOS</span>
                <Briefcase className="w-3.5 h-3.5 text-violet-700" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-violet-900">{sociosCount}</div>
              <div className="text-[10px] text-violet-700 truncate">
                {sociosCount > 0 ? 'cap table activa' : 'ningún user es socio'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 ring-1 ring-indigo-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">MULTI-ROL</span>
                <Key className="w-3.5 h-3.5 text-indigo-700" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-indigo-900">{multiRolCount}</div>
              <div className="text-[10px] text-indigo-700 truncate">
                {multiRolCount > 0 ? '2+ roles asignados' : 'todos con 1 rol'}
              </div>
            </div>
          </div>

          {/* §D-bis · chk5.PERSONAS-v5.7 · E4.2 · KPI strip POR TIPO DE RELACIÓN
              Modelo v5.6 · counts derivados de relacionesByUid (bulk fetch).
              Color semántico canon N1: teal=empleado · sky=honorarios · purple=socio · amber=externo.
              "—" mientras cargan en background. */}
          <div className="px-4 sm:px-6 mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-teal-50 to-teal-100/40 ring-1 ring-teal-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-teal-700 font-bold">EMPLEADOS</span>
                <Briefcase className="w-3.5 h-3.5 text-teal-700" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-teal-900">
                {relacionesCargadas ? relacionStats.empleado : '—'}
              </div>
              <div className="text-[10px] text-teal-700 truncate">en planilla</div>
            </div>
            <div className="bg-gradient-to-br from-sky-50 to-sky-100/40 ring-1 ring-sky-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-sky-700 font-bold">HONORARIOS</span>
                <BriefcaseBusiness className="w-3.5 h-3.5 text-sky-700" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-sky-900">
                {relacionesCargadas ? relacionStats.honorarios : '—'}
              </div>
              <div className="text-[10px] text-sky-700 truncate">RxH 4ta cat.</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/40 ring-1 ring-purple-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-purple-700 font-bold">SOCIOS</span>
                <Landmark className="w-3.5 h-3.5 text-purple-700" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-purple-900">
                {relacionesCargadas ? relacionStats.socio : '—'}
              </div>
              <div className="text-[10px] text-purple-700 truncate">cap table</div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold">EXTERNOS</span>
                <UserIcon className="w-3.5 h-3.5 text-amber-700" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-amber-900">
                {relacionesCargadas ? relacionStats.externo : '—'}
              </div>
              <div className="text-[10px] text-amber-700 truncate">contactos · VIP</div>
            </div>
            <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 ring-1 ring-rose-200/50 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">MULTI-RELACIÓN</span>
                <Key className="w-3.5 h-3.5 text-rose-700" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-rose-900">
                {relacionesCargadas ? relacionStats.multiRelacion : '—'}
              </div>
              <div className="text-[10px] text-rose-700 truncate">
                {relacionStats.multiRelacion > 0 ? 'tipos simultáneos' : 'sin multi'}
              </div>
            </div>
          </div>

          {/* chk5.PERSONAS-v5.7 · E4.4 · BANNER BORRADOR del wizard (legacy)
              chk5.PERSONAS-v5.8 · E5 · El wizard CrearUsuarioWizard está @deprecated.
              El banner solo ofrece "Descartar" · no se puede continuar el wizard desde aquí.
              Para crear empleados → /planilla. Para socios → /inversionistas. */}
          {borradorColaborador && !wizardOpen && (
            <div className="mx-4 sm:mx-6 mt-3 bg-amber-50 ring-1 ring-amber-300 rounded-xl p-3 flex items-center gap-3 flex-wrap">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-amber-700" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-bold text-amber-900">
                  Borrador de colaborador pendiente
                </div>
                <div className="text-xs text-amber-800">
                  {borradorColaborador.resumen || 'Sin nombre'} · Para empleados usa Planilla · para socios usa Inversionistas.
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDescartarBorrador}
                  className="text-[11px] font-medium text-amber-700 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                  title="Descartar borrador"
                >
                  <Trash2 className="w-3 h-3" />
                  Descartar
                </button>
              </div>
            </div>
          )}

          {/* §E · MENSAJES error/success */}
          {error && (
            <div className="bg-rose-50 border-b border-rose-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2 text-[12px] text-rose-700">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2 text-[12px] text-emerald-700">
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* §F · BÚSQUEDA + FILTROS canon · chips multi-rol */}
          <div className="px-4 sm:px-6 py-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar por nombre · email · DNI"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent border-none text-[12px] focus:outline-none"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Solo activos</option>
                <option value="inactive">Solo inactivos</option>
              </select>
              {(searchTerm || filterRole !== 'all' || filterStatus !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterRole('all');
                    setFilterStatus('all');
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-900 underline"
                >
                  Limpiar
                </button>
              )}
            </div>
            {/* Chips de rol · scroll-x mobile · canon N6 · chk5.PERSONAS-v5.3 F2 ·
                incluye chips agregados Socio + Planilla + Otros (mockup canon) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex-shrink-0">Rol:</span>
              <button
                onClick={() => setFilterRole('all')}
                className={`text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap transition-colors ${
                  filterRole === 'all' ? 'bg-purple-100 text-purple-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Todos · {stats.total}
              </button>
              {/* Chip agregado: Socio (violet) · cross-link → /inversionistas */}
              <button
                onClick={() => setFilterRole('socio')}
                className={`text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                  filterRole === 'socio' ? 'bg-violet-100 text-violet-800 ring-2 ring-violet-300' : 'bg-white border border-violet-200 text-violet-700 hover:bg-violet-50'
                }`}
              >
                <Landmark className="w-2.5 h-2.5" />
                Socio
                {sociosCount > 0 && (
                  <span className={`text-[9px] ${filterRole === 'socio' ? 'bg-white/70' : 'bg-violet-50'} px-1 rounded`}>{sociosCount}</span>
                )}
              </button>
              {/* Chip agregado: Planilla (sky) · cross-link → /planilla */}
              <button
                onClick={() => setFilterRole('planilla')}
                className={`text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                  filterRole === 'planilla' ? 'bg-sky-100 text-sky-800 ring-2 ring-sky-300' : 'bg-white border border-sky-200 text-sky-700 hover:bg-sky-50'
                }`}
              >
                <BriefcaseBusiness className="w-2.5 h-2.5" />
                Planilla
                {planillaCount > 0 && (
                  <span className={`text-[9px] ${filterRole === 'planilla' ? 'bg-white/70' : 'bg-sky-50'} px-1 rounded`}>{planillaCount}</span>
                )}
              </button>
              {/* Chips individuales por rol específico · todos los UserRole con count > 0 */}
              {(['admin', 'gerente', 'vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor'] as UserRole[]).map((r) => {
                const count = roleStats[r] ?? 0;
                if (count === 0 && filterRole !== r) return null;
                const isActive = filterRole === r;
                return (
                  <button
                    key={r}
                    onClick={() => setFilterRole(r)}
                    className={`text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                      isActive ? roleBadgeColor[r] : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {ROLE_LABELS[r]}
                    {count > 0 && (
                      <span className={`text-[9px] ${isActive ? 'bg-white/70' : 'bg-slate-100'} px-1 rounded`}>{count}</span>
                    )}
                  </button>
                );
              })}
              {/* Chip agregado: Otros (invitados) */}
              {(otrosCount > 0 || filterRole === 'otros') && (
                <button
                  onClick={() => setFilterRole('otros')}
                  className={`text-[10px] px-2 py-1 rounded font-bold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                    filterRole === 'otros' ? 'bg-slate-200 text-slate-800' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Otros
                  {otrosCount > 0 && (
                    <span className={`text-[9px] ${filterRole === 'otros' ? 'bg-white/70' : 'bg-slate-100'} px-1 rounded`}>{otrosCount}</span>
                  )}
                </button>
              )}
            </div>
            <div className="text-[10px] text-slate-500">
              Mostrando <strong>{filteredUsuarios.length}</strong> de {usuarios.length} usuarios
            </div>
          </div>

          {/* §F-bis · BANNER CROSS-LINK DINÁMICO · canon F2 v5.3 · mockup usuarios-v5.3-hub.html
              Aparece solo cuando filterRole = 'socio' o 'planilla' · pixel-perfect copy-paste literal */}
          {filterRole === 'socio' && (
            <div className="mx-4 sm:mx-6 mt-3 bg-gradient-to-r from-violet-50 to-purple-50 ring-1 ring-violet-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Landmark className="w-5 h-5 text-violet-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-slate-900 mb-0.5">
                  Estás filtrando {sociosCount} socio{sociosCount === 1 ? '' : 's'} del negocio
                </div>
                <div className="text-[11px] text-slate-600">
                  Para ver cap table completa · ROI · trayectoria histórica · distribución de utilidades · usá el módulo dedicado.
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/inversionistas')}
                className="bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 flex-shrink-0"
              >
                <span className="hidden sm:inline">Ver Inversionistas</span>
                <span className="sm:hidden">Inversionistas</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
          {filterRole === 'planilla' && (
            <div className="mx-4 sm:mx-6 mt-3 bg-gradient-to-r from-sky-50 to-cyan-50 ring-1 ring-sky-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <BriefcaseBusiness className="w-5 h-5 text-sky-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-slate-900 mb-0.5">
                  Estás filtrando {planillaCount} persona{planillaCount === 1 ? '' : 's'} en planilla
                </div>
                <div className="text-[11px] text-slate-600">
                  Para boletas mensuales · adelantos · vacaciones · gratificaciones · incentivos · reportes payroll · usá el módulo dedicado.
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/planilla')}
                className="bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 flex-shrink-0"
              >
                <span className="hidden sm:inline">Ver Planilla</span>
                <span className="sm:hidden">Planilla</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

      {/* §G · LISTADO DE USUARIOS · cards apiladas canon F4 v7.0 · mockup A1 pixel-perfect */}
      <div className="divide-y divide-slate-100">
        {filteredUsuarios.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="text-[14px] font-medium">No se encontraron usuarios</p>
            <p className="text-[12px]">Intenta ajustar los filtros de búsqueda</p>
          </div>
        ) : (
          filteredUsuarios.map((u) => {
            const rolesU = getUserRoles(u);
            const inactive = !u.activo;
            const isSelf = u.uid === currentUser?.uid;
            const isInvitadoPending = inactive && hasRole(u, 'invitado');
            // Iniciales para avatar
            const iniciales = (u.displayName || u.email)
              .split(' ')
              .slice(0, 2)
              .map((n) => n[0]?.toUpperCase() ?? '')
              .join('') || 'U';
            // Avatar gradient color · derivado del rol principal
            const rolP = getRolPrincipal(u) ?? 'invitado';
            const avatarGradient = ROLE_AVATAR_GRADIENT[rolP] ?? 'from-slate-400 to-slate-600';

            return (
              <div
                key={u.uid}
                className={`px-4 sm:px-6 py-3 sm:py-4 hover:bg-slate-50/50 ${inactive ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start gap-3 sm:gap-4 flex-wrap">
                  {/* Avatar circular grande con gradient */}
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-bold text-[14px] sm:text-[16px] flex-shrink-0`}>
                    {u.photoURL ? <img src={u.photoURL} alt={u.displayName} className="w-full h-full rounded-full" /> : iniciales}
                  </div>

                  {/* Bloque info principal */}
                  <div className="flex-1 min-w-[200px]">
                    {/* Nombre + chips estado */}
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <div className="text-[14px] sm:text-[15px] font-bold text-slate-900">
                        {u.displayName}
                        {isSelf && <span className="ml-1.5 text-[10px] text-purple-700 font-semibold">(tú)</span>}
                      </div>
                      {u.activo ? (
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">activo</span>
                      ) : (
                        <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">inactivo</span>
                      )}
                      {/* Indicador silent partner: socio sin DNI = típico silent partner */}
                      {hasRole(u, 'socio') && !u.activo && (
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1">
                          <Moon className="w-2.5 h-2.5" /> silent partner
                        </span>
                      )}
                    </div>

                    {/* Email + DNI */}
                    <div className="text-[11px] sm:text-[12px] text-slate-500 truncate">
                      {u.email}
                      {/* Si tuviéramos campo dni en el UserProfile sería: u.dni ? ` · DNI ${u.dni}` : ' · sin DNI registrado' */}
                    </div>

                    {/* Chips de roles con iconos */}
                    <div className="flex items-center gap-1 flex-wrap mt-1.5">
                      {rolesU.length === 0 ? (
                        <span className="text-[10px] text-rose-700 font-semibold">⚠ Sin roles asignados</span>
                      ) : (
                        rolesU.map((r) => {
                          const Icon = ROLE_ICON[r];
                          return (
                            <span
                              key={r}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${roleBadgeColor[r]}`}
                            >
                              <Icon className="w-2.5 h-2.5" />
                              {ROLE_LABELS[r]}
                            </span>
                          );
                        })
                      )}
                    </div>

                    {/* chk5.PERSONAS-v5.7 · E4.2 · Chips multi-relación
                        (modelo v5.6 · color semántico canon N1)
                        Solo se muestra si el user tiene al menos 1 relación vigente.
                        Si tiene >1 · se muestra badge MULTI rose adicional. */}
                    {(() => {
                      const rels = relacionesByUid[u.uid] || [];
                      const vigentes = getRelacionesActivasHelper(rels);
                      if (vigentes.length === 0) return null;
                      return (
                        <div className="flex items-center gap-1 flex-wrap mt-1.5">
                          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 mr-0.5">
                            Relaciones:
                          </span>
                          {vigentes.length > 1 && (
                            <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-bold inline-flex items-center gap-0.5">
                              🔀 MULTI
                            </span>
                          )}
                          {vigentes.map((r) => {
                            const colors = TIPO_RELACION_COLORS[r.tipo];
                            return (
                              <span
                                key={r.id}
                                className={`text-[10px] ${colors.bg} ${colors.text} px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1`}
                                title={r.cargoDisplay ?? TIPO_RELACION_LABELS[r.tipo]}
                              >
                                <span>{TIPO_RELACION_ICONS[r.tipo]}</span>
                                <span className="truncate max-w-[160px]">
                                  {r.cargoDisplay ?? TIPO_RELACION_LABELS[r.tipo]}
                                </span>
                                {r.estado === 'pausada' && <span className="opacity-60">⏸</span>}
                                {r.estado === 'prueba' && <span className="opacity-60">🧪</span>}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Acciones derecha */}
                  <div className="flex items-center gap-1 flex-shrink-0 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {isInvitadoPending && (
                      <>
                        <button
                          onClick={() => handleOpenApprove(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded"
                          title="Aprobar usuario (canon ACTO 5.1)"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleOpenReject(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded"
                          title="Rechazar usuario (canon ACTO 5.2 · typed-confirm + motivo)"
                        >
                          <UserX className="w-3 h-3" />
                          Rechazar
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setPanelUid(u.uid)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded"
                      title="Ver perfil 360 (UserPanel canon F6-E · v5.7)"
                    >
                      <Eye className="w-3 h-3" />
                      <span className="hidden sm:inline">Ver perfil</span>
                    </button>
                    <button
                      onClick={() => handleOpenEditPermisos(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                      title="Editar usuario"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                    {/* Menú "..." para acciones secundarias */}
                    <details className="relative">
                      <summary className="cursor-pointer list-none p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded" title="Más acciones">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </summary>
                      <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                        <button
                          onClick={() => handleOpenDisconnect(u)}
                          disabled={isSelf}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                          <LogOut className="w-3 h-3 text-amber-600" /> Desconectar sesión
                        </button>
                        <button
                          onClick={() => handleOpenResetPassword(u)}
                          disabled={isSelf}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                          <Key className="w-3 h-3 text-amber-600" /> Reset password
                        </button>
                        <div className="border-t border-slate-100 my-1"></div>
                        <button
                          onClick={() => handleToggleActivo(u.uid, !u.activo)}
                          disabled={isSelf}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                          {u.activo ? <><UserX className="w-3 h-3 text-rose-600" /> Desactivar</> : <><UserCheck className="w-3 h-3 text-emerald-600" /> Activar</>}
                        </button>
                        <button
                          onClick={() => handleOpenDeleteConfirm(u)}
                          disabled={isSelf}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" /> Eliminar usuario
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

          {/* Cierra TAB · DIRECTORIO */}
          </>)}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB · ACCESOS · seguridad + cross-link a /auditoria             */}
          {/* ════════════════════════════════════════════════════════════ */}
          {tabActiva === 'accesos' && (
            <div className="px-4 sm:px-6 py-4">
              <TabAccesos onRequestDisconnectAll={() => setModalType('disconnect-all-confirm')} />
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB · CONFIGURACIÓN · 5 secciones (política · password · ...)   */}
          {/* ════════════════════════════════════════════════════════════ */}
          {tabActiva === 'configuracion' && (
            <div className="px-4 sm:px-6 py-4">
              <TabConfiguracion />
            </div>
          )}

          {/* Cierra el shell card canon */}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
           chk5.F4-USERS · 2026-05-26 · Fase 5-BIS · 8 MODALES CANON FormModalV2
           Reemplazo del JSX legacy · cada modal es un componente propio en
           components/modules/usuarios/ · canon ACTO 2.1/3.1/5.1-5.6 v2.
           ════════════════════════════════════════════════════════════════ */}

      {/* 2.1 · Nuevo usuario directo */}
      <NuevoUsuarioModal
        isOpen={modalType === 'create'}
        onClose={() => setModalType('none')}
        onSuccess={(msg) => { setSuccess(msg); fetchUsuarios(); }}
        onError={setError}
      />

      {/* 3.1 · Editar usuario (Camino 3 híbrido) */}
      <EditarUsuarioModal
        isOpen={modalType === 'edit-permisos' && !!selectedUser}
        onClose={() => setModalType('none')}
        user={selectedUser}
        onSuccess={(msg) => { setSuccess(msg); fetchUsuarios(); }}
        onError={setError}
        onRequestDelete={(u) => { setSelectedUser(u); setModalType('delete-confirm'); }}
      />

      {/* 5.1 · Aprobar usuario · multi-rol enriquecido */}
      <AprobarUsuarioModal
        isOpen={modalType === 'approve-user' && !!selectedUser}
        onClose={() => setModalType('none')}
        user={selectedUser}
        onSuccess={(msg) => { setSuccess(msg); fetchUsuarios(); }}
        onError={setError}
      />

      {/* 5.2 · Rechazar usuario · typed-confirm + motivo */}
      <RechazarUsuarioModal
        isOpen={modalType === 'reject-user' && !!selectedUser}
        onClose={() => setModalType('none')}
        user={selectedUser}
        onSuccess={(msg) => { setSuccess(msg); fetchUsuarios(); }}
        onError={setError}
      />

      {/* 5.3 · Reset password manual */}
      <ResetPasswordModal
        isOpen={modalType === 'reset-password' && !!selectedUser}
        onClose={() => setModalType('none')}
        user={selectedUser}
        onSuccess={setSuccess}
        onError={setError}
      />

      {/* 5.4 · Desconectar todas las sesiones del usuario */}
      <DesconectarSesionModal
        isOpen={modalType === 'disconnect-confirm' && !!selectedUser}
        onClose={() => setModalType('none')}
        user={selectedUser}
        onSuccess={setSuccess}
        onError={setError}
      />

      {/* 5.5 · Eliminar usuario · typed-confirm email */}
      <EliminarUsuarioModal
        isOpen={modalType === 'delete-confirm' && !!selectedUser}
        onClose={() => setModalType('none')}
        user={selectedUser}
        onSuccess={(msg) => { setSuccess(msg); fetchUsuarios(); }}
        onError={setError}
      />

      {/* 5.6 · Desconectar TODAS las sesiones del SISTEMA · emergencia */}
      <DesconectarTodasModal
        isOpen={modalType === 'disconnect-all-confirm'}
        onClose={() => setModalType('none')}
        onSuccess={setSuccess}
        onError={setError}
      />

      {/* chk5.PERSONAS-v5.3 · F2 · 2026-05-26 · Bloque legacy "Info sobre roles"
          ELIMINADO. Estaba fuera del shell card (rendering huérfano post-modales).
          La información de permisos por rol ya vive en tab Configuración. */}

      {/* chk5.F4-USERS · Modal "Invitar por email" (canon ACTO 2.2 mockup integral) */}
      <InvitarPorEmailModal
        isOpen={invitarOpen}
        onClose={() => setInvitarOpen(false)}
        onSuccess={() => {
          setSuccess('Invitación enviada · ver tracking en Configuración → Invitaciones');
          fetchUsuarios();
        }}
      />

      {/* chk5.PERSONAS-v5.7 · E4.3 · Wizard "Nuevo colaborador" 4 pasos
          Reemplaza al NuevoUsuarioModal viejo (queda @deprecated · cleanup E10).
          Submit crea UserProfile + RelacionLaboral inicial atómicamente.
          onSuccess auto-abre el UserPanel del user recién creado. */}
      <CrearUsuarioWizard
        isOpen={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          // chk5.PERSONAS-v5.7 · E4.4 · refresca el state del borrador al cerrar
          // (puede que el user haya editado y ahora exista borrador donde antes no había)
          void refreshBorrador();
        }}
        onSuccess={(uid) => {
          setWizardOpen(false);
          setBorradorColaborador(null); // borrador eliminado en el submit
          setSuccess(`Colaborador creado correctamente · abriendo perfil...`);
          // Auto-abre el UserPanel del recién creado
          setPanelUid(uid);
          // Refrescar lista en background
          void fetchUsuarios();
        }}
        onError={setError}
      />

      {/* chk5.PERSONAS-v5.7 · E4.1 · UserPanel canon F6-E (reemplaza Ficha360Modal)
          Drawer lateral con 5+1 tabs (Resumen · Relaciones · Datos · Permisos ·
          Histórico · Vinculación condicional).
          E5.1 · callbacks de Pausar/Reanudar/Finalizar/Editar conectados a modales.
          E5.2 conectará Reclasificar (atómico). E5.3 conectará Agregar (wizard 2 pasos). */}
      <UserPanel
        userId={panelUid}
        onClose={() => setPanelUid(null)}
        onPausarRelacion={setPausarRel}
        onReanudarRelacion={setReanudarRel}
        onFinalizarRelacion={setFinalizarRel}
        onEditarRelacion={setEditarRel}
        onReclasificarRelacion={setReclasificarRel}
        onAgregarRelacion={setAgregarRelUid}
      />

      {/* chk5.PERSONAS-v5.7 · E5.1 · 4 modales operativos del UserPanel
          Cada modal recibe la RelacionLaboral seleccionada + callbacks de
          success/error. Al cerrarse libera el state · al success refresca
          el cache del user afectado. */}
      <PausarRelacionModal
        isOpen={pausarRel !== null}
        relacion={pausarRel}
        onClose={() => setPausarRel(null)}
        onSuccess={(msg) => {
          setSuccess(msg);
          if (pausarRel?.userId) void refrescarRelacionesUser(pausarRel.userId);
        }}
        onError={setError}
      />
      <ReanudarRelacionModal
        isOpen={reanudarRel !== null}
        relacion={reanudarRel}
        onClose={() => setReanudarRel(null)}
        onSuccess={(msg) => {
          setSuccess(msg);
          if (reanudarRel?.userId) void refrescarRelacionesUser(reanudarRel.userId);
        }}
        onError={setError}
      />
      <FinalizarRelacionModal
        isOpen={finalizarRel !== null}
        relacion={finalizarRel}
        onClose={() => setFinalizarRel(null)}
        onSuccess={(msg) => {
          setSuccess(msg);
          if (finalizarRel?.userId) void refrescarRelacionesUser(finalizarRel.userId);
        }}
        onError={setError}
      />
      <EditarRelacionModal
        isOpen={editarRel !== null}
        relacion={editarRel}
        onClose={() => setEditarRel(null)}
        onSuccess={(msg) => {
          setSuccess(msg);
          if (editarRel?.userId) void refrescarRelacionesUser(editarRel.userId);
        }}
        onError={setError}
      />

      {/* chk5.PERSONAS-v5.7 · E5.2 · ReclasificarRelacionModal · transición atómica
          Cierra A (motivoFin=reclasificacion) + crea B con relacionAnteriorId.
          Usa relacionesLaboralesService.reclasificar() con writeBatch (canon E1). */}
      <ReclasificarRelacionModal
        isOpen={reclasificarRel !== null}
        relacion={reclasificarRel}
        onClose={() => setReclasificarRel(null)}
        onSuccess={(msg) => {
          setSuccess(msg);
          if (reclasificarRel?.userId) void refrescarRelacionesUser(reclasificarRel.userId);
        }}
        onError={setError}
      />

      {/* chk5.PERSONAS-v5.7 · E5.3 · AgregarRelacionWizard · 2 pasos canon v5.6
          Permite agregar 2ª/Nª relación a un user existente (multi-relación).
          Tipos ya vigentes se deshabilitan · 1 vigente por tipo. */}
      <AgregarRelacionWizard
        isOpen={agregarRelUid !== null}
        userId={agregarRelUid}
        userDisplayName={
          agregarRelUid
            ? usuarios.find((u) => u.uid === agregarRelUid)?.displayName ?? undefined
            : undefined
        }
        relacionesVigentes={agregarRelUid ? (relacionesByUid[agregarRelUid] ?? []) : []}
        onClose={() => setAgregarRelUid(null)}
        onSuccess={(msg) => {
          setSuccess(msg);
          if (agregarRelUid) void refrescarRelacionesUser(agregarRelUid);
        }}
        onError={setError}
      />
    </PageShell>
  );
};
