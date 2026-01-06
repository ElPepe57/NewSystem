import type { Timestamp } from 'firebase/firestore';

/**
 * Canal de venta - ahora acepta IDs de canales dinámicos
 * Los valores legacy ('mercado_libre', 'directo', 'otro') se mantienen para compatibilidad
 */
export type CanalVenta = string;

export type EstadoVenta =
  | 'cotizacion'      // Solo cotización, no confirmada
  | 'reservada'       // Stock reservado por adelanto (pre-venta)
  | 'confirmada'      // Venta confirmada, pendiente de asignación
  | 'parcial'         // Algunos productos asignados, otros pendientes de stock
  | 'asignada'        // Unidades asignadas del inventario
  | 'en_entrega'      // En proceso de entrega
  | 'entrega_parcial' // Se entregó parte, quedan productos pendientes
  | 'entregada'       // Completada (todos los productos entregados)
  | 'cancelada'         // Cancelada
  | 'devuelta'          // Todas las unidades fueron devueltas
  | 'devolucion_parcial'; // Algunas unidades fueron devueltas

/**
 * Tipo de reserva de stock
 */
export type TipoReserva = 'fisica' | 'virtual';

/**
 * Estado del flujo de cotización (antes de convertirse en venta)
 * Flujo: nueva → validada → con_abono → (se convierte en reservada)
 */
export type EstadoCotizacion =
  | 'nueva'       // Cotización recién creada, pendiente de validación del cliente
  | 'validada'    // Cliente confirmó interés, pendiente de adelanto
  | 'con_abono';  // Adelanto recibido, se creará reserva

/**
 * Estado de asignación de un producto individual
 */
export type EstadoAsignacionProducto =
  | 'pendiente'       // Aún no asignado
  | 'asignado'        // Totalmente asignado
  | 'parcial'         // Parcialmente asignado
  | 'sin_stock';      // No hay stock disponible

/**
 * Estado de entrega de un producto individual
 */
export type EstadoEntregaProducto =
  | 'pendiente'       // No entregado
  | 'parcial'         // Parcialmente entregado
  | 'entregado';      // Totalmente entregado

/**
 * Registro de una entrega parcial
 */
export interface EntregaParcial {
  id: string;
  fecha: Timestamp;
  productosEntregados: Array<{
    productoId: string;
    cantidad: number;
    unidadesIds: string[];  // IDs de unidades entregadas
  }>;
  direccionEntrega?: string;
  notasEntrega?: string;
  registradoPor: string;
}

/**
 * Estado de pago de la venta
 */
export type EstadoPago =
  | 'pendiente'       // No se ha recibido ningún pago
  | 'parcial'         // Se recibió un adelanto o pago parcial
  | 'pagado';         // Pago completo recibido

/**
 * Métodos de pago aceptados
 */
export type MetodoPago =
  | 'efectivo'
  | 'transferencia'
  | 'yape'
  | 'plin'
  | 'tarjeta'
  | 'mercado_pago'    // Para ventas ML
  | 'paypal'          // Para pagos internacionales USD
  | 'zelle'           // Para pagos internacionales USD
  | 'otro';

/**
 * Datos de adelanto para pasar junto con la venta
 */
export interface AdelantoData {
  monto: number;
  metodoPago: MetodoPago;
  referencia?: string;
  cuentaDestinoId?: string;
}

// ========== PRE-VENTA CON BLOQUEO DE STOCK ==========

/**
 * Producto reservado en una pre-venta
 */
export interface ProductoReservado {
  productoId: string;
  sku: string;
  cantidad: number;
  unidadesReservadas: string[];  // IDs de unidades bloqueadas (vacío si es virtual)
}

/**
 * Producto con stock virtual (sin stock físico disponible)
 */
export interface ProductoStockVirtual {
  productoId: string;
  sku: string;
  nombreProducto: string;
  cantidadRequerida: number;
  cantidadDisponible: number;  // Lo que había al momento
  cantidadFaltante: number;    // Lo que falta conseguir
}

/**
 * Extensión de reserva
 */
