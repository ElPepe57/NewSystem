import type { Timestamp } from 'firebase/firestore';
import type {
  CanalVenta,
  MetodoPago,
  TipoReserva,
  ProductoReservado,
  ProductoStockVirtual
} from './venta.types';
import type {
  ReservaStockMultiAlmacen,
  FuenteStock
} from './stockDisponibilidad.types';

/**
 * Estado del flujo de cotización
 *
 * Flujo SIN adelanto:
 *   nueva → validada → confirmada (venta con 7 días vigencia)
 *
 * Flujo CON adelanto:
 *   nueva → pendiente_adelanto → adelanto_pagado → confirmada (venta con 90 días vigencia)
 *                             ↘ vencida (no pagó a tiempo)
 *
 * Rechazo (cualquier estado):
 *   → rechazada (archivada para análisis de mercado)
 */
export type EstadoCotizacion =
  | 'nueva'               // Cotización creada, esperando respuesta del cliente
  | 'validada'            // Cliente aceptó SIN adelanto (7 días para confirmar)
  | 'pendiente_adelanto'  // Cliente aceptó CON adelanto comprometido (espera pago)
  | 'adelanto_pagado'     // Adelanto recibido, stock reservado (90 días vigencia)
  | 'con_abono'           // @deprecated Legacy: equivalente a 'adelanto_pagado'
  | 'confirmada'          // Convertida en venta (referencia a ventaId)
  | 'rechazada'           // Cliente rechazó la cotización
  | 'vencida';            // Expiró sin respuesta/pago

/**
 * Motivo de rechazo de cotización (para análisis de demanda)
 */
export type MotivoRechazo =
  | 'precio_alto'           // Consideró el precio muy alto
  | 'encontro_mejor_opcion' // Encontró otra opción más económica
  | 'sin_presupuesto'       // No tiene presupuesto actualmente
  | 'producto_diferente'    // Quería otro producto/especificación
  | 'demora_entrega'        // Tiempo de entrega muy largo
  | 'cambio_necesidad'      // Ya no necesita el producto
  | 'sin_respuesta'         // No respondió (timeout)
  | 'otro';                 // Otro motivo

/**
 * Información de rechazo para análisis
 */
export interface RechazoInfo {
  motivo: MotivoRechazo;
  descripcion?: string;              // Detalle adicional del cliente
  precioEsperado?: number;           // Si rechazó por precio, qué esperaba pagar
  competidor?: string;               // Si fue a la competencia, cuál
  fechaRechazo: Timestamp;
  registradoPor: string;
}

/**
 * Producto en la cotización
 */
export interface ProductoCotizacion {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;

  cantidad: number;
  precioUnitario: number;    // Precio cotizado en PEN
  subtotal: number;          // cantidad × precioUnitario

  // Información de stock al momento de cotizar
  stockDisponible?: number;  // Cuántas unidades había disponibles
  requiereStock?: boolean;   // true si no hay stock suficiente

  // ========== Disponibilidad Multi-Almacén ==========
  disponibilidadMultiAlmacen?: {
    // Stock por ubicación
    stockPeru: number;         // Disponible en Perú (inmediato)
    stockUSA: number;          // Disponible en USA (requiere importación)
    stockTotal: number;        // Total disponible

    // Distribución sugerida
    fuenteRecomendada: FuenteStock;
    cantidadDesdePeru?: number;
    cantidadDesdeUSA?: number;
    cantidadVirtual?: number;  // Sin stock, genera requerimiento

    // Tiempos estimados
    tiempoEstimadoLlegadaDias?: number;
    fechaEstimadaDisponible?: Timestamp;

    // Costos
    costoEstimadoUSD?: number;
    costoFleteEstimadoUSD?: number;
  };
}

/**
 * Adelanto COMPROMETIDO (antes del pago)
 * Se muestra en el PDF como referencia para el cliente
 */
export interface AdelantoComprometido {
  monto: number;
  porcentaje: number;           // % del total (ej: 30%)
  fechaCompromiso: Timestamp;   // Cuándo se acordó
  fechaLimitePago: Timestamp;   // Hasta cuándo debe pagar
  registradoPor: string;
}

