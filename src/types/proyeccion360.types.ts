/**
 * proyeccion360.types.ts
 *
 * Modelo de datos para el Motor de Proyeccion 360 del negocio.
 *
 * CADENA CAUSA-EFECTO:
 *   Compras --> Inventario --> Ventas --> Cobros --> Reinversion --> Compras
 *
 * Cada seccion del modelo consume outputs de las demas secciones,
 * formando un circuito cerrado donde cambiar un supuesto propaga
 * su efecto a toda la cadena.
 *
 * GRAFO DE DEPENDENCIAS (flechas = "alimenta a"):
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                                                                 │
 *   │   ProyeccionVentas ──────────────────────┐                     │
 *   │     │ unidadesProyectadas                 │                     │
 *   │     │ montoProyectadoPEN                  │                     │
 *   │     │                                     ▼                     │
 *   │     │                             ProyeccionMargen              │
 *   │     │                               │ ingresosBrutos            │
 *   │     │                               │ utilidadNeta              │
 *   │     │                               │ margenNeto                │
 *   │     ▼                               │                           │
 *   │   ProyeccionInventario              │                           │
 *   │     │ diasHastaAgotamiento          │                           │
 *   │     │ costoRecompra ────────────────│──────┐                   │
 *   │     │ necesidadRecompra             │      │                   │
 *   │     │                               ▼      ▼                   │
 *   │     │                         ProyeccionFlujoCaja              │
 *   │     │                           │ saldoProyectado              │
 *   │     │                           │ capacidadReinversion ────────┘
 *   │     ▼                           │           (cierra el ciclo)
 *   │   ProyeccionCostos              │
 *   │     │ ctruProyectado            │
 *   │     │ costoVentasProyectado ────┘
 *   │     │ costoOperativoTotal
 *   │     │
 *   │     └──────────► ProyeccionMargen (gastos)
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * METODOS ESTADISTICOS (sin ML):
 *   - Promedio movil simple (SMA): ultimos N periodos
 *   - Tendencia lineal: regresion y = a + bx sobre historial mensual
 *   - Indices de estacionalidad: ratio mes / promedio general
 *   - Propagacion de supuestos: cada % de cambio en un driver se
 *     multiplica por su peso en la formula downstream
 *
 * FUENTES DE DATOS (todo en memoria, ya cargado):
 *   - ctruStore.productosDetalle[]    -> CTRUProductoDetalle
 *   - ctruStore.historialMensual[]    -> HistorialCostosMes
 *   - ctruStore.historialGastos[]     -> HistorialGastosEntry
 *   - ctruStore.resumen               -> CTRUResumenV2
 *   - costoProyeccion.service.ts      -> ProyeccionCTRU, ProyeccionReabastecimiento
 *   - contabilidad.service.ts         -> TendenciaMensual
 *   - tipoCambio.service.ts           -> TC actual y tendencia
 */

import type { Horizonte } from '../services/costoProyeccion.service';

// ============================================
// 0. SUPUESTOS — La base de todo el modelo
// ============================================

/**
 * Todos los numeros del modelo nacen de supuestos explicitos.
 * Cada supuesto tiene su fuente y sensibilidad documentada.
 * Cambiar un supuesto recalcula toda la cadena.
 */
export interface SupuestosProyeccion {
  /** Horizonte en dias: 30 o 90 */
  horizonte: Horizonte;

  /** Tipo de cambio */
  tc: {
    /** TC usado para proyectar (PEN/USD) */
    valor: number;
    /** De donde sale: ultimo real, promedio movil, o manual */
    fuente: 'ultimo_real' | 'promedio_movil_30d' | 'tendencia_lineal' | 'manual';
    /** % de variacion mensual esperada (positivo = sol se deprecia) */
    tendenciaMensualPct: number;
  };

  /** Crecimiento de ventas */
  ventas: {
    /** % de crecimiento sobre el promedio historico */
    crecimientoPct: number;
    /** Fuente del supuesto */
    fuente: 'tendencia_historica' | 'manual' | 'estacional';
  };

  /** Gastos operativos */
  gastos: {
    /** % de variacion esperada en GA/GO */
    gagoVariacionPct: number;
    /** % de variacion esperada en GV/GD */
    gvgdVariacionPct: number;
    fuente: 'tendencia_3m' | 'manual';
  };

  /** Tasa de cobro */
  cobranza: {
    /** % de ventas que se cobran dentro del horizonte */
    tasaCobroPct: number;
    /** Dias promedio de cobro */
    diasPromedioCobro: number;
    fuente: 'historial_cobros' | 'manual';
  };

  /** Costos de proveedor */
  proveedores: {
    /** % de variacion esperada en precios de compra USD */
    variacionPrecioUSDPct: number;
    fuente: 'promedio_movil_3oc' | 'manual';
  };
}

