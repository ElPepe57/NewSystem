import { Timestamp } from 'firebase/firestore';
import type { AsignacionResponsable, ResumenAsignaciones } from './requerimiento.types';

/**
 * ===============================================
 * MÓDULO DE EXPECTATIVA vs REALIDAD
 * ===============================================
 *
 * Trackea la diferencia entre lo que se esperaba ganar/gastar
 * y lo que realmente ocurrió en cada operación del negocio.
 *
 * Flujo:
 * 1. Cotización (expectativa de venta) → Venta Real
 * 2. Requerimiento (expectativa de compra) → Orden de Compra Real
 */

// ===============================================
// EXPECTATIVA DE COTIZACIÓN
// ===============================================

/**
 * Snapshot de expectativas al momento de cotizar
 * Se guarda cuando se crea una cotización para comparar después
 */
export interface ExpectativaCotizacion {
  // Tipo de cambio al cotizar
  tcCotizacion: number;

  // Costos esperados (basados en inventario actual o estimados)
  costoEstimadoUSD: number;        // Costo USD esperado de las unidades
  costoEstimadoPEN: number;        // costoEstimadoUSD × tcCotizacion

  // Margen esperado
  margenEsperado: number;          // % de margen que se esperaba obtener
  utilidadEsperadaPEN: number;     // Utilidad esperada en PEN

  // Productos con sus costos estimados
  productosEstimados: Array<{
    productoId: string;
    cantidad: number;
    costoUnitarioEstimadoUSD: number;  // CTRU estimado al cotizar
    precioVentaPEN: number;
    margenEstimado: number;
  }>;

  // Fecha de la cotización
  fechaCotizacion: Timestamp;

  // Vigencia de la cotización
  vigenciaHasta?: Timestamp;       // Fecha hasta cuando es válida la cotización
  diasVigencia?: number;           // Días de vigencia (default 7)
}

/**
 * Comparación de expectativa vs realidad en una venta
 */
export interface ComparacionVenta {
  ventaId: string;
  numeroVenta: string;

  // Expectativa (al cotizar)
  expectativa: {
    tcCotizacion: number;
    costoEstimadoPEN: number;
    margenEsperado: number;
    utilidadEsperadaPEN: number;
    fechaCotizacion: Timestamp;
  };

  // Realidad (al vender/asignar unidades)
  realidad: {
    tcVenta: number;
    costoRealPEN: number;
    margenReal: number;
    utilidadRealPEN: number;
    fechaVenta: Timestamp;
  };

  // Diferencias
  diferencias: {
    // Diferencia de TC
    diferenciaTC: number;           // tcVenta - tcCotizacion
    impactoTCenPEN: number;         // Impacto del cambio de TC en PEN

    // Diferencia de costo
    diferenciaCostoPEN: number;     // costoReal - costoEstimado

    // Diferencia de margen
    diferenciaMargen: number;       // margenReal - margenEsperado (en %)

    // Diferencia de utilidad
    diferenciaUtilidadPEN: number;  // utilidadReal - utilidadEsperada

    // Resumen
    cumplioExpectativa: boolean;    // true si utilidadReal >= utilidadEsperada
    porcentajeCumplimiento: number; // (utilidadReal / utilidadEsperada) × 100
  };

  // Razones de la diferencia (análisis)
  razones?: string[];
}

// ===============================================
// REQUERIMIENTO DE COMPRA
// ===============================================

/**
 * Estado del requerimiento
 */
export type EstadoRequerimiento =
  | 'borrador'          // En proceso de creación
  | 'pendiente'         // Pendiente de aprobación
  | 'aprobado'          // Aprobado, pendiente de compra
  | 'en_proceso'        // OC creada, en proceso
  | 'completado'        // OC recibida
  | 'cancelado';        // Cancelado

/**
 * Tipo de solicitante del requerimiento
 */
export type TipoSolicitante =
  | 'cliente'           // Pedido por un cliente específico
  | 'administracion'    // Por parte de administración para mantener stock
  | 'ventas'            // Por parte del equipo de ventas
  | 'investigacion';    // Producto interesante encontrado en investigación de mercado

