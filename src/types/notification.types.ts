import type { Timestamp } from 'firebase/firestore';

/**
 * Tipos de notificación del sistema
 *
 * Incluye tanto notificaciones operativas (reservas, stock disponible) como
 * notificaciones automáticas de inventario (stock crítico, vencimientos).
 */
export type TipoNotificacion =
  // Notificaciones de ventas y reservas
  | 'stock_disponible'      // Llegó stock para una venta reservada
  | 'reserva_por_vencer'    // La reserva está por vencer
  | 'reserva_vencida'       // La reserva ya venció
  | 'pago_recibido'         // Se recibió un pago
  | 'requerimiento_urgente' // Hay un requerimiento urgente
  // Notificaciones de inventario
  | 'stock_critico'         // Stock bajo el mínimo crítico
  | 'stock_bajo'            // Stock bajo de un producto
  | 'producto_por_vencer'   // Producto próximo a vencer
  | 'producto_vencido'      // Producto ya vencido
  // Notificaciones de operaciones
  | 'nueva_venta'           // Nueva venta registrada
  | 'venta_entregada'       // Venta entregada al cliente
  | 'orden_recibida'        // Orden de compra recibida
  | 'orden_en_transito'     // Orden en tránsito
  | 'usuario_nuevo'         // Nuevo usuario creado
  | 'sistema'               // Notificación del sistema
  | 'alerta'                // Alerta genérica
  // Notificaciones de aprobación
  | 'aprobacion_pendiente'  // Falta una firma en aprobación dual
  | 'cobro_vencido'         // Cobro pendiente de venta vencido
  | 'general';              // Notificación general

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
 * Notificación del sistema — modelo canónico unificado
 */
export interface SystemNotification {
  id: string;
  tipo: TipoNotificacion;
  prioridad: PrioridadNotificacion;
  titulo: string;
  mensaje: string;
  detalles?: string;
  // Referencias a entidades relacionadas
  ventaId?: string;
  productoId?: string;
  requerimientoId?: string;
  entidadTipo?: 'producto' | 'venta' | 'orden' | 'usuario' | 'inventario';
  entidadId?: string;
  // Para notificaciones dirigidas a un usuario específico (null = todos)
  usuarioId?: string;
  // Metadata adicional libre
  metadata?: Record<string, unknown>;
  // Acciones interactivas
  acciones?: AccionNotificacion[];
  // Estado
  leida: boolean;
  accionada: boolean;
  fechaAccion?: Timestamp;
  fechaCreacion: Timestamp;
  fechaLeida?: Timestamp;
  fechaExpiracion?: Timestamp;
  creadoPor: string;
}

/**
 * Payload para crear una nueva notificación
 */
export type SystemNotificationCreate = Omit<
  SystemNotification,
  'id' | 'fechaCreacion' | 'leida' | 'accionada'
>;

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
  porTipo: Partial<Record<TipoNotificacion, number>>;
}

export interface NotificationFilters {
  tipo?: TipoNotificacion;
  prioridad?: PrioridadNotificacion;
  soloNoLeidas?: boolean;
  ventaId?: string;
  productoId?: string;
  usuarioId?: string;
  limite?: number;
}
