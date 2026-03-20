import type { Timestamp } from 'firebase/firestore';
import type { TipoProductoSnapshot } from './tipoProducto.types';
import type { CategoriaSnapshot } from './categoria.types';
import type { EtiquetaSnapshot } from './etiqueta.types';

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
  marcaId?: string;    // Referencia a la entidad Marca en el Gestor Maestro
  nombreComercial: string;
  presentacion: Presentacion;
  dosaje: string;
  contenido: string;

  // ======== CLASIFICACION LEGACY (mantener para compatibilidad) ========
  /** @deprecated Usar categorias[] en su lugar. Se mantiene para compatibilidad */
  grupo: string;
  /** @deprecated Usar tipoProducto en su lugar. Se mantiene para compatibilidad */
  subgrupo: string;

  // ======== NUEVA CLASIFICACION ========
  /**
   * Tipo de Producto (composicion/principio activo)
   * Agrupa productos que son "lo mismo" de diferentes marcas
   * Ej: "Aceite de Oregano", "Omega 3 EPA/DHA", "Sulfato de Zinc"
   */
  tipoProductoId?: string;
  tipoProducto?: TipoProductoSnapshot;

  /**
   * Categorias (areas de salud/beneficio)
   * Un producto puede tener MULTIPLES categorias (max 5)
   * Ej: ["Sistema Inmune", "Digestivo", "Antibacteriano"]
   */
  categoriaIds?: string[];
  categorias?: CategoriaSnapshot[];
  /** Categoria principal para display destacado */
  categoriaPrincipalId?: string;

  /**
   * Etiquetas (tags flexibles)
   * Para atributos, marketing y origen
   * Ej: ["vegano", "organico", "importado-usa", "best-seller"]
   */
  etiquetaIds?: string[];
  etiquetasData?: EtiquetaSnapshot[];

  codigoUPC: string;

  estado: EstadoProducto;
  etiquetas: string[];

  // === COSTOS ===
  /**
   * CMV Promedio - Costo de Mercadería Vendida promedio de las unidades en stock
   * Antes llamado "ctruPromedio"
   */
  ctruPromedio: number;

  /**
   * Costo FIJO de flete internacional por unidad (USD)
   * Es intrínseco al producto porque depende de su peso/volumen.
   */
  costoFleteInternacional?: number;

  // === ORIGEN Y LÍNEA DE NEGOCIO ===
  paisOrigen?: string;                    // País de origen del producto ('USA', 'China', 'Corea', 'Peru')
  lineaNegocioId?: string;                // ID de la línea de negocio
  lineaNegocioNombre?: string;            // Desnormalizado para display

  // === STOCK ===
  /** @deprecated Usar stockOrigen para multi-país */
  stockUSA: number;
  stockPeru: number;
  stockTransito: number;
  stockReservado: number;
  stockDisponible: number;
  stockDisponiblePeru?: number; // Solo disponible_peru (lo que ML puede vender)
  stockPendienteML?: number;    // Unidades comprometidas en órdenes ML no procesadas aún
  stockEfectivoML?: number;     // stockDisponiblePeru - stockPendienteML (lo que se pushea a ML)

  stockMinimo: number;
  stockMaximo: number;

  rotacionPromedio: number;
  diasParaQuiebre: number;

  esPadre: boolean;

  // === SABOR ===
  /**
   * Sabor del producto (ej: "Limón", "Fresa", "Natural", "Sin sabor")
   */
  sabor?: string;

  // === CICLO DE RECOMPRA ===
  /**
   * Frecuencia de consumo diario recomendada (ej: 1, 2, 3 veces al día)
   * El total de porciones se toma del campo "contenido"
   */
  servingsPerDay?: number;

  /**
   * Días estimados para que un cliente necesite recomprar este producto.
   * Se calcula automáticamente: (número en contenido) / servingsPerDay
   * Ej: "60 softgels" / 2 al día = 30 días
   */
  cicloRecompraDias?: number;

  // === INVESTIGACIÓN DE MERCADO ===
  investigacion?: InvestigacionMercado;

  creadoPor: string;
  fechaCreacion: Timestamp;
  ultimaEdicion?: Timestamp;
}

export interface ProductoFormData {
  marca: string;
  marcaId?: string;    // Referencia a la entidad Marca en el Gestor Maestro
  nombreComercial: string;
  presentacion: Presentacion;
  dosaje: string;
  contenido: string;
  sabor?: string;      // Sabor del producto (ej: "Limón", "Fresa", "Natural")

  // ======== CLASIFICACION LEGACY (mantener para compatibilidad) ========
  /** @deprecated Usar categoriaIds en su lugar */
  grupo: string;
  /** @deprecated Usar tipoProductoId en su lugar */
  subgrupo: string;

  // ======== NUEVA CLASIFICACION ========
  /** Tipo de Producto (composicion/principio activo) */
  tipoProductoId?: string;
  /** IDs de categorias seleccionadas (max 5) */
  categoriaIds?: string[];
  /** Categoria principal para display destacado */
  categoriaPrincipalId?: string;
  /** IDs de etiquetas seleccionadas */
  etiquetaIds?: string[];

  codigoUPC: string;
  stockMinimo: number;
  stockMaximo: number;
  costoFleteInternacional?: number;
  paisOrigen?: string;                      // País de origen del producto
  lineaNegocioId?: string;                  // ID de la línea de negocio

  // === CICLO DE RECOMPRA ===
  /**
   * Frecuencia de consumo diario (el total de porciones se toma del campo "contenido")
   */
  servingsPerDay?: number;

  /**
   * Días estimados para que un cliente necesite recomprar este producto.
   * Se calcula automáticamente: (número en contenido) / servingsPerDay
   */
  cicloRecompraDias?: number;
}

// Los tipos de Unidad, EstadoUnidad, MovimientoUnidad, UnidadFormData
// están definidos en unidad.types.ts (fuente canónica)