/**
 * Requerimiento de compra
 * Representa la intención/necesidad de comprar antes de crear la OC
 */
export interface Requerimiento {
  id: string;
  numeroRequerimiento: string;    // REQ-2024-001

  // Origen del requerimiento
  origen: 'stock_minimo' | 'venta_pendiente' | 'proyeccion' | 'manual';
  ventaRelacionadaId?: string;    // Si es por venta pendiente

  // Quién solicita el requerimiento
  tipoSolicitante: TipoSolicitante;
  nombreClienteSolicitante?: string;  // Si tipoSolicitante === 'cliente'

  // Productos solicitados
  productos: Array<{
    productoId: string;
    sku: string;
    marca: string;
    nombreComercial: string;
    cantidadSolicitada: number;

    // Cantidades para tracking de asignación múltiple
    cantidadAsignada: number;       // Cantidad total asignada a responsables
    cantidadPendiente: number;      // cantidadSolicitada - cantidadAsignada
    cantidadRecibida: number;       // Cantidad ya recibida en Perú

    // Expectativa de precio (investigación)
    precioEstimadoUSD?: number;     // Precio investigado
    proveedorSugerido?: string;
    urlReferencia?: string;         // Link de Amazon, etc.
    fechaInvestigacion?: Timestamp;
  }>;

  // Asignaciones a responsables/viajeros (soporte para múltiples)
  asignaciones: AsignacionResponsable[];

  // Resumen de asignaciones (para visualización rápida)
  resumenAsignaciones?: ResumenAsignaciones;

  // Expectativa financiera
  expectativa: {
    tcInvestigacion: number;        // TC al momento de investigar
    costoEstimadoUSD: number;       // Suma de precios estimados
    costoEstimadoPEN: number;       // costoEstimadoUSD × tcInvestigacion
    impuestoEstimadoUSD?: number;   // Tax estimado (ej: 7%)
    fleteEstimadoUSD?: number;      // Flete estimado
    costoTotalEstimadoUSD: number;  // Todo incluido
    costoTotalEstimadoPEN: number;
  };

  // Prioridad y urgencia
  prioridad: 'alta' | 'media' | 'baja';
  fechaRequerida?: Timestamp;       // Fecha para cuando se necesita

  // Estado
  estado: EstadoRequerimiento;

  // Relación con OC (cuando se genera)
  ordenCompraId?: string;
  ordenCompraNumero?: string;

  // Notas
  justificacion?: string;
  observaciones?: string;

  // Auditoría
  solicitadoPor: string;
  fechaSolicitud: Timestamp;
  aprobadoPor?: string;
  fechaAprobacion?: Timestamp;
  creadoPor: string;
  fechaCreacion: Timestamp;
}

/**
 * Comparación de expectativa vs realidad en una compra
 */
export interface ComparacionCompra {
  requerimientoId: string;
  numeroRequerimiento: string;
  ordenCompraId: string;
  numeroOrdenCompra: string;

  // Expectativa (al crear requerimiento)
  expectativa: {
    tcInvestigacion: number;
    costoEstimadoUSD: number;
    costoEstimadoPEN: number;
    impuestoEstimadoUSD: number;
    fleteEstimadoUSD: number;
    costoTotalEstimadoUSD: number;
    costoTotalEstimadoPEN: number;
    fechaInvestigacion: Timestamp;
  };

  // Realidad (OC creada y pagada)
  realidad: {
    tcCompra: number;
    tcPago?: number;
    costoProductosUSD: number;
    impuestoRealUSD: number;
    fleteRealUSD: number;
    costoTotalRealUSD: number;
    costoTotalRealPEN: number;
    fechaCompra: Timestamp;
    fechaPago?: Timestamp;
  };

  // Diferencias
  diferencias: {
    // Diferencia de TC
    diferenciaTC: number;           // tcCompra - tcInvestigacion
    diferenciaTCPago?: number;      // tcPago - tcCompra (si aplica)

    // Diferencia de costo (en USD)
    diferenciaCostoUSD: number;     // costoReal - costoEstimado

    // Diferencia de costo (en PEN, considerando TC)
    diferenciaCostoPEN: number;

    // Desglose
    diferenciaImpuesto: number;
    diferenciaFlete: number;

    // Resumen
    dentroPresupuesto: boolean;     // true si costoReal <= costoEstimado × 1.05 (5% tolerancia)
    porcentajeDesviacion: number;   // ((costoReal - costoEstimado) / costoEstimado) × 100
  };

