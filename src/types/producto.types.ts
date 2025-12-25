import type { Timestamp } from 'firebase/firestore';

// ============================================
// TIPOS DE PRODUCTO (Ya existentes)
// ============================================

export type Presentacion =
  | 'tabletas'
  | 'gomitas'
  | 'capsulas'
  | 'capsulas_blandas'
  | 'polvo'
  | 'liquido';

export type EstadoProducto = 'activo' | 'inactivo' | 'descontinuado';

// ============================================
// INVESTIGACIÓN DE MERCADO
// ============================================

/**
 * Registro histórico de precios para análisis de tendencias
 */
export interface HistorialPrecio {
  fecha: Timestamp;
  precioUSAPromedio: number;
  precioUSAMin: number;
  precioPERUPromedio: number;
  precioPERUMin: number;
  margenEstimado: number;
  tipoCambio: number;
}

/**
 * Alerta automática del sistema
 */
export interface AlertaInvestigacion {
  id: string;
  tipo: 'vigencia' | 'margen_bajo' | 'precio_competidor' | 'sin_stock';
  mensaje: string;
  severidad: 'info' | 'warning' | 'danger';
  fecha: Timestamp;
  leida: boolean;
  datos?: Record<string, any>;
}

/**
 * Proveedor USA para investigación de mercado
 */
export interface ProveedorUSA {
  id: string;
  nombre: string;                  // "Amazon", "iHerb", "Vitacost", etc.
  precio: number;                  // Precio en USD
  impuesto?: number;               // Porcentaje de impuesto USA (sales tax), ej: 8.25
  url?: string;                    // Link al producto
  disponibilidad?: 'en_stock' | 'bajo_stock' | 'sin_stock' | 'desconocido';
  envioEstimado?: number;          // Costo de envío estimado USD
  notas?: string;
  fechaConsulta: Timestamp;
}

/**
 * Competidor en Perú para investigación de mercado
 */
export interface CompetidorPeru {
  id: string;
  nombre: string;                  // Nombre del vendedor o tienda
  plataforma: 'mercado_libre' | 'web_propia' | 'inkafarma' | 'mifarma' | 'otra';
  precio: number;                  // Precio en PEN
  url?: string;                    // Link al producto
  ventas?: number;                 // Ventas mensuales estimadas (si está disponible)
  reputacion?: 'excelente' | 'buena' | 'regular' | 'mala' | 'desconocida';
  esLiderCategoria?: boolean;
  notas?: string;
  fechaConsulta: Timestamp;
}

/**
 * Investigación de mercado para un producto
 * Permite analizar precios USA vs Perú y calcular viabilidad
 */
export interface InvestigacionMercado {
  // Identificación
  id: string;
  productoId: string;

  // === PROVEEDORES USA ===
  proveedoresUSA: ProveedorUSA[];  // Lista de proveedores con precios
  precioUSAMin: number;            // Calculado: mínimo de proveedores
  precioUSAMax: number;            // Calculado: máximo de proveedores
  precioUSAPromedio: number;       // Calculado: promedio ponderado
  proveedorRecomendado?: string;   // ID del proveedor recomendado (mejor precio)
  fuenteUSA?: string;              // DEPRECADO: mantener para compatibilidad

  // === COMPETENCIA PERÚ ===
  competidoresPeru: CompetidorPeru[];  // Lista de competidores
  precioPERUMin: number;           // Calculado: mínimo de competidores
  precioPERUMax: number;           // Calculado: máximo de competidores
  precioPERUPromedio: number;      // Calculado: promedio ponderado
  competidorPrincipal?: string;    // ID del competidor principal (más ventas)
  fuentePeru?: string;             // DEPRECADO: mantener para compatibilidad

  // === ANÁLISIS DE COMPETENCIA ===
  presenciaML: boolean;            // ¿Hay competencia en ML?
  numeroCompetidores: number;      // Calculado: competidoresPeru.length
  vendedorPrincipal?: string;      // DEPRECADO: usar competidorPrincipal
  nivelCompetencia: 'baja' | 'media' | 'alta' | 'saturada';
  ventajasCompetitivas?: string;   // ¿Qué ventajas tendríamos?

