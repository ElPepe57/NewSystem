import type { Timestamp } from 'firebase/firestore';

// ============================================
// TIPOS PARA INTELIGENCIA DE PRODUCTOS
// ============================================

/**
 * Clasificacion de rotacion basada en dias promedio de venta
 */
export type ClasificacionRotacion =
  | 'muy_alta'    // Se vende en menos de 7 dias
  | 'alta'        // Se vende entre 7-15 dias
  | 'media'       // Se vende entre 15-30 dias
  | 'baja'        // Se vende entre 30-60 dias
  | 'muy_baja'    // Se vende en mas de 60 dias
  | 'sin_movimiento'; // Sin ventas en 90+ dias

/**
 * Clasificacion de liquidez del producto
 */
export type ClasificacionLiquidez =
  | 'alta'        // Score >= 70: Genera caja rapida
  | 'media'       // Score 40-69: Liquidez moderada
  | 'baja'        // Score < 40: Caja congelada
  | 'critica';    // Score < 20: Problema serio

/**
 * Tendencia del producto
 */
export type TendenciaProducto =
  | 'creciendo'   // Ventas subiendo vs periodo anterior
  | 'estable'     // Sin cambio significativo (-10% a +10%)
  | 'decreciendo' // Ventas bajando vs periodo anterior
  | 'nuevo'       // Menos de 30 dias en el sistema
  | 'sin_datos';  // Sin suficientes datos

/**
 * Metricas de rotacion por producto
 */
export interface MetricasRotacion {
  // Identificacion
  productoId: string;
  sku: string;
  nombreComercial: string;
  marca: string;

  // Stock actual
  stockTotal: number;
  stockDisponible: number;
  stockReservado: number;
  stockTransito: number;

  // Ventas periodo corto (30 dias)
  unidadesVendidas30d: number;
  ventasPEN30d: number;
  promedioVentasDiarias: number; // unidadesVendidas30d / 30

  // Ventas periodo largo (90 dias)
  unidadesVendidas90d: number;
  ventasPEN90d: number;

  // Rotacion calculada
  rotacionDias: number;           // Stock / promedioVentasDiarias
  diasParaQuiebre: number;        // Dias hasta agotar stock
  clasificacionRotacion: ClasificacionRotacion;

  // Frecuencia de venta
  ventasPorSemana: number;
  ventasPorMes: number;
  diasDesdeUltimaVenta: number;

  // Comparativa de periodos
  variacionVentas: number;        // % cambio 30d actual vs 30d anterior
  tendencia: TendenciaProducto;
}

/**
 * Metricas de rentabilidad por producto
 */
export interface MetricasRentabilidad {
  productoId: string;

  // Costos
  costoPromedioUSD: number;       // CTRU promedio
  costoPromedioConFlete: number;  // CTRU + flete USA-Peru

  // Precios de venta
  precioVentaPromedio: number;    // Precio promedio real de venta
  precioSugerido: number;         // Precio del producto

  // Margenes
  margenBrutoPromedio: number;    // % (precio - costo) / precio
  margenNetoPromedio: number;     // % despues de gastos de venta
  margenMinimo: number;           // Margen mas bajo registrado
  margenMaximo: number;           // Margen mas alto registrado

  // Utilidad
  utilidadTotal30d: number;       // Utilidad acumulada 30 dias
  utilidadTotal90d: number;       // Utilidad acumulada 90 dias
  utilidadPorUnidad: number;      // Utilidad promedio por unidad

  // ROI
  roiPromedio: number;            // % retorno sobre inversion
  tiempoRecuperacionDias: number; // Dias para recuperar inversion
}

/**
 * Score de liquidez - metrica compuesta
 */
export interface ScoreLiquidez {
  productoId: string;

  // Score final (0-100)
  score: number;
  clasificacion: ClasificacionLiquidez;

  // Componentes del score
  componenteRotacion: number;     // 0-50 puntos (peso 50%)
  componenteMargen: number;       // 0-30 puntos (peso 30%)
  componenteDemanda: number;      // 0-20 puntos (peso 20%)

