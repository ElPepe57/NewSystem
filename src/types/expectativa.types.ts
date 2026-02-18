import { Timestamp } from 'firebase/firestore';

// Re-export Requerimiento types from canonical source
export type {
  EstadoRequerimiento,
  TipoSolicitante,
  Requerimiento,
  RequerimientoFormData,
  RequerimientoFiltros
} from './requerimiento.types';

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

// ===============================================
// COMPARACIÓN VENTA
// ===============================================

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
    diferenciaTC: number;           // tcVenta - tcCotizacion
    impactoTCenPEN: number;         // Impacto del cambio de TC en PEN
    diferenciaCostoPEN: number;     // costoReal - costoEstimado
    diferenciaMargen: number;       // margenReal - margenEsperado (en %)
    diferenciaUtilidadPEN: number;  // utilidadReal - utilidadEsperada
    cumplioExpectativa: boolean;    // true si utilidadReal >= utilidadEsperada
    porcentajeCumplimiento: number; // (utilidadReal / utilidadEsperada) × 100
  };

  // Razones de la diferencia (análisis)
  razones?: string[];
}

// ===============================================
// COMPARACIÓN COMPRA
// ===============================================

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
    diferenciaTC: number;           // tcCompra - tcInvestigacion
    diferenciaTCPago?: number;      // tcPago - tcCompra (si aplica)
    diferenciaCostoUSD: number;     // costoReal - costoEstimado
    diferenciaCostoPEN: number;
    diferenciaImpuesto: number;
    diferenciaFlete: number;
    dentroPresupuesto: boolean;     // true si costoReal <= costoEstimado × 1.05 (5% tolerancia)
    porcentajeDesviacion: number;   // ((costoReal - costoEstimado) / costoEstimado) × 100
  };

  // Razones de la diferencia
  razones?: string[];
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
