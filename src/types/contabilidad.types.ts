/**
 * Tipos para el módulo de Contabilidad de Negocio
 * Estado de Resultados basado en flujo de actividad del período
 *
 * CRITERIO: Las compras (OCs recibidas) son el costo principal,
 * no el CMV calculado desde ventas.
 */

/**
 * Período para reportes contables
 */
export interface PeriodoContable {
  mes: number;      // 1-12
  anio: number;     // 2024, 2025, etc.
  nombreMes: string; // 'Enero', 'Febrero', etc.
}

/**
 * Desglose de Compras del Período (Costo de Mercadería)
 * Representa la inversión en inventario del período
 */
export interface ComprasPeriodo {
  /** Costo de productos (subtotal de OCs) */
  costoProductos: number;
  /** Impuestos de importación (Sales Tax USA) */
  impuestos: number;
  /** Flete internacional (transferencias USA-PERU) */
  fleteInternacional: number;
  /** Otros gastos de importación */
  otrosGastosImportacion: number;
  /** Total compras del período */
  total: number;
  /** Porcentaje sobre ventas */
  porcentajeVentas: number;
  /** Número de órdenes de compra recibidas */
  ordenesRecibidas: number;
  /** Unidades compradas */
  unidadesCompradas: number;
  /** Número de transferencias USA-PERU recibidas */
  transferenciasRecibidas?: number;
  /** Unidades transferidas a Perú */
  unidadesTransferidas?: number;
}

/**
 * Desglose de Gastos de Venta (GV)
 * COSTO VARIABLE - varía con las ventas
 */
export interface GastosVenta {
  /** Comisiones de plataformas (ML, pasarelas) */
  comisionesPlataformas: number;
  /** Marketing y publicidad */
  marketingPublicidad: number;
  /** Otros gastos de venta */
  otros: number;
  /** Total GV */
  total: number;
}

/**
 * Desglose de Gastos de Distribución (GD)
 * COSTO VARIABLE - varía con las entregas
 */
export interface GastosDistribucion {
  /** Delivery y última milla */
  delivery: number;
  /** Empaque y materiales */
  empaque: number;
  /** Flete local */
  fleteLocal: number;
  /** Otros gastos de distribución */
  otros: number;
  /** Total GD */
  total: number;
}

/**
 * Desglose de Gastos Administrativos (GA)
 * COSTO FIJO - constante en el período
 */
export interface GastosAdministrativos {
  /** Planilla y honorarios */
  planilla: number;
  /** Servicios (luz, agua, internet, teléfono) */
  servicios: number;
  /** Alquiler de oficina/almacén */
  alquiler: number;
  /** Contabilidad y asesoría */
  contabilidad: number;
  /** Otros gastos administrativos */
  otros: number;
  /** Total GA */
  total: number;
}

/**
 * Desglose de Gastos Operativos (GO)
 * COSTO FIJO - constante en el período
 */
export interface GastosOperativos {
  /** Movilidad y transporte interno */
  movilidad: number;
  /** Suministros de oficina */
  suministros: number;
  /** Mantenimiento y reparaciones */
  mantenimiento: number;
  /** Otros gastos operativos */
  otros: number;
  /** Total GO */
  total: number;
}

/**
 * Agrupación de Costos Variables
 * Varían directamente con el volumen de ventas/entregas
 */
export interface CostosVariables {
  /** Gastos de Venta */
  gv: GastosVenta;
  /** Gastos de Distribución */
  gd: GastosDistribucion;
  /** Total Costos Variables */
  total: number;
  /** Porcentaje sobre ventas */
  porcentajeVentas: number;
}

/**
 * Agrupación de Costos Fijos
 * Constantes del período, independientes del volumen
 */
export interface CostosFijos {
  /** Gastos Administrativos */
  ga: GastosAdministrativos;
  /** Gastos Operativos */
  go: GastosOperativos;
  /** Total Costos Fijos */
  total: number;
  /** Porcentaje sobre ventas */
  porcentajeVentas: number;
}

/**
 * Otros Ingresos y Gastos (no operativos)
 */
