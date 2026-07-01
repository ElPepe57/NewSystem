/**
 * proyeccion360.types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Contrato del motor de Proyección 360 · FORECAST DEL RESULTADO del negocio.
 *
 * Redibujo 2026-07-01 (Fase 2+4):
 *  - Modelo 3 CAJAS (Acuerdo 3): Producto (CTRU) · Venta · Período.
 *    Erradicada la nomenclatura GA/GO/GV/GD de este contrato.
 *  - SIN flujo de caja: la caja (real y proyectada) vive en Finanzas.
 *  - Tab Inventario CONSUME el Motor de Reorden (productoIntelStore) — la
 *    proyección lo presenta al horizonte, no re-proyecta demanda.
 *  - Tipos = EXACTAMENTE lo que emite proyeccion360.service (sin campos
 *    aspiracionales). Este archivo y el service se compilan sin @ts-nocheck.
 */

// ─── Horizonte ───────────────────────────────────────────────────────────────

export type Horizonte360 = 30 | 90;

// ─── Ventas proyectadas ──────────────────────────────────────────────────────

export interface VentaProyectadaProducto {
  productoId: string;
  nombre: string;
  sku: string;
  ventasDiarias: number;
  ventasMensuales: number;
  unidadesProyectadas: number;
  ingresosProyectados: number;
  precioPromedio: number;
  pctML: number;
  pctDirecto: number;
  limitadoPorStock: boolean;
  diasHastaStockout: number;
}

export interface ProyeccionVentas {
  totalUnidades: number;
  totalMontoPEN: number;
  ticketPromedio: number;
  ventasPorMesEstimadas: number;
  montoML: number;
  montoDirecto: number;
  productos: VentaProyectadaProducto[];
  ventasMesAnterior: number;
  crecimientoPct: number;
}

// ─── Inventario · CONSUME el Motor de Reorden (no re-proyecta) ───────────────

/**
 * Insumo estructural del Motor de Reorden (SugerenciaReposicion del
 * productoIntelStore lo satisface). La proyección solo LEE estos campos.
 */
export interface ReordenInsumo {
  productoId: string;
  diasParaQuiebre: number;
  cantidadSugerida: number;
  urgencia: 'critica' | 'alta' | 'media' | 'baja';
  puntoReorden?: number;
  stockNeto?: number;
}

export interface InventarioProyectadoProducto {
  productoId: string;
  nombre: string;
  sku: string;
  disponibles: number;
  diasStock: number;
  necesitaRecompra: boolean;
  cantidadSugerida: number;
  urgencia?: ReordenInsumo['urgencia'];
  puntoReorden?: number;
  costoRecompraPEN: number;
  estado: 'ok' | 'atencion' | 'critico';
  /** 'motor' = dato del Motor de Reorden · 'estimado' = fallback sin señal del motor */
  fuente: 'motor' | 'estimado';
}

export interface ProyeccionInventario {
  totalDisponibles: number;
  valorInventarioPEN: number;
  productosEnRiesgo: number;
  costoTotalRecompraPEN: number;
  productos: InventarioProyectadoProducto[];
  /** true si el Motor de Reorden aportó datos (banner "consume motor" en UI) */
  desdeMotorReorden: boolean;
}

// ─── Costos · 3 cajas ────────────────────────────────────────────────────────

export interface ProyeccionCostos {
  /** Caja 1 · Producto: CTRU × unidades proyectadas */
  costoVentasTotal: number;
  /** Caja 2 · Venta (comisiones, pasarelas, delivery, empaque) */
  gastoVentaProyectado: number;
  /** Caja 3 · Período (fijos: administrativos + operativos) */
  gastoPeriodoProyectado: number;
  /** Caja 2 + Caja 3 */
  totalGastosProyectado: number;
  /** Recompra sugerida por el Motor de Reorden (informativo) */
  costoRecompras: number;
  /** Caja 1 + Caja 2 + Caja 3 */
  costoTotal: number;
  ctruPromedioProyectado: number;
  tendenciaCTRU: number;
  impactoTC5Pct: number;
}

// ─── Margen · P&L proyectado 3 cajas ─────────────────────────────────────────

export interface ProyeccionMargen {
  ingresosBrutos: number;
  /** (−) Caja 1 · CTRU */
  costoVentas: number;
  utilidadBruta: number;
  margenBruto: number;
  /** (−) Caja 2 · Venta */
  gastoVenta: number;
  utilidadContribucion: number;
  margenContribucion: number;
  /** (−) Caja 3 · Período */
  gastoPeriodo: number;
  utilidadOperativa: number;
  margenOperativo: number;
  productosMargenNegativo: number;
  productosMargenBajo: number;
  unidadesBreakEven: number;
}

// ─── Escenarios de utilidad ──────────────────────────────────────────────────

export interface Escenario360 {
  nombre: 'optimista' | 'base' | 'pesimista';
  probabilidad: number;
  /** costoCompraVar = variación del precio de COMPRA (afecta CTRU, no el precio de venta) */
  supuestos: { tcVar: number; costoCompraVar: number; gastosVar: number; ventasVar: number };
  ingresos: number;
  costos: number;
  utilidad: number;
  margen: number;
}

// ─── Timeline (real + proyectado) ────────────────────────────────────────────

export interface TimelinePoint {
  label: string;
  tipo: 'real' | 'proyectado';
  ingresos: number;
  costos: number;
  utilidad: number;
  margen: number | null;
  bandaSup?: number;
  bandaInf?: number;
}

// ─── Alertas ─────────────────────────────────────────────────────────────────

export interface Alerta360 {
  seccion: 'inventario' | 'ventas' | 'margen';
  severidad: 'danger' | 'warning' | 'info';
  mensaje: string;
  productoNombre?: string;
  accion: string;
}

// ─── Resultado del motor ─────────────────────────────────────────────────────

export interface Proyeccion360 {
  horizonte: Horizonte360;
  fechaGeneracion: Date;
  confianza: 'alta' | 'media' | 'baja';
  mesesHistorial: number;

  // KPIs ejecutivos (headline del strip)
  ingresosProyectados: number;
  costosProyectados: number;
  utilidadProyectada: number;
  margenNetoProyectado: number;

  // Secciones
  ventas: ProyeccionVentas;
  inventario: ProyeccionInventario;
  costos: ProyeccionCostos;
  margen: ProyeccionMargen;
  escenarios: Escenario360[];
  timeline: TimelinePoint[];
  alertas: Alerta360[];
}