/**
 * Configuracion por defecto para construir supuestos cuando no hay input manual.
 * Se calcula automaticamente desde el historial disponible.
 */
export interface SupuestosAutoCalculados {
  tc: {
    ultimoReal: number;
    promedioMovil30d: number;
    tendenciaMensualPct: number;
    /** Meses de historial disponible para calcular tendencia */
    mesesHistorial: number;
  };
  ventas: {
    promedioMensualUnidades: number;
    tendenciaCrecimientoPct: number;
    /** Indice estacional del mes proyectado (1.0 = promedio) */
    indiceEstacional: number;
  };
  gastos: {
    gagoPromedioMensual: number;
    gagoTendenciaPct: number;
    gvgdPromedioMensual: number;
  };
  cobranza: {
    tasaCobroHistoricaPct: number;
    diasPromedioCobroHistorico: number;
  };
  proveedores: {
    tendenciaPrecioUSDPct: number;
  };
}

// ============================================
// 1. PROYECCION DE VENTAS
// ============================================

/**
 * FORMULA CENTRAL:
 *   unidadesProyectadas[producto] =
 *     SMA(ventasMensuales, 3 meses)
 *     * indiceEstacional[mesProyectado]
 *     * (1 + crecimientoPct)
 *     * (horizonte / 30)
 *
 *   montoProyectadoPEN[producto] =
 *     unidadesProyectadas * precioVentaProm
 *
 *   ticketPromedio = SMA(montoVenta / ventasCount, 3 meses)
 *
 *   clientesEsperados = montoProyectadoPEN / ticketPromedio
 *
 * FUENTE DE DATOS:
 *   - ctruStore.productosDetalle[].ventasDetalle[] -> velocidad por producto
 *   - ctruStore.historialMensual[] -> tendencia y estacionalidad
 *   - ctruStore.productosDetalle[].precioVentaProm -> precio actual
 */
export interface ProyeccionVentasProducto {
  productoId: string;
  productoNombre: string;
  productoSKU: string;

  /** SMA(ventas mensuales, ultimos 3 meses) */
  ventasMensualesPromedio: number;
  /** Ventas diarias = ventasMensualesPromedio / 30 */
  ventasDiariasPromedio: number;
  /** unidadesProyectadas = ventasMensualesPromedio * indiceEstacional * (1+crec) * (horizonte/30) */
  unidadesProyectadas: number;

  /** Precio promedio de venta (PEN). Fuente: CTRUProductoDetalle.precioVentaProm */
  precioVentaProm: number;
  /** montoProyectadoPEN = unidadesProyectadas * precioVentaProm */
  montoProyectadoPEN: number;

  /** Distribucion por canal. Fuente: ventasDetalle[].canal agrupado */
  porCanal: {
    canalId: string;       // 'mercado_libre', 'directo', etc.
    canalNombre: string;
    unidades: number;
    montoPEN: number;
    /** Porcentaje del total de este producto */
    participacionPct: number;
  }[];

  /** Peso de este producto en el total de ventas proyectadas */
  participacionTotalPct: number;
}

export interface ProyeccionVentas {
  /** Detalle por producto */
  productos: ProyeccionVentasProducto[];

  /** === TOTALES === */

  /** Sum(unidadesProyectadas) de todos los productos */
  totalUnidadesProyectadas: number;
  /** Sum(montoProyectadoPEN) de todos los productos */
  totalMontoProyectadoPEN: number;

  /** Distribucion agregada por canal */
  totalesPorCanal: {
    canalId: string;
    canalNombre: string;
    montoPEN: number;
    participacionPct: number;
  }[];

  /**
   * Ticket promedio proyectado.
   * FORMULA: SMA(montoTotal / numVentas, ultimos 3 meses)
   * Fuente: historialMensual[].precioVentaProm * historialMensual[].unidades / historialMensual[].ventasCount
   */
  ticketPromedio: number;

  /**
   * Clientes esperados en el horizonte.
   * FORMULA: totalMontoProyectadoPEN / ticketPromedio
   */
  clientesEsperados: number;

  /**
   * Indice de estacionalidad del mes proyectado.
   * FORMULA: promedio(ventas mes M) / promedio(ventas todos los meses)
   * Rango tipico: 0.7 a 1.4
   * Si hay menos de 12 meses de historial, se usa 1.0
   */
  indiceEstacional: number;

  /**
   * Tendencia de crecimiento mensual (%).
   * FORMULA: pendiente de regresion lineal sobre historialMensual[].ventasCount
   */
  tendenciaCrecimientoMensualPct: number;
}

// ============================================
// 2. PROYECCION DE INVENTARIO
// ============================================