export interface OtrosIngresosGastos {
  /** Ganancia por diferencia cambiaria (ventas) */
  gananciaCambiariaVentas: number;
  /** Pérdida por diferencia cambiaria (ventas) */
  perdidaCambiariaVentas: number;
  /** Ganancia por diferencia cambiaria (compras) */
  gananciaCambiariaCompras: number;
  /** Pérdida por diferencia cambiaria (compras) */
  perdidaCambiariaCompras: number;
  /** Diferencia cambiaria neta */
  diferenciaCambiariaNeta: number;
  /** Gastos financieros (intereses, comisiones bancarias) */
  gastosFinancieros: number;
  /** Otros ingresos */
  otrosIngresos: number;
  /** Otros gastos */
  otrosGastos: number;
  /** Total neto */
  total: number;
}

/**
 * Indicadores clave del Estado de Resultados
 */
export interface IndicadoresEstadoResultados {
  /** Margen Bruto = (Ventas - Compras) / Ventas */
  margenBruto: number;
  /** Margen Operativo = EBIT / Ventas */
  margenOperativo: number;
  /** Margen Neto = Utilidad Neta / Ventas */
  margenNeto: number;
  /** Ratio de Inversión = Compras / Ventas */
  ratioInversion: number;
  /** Ratio Gastos Variables = (GV + GD) / Ventas */
  ratioGastosVariables: number;
  /** Ratio Gastos Fijos = (GA + GO) / Ventas */
  ratioGastosFijos: number;
  /** Punto de Equilibrio en soles */
  puntoEquilibrioSoles: number;
  /** Punto de Equilibrio en unidades */
  puntoEquilibrioUnidades: number;
  /** Margen de Seguridad = (Ventas - PE) / Ventas */
  margenSeguridad: number;
}

/**
 * Métricas operativas del período
 */
export interface MetricasOperativas {
  /** Número de transacciones (ventas) */
  transacciones: number;
  /** Ticket promedio */
  ticketPromedio: number;
  /** Unidades vendidas */
  unidadesVendidas: number;
  /** Precio promedio por unidad */
  precioPromedioUnidad: number;
  /** Órdenes de compra recibidas */
  ordenesCompra: number;
  /** Unidades compradas */
  unidadesCompradas: number;
  /** Rotación implícita = Ventas / Compras */
  rotacionImplicita: number;
}

/**
 * Estado de Resultados completo
 * Estructura basada en flujo de actividad del negocio
 */
export interface EstadoResultados {
  /** Período del reporte */
  periodo: PeriodoContable;

  /** Fecha de generación */
  fechaGeneracion: Date;

  // ========== INGRESOS ==========
  /** Ventas brutas del período */
  ventasBrutas: number;
  /** Descuentos otorgados */
  descuentos: number;
  /** Devoluciones */
  devoluciones: number;
  /** Ventas Netas = Brutas - Descuentos - Devoluciones */
  ventasNetas: number;

  // ========== COSTO DE MERCADERÍA ==========
  /** Compras del período (OCs recibidas) */
  compras: ComprasPeriodo;

  /** UTILIDAD BRUTA = Ventas Netas - Compras */
  utilidadBruta: number;
  utilidadBrutaPorcentaje: number;

  // ========== GASTOS OPERATIVOS ==========
  /** Costos Variables (GV + GD) */
  costosVariables: CostosVariables;
  /** Costos Fijos (GA + GO) */
  costosFijos: CostosFijos;
  /** Total Gastos Operativos */
  totalGastosOperativos: number;
  totalGastosOperativosPorcentaje: number;

  /** UTILIDAD OPERATIVA (EBIT) = Utilidad Bruta - Gastos Operativos */
  utilidadOperativa: number;
  utilidadOperativaPorcentaje: number;

  // ========== OTROS INGRESOS/GASTOS ==========
  otrosIngresosGastos: OtrosIngresosGastos;

  /** UTILIDAD NETA ANTES DE IMPUESTOS */
  utilidadNeta: number;
  utilidadNetaPorcentaje: number;

