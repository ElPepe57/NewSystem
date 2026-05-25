import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Shield, UserCheck, UserX, RefreshCw, Plus, Edit2, X, Save, Eye, EyeOff, Search, Filter, Trash2, Key, AlertTriangle, LogOut, Wifi, WifiOff, Clock, CheckCircle, Loader2, Briefcase, ShoppingCart, Package, Wallet, Landmark, User as UserIcon, Moon, MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { PageShell, PageHeader, Toolbar, DataTable } from '../../design-system';
import type { DataTableColumn } from '../../design-system';
import { userService, PERMISOS_INFO } from '../../services/user.service';
import { useAuthStore } from '../../store/authStore';
import type { UserProfile, UserRole } from '../../types/auth.types';
import { DEFAULT_PERMISOS, PERMISOS, ROLE_LABELS, ROLE_DESCRIPTIONS, hasRole, getRolPrincipal, getUserRoles, calcularPermisosDeRoles, hasAnyRole } from '../../types/auth.types';
// chk5.F3-ADAPT · sub-fase 3.3 · wire-up modal multi-rol + sub-perfiles
import RolesMultiSelect from '../../components/modules/usuarios/RolesMultiSelect';
import DatosLaboralesForm from '../../components/modules/usuarios/DatosLaboralesForm';
import DatosSocioForm from '../../components/modules/usuarios/DatosSocioForm';
import { datosLaboralesService } from '../../services/datosLaborales.service';
import { datosSocioService } from '../../services/datosSocio.service';
import type { DatosLaborales, DatosLaboralesFormData } from '../../types/datosLaborales.types';
import type { DatosSocio, DatosSocioFormData } from '../../types/datosSocio.types';

type ModalType = 'none' | 'create' | 'edit-permisos' | 'view-permisos' | 'delete-confirm' | 'reset-password' | 'disconnect-confirm' | 'disconnect-all-confirm' | 'approve-user';

