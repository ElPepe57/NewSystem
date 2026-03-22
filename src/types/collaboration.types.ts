import { Timestamp } from 'firebase/firestore';
import type { UserRole } from './auth.types';

// ============================================================
// PRESENCIA
// ============================================================

export type EstadoPresencia = 'online' | 'away' | 'offline';

export interface PresenciaUsuario {
  uid: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  estado: EstadoPresencia;
  ultimaActividad: Timestamp;
  paginaActual?: string;
}

// ============================================================
// ACTIVIDAD
// ============================================================

export type TipoActividad =
  // Ventas
  | 'venta_creada'
  | 'venta_confirmada'
  | 'venta_cancelada'
  | 'venta_entregada'
  // Cotizaciones
  | 'cotizacion_creada'
  | 'cotizacion_validada'
  // Requerimientos
  | 'requerimiento_creado'
  | 'requerimiento_aprobado'
  // Ordenes de Compra
  | 'oc_creada'
  | 'oc_recibida'
  // Entregas
  | 'entrega_programada'
  | 'entrega_completada'
  | 'entrega_fallida'
  // Tesorería
  | 'pago_registrado'
  | 'gasto_creado'
  | 'conversion_registrada'
  // Devoluciones
  | 'devolucion_solicitada'
  | 'devolucion_aprobada'
  | 'devolucion_rechazada'
  | 'devolucion_ejecutada'
  | 'devolucion_completada'
  | 'devolucion_cancelada'
  // Inventario
  | 'unidades_recibidas'
  | 'transferencia_creada'
  // Llamadas
  | 'llamada_iniciada'
  // Sistema
  | 'usuario_conectado'
  | 'usuario_desconectado';

export interface ActividadReciente {
  id: string;
  tipo: TipoActividad;
  mensaje: string;
  userId: string;
  displayName: string;
  timestamp: Timestamp;
  metadata?: {
    entidadId?: string;
    entidadTipo?: string;
    monto?: number;
    moneda?: string;
  };
}

export interface ActividadFormData {
  tipo: TipoActividad;
  mensaje: string;
  userId: string;
  displayName: string;
  metadata?: ActividadReciente['metadata'];
}

// ============================================================
// CHAT
// ============================================================

export interface ChatMensaje {
  id: string;
  texto: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  timestamp: Timestamp;
  canalId?: string; // 'general' | 'dm_uid1_uid2'
}

export interface ChatMeta {
  ultimoMensaje: Timestamp;
  ultimoUsuario: string;
}

// ============================================================
// LLAMADAS (Call Signaling)
// ============================================================

export type TipoLlamada = 'equipo' | 'directa';

export type EstadoLlamada = 'sonando' | 'activa' | 'finalizada' | 'rechazada' | 'no_contestada';

export interface LlamadaActiva {
  id: string;
  tipo: TipoLlamada;
  estado: EstadoLlamada;
  creadorId: string;
  creadorNombre: string;
  creadorRole?: UserRole;
  creadorPhotoURL?: string;
  destinatarioId?: string;
  destinatarioNombre?: string;
  participantes: string[];
  roomName: string;
  roomUrl?: string;
  creadoEn: Timestamp;
  respondidoEn?: Timestamp;
  finalizadoEn?: Timestamp;
}

/** Timeout de ring antes de marcar como no_contestada (30s) */
export const LLAMADA_RING_TIMEOUT_MS = 30_000;

// ============================================================
// HELPERS
// ============================================================

/** Iconos y colores por tipo de actividad para el feed */
export const ACTIVIDAD_CONFIG: Record<TipoActividad, { emoji: string; color: string }> = {
  venta_creada:          { emoji: '🛒', color: 'text-green-600' },
  venta_confirmada:      { emoji: '✅', color: 'text-green-700' },
  venta_cancelada:       { emoji: '❌', color: 'text-red-600' },
  venta_entregada:       { emoji: '📦', color: 'text-blue-600' },
  cotizacion_creada:     { emoji: '📋', color: 'text-purple-600' },
  cotizacion_validada:   { emoji: '✔️', color: 'text-purple-700' },
  requerimiento_creado:  { emoji: '📝', color: 'text-orange-600' },
  requerimiento_aprobado:{ emoji: '👍', color: 'text-orange-700' },
  oc_creada:             { emoji: '🏷️', color: 'text-indigo-600' },
  oc_recibida:           { emoji: '📥', color: 'text-indigo-700' },
  entrega_programada:    { emoji: '🚚', color: 'text-cyan-600' },
  entrega_completada:    { emoji: '🎉', color: 'text-cyan-700' },
  entrega_fallida:       { emoji: '⚠️', color: 'text-red-500' },
  pago_registrado:       { emoji: '💰', color: 'text-emerald-600' },
  gasto_creado:          { emoji: '💸', color: 'text-amber-600' },
  conversion_registrada: { emoji: '🔄', color: 'text-teal-600' },
  devolucion_solicitada: { emoji: '↩️', color: 'text-amber-500' },
  devolucion_aprobada:   { emoji: '↩️', color: 'text-amber-600' },
  devolucion_rechazada:  { emoji: '🚫', color: 'text-red-600' },
  devolucion_ejecutada:  { emoji: '📦', color: 'text-amber-700' },
  devolucion_completada: { emoji: '✅', color: 'text-green-600' },
  devolucion_cancelada:  { emoji: '❌', color: 'text-gray-500' },
  unidades_recibidas:    { emoji: '📦', color: 'text-sky-600' },
  transferencia_creada:  { emoji: '🔀', color: 'text-violet-600' },
  llamada_iniciada:      { emoji: '📞', color: 'text-green-600' },
  usuario_conectado:     { emoji: '🟢', color: 'text-green-500' },
  usuario_desconectado:  { emoji: '⚫', color: 'text-gray-400' },
};

/** Umbral en milisegundos para considerar un usuario "online" (3 minutos) */
export const PRESENCE_THRESHOLD_MS = 3 * 60 * 1000;

/** Intervalo de heartbeat en milisegundos (2 minutos) */
export const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;