  // ========== ANTICIPOS ==========
  /** Anticipos recibidos que NO son ingreso del período (ventas no entregadas) */
  anticiposPendientes: number;
  /** Ventas netas REALIZADAS (excluyendo anticipos no entregados) */
  ventasNetasRealizadas: number;

  // ========== INDICADORES ==========
  indicadores: IndicadoresEstadoResultados;

  // ========== MÉTRICAS OPERATIVAS ==========
  metricas: MetricasOperativas;
}

/**
 * Comparación de períodos (mes actual vs anterior, vs mismo mes año anterior)
 */
export interface ComparacionPeriodos {
  periodoActual: EstadoResultados;
  periodoAnterior?: EstadoResultados;
  mismoMesAnioAnterior?: EstadoResultados;

  /** Variaciones vs período anterior */
  variacionMesAnterior?: {
    ventasNetas: number;        // % cambio
    utilidadBruta: number;
    utilidadOperativa: number;
    utilidadNeta: number;
  };

  /** Variaciones vs mismo mes año anterior */
  variacionAnioAnterior?: {
    ventasNetas: number;
    utilidadBruta: number;
    utilidadOperativa: number;
    utilidadNeta: number;
  };
}

/**
 * Estado de Resultados acumulado (año a la fecha)
 */
export interface EstadoResultadosAcumulado {
  anio: number;
  mesesIncluidos: number[];   // [1, 2, 3] = Ene-Mar
  nombreRango: string;        // "Enero - Marzo 2026"

  // Los mismos campos que EstadoResultados pero acumulados
  ventasBrutas: number;
  descuentos: number;
  devoluciones: number;
  ventasNetas: number;

  compras: ComprasPeriodo;
  utilidadBruta: number;
  utilidadBrutaPorcentaje: number;

  costosVariables: CostosVariables;
  costosFijos: CostosFijos;
  totalGastosOperativos: number;
  utilidadOperativa: number;
  utilidadOperativaPorcentaje: number;

  otrosIngresosGastos: OtrosIngresosGastos;
  utilidadNeta: number;
  utilidadNetaPorcentaje: number;

  indicadores: IndicadoresEstadoResultados;
  metricas: MetricasOperativas;

  /** Promedio mensual */
  promedioMensual: {
    ventasNetas: number;
    utilidadOperativa: number;
    utilidadNeta: number;
  };
}

/**
 * Datos para el gráfico de tendencia mensual
 */
export interface TendenciaMensual {
  mes: number;
  anio: number;
  nombreMes: string;
  ventasNetas: number;
  compras: number;
  utilidadBruta: number;
  gastosOperativos: number;
  utilidadOperativa: number;
  utilidadNeta: number;
}

/**
 * Filtros para reportes contables
 */
export interface FiltrosContabilidad {
  mes?: number;
  anio?: number;
  rangoMeses?: { desde: number; hasta: number };
  compararConAnterior?: boolean;
  compararConAnioAnterior?: boolean;
}

/**
 * Resumen rápido para dashboard
 */
export interface ResumenContable {
  periodo: PeriodoContable;
  ventasNetas: number;
  compras: number;
  utilidadBruta: number;
  gastosOperativos: number;
  utilidadNeta: number;
  margenNeto: number;

  // Comparación rápida
  variacionVsMesAnterior?: number;
  tendencia: 'subiendo' | 'bajando' | 'estable';
}

/**
 * Notas contables para el reporte
 */
export interface NotasContables {
  criterioReconocimiento: {
    ventas: string;
    compras: string;
    gastos: string;
  };
  moneda: {
    funcional: string;
    conversion: string;
  };
  limitaciones: string[];
}

// ============================================================================
// BALANCE GENERAL (Balance Sheet)
// ============================================================================

/**
 * Efectivo y Equivalentes de Efectivo
 */
export interface EfectivoEquivalentes {
  /** Efectivo en caja */
  cajaEfectivo: number;
  /** Cuentas bancarias en PEN */
  bancosPEN: number;
  /** Cuentas bancarias en USD (convertido a PEN) */
  bancosUSD: number;
  /** Valor en USD antes de conversión */
  bancosUSDOriginal: number;
  /** Billeteras digitales */
  billeterasDigitales: number;
  /** Total efectivo */
  total: number;
  /** Tipo de cambio usado */
  tipoCambio: number;
  /** Detalle por cuenta */
  detalleCuentas?: Array<{
    id: string;
    nombre: string;
    tipo: string;
    moneda: string;
    saldo: number;
    saldoPEN: number;
  }>;
}