export interface ExtensionReserva {
  fecha: Timestamp;
  horasExtendidas: number;
  nuevaVigencia: Timestamp;
  motivo?: string;
  extendidoPor: string;
}

/**
 * Stock reservado por adelanto
 * Sistema de bloqueo temporal de inventario
 */
export interface StockReservado {
  activo: boolean;
  tipoReserva: TipoReserva;           // 'fisica' o 'virtual'
  fechaReserva: Timestamp;
  vigenciaHasta: Timestamp;
  horasVigenciaOriginal: number;      // Default: 48 horas
  extensiones?: ExtensionReserva[];   // Historial de extensiones (max 3)
  adelantoId: string;                 // ID del pago de adelanto
  montoAdelanto: number;              // Monto del adelanto
  productosReservados: ProductoReservado[];

  // Para reserva virtual (sin stock físico)
  stockVirtual?: {
    productosVirtuales: ProductoStockVirtual[];
    requerimientoGenerado?: string;  // ID del requerimiento si se creó
    fechaEstimadaStock?: Timestamp;  // Fecha estimada de llegada
  };
}

/**
 * Registro de un pago individual
 */
export interface PagoVenta {
  id: string;
  monto: number;
  moneda?: 'PEN' | 'USD';     // Moneda del pago (default PEN)
  metodoPago: MetodoPago;
  referencia?: string;        // Número de operación, voucher, etc.
  comprobante?: string;       // URL del comprobante/foto
  fecha: Timestamp;
  registradoPor: string;
  notas?: string;

  // Tipo de cambio (si el pago fue en USD o si es relevante)
  tipoCambio?: number;        // TC al momento del pago
  montoEquivalentePEN?: number; // Monto convertido a PEN (si fue en USD)

  // Vinculación con Tesorería
  tesoreriaMovimientoId?: string; // ID del movimiento de tesorería asociado
  cuentaDestinoId?: string;       // ID de la cuenta de caja donde se registró
}

export interface ProductoVenta {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;

  cantidad: number;
  precioUnitario: number;    // Precio de venta en PEN
  subtotal: number;          // cantidad × precioUnitario

  // Unidades asignadas (cuando estado >= 'asignada' o 'parcial')
  unidadesAsignadas?: string[];  // IDs de unidades del inventario
  costoTotalUnidades?: number;   // Suma de CTRU de unidades asignadas
  margenReal?: number;           // (subtotal - costoTotalUnidades) / subtotal * 100

  // ========== Asignación Parcial ==========
  estadoAsignacion?: EstadoAsignacionProducto;  // Estado individual del producto
  cantidadAsignada?: number;      // Unidades efectivamente asignadas
  cantidadPendiente?: number;     // Unidades que faltan por conseguir
  fechaEstimadaStock?: Timestamp; // Fecha estimada para conseguir stock faltante
  notasStock?: string;            // Notas sobre el stock pendiente

  // ========== Entregas Parciales ==========
  estadoEntrega?: EstadoEntregaProducto;  // Estado de entrega del producto
  cantidadEntregada?: number;     // Unidades ya entregadas al cliente
  cantidadPorEntregar?: number;   // Unidades asignadas pero no entregadas aún
}

export interface Venta {
  id: string;
  numeroVenta: string;        // VT-2024-001

  // Cliente (puede estar vinculado al Gestor Maestro)
  clienteId?: string;         // ID del cliente en el maestro (si está vinculado)
  nombreCliente: string;
  emailCliente?: string;
  telefonoCliente?: string;
  direccionEntrega?: string;
  dniRuc?: string;

  // Canal
  canal: CanalVenta;

  // Productos
  productos: ProductoVenta[];

  // Totales
  subtotalPEN: number;        // Suma de productos
  descuento?: number;         // Descuento aplicado
  costoEnvio?: number;        // Costo de delivery al cliente (PEN)
  incluyeEnvio: boolean;      // true = envío gratuito, false = cliente paga
  totalPEN: number;           // subtotal - descuento + (incluyeEnvio ? 0 : costoEnvio)

  // ========== Gastos de Venta (afectan la utilidad real) ==========
  // Estos gastos se restan de la utilidad bruta para obtener la utilidad neta
  costoEnvioNegocio?: number;   // Delivery asumido por el negocio (no cliente) en PEN
  comisionML?: number;          // Comisión de MercadoLibre en PEN
  comisionMLPorcentaje?: number; // Porcentaje de comisión ML aplicado
  costoEnvioML?: number;        // Costo de envío que cobra ML (si aplica)
  otrosGastosVenta?: number;    // Otros gastos directos de la venta

  // Rentabilidad (calculada después de asignar unidades)
  costoTotalPEN?: number;     // Suma de costos de todas las unidades (CTRU)
  gastosVentaPEN?: number;    // Suma de gastos de venta (envío + comisiones)
  utilidadBrutaPEN?: number;  // totalPEN - costoTotalPEN
  utilidadNetaPEN?: number;   // utilidadBrutaPEN - gastosVentaPEN (utilidad real)
  margenBruto?: number;       // utilidadBruta / totalPEN * 100
  margenNeto?: number;        // utilidadNeta / totalPEN * 100 (margen real)
  margenPromedio?: number;    // Alias de margenBruto para compatibilidad

  // ========== Tipo de Cambio ==========
  tcVenta?: number;           // TC al momento de crear/cotizar la venta
  tcCobro?: number;           // TC al momento de cobrar (si aplica)
  diferenciaTC?: number;      // Ganancia/pérdida por diferencia de TC

  // ========== Expectativa de Cotización ==========
  // Se guarda al crear cotización para comparar con la realidad al vender
  expectativaCotizacion?: {
    tcCotizacion: number;             // TC al momento de cotizar
    costoEstimadoUSD: number;         // Costo USD esperado (basado en CTRU actual)
    costoEstimadoPEN: number;         // costoEstimadoUSD × tcCotizacion
    margenEsperado: number;           // % de margen esperado
    utilidadEsperadaPEN: number;      // Utilidad esperada
    vigenciaHasta?: Timestamp;        // Fecha de vigencia de la cotización
    productosEstimados?: Array<{
      productoId: string;
      costoUnitarioEstimadoUSD: number;
      margenEstimado: number;
    }>;
  };

  // ========== Comparación Expectativa vs Realidad ==========
  // Se calcula al asignar unidades reales
  comparacionExpectativa?: {
    costoRealUSD: number;             // Costo real de las unidades asignadas
    costoRealPEN: number;             // Costo real en PEN (con TC de las unidades)
    margenReal: number;               // Margen real obtenido
    utilidadRealPEN: number;          // Utilidad real

    // Diferencias
    diferenciaTC: number;             // tcVenta - tcCotizacion
    diferenciaCostoPEN: number;       // costoReal - costoEstimado
    diferenciaMargen: number;         // margenReal - margenEsperado
    diferenciaUtilidadPEN: number;    // utilidadReal - utilidadEsperada

    // Indicadores
    cumplioExpectativa: boolean;      // true si utilidadReal >= utilidadEsperada
    porcentajeCumplimiento: number;   // (utilidadReal / utilidadEsperada) × 100
  };

  // ========== NUEVO: Estado de Pago ==========
  estadoPago: EstadoPago;     // pendiente, parcial, pagado
  pagos?: PagoVenta[];        // Historial de pagos
  montoPagado: number;        // Suma de todos los pagos
  montoPendiente: number;     // totalPEN - montoPagado
  fechaPagoCompleto?: Timestamp; // Cuando se completó el pago

  // Sobrepago (cuando cliente paga de más)
  saldoAFavor?: number;       // Monto excedente a favor del cliente
  tieneSobrepago?: boolean;   // Flag para identificar ventas con sobrepago

  // Estado y fechas
  estado: EstadoVenta;
  fechaCreacion: Timestamp;
  fechaConfirmacion?: Timestamp;
  fechaAsignacion?: Timestamp;
  fechaEntrega?: Timestamp;

  // Entrega
  direccionEntregaFinal?: string;
  notasEntrega?: string;

