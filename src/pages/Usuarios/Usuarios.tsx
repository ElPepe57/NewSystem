import React, { useEffect, useState, useMemo } from 'react';
import { Users, Shield, UserCheck, UserX, RefreshCw, Plus, Edit2, X, Save, Eye, EyeOff, Search, Filter, Trash2, Key, AlertTriangle } from 'lucide-react';
import { userService, PERMISOS_INFO } from '../../services/user.service';
import { useAuthStore } from '../../store/authStore';
import type { UserProfile, UserRole } from '../../types/auth.types';
import { DEFAULT_PERMISOS, PERMISOS } from '../../types/auth.types';

type ModalType = 'none' | 'create' | 'edit-permisos' | 'view-permisos' | 'delete-confirm' | 'reset-password';

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
      await userService.createUser(
        newUser.email,
        newUser.password,
        newUser.displayName,
        newUser.role
      );

      setSuccess('Usuario creado correctamente');
      setModalType('none');
      setNewUser({ email: '', password: '', displayName: '', role: 'vendedor' });
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

    if (selectedUser.uid === currentUser?.uid) {
      setError('No puedes modificar tus propios permisos');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await userService.updateRoleAndPermisos(selectedUser.uid, editRole, editPermisos);
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
    vendedor: 'bg-blue-100 text-blue-800',
    almacenero: 'bg-green-100 text-green-800',
    invitado: 'bg-gray-100 text-gray-800'
  };

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador',
    vendedor: 'Vendedor',
    almacenero: 'Almacenero',
    invitado: 'Invitado'
  };

  // Estadísticas
  const stats = {
    total: usuarios.length,
    activos: usuarios.filter(u => u.activo).length,
    admins: usuarios.filter(u => u.role === 'admin').length,
    vendedores: usuarios.filter(u => u.role === 'vendedor').length,
    almaceneros: usuarios.filter(u => u.role === 'almacenero').length
  };

  // Agrupar permisos
  const permisosAgrupados = userService.getPermisosAgrupados();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
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
        <div className="flex gap-2">
          <button
            onClick={fetchUsuarios}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Users className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
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
              <p className="text-xl font-bold">{stats.activos}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Admins</p>
              <p className="text-xl font-bold">{stats.admins}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Vendedores</p>
              <p className="text-xl font-bold">{stats.vendedores}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Almaceneros</p>
              <p className="text-xl font-bold">{stats.almaceneros}</p>
            </div>
          </div>
        </div>
      </div>

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
              <option value="vendedor">Vendedores</option>
              <option value="almacenero">Almaceneros</option>
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
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {usuario.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm rounded-full px-3 py-1 font-medium ${roleBadgeColor[usuario.role]}`}>
                    {roleLabels[usuario.role]}
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
                    <button
                      onClick={() => handleOpenEditPermisos(usuario)}
                      disabled={usuario.uid === currentUser?.uid}
                      className="p-2 text-primary-600 hover:text-primary-900 hover:bg-primary-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Editar permisos"
                    >
                      <Edit2 className="h-4 w-4" />
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
      {modalType === 'create' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Crear Nuevo Usuario</h3>
                  <p className="text-sm text-gray-500">Ingresa los datos del nuevo usuario</p>
                </div>
                <button
                  onClick={() => setModalType('none')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={newUser.displayName}
                    onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
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
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rol
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="admin">Administrador</option>
                    <option value="vendedor">Vendedor</option>
                    <option value="almacenero">Almacenero</option>
                    <option value="invitado">Invitado</option>
                  </select>
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
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Permisos */}
      {modalType === 'edit-permisos' && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Editar Permisos: {selectedUser.displayName}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                </div>
                <button
                  onClick={() => setModalType('none')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Selector de Rol */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rol del usuario
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['admin', 'vendedor', 'almacenero', 'invitado'] as UserRole[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleChange(role)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        editRole === role
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {roleLabels[role]}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Al cambiar el rol, los permisos se resetean a los predeterminados del rol.
                </p>
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
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {modalType === 'delete-confirm' && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Eliminar Usuario</h3>
                  <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800">
                  Estás a punto de eliminar permanentemente al usuario:
                </p>
                <p className="font-medium text-red-900 mt-2">
                  {selectedUser.displayName} ({selectedUser.email})
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
            </div>
          </div>
        </div>
      )}

      {/* Modal Resetear Contraseña */}
      {modalType === 'reset-password' && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Resetear Contraseña</h3>
                  <p className="text-sm text-gray-500">{selectedUser.displayName}</p>
                </div>
                <button
                  onClick={() => setModalType('none')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
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
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar contraseña
                  </label>
                  <input
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
            </div>
          </div>
        </div>
      )}

      {/* Info sobre roles */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Información sobre Roles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <p className="font-medium">Administrador:</p>
            <p>Acceso total al sistema, puede gestionar usuarios y configuración.</p>
          </div>
          <div>
            <p className="font-medium">Vendedor:</p>
            <p>Puede ver dashboard, crear/ver ventas, cotizaciones y ver inventario.</p>
          </div>
          <div>
            <p className="font-medium">Almacenero:</p>
            <p>Puede gestionar inventario, unidades, transferencias y ver ventas.</p>
          </div>
          <div>
            <p className="font-medium">Invitado:</p>
            <p>Acceso limitado, solo puede ver el dashboard básico.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
