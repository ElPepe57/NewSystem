import type { Timestamp } from 'firebase/firestore';
import type { MetodoPago } from './venta.types';

// ================================================================
// ENUMERACIONES
// ================================================================

/**
 * Motivo de la devolución
 */
export type MotivoDevolucion =
  | 'producto_danado'          // El producto llegó dañado al cliente
  | 'producto_equivocado'      // Se envió el producto incorrecto
  | 'no_cumple_expectativa'    // El cliente no quedó satisfecho
  | 'vencido_proximo'          // El producto está próximo a vencerse
  | 'duplicado'                // Pedido duplicado
  | 'error_pedido'             // Error en el pedido (cantidad, modelo, etc.)
  | 'otro';                    // Otro motivo (requiere detalleMotivo)

/**
 * Estado del flujo de devolución
 *
 * Flujo normal:
 *   solicitada → aprobada → ejecutada → completada
 * Flujo alternativo:
 *   solicitada → rechazada  (admin rechaza la solicitud)
 *   solicitada → cancelada  (solicitante cancela antes de aprobación)
 */
export type EstadoDevolucion =
  | 'solicitada'    // Solicitud creada, pendiente de aprobación
  | 'aprobada'      // Admin aprobó — pendiente de recepción física
  | 'rechazada'     // Admin rechazó la solicitud
  | 'ejecutada'     // Producto recibido físicamente, inventario actualizado
  | 'completada'    // Dinero devuelto al cliente
  | 'cancelada';    // Cancelada antes de ser aprobada

/**
 * Condición física del producto al ser devuelto
 */
export type CondicionProductoDevuelto =
  | 'vendible'  // El producto puede volver al inventario disponible
  | 'danado';   // El producto está dañado, va a estado 'danada'

// ================================================================
// INTERFACES PRINCIPALES
// ================================================================

/**
 * Línea de producto dentro de una devolución.
 * Representa la cantidad devuelta de un SKU específico.
 */
export interface ProductoDevolucion {
  productoId: string;
  sku: string;
  nombreProducto: string;

  /** Cantidad de unidades a devolver */
  cantidad: number;

  /** Precio al que se vendió originalmente (PEN por unidad) */
  precioUnitarioOriginal: number;

  /** cantidad × precioUnitarioOriginal */
  subtotalDevolucion: number;

  /** IDs de las unidades físicas que se devuelven (se conocen al ejecutar) */
  unidadesIds: string[];

  /** Condición física al recibirlas — se establece al ejecutar (paso 4) */
  condicion?: CondicionProductoDevuelto;

  /** CTRU promedio de las unidades devueltas (para recalcular impacto de costo) */
  ctruPromedio?: number;
}

/**
 * Documento principal de devolución.
 * Colección Firestore: `devoluciones`
 */
export interface Devolucion {
  id: string;

  /** Número de devolución legible: DEV-2026-001 */
  numeroDevolucion: string;

  // === Venta de origen ===
  ventaId: string;
  ventaNumero: string;

  // === Cliente ===
  clienteNombre: string;
  clienteId?: string;

  // === Líneas de producto ===
  productos: ProductoDevolucion[];

  // === Motivo ===
  motivo: MotivoDevolucion;
  /** Detalle obligatorio cuando motivo === 'otro' */
  detalleMotivo?: string;

  // === Montos ===
  /** Monto total a devolver al cliente (suma de subtotales) */
  montoDevolucion: number;
  /** Monto efectivamente devuelto (se establece al completar) */
  montoDevuelto: number;

  // === Estado ===
  estado: EstadoDevolucion;

  // === Fechas del flujo ===
  fechaCreacion: Timestamp;
  fechaAprobacion?: Timestamp;
  fechaRechazo?: Timestamp;
  fechaEjecucion?: Timestamp;       // Cuando se recibió el producto
  fechaCompletado?: Timestamp;      // Cuando se devolvió el dinero

  // === Devolución de dinero ===
  metodoPago?: MetodoPago;
  referenciaPago?: string;
  /** ID del movimiento en tesorería generado al completar */
  tesoreriaMovimientoId?: string;
  cuentaOrigenId?: string;

  // === Aprobación / rechazo ===
  aprobadoPor?: string;
  motivoRechazo?: string;
  rechazadoPor?: string;

  // === Cancelación ===
  motivoCancelacion?: string;
  canceladoPor?: string;

  // === Auditoría ===
  creadoPor: string;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;

  // === Línea de negocio (heredada de la venta) ===
  lineaNegocioId?: string;
  lineaNegocioNombre?: string;
}

// ================================================================
// TIPOS DE INPUT PARA CADA OPERACIÓN
// ================================================================

/**
 * Datos requeridos para crear una solicitud de devolución.
 */
export interface DevolucionInput {
  ventaId: string;
  productos: Array<{
    productoId: string;
    sku: string;
    nombreProducto: string;
    cantidad: number;
    precioUnitarioOriginal: number;
    /** IDs de unidades concretas (opcional al crear; obligatorio al ejecutar) */
    unidadesIds?: string[];
  }>;
  motivo: MotivoDevolucion;
  detalleMotivo?: string;
}

/**
 * Datos requeridos para ejecutar la recepción física del producto.
 * Se completan cuando el almacenero recibe el producto del cliente.
 */
export interface RecepcionDevolucionInput {
  devolucionId: string;
  /** Para cada producto, indica las unidades recibidas y su condición */
  productosRecibidos: Array<{
    productoId: string;
    unidadesIds: string[];           // IDs de unidades que vuelven al inventario
    condicion: CondicionProductoDevuelto;
  }>;
  notas?: string;
}

/**
 * Datos requeridos para registrar la devolución de dinero al cliente
 * y completar el ciclo de devolución.
 */
export interface DevolucionDineroInput {
  devolucionId: string;
  monto: number;
  metodoPago: MetodoPago;
  referencia?: string;
  cuentaOrigenId?: string;
  notas?: string;
}

// ================================================================
// FILTROS Y ESTADÍSTICAS
// ================================================================

export interface DevolucionFiltros {
  estado?: EstadoDevolucion;
  ventaId?: string;
  clienteId?: string;
  motivo?: MotivoDevolucion;
  lineaNegocioId?: string;
  /** Fecha desde (inclusive) */
  fechaDesde?: Date;
  /** Fecha hasta (inclusive) */
  fechaHasta?: Date;
}

export interface DevolucionStats {
  total: number;
  porEstado: Record<EstadoDevolucion, number>;
  montoTotalSolicitado: number;
  montoTotalDevuelto: number;
  porMotivo: Partial<Record<MotivoDevolucion, number>>;
  productosVendibles: number;   // Unidades devueltas en condición vendible
  productosDanados: number;     // Unidades devueltas en condición dañada
}