  // Interpretacion
  descripcion: string;            // "Alta rotacion, buen margen"
  recomendacion: string;          // "Priorizar reposicion"

  // Valor en riesgo
  valorInventarioUSD: number;     // Stock * CTRU
  valorInventarioPEN: number;     // Stock * CTRU * TC
  potencialVentaPEN: number;      // Stock * Precio venta
  potencialUtilidadPEN: number;   // Utilidad si se vende todo
}

/**
 * Analisis completo de un producto
 */
export interface ProductoIntel {
  // Base
  productoId: string;
  sku: string;
  nombreComercial: string;
  marca: string;

  // Metricas compuestas
  rotacion: MetricasRotacion;
  rentabilidad: MetricasRentabilidad;
  liquidez: ScoreLiquidez;

  // Lead time (si tiene OC historicas)
  leadTimePromedioDias?: number;
  ultimaCompraFecha?: Date;

  // Alertas
  alertas: AlertaProductoIntel[];

  // Metadata
  ultimoCalculo: Date;
}

/**
 * Alerta de inteligencia de producto
 */
export interface AlertaProductoIntel {
  tipo:
    | 'stock_critico'           // Stock por debajo del minimo
    | 'quiebre_inminente'       // Se acabara en menos de X dias
    | 'caja_congelada'          // Producto sin movimiento
    | 'margen_bajo'             // Margen por debajo del objetivo
    | 'tendencia_negativa'      // Ventas cayendo
    | 'oportunidad_reposicion'  // Alta rotacion + bajo stock
    | 'sobre_stock';            // Stock muy por encima de la demanda

  severidad: 'info' | 'warning' | 'danger';
  mensaje: string;
  valor?: number;                // Valor numerico asociado
  fechaCreacion: Date;
}

// ============================================
// DASHBOARD DE LIQUIDEZ
// ============================================

/**
 * Datos de una categoría de caja
 */
export interface CategoriaCaja {
  productos: number;
  unidades: number;
  valorInventarioUSD: number;
  valorInventarioPEN: number;
  potencialVentaPEN: number;
  potencialUtilidadPEN: number;
}

/**
 * Preventa virtual (sin stock físico aún)
 */
export interface PreventaVirtual {
  ventaId: string;
  numeroVenta: string;
  clienteNombre: string;
  fechaReserva: Date;
  vigenciaHasta: Date;
  montoAdelanto: number;
  totalVenta: number;
  productos: {
    productoId: string;
    sku: string;
    nombreProducto: string;
    cantidadRequerida: number;
    cantidadFaltante: number;
  }[];
  requerimientoId?: string;
  fechaEstimadaStock?: Date;
}

/**
 * Resumen de caja por categoria - EXPANDIDO con 4 categorías
 */
export interface ResumenCaja {
  // ========== 4 CATEGORÍAS DE CAJA ==========

  /**
   * Caja Activa: Stock disponible con alta/media rotación
   * Dinero que se convierte rápido en ventas
   */
  cajaActiva: CategoriaCaja & {
    rotacionPromedioDias: number;
  };

  /**
   * Caja Comprometida: Stock reservado (ya tiene comprador)
   * Dinero invertido pero con venta asegurada
   */
  cajaComprometida: CategoriaCaja & {
    adelantosRecibidosPEN: number;
    porCobrarPEN: number;
    ventasReservadas: number;
  };

  /**
   * Caja en Tránsito: Stock en camino USA → Perú
   * Dinero invertido, esperando llegada
   */
  cajaTransito: CategoriaCaja & {
    diasPromedioLlegada: number;
    ordenesEnTransito: number;
  };

  /**
   * Caja Congelada: Stock sin movimiento o baja rotación
   * Dinero "atrapado" que no genera flujo
   */
  cajaCongelada: CategoriaCaja & {
    diasPromedioSinMovimiento: number;
  };

  // ========== LEGACY: Mantener para compatibilidad ==========
  cajaMedia: CategoriaCaja;

  // ========== PREVENTAS VIRTUALES ==========
  /**
   * Preventas sin stock físico (dinero comprometido futuro)
   */
  preventasVirtuales: {
    cantidad: number;
    valorTotalPEN: number;
    adelantosRecibidosPEN: number;
    detalles: PreventaVirtual[];
  };

