/**
 * PRICE INTELLIGENCE TYPES
 * Sistema de inteligencia de precios para órdenes de compra
 * Proporciona análisis histórico, comparativas y recomendaciones
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================
// EVALUACIÓN DE PRECIO
// ============================================

/**
 * Niveles de evaluación del precio ingresado
 */
export type NivelPrecio = 'excelente' | 'bueno' | 'aceptable' | 'alto' | 'muy_alto';

/**
 * Tendencia de precios en el tiempo
 */
export type TendenciaPrecio = 'bajando' | 'estable' | 'subiendo';

/**
 * Resultado de la evaluación de un precio
 */
export interface EvaluacionPrecio {
  /** Nivel de evaluación */
  nivel: NivelPrecio;
  /** Puntuación 0-100 */
  puntuacion: number;
  /** Color para UI (green, yellow, orange, red) */
  color: 'green' | 'yellow' | 'orange' | 'red';
  /** Mensaje corto para el usuario */
  mensaje: string;
  /** Descripción detallada */
  descripcion: string;
  /** Porcentaje vs promedio histórico (positivo = más caro) */
  vsPromedioHistorico: number;
  /** Porcentaje vs precio de investigación (positivo = más caro) */
  vsInvestigacion: number | null;
  /** Porcentaje vs mejor precio histórico (positivo = más caro) */
  vsMejorHistorico: number;
}

// ============================================
// HISTÓRICO DE PRECIOS
// ============================================

/**
 * Registro individual de precio histórico de compra
 */
export interface PrecioHistorico {
  /** ID del proveedor */
  proveedorId: string;
  /** Nombre del proveedor */
  proveedorNombre: string;
  /** Costo unitario en USD */
  costoUnitarioUSD: number;
  /** Cantidad comprada */
  cantidad: number;
  /** Fecha de la compra */
  fechaCompra: Date;
  /** Número de orden */
  numeroOrden: string;
  /** Tipo de cambio usado */
  tcCompra?: number;
}

/**
 * Estadísticas del histórico de precios
 */
export interface EstadisticasPrecioHistorico {
  /** Precio mínimo histórico */
  minimo: number;
  /** Precio máximo histórico */
  maximo: number;
  /** Precio promedio */
  promedio: number;
  /** Precio promedio ponderado por cantidad */
  promedioPonderado: number;
  /** Desviación estándar */
  desviacionEstandar: number;
  /** Tendencia del precio */
  tendencia: TendenciaPrecio;
  /** Porcentaje de variación en últimos 90 días */
  variacion90Dias: number;
  /** Total de compras registradas */
  totalCompras: number;
  /** Fecha de la primera compra */
  primeraCompra: Date | null;
  /** Fecha de la última compra */
  ultimaCompra: Date | null;
}

/**
 * Punto de datos para gráfico de histórico
 */
export interface PuntoHistorico {
  fecha: Date;
  precio: number;
  proveedor: string;
  cantidad: number;
  numeroOrden: string;
}

// ============================================
// COMPARATIVA DE PROVEEDORES
// ============================================

/**
 * Información de proveedor para comparativa
 */
export interface ProveedorComparativa {
  /** ID del proveedor */
  proveedorId?: string;
  /** Nombre del proveedor */
  nombre: string;
  /** Precio base USD */
  precioBase: number;
  /** Porcentaje de impuesto (sales tax) */
  impuesto: number;
  /** Precio con impuesto incluido */
  precioConImpuesto: number;
  /** Costo de envío estimado */
  envioEstimado: number;
  /** Precio total (precio + impuesto + envío) */
  precioTotal: number;
  /** Disponibilidad del producto */
  disponibilidad: 'en_stock' | 'bajo_stock' | 'sin_stock' | 'desconocido';
  /** URL del producto */
  url?: string;
  /** Fecha de última consulta */
  fechaConsulta?: Date;
  /** Es el proveedor recomendado */
  esRecomendado: boolean;
  /** Es el proveedor actualmente seleccionado */
  esActual: boolean;
  /** Diferencia vs el más barato */
  diferenciaVsMejor: number;
  /** Porcentaje de diferencia vs el más barato */
  porcentajeVsMejor: number;
  /** Puntuación del proveedor (si existe evaluación SRM) */
  puntuacionSRM?: number;
  /** Clasificación SRM */
  clasificacionSRM?: 'preferido' | 'aprobado' | 'condicional' | 'suspendido';
}

// ============================================
// IMPACTO EN RENTABILIDAD
// ============================================

/**
 * Proyección de rentabilidad basada en el precio de compra
 */
export interface ProyeccionRentabilidad {
  /** CTRU proyectado en PEN */
  ctruProyectado: number;
  /** CTRU proyectado en USD */
  ctruProyectadoUSD: number;
  /** Precio de venta sugerido */
  precioVentaSugerido: number;
  /** Margen estimado (%) */
  margenEstimado: number;
  /** Ganancia por unidad en PEN */
  gananciaPorUnidad: number;
  /** Comparación con precio promedio de competencia */
  vsCompetenciaPeru: {
    precioPromedio: number;
    diferencia: number;
    porcentaje: number;
    posicion: 'mas_barato' | 'igual' | 'mas_caro';
  } | null;
  /** Alerta de margen bajo */
  alertaMargenBajo: boolean;
  /** Alerta de precio no competitivo */
  alertaPrecioNoCompetitivo: boolean;
}

/**
 * Análisis de ahorro potencial
 */
export interface AnalisisAhorro {
  /** Proveedor alternativo recomendado */
  proveedorAlternativo: string;
  /** Ahorro por unidad en USD */
  ahorroPorUnidad: number;
  /** Porcentaje de ahorro */
  porcentajeAhorro: number;
  /** Impacto en margen (puntos porcentuales adicionales) */
  impactoEnMargen: number;
  /** Mensaje para el usuario */
  mensaje: string;
}

// ============================================
// ASESOR DE PRECIOS (RESULTADO COMPLETO)
// ============================================

/**
 * Alerta de inteligencia de precios
 */
export interface AlertaPrecio {
  tipo: 'info' | 'warning' | 'danger' | 'success';
  titulo: string;
  mensaje: string;
  accion?: string;
}

/**
 * Resultado completo del análisis de inteligencia de precios
 */
export interface PriceIntelligenceResult {
  /** ID del producto analizado */
  productoId: string;
  /** SKU del producto */
  sku: string;
  /** Nombre del producto */
  nombreProducto: string;

  /** Precio ingresado por el usuario */
  precioIngresado: number;

  /** Evaluación del precio */
  evaluacion: EvaluacionPrecio;

  /** Estadísticas del histórico */
  estadisticasHistorico: EstadisticasPrecioHistorico;

  /** Datos para gráfico de histórico */
  puntosHistorico: PuntoHistorico[];

  /** Comparativa de proveedores (de investigación) */
  comparativaProveedores: ProveedorComparativa[];

  /** Proyección de rentabilidad */
  proyeccionRentabilidad: ProyeccionRentabilidad;

  /** Análisis de ahorro potencial (si aplica) */
  analisisAhorro: AnalisisAhorro | null;

  /** Alertas activas */
  alertas: AlertaPrecio[];

  /** Tiene datos de investigación */
  tieneInvestigacion: boolean;

  /** La investigación está vigente */
  investigacionVigente: boolean;

  /** Días desde última investigación */
  diasDesdeInvestigacion: number | null;

  /** Tiene histórico de compras */
  tieneHistorico: boolean;

  /** Fecha del análisis */
  fechaAnalisis: Date;
}

// ============================================
// CONFIGURACIÓN DEL ASESOR
// ============================================

/**
 * Configuración para el análisis de inteligencia de precios
 */
export interface PriceIntelligenceConfig {
  /** Tipo de cambio actual */
  tipoCambio: number;
  /** Margen objetivo del producto (%) */
  margenObjetivo: number;
  /** Margen mínimo aceptable (%) */
  margenMinimo: number;
  /** Costo de flete internacional por unidad (ruta según país de origen) */
  costoFleteInternacional: number;
  /** Costo de logística adicional (comisiones, etc.) */
  logisticaAdicional?: number;
  /** Nombre del proveedor actual (si está seleccionado) */
  proveedorActual?: string;
}

/**
 * Input para el análisis
 */
export interface PriceIntelligenceInput {
  /** ID del producto */
  productoId: string;
  /** Precio de compra ingresado (USD) */
  precioCompra: number;
  /** Configuración del análisis */
  config: PriceIntelligenceConfig;
}