  // === ESTIMACIONES ===
  ctruEstimado: number;            // CTRU estimado basado en mejor precio USA + logística
  logisticaEstimada: number;       // Costo logístico estimado por unidad
  precioSugeridoCalculado: number; // Precio sugerido basado en análisis
  margenEstimado: number;          // Margen estimado (%)
  precioEntrada?: number;          // Precio para entrar al mercado competitivamente

  // === DEMANDA ===
  demandaEstimada: 'baja' | 'media' | 'alta';
  tendencia: 'subiendo' | 'bajando' | 'estable';
  volumenMercadoEstimado?: number; // Unidades mensuales estimadas en el mercado

  // === RECOMENDACIÓN ===
  recomendacion: 'importar' | 'investigar_mas' | 'descartar';
  razonamiento?: string;
  puntuacionViabilidad?: number;   // 0-100 calculado automáticamente

  // === VIGENCIA ===
  fechaInvestigacion: Timestamp;
  vigenciaHasta: Timestamp;        // +60 días por defecto
  estaVigente?: boolean;           // Calculado

  // === NOTAS ===
  notas?: string;

  // === HISTORIAL Y ALERTAS ===
  historialPrecios: HistorialPrecio[];    // Historial de cambios de precios
  alertas: AlertaInvestigacion[];          // Alertas automáticas generadas

  // === AUDITORÍA ===
  realizadoPor: string;
  fechaCreacion: Timestamp;
  ultimaActualizacion?: Timestamp;
}

/**
 * Datos de proveedor para el formulario (sin Timestamp)
 */
export interface ProveedorUSAFormData {
  id: string;
  proveedorId?: string;            // ID del proveedor en Gestor Maestro (si está vinculado)
  nombre: string;
  precio: number;
  impuesto?: number;               // Porcentaje de impuesto USA (sales tax), ej: 8.25
  url?: string;
  disponibilidad?: 'en_stock' | 'bajo_stock' | 'sin_stock' | 'desconocido';
  envioEstimado?: number;
  notas?: string;
}

/**
 * Datos de competidor para el formulario (sin Timestamp)
 */
export interface CompetidorPeruFormData {
  id: string;
  competidorId?: string;  // ID del competidor en Gestor Maestro
  nombre: string;
  plataforma: 'mercado_libre' | 'web_propia' | 'inkafarma' | 'mifarma' | 'falabella' | 'amazon' | 'otra';
  precio: number;
  url?: string;
  ventas?: number;
  reputacion?: 'excelente' | 'buena' | 'regular' | 'mala' | 'desconocida';
  esLiderCategoria?: boolean;
  notas?: string;
}

/**
 * Datos para crear/actualizar una investigación
 */
export interface InvestigacionFormData {
  // Proveedores USA (lista)
  proveedoresUSA: ProveedorUSAFormData[];

  // Competidores Perú (lista)
  competidoresPeru: CompetidorPeruFormData[];

  // Precios calculados (se llenan automáticamente pero se pueden sobreescribir)
  precioUSAMin?: number;
  precioUSAMax?: number;
  precioUSAPromedio?: number;
  precioPERUMin?: number;
  precioPERUMax?: number;
  precioPERUPromedio?: number;

  // Análisis de competencia
  presenciaML: boolean;
  nivelCompetencia: 'baja' | 'media' | 'alta' | 'saturada';
  ventajasCompetitivas?: string;

  // Estimaciones manuales (opcionales, se calculan si no se proveen)
  logisticaEstimada?: number;

  // Demanda
  demandaEstimada: 'baja' | 'media' | 'alta';
  tendencia: 'subiendo' | 'bajando' | 'estable';
  volumenMercadoEstimado?: number;

  // Recomendación
  recomendacion: 'importar' | 'investigar_mas' | 'descartar';
  razonamiento?: string;

  // Notas
  notas?: string;
}

/**
 * Análisis de punto de equilibrio
 */
export interface PuntoEquilibrio {
  /** Unidades a vender para recuperar la inversión (ingresos = inversión) */
  unidadesParaRecuperarCapital: number;
  /** Unidades a vender para que ganancia acumulada = inversión (ROI 100%) */
  unidadesParaROI100: number;
  /** Inversión total (unidades × CTRU) */
  inversionTotal: number;
  /** Ganancia por unidad (precio venta - CTRU) */
  gananciaUnitaria: number;
  /** Meses para recuperar capital (ingresos = inversión) */
  tiempoRecuperacionCapital: number;
  /** Meses para ROI 100% */
  tiempoROI100: number;
  /** % rentabilidad mensual estimada */
  rentabilidadMensual?: number;
  /** Ganancia total si se vende todo el inventario */
  gananciaTotalPotencial: number;
  /** ROI total si se vende todo (ganancia total / inversión × 100) */
  roiTotalPotencial: number;
  /** @deprecated usar unidadesParaRecuperarCapital */
  unidadesNecesarias: number;
  /** @deprecated usar tiempoRecuperacionCapital */
  tiempoRecuperacion: number;
}

