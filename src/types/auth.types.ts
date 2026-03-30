// src/types/auth.types.ts
import { Timestamp } from 'firebase/firestore';

// 1. Definición estricta de los Roles posibles (8 roles)
export type UserRole =
  | 'admin'
  | 'gerente'
  | 'vendedor'
  | 'comprador'
  | 'almacenero'
  | 'finanzas'
  | 'supervisor'
  | 'invitado';

// 2. Definición del Perfil de Usuario (Lo que se guarda en Firestore /users)
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string; // Opcional, pero útil para el avatar
  cargo?: string; // Puesto/posición: "Socio fundador", "Gerente comercial", etc.

  role: UserRole;
  permisos: string[]; // Lista de capacidades específicas

  activo: boolean; // Para poder bloquear acceso sin borrar el usuario

  // Usamos Timestamp de Firebase, no 'any' ni 'Date'
  fechaCreacion: Timestamp;
  ultimaConexion?: Timestamp;
}

// 3. Constantes de Permisos (30 permisos granulares por módulo)
// Úsalas así: PERMISOS.CREAR_VENTA
export const PERMISOS = {
  // === General ===
  VER_DASHBOARD: 'ver_dashboard',

  // === Ventas ===
  VER_VENTAS: 'ver_ventas',
  CREAR_VENTA: 'crear_venta',
  EDITAR_VENTA: 'editar_venta',
  CONFIRMAR_VENTA: 'confirmar_venta',
  CANCELAR_VENTA: 'cancelar_venta',

  // === Cotizaciones ===
  VER_COTIZACIONES: 'ver_cotizaciones',
  CREAR_COTIZACION: 'crear_cotizacion',
  VALIDAR_COTIZACION: 'validar_cotizacion',

  // === Entregas ===
  VER_ENTREGAS: 'ver_entregas',
  PROGRAMAR_ENTREGA: 'programar_entrega',
  REGISTRAR_ENTREGA: 'registrar_entrega',

  // === Compras (Requerimientos + OC) ===
  VER_REQUERIMIENTOS: 'ver_requerimientos',
  CREAR_REQUERIMIENTO: 'crear_requerimiento',
  APROBAR_REQUERIMIENTO: 'aprobar_requerimiento',
  VER_ORDENES_COMPRA: 'ver_ordenes_compra',
  CREAR_OC: 'crear_oc',
  RECIBIR_OC: 'recibir_oc',

  // === Inventario ===
  VER_INVENTARIO: 'ver_inventario',
  GESTIONAR_INVENTARIO: 'gestionar_inventario',
  TRANSFERIR_UNIDADES: 'transferir_unidades',

  // === Finanzas ===
  VER_GASTOS: 'ver_gastos',
  CREAR_GASTO: 'crear_gasto',
  VER_TESORERIA: 'ver_tesoreria',
  GESTIONAR_TESORERIA: 'gestionar_tesoreria',
  VER_REPORTES: 'ver_reportes',
  VER_CTRU: 'ver_ctru',

  // === Administración ===
  GESTIONAR_USUARIOS: 'gestionar_usuarios',
  GESTIONAR_CONFIGURACION: 'gestionar_configuracion',
  VER_AUDITORIA: 'ver_auditoria',
  ADMIN_TOTAL: 'admin_total',
} as const;