/**
 * Cuentas por Cobrar (Accounts Receivable)
 */
export interface CuentasPorCobrar {
  /** Total de ventas pendientes de cobro */
  ventasPendientes: number;
  /** Número de ventas pendientes */
  cantidadVentas: number;
  /** Provisión para cuentas incobrables (estimación) */
  provisionIncobrables: number;
  /** Cuentas por cobrar netas */
  neto: number;
  /** Antigüedad de cartera */
  antiguedad: {
    de0a7dias: number;
    de8a15dias: number;
    de16a30dias: number;
    mayor30dias: number;
  };
  /** Por canal de venta */
  porCanal?: Record<string, number>;
}

/**
 * Inventarios valorizado con CTRU
 */
export interface Inventarios {
  /** Inventario en USA */
  inventarioUSA: {
    unidades: number;
    valorUSD: number;
    valorPEN: number;
    enAlmacenes: number;
    enTransito: number;
  };
  /** Inventario en Perú */
  inventarioPeru: {
    unidades: number;
    valorPEN: number;
    disponible: number;
    reservado: number;
  };
  /** Total inventario */
  totalUnidades: number;
  totalValorPEN: number;
  /** Método de valorización */
  metodoValorizacion: 'CTRU' | 'Promedio' | 'PEPS';
  /** CTRU promedio general */
  ctruPromedio: number;
  /** Tipo de cambio usado */
  tipoCambio: number;
}

/**
 * Activo Corriente (Current Assets)
 */
export interface ActivoCorriente {
  efectivo: EfectivoEquivalentes;
  cuentasPorCobrar: CuentasPorCobrar;
  inventarios: Inventarios;
  /** Gastos pagados por anticipado (si aplica) */
  gastosPagadosAnticipado?: number;
  /** Otros activos corrientes */
  otrosActivosCorrientes?: number;
  /** Total Activo Corriente */
  total: number;
}

/**
 * Activo No Corriente (Non-Current Assets)
 * Nota: Puede expandirse según necesidades del negocio
 */
export interface ActivoNoCorriente {
  /** Propiedades, planta y equipo (neto) */
  propiedadPlantaEquipo?: number;
  /** Depreciación acumulada */
  depreciacionAcumulada?: number;
  /** Activos intangibles */
  intangibles?: number;
  /** Otros activos no corrientes */
  otros?: number;
  /** Total Activo No Corriente */
  total: number;
}

/**
 * Total Activos
 */
export interface Activos {
  corriente: ActivoCorriente;
  noCorriente: ActivoNoCorriente;
  totalActivos: number;
}

/**
 * Cuentas por Pagar a Proveedores (OCs pendientes)
 */
export interface CuentasPorPagarProveedores {
  /** OCs pendientes de pago (en PEN) */
  ordenesCompraPendientes: number;
  /** Valor original en USD */
  ordenesCompraUSD: number;
  /** Cantidad de OCs pendientes */
  cantidadOCs: number;
  /** Antigüedad */
  antiguedad: {
    de0a7dias: number;
    de8a15dias: number;
    de16a30dias: number;
    mayor30dias: number;
  };
}

/**
 * Anticipos de Clientes (Ingresos Diferidos)
 * Pagos recibidos por ventas cuyo producto aún no ha sido entregado
 */
export interface AnticiposClientes {
  /** Total anticipos pendientes de entrega (PEN) */
  totalAnticiposPEN: number;
  /** Cantidad de ventas con anticipos pendientes */
  cantidadVentas: number;
  /** Detalle por venta */
  detalle?: Array<{
    ventaId: string;
    numeroVenta: string;
    clienteNombre: string;
    montoAnticipo: number;
    estado: string;
  }>;
}

/**
 * Otras Cuentas por Pagar
 */
export interface OtrasCuentasPorPagar {
  /** Gastos pendientes de pago */
  gastosPendientes: number;
  /** Pagos a viajeros/transportistas pendientes */
  pagosViajerosPendientes: number;
  /** Impuestos por pagar (estimación) */
  impuestosPorPagar?: number;
  /** Otras obligaciones */
  otras?: number;
  /** Total otras cuentas por pagar */
  total: number;
}

/**
 * Detalle de una deuda financiera individual (tarjeta, préstamo, línea de crédito)
 */
export interface DeudaFinanciera {
  cuentaId: string;
  nombreCuenta: string;
  banco?: string;
  /** Monto positivo de la deuda (lo que se debe) */
  montoDeuda: number;
  moneda: string;
  /** Equivalente en PEN */
  montoPEN: number;
}

/**
 * Deudas Financieras de Corto Plazo
 * Incluye tarjetas de crédito, préstamos de viajeros, y otras líneas de crédito
 */
export interface DeudasFinancieras {
  /** Total deuda en tarjetas de crédito (PEN) */
  tarjetasCredito: number;
  /** Total adeudado a viajeros por productos comprados */
  prestamosViajeros: number;
  /** Otras líneas de crédito / préstamos */
  otrasDeudas: number;
  /** Total deudas financieras */
  total: number;
  /** Detalle por cuenta de crédito */
  detalle: DeudaFinanciera[];
}

/**
 * Pasivo Corriente (Current Liabilities)
 */
export interface PasivoCorriente {
  cuentasPorPagarProveedores: CuentasPorPagarProveedores;
  otrasCuentasPorPagar: OtrasCuentasPorPagar;
  /** Anticipos de clientes (ingresos diferidos) */
  anticiposClientes: AnticiposClientes;
  /** Deudas financieras de corto plazo (tarjetas, préstamos, líneas de crédito) */
  deudasFinancieras: DeudasFinancieras;
  /** Total Pasivo Corriente */
  total: number;
}

/**
 * Pasivo No Corriente (Non-Current Liabilities)
 */
export interface PasivoNoCorriente {
  /** Deudas a largo plazo */
  deudasLargoPlazo?: number;
  /** Provisiones a largo plazo */
  provisiones?: number;
  /** Otros pasivos no corrientes */
  otros?: number;
  /** Total Pasivo No Corriente */
  total: number;
}

/**
 * Total Pasivos
 */
export interface Pasivos {
  corriente: PasivoCorriente;
  noCorriente: PasivoNoCorriente;
  totalPasivos: number;
}

/**
 * Patrimonio (Equity)
 */
export interface Patrimonio {
  /** Capital social/inicial */
  capitalSocial: number;
  /** Reservas legales */
  reservas?: number;
  /** Utilidades acumuladas de años anteriores */
  utilidadesAcumuladas: number;
  /** Utilidad/Pérdida del ejercicio actual (YTD) */
  utilidadEjercicio: number;
  /** Total Patrimonio */
  totalPatrimonio: number;
  /** Detalle de composición del capital (para transparencia) */
  _detalle?: {
    /** Capital base configurado inicialmente */
    capitalSocialBase: number;
    /** Total de aportes de capital registrados */
    aportesCapitalTotal: number;
    /** Total de retiros de capital */
    retirosCapitalTotal: number;
    /** Total de utilidades distribuidas a socios */
    utilidadesDistribuidas: number;
    /** Cantidad de registros de aportes */
    cantidadAportes: number;
    /** Cantidad de registros de retiros */
    cantidadRetiros: number;
  };
}

/**
 * Balance General Completo
 */
export interface BalanceGeneral {
  /** Fecha del balance (corte) */
  fechaCorte: Date;
  /** Período de referencia */
  periodo: PeriodoContable;
  /** Tipo de cambio usado */
  tipoCambio: number;

  // ========== ACTIVOS ==========
  activos: Activos;

  // ========== PASIVOS ==========
  pasivos: Pasivos;

  // ========== PATRIMONIO ==========
  patrimonio: Patrimonio;

  // ========== VERIFICACIÓN ==========
  /** Total Pasivos + Patrimonio (debe = Total Activos) */
  totalPasivosPatrimonio: number;
  /** Diferencia (debe ser 0 o muy cercano) */
  diferencia: number;
  /** El balance cuadra? */
  balanceCuadra: boolean;
}

// ============================================================================
// INDICADORES FINANCIEROS (Financial Ratios)
// ============================================================================

/**
 * Ratios de Liquidez
 * Miden la capacidad de pago a corto plazo
 */
export interface RatiosLiquidez {
  /** Razón Corriente = Activo Corriente / Pasivo Corriente */
  razonCorriente: number;
  /** Prueba Ácida = (Activo Corriente - Inventarios) / Pasivo Corriente */
  pruebaAcida: number;
  /** Capital de Trabajo = Activo Corriente - Pasivo Corriente */
  capitalTrabajo: number;
  /** Razón de Efectivo = Efectivo / Pasivo Corriente */
  razonEfectivo: number;
}

/**
 * Ratios de Solvencia/Endeudamiento
 * Miden la estructura de financiamiento
 */
export interface RatiosSolvencia {
  /** Endeudamiento Total = Pasivos / Activos */
  endeudamientoTotal: number;
  /** Endeudamiento Patrimonio = Pasivos / Patrimonio */
  endeudamientoPatrimonio: number;
  /** Autonomía = Patrimonio / Activos */
  autonomia: number;
  /** Apalancamiento = Activos / Patrimonio */
  apalancamiento: number;
}

/**
 * Ratios de Rentabilidad
 */
export interface RatiosRentabilidad {
  /** ROA = Utilidad Neta / Activos Totales */
  roa: number;
  /** ROE = Utilidad Neta / Patrimonio */
  roe: number;
  /** Margen Bruto = Utilidad Bruta / Ventas */
  margenBruto: number;
  /** Margen Operativo = EBIT / Ventas */
  margenOperativo: number;
  /** Margen Neto = Utilidad Neta / Ventas */
  margenNeto: number;
}

/**
 * Ratios de Actividad/Gestión
 * Miden la eficiencia operativa
 */
export interface RatiosActividad {
  /** Rotación de Inventarios = Costo Ventas / Inventario Promedio */
  rotacionInventarios: number;
  /** Días de Inventario = 365 / Rotación Inventarios */
  diasInventario: number;
  /** Rotación Cuentas por Cobrar = Ventas / CxC Promedio */
  rotacionCxC: number;
  /** Días de Cobro = 365 / Rotación CxC */
  diasCobro: number;
  /** Rotación Cuentas por Pagar = Compras / CxP Promedio */
  rotacionCxP: number;
  /** Días de Pago = 365 / Rotación CxP */
  diasPago: number;
  /** Ciclo de Conversión de Efectivo = Días Inv + Días Cobro - Días Pago */
  cicloConversionEfectivo: number;
}

/**
 * Todos los indicadores financieros
 */
export interface IndicadoresFinancieros {
  liquidez: RatiosLiquidez;
  solvencia: RatiosSolvencia;
  rentabilidad: RatiosRentabilidad;
  actividad: RatiosActividad;
  /** Fecha de cálculo */
  fechaCalculo: Date;
  /** Período base */
  periodo: PeriodoContable;
}

/**
 * Análisis financiero con semáforo
 */
export interface AnalisisFinanciero {
  indicador: string;
  valor: number;
  valorFormateado: string;
  estado: 'excelente' | 'bueno' | 'regular' | 'malo' | 'critico';
  descripcion: string;
  recomendacion?: string;
}

/**
 * Dashboard financiero completo
 */
export interface DashboardFinanciero {
  /** Balance General */
  balance: BalanceGeneral;
  /** Estado de Resultados del período */
  estadoResultados: EstadoResultados;
  /** Indicadores financieros */
  indicadores: IndicadoresFinancieros;
  /** Análisis con semáforo */
  analisis: AnalisisFinanciero[];
  /** Alertas críticas */
  alertas: Array<{
    tipo: 'peligro' | 'advertencia' | 'info';
    titulo: string;
    mensaje: string;
  }>;
}