export const Usuarios: React.FC = () => {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [modalType, setModalType] = useState<ModalType>('none');
  const currentUser = useAuthStore(state => state.userProfile);

  // Estado para crear usuario
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    cargo: '',
    role: 'vendedor' as UserRole
  });
  const [showPassword, setShowPassword] = useState(false);

  // Estado para editar permisos
  const [editPermisos, setEditPermisos] = useState<string[]>([]);
  const [editRole, setEditRole] = useState<UserRole>('vendedor');
  // chk5.F3-ADAPT · sub-fase 3.3 · multi-rol + sub-perfiles
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);
  const [editActiveTab, setEditActiveTab] = useState<'roles' | 'laborales' | 'socio'>('roles');
  const [editDatosLab, setEditDatosLab] = useState<DatosLaborales | null>(null);
  const [editDatosSoc, setEditDatosSoc] = useState<DatosSocio | null>(null);
  // Pending form data (lo que el user editó · puede ser null si invalido)
  const [pendingDatosLab, setPendingDatosLab] = useState<DatosLaboralesFormData | null>(null);
  const [pendingDatosSoc, setPendingDatosSoc] = useState<DatosSocioFormData | null>(null);
  const [datosLabValid, setDatosLabValid] = useState(true);
  const [datosSocValid, setDatosSocValid] = useState(true);

  // Estado para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Estado para aprobar usuario
  const [approveRole, setApproveRole] = useState<UserRole>('vendedor');

  // Estado para resetear contraseña
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchUsuarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getAll();
      setUsuarios(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  // Auto-hide success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleChangeRole = async (uid: string, newRole: UserRole) => {
    if (uid === currentUser?.uid) {
      setError('No puedes cambiar tu propio rol');
      return;
    }

    try {
      await userService.updateRole(uid, newRole);
      await fetchUsuarios();
      setSuccess('Rol actualizado correctamente');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleActivo = async (uid: string, activo: boolean) => {
    if (uid === currentUser?.uid) {
      setError('No puedes desactivar tu propia cuenta');
      return;
    }

    try {
      await userService.setActivo(uid, activo);
      await fetchUsuarios();
      setSuccess(activo ? 'Usuario activado' : 'Usuario desactivado');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const createdUser = await userService.createUser(
        newUser.email,
        newUser.password,
        newUser.displayName,
        newUser.role
      );

      // Guardar cargo si se proporcionó
      if (newUser.cargo.trim() && createdUser.uid) {
        await userService.updateProfile(createdUser.uid, { cargo: newUser.cargo.trim() });
      }

      setSuccess('Usuario creado correctamente');
      setModalType('none');
      setNewUser({ email: '', password: '', displayName: '', cargo: '', role: 'vendedor' });
      await fetchUsuarios();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditPermisos = async (usuario: UserProfile) => {
    setSelectedUser(usuario);
    const roles = getUserRoles(usuario);
    setEditRoles(roles.length > 0 ? roles : ['invitado']);
    setEditRole(usuario.role);   // legacy compat
    setEditPermisos([...usuario.permisos]);
    setEditActiveTab('roles');
    setPendingDatosLab(null);
    setPendingDatosSoc(null);
    setDatosLabValid(true);
    setDatosSocValid(true);
    setEditDatosLab(null);
    setEditDatosSoc(null);
    setModalType('edit-permisos');

    // chk5.F3-ADAPT · cargar sub-perfiles existentes en paralelo
    try {
      const [datosLab, datosSoc] = await Promise.all([
        datosLaboralesService.get(usuario.uid).catch(() => null),
        datosSocioService.get(usuario.uid).catch(() => null),
      ]);
      setEditDatosLab(datosLab);
      setEditDatosSoc(datosSoc);
    } catch (err) {
      console.warn('No se pudieron cargar sub-perfiles:', err);
    }
  };

  const handleSavePermisos = async () => {
    if (!selectedUser || !currentUser) return;

    // Si es auto-edición · forzar que los roles NO cambien (no se puede degradar)
    const isSelf = selectedUser.uid === currentUser?.uid;
    const rolesToSave = isSelf ? getUserRoles(selectedUser) : editRoles;

    if (rolesToSave.length === 0) {
      setError('Seleccioná al menos un rol · el usuario quedaría sin permisos.');
      return;
    }
    if (editActiveTab === 'laborales' && !datosLabValid) {
      setError('Completá los datos laborales · faltan campos obligatorios.');
      return;
    }
    if (editActiveTab === 'socio' && !datosSocValid) {
      setError('Completá los datos de socio · faltan campos obligatorios.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // chk5.F3-ADAPT · escribir roles[] + permisos calculados de los roles
      // Como la Cloud Function solo soporta role singular, pasamos el rol principal
      // y luego complementamos con roles[] desde el cliente (updateRoleAndPermisos
      // ya hace ese paso adicional de updateDoc({roles: [role]}).
      const rolPrincipalToSave: UserRole = rolesToSave[0];
      const permisosCalculados = calcularPermisosDeRoles(rolesToSave);

      // Guardar el rol principal vía Cloud Function (compat)
      await userService.updateRoleAndPermisos(
        selectedUser.uid,
        rolPrincipalToSave,
        permisosCalculados,
      );

      // Sobrescribir el campo roles[] con TODOS los roles del array completo
      // (la Cloud Function solo escribió rolPrincipal · acá complementamos)
      if (rolesToSave.length > 1) {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        await updateDoc(doc(db, 'users', selectedUser.uid), {
          roles: rolesToSave,
        });
      }

      // chk5.F3-ADAPT · guardar sub-perfiles si hay cambios pendientes
      if (pendingDatosLab && datosLabValid) {
        await datosLaboralesService.set(selectedUser.uid, pendingDatosLab, currentUser.uid);
      }
      if (pendingDatosSoc && datosSocValid) {
        await datosSocioService.set(selectedUser.uid, pendingDatosSoc, currentUser.uid);
      }

      // Si quitamos rol planilla pero existe datosLaborales · podríamos limpiarlo
      // (DEUDA · por ahora dejamos los datos como historial · prevención de pérdida)
      // Si quitamos rol socio pero existe datosSocio · igual

      setSuccess('Usuario actualizado correctamente');
      setModalType('none');
      await fetchUsuarios();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermiso = (permiso: string) => {
    setEditPermisos(prev =>
      prev.includes(permiso)
        ? prev.filter(p => p !== permiso)
        : [...prev, permiso]
    );
  };

  const handleRoleChange = (role: UserRole) => {
    setEditRole(role);
    // Opcionalmente resetear permisos a los default del rol
    setEditPermisos(DEFAULT_PERMISOS[role]);
  };

  // Función para abrir modal de eliminar
  const handleOpenDeleteConfirm = (usuario: UserProfile) => {
    setSelectedUser(usuario);
    setModalType('delete-confirm');
  };

  // Función para eliminar usuario
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setSaving(true);
    setError(null);

    try {
      await userService.deleteUser(selectedUser.uid);
      setSuccess(`Usuario "${selectedUser.displayName}" eliminado correctamente`);
      setModalType('none');
      await fetchUsuarios();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Función para abrir modal de reset contraseña
  const handleOpenResetPassword = (usuario: UserProfile) => {
    setSelectedUser(usuario);
    setNewPassword('');
    setConfirmPassword('');
    setModalType('reset-password');
  };

  // Función para resetear contraseña
  const handleResetPassword = async () => {
    if (!selectedUser) return;

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await userService.resetUserPassword(selectedUser.uid, newPassword);
      setSuccess(`Contraseña de "${selectedUser.displayName}" actualizada correctamente`);
      setModalType('none');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Función para desconectar un usuario
  const handleOpenDisconnect = (usuario: UserProfile) => {
    setSelectedUser(usuario);
    setModalType('disconnect-confirm');
  };

  const handleDisconnectUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setError(null);

    try {
      await userService.forceDisconnectUser(selectedUser.uid);
      setSuccess(`"${selectedUser.displayName}" ha sido desconectado`);
      setModalType('none');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Función para desconectar a TODOS
  const handleDisconnectAll = async () => {
    setSaving(true);
    setError(null);

    try {
      const count = await userService.forceDisconnectAll();
      setSuccess(`${count} usuarios han sido desconectados`);
      setModalType('none');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Aprobar usuario pendiente
  const handleOpenApprove = (usuario: UserProfile) => {
    setSelectedUser(usuario);
    setApproveRole('vendedor');
    setModalType('approve-user');
  };

  const handleApproveUser = async () => {
    if (!selectedUser) return;

    setSaving(true);
    setError(null);

    try {
      await userService.aprobarUsuario(selectedUser.uid, approveRole);
      setSuccess(`"${selectedUser.displayName}" aprobado como ${ROLE_LABELS[approveRole]}`);
      setModalType('none');
      await fetchUsuarios();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filtrar usuarios (con validación segura)
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

      // Filtro de rol
      const matchesRole = filterRole === 'all' || usuario.role === filterRole;

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

  // Agrupar permisos
  const permisosAgrupados = userService.getPermisosAgrupados();

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

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          {/* §A · BREADCRUMB canon S9.D1 */}
          <div className="border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-3 bg-slate-50">
            <div className="flex items-center text-[12px] flex-1">
              <a className="text-slate-500 hover:text-purple-700 cursor-pointer">Inicio</a>
              <span className="mx-1.5 text-slate-300">›</span>
              <span className="text-slate-900 font-semibold">Usuarios</span>
            </div>
          </div>

          {/* §B · HEADER banking-grade · icon purple gradient + h1 + 3-tier acciones */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <div className="flex items-start justify-between gap-3 sm:gap-4 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-[260px]">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white flex-shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Usuarios</h1>
                  <p className="text-[12px] sm:text-[13px] text-slate-500 leading-snug">
                    Personas internas del negocio · multi-rol + sub-perfiles dinámicos
                  </p>
                </div>
              </div>
              {/* Acciones 3-tier canon · primary purple + neutral + danger */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={fetchUsuarios}
                  aria-label="Actualizar"
                  className="text-[11px] font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalType('disconnect-all-confirm')}
                  aria-label="Desconectar todas las sesiones"
                  title="Desconectar todas las sesiones"
                  className="text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                >
                  <WifiOff className="w-3 h-3" />
                  <span className="hidden md:inline">Desconectar Todos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalType('create')}
                  className="text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" />
                  <span className="hidden sm:inline">Nuevo usuario</span>
                </button>
              </div>
            </div>
          </div>

          {/* §C · KPI STRIP canon N1+N2 · 4 cards con gradient + ring colored */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/40 ring-1 ring-purple-200/50 rounded-2xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-purple-700 font-bold">TOTAL USUARIOS</span>
                <Users className="w-3.5 h-3.5 text-purple-700" />
              </div>
              <div className="text-xl sm:text-2xl font-bold tabular-nums text-purple-900">{stats.total}</div>
              <div className="text-[10px] text-purple-700 truncate">
                {stats.activos} activos · {stats.inactivos} inactivos
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 ring-1 ring-emerald-200/50 rounded-2xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-700 font-bold">ACTIVOS</span>
                <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <div className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-900">{stats.activos}</div>
              <div className="text-[10px] text-emerald-700 truncate">
                {stats.total > 0 ? `${Math.round((stats.activos / stats.total) * 100)}% del total` : '—'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 ring-1 ring-violet-200/50 rounded-2xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-violet-700 font-bold">SOCIOS</span>
                <Shield className="w-3.5 h-3.5 text-violet-700" />
              </div>
              <div className="text-xl sm:text-2xl font-bold tabular-nums text-violet-900">{sociosCount}</div>
              <div className="text-[10px] text-violet-700 truncate">
                {sociosCount > 0 ? 'con acceso a módulo Inversionistas' : 'ningún user es socio aún'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 ring-1 ring-amber-200/50 rounded-2xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-700 font-bold">MULTI-ROL</span>
                <Key className="w-3.5 h-3.5 text-amber-700" />
              </div>
              <div className="text-xl sm:text-2xl font-bold tabular-nums text-amber-900">{multiRolCount}</div>
              <div className="text-[10px] text-amber-700 truncate">
                {multiRolCount > 0 ? `de ${stats.total} tienen 2+ roles` : 'todos con 1 solo rol'}
              </div>
            </div>
          </div>

          {/* §D · BANNER · solicitudes pendientes (si las hay) */}
          {stats.pendientes > 0 && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-amber-100 rounded-xl flex-shrink-0">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-amber-800">
                    {stats.pendientes} solicitud{stats.pendientes > 1 ? 'es' : ''} pendiente{stats.pendientes > 1 ? 's' : ''} de aprobación
                  </p>
                  <p className="text-[10px] text-amber-600 truncate">
                    {pendientes.map((u) => u.displayName || u.email).join(', ')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setFilterStatus('inactive'); setFilterRole('invitado'); }}
                className="text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
              >
                <UserCheck className="h-3 w-3" />
                Revisar
              </button>
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
            {/* Chips de rol · scroll-x mobile · canon N6 */}
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
              {(['admin', 'gerente', 'vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor', 'socio', 'invitado'] as UserRole[]).map((r) => {
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
            </div>
            <div className="text-[10px] text-slate-500">
              Mostrando <strong>{filteredUsuarios.length}</strong> de {usuarios.length} usuarios
            </div>
          </div>

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
                  </div>

                  {/* Acciones derecha */}
                  <div className="flex items-center gap-1 flex-shrink-0 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {isInvitadoPending && (
                      <button
                        onClick={() => handleOpenApprove(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded"
                        title="Aprobar usuario"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Aprobar
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/usuarios/${u.uid}/ficha`)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded"
                      title="Ver ficha 360"
                    >
                      <Eye className="w-3 h-3" />
                      <span className="hidden sm:inline">Ficha 360</span>
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

          {/* Cierra el shell card canon */}
        </div>
      </div>

      {/* Modal Crear Usuario */}
      <Modal
        isOpen={modalType === 'create'}
        onClose={() => setModalType('none')}
        title="Crear Nuevo Usuario"
        subtitle="Ingresa los datos del nuevo usuario"
        size="md"
      >
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label htmlFor="usuario-nombre" className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre completo
                  </label>
                  <input
                    id="usuario-nombre"
                    type="text"
                    value={newUser.displayName}
                    onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="usuario-cargo" className="block text-sm font-medium text-slate-700 mb-1">
                    Cargo / Puesto
                  </label>
                  <input
                    id="usuario-cargo"
                    type="text"
                    value={newUser.cargo}
                    onChange={(e) => setNewUser({ ...newUser, cargo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Ej: Socio fundador, Gerente comercial, Asistente"
                  />
                </div>

                <div>
                  <label htmlFor="usuario-email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    id="usuario-email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="usuario-password" className="block text-sm font-medium text-slate-700 mb-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="usuario-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Mínimo 6 caracteres</p>
                </div>

                <div>
                  <label htmlFor="usuario-rol" className="block text-sm font-medium text-slate-700 mb-1">
                    Rol
                  </label>
                  <select
                    id="usuario-rol"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
                      <option key={role} value={role}>{label}</option>
                    ))}
                  </select>
                  {newUser.role && (
                    <p className="text-xs text-slate-500 mt-1">{ROLE_DESCRIPTIONS[newUser.role]}</p>
                  )}
                </div>

                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-800">
                  <strong>Info:</strong> El usuario recibirá acceso con los permisos predeterminados del rol seleccionado.
                  Puedes personalizar los permisos después desde la opción "Editar permisos".
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setModalType('none')}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Crear Usuario
                  </button>
                </div>
              </form>
      </Modal>

      {/* chk5.F3-ADAPT · Modal Editar Usuario · multi-rol + tabs dinámicas para sub-perfiles */}
      <Modal
        isOpen={modalType === 'edit-permisos' && !!selectedUser}
        onClose={() => setModalType('none')}
        title={`Editar usuario: ${selectedUser?.displayName ?? ''}`}
        subtitle={selectedUser?.email}
        size="lg"
      >
        {(() => {
          if (!selectedUser) return null;
          const isSelf = selectedUser.uid === currentUser?.uid;
          const tieneSocio = editRoles.includes('socio');
          const tieneRolPlanilla = editRoles.some((r) =>
            (['gerente', 'vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor'] as UserRole[]).includes(r)
          );

          return (
            <div>
              {/* Tabs internas · dinámicas según roles asignados */}
              <div className="border-b border-slate-200 mb-4 flex items-center gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setEditActiveTab('roles')}
                  className={`px-3 py-2 text-[12px] border-b-2 whitespace-nowrap font-semibold ${
                    editActiveTab === 'roles'
                      ? 'border-purple-600 text-purple-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Shield className="w-3 h-3 inline mr-1" /> Roles + accesos
                </button>
                {tieneRolPlanilla && (
                  <button
                    type="button"
                    onClick={() => setEditActiveTab('laborales')}
                    className={`px-3 py-2 text-[12px] border-b-2 whitespace-nowrap font-semibold ${
                      editActiveTab === 'laborales'
                        ? 'border-sky-600 text-sky-700'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    💼 Datos laborales
                    {!editDatosLab && (
                      <span className="ml-1 inline-block w-1.5 h-1.5 bg-amber-500 rounded-full" title="Sin completar"></span>
                    )}
                  </button>
                )}
                {tieneSocio && (
                  <button
                    type="button"
                    onClick={() => setEditActiveTab('socio')}
                    className={`px-3 py-2 text-[12px] border-b-2 whitespace-nowrap font-semibold ${
                      editActiveTab === 'socio'
                        ? 'border-violet-600 text-violet-700'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🏛 Datos de socio
                    {!editDatosSoc && (
                      <span className="ml-1 inline-block w-1.5 h-1.5 bg-amber-500 rounded-full" title="Sin completar"></span>
                    )}
                  </button>
                )}
              </div>

              {/* Body por tab · max-h con scroll · botón "Ver ficha 360" pegado abajo */}
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                {/* Tab Roles + accesos */}
                {editActiveTab === 'roles' && (
                  <div className="space-y-4">
                    {isSelf && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900">
                        ⚠ No podés cambiar tus propios roles por seguridad · solo otro admin puede modificarlos.
                      </div>
                    )}
                    <RolesMultiSelect
                      value={editRoles}
                      onChange={setEditRoles}
                      disabled={isSelf}
                    />
                  </div>
                )}

                {/* Tab Datos laborales · solo si tiene rol planilla */}
                {editActiveTab === 'laborales' && tieneRolPlanilla && (
                  <DatosLaboralesForm
                    initialData={editDatosLab ?? undefined}
                    onChange={(data, valid) => {
                      setPendingDatosLab(data);
                      setDatosLabValid(valid);
                    }}
                  />
                )}

                {/* Tab Datos de socio · solo si tiene rol socio */}
                {editActiveTab === 'socio' && tieneSocio && (
                  <DatosSocioForm
                    initialData={editDatosSoc ?? undefined}
                    onChange={(data, valid) => {
                      setPendingDatosSoc(data);
                      setDatosSocValid(valid);
                    }}
                  />
                )}
              </div>

              {/* Footer · cancelar + guardar + ficha 360 */}
              <div className="flex justify-between items-center gap-2 pt-4 border-t mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setModalType('none');
                    navigate(`/usuarios/${selectedUser.uid}/ficha`);
                  }}
                  className="text-[11px] font-semibold text-purple-700 hover:bg-purple-50 border border-purple-200 px-3 py-1.5 rounded inline-flex items-center gap-1.5"
                >
                  <Eye className="w-3 h-3" /> Ver ficha 360
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalType('none')}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800 text-[12px]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSavePermisos}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-[12px] font-bold"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar cambios
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <Modal
        isOpen={modalType === 'delete-confirm' && !!selectedUser}
        onClose={() => setModalType('none')}
        title="Eliminar Usuario"
        subtitle="Esta accion no se puede deshacer"
        size="md"
      >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Eliminar Usuario</h3>
                  <p className="text-sm text-slate-500">Esta accion no se puede deshacer</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800">
                  Estás a punto de eliminar permanentemente al usuario:
                </p>
                <p className="font-medium text-red-900 mt-2">
                  {selectedUser?.displayName} ({selectedUser?.email})
                </p>
                <p className="text-xs text-red-700 mt-2">
                  Se eliminará de Firebase Auth y todos sus datos de Firestore.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType('none')}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Eliminar Usuario
                </button>
              </div>
      </Modal>

      {/* Modal Resetear Contraseña */}
      <Modal
        isOpen={modalType === 'reset-password' && !!selectedUser}
        onClose={() => setModalType('none')}
        title="Resetear Contrasena"
        subtitle={selectedUser?.displayName}
        size="md"
      >
              <div className="space-y-4">
                <div>
                  <label htmlFor="reset-nueva-password" className="block text-sm font-medium text-slate-700 mb-1">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="reset-nueva-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 pr-10"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="reset-confirmar-password" className="block text-sm font-medium text-slate-700 mb-1">
                    Confirmar contraseña
                  </label>
                  <input
                    id="reset-confirmar-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Repite la contraseña"
                  />
                </div>

                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-sm text-red-600">Las contraseñas no coinciden</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-6">
                <button
                  type="button"
                  onClick={() => setModalType('none')}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={saving || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4" />
                  )}
                  Cambiar Contraseña
                </button>
              </div>
      </Modal>

      {/* Modal Confirmar Desconexion Individual */}
      <Modal
        isOpen={modalType === 'disconnect-confirm' && !!selectedUser}
        onClose={() => setModalType('none')}
        title="Desconectar Usuario"
        subtitle="Terminara la sesion activa del usuario"
        size="md"
      >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-orange-100 rounded-full">
                  <LogOut className="h-6 w-6 text-orange-600" />
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-orange-800">
                  Se cerrará la sesión activa de:
                </p>
                <p className="font-medium text-orange-900 mt-2">
                  {selectedUser?.displayName} ({selectedUser?.email})
                </p>
                <p className="text-xs text-orange-700 mt-2">
                  El usuario deberá iniciar sesión nuevamente para acceder al sistema.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType('none')}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDisconnectUser}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Desconectar
                </button>
              </div>
      </Modal>

      {/* Modal Confirmar Desconexion de TODOS */}
      <Modal
        isOpen={modalType === 'disconnect-all-confirm'}
        onClose={() => setModalType('none')}
        title="Desconectar Todos"
        subtitle="Terminara todas las sesiones activas"
        size="md"
      >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <WifiOff className="h-6 w-6 text-red-600" />
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800">
                  Se cerrarán las sesiones de <strong>todos los usuarios</strong> excepto la tuya.
                </p>
                <p className="text-xs text-red-700 mt-2">
                  Cada usuario deberá iniciar sesión nuevamente. Tu sesión no se verá afectada.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType('none')}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDisconnectAll}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <WifiOff className="h-4 w-4" />
                  )}
                  Desconectar Todos
                </button>
              </div>
      </Modal>

      {/* Modal Aprobar Usuario */}
      <Modal
        isOpen={modalType === 'approve-user' && !!selectedUser}
        onClose={() => setModalType('none')}
        title="Aprobar Solicitud de Acceso"
        subtitle="Asigna un rol para activar la cuenta"
        size="md"
      >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <UserCheck className="h-6 w-6 text-emerald-600" />
                </div>
              </div>

              {/* Info del usuario */}
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-amber-700 font-bold">
                      {selectedUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{selectedUser?.displayName}</p>
                    <p className="text-sm text-slate-500">{selectedUser?.email}</p>
                  </div>
                </div>
                {selectedUser?.fechaCreacion && (
                  <p className="text-xs text-slate-400 mt-3">
                    Registrado el {new Date(selectedUser.fechaCreacion.toDate()).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>

              {/* Selector de Rol */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Asignar Rol
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][])
                    .filter(([role]) => role !== 'invitado' && role !== 'admin')
                    .map(([role, label]) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setApproveRole(role)}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          approveRole === role
                            ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-300'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                </div>
                <div className="mt-3 bg-sky-50 border border-sky-200 rounded-lg p-3">
                  <p className="text-xs text-sky-800">
                    <strong>{ROLE_LABELS[approveRole]}:</strong> {ROLE_DESCRIPTIONS[approveRole]}
                  </p>
                  <p className="text-[10px] text-sky-600 mt-1">
                    {DEFAULT_PERMISOS[approveRole].length} permisos predeterminados
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType('none')}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApproveUser}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium transition-colors"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Aprobar y Activar
                </button>
              </div>
      </Modal>

      {/* Info sobre roles */}
      <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
        <h3 className="font-medium text-sky-800 mb-3">Información sobre Roles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
            <div key={role} className="bg-white/60 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeColor[role]}`}>
                  {label}
                </span>
              </div>
              <p className="text-xs text-slate-600">{ROLE_DESCRIPTIONS[role]}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {DEFAULT_PERMISOS[role].length} permisos
              </p>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
};
