import React, { useEffect, useState, useMemo } from 'react';
import { Users, Shield, UserCheck, UserX, RefreshCw, Plus, Edit2, X, Save, Eye, EyeOff, Search, Filter, Trash2, Key, AlertTriangle, LogOut, Wifi, WifiOff, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { userService, PERMISOS_INFO } from '../../services/user.service';
import { useAuthStore } from '../../store/authStore';
import type { UserProfile, UserRole } from '../../types/auth.types';
import { DEFAULT_PERMISOS, PERMISOS, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../types/auth.types';

type ModalType = 'none' | 'create' | 'edit-permisos' | 'view-permisos' | 'delete-confirm' | 'reset-password' | 'disconnect-confirm' | 'disconnect-all-confirm' | 'approve-user';

export const Usuarios: React.FC = () => {
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

  const handleOpenEditPermisos = (usuario: UserProfile) => {
    setSelectedUser(usuario);
    setEditRole(usuario.role);
    setEditPermisos([...usuario.permisos]);
    setModalType('edit-permisos');
  };

  const handleSavePermisos = async () => {
    if (!selectedUser) return;

    // Si es auto-edición, forzar que el rol no cambie
    const isSelf = selectedUser.uid === currentUser?.uid;
    const roleToSave = isSelf ? selectedUser.role : editRole;

    setSaving(true);
    setError(null);

    try {
      await userService.updateRoleAndPermisos(selectedUser.uid, roleToSave, editPermisos);
      setSuccess('Permisos actualizados correctamente');
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
    admin: 'bg-red-100 text-red-800',
    gerente: 'bg-purple-100 text-purple-800',
    vendedor: 'bg-blue-100 text-blue-800',
    comprador: 'bg-amber-100 text-amber-800',
    almacenero: 'bg-green-100 text-green-800',
    finanzas: 'bg-teal-100 text-teal-800',
    supervisor: 'bg-indigo-100 text-indigo-800',
    invitado: 'bg-gray-100 text-gray-800'
  };

  // Estadísticas
  const pendientes = useMemo(() =>
    usuarios.filter(u => !u.activo && u.role === 'invitado'),
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
    const allRoles: UserRole[] = ['admin', 'gerente', 'vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor', 'invitado'];
    allRoles.forEach(role => {
      const count = usuarios.filter(u => u.role === role).length;
      if (count > 0) counts[role] = count;
    });
    return counts;
  }, [usuarios]);

  // Agrupar permisos
  const permisosAgrupados = userService.getPermisosAgrupados();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-600">Administra roles y permisos de los usuarios del sistema</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setModalType('disconnect-all-confirm')}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            title="Desconectar todas las sesiones"
          >
            <WifiOff className="h-4 w-4" />
            <span className="hidden sm:inline">Desconectar Todos</span>
          </button>
          <button
            onClick={fetchUsuarios}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button
            onClick={() => setModalType('create')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex justify-between items-center">
          {success}
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Banner de Solicitudes Pendientes */}
      {stats.pendientes > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-800">
                {stats.pendientes} solicitud{stats.pendientes > 1 ? 'es' : ''} pendiente{stats.pendientes > 1 ? 's' : ''} de aprobación
              </p>
              <p className="text-sm text-amber-600">
                {pendientes.map(u => u.displayName || u.email).join(', ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setFilterStatus('inactive'); setFilterRole('invitado'); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            <UserCheck className="h-4 w-4" />
            Revisar Solicitudes
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Users className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Usuarios</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Activos</p>
              <p className="text-xl font-bold text-green-600">{stats.activos}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <UserX className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Inactivos</p>
              <p className="text-xl font-bold text-red-600">{stats.inactivos}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Distribución por Rol */}
      {Object.keys(roleStats).length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Distribución por Rol</h3>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(roleStats) as [UserRole, number][]).map(([role, count]) => (
              <span
                key={role}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${roleBadgeColor[role]}`}
              >
                {ROLE_LABELS[role]}
                <span className="bg-white/60 px-1.5 py-0.5 rounded-full text-xs font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Búsqueda y Filtros */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Filtro por rol */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="gerente">Gerentes</option>
              <option value="vendedor">Vendedores</option>
              <option value="comprador">Compradores</option>
              <option value="almacenero">Almaceneros</option>
              <option value="finanzas">Finanzas</option>
              <option value="supervisor">Supervisores</option>
              <option value="invitado">Invitados</option>
            </select>
          </div>

          {/* Filtro por estado */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          {/* Limpiar filtros */}
          {(searchTerm || filterRole !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterRole('all');
                setFilterStatus('all');
              }}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Resultados */}
        <div className="mt-3 text-sm text-gray-500">
          Mostrando {filteredUsuarios.length} de {usuarios.length} usuarios
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Última Conexión
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsuarios.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No se encontraron usuarios</p>
                  <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
                </td>
              </tr>
            ) : filteredUsuarios.map((usuario) => (
              <tr
                key={usuario.uid}
                className={usuario.uid === currentUser?.uid ? 'bg-primary-50' : 'hover:bg-gray-50'}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      {usuario.photoURL ? (
                        <img
                          src={usuario.photoURL}
                          alt={usuario.displayName}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <span className="text-gray-600 font-medium">
                          {usuario.displayName?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {usuario.displayName}
                        {usuario.uid === currentUser?.uid && (
                          <span className="ml-2 text-xs text-primary-600">(Tú)</span>
                        )}
                      </div>
                      {usuario.cargo && (
                        <div className="text-xs text-gray-500">{usuario.cargo}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {usuario.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm rounded-full px-3 py-1 font-medium ${roleBadgeColor[usuario.role]}`}>
                    {ROLE_LABELS[usuario.role]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleActivo(usuario.uid, !usuario.activo)}
                    disabled={usuario.uid === currentUser?.uid}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      usuario.activo
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {usuario.activo ? (
                      <>
                        <UserCheck className="h-3 w-3" /> Activo
                      </>
                    ) : (
                      <>
                        <UserX className="h-3 w-3" /> Inactivo
                      </>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {usuario.ultimaConexion
                    ? new Date(usuario.ultimaConexion.toDate()).toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Nunca'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-1">
                    {/* Botón Aprobar (solo para pendientes) */}
                    {!usuario.activo && usuario.role === 'invitado' && (
                      <button
                        onClick={() => handleOpenApprove(usuario)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                        title="Aprobar usuario"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Aprobar</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEditPermisos(usuario)}
                      className="p-2 text-primary-600 hover:text-primary-900 hover:bg-primary-50 rounded-lg"
                      title="Editar permisos"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleOpenDisconnect(usuario)}
                      disabled={usuario.uid === currentUser?.uid}
                      className="p-2 text-orange-600 hover:text-orange-900 hover:bg-orange-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Desconectar sesión"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleOpenResetPassword(usuario)}
                      disabled={usuario.uid === currentUser?.uid}
                      className="p-2 text-amber-600 hover:text-amber-900 hover:bg-amber-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Resetear contraseña"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleOpenDeleteConfirm(usuario)}
                      disabled={usuario.uid === currentUser?.uid}
                      className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
                  <label htmlFor="usuario-nombre" className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre completo
                  </label>
                  <input
                    id="usuario-nombre"
                    type="text"
                    value={newUser.displayName}
                    onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="usuario-cargo" className="block text-sm font-medium text-gray-700 mb-1">
                    Cargo / Puesto
                  </label>
                  <input
                    id="usuario-cargo"
                    type="text"
                    value={newUser.cargo}
                    onChange={(e) => setNewUser({ ...newUser, cargo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Ej: Socio fundador, Gerente comercial, Asistente"
                  />
                </div>

                <div>
                  <label htmlFor="usuario-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="usuario-email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="usuario-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="usuario-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                </div>

                <div>
                  <label htmlFor="usuario-rol" className="block text-sm font-medium text-gray-700 mb-1">
                    Rol
                  </label>
                  <select
                    id="usuario-rol"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
                      <option key={role} value={role}>{label}</option>
                    ))}
                  </select>
                  {newUser.role && (
                    <p className="text-xs text-gray-500 mt-1">{ROLE_DESCRIPTIONS[newUser.role]}</p>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <strong>Info:</strong> El usuario recibirá acceso con los permisos predeterminados del rol seleccionado.
                  Puedes personalizar los permisos después desde la opción "Editar permisos".
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setModalType('none')}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
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

      {/* Modal Editar Permisos */}
      <Modal
        isOpen={modalType === 'edit-permisos' && !!selectedUser}
        onClose={() => setModalType('none')}
        title={`Editar Permisos: ${selectedUser?.displayName ?? ''}`}
        subtitle={selectedUser?.email}
        size="lg"
      >
              {/* Selector de Rol */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rol del usuario
                </label>
                {selectedUser?.uid === currentUser?.uid ? (
                  <div>
                    <span className={`inline-block px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white`}>
                      {ROLE_LABELS[editRole]}
                    </span>
                    <p className="text-xs text-amber-600 mt-2">
                      No puedes cambiar tu propio rol por seguridad.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => handleRoleChange(role)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            editRole === role
                              ? 'bg-primary-600 text-white shadow-sm'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {ROLE_DESCRIPTIONS[editRole]}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      Al cambiar el rol, los permisos se resetean a los predeterminados.
                    </p>
                  </>
                )}
              </div>

              {/* Permisos por grupo */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <label className="block text-sm font-medium text-gray-700">
                  Permisos específicos
                </label>

                {Object.entries(permisosAgrupados).map(([grupo, permisos]) => (
                  <div key={grupo} className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-3">{grupo}</h4>
                    <div className="space-y-2">
                      {permisos.map(({ permiso, info }) => (
                        <label
                          key={permiso}
                          className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={editPermisos.includes(permiso)}
                            onChange={() => handleTogglePermiso(permiso)}
                            className="mt-1 h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                          />
                          <div>
                            <p className="font-medium text-gray-700">{info.label}</p>
                            <p className="text-xs text-gray-500">{info.descripcion}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-6 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setModalType('none')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePermisos}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar Cambios
                </button>
              </div>
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
                  <h3 className="text-lg font-bold text-gray-900">Eliminar Usuario</h3>
                  <p className="text-sm text-gray-500">Esta accion no se puede deshacer</p>
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
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
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
                  <label htmlFor="reset-nueva-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="reset-nueva-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-10"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="reset-confirmar-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar contraseña
                  </label>
                  <input
                    id="reset-confirmar-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
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
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
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
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
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
                <div className="p-3 bg-green-100 rounded-xl">
                  <UserCheck className="h-6 w-6 text-green-600" />
                </div>
              </div>

              {/* Info del usuario */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-amber-700 font-bold">
                      {selectedUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedUser?.displayName}</p>
                    <p className="text-sm text-gray-500">{selectedUser?.email}</p>
                  </div>
                </div>
                {selectedUser?.fechaCreacion && (
                  <p className="text-xs text-gray-400 mt-3">
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
                <label className="block text-sm font-medium text-gray-700 mb-3">
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
                            ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                </div>
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>{ROLE_LABELS[approveRole]}:</strong> {ROLE_DESCRIPTIONS[approveRole]}
                  </p>
                  <p className="text-[10px] text-blue-600 mt-1">
                    {DEFAULT_PERMISOS[approveRole].length} permisos predeterminados
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType('none')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApproveUser}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-3">Información sobre Roles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
            <div key={role} className="bg-white/60 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeColor[role]}`}>
                  {label}
                </span>
              </div>
              <p className="text-xs text-gray-600">{ROLE_DESCRIPTIONS[role]}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                {DEFAULT_PERMISOS[role].length} permisos
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
