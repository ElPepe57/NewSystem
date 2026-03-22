import React, { useState, useRef, useEffect } from 'react';
import {
  User, Camera, Save, Lock, Eye, EyeOff, Shield, CheckCircle2,
  XCircle, RefreshCw, Activity, Clock, Edit2, X
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { userService, PERMISOS_INFO } from '../../services/user.service';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../types/auth.types';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ActividadReciente {
  id: string;
  tipo: string;
  descripcion: string;
  fecha: Date;
  modulo?: string;
}

export const MiPerfil: React.FC = () => {
  const { profile, role, displayName } = usePermissions();
  const fetchUserProfile = useAuthStore(state => state.fetchUserProfile);

  // Estado para editar nombre
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Estado para cambiar contraseña
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Estado para foto
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado general
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Actividad reciente
  const [actividades, setActividades] = useState<ActividadReciente[]>([]);
  const [loadingActividades, setLoadingActividades] = useState(true);

  // Auto-hide mensajes
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

  // Cargar actividad reciente
  useEffect(() => {
    if (!profile?.uid) return;

    const loadActividades = async () => {
      setLoadingActividades(true);
      try {
        const q = query(
          collection(db, 'audit_logs'),
          where('userId', '==', profile.uid),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        const snap = await getDocs(q);
        const items: ActividadReciente[] = snap.docs.map(doc => {
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
        setLoadingActividades(false);
      }
    };

    loadActividades();
  }, [profile?.uid]);

  // Handlers
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

    // Validar tipo y tamaño
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
      setSuccess('Contraseña cambiada correctamente');
      setShowPasswordSection(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Error al cambiar contraseña');
    } finally {
      setSavingPassword(false);
    }
  };

  // Agrupar permisos del usuario actual
  const permisosAgrupados = userService.getPermisosAgrupados();
  const misPermisos = profile?.permisos || [];

  // Config visual del rol
  const roleBadgeColor: Record<string, string> = {
    admin: 'bg-gradient-to-r from-red-500 to-orange-500 text-white',
    gerente: 'bg-gradient-to-r from-purple-500 to-violet-500 text-white',
    vendedor: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
    comprador: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white',
    almacenero: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white',
    finanzas: 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white',
    supervisor: 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white',
    invitado: 'bg-gray-500 text-white',
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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

      {/* Header con perfil */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-primary-600 via-primary-500 to-primary-700" />

        <div className="px-6 pb-6">
          {/* Avatar + Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-10">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-xl bg-white p-1 shadow-lg">
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={displayName || 'Avatar'}
                    className="w-full h-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-600">
                      {displayName?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 p-1.5 bg-primary-600 text-white rounded-lg shadow-md hover:bg-primary-700 transition-colors disabled:opacity-50"
                title="Cambiar foto"
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

            {/* Nombre + email + rol */}
            <div className="flex-1 pt-2">
              <div className="flex items-center gap-2">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg font-bold"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName || !newName.trim()}
                      className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {savingName ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
                    <button
                      onClick={handleStartEditName}
                      className="p-1 text-gray-400 hover:text-primary-600 rounded"
                      title="Editar nombre"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-500">{profile.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-lg ${roleBadgeColor[role || 'invitado']}`}>
                  {ROLE_LABELS[role as keyof typeof ROLE_LABELS] || 'Sin Rol'}
                </span>
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${profile.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {profile.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>

          {/* Descripción del rol */}
          {role && ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS] && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-sm text-gray-600">
                <Shield className="h-4 w-4 inline mr-1.5 text-gray-400" />
                {ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS]}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Seguridad</h2>
          </div>
          {!showPasswordSection && (
            <button
              onClick={() => setShowPasswordSection(true)}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cambiar contraseña
            </button>
          )}
        </div>

        {showPasswordSection && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
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
                  aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
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

            <div className="flex gap-2">
              <button
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {savingPassword ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Guardar
              </button>
              <button
                onClick={() => {
                  setShowPasswordSection(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!showPasswordSection && (
          <p className="text-sm text-gray-500">
            Puedes cambiar tu contraseña en cualquier momento para mantener tu cuenta segura.
          </p>
        )}
      </div>

      {/* Mis Permisos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Mis Permisos</h2>
          <span className="text-sm text-gray-400">({misPermisos.length} permisos)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(permisosAgrupados).map(([grupo, permisos]) => {
            const permisosDelGrupo = permisos.filter(({ permiso }) => misPermisos.includes(permiso));
            const totalGrupo = permisos.length;

            return (
              <div key={grupo} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-800 text-sm">{grupo}</h4>
                  <span className="text-xs text-gray-400">
                    {permisosDelGrupo.length}/{totalGrupo}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {permisos.map(({ permiso, info }) => {
                    const tiene = misPermisos.includes(permiso);
                    return (
                      <div
                        key={permiso}
                        className={`flex items-center gap-2 text-sm ${tiene ? 'text-gray-700' : 'text-gray-300'}`}
                      >
                        {tiene ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-300 flex-shrink-0" />
                        )}
                        <span>{info.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mi Actividad Reciente */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Mi Actividad Reciente</h2>
        </div>

        {loadingActividades ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : actividades.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p className="text-gray-500 text-sm">No hay actividad registrada aún</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actividades.map((act) => (
              <div key={act.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="p-1.5 bg-gray-100 rounded-lg mt-0.5">
                  <Clock className="h-4 w-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 capitalize">{act.tipo}</p>
                    {act.modulo && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">
                        {act.modulo}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{act.descripcion}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
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
  );
};