  // Razones de la diferencia
  razones?: string[];
}

// ===============================================
// FORM DATA
// ===============================================

export interface RequerimientoFormData {
  origen: 'stock_minimo' | 'venta_pendiente' | 'proyeccion' | 'manual';
  ventaRelacionadaId?: string;
  tipoSolicitante: TipoSolicitante;
  nombreClienteSolicitante?: string;  // Requerido si tipoSolicitante === 'cliente'
  productos: Array<{
    productoId: string;
    cantidadSolicitada: number;
    precioEstimadoUSD?: number;       // Precio base de compra en USA
    impuestoPorcentaje?: number;      // % de sales tax USA (ej: 3 para 3%)
    logisticaEstimadaUSD?: number;    // Costo logístico por unidad (flete, courier)
    ctruEstimado?: number;            // CTRU ya calculado (precio + logística en PEN)
    proveedorSugerido?: string;
    urlReferencia?: string;
  }>;
  prioridad: 'alta' | 'media' | 'baja';
  fechaRequerida?: Date;
  justificacion?: string;
  observaciones?: string;
}

// ===============================================
// FILTROS
// ===============================================

export interface RequerimientoFiltros {
  estado?: EstadoRequerimiento;
  prioridad?: 'alta' | 'media' | 'baja';
  origen?: 'stock_minimo' | 'venta_pendiente' | 'proyeccion' | 'manual';
  fechaInicio?: Date;
  fechaFin?: Date;
  solicitadoPor?: string;
  productoId?: string;
}

// ===============================================
// ESTADÍSTICAS
// ===============================================

export interface ExpectativaStats {
  // Ventas
  ventas: {
    totalCotizaciones: number;
    cotizacionesConvertidas: number;    // Que se volvieron ventas
    tasaConversion: number;             // %

    margenPromedioEsperado: number;
    margenPromedioReal: number;
    diferenciaMargenPromedio: number;

    utilidadTotalEsperada: number;
    utilidadTotalReal: number;
    cumplimientoUtilidad: number;       // %
  };

  // Compras
  compras: {
    totalRequerimientos: number;
    requerimientosCompletados: number;
    tasaCompletado: number;             // %

    costoTotalEstimado: number;
    costoTotalReal: number;
    desviacionPromedio: number;         // %

    requerimientosDentroPresupuesto: number;
    porcentajeDentroPresupuesto: number;
  };

  // Impacto TC
  impactoTC: {
    ventasAfectadasPorTC: number;
    impactoTotalTCVentas: number;

    comprasAfectadasPorTC: number;
    impactoTotalTCCompras: number;

    impactoNetoTC: number;
  };
}

// ===============================================
// REPORTES
// ===============================================

/**
 * Reporte de expectativa vs realidad por período
 */
export interface ReporteExpectativaVsRealidad {
  mes: number;
  anio: number;

  // Ventas del período
  ventas: {
    cantidad: number;
    utilidadEsperadaTotal: number;
    utilidadRealTotal: number;
    diferencia: number;
    cumplimiento: number;           // %
    detalle: ComparacionVenta[];
  };

  // Compras del período
  compras: {
    cantidad: number;
    costoEstimadoTotal: number;
    costoRealTotal: number;
    diferencia: number;
    desviacion: number;             // %
    detalle: ComparacionCompra[];
  };

  // Resumen de impacto TC
  impactoTC: {
    tcPromedioEsperado: number;     // Promedio de TC al cotizar/investigar
    tcPromedioReal: number;         // Promedio de TC al vender/comprar
    impactoNetoEnPEN: number;       // Ganancia/pérdida por variación TC
  };

  // Lecciones aprendidas
  insights: Array<{
    tipo: 'positivo' | 'negativo' | 'neutral';
    mensaje: string;
    impacto?: number;
  }>;
}
