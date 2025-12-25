import type { Timestamp } from 'firebase/firestore';

/**
 * Tipos de notificación del sistema
 */
export type TipoNotificacion =
  | 'stock_disponible'     // Llegó stock para una venta reservada
  | 'reserva_por_vencer'   // La reserva está por vencer
  | 'reserva_vencida'      // La reserva ya venció
  | 'pago_recibido'        // Se recibió un pago
  | 'stock_bajo'           // Stock bajo de un producto
  | 'requerimiento_urgente' // Hay un requerimiento urgente
  | 'general';             // Notificación general

/**
 * Prioridad de la notificación
 */
export type PrioridadNotificacion = 'baja' | 'media' | 'alta' | 'urgente';

/**
 * Acción que puede tomar el usuario en la notificación
 */
export interface AccionNotificacion {
  id: string;
  label: string;
  tipo: 'primary' | 'secondary' | 'danger';
  accion: 'asignar_stock' | 'ver_venta' | 'ver_requerimiento' | 'extender_reserva' | 'cancelar_reserva' | 'ver_producto';
  parametros?: Record<string, string>;
}

/**
 * Notificación del sistema
 */
export interface SystemNotification {
  id: string;
  tipo: TipoNotificacion;
  prioridad: PrioridadNotificacion;
  titulo: string;
  mensaje: string;
  detalles?: string;
  ventaId?: string;
  productoId?: string;
  requerimientoId?: string;
  acciones?: AccionNotificacion[];
  leida: boolean;
  accionada: boolean;
  fechaAccion?: Timestamp;
  fechaCreacion: Timestamp;
  fechaExpiracion?: Timestamp;
  creadoPor: string;
}

export interface NotificacionStockDisponibleData {
  ventaId: string;
  numeroVenta: string;
  nombreCliente: string;
  productos: Array<{
    productoId: string;
    nombre: string;
    cantidadDisponible: number;
    cantidadRequerida: number;
  }>;
}

export interface NotificacionReservaPorVencerData {
  ventaId: string;
  numeroVenta: string;
  nombreCliente: string;
  horasRestantes: number;
  vigenciaHasta: Timestamp;
}

export interface NotificationCounts {
  total: number;
  noLeidas: number;
  urgentes: number;
  porTipo: Record<TipoNotificacion, number>;
}

export interface NotificationFilters {
  tipo?: TipoNotificacion;
  prioridad?: PrioridadNotificacion;
  soloNoLeidas?: boolean;
  ventaId?: string;
  productoId?: string;
  limite?: number;
}