/**
 * Resumen de investigación para mostrar en cards
 */
export interface InvestigacionResumen {
  tieneInvestigacion: boolean;
  estaVigente: boolean;
  diasRestantes?: number;
  precioUSAPromedio?: number;
  precioPERUPromedio?: number;
  margenEstimado?: number;
  recomendacion?: 'importar' | 'investigar_mas' | 'descartar';
  fechaInvestigacion?: Date;
  alertasActivas?: number;           // Cantidad de alertas no leídas
  tendenciaPrecio?: 'subiendo' | 'bajando' | 'estable';  // Tendencia del historial
}

export interface Producto {
  id: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: Presentacion;
  dosaje: string;
  contenido: string;
  grupo: string;
  subgrupo: string;

  enlaceProveedor: string;
  codigoUPC: string;

  estado: EstadoProducto;
  etiquetas: string[];

  habilitadoML: boolean;
  restriccionML: string;

  // === COSTOS ===
  ctruPromedio: number;
  precioSugerido: number;
  margenMinimo: number;
  margenObjetivo: number;

  /**
   * Costo FIJO de flete USA → Perú por unidad (USD)
   * Este es el costo que cobra el viajero por traer este producto específico.
   * Es intrínseco al producto porque depende de su peso/volumen.
   */
  costoFleteUSAPeru: number;

  // === STOCK ===
  stockUSA: number;
  stockPeru: number;
  stockTransito: number;
  stockReservado: number;
  stockDisponible: number;

  stockMinimo: number;
  stockMaximo: number;

  rotacionPromedio: number;
  diasParaQuiebre: number;

  esPadre: boolean;

  // === INVESTIGACIÓN DE MERCADO ===
  investigacion?: InvestigacionMercado;

  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
}

export interface ProductoFormData {
  marca: string;
  nombreComercial: string;
  presentacion: Presentacion;
  dosaje: string;
  contenido: string;
  grupo: string;
  subgrupo: string;
  enlaceProveedor: string;
  codigoUPC: string;
  precioSugerido: number;
  margenMinimo: number;
  margenObjetivo: number;
  stockMinimo: number;
  stockMaximo: number;
  habilitadoML: boolean;
  restriccionML: string;
  /**
   * Costo FIJO de flete USA → Perú por unidad (USD)
   */
  costoFleteUSAPeru: number;
}

// ============================================
// TIPOS DE INVENTARIO / UNIDADES
// ============================================

/**
 * Estados de una unidad con trazabilidad completa USA → Perú
 */
export type EstadoUnidad =
  | 'recibida_usa'        // Recibida en almacén/viajero USA
  | 'en_transito_usa'     // En tránsito entre almacenes USA (transferencia interna)
  | 'en_transito_peru'    // En tránsito USA → Perú
  | 'disponible_peru'     // Disponible para venta en Perú
  | 'asignada_pedido'     // Asignada a un pedido/cotización
  | 'en_despacho'         // En proceso de entrega
  | 'entregada'           // Entregada al cliente
  | 'devuelta'            // Devuelta por cliente
  | 'danada'              // Dañada/perdida
  | 'vencida';            // Vencida

/**
 * Unidad individual de producto
 * Representa cada producto físico con trazabilidad completa
 */
export interface Unidad {
  id: string;
  productoId: string;
  sku: string;
  productoNombre: string;          // Desnormalizado para display

  // Identificación
  numeroUnidad: number;            // Número secuencial por OC
  codigoUnidad: string;            // OC-001-001, OC-001-002, etc.
  lote?: string;
  fechaVencimiento?: Timestamp;

  // === COSTOS ===
  costoUnitarioUSD: number;        // Costo de compra en USA
  costoFleteUSD: number;           // Costo flete (del Producto.costoFleteUSAPeru)
  costoTotalUSD: number;           // costoUnitarioUSD + costoFleteUSD
  tcCompra: number;                // TC al momento de la OC
  tcPago: number;                  // TC al momento del pago de la OC

