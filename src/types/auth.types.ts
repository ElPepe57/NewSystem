// src/types/auth.types.ts
import { Timestamp } from 'firebase/firestore';

// 1. Definición estricta de los Roles posibles
export type UserRole = 'admin' | 'vendedor' | 'almacenero' | 'invitado';

// 2. Definición del Perfil de Usuario (Lo que se guarda en Firestore /users)
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string; // Opcional, pero útil para el avatar
  
  role: UserRole;
  permisos: string[]; // Lista de capacidades específicas
  
  activo: boolean; // Para poder bloquear acceso sin borrar el usuario
  
  // Usamos Timestamp de Firebase, no 'any' ni 'Date'
  fechaCreacion: Timestamp;
  ultimaConexion?: Timestamp;
}

// 3. Constantes de Permisos (Para evitar errores de escritura en el código)
// Úsalas así: PERMISOS.CREAR_VENTA
export const PERMISOS = {
  VER_DASHBOARD: 'ver_dashboard',
  VER_VENTAS: 'ver_ventas',
  CREAR_VENTA: 'crear_venta',
  EDITAR_VENTA: 'editar_venta',
  VER_INVENTARIO: 'ver_inventario',
  GESTIONAR_INVENTARIO: 'gestionar_inventario', // Mover, recibir
  VER_FINANZAS: 'ver_finanzas',
  ADMIN_TOTAL: 'admin_total'
} as const;

// 4. Helper para roles por defecto (Opcional pero recomendado)
export const DEFAULT_PERMISOS: Record<UserRole, string[]> = {
  admin: Object.values(PERMISOS), // Admin tiene todo
  vendedor: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS,
    PERMISOS.CREAR_VENTA,
    PERMISOS.VER_INVENTARIO
  ],
  almacenero: [
    PERMISOS.VER_INVENTARIO,
    PERMISOS.GESTIONAR_INVENTARIO,
    PERMISOS.VER_VENTAS // Solo ver para preparar pedidos
  ],
  invitado: []
};