  // ML específico
  mercadoLibreId?: string;     // ID de la venta en ML

  // Observaciones
  observaciones?: string;

  // ========== Cotizaciones sin stock ==========
  requiereStock?: boolean;     // true si la cotización incluye productos sin stock
  productosConFaltante?: Array<{
    nombre: string;
    disponibles: number;
    solicitados: number;
  }> | null;
  fechaEstimadaEntrega?: Timestamp;  // Fecha estimada si requiere stock

  // ========== Flujo de Cotización ==========
  estadoCotizacion?: EstadoCotizacion;  // Estado en el flujo: nueva → validada → con_abono
  fechaValidacion?: Timestamp;          // Cuando el cliente confirmó interés
  validadoPor?: string;                 // Usuario que validó

  // ========== Origen de Cotización ==========
  cotizacionOrigenId?: string;          // ID de la cotización que originó esta venta
  numeroCotizacionOrigen?: string;      // Número de cotización (COT-2025-XXX)

  // ========== Asignación Parcial ==========
  tieneAsignacionParcial?: boolean;  // true si hay productos parcialmente asignados
  productosAsignados?: number;       // Cantidad de productos totalmente asignados
  productosPendientes?: number;      // Cantidad de productos pendientes de stock

  // ========== Entregas Parciales ==========
  entregas?: EntregaParcial[];       // Historial de entregas realizadas
  totalEntregas?: number;            // Número total de entregas realizadas
  productosEntregados?: number;      // Cantidad de productos completamente entregados
  productosPorEntregar?: number;     // Cantidad de productos con unidades por entregar

  // ========== Pre-Venta con Bloqueo de Stock ==========
  stockReservado?: StockReservado;   // Si hay reserva activa por adelanto

  // Auditoría
  creadoPor: string;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;
}

export interface VentaFormData {
  // Cliente (puede estar vinculado a un cliente del maestro o ser datos sueltos)
  clienteId?: string;         // ID del cliente en el maestro (si está vinculado)
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
  costoEnvio?: number;        // Costo de delivery al cliente (PEN)
  incluyeEnvio?: boolean;     // true = envío gratuito, false = cliente paga

  // ========== Gastos de Venta ==========
  costoEnvioNegocio?: number;   // Delivery asumido por el negocio
  comisionML?: number;          // Comisión de MercadoLibre en PEN
  comisionMLPorcentaje?: number; // Porcentaje de comisión ML (si se conoce)
  costoEnvioML?: number;        // Costo de envío de ML (si aplica)
  otrosGastosVenta?: number;    // Otros gastos directos

  mercadoLibreId?: string;
  observaciones?: string;
}

export interface AsignacionUnidad {
  unidadId: string;
  productoId: string;
  sku: string;
  codigoUnidad: string;
  ctru: number;
  fechaVencimiento?: Timestamp;
}

export interface ResultadoAsignacion {
  productoId: string;
  cantidadSolicitada: number;
  cantidadAsignada: number;
  unidadesAsignadas: AsignacionUnidad[];
  unidadesFaltantes: number;
}

export interface VentaStats {
  totalVentas: number;
  cotizaciones: number;
  confirmadas: number;
  enProceso: number;
  entregadas: number;
  canceladas: number;
  
  ventasTotalPEN: number;
  utilidadTotalPEN: number;
  margenPromedio: number;
  
  // Por canal
  ventasML: number;
  ventasDirecto: number;
  ventasOtro: number;
}

export interface ProductoDisponible {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;

  unidadesDisponibles: number;
  precioSugerido: number;
  margenObjetivo: number;

  // Datos de investigación de mercado (si existe)
  investigacion?: {
    precioPERUMin: number;
    precioPERUMax: number;
    precioPERUPromedio: number;
    precioEntrada: number;        // precioPERUMin * 0.95 (precio competitivo)
    ctruEstimado: number;         // Costo total real unitario
    margenEstimado: number;       // Margen esperado
    demandaEstimada: 'baja' | 'media' | 'alta';
    fechaInvestigacion?: Date;
  };
}