/**
 * FORMULA CENTRAL:
 *   diasHastaAgotamiento[producto] =
 *     unidadesDisponibles / ventasDiariasPromedio
 *     (ventasDiariasPromedio viene de ProyeccionVentas)
 *
 *   necesitaRecompra =
 *     diasHastaAgotamiento < leadTimeDias + margenSeguridad
 *
 *   costoRecompraPEN[producto] =
 *     cantidadSugerida
 *     * ultimoPrecioUSD
 *     * (1 + variacionPrecioUSDPct)
 *     * tcProyectado
 *     * (1 + factorAdicionalesOC)
 *     factorAdicionalesOC = (impuesto + envio + otros) / costoCompra historico
 *
 *   riesgoVencimiento:
 *     unidades donde fechaVencimiento < hoy + diasHastaAgotamiento
 *     (se venceran antes de venderse al ritmo actual)
 *
 * FUENTES:
 *   - ctruStore.productosDetalle[].unidadesActivas -> stock actual
 *   - ProyeccionVentas.productos[].ventasDiariasPromedio -> consumo
 *   - costoProyeccion.service.ProyeccionReabastecimiento -> leadTime, costos
 *   - unidad.types.ts -> fechaVencimiento por unidad
 */
export interface ProyeccionInventarioProducto {
  productoId: string;
  productoNombre: string;
  productoSKU: string;

  /** Unidades en estado 'disponible_peru'. Fuente: CTRUProductoDetalle.unidadesActivas */
  unidadesDisponibles: number;
  /** Unidades con reservadaPara != null */
  unidadesReservadas: number;
  /** Unidades en estados 'en_transito_*' */
  unidadesEnTransito: number;

  /**
   * diasHastaAgotamiento = unidadesDisponibles / ventasDiariasPromedio
   * ventasDiariasPromedio: CONSUME de ProyeccionVentas.productos[mismo productoId]
   * Infinity si ventasDiarias = 0
   */
  diasHastaAgotamiento: number;
  fechaEstimadaAgotamiento: Date;

  /**
   * Lead time en dias (OC creada -> unidades disponibles en Peru).
   * Fuente: costoProyeccion.service._calcularLeadTimePromedio()
   * Default: 30 dias si no hay OCs historicas
   */
  leadTimeDias: number;

  /**
   * necesitaRecompra = diasHastaAgotamiento < (leadTimeDias + 15 dias margen)
   */
  necesitaRecompra: boolean;
  urgenciaRecompra: 'inmediata' | 'proxima' | 'planificada' | 'sin_urgencia';
  /** Fecha limite para emitir la OC y que llegue antes del stockout */
  fechaLimiteCompra: Date;

  /**
   * Cantidad sugerida para cubrir el horizonte.
   * FORMULA: ventasDiariasPromedio * horizonte - (unidadesDisponibles + unidadesEnTransito)
   * Minimo: 0 (no sugerir compra negativa)
   */
  cantidadSugerida: number;

  /**
   * costoRecompraPEN =
   *   cantidadSugerida
   *   * ultimoPrecioCompraUSD * (1 + variacionPrecioUSDPct)
   *   * tcProyectado
   *   * (1 + factorAdicionalesOC)
   *
   * factorAdicionalesOC = (pctImpuesto + pctEnvio + pctOtros + pctFleteIntl) del CTRUProductoDetalle
   */
  costoRecompraUSD: number;
  costoRecompraPEN: number;
  /** CTRU estimado de la nueva compra (sin GA/GO, solo capas 1-5) */
  ctruProyectadoRecompra: number;

  /**
   * Unidades que venceran antes de venderse.
   * FORMULA: contar unidades donde fechaVencimiento < hoy + diasHastaAgotamiento
   * Requiere: unidades con fechaVencimiento definida
   */
  unidadesRiesgoVencimiento: number;
  /** Valor en PEN de las unidades en riesgo de vencimiento (unidades * CTRU) */
  valorRiesgoVencimientoPEN: number;
}

export interface ProyeccionInventario {
  productos: ProyeccionInventarioProducto[];

  /** === TOTALES === */

  /** Total de unidades disponibles en el sistema */
  totalUnidadesDisponibles: number;
  totalUnidadesReservadas: number;
  totalUnidadesEnTransito: number;

  /** Productos que necesitan recompra (urgencia inmediata o proxima) */
  productosNecesitanRecompra: number;
  /**
   * Costo total de recompra en PEN.
   * FORMULA: Sum(costoRecompraPEN) de todos los productos que necesitan recompra
   * ALIMENTA a: ProyeccionFlujoCaja.egresosRecompra
   */
  costoTotalRecompraPEN: number;
  costoTotalRecompraUSD: number;

  /** Total de unidades en riesgo de vencimiento */
  totalUnidadesRiesgoVencimiento: number;
  valorTotalRiesgoVencimientoPEN: number;