  // CTRU
  ctruBase: number;                // Costo base en PEN (costoTotalUSD × tcPago)
  ctruGastos: number;              // Gastos operativos prorrateados
  ctruDinamico: number;            // ctruBase + ctruGastos (CTRU actual)

  // === UBICACIÓN Y ESTADO ===
  estado: EstadoUnidad;
  almacenActualId: string;         // ID del almacén/viajero actual
  almacenActualNombre: string;     // Desnormalizado
  almacenActualCodigo: string;     // Desnormalizado
  paisActual: 'USA' | 'Peru';

  // === FECHAS DE TRAZABILIDAD ===
  fechaCreacion: Timestamp;        // Cuando se creó la unidad (recepción OC en USA)
  fechaRecepcionUSA: Timestamp;    // Cuando llegó al primer almacén USA
  fechaSalidaUSA?: Timestamp;      // Cuando salió de USA hacia Perú
  fechaLlegadaPeru?: Timestamp;    // Cuando llegó a Perú
  fechaAsignacion?: Timestamp;     // Cuando se asignó a un pedido
  fechaEntrega?: Timestamp;        // Cuando se entregó al cliente

  // Tiempo en almacén actual (calculado)
  diasEnAlmacenActual?: number;

  // === REFERENCIAS ===
  ordenCompraId: string;
  numeroOrden: string;             // Desnormalizado
  proveedorId?: string;

  ventaId?: string;
  numeroVenta?: string;

  // Transferencia actual (si está en tránsito)
  transferenciaActualId?: string;
  numeroTransferencia?: string;

  // === HISTORIAL DE MOVIMIENTOS ===
  historial: MovimientoUnidad[];

  // === AUDITORÍA ===
  creadoPor: string;
  actualizadoPor?: string;
  ultimaEdicion?: Timestamp;
}

/**
 * Movimiento/cambio de estado de una unidad
 */
export interface MovimientoUnidad {
  id: string;
  fecha: Timestamp;
  tipo: 'recepcion_usa' | 'transferencia_interna' | 'envio_peru' | 'recepcion_peru' | 'asignacion' | 'despacho' | 'entrega' | 'devolucion' | 'ajuste' | 'danio' | 'vencimiento';
  estadoAnterior: EstadoUnidad;
  estadoNuevo: EstadoUnidad;

  // Almacenes involucrados
  almacenOrigenId?: string;
  almacenOrigenNombre?: string;
  almacenDestinoId?: string;
  almacenDestinoNombre?: string;

  // Referencia a documento relacionado
  referenciaId?: string;           // ID de transferencia, venta, etc.
  referenciaTipo?: 'transferencia' | 'venta' | 'ajuste' | 'orden_compra';
  referenciaNumero?: string;

  // Detalles
  motivo: string;
  observaciones?: string;
  realizadoPor: string;
}

/**
 * Datos para crear unidades (al recibir OC en USA)
 */
export interface UnidadFormData {
  productoId: string;
  cantidad: number;
  lote?: string;
  fechaVencimiento?: Date;
  costoUnitarioUSD: number;
  tcCompra: number;
  tcPago: number;
  almacenDestinoId: string;        // ID del viajero/almacén USA
  ordenCompraId: string;
  numeroOrden: string;
  observaciones?: string;
}

/**
 * Resumen de stock por almacén
 */
export interface StockPorAlmacen {
  almacenId: string;
  almacenNombre: string;
  almacenCodigo: string;
  pais: 'USA' | 'Peru';
  esViajero: boolean;
  cantidad: number;
  valorUSD: number;
  valorPEN: number;
  tiempoPromedioAlmacenamiento: number;
}

/**
 * Resumen general de inventario
 */
export interface ResumenInventario {
  // Totales
  totalUnidades: number;
  unidadesUSA: number;
  unidadesPeru: number;
  unidadesTransito: number;
  unidadesDisponibles: number;
  unidadesAsignadas: number;

  // Valores
  valorTotalUSD: number;
  valorTotalPEN: number;
  ctruPromedioPEN: number;

  // Por almacén
  stockPorAlmacen: StockPorAlmacen[];

  // Alertas
  unidadesProximasVencer: number;  // < 90 días
  unidadesMuchoTiempoUSA: number;  // > 30 días en USA
}