  // ========== TOTALES ==========
  totalInventarioUSD: number;
  totalInventarioPEN: number;
  totalPotencialVentaPEN: number;
  totalPotencialUtilidadPEN: number;

  // ========== PORCENTAJES (de valor, no de cantidad) ==========
  porcentajeCajaActiva: number;
  porcentajeCajaComprometida: number;
  porcentajeCajaTransito: number;
  porcentajeCajaCongelada: number;
  // Legacy
  porcentajeCajaMedia: number;
}

/**
 * Flujo de caja proyectado
 */
export interface FlujoCajaProyectado {
  // Ingresos esperados (basado en rotacion)
  ingresosProyectados7d: number;
  ingresosProyectados15d: number;
  ingresosProyectados30d: number;

  // Caja pendiente por cobrar (contra entrega)
  cajaPendienteCobrar: number;
  ventasPendientesCobro: number;

  // Caja confirmada (ya cobrada o pagada)
  cajaConfirmada: number;

  // Egresos comprometidos (OC pendientes)
  egresosComprometidos: number;
  ordenesCompraPendientes: number;

  // Proyeccion neta
  flujoNetoProyectado30d: number;
}

/**
 * Sugerencia de reposicion
 */
export interface SugerenciaReposicion {
  productoId: string;
  sku: string;
  nombreComercial: string;
  marca: string;

  // Situacion actual
  stockActual: number;
  stockMinimo: number;
  diasParaQuiebre: number;

  // Recomendacion
  cantidadSugerida: number;       // Basado en rotacion + lead time
  urgencia: 'critica' | 'alta' | 'media' | 'baja';
  razon: string;

  // Proyeccion
  inversionEstimadaUSD: number;
  utilidadProyectadaPEN: number;
  tiempoRecuperacionDias: number;

  // Score de prioridad (para ordenar)
  scorePrioridad: number;         // 0-100
}

// ============================================
// METRICAS DE LEAD TIME
// ============================================

/**
 * Metricas de lead time por producto/proveedor
 */
export interface MetricasLeadTime {
  // Por producto
  productoId?: string;

  // Por proveedor (opcional)
  proveedorId?: string;
  proveedorNombre?: string;

  // Tiempos en dias
  tiempoPromedioTotal: number;           // Desde OC creada hasta recibida en Peru
  tiempoPromedioCompraEnvio: number;     // OC creada → en transito
  tiempoPromedioTransitoUSA: number;     // En transito → recibida USA
  tiempoPromedioUSAPeru: number;         // Recibida USA → disponible Peru

  // Variabilidad
  tiempoMinimo: number;
  tiempoMaximo: number;
  desviacionEstandar: number;

  // Muestra
  ordenesAnalizadas: number;
  periodoAnalisis: {
    desde: Date;
    hasta: Date;
  };
}

/**
 * Historial de metricas para tendencias
 */
export interface HistorialMetricasProducto {
  productoId: string;
  fecha: Timestamp;
  periodo: 'semanal' | 'mensual';

  // Snapshot de metricas
  unidadesVendidas: number;
  ventasPEN: number;
  utilidadPEN: number;
  margenPromedio: number;
  stockFinal: number;
  rotacionDias: number;
  scoreLiquidez: number;
}

// ============================================
// ANALYTICS POR CANAL
// ============================================

/**
 * Rendimiento de producto por canal de venta
 */
export interface RendimientoProductoCanal {
  productoId: string;
  canalId: string;
  canalNombre: string;

  // Ventas
  unidadesVendidas: number;
  ventasBrutasPEN: number;

  // Costos del canal
  comisionesCanal: number;
  gastosEnvioCanal: number;

  // Rentabilidad real del canal
  ventasNetasPEN: number;
  margenNetoCanal: number;

  // Comparativa
  porcentajeVentasTotal: number;  // % del total de ventas del producto
  esCanallMasRentable: boolean;

  // Recomendacion
  recomendacion?: string;         // "Priorizar en este canal"
}
