import type { Timestamp } from 'firebase/firestore';

// Estado logístico de la orden (ciclo de vida del producto físico)
export type EstadoOrden =
  | 'borrador'      // Creada pero no enviada
  | 'enviada'       // Enviada al proveedor
  | 'en_transito'   // Mercadería en camino
  | 'recibida'      // Recibida en almacén
  | 'cancelada';    // Cancelada

// Estado de pago (independiente del estado logístico)
export type EstadoPago =
  | 'pendiente'     // No pagada
  | 'pagada'        // Pago completado
  | 'pago_parcial'; // Pagada parcialmente

export type TipoProveedor =
  | 'fabricante'
  | 'distribuidor'
  | 'mayorista'
  | 'minorista';

// ========== SRM - EVALUACIÓN DE PROVEEDORES ==========

/**
 * Clasificación de proveedor basada en evaluación
 */
export type ClasificacionProveedor =
  | 'preferido'     // >=80 pts, sin problemas recientes
  | 'aprobado'      // 60-79 pts
  | 'condicional'   // 40-59 pts, requiere seguimiento
  | 'suspendido';   // <40 pts o problemas graves

/**
 * Factores de evaluación del proveedor (0-25 cada uno)
 */
export interface FactoresEvaluacionProveedor {
  calidadProductos: number;     // 0-25 (% sin defectos)
  puntualidadEntrega: number;   // 0-25 (% entregas a tiempo)
  competitividadPrecios: number;// 0-25 (vs mercado)
  comunicacion: number;         // 0-25 (manual/override)
}

/**
 * Evaluación del proveedor
 */
export interface EvaluacionProveedor {
  puntuacion: number;             // 0-100 (calculado)
  clasificacion: ClasificacionProveedor;
  factores: FactoresEvaluacionProveedor;
  ultimoCalculo: Timestamp;
  calculoAutomatico: boolean;     // false si fue override manual
}

/**
 * Historial de evaluación del proveedor
 */
export interface HistorialEvaluacionProveedor {
  fecha: Timestamp;
  puntuacion: number;
  factores: FactoresEvaluacionProveedor;
  notas?: string;
  evaluadoPor: string;
}

/**
 * Métricas del proveedor para evaluación
 */
export interface MetricasProveedor {
  ordenesCompra: number;
  montoTotalUSD: number;
  ultimaCompra?: Timestamp;
  productosComprados: string[];
  // Métricas de evaluación automática
  ordenesCompletadas: number;
  ordenesConProblemas: number;
  tasaProblemas: number;            // %
  tiempoEntregaPromedioDias: number;
  desviacionTiempoEntrega: number;  // días
  // Métricas de investigación
  productosAnalizados?: number;
  precioPromedio?: number;
  ultimaInvestigacion?: Timestamp;
}

export interface Proveedor {
  id: string;
  codigo: string;                    // PRV-001, PRV-002, etc.
  nombre: string;
  tipo: TipoProveedor;
  url: string;                       // URL del sitio web del proveedor (obligatorio)
  contacto?: string;                 // Nombre de contacto
  email?: string;
  telefono?: string;
  direccion?: string;
  pais: string;
  notasInternas?: string;
  activo: boolean;

  // Métricas (desnormalizadas para reportes rápidos)
  metricas?: MetricasProveedor;

  // ========== SRM - Evaluación ==========
  evaluacion?: EvaluacionProveedor;
  evaluacionesHistorial?: HistorialEvaluacionProveedor[];

  // Auditoría
  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;
}

export interface ProductoOrden {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  cantidad: number;
  costoUnitario: number;    // Precio por unidad en USD
  subtotal: number;         // cantidad × costoUnitario
}

/**
 * Registro de pago de orden de compra
 * Permite pagos en USD o PEN con tracking de conversión
 */
export interface PagoOrdenCompra {
  id: string;                       // PAG-OC-{timestamp}
  fecha: Timestamp;                 // Fecha real del pago

  // Moneda y montos
  monedaPago: 'USD' | 'PEN';       // Moneda en la que se pagó
  montoOriginal: number;            // Monto en la moneda de pago
  montoUSD: number;                 // Equivalente en USD
  montoPEN: number;                 // Equivalente en PEN

  // Tipo de cambio
  tipoCambio: number;               // TC usado para conversión

  // Cuenta y método
  metodoPago: string;               // transferencia_bancaria, zelle, paypal, etc.
  cuentaOrigenId?: string;          // ID de la cuenta de tesorería
  cuentaOrigenNombre?: string;      // Nombre de la cuenta (desnormalizado)

  // Referencias
  referencia?: string;              // Nro de operación, voucher, etc.
  notas?: string;

  // Tesorería
  movimientoTesoreriaId?: string;   // ID del movimiento en tesorería

  // Auditoría
  registradoPor: string;
  fechaRegistro: Timestamp;
}

export interface OrdenCompra {
  id: string;
  numeroOrden: string;        // OC-2024-001
  
  // Proveedor
  proveedorId: string;
  nombreProveedor: string;
  
  // Productos
  productos: ProductoOrden[];
  
  // Totales
  subtotalUSD: number;        // Suma de todos los productos (sin impuesto)
  impuestoUSD?: number;       // Sales Tax USA
  gastosEnvioUSD?: number;    // Gastos de envío/courier
  otrosGastosUSD?: number;    // Otros gastos adicionales
  totalUSD: number;           // subtotal + impuesto + gastos
  
