import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import type { UserRole } from '../../types/auth.types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermiso?: string;
  requiredPermisos?: string[];
  requireAllPermisos?: boolean;
  allowedRoles?: UserRole[];
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermiso,
  requiredPermisos,
  requireAllPermisos = false,
  allowedRoles,
  fallbackPath = '/dashboard'
}) => {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);
  const { hasPermiso, hasAnyPermiso, hasAllPermisos, role, isActive, profile } = usePermissions();

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Si no hay usuario, redirigir a login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si el perfil aún no se ha cargado, mostrar loading
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  // Si el usuario está desactivado
  if (!isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">⛔</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Cuenta Desactivada</h2>
          <p className="text-gray-600 mb-4">
            Tu cuenta ha sido desactivada. Contacta al administrador para más información.
          </p>
          <button
            onClick={() => { useAuthStore.getState().logout(); }}
            className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // Verificar roles permitidos
  if (allowedRoles && allowedRoles.length > 0) {
    if (!role || !allowedRoles.includes(role)) {
      return <AccessDenied fallbackPath={fallbackPath} />;
    }
  }

  // Verificar permiso único
  if (requiredPermiso) {
    if (!hasPermiso(requiredPermiso)) {
      return <AccessDenied fallbackPath={fallbackPath} />;
    }
  }

  // Verificar múltiples permisos
  if (requiredPermisos && requiredPermisos.length > 0) {
    const hasAccess = requireAllPermisos
      ? hasAllPermisos(requiredPermisos)
      : hasAnyPermiso(requiredPermisos);

    if (!hasAccess) {
      return <AccessDenied fallbackPath={fallbackPath} />;
    }
  }

  return <>{children}</>;
};

// Componente de acceso denegado
const AccessDenied: React.FC<{ fallbackPath: string }> = ({ fallbackPath }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
        <div className="text-yellow-500 text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso Denegado</h2>
        <p className="text-gray-600 mb-4">
          No tienes permisos para acceder a esta sección.
        </p>
        <a
          href={fallbackPath}
          className="inline-block bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
        >
          Volver al Dashboard
        </a>
      </div>
    </div>
  );
};

// Componente para verificar permisos inline (para botones, menús, etc.)
interface RequirePermisoProps {
  permiso: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RequirePermiso: React.FC<RequirePermisoProps> = ({
  permiso,
  children,
  fallback = null
}) => {
  const { hasPermiso } = usePermissions();

  if (!hasPermiso(permiso)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// Componente para verificar roles inline
interface RequireRoleProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({
  roles,
  children,
  fallback = null
}) => {
  const { role } = usePermissions();

  if (!role || !roles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