  /**
   * Valor del inventario actual en PEN (a costo CTRU).
   * FORMULA: Sum(unidadesDisponibles * ctruPromedio) por producto
   */
  valorInventarioPEN: number;

  /** Rotacion proyectada = costoVentasProyectado / valorInventarioPEN */
  rotacionProyectada: number;
}

// ============================================
// 3. PROYECCION DE COSTOS
// ============================================

/**
 * FORMULA CENTRAL:
 *   ctruProyectado[producto] ya existe en costoProyeccion.service.ts
 *   Se consume directamente.
 *
 *   costoVentasProyectado[producto] =
 *     unidadesProyectadas * ctruProyectado
 *     (unidadesProyectadas: CONSUME de ProyeccionVentas)
 *     (ctruProyectado: CONSUME de costoProyeccion.service)
 *
 *   gagoProyectado =
 *     SMA(GA+GO, ultimos 3 meses)
 *     * (1 + gagoVariacionPct)
 *     * (horizonte / 30)
 *     Fuente: ctruStore.historialGastos[]
 *
 *   gvgdProyectado =
 *     SMA(GV+GD, ultimos 3 meses)
 *     * (1 + gvgdVariacionPct)
 *     * (horizonte / 30)
 *     Fuente: ctruStore.historialGastos[]
 *
 *   costoOperativoTotal = gagoProyectado + gvgdProyectado
 */
export interface ProyeccionCostosProducto {
  productoId: string;
  productoNombre: string;

  /** CTRU proyectado al horizonte. Fuente: costoProyeccion.service.proyectarCTRU() */
  ctruProyectado: number;
  /** CTRU actual para comparacion. Fuente: CTRUProductoDetalle.ctruPromedio */
  ctruActual: number;
  /** % de variacion: (ctruProyectado - ctruActual) / ctruActual * 100 */
  variacionCTRUPct: number;

  /**
   * costoVentasProyectado = unidadesProyectadas * ctruProyectado
   * CONSUME: ProyeccionVentas.productos[].unidadesProyectadas
   */
  costoVentasProyectado: number;

  /**
   * Desglose del CTRU proyectado por capa (para entender que lo mueve)
   * Fuente: costoProyeccion.service.ProyeccionCTRU
   */
  desgloseCTRU: {
    costoCompraPEN: number;
    costoAdicionalOCPEN: number;  // impuesto + envio + otros
    costoFletePEN: number;
    costoGAGOPEN: number;
  };
}

export interface ProyeccionCostos {
  productos: ProyeccionCostosProducto[];

  /** === GASTOS OPERATIVOS (no asignados a producto) === */

  /**
   * GA/GO proyectado al horizonte.
   * FORMULA: SMA(GA+GO, 3m) * (1 + gagoVariacionPct) * (horizonte/30)
   * Fuente: ctruStore.historialGastos[].GA + .GO
   */
  gagoProyectado: number;
  /** Desglose: GA estimado */
  gaEstimado: number;
  /** Desglose: GO estimado */
  goEstimado: number;

  /**
   * GV/GD proyectado al horizonte.
   * FORMULA: SMA(GV+GD, 3m) * (1 + gvgdVariacionPct) * (horizonte/30)
   * Fuente: ctruStore.historialGastos[].GV + .GD
   */
  gvgdProyectado: number;
  gvEstimado: number;
  gdEstimado: number;

  /** Tendencia mensual de GA/GO (% cambio). Fuente: regresion sobre historialGastos */
  gagoTendenciaMensualPct: number;

  /** === TOTALES === */

  /**
   * costoVentasTotalProyectado = Sum(costoVentasProyectado) de todos los productos
   * ALIMENTA a: ProyeccionMargen.costoVentas
   */
  costoVentasTotalProyectado: number;

  /**
   * costoOperativoTotal = gagoProyectado + gvgdProyectado
   * ALIMENTA a: ProyeccionMargen.gastosOperativos
   */
  costoOperativoTotal: number;
}

// ============================================
// 4. PROYECCION DE MARGEN
// ============================================

/**
 * FORMULA CENTRAL:
 *   ingresosBrutos     = ProyeccionVentas.totalMontoProyectadoPEN
 *   costoVentas        = ProyeccionCostos.costoVentasTotalProyectado
 *   utilidadBruta      = ingresosBrutos - costoVentas
 *   margenBrutoPct     = utilidadBruta / ingresosBrutos * 100
 *   gastosOperativos   = ProyeccionCostos.costoOperativoTotal
 *   utilidadOperativa  = utilidadBruta - gastosOperativos
 *   margenOperativoPct = utilidadOperativa / ingresosBrutos * 100
 *   utilidadNeta       = utilidadOperativa  (sin impuestos en este modelo)
 *   margenNetoPct      = utilidadNeta / ingresosBrutos * 100
 *
 * Esta seccion NO genera datos propios. Es 100% derivada de Ventas y Costos.
 * Su valor es presentar el resultado combinado y permitir analisis de sensibilidad.
 */