  // Tipo de Cambio
  tcCompra?: number;          // TC al momento de crear la orden
  tcPago?: number;            // TC al momento del pago
  totalPEN?: number;          // totalUSD × tcPago
  
  // Diferencia cambiaria (si TC pago != TC compra)
  diferenciaCambiaria?: number;
  
  // Estados (logístico y financiero son independientes)
  estado: EstadoOrden;              // Estado logístico
  estadoPago: EstadoPago;           // Estado de pago (independiente)

  // Fechas logísticas
  fechaCreacion: Timestamp;
  fechaEnviada?: Timestamp;
  fechaEnTransito?: Timestamp;
  fechaRecibida?: Timestamp;

  // Fechas financieras
  fechaPago?: Timestamp;            // Fecha del pago completo
  fechasPagoParcial?: Timestamp[];  // Fechas de pagos parciales (legacy)
  montosPagados?: number[];         // Montos de cada pago parcial (legacy)
  montoPendiente?: number;          // Monto que falta por pagar

  // ========== Historial de pagos estructurado ==========
  historialPagos?: PagoOrdenCompra[];
  
  // Tracking y logística
  numeroTracking?: string;
  courier?: string;
  almacenDestino?: string;    // miami_1, utah, etc.
  
  // Información adicional
  observaciones?: string;
  documentos?: string[];      // URLs de facturas, etc.

  // Inventario generado
  inventarioGenerado: boolean;
  unidadesGeneradas?: string[];  // IDs de las unidades creadas

  // ========== Requerimiento de origen ==========
  // Si la OC se generó desde un requerimiento
  requerimientoId?: string;
  requerimientoNumero?: string;

  // ========== Expectativa vs Realidad ==========
  // Si viene de un requerimiento, guardar la expectativa para comparar
  expectativaRequerimiento?: {
    tcInvestigacion: number;          // TC al momento de investigar
    costoEstimadoUSD: number;         // Costo USD esperado
    costoEstimadoPEN: number;         // costoEstimadoUSD × tcInvestigacion
    impuestoEstimadoUSD?: number;     // Impuesto estimado
    fleteEstimadoUSD?: number;        // Flete estimado
    costoTotalEstimadoUSD: number;
    costoTotalEstimadoPEN: number;
    fechaInvestigacion?: Timestamp;
  };

  // Comparación con la realidad (se calcula al crear/pagar)
  comparacionExpectativa?: {
    diferenciaCostoUSD: number;       // costoReal - costoEstimado
    diferenciaCostoPEN: number;       // Considerando diferencia de TC
    diferenciaTC: number;             // tcCompra - tcInvestigacion
    diferenciaTCPago?: number;        // tcPago - tcCompra (si aplica)
    dentroPresupuesto: boolean;       // true si está dentro del 5% de tolerancia
    porcentajeDesviacion: number;     // % de desviación vs presupuesto
    razones?: string[];               // Razones de la diferencia
  };

  // Auditoría
  creadoPor: string;
  ultimaEdicion?: Timestamp;
  editadoPor?: string;
}

export interface OrdenCompraFormData {
  proveedorId: string;
  productos: Array<{
    productoId: string;
    sku: string;
    marca: string;
    nombreComercial: string;
    presentacion: string;
    cantidad: number;
    costoUnitario: number;
    subtotal: number;
  }>;
  subtotalUSD: number;
  impuestoUSD?: number;       // Sales Tax USA
  gastosEnvioUSD?: number;
  otrosGastosUSD?: number;
  totalUSD: number;
  tcCompra: number;
  almacenDestino: string;
  numeroTracking?: string;
  courier?: string;
  observaciones?: string;
  requerimientoId?: string;   // Vinculación con requerimiento origen
}

export interface CambioEstadoOrden {
  estadoAnterior: EstadoOrden;
  estadoNuevo: EstadoOrden;
  fecha: Timestamp;
  realizadoPor: string;
  motivo?: string;
  observaciones?: string;
  
  // Datos adicionales según el estado
  tcPago?: number;            // Si cambia a "pagada"
  numeroTracking?: string;    // Si cambia a "en_transito"
  courier?: string;           // Si cambia a "en_transito"
}

export interface OrdenCompraStats {
  totalOrdenes: number;
  borradores: number;
  enviadas: number;
  pagadas: number;
  enTransito: number;
  recibidas: number;
  canceladas: number;
  valorTotalUSD: number;
  valorTotalPEN: number;
}

export interface ProveedorFormData {
  nombre: string;
  tipo: TipoProveedor;
  url: string;                       // URL del sitio web (obligatorio)
  contacto?: string;                 // Nombre de contacto
  email?: string;
  telefono?: string;
  direccion?: string;
  pais: string;
  notasInternas?: string;
}

/**
 * Estadísticas de proveedores para dashboard
 */
export interface ProveedorStats {
  totalProveedores: number;
  proveedoresActivos: number;
  proveedoresPorPais: Record<string, number>;
  proveedoresPorTipo: Record<TipoProveedor, number>;
  proveedoresPorClasificacion: Record<ClasificacionProveedor, number>;
  topProveedoresPorCompras: Array<{
    proveedorId: string;
    nombre: string;
    ordenesCompra: number;
    montoTotalUSD: number;
    clasificacion?: ClasificacionProveedor;
  }>;
}