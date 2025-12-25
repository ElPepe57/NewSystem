import type { Timestamp } from 'firebase/firestore';

// Tipos de acciones que se pueden auditar
export type AccionAuditoria =
  // Autenticación
  | 'login'
  | 'logout'
  | 'login_fallido'
  // CRUD genérico
  | 'crear'
  | 'actualizar'
  | 'eliminar'
  | 'ver'
  // Inventario
  | 'ingreso_inventario'
  | 'salida_inventario'
  | 'ajuste_inventario'
  | 'transferencia'
  // Ventas
  | 'registrar_venta'
  | 'cancelar_venta'
  | 'entregar_venta'
  // Órdenes
  | 'crear_orden'
  | 'recibir_orden'
  | 'cancelar_orden'
  // Usuarios
  | 'crear_usuario'
  | 'modificar_usuario'
  | 'cambiar_rol'
  | 'desactivar_usuario'
  | 'resetear_password'
  // Sistema
  | 'exportar_datos'
  | 'configurar_sistema';

// Módulos del sistema
export type ModuloAuditoria =
  | 'auth'
  | 'usuarios'
  | 'productos'
  | 'inventario'
  | 'ventas'
  | 'cotizaciones'
  | 'ordenes_compra'
  | 'transferencias'
  | 'almacenes'
  | 'gastos'
  | 'tipo_cambio'
  | 'reportes'
  | 'configuracion';

// Nivel de importancia del log
export type NivelAuditoria = 'info' | 'warning' | 'error' | 'critical';

export interface AuditLog {
  id: string;
  // Quién realizó la acción
  usuarioId: string;
  usuarioEmail: string;
  usuarioNombre: string;
  usuarioRol: string;
  // Qué acción se realizó
  accion: AccionAuditoria;
  modulo: ModuloAuditoria;
  nivel: NivelAuditoria;
  // Descripción legible
  descripcion: string;
  // Entidad afectada
  entidadTipo?: string;
  entidadId?: string;
  entidadNombre?: string;
  // Datos antes y después (para cambios)
  datosAnteriores?: Record<string, any>;
  datosNuevos?: Record<string, any>;
  // Cambios específicos detectados
  cambios?: CambioDetectado[];
  // Metadata adicional
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  // Timestamps
  fechaCreacion: Timestamp;
}

export interface CambioDetectado {
  campo: string;
  valorAnterior: any;
  valorNuevo: any;
}

export interface AuditLogCreate {
  accion: AccionAuditoria;
  modulo: ModuloAuditoria;
  nivel?: NivelAuditoria;
  descripcion: string;
  entidadTipo?: string;
  entidadId?: string;
  entidadNombre?: string;
  datosAnteriores?: Record<string, any>;
  datosNuevos?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AuditLogFiltros {
  usuarioId?: string;
  modulo?: ModuloAuditoria;
  accion?: AccionAuditoria;
  nivel?: NivelAuditoria;
  fechaDesde?: Date;
  fechaHasta?: Date;
  entidadId?: string;
}

export interface AuditLogStats {
  totalHoy: number;
  totalSemana: number;
  totalMes: number;
  porModulo: Record<ModuloAuditoria, number>;
  porAccion: Record<string, number>;
  porUsuario: { usuarioId: string; nombre: string; cantidad: number }[];
  errores: number;
  warnings: number;
}
