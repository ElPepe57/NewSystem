import { Timestamp } from 'firebase/firestore';

// ============================================================
// POOL USD CON TCPA — Rendimiento Cambiario V1
// ADR-002: Pool automático, sin vinculación manual
// ============================================================

/**
 * Tipo de movimiento del Pool USD
 * Entradas: recalculan TCPA
 * Salidas: NO cambian TCPA
 */
export type TipoMovimientoPool =
  // — Entradas (aumentan pool, recalculan TCPA) —
  | 'COMPRA_USD_BANCO'            // Conversión PEN→USD en banco/casa de cambio
  | 'COMPRA_USD_EFECTIVO'         // Compra USD en efectivo
  | 'COBRO_VENTA_USD'             // Cobro de venta en USD (Zelle/PayPal)
  | 'SALDO_INICIAL'               // Carga retroactiva del saldo existente
  | 'AJUSTE_CONCILIACION_ENTRADA' // Ajuste de conciliación (entrada)
  // — Salidas (reducen pool, NO cambian TCPA) —
  | 'PAGO_OC'                     // Pago de orden de compra en USD
  | 'GASTO_IMPORTACION_USD'       // Flete, aduana, etc.
  | 'GASTO_SERVICIO_USD'          // Servicios pagados en USD
  | 'COMISION_BANCARIA_USD'       // Comisiones bancarias
  | 'VENTA_USD'                   // Venta directa en USD
  | 'RETIRO_CAPITAL'              // Retiro de capital en USD
  | 'AJUSTE_CONCILIACION_SALIDA'; // Ajuste de conciliación (salida)

/** Dirección del movimiento */
export type DireccionMovimiento = 'entrada' | 'salida';

/** Determina dirección a partir del tipo */
export function esEntrada(tipo: TipoMovimientoPool): boolean {
  return [
    'COMPRA_USD_BANCO',
    'COMPRA_USD_EFECTIVO',
    'COBRO_VENTA_USD',
    'SALDO_INICIAL',
    'AJUSTE_CONCILIACION_ENTRADA',
  ].includes(tipo);
}

// ============================================================
// MOVIMIENTO DEL POOL
// ============================================================

/**
 * Un movimiento individual del Pool USD.
 * Cada entrada/salida de dólares genera un documento.
 * Colección: poolUSDMovimientos
 */
export interface PoolUSDMovimiento {
  id: string;

  // — Clasificación —
  tipo: TipoMovimientoPool;
  direccion: DireccionMovimiento;

  // — Montos —
  montoUSD: number;               // Cantidad de USD del movimiento
  /** TC al que se adquirió este USD (solo entradas) */
  tcOperacion: number;            // TC real de la operación (banco/casa de cambio)
  /** TC SUNAT/SBS del día (para contabilidad) */
  tcSunat: number;
  /** Equivalente en PEN = montoUSD × tcOperacion */
  montoPEN: number;

  // — Estado del pool DESPUÉS de este movimiento —
  poolUSDAntes: number;           // Saldo USD antes
  poolUSDDespues: number;         // Saldo USD después
  tcpaAntes: number;              // TCPA antes del movimiento
  tcpaDespues: number;            // TCPA después (solo cambia en entradas)

  // — Impacto cambiario (salidas) —
  /** Ganancia/pérdida = (tcSunat - tcpa) × montoUSD. Positivo = ganancia */
  impactoCambiario?: number;
  /** Ganancia/pérdida operativa = (tcOperacion - tcpa) × montoUSD */
  impactoOperativo?: number;

  // — Referencia al documento origen —
  documentoOrigenTipo?: 'conversion_cambiaria' | 'orden_compra' | 'venta' | 'gasto' | 'aporte_capital' | 'retiro_capital' | 'manual';
  documentoOrigenId?: string;
  documentoOrigenNumero?: string;

  // — Fecha y auditoría —
  fecha: Timestamp;               // Fecha del movimiento (puede ser retroactiva)
  fechaCreacion: Timestamp;       // Fecha real de registro en el sistema
  creadoPor: string;
  notas?: string;
}

// ============================================================
// SNAPSHOT MENSUAL DEL POOL
// ============================================================

/**
 * Foto del estado del pool al cierre de un período.
 * Colección: poolUSDSnapshots
 * ID del documento: "2026-03" (año-mes)
 */
export interface PoolUSDSnapshot {
  id: string;                     // "2026-03"
  periodo: string;                // "2026-03"
  anio: number;
  mes: number;

  // — Estado del pool al cierre —
  saldoUSD: number;               // USD en el pool
  tcpa: number;                   // TCPA al cierre
  valorPEN_tcpa: number;          // saldoUSD × tcpa (valor según pool)

  // — TC de cierre —
  tcCierreSunat: number;          // TC SUNAT del último día del mes
  tcCierreParalelo: number;       // TC paralelo del último día del mes
  valorPEN_cierre: number;        // saldoUSD × tcCierreSunat (valor de mercado)

  // — Revaluación —
  /** Diferencia = valorPEN_cierre - valorPEN_tcpa. >0 = ganancia */
  diferenciaRevaluacion: number;
  /** true si se generó asiento contable (676/776) */
  asientoGenerado: boolean;

  // — Resumen del período —
  totalEntradasUSD: number;
  totalSalidasUSD: number;
  cantidadMovimientos: number;
  gananciaCambiariaAcumulada: number;  // Suma de impactoCambiario de salidas del período
  gananciaOperativaAcumulada: number;  // Suma de impactoOperativo del período

  // — Auditoría —
  fechaGeneracion: Timestamp;
  generadoPor: string;
}

// ============================================================
// RESUMEN EN TIEMPO REAL
// ============================================================

/**
 * Estado actual del pool (calculado en memoria, no persistido)
 */
export interface PoolUSDResumen {
  saldoUSD: number;
  tcpa: number;
  valorPEN_tcpa: number;          // saldoUSD × tcpa
  valorPEN_mercado: number;       // saldoUSD × TC paralelo actual
  diferenciaNoRealizada: number;  // valorPEN_mercado - valorPEN_tcpa

  // Acumulados del período actual
  entradasUSD: number;
  salidasUSD: number;
  gananciaRealizadaPEN: number;   // Suma de impactoCambiario de salidas
  gananciaOperativaPEN: number;   // Suma de impactoOperativo
  cantidadMovimientos: number;
}

// ============================================================
// IMPACTO POR OPERACIÓN
// ============================================================

/**
 * Análisis de impacto cambiario de una operación específica
 * (calculado on-the-fly, no persistido)
 */
export interface ImpactoCambiarioOperacion {
  documentoTipo: 'orden_compra' | 'venta' | 'gasto';
  documentoId: string;
  documentoNumero: string;
  fecha: Date;

  montoUSD: number;
  tcOperacion: number;            // TC al que se hizo la operación
  tcPool: number;                 // TCPA del pool en ese momento
  tcSunat: number;                // TC SUNAT del día

  // Impacto
  costoPoolPEN: number;           // montoUSD × tcPool (cuánto "costó" según pool)
  costoOperacionPEN: number;      // montoUSD × tcOperacion (cuánto costó realmente)
  costoSunatPEN: number;          // montoUSD × tcSunat (valor fiscal)

  gananciaVsPool: number;         // costoOperacionPEN - costoPoolPEN
  gananciaVsSunat: number;        // costoOperacionPEN - costoSunatPEN
}

// ============================================================
// FORM DATA
// ============================================================

/** Para registrar un movimiento manual del pool */
export interface PoolMovimientoFormData {
  tipo: TipoMovimientoPool;
  montoUSD: number;
  tcOperacion: number;
  fecha: Date;
  notas?: string;
  documentoOrigenTipo?: PoolUSDMovimiento['documentoOrigenTipo'];
  documentoOrigenId?: string;
  documentoOrigenNumero?: string;
}