/**
 * Adelanto PAGADO (después del pago)
 * Registrado cuando el cliente efectivamente paga
 */
export interface AdelantoPagado {
  id: string;
  monto: number;
  moneda: 'USD' | 'PEN';          // Moneda del pago
  tipoCambio?: number;            // TC aplicado si moneda es USD
  montoEquivalentePEN?: number;   // Monto equivalente en PEN (si es USD)
  metodoPago: MetodoPago;
  referencia?: string;
  comprobante?: string;         // URL del comprobante
  fecha: Timestamp;
  registradoPor: string;
  tesoreriaMovimientoId?: string; // Referencia al movimiento en tesorería
  cuentaDestinoId?: string;       // Cuenta de destino en tesorería
}

/**
 * @deprecated Usar AdelantoPagado en su lugar
 */
export interface AdelantoCotizacion extends AdelantoPagado {}

/**
 * Reserva de stock para la cotización (simple)
 * @deprecated Usar ReservaStockMultiAlmacen para reservas multi-almacén
 */
export interface ReservaStockCotizacion {
  activo: boolean;
  tipoReserva: TipoReserva;           // 'fisica' o 'virtual'
  fechaReserva: Timestamp;
  vigenciaHasta: Timestamp;
  horasVigencia: number;

  productosReservados: ProductoReservado[];

  // Para reserva virtual
  stockVirtual?: {
    productosVirtuales: ProductoStockVirtual[];
    requerimientoId?: string;         // ID del requerimiento generado
    fechaEstimadaStock?: Timestamp;
  };
}

/**
 * Reserva de stock multi-almacén para la cotización
 * Extiende ReservaStockMultiAlmacen con campos específicos de cotización
 */
export interface ReservaStockCotizacionMultiAlmacen extends Omit<ReservaStockMultiAlmacen, 'cotizacionOrigenId' | 'cotizacionOrigenNumero'> {
  // Tipo de reserva predominante
  tipoReservaPrincipal: 'peru' | 'usa' | 'mixta' | 'virtual';

  // Alertas para el usuario
  alertas?: Array<{
    tipo: 'info' | 'warning' | 'error';
    mensaje: string;
    productoId?: string;
  }>;
}

/**
 * Cotización - Documento principal en colección 'cotizaciones'
 */
export interface Cotizacion {
  id: string;
  numeroCotizacion: string;    // COT-2025-001

  // Cliente
  clienteId?: string;          // ID del cliente en el maestro
  nombreCliente: string;
  emailCliente?: string;
  telefonoCliente?: string;
  direccionEntrega?: string;
  dniRuc?: string;

  // Canal
  canal: CanalVenta;

  // Productos
  productos: ProductoCotizacion[];

  // Totales
  subtotalPEN: number;
  descuento?: number;
  costoEnvio?: number;
  incluyeEnvio: boolean;
  totalPEN: number;

  // Estado
  estado: EstadoCotizacion;

  // Fechas del flujo
  fechaCreacion: Timestamp;
  fechaValidacion?: Timestamp;     // Cuando cliente confirmó interés (sin adelanto)
  fechaCompromisoAdelanto?: Timestamp; // Cuando se comprometió adelanto
  fechaAdelanto?: Timestamp;       // Cuando se PAGÓ el adelanto
  fechaConfirmacion?: Timestamp;   // Cuando se convirtió en venta
  fechaRechazo?: Timestamp;        // Cuando fue rechazada
  fechaVencimiento?: Timestamp;    // Fecha límite de vigencia

  // Vigencia según tipo
  diasVigencia: number;            // 7 días sin adelanto, 90 días con adelanto

  // Adelanto comprometido (antes del pago)
  adelantoComprometido?: AdelantoComprometido;

  // Adelanto pagado (después del pago)
  adelanto?: AdelantoPagado;

  // Reserva de stock (SOLO cuando adelanto está PAGADO)
  // @deprecated Usar reservaStockMultiAlmacen para nuevas reservas
  reservaStock?: ReservaStockCotizacion;

  // Reserva de stock multi-almacén (nueva estructura)
  reservaStockMultiAlmacen?: ReservaStockCotizacionMultiAlmacen;

  // Requerimientos generados (si no hay stock)
  requerimientosIds?: string[];      // IDs de requerimientos generados
  requerimientosNumeros?: string[];  // Números de requerimientos (REQ-2025-XXX)

  // Rechazo (para análisis)
  rechazo?: RechazoInfo;

  // Referencia a venta (cuando se confirma)
  ventaId?: string;                // ID de la venta creada
  numeroVenta?: string;            // VT-2025-XXX

  // Análisis de demanda
  productosInteres?: string[];     // IDs de productos para tracking de demanda

  // Auditoría
  creadoPor: string;
  validadoPor?: string;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;

  // Observaciones
  observaciones?: string;
}

/**
 * Datos para crear una cotización
 */
export interface CotizacionFormData {
  clienteId?: string;
  nombreCliente: string;
  emailCliente?: string;
  telefonoCliente?: string;
  direccionEntrega?: string;
  dniRuc?: string;
  canal: CanalVenta;
  productos: Array<{
    productoId: string;
    cantidad: number;
    precioUnitario: number;
  }>;
  descuento?: number;
  costoEnvio?: number;
  incluyeEnvio?: boolean;
  observaciones?: string;
  diasVigencia?: number;           // Días de vigencia de la cotización
}

/**
 * Datos para COMPROMETER adelanto (antes del pago)
 */
export interface ComprometerAdelantoData {
  monto: number;
  porcentaje: number;              // % del total
  diasParaPagar?: number;          // Días límite para pagar (default: 3)
}

/**
 * Datos para registrar PAGO de adelanto
 */
export interface RegistrarAdelantoData {
  monto: number;                     // Monto en la moneda del pago
  metodoPago: MetodoPago;
  referencia?: string;
  cuentaDestinoId?: string;          // Para integración con tesorería
  moneda?: 'USD' | 'PEN';            // Moneda del pago (default: PEN)
  tipoCambio?: number;               // TC aplicado si moneda es USD
  montoEquivalentePEN?: number;      // Monto original comprometido en PEN (si pago es USD)
}

/**
 * Datos para rechazar cotización
 */
export interface RechazarCotizacionData {
  motivo: MotivoRechazo;
  descripcion?: string;
  precioEsperado?: number;
  competidor?: string;
}

/**
 * Estadísticas de cotizaciones
 */
export interface CotizacionStats {
  total: number;
  nuevas: number;
  validadas: number;              // Aceptadas sin adelanto
  pendienteAdelanto: number;      // Esperando pago de adelanto
  adelantoPagado: number;         // Adelanto pagado, stock reservado
  confirmadas: number;
  rechazadas: number;
  vencidas: number;

  // Alias para compatibilidad
  conAbono: number;               // = adelantoPagado (legacy)

  // Tasas de conversión
  tasaValidacion: number;          // (validadas + pendiente + pagado) / total
  tasaConversion: number;          // confirmadas / total
  tasaRechazo: number;             // rechazadas / total
  tasaPagoAdelanto: number;        // adelantoPagado / pendienteAdelanto (nuevo)

  // Montos
  montoTotalCotizado: number;
  montoConfirmado: number;
  montoPerdido: number;            // rechazadas + vencidas
  montoEsperandoPago: number;      // Cotizaciones pendiente_adelanto

  // Análisis de rechazo
  rechazosPorMotivo: Record<MotivoRechazo, number>;
  productosRechazados: Array<{
    productoId: string;
    nombreProducto: string;
    vezesRechazado: number;
    motivoPrincipal: MotivoRechazo;
  }>;
}

/**
 * Filtros para consultar cotizaciones
 */
export interface CotizacionFilters {
  estado?: EstadoCotizacion | EstadoCotizacion[];
  canal?: CanalVenta;
  clienteId?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
  montoMinimo?: number;
  montoMaximo?: number;
  productoId?: string;
}
