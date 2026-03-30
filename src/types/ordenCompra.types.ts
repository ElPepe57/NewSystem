import type { Timestamp } from 'firebase/firestore';

// Estado logístico de la orden (ciclo de vida del producto físico)
export type EstadoOrden =
  | 'borrador'          // Creada pero no enviada
  | 'enviada'           // Enviada al proveedor
  | 'en_transito'       // Mercadería en camino
  | 'recibida_parcial'  // Algunos productos recibidos, otros pendientes
  | 'recibida'          // Recibida en almacén (completa)
  | 'cancelada';        // Cancelada

// Estado de pago (independiente del estado logístico)
export type EstadoPagoOC =
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
  contenido?: string;        // Ej: "60 cápsulas", "500g"
  dosaje?: string;           // Ej: "150mg", "1000 UI"
  sabor?: string;            // Ej: "Limón", "Fresa", "Natural"
  codigoUPC?: string;       // Codigo UPC/EAN para escaneo en recepcion
  cantidad: number;
  costoUnitario: number;    // Precio por unidad en USD
  subtotal: number;         // cantidad × costoUnitario
  cantidadRecibida?: number; // Acumulado de unidades recibidas (0 por defecto)
  // Viajero destino (para distribución multi-viajero)
  viajeroId?: string;       // ID del almacén tipo viajero
  viajeroNombre?: string;   // Nombre del viajero (desnormalizado)
  // Origen multi-requerimiento (tracking por cliente)
  origenRequerimientos?: Array<{
    requerimientoId: string;
    cotizacionId?: string;
    clienteNombre?: string;
    cantidad: number;
  }>;
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
  errorTesoreria?: boolean;          // true si falló el registro en tesorería
  errorTesoreriaMsg?: string;        // Mensaje de error para reconciliación

  // Auditoría
  registradoPor: string;
  fechaRegistro: Timestamp;
}

// ========== RECEPCIÓN PARCIAL ==========

export interface RecepcionParcial {
  id: string;                         // REC-{timestamp}
  fecha: Timestamp;
  numero: number;                     // Secuencial: 1, 2, 3...
  productosRecibidos: Array<{
    productoId: string;
    cantidadRecibida: number;         // Cuántas llegaron EN ESTA entrega
    cantidadAcumulada: number;        // Acumulado después de esta recepción
  }>;
  unidadesGeneradas: string[];
  unidadesReservadas: string[];
  unidadesDisponibles: string[];
  totalUnidadesRecepcion: number;
  costoAdicionalPorUnidad: number;
  registradoPor: string;
  observaciones?: string;
}

export interface RecepcionParcialFormData {
  productosRecibidos: Array<{
    productoId: string;
    cantidadRecibida: number;
  }>;
  observaciones?: string;
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
  subtotalUSD: number;                  // Suma de todos los productos (sin impuesto)
  impuestoCompraUSD?: number;           // Impuesto de compra (sales tax, IVA origen, etc.)
  costoEnvioProveedorUSD?: number;      // Envío del proveedor al punto de recojo/almacén
  otrosGastosCompraUSD?: number;        // Otros gastos de la compra (handling, seguros, etc.)
  descuentoUSD?: number;                // Descuento general
  totalUSD: number;                     // subtotal + impuesto + envío + otros - descuento

  // Modo de entrega
  modoEntrega?: 'viajero' | 'envio_directo'; // Cómo llega a Perú
  fleteIncluidoEnPrecio?: boolean;            // true = DDP (flete ya en costoUnitario)

  /** @deprecated Usar impuestoCompraUSD */ impuestoUSD?: number;
  /** @deprecated Usar costoEnvioProveedorUSD */ gastosEnvioUSD?: number;
  /** @deprecated Usar otrosGastosCompraUSD */ otrosGastosUSD?: number;
  
  // Origen y línea de negocio
  paisOrigen?: string;             // País de origen del proveedor ('USA', 'China', 'Corea', 'Peru')
  lineaNegocioId?: string;         // Si todos los productos son de la misma línea
  lineaNegocioNombre?: string;

  // Tipo de Cambio
  tcCompra?: number;          // TC al momento de crear la orden
  tcPago?: number;            // TC al momento del pago
  totalPEN?: number;          // totalUSD × tcPago
  
  // Diferencia cambiaria (si TC pago != TC compra)
  diferenciaCambiaria?: number;
  
  // Estados (logístico y financiero son independientes)
  estado: EstadoOrden;              // Estado logístico
  estadoPago: EstadoPagoOC;           // Estado de pago (independiente)

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
  almacenDestino?: string;        // ID del almacén (viajero)
  nombreAlmacenDestino?: string;  // Nombre del almacén para display
  
  // Información adicional
  observaciones?: string;
  documentos?: string[];      // URLs de facturas, etc.

  // Inventario generado
  inventarioGenerado: boolean;
  unidadesGeneradas?: string[];  // IDs de las unidades creadas

  // ========== Recepciones Parciales ==========
  recepcionesParciales?: RecepcionParcial[];
  totalUnidadesRecibidas?: number;
  fechaPrimeraRecepcion?: Timestamp;

  // ========== Requerimiento de origen ==========
  // Si la OC se generó desde un requerimiento (singular - legacy)
  requerimientoId?: string;
  requerimientoNumero?: string;

  // ========== Soporte Multi-Requerimiento (OC Consolidada) ==========
  requerimientoIds?: string[];
  requerimientoNumeros?: string[];
  productosOrigen?: Array<{
    productoId: string;
    requerimientoId: string;
    requerimientoNumero: string;
    cotizacionId?: string;
    clienteNombre?: string;
    cantidad: number;
  }>;

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
    // Viajero destino (para distribución multi-viajero)
    viajeroId?: string;
    viajeroNombre?: string;
  }>;
  subtotalUSD: number;
  impuestoCompraUSD?: number;           // Impuesto de compra (sales tax, IVA origen)
  costoEnvioProveedorUSD?: number;      // Envío del proveedor al punto de recojo
  otrosGastosCompraUSD?: number;        // Otros gastos de la compra
  descuentoUSD?: number;                // Descuento general
  totalUSD: number;
  tcCompra: number;
  modoEntrega?: 'viajero' | 'envio_directo';
  fleteIncluidoEnPrecio?: boolean;
  almacenDestino: string;
  // Origen y línea de negocio (auto-heredados de productos)
  paisOrigen?: string;
  lineaNegocioId?: string;
  lineaNegocioNombre?: string;
  numeroTracking?: string;
  courier?: string;
  observaciones?: string;
  requerimientoId?: string;   // Vinculación con requerimiento origen (singular)
  // Soporte multi-requerimiento (OC consolidada)
  requerimientoIds?: string[];
  productosOrigen?: Array<{
    productoId: string;
    requerimientoId: string;
    cantidad: number;
    cotizacionId?: string;
    clienteNombre?: string;
  }>;
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
  recibidasParcial: number;
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