import React, { useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Shield, Clock, LogOut, Mail, User, AlertCircle } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button, Card } from '../../components/common';
import { AuthService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import { VitaSkinLogo, AuthPageWrapper, DropletDivider } from './AuthDecorations';

export const PendingApproval: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);
  const setUserProfile = useAuthStore(state => state.setUserProfile);
  const fetchUserProfile = useAuthStore(state => state.fetchUserProfile);

  const isPendingNew = userProfile?.role === 'invitado' && !userProfile?.activo;
  const isDeactivated = userProfile?.role !== 'invitado' && !userProfile?.activo;

  // Listener en tiempo real para detectar aprobación del admin
  // IMPORTANTE: debe estar ANTES de los guards para respetar las reglas de hooks
  useEffect(() => {
    if (!user?.uid) return;

    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data?.activo === true) {
          // Admin aprobó la cuenta - actualizar store y redirigir
          fetchUserProfile(user.uid).then(() => {
            navigate('/dashboard', { replace: true });
          });
        }
      },
      (error) => {
        console.error('Error en listener de aprobación:', error);
      }
    );

    return () => unsub();
  }, [user?.uid, fetchUserProfile, navigate]);

  // Guard: si no está autenticado, ir a login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Guard: si ya está activo, ir al dashboard
  if (userProfile?.activo) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      useAuthStore.getState().logout();
      navigate('/login');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  return (
    <AuthPageWrapper>
      <Card className="w-full max-w-lg relative z-10 shadow-xl shadow-primary-900/10 border border-primary-100">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <VitaSkinLogo className="h-16 w-16 drop-shadow-lg" />
          </div>
          <DropletDivider />
        </div>

        {/* Icono principal */}
        <div className="flex justify-center mb-6">
          <div className={`relative p-5 rounded-full ${isPendingNew ? 'bg-amber-50' : 'bg-red-50'}`}>
            <Shield className={`h-12 w-12 ${isPendingNew ? 'text-amber-500' : 'text-red-500'}`} />
            <div className={`absolute -bottom-1 -right-1 p-1.5 rounded-full ${isPendingNew ? 'bg-amber-100' : 'bg-red-100'}`}>
              {isPendingNew ? (
                <Clock className="h-4 w-4 text-amber-600 animate-pulse" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
          </div>
        </div>

        {/* Mensaje principal */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isPendingNew
              ? 'Cuenta Pendiente de Autorización'
              : 'Cuenta Desactivada'
            }
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-sm mx-auto">
            {isPendingNew
              ? 'Tu cuenta ha sido creada exitosamente. Un administrador revisará tu solicitud y activará tu acceso al sistema.'
              : 'Tu cuenta ha sido desactivada por un administrador. Contacta al equipo de soporte para más información.'
            }
          </p>
        </div>

        {/* Info del usuario */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 p-2 bg-white rounded-lg shadow-sm">
              <User className="h-4 w-4 text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Nombre</p>
              <p className="text-sm font-medium text-gray-800 truncate">
                {userProfile?.displayName || user?.displayName || 'Usuario'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 p-2 bg-white rounded-lg shadow-sm">
              <Mail className="h-4 w-4 text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Email</p>
              <p className="text-sm font-medium text-gray-800 truncate">
                {userProfile?.email || user?.email || ''}
              </p>
            </div>
          </div>
        </div>

        {/* Status card */}
        {isPendingNew && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Esperando aprobación
                </p>
                <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                  Tu solicitud está siendo revisada. Serás redirigido automáticamente una vez que un administrador apruebe tu acceso.
                </p>
              </div>
            </div>
          </div>
        )}

        {isDeactivated && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Acceso restringido
                </p>
                <p className="text-xs text-red-600 mt-1 leading-relaxed">
                  Tu cuenta fue desactivada. Comunícate con un administrador del sistema para restablecer tu acceso.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Animación de espera (solo para pendientes nuevos) */}
        {isPendingNew && (
          <div className="flex justify-center gap-1.5 mb-6">
            <div className="h-2 w-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* Botón cerrar sesión */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400">
            Sistema de Gestión - Acceso controlado por administrador
          </p>
        </div>
      </Card>
    </AuthPageWrapper>
  );
};
