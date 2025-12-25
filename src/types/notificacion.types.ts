import type { Timestamp } from 'firebase/firestore';

export type TipoNotificacion =
  | 'stock_critico'
  | 'stock_bajo'
  | 'producto_vencido'
  | 'producto_por_vencer'
  | 'nueva_venta'
  | 'venta_entregada'
  | 'orden_recibida'
  | 'orden_en_transito'
  | 'usuario_nuevo'
  | 'sistema'
  | 'alerta';

export type PrioridadNotificacion = 'baja' | 'media' | 'alta' | 'urgente';

export interface Notificacion {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  prioridad: PrioridadNotificacion;
  leida: boolean;
  fechaCreacion: Timestamp;
  fechaLeida?: Timestamp;
  // Referencia opcional a entidad relacionada
  entidadTipo?: 'producto' | 'venta' | 'orden' | 'usuario' | 'inventario';
  entidadId?: string;
  // Para notificaciones dirigidas a usuarios específicos
  usuarioId?: string; // null = todos los usuarios
  // Metadata adicional
  metadata?: Record<string, any>;
}

export interface NotificacionCreate {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  prioridad: PrioridadNotificacion;
  entidadTipo?: 'producto' | 'venta' | 'orden' | 'usuario' | 'inventario';
  entidadId?: string;
  usuarioId?: string;
  metadata?: Record<string, any>;
}

export interface NotificacionStats {
  total: number;
  noLeidas: number;
  urgentes: number;
  porTipo: Record<TipoNotificacion, number>;
}

// Configuración de notificaciones por usuario
export interface NotificacionConfig {
  stockCritico: boolean;
  stockBajo: boolean;
  vencimientos: boolean;
  ventas: boolean;
  ordenes: boolean;
  sistema: boolean;
  sonido: boolean;
}

export const DEFAULT_NOTIFICACION_CONFIG: NotificacionConfig = {
  stockCritico: true,
  stockBajo: true,
  vencimientos: true,
  ventas: true,
  ordenes: true,
  sistema: true,
  sonido: true
};