export interface ProyeccionMargenProducto {
  productoId: string;
  productoNombre: string;

  /** CONSUME: ProyeccionVentas.productos[].montoProyectadoPEN */
  ingresoProyectado: number;
  /** CONSUME: ProyeccionCostos.productos[].costoVentasProyectado */
  costoVentasProyectado: number;
  /** ingresoProyectado - costoVentasProyectado */
  utilidadBrutaProducto: number;
  /** utilidadBrutaProducto / ingresoProyectado * 100 */
  margenBrutoPct: number;

  /** Margen actual para comparacion. Fuente: CTRUProductoDetalle.margenNetoProm */
  margenActualPct: number;
  /** margenBrutoPct - margenActualPct */
  variacionMargenPP: number;

  /** Clasificacion de rentabilidad */
  clasificacion: 'estrella' | 'rentable' | 'marginal' | 'perdida';
}

export interface ProyeccionMargen {
  productos: ProyeccionMargenProducto[];

  /** === P&L PROYECTADO SIMPLIFICADO === */

  /**
   * CONSUME: ProyeccionVentas.totalMontoProyectadoPEN
   */
  ingresosBrutos: number;

  /**
   * CONSUME: ProyeccionCostos.costoVentasTotalProyectado
   */
  costoVentas: number;

  /** ingresosBrutos - costoVentas */
  utilidadBruta: number;
  /** utilidadBruta / ingresosBrutos * 100 */
  margenBrutoPct: number;

  /**
   * CONSUME: ProyeccionCostos.gagoProyectado
   */
  gastosAdminOperativos: number;

  /**
   * CONSUME: ProyeccionCostos.gvgdProyectado
   */
  gastosVentaDistribucion: number;

  /** gastosAdminOperativos + gastosVentaDistribucion */
  totalGastosOperativos: number;

  /** utilidadBruta - totalGastosOperativos */
  utilidadOperativa: number;
  /** utilidadOperativa / ingresosBrutos * 100 */
  margenOperativoPct: number;

  /**
   * En este modelo simplificado, utilidadNeta = utilidadOperativa.
   * No se modelan gastos financieros ni impuestos (datos insuficientes).
   */
  utilidadNeta: number;
  margenNetoPct: number;

  /** === BREAK-EVEN === */

  /**
   * Punto de equilibrio en PEN.
   * FORMULA: costosFijos / (1 - costoVariableUnitario / precioVentaPromedio)
   * costosFijos = gagoProyectado (gastos que no escalan con volumen)
   * costoVariable = ctruPromedioPonderado (costo por unidad vendida)
   * precioVentaPromedio = ingresosBrutos / totalUnidadesProyectadas
   */
  breakEvenPEN: number;
  /** Unidades necesarias para alcanzar el break-even */
  breakEvenUnidades: number;
  /**
   * Margen de seguridad = (ingresosBrutos - breakEvenPEN) / ingresosBrutos * 100
   * Positivo = por encima del break-even. Negativo = por debajo.
   */
  margenSeguridadPct: number;

  /** === COMPARACION HISTORICA === */

  /** Margen bruto promedio de los ultimos 3 meses */
  margenBrutoHistorico3mPct: number;
  /** Margen neto promedio de los ultimos 3 meses */
  margenNetoHistorico3mPct: number;
}

// ============================================
// 5. PROYECCION DE FLUJO DE CAJA
// ============================================

/**
 * FORMULA CENTRAL:
 *   ingresosEsperados =
 *     ProyeccionVentas.totalMontoProyectadoPEN
 *     * tasaCobroPct
 *
 *   egresosRecompra =
 *     ProyeccionInventario.costoTotalRecompraPEN
 *
 *   egresosGastos =
 *     ProyeccionCostos.gagoProyectado + ProyeccionCostos.gvgdProyectado
 *
 *   saldoProyectado =
 *     ingresosEsperados - egresosRecompra - egresosGastos
 *
 *   capacidadReinversion =
 *     max(0, saldoProyectado - reservaMinima)
 *
 * CIERRE DEL CICLO:
 *   capacidadReinversion determina cuanto capital hay para la proxima
 *   ronda de compras. Si < costoTotalRecompraPEN, necesita financiamiento.
 */
export interface ProyeccionFlujoCaja {
  /** === INGRESOS === */

  /**
   * Ventas proyectadas brutas.
   * CONSUME: ProyeccionVentas.totalMontoProyectadoPEN
   */
  ventasProyectadasBrutas: number;

  /**
   * Tasa de cobro esperada (% de ventas que se cobran en el horizonte).
   * CONSUME: SupuestosProyeccion.cobranza.tasaCobroPct
   */
  tasaCobroPct: number;

  /**
   * ingresosEsperados = ventasProyectadasBrutas * tasaCobroPct / 100
   */
  ingresosEsperados: number;

  /** Dias promedio de cobro (informativo). CONSUME: supuestos.cobranza.diasPromedioCobro */
  diasPromedioCobro: number;

  /** === EGRESOS === */

  /**
   * Costo de recompra de inventario.
   * CONSUME: ProyeccionInventario.costoTotalRecompraPEN
   */
  egresosRecompra: number;

  /**
   * Gastos admin/operativos en el horizonte.
   * CONSUME: ProyeccionCostos.gagoProyectado
   */
  egresosGAGO: number;

  /**
   * Gastos de venta/distribucion en el horizonte.
   * CONSUME: ProyeccionCostos.gvgdProyectado
   */
  egresosGVGD: number;

  /** egresosRecompra + egresosGAGO + egresosGVGD */
  totalEgresos: number;

  /** === SALDO === */

  /** ingresosEsperados - totalEgresos */
  saldoProyectado: number;

  /**
   * Reserva minima de caja (configurable, default 10% de egresos).
   * Se resta del saldo para calcular capacidad de reinversion.
   */
  reservaMinimaCaja: number;

  /**
   * Capital disponible para la siguiente ronda de compras.
   * FORMULA: max(0, saldoProyectado - reservaMinimaCaja)
   * CIERRA EL CICLO: este valor es la restriccion de capital
   * para la siguiente iteracion de ProyeccionInventario.
   */
  capacidadReinversion: number;

  /** true si saldoProyectado < 0 */
  necesitaFinanciamiento: boolean;

  /**
   * Si necesitaFinanciamiento = true, cuanto falta.
   * FORMULA: abs(min(0, saldoProyectado)) + reservaMinimaCaja
   */
  montoFinanciamientoNecesario: number;

  /** === COBERTURA === */

  /**
   * Puede la caja proyectada cubrir la recompra necesaria?
   * FORMULA: ingresosEsperados >= egresosRecompra + egresosGAGO + egresosGVGD
   */
  cobreRecompra: boolean;

  /**
   * Ratio de cobertura = ingresosEsperados / totalEgresos
   * >1.0 = superavit, <1.0 = deficit
   */
  ratioCobertura: number;
}

// ============================================
// 6. ANALISIS DE SENSIBILIDAD
// ============================================

/**
 * Responde preguntas tipo:
 *   "Si el TC sube 10%, que pasa con el margen?"
 *   "Si las ventas caen 20%, cuando necesito financiamiento?"
 *
 * Cada SensibilidadVariable muestra el impacto de mover UNA variable
 * mientras las demas se mantienen en su valor base.
 */
export interface SensibilidadVariable {
  /** Nombre del driver que se mueve */
  driver: 'tipo_cambio' | 'volumen_ventas' | 'precio_venta' | 'costo_proveedor' | 'gastos_gago';

  /** Nombre legible */
  driverNombre: string;

  /** Valor base del driver */
  valorBase: number;
  unidad: 'PEN/USD' | 'unidades' | 'PEN' | 'USD' | '%';

  /** Escenarios de variacion */
  escenarios: {
    variacionPct: number;         // -20, -10, +10, +20
    valorDriver: number;          // valor base ajustado
    impactoMargenPP: number;      // puntos porcentuales de cambio en margen neto
    impactoUtilidadPEN: number;   // cambio en utilidad neta PEN
    impactoFlujoCajaPEN: number;  // cambio en saldo de flujo de caja
    necesitaFinanciamiento: boolean;
  }[];

  /**
   * Elasticidad: cuanto cambia el resultado (%) por cada 1% de cambio en el driver.
   * FORMULA: (deltaResultadoPct / deltaDriverPct)
   * >1 = alta sensibilidad, <1 = baja sensibilidad
   */
  elasticidadMargen: number;
  elasticidadFCF: number;

  /** Ranking de importancia: 1 = mayor impacto */
  rankingImpacto: number;
}

/**
 * Escenarios pre-armados: optimista, base, pesimista.
 * Cada uno mueve TODAS las variables simultaneamente.
 */
export interface EscenarioIntegrado {
  nombre: 'optimista' | 'base' | 'pesimista';
  probabilidad: number; // 0.20, 0.60, 0.20
  descripcion: string;

  /** Supuestos del escenario */
  supuestos: {
    tcVariacionPct: number;
    volumenVariacionPct: number;
    costoProveedorVariacionPct: number;
    gagoVariacionPct: number;
    tasaCobroPct: number;
  };

