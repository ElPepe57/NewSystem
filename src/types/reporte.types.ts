import type { Timestamp } from 'firebase/firestore';

export type PeriodoReporte = 
  | 'hoy'
  | 'semana'
  | 'mes'
  | 'trimestre'
  | 'anio'
  | 'personalizado';

export interface RangoFechas {
  inicio: Date;
  fin: Date;
}

export interface MetricaVentas {
  periodo: string;
  ventas: number;
  ventasPEN: number;
  utilidad: number;
  margen: number;
  cantidad: number;
}

export interface ProductoRentabilidad {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  
  unidadesVendidas: number;
  ventasTotalPEN: number;
  costoTotalPEN: number;
  utilidadPEN: number;
  margenPromedio: number;
  
  precioPromedioVenta: number;
  costoPromedioUnidad: number;
}

export interface InventarioValorizado {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  
  unidadesDisponibles: number;
  unidadesAsignadas: number;
  unidadesTotal: number;
  
  valorTotalPEN: number;
  costoPromedioUnidad: number;
  
  unidadesMiami: number;
  unidadesUtah: number;
  unidadesPeru: number;
}

export interface ResumenEjecutivo {
  // Ventas
  ventasTotalesPEN: number;
  ventasMes: number;
  ventasSemana: number;
  ventasHoy: number;

  // Rentabilidad
  utilidadTotalPEN: number;
  margenPromedio: number;
  costoEnvioAsumidoPEN: number;  // Costo de envío asumido por la empresa (cuando incluyeEnvio = true)
  
  // Inventario
  valorInventarioPEN: number;
  unidadesTotales: number;
  unidadesDisponibles: number;
  
  // Órdenes de compra
  ordenesActivas: number;
  ordenesRecibidas: number;
  inversionTotalUSD: number;
  
  // Productos
  productosActivos: number;
  productosMasVendidos: ProductoRentabilidad[];
  
  // Tipo de cambio
  tcActual: number;
  tcPromedio: number;
}

export interface VentasPorCanal {
  mercadoLibre: {
    cantidad: number;
    totalPEN: number;
    porcentaje: number;
  };
  directo: {
    cantidad: number;
    totalPEN: number;
    porcentaje: number;
  };
  otro: {
    cantidad: number;
    totalPEN: number;
    porcentaje: number;
  };
}

export interface TendenciaVentas {
  fecha: string;
  ventas: number;
  utilidad: number;
  margen: number;
}

export interface AlertaInventario {
  tipo: 'stock_bajo' | 'stock_critico' | 'proximo_vencer' | 'vencido';
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  mensaje: string;
  prioridad: 'alta' | 'media' | 'baja';
  cantidad?: number;
  fechaVencimiento?: Timestamp;
}

// ===============================================
// REPORTES DE DIFERENCIA CAMBIARIA
// ===============================================

/**
 * Detalle de diferencia cambiaria por Orden de Compra
 */
export interface DiferenciaCambiariaOC {
  ordenCompraId: string;
  numeroOrden: string;
  proveedor: string;
  fechaCreacion: Date;
  fechaPago?: Date;

  // Montos
  montoUSD: number;

  // TC en cada momento
  tcCreacion: number;
  tcPago?: number;

  // Cálculo de diferencia
  montoPENCreacion: number;    // montoUSD × tcCreacion
  montoPENPago?: number;       // montoUSD × tcPago
  diferenciaPEN: number;       // montoPENPago - montoPENCreacion

  // Indicador
  tipoImpacto: 'ganancia' | 'perdida' | 'neutral';
}

/**
 * Detalle de diferencia cambiaria por Venta
 */
export interface DiferenciaCambiariaVenta {
  ventaId: string;
  numeroVenta: string;
  cliente: string;
  fechaVenta: Date;
  fechaCobro?: Date;

  // El costo de las unidades vendidas (en USD original)
  costoUnidadesUSD: number;

  // TC de las unidades (promedio ponderado)
  tcUnidades: number;

  // TC al momento de la venta
  tcVenta: number;

  // Cálculo
  costoPENOriginal: number;    // costoUnidadesUSD × tcUnidades
  costoPENAlVender: number;    // costoUnidadesUSD × tcVenta
  diferenciaPEN: number;       // costoPENAlVender - costoPENOriginal

  // Impacto en margen
  margenSinDiferencia: number;
  margenConDiferencia: number;
  impactoMargen: number;

  tipoImpacto: 'ganancia' | 'perdida' | 'neutral';
}

/**
 * Resumen mensual de diferencia cambiaria
 */
export interface ReporteDiferenciaCambiariaMes {
  mes: number;
  anio: number;

  // Resumen OC
  ordenesCompra: {
    cantidad: number;
    diferenciaTotal: number;
    ganancia: number;
    perdida: number;
    detalle: DiferenciaCambiariaOC[];
  };

  // Resumen Ventas
  ventas: {
    cantidad: number;
    diferenciaTotal: number;
    impactoMargenPromedio: number;
    detalle: DiferenciaCambiariaVenta[];
  };

  // Conversiones de moneda
  conversiones: {
    cantidad: number;
    montoTotalConvertido: number;
    diferenciaVsReferencia: number;
    spreadPromedio: number;
  };

  // Totales
  diferenciaNetaMes: number;

  // TC del período
  tcPromedioMes: number;
  tcMinimo: number;
  tcMaximo: number;
  volatilidad: number;         // Desviación estándar del TC

  // Comparación con mes anterior
  diferenciaMesAnterior?: number;
  variacionPorcentual?: number;
}

/**
 * Reporte anual de diferencia cambiaria
 */
export interface ReporteDiferenciaCambiariaAnual {
  anio: number;

  // Por mes
  meses: Array<{
    mes: number;
    diferenciaOC: number;
    diferenciaVentas: number;
    diferenciaConversiones: number;
    diferenciaTotal: number;
    tcPromedio: number;
  }>;

  // Acumulados
  diferenciaOCAcumulada: number;
  diferenciaVentasAcumulada: number;
  diferenciaConversionesAcumulada: number;
  diferenciaNetoAnual: number;

  // Indicadores
  impactoEnUtilidad: number;   // % del diferencial vs utilidad total
  mesConMayorPerdida: number;
  mesConMayorGanancia: number;

  // TC del año
  tcPromedioAnual: number;
  tcMinimo: number;
  tcMaximo: number;
  tendencia: 'alza' | 'baja' | 'estable';
}

/**
 * Filtros para reporte de diferencia cambiaria
 */
export interface FiltrosDiferenciaCambiaria {
  mes?: number;
  anio?: number;
  fechaInicio?: Date;
  fechaFin?: Date;
  soloOC?: boolean;
  soloVentas?: boolean;
  soloConversiones?: boolean;
  proveedorId?: string;
  montoMinimo?: number;
}