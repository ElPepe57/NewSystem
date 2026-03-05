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

    // Verificaciones de rol (8 roles)
    isAdmin: userProfile?.role === 'admin',
    isGerente: userProfile?.role === 'gerente',
    isVendedor: userProfile?.role === 'vendedor',
    isComprador: userProfile?.role === 'comprador',
    isAlmacenero: userProfile?.role === 'almacenero',
    isFinanzas: userProfile?.role === 'finanzas',
    isSupervisor: userProfile?.role === 'supervisor',
    isInvitado: userProfile?.role === 'invitado',

    // Verificar permiso específico
    hasPermiso: (permiso: string) => userService.hasPermiso(userProfile, permiso),

    // Verificar múltiples permisos
    hasAnyPermiso: (permisos: string[]) => userService.hasAnyPermiso(userProfile, permisos),
    hasAllPermisos: (permisos: string[]) => userService.hasAllPermisos(userProfile, permisos),

    // === Permisos pre-calculados: General ===
    canViewDashboard: userService.hasPermiso(userProfile, PERMISOS.VER_DASHBOARD),

    // === Permisos pre-calculados: Ventas ===
    canViewVentas: userService.hasPermiso(userProfile, PERMISOS.VER_VENTAS),
    canCreateVenta: userService.hasPermiso(userProfile, PERMISOS.CREAR_VENTA),
    canEditVenta: userService.hasPermiso(userProfile, PERMISOS.EDITAR_VENTA),
    canConfirmVenta: userService.hasPermiso(userProfile, PERMISOS.CONFIRMAR_VENTA),
    canCancelVenta: userService.hasPermiso(userProfile, PERMISOS.CANCELAR_VENTA),

    // === Permisos pre-calculados: Cotizaciones ===
    canViewCotizaciones: userService.hasPermiso(userProfile, PERMISOS.VER_COTIZACIONES),
    canCreateCotizacion: userService.hasPermiso(userProfile, PERMISOS.CREAR_COTIZACION),
    canValidateCotizacion: userService.hasPermiso(userProfile, PERMISOS.VALIDAR_COTIZACION),

    // === Permisos pre-calculados: Entregas ===
    canViewEntregas: userService.hasPermiso(userProfile, PERMISOS.VER_ENTREGAS),
    canProgramEntrega: userService.hasPermiso(userProfile, PERMISOS.PROGRAMAR_ENTREGA),
    canRegisterEntrega: userService.hasPermiso(userProfile, PERMISOS.REGISTRAR_ENTREGA),

    // === Permisos pre-calculados: Compras ===
    canViewRequerimientos: userService.hasPermiso(userProfile, PERMISOS.VER_REQUERIMIENTOS),
    canCreateRequerimiento: userService.hasPermiso(userProfile, PERMISOS.CREAR_REQUERIMIENTO),
    canApproveRequerimiento: userService.hasPermiso(userProfile, PERMISOS.APROBAR_REQUERIMIENTO),
    canViewOC: userService.hasPermiso(userProfile, PERMISOS.VER_ORDENES_COMPRA),
    canCreateOC: userService.hasPermiso(userProfile, PERMISOS.CREAR_OC),
    canReceiveOC: userService.hasPermiso(userProfile, PERMISOS.RECIBIR_OC),

    // === Permisos pre-calculados: Inventario ===
    canViewInventario: userService.hasPermiso(userProfile, PERMISOS.VER_INVENTARIO),
    canManageInventario: userService.hasPermiso(userProfile, PERMISOS.GESTIONAR_INVENTARIO),
    canTransferUnidades: userService.hasPermiso(userProfile, PERMISOS.TRANSFERIR_UNIDADES),

    // === Permisos pre-calculados: Finanzas ===
    canViewGastos: userService.hasPermiso(userProfile, PERMISOS.VER_GASTOS),
    canCreateGasto: userService.hasPermiso(userProfile, PERMISOS.CREAR_GASTO),
    canViewTesoreria: userService.hasPermiso(userProfile, PERMISOS.VER_TESORERIA),
    canManageTesoreria: userService.hasPermiso(userProfile, PERMISOS.GESTIONAR_TESORERIA),
    canViewReportes: userService.hasPermiso(userProfile, PERMISOS.VER_REPORTES),
    canViewCTRU: userService.hasPermiso(userProfile, PERMISOS.VER_CTRU),

    // === Permisos pre-calculados: Administración ===
    canManageUsers: userService.hasPermiso(userProfile, PERMISOS.GESTIONAR_USUARIOS),
    canManageConfig: userService.hasPermiso(userProfile, PERMISOS.GESTIONAR_CONFIGURACION),
    canViewAuditoria: userService.hasPermiso(userProfile, PERMISOS.VER_AUDITORIA),
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