  /** Resultados del escenario (P&L resumido) */
  resultados: {
    ingresosBrutos: number;
    costoVentas: number;
    utilidadBruta: number;
    margenBrutoPct: number;
    gastosOperativos: number;
    utilidadNeta: number;
    margenNetoPct: number;
    flujoCajaNeto: number;
    necesitaFinanciamiento: boolean;
    montoFinanciamiento: number;
  };

  /** Accion sugerida si este escenario se materializa */
  accionSugerida: string;
}

// ============================================
// 7. PROYECCION GLOBAL — UNE TODO
// ============================================

/**
 * Objeto raiz que contiene toda la proyeccion 360.
 * Cada seccion consume datos de las otras secciones
 * siguiendo el grafo de dependencias documentado arriba.
 *
 * ORDEN DE CALCULO (respeta las dependencias):
 *   1. Supuestos           -> se definen primero (manuales o auto)
 *   2. ProyeccionVentas    -> solo depende de supuestos + historial
 *   3. ProyeccionCostos    -> depende de supuestos + historial + ProyeccionVentas
 *   4. ProyeccionInventario-> depende de supuestos + ProyeccionVentas + ProyeccionCostos
 *   5. ProyeccionMargen    -> depende de ProyeccionVentas + ProyeccionCostos
 *   6. ProyeccionFlujoCaja -> depende de ProyeccionVentas + ProyeccionInventario + ProyeccionCostos
 *   7. Sensibilidad        -> re-ejecuta pasos 2-6 con variaciones en supuestos
 *   8. Escenarios          -> re-ejecuta pasos 2-6 con conjuntos de supuestos alternativos
 */
export interface ProyeccionGlobal {
  /** Identificador unico de esta proyeccion */
  id: string;

  /** Fecha y hora de generacion */
  fechaGeneracion: Date;

  /** Horizonte: 30 o 90 dias */
  horizonte: Horizonte;

  /** Supuestos utilizados (la fuente de verdad del modelo) */
  supuestos: SupuestosProyeccion;

  /** Supuestos calculados automaticamente (referencia) */
  supuestosAuto: SupuestosAutoCalculados;

  /** === SECCIONES DEL MODELO === */

  /** Paso 2: Proyeccion de ventas */
  ventas: ProyeccionVentas;

  /** Paso 3: Proyeccion de costos */
  costos: ProyeccionCostos;

  /** Paso 4: Proyeccion de inventario */
  inventario: ProyeccionInventario;

  /** Paso 5: Proyeccion de margen (P&L proyectado) */
  margen: ProyeccionMargen;

  /** Paso 6: Proyeccion de flujo de caja */
  flujoCaja: ProyeccionFlujoCaja;

  /** === ANALISIS === */

  /** Sensibilidad por variable individual */
  sensibilidad: SensibilidadVariable[];

  /** Escenarios integrados: optimista / base / pesimista */
  escenarios: EscenarioIntegrado[];

  /** === META-DATOS === */

  /**
   * Confianza general del modelo.
   * FORMULA:
   *   alta  = >= 6 meses de historial + >= 5 productos con ventas + >= 3 OC historicas
   *   media = >= 3 meses de historial + >= 3 productos con ventas
   *   baja  = menos que lo anterior
   */
  confianza: 'alta' | 'media' | 'baja';
  confianzaDetalle: string;

  /** Meses de historial disponible para calibrar el modelo */
  mesesHistorialDisponible: number;

  /** Productos incluidos en la proyeccion */
  productosIncluidos: number;

  /** Alertas y advertencias del modelo */
  alertas: AlertaProyeccion[];
}

// ============================================
// 8. ALERTAS DEL MODELO
// ============================================

export interface AlertaProyeccion {
  tipo:
    | 'dato_insuficiente'       // Poco historial para proyectar confiablemente
    | 'margen_negativo'         // Algun producto proyecta perdida
    | 'stockout_inminente'      // Producto se agota antes de que llegue recompra
    | 'flujo_caja_negativo'     // No hay caja para cubrir egresos
    | 'vencimiento_inventario'  // Unidades se venceran antes de venderse
    | 'erosion_margen'          // Margen cayendo mes a mes
    | 'concentracion_producto'  // Un solo producto es >50% de ingresos
    | 'concentracion_canal'     // Un solo canal es >80% de ingresos
    | 'tc_volatil'              // TC con alta variabilidad reciente
    | 'gago_creciente';         // Gastos fijos creciendo mas rapido que ingresos

  severidad: 'info' | 'warning' | 'danger';
  mensaje: string;

  /** Seccion del modelo que genera la alerta */
  seccion: 'ventas' | 'inventario' | 'costos' | 'margen' | 'flujo_caja' | 'general';

  /** Producto afectado (si aplica) */
  productoId?: string;
  productoNombre?: string;

  /** Accion sugerida */
  accionSugerida?: string;
}

