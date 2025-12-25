import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { userService } from '../services/user.service';
import { PERMISOS, type UserRole } from '../types/auth.types';

export function usePermissions() {
  const userProfile = useAuthStore(state => state.userProfile);

  const permissions = useMemo(() => ({
    // Estado del usuario
    isAuthenticated: !!userProfile,
    isActive: userProfile?.activo ?? false,
    role: userProfile?.role as UserRole | null,

    // Verificaciones de rol
    isAdmin: userProfile?.role === 'admin',
    isVendedor: userProfile?.role === 'vendedor',
    isAlmacenero: userProfile?.role === 'almacenero',
    isInvitado: userProfile?.role === 'invitado',

    // Verificar permiso específico
    hasPermiso: (permiso: string) => userService.hasPermiso(userProfile, permiso),

    // Verificar múltiples permisos
    hasAnyPermiso: (permisos: string[]) => userService.hasAnyPermiso(userProfile, permisos),
    hasAllPermisos: (permisos: string[]) => userService.hasAllPermisos(userProfile, permisos),

    // Permisos específicos pre-calculados
    canViewDashboard: userService.hasPermiso(userProfile, PERMISOS.VER_DASHBOARD),
    canViewVentas: userService.hasPermiso(userProfile, PERMISOS.VER_VENTAS),
    canCreateVenta: userService.hasPermiso(userProfile, PERMISOS.CREAR_VENTA),
    canEditVenta: userService.hasPermiso(userProfile, PERMISOS.EDITAR_VENTA),
    canViewInventario: userService.hasPermiso(userProfile, PERMISOS.VER_INVENTARIO),
    canManageInventario: userService.hasPermiso(userProfile, PERMISOS.GESTIONAR_INVENTARIO),
    canViewFinanzas: userService.hasPermiso(userProfile, PERMISOS.VER_FINANZAS),
    isFullAdmin: userService.hasPermiso(userProfile, PERMISOS.ADMIN_TOTAL),

    // Datos del perfil
    profile: userProfile,
    displayName: userProfile?.displayName || 'Usuario',
    email: userProfile?.email || ''
  }), [userProfile]);

  return permissions;
}

// Hook simplificado para verificar un solo permiso
export function useHasPermiso(permiso: string): boolean {
  const userProfile = useAuthStore(state => state.userProfile);
  return useMemo(
    () => userService.hasPermiso(userProfile, permiso),
    [userProfile, permiso]
  );
}

// Hook para verificar rol
export function useIsRole(role: UserRole): boolean {
  const userProfile = useAuthStore(state => state.userProfile);
  return useMemo(
    () => userProfile?.role === role,
    [userProfile, role]
  );
}