// 4. Permisos predeterminados por rol
export const DEFAULT_PERMISOS: Record<UserRole, string[]> = {
  // Admin: acceso total
  admin: Object.values(PERMISOS),

  // Gerente: todo excepto gestión de usuarios, config y admin_total
  gerente: [
    PERMISOS.VER_DASHBOARD,
    // Ventas
    PERMISOS.VER_VENTAS, PERMISOS.CREAR_VENTA, PERMISOS.EDITAR_VENTA,
    PERMISOS.CONFIRMAR_VENTA, PERMISOS.CANCELAR_VENTA,
    // Cotizaciones
    PERMISOS.VER_COTIZACIONES, PERMISOS.CREAR_COTIZACION, PERMISOS.VALIDAR_COTIZACION,
    // Entregas
    PERMISOS.VER_ENTREGAS, PERMISOS.PROGRAMAR_ENTREGA, PERMISOS.REGISTRAR_ENTREGA,
    // Compras
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO, PERMISOS.APROBAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA, PERMISOS.CREAR_OC, PERMISOS.RECIBIR_OC,
    // Inventario
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    // Finanzas
    PERMISOS.VER_GASTOS, PERMISOS.CREAR_GASTO,
    PERMISOS.VER_TESORERIA, PERMISOS.GESTIONAR_TESORERIA,
    PERMISOS.VER_REPORTES, PERMISOS.VER_CTRU,
    // Admin (solo auditoría)
    PERMISOS.VER_AUDITORIA,
  ],

  // Vendedor: ventas, cotizaciones, entregas, requerimientos básicos
  vendedor: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS, PERMISOS.CREAR_VENTA, PERMISOS.EDITAR_VENTA,
    PERMISOS.CONFIRMAR_VENTA, PERMISOS.CANCELAR_VENTA,
    PERMISOS.VER_COTIZACIONES, PERMISOS.CREAR_COTIZACION, PERMISOS.VALIDAR_COTIZACION,
    PERMISOS.VER_ENTREGAS, PERMISOS.PROGRAMAR_ENTREGA, PERMISOS.REGISTRAR_ENTREGA,
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_INVENTARIO,
    PERMISOS.VER_GASTOS,
    PERMISOS.VER_REPORTES,
  ],

  // Comprador: requerimientos, OC, inventario
  comprador: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO, PERMISOS.APROBAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA, PERMISOS.CREAR_OC, PERMISOS.RECIBIR_OC,
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    PERMISOS.VER_GASTOS,
  ],

  // Almacenero: inventario, recepción OC, transferencias
  almacenero: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    PERMISOS.RECIBIR_OC,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_ENTREGAS,
  ],

  // Finanzas: gastos, tesorería, reportes, CTRU
  finanzas: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_GASTOS, PERMISOS.CREAR_GASTO,
    PERMISOS.VER_TESORERIA, PERMISOS.GESTIONAR_TESORERIA,
    PERMISOS.VER_REPORTES, PERMISOS.VER_CTRU,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_AUDITORIA,
  ],

  // Supervisor: solo lectura en todos los módulos
  supervisor: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_COTIZACIONES,
    PERMISOS.VER_ENTREGAS,
    PERMISOS.VER_REQUERIMIENTOS,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_INVENTARIO,
    PERMISOS.VER_GASTOS,
    PERMISOS.VER_TESORERIA,
    PERMISOS.VER_REPORTES,
    PERMISOS.VER_CTRU,
    PERMISOS.VER_AUDITORIA,
  ],

  // Invitado: sin permisos
  invitado: [],
};

// 5. Labels para mostrar en la UI
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente General',
  vendedor: 'Vendedor',
  comprador: 'Comprador',
  almacenero: 'Almacenero',
  finanzas: 'Finanzas',
  supervisor: 'Supervisor',
  invitado: 'Invitado',
};

// 6. Descripciones cortas de cada rol
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Acceso total al sistema. Gestiona usuarios, configuración y todos los módulos.',
  gerente: 'Ve y gestiona todos los módulos operativos. No gestiona usuarios ni configuración del sistema.',
  vendedor: 'Crea y gestiona ventas, cotizaciones, entregas. Puede crear requerimientos y ver inventario.',
  comprador: 'Gestiona requerimientos y órdenes de compra. Controla la recepción de mercadería.',
  almacenero: 'Gestiona inventario, recibe órdenes de compra y realiza transferencias entre almacenes.',
  finanzas: 'Gestiona gastos, tesorería, reportes financieros y CTRU. Ve ventas y compras como referencia.',
  supervisor: 'Acceso de solo lectura a todos los módulos. No puede crear ni modificar registros.',
  invitado: 'Sin acceso al sistema. Cuenta pendiente de asignación de rol.',
};