// ============================================
// 9. MAPA COMPLETO DE FORMULAS DE CONEXION
// ============================================

/**
 * REFERENCIA RAPIDA: como cada output alimenta el siguiente input.
 *
 * ============================================================================
 * VENTAS (Paso 2)
 * ============================================================================
 * INPUT:
 *   supuestos.ventas.crecimientoPct
 *   supuestos.tc.valor (para conversion si aplica)
 *   historialMensual[] (SMA 3 meses)
 *   productosDetalle[].ventasDetalle[] (velocidad por producto)
 *   productosDetalle[].precioVentaProm
 *
 * OUTPUT que otros consumen:
 *   totalMontoProyectadoPEN     --> Margen.ingresosBrutos
 *                               --> FlujoCaja.ventasProyectadasBrutas
 *   totalUnidadesProyectadas    --> Margen.breakEvenUnidades (referencia)
 *   productos[].unidadesProyectadas --> Costos.productos[].costoVentasProyectado
 *   productos[].ventasDiariasPromedio --> Inventario.productos[].diasHastaAgotamiento
 *
 * ============================================================================
 * COSTOS (Paso 3)
 * ============================================================================
 * INPUT:
 *   supuestos.gastos.gagoVariacionPct, gvgdVariacionPct
 *   supuestos.tc.valor
 *   historialGastos[] (SMA 3 meses)
 *   costoProyeccion.service.proyectarCTRU() (ctru por producto)
 *   CONSUME: Ventas.productos[].unidadesProyectadas
 *
 * OUTPUT que otros consumen:
 *   costoVentasTotalProyectado  --> Margen.costoVentas
 *   gagoProyectado              --> Margen.gastosAdminOperativos
 *                               --> FlujoCaja.egresosGAGO
 *   gvgdProyectado              --> Margen.gastosVentaDistribucion
 *                               --> FlujoCaja.egresosGVGD
 *   costoOperativoTotal         --> Margen.totalGastosOperativos
 *
 * ============================================================================
 * INVENTARIO (Paso 4)
 * ============================================================================
 * INPUT:
 *   supuestos.tc.valor (para costoRecompra)
 *   supuestos.proveedores.variacionPrecioUSDPct
 *   productosDetalle[].unidadesActivas
 *   CONSUME: Ventas.productos[].ventasDiariasPromedio
 *   costoProyeccion.service.proyectarReabastecimiento()
 *
 * OUTPUT que otros consumen:
 *   costoTotalRecompraPEN       --> FlujoCaja.egresosRecompra
 *
 * ============================================================================
 * MARGEN (Paso 5) — 100% derivado
 * ============================================================================
 * INPUT (todo consumido, nada propio):
 *   CONSUME: Ventas.totalMontoProyectadoPEN       (= ingresosBrutos)
 *   CONSUME: Costos.costoVentasTotalProyectado    (= costoVentas)
 *   CONSUME: Costos.gagoProyectado                (= gastosAdminOperativos)
 *   CONSUME: Costos.gvgdProyectado                (= gastosVentaDistribucion)
 *
 * OUTPUT:
 *   utilidadNeta, margenNetoPct, breakEvenPEN     --> Solo para display y alertas
 *
 * ============================================================================
 * FLUJO DE CAJA (Paso 6) — Cierra el ciclo
 * ============================================================================
 * INPUT:
 *   supuestos.cobranza.tasaCobroPct
 *   CONSUME: Ventas.totalMontoProyectadoPEN       (= ventasProyectadasBrutas)
 *   CONSUME: Inventario.costoTotalRecompraPEN     (= egresosRecompra)
 *   CONSUME: Costos.gagoProyectado                (= egresosGAGO)
 *   CONSUME: Costos.gvgdProyectado                (= egresosGVGD)
 *
 * OUTPUT:
 *   capacidadReinversion  --> CIERRA EL CICLO:
 *                             restriccion de capital para la siguiente
 *                             ronda de compras (Inventario)
 *   necesitaFinanciamiento --> Alerta de negocio critica
 *
 * ============================================================================
 * SENSIBILIDAD (Paso 7) — Re-ejecuta pasos 2-6
 * ============================================================================
 * Para cada driver (TC, volumen, precio, costos, GAGO):
 *   1. Crear supuestos modificados: supuestos.driver += variacion%
 *   2. Re-calcular Ventas con supuestos modificados
 *   3. Re-calcular Costos con supuestos modificados + Ventas nuevas
 *   4. Re-calcular Inventario con supuestos modificados + Ventas nuevas
 *   5. Re-calcular Margen con Ventas nuevas + Costos nuevos
 *   6. Re-calcular FlujoCaja con todo lo anterior
 *   7. Comparar resultados vs. escenario base
 *   8. Calcular elasticidad = deltaResultado% / deltaDriver%
 *
 * ============================================================================
 */