/** Para registrar el saldo inicial (carga retroactiva) */
export interface SaldoInicialFormData {
  saldoUSD: number;
  tcpa: number;                   // TCPA estimado del saldo existente
  fecha: Date;                    // Fecha efectiva del saldo
  notas?: string;
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

/** Configuración del módulo Pool USD — en configuracion/poolUSD */
export interface PoolUSDConfig {
  /** Día del mes para generar snapshot (default: último día) */
  diaCorte: number;
  /** Generar asiento contable automáticamente al crear snapshot */
  asientoAutoRevaluacion: boolean;
  /** Alerta si TCPA se desvía >N% del TC de mercado */
  alertaDesviacionPorcentaje: number;
  /** Pool habilitado */
  habilitado: boolean;
}

export const POOL_USD_CONFIG_DEFAULTS: PoolUSDConfig = {
  diaCorte: 0,                    // 0 = último día del mes
  asientoAutoRevaluacion: false,  // Manual hasta que se valide
  alertaDesviacionPorcentaje: 5,
  habilitado: true,
};

// ============================================================
// CICLO PEN↔USD — Modelo Completo de Impacto Cambiario
// ============================================================

/**
 * Ratio de Cobertura: cuántos soles de ventas se necesitan
 * para cubrir cada dólar de costo.
 * Fórmula: totalVentasPEN / (totalCostosUSD × TCPA)
 */
export interface RatioCobertura {
  /** Total ventas PEN en el período */
  totalVentasPEN: number;
  /** Total costos USD en el período */
  totalCostosUSD: number;
  /** TCPA al momento del cálculo */
  tcpa: number;
  /** Costo total en PEN = totalCostosUSD × TCPA */
  costoPEN: number;
  /** Ratio = totalVentasPEN / costoPEN. >1 = cubierto */
  ratio: number;
  /** Brecha en PEN = costoPEN - totalVentasPEN. >0 = déficit */
  brechaPEN: number;
  /** Período analizado */
  periodoInicio: Date;
  periodoFin: Date;
}

/**
 * Margen Real vs Nominal por producto/venta.
 * Nominal usa tcPago/tcCompra (histórico por unidad).
 * Real usa TCPA (costo real de los dólares).
 */
export interface MargenRealVsNominal {
  productoId: string;
  nombreProducto: string;
  /** Precio de venta PEN */
  precioVenta: number;
  /** CTRU nominal (usando tcPago/tcCompra de cada unidad) */
  ctruNominal: number;
  /** CTRU real (usando TCPA del pool) */
  ctruReal: number;
  /** Margen nominal PEN = precioVenta - ctruNominal */
  margenNominalPEN: number;
  /** Margen real PEN = precioVenta - ctruReal */
  margenRealPEN: number;
  /** % margen nominal */
  margenNominalPct: number;
  /** % margen real */
  margenRealPct: number;
  /** Diferencia = margenReal - margenNominal. <0 = margen real inferior */
  gapCambiario: number;
}

/**
 * Precio Mínimo de Reposición.
 * Precio al que se debería vender para cubrir el costo de REPONER
 * el producto al TCPA actual (no al TC histórico).
 */
export interface PrecioReposicion {
  productoId: string;
  nombreProducto: string;
  /** Costo USD del producto (costoUnitarioUSD + costoFleteUSD) */
  costoUSD: number;
  /** TCPA actual del pool */
  tcpa: number;
  /** Costo base PEN a reposición = costoUSD × TCPA */
  costoBasePEN: number;
  /** GA/GO proporcional estimado */
  gagoEstimado: number;
  /** Precio mínimo reposición = costoBasePEN + gagoEstimado */
  precioMinReposicion: number;
  /** Precio actual de venta (si existe) */
  precioVentaActual?: number;
  /** true si precioVenta < precioMinReposicion */
  alertaReposicion: boolean;
}

/**
 * Necesidad de Ventas PEN para cubrir compromisos USD.
 * Cuánto en soles necesitas vender para comprar los dólares
 * que necesitas según el TC de mercado actual.
 */
export interface NecesidadVentasPEN {
  /** USD que necesitas comprar (OC pendientes + gastos proyectados) */
  necesidadUSD: number;
  /** TC de mercado actual (compra) */
  tcMercado: number;
  /** PEN necesarios = necesidadUSD × tcMercado */
  penNecesarios: number;
  /** Ventas PEN en pipeline (cotizaciones + ventas pendientes de cobro) */
  ventasPipelinePEN: number;
  /** Cobertura = ventasPipeline / penNecesarios. >1 = cubierto */
  coberturaPipeline: number;
  /** Brecha PEN = penNecesarios - ventasPipeline. >0 = faltan soles */
  brechaPEN: number;
}

/**
 * Escenario del Simulador TC.
 * "¿Qué pasa si el TC sube/baja X%?"
 */
export interface EscenarioTC {
  /** Nombre del escenario */
  nombre: string;
  /** TC simulado */
  tcSimulado: number;
  /** Variación vs TC actual (%) */
  variacionPct: number;
  /** Impacto en valor del pool PEN */
  impactoPoolPEN: number;
  /** Impacto en CTRU real promedio */
  impactoCTRURealPEN: number;
  /** Impacto en margen real promedio (%) */
  impactoMargenPct: number;
  /** Impacto en necesidad de ventas PEN */
  impactoNecesidadPEN: number;
}

/**
 * Resumen completo del Ciclo PEN↔USD para un período.
 */
export interface ResumenCicloPENUSD {
  periodo: { inicio: Date; fin: Date };
  pool: PoolUSDResumen;
  cobertura: RatioCobertura;
  necesidadVentas: NecesidadVentasPEN;
  /** Top productos con mayor gap entre margen nominal y real */
  topGapCambiario: MargenRealVsNominal[];
  /** Productos con alerta de reposición */
  alertasReposicion: PrecioReposicion[];
  /** Escenarios TC pre-calculados: -10%, -5%, base, +5%, +10% */
  escenarios: EscenarioTC[];
}
