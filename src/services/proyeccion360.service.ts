/**
 * proyeccion360.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de Proyección 360 · FORECAST DEL RESULTADO del negocio.
 * Calcula TODO en memoria usando datos del ctruStore — sin queries a Firestore.
 *
 * Redibujo 2026-07-01 (Fase 2+4):
 *  - Modelo 3 CAJAS (Acuerdo 3): Producto (CTRU) · Venta · Período.
 *  - SIN flujo de caja (la caja vive en Finanzas · se eliminó el flujo sintético).
 *  - Inventario CONSUME el Motor de Reorden (ReordenInsumo del productoIntelStore):
 *    la proyección lo presenta al horizonte, no re-proyecta demanda.
 *  - Tipado contra proyeccion360.types (sin @ts-nocheck) · tc se pasa explícito
 *    (antes `tcActual` quedaba fuera de scope en las calculadoras · bug).
 *
 * Cadena: Ventas → Inventario (motor) → Costos (3 cajas) → Margen (P&L) →
 *         Escenarios → Timeline → Alertas
 */

import type {
  Horizonte360, Proyeccion360, ProyeccionVentas, ProyeccionInventario,
  ProyeccionCostos, ProyeccionMargen, ReordenInsumo,
  Escenario360, TimelinePoint, Alerta360, VentaProyectadaProducto,
  InventarioProyectadoProducto
} from '../types/proyeccion360.types';
import type { CTRUProductoDetalle, HistorialCostosMes, HistorialGastosEntry } from '../store/ctruStore';

// ============================================
// HELPERS
// ============================================

function promMovil(arr: number[], n = 3): number {
  const valid = arr.filter(v => v > 0);
  if (!valid.length) return 0;
  return valid.slice(-n).reduce((s, v) => s + v, 0) / Math.min(n, valid.length);
}

function tendencia(arr: number[]): number {
  const valid = arr.filter(v => v > 0);
  if (valid.length < 2) return 0;
  return ((valid[valid.length - 1] - valid[0]) / valid[0]) / (valid.length - 1);
}

function mesLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });
}

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export function calcularProyeccion360(
  productos: CTRUProductoDetalle[],
  historialMensual: HistorialCostosMes[],
  historialGastos: HistorialGastosEntry[],
  horizonte: Horizonte360,
  tcActual: number = 3.50,
  reorden: ReordenInsumo[] = []
): Proyeccion360 {

  const periodos = horizonte === 30 ? 1 : 3;
  const hist = (historialMensual || []).slice(-6);
  const gastos = (historialGastos || []).slice(-6);

  // ─── PASO 1: VENTAS PROYECTADAS ───
  const ventas = calcularVentas(productos, hist, periodos);

  // ─── PASO 2: INVENTARIO · consume el Motor de Reorden ───
  const inventario = calcularInventario(productos, ventas, reorden);

  // ─── PASO 3: COSTOS PROYECTADOS · 3 cajas ───
  const costos = calcularCostos(productos, ventas, inventario, gastos, periodos, tcActual);

  // ─── PASO 4: MARGEN · P&L 3 cajas ───
  const margen = calcularMargen(ventas, costos, productos);

  // ─── PASO 5: ESCENARIOS DE UTILIDAD ───
  const escenarios = calcularEscenarios(ventas, costos);

  // ─── PASO 6: TIMELINE ───
  const timeline = construirTimeline(hist, ventas, costos, periodos);

  // ─── PASO 7: ALERTAS ───
  const alertas = consolidarAlertas(ventas, inventario, margen);

  // ─── CONFIANZA ───
  const mesesHistorial = hist.length;
  const confianza: Proyeccion360['confianza'] =
    mesesHistorial >= 6 ? 'alta' : mesesHistorial >= 3 ? 'media' : 'baja';

  return {
    horizonte,
    fechaGeneracion: new Date(),
    confianza,
    mesesHistorial,
    ingresosProyectados: ventas.totalMontoPEN,
    costosProyectados: costos.costoTotal,
    utilidadProyectada: margen.utilidadOperativa,
    margenNetoProyectado: margen.margenOperativo,
    ventas, inventario, costos, margen,
    escenarios, timeline, alertas,
  };
}

// ============================================
// CALCULADORAS ENCADENADAS
// ============================================

function calcularVentas(
  productos: CTRUProductoDetalle[],
  hist: HistorialCostosMes[],
  periodos: number
): ProyeccionVentas {
  // Mix de canal: estimado desde las ventas de cada producto
  let totalML = 0, totalDirecto = 0;
  productos.forEach(p => {
    const ventas = p.ventasDetalle || [];
    ventas.forEach(v => {
      const monto = (v.cantidad || 1) * (v.precioUnitario || 0);
      // Heurística: si hay canal, usar; si no, asumir 60/40
      totalDirecto += monto * 0.6; // ajustar cuando haya campo canal
      totalML += monto * 0.4;
    });
  });
  // Sin historial de ventas el mix cae a la heurística 60/40 (no a 0/0, que
  // dejaría montoML+montoDirecto ≠ totalMontoPEN).
  const totalMix = totalML + totalDirecto;
  const pctML = totalMix > 0 ? totalML / totalMix : 0.4;
  const pctDirecto = totalMix > 0 ? totalDirecto / totalMix : 0.6;

  const productosVenta: VentaProyectadaProducto[] = productos.map(p => {
    const ventasDetalle = p.ventasDetalle || [];
    // Velocidad de venta: unidades vendidas / días de historial
    const totalUdsVendidas = ventasDetalle.reduce((s, v) => s + (v.cantidad || 1), 0);
    const diasHistorial = 90; // ventana asumida de 90 días
    const ventasDiarias = totalUdsVendidas / diasHistorial;
    const ventasMensuales = ventasDiarias * 30;

    const diasStock = ventasDiarias > 0 ? p.totalUnidades / ventasDiarias : Infinity;
    const diasHorizonte = periodos * 30;
    const unidadesVendibles = Math.min(
      Math.round(ventasDiarias * diasHorizonte),
      p.totalUnidades
    );
    const precioPromedio = p.precioVentaProm || p.pricing?.precioActual || 0;

    return {
      productoId: p.productoId,
      nombre: p.productoNombre,
      sku: p.productoSKU,
      ventasDiarias,
      ventasMensuales,
      unidadesProyectadas: unidadesVendibles,
      ingresosProyectados: unidadesVendibles * precioPromedio,
      precioPromedio,
      pctML, pctDirecto,
      limitadoPorStock: diasStock < diasHorizonte,
      diasHastaStockout: Number.isFinite(diasStock) ? Math.round(diasStock) : 9999,
    };
  });

  const totalUnidades = productosVenta.reduce((s, p) => s + p.unidadesProyectadas, 0);
  const totalMontoPEN = productosVenta.reduce((s, p) => s + p.ingresosProyectados, 0);
  const ventasMesAnterior = hist.length > 0
    ? (hist[hist.length - 1]?.ventasCount || 0) * (hist[hist.length - 1]?.precioVentaProm || 0)
    : 0;

  return {
    totalUnidades,
    totalMontoPEN,
    ticketPromedio: totalUnidades > 0 ? totalMontoPEN / totalUnidades : 0,
    ventasPorMesEstimadas: totalMontoPEN / periodos,
    montoML: totalMontoPEN * pctML,
    montoDirecto: totalMontoPEN * pctDirecto,
    productos: productosVenta,
    ventasMesAnterior,
    crecimientoPct: ventasMesAnterior > 0
      ? ((totalMontoPEN / periodos - ventasMesAnterior) / ventasMesAnterior) * 100
      : 0,
  };
}

/**
 * Inventario al horizonte · CONSUME el Motor de Reorden (canon no-redundancia).
 * Con dato del motor: reorden manda (diasParaQuiebre/cantidadSugerida/urgencia).
 * Sin dato del motor (sin señal real): solo se estima cobertura para display,
 * SIN sugerir recompra (el gate de señal es del motor, no se re-implementa).
 */
function calcularInventario(
  productos: CTRUProductoDetalle[],
  ventas: ProyeccionVentas,
  reorden: ReordenInsumo[]
): ProyeccionInventario {
  const reordenMap = new Map(reorden.map(r => [r.productoId, r]));

  const productosInv: InventarioProyectadoProducto[] = productos.map(p => {
    const r = reordenMap.get(p.productoId);
    if (r) {
      const estado: InventarioProyectadoProducto['estado'] =
        r.urgencia === 'critica' ? 'critico' : 'atencion';
      return {
        productoId: p.productoId,
        nombre: p.productoNombre,
        sku: p.productoSKU,
        disponibles: r.stockNeto ?? p.totalUnidades,
        diasStock: Math.round(r.diasParaQuiebre),
        necesitaRecompra: true,
        cantidadSugerida: r.cantidadSugerida,
        urgencia: r.urgencia,
        puntoReorden: r.puntoReorden,
        costoRecompraPEN: r.cantidadSugerida * (p.ctruContableProm || 0),
        estado,
        fuente: 'motor',
      };
    }

    // Sin señal del motor: cobertura estimada solo para display
    const ventaProd = ventas.productos.find(v => v.productoId === p.productoId);
    const ventasDiarias = ventaProd?.ventasDiarias || 0;
    const diasStock = ventasDiarias > 0 ? p.totalUnidades / ventasDiarias : Infinity;
    return {
      productoId: p.productoId,
      nombre: p.productoNombre,
      sku: p.productoSKU,
      disponibles: p.totalUnidades,
      diasStock: Number.isFinite(diasStock) ? Math.round(diasStock) : 9999,
      necesitaRecompra: false,
      cantidadSugerida: 0,
      costoRecompraPEN: 0,
      estado: 'ok',
      fuente: 'estimado',
    };
  });

  return {
    totalDisponibles: productosInv.reduce((s, p) => s + p.disponibles, 0),
    valorInventarioPEN: productos.reduce((s, p) => s + p.totalUnidades * (p.ctruContableProm || 0), 0),
    productosEnRiesgo: productosInv.filter(p => p.estado !== 'ok').length,
    costoTotalRecompraPEN: productosInv.reduce((s, p) => s + p.costoRecompraPEN, 0),
    productos: productosInv,
    desdeMotorReorden: reorden.length > 0,
  };
}

/** Costos proyectados · 3 cajas (Producto=CTRU · Venta · Período) */
function calcularCostos(
  productos: CTRUProductoDetalle[],
  ventas: ProyeccionVentas,
  inventario: ProyeccionInventario,
  gastos: HistorialGastosEntry[],
  periodos: number,
  tcActual: number
): ProyeccionCostos {
  // Caja 1 · Producto: CTRU × unidades proyectadas
  let costoVentas = 0;
  ventas.productos.forEach(vp => {
    const prod = productos.find(p => p.productoId === vp.productoId);
    if (prod) {
      costoVentas += vp.unidadesProyectadas * prod.ctruContableProm;
    }
  });

  // Cajas 2 y 3: promedio móvil (3m) del historial de gastos por caja
  const ventaHist = gastos.map(g => (g.ventaGeneral || 0) + (g.ventaDistribucion || 0));
  const periodoHist = gastos.map(g => (g.periodoAdministrativo || 0) + (g.periodoOperativo || 0));

  const gastoVentaProyectado = promMovil(ventaHist) * periodos;
  const gastoPeriodoProyectado = promMovil(periodoHist) * periodos;
  const totalGastosProyectado = gastoVentaProyectado + gastoPeriodoProyectado;

  // Tendencia CTRU
  const ctruHist = productos.filter(p => p.ctruContableProm > 0).map(p => p.ctruContableProm);
  const ctruProm = ctruHist.length > 0 ? ctruHist.reduce((s, v) => s + v, 0) / ctruHist.length : 0;

  // Impacto TC +5%
  const costoUSD = productos.reduce((s, p) => s + p.costoCompraUSDProm * p.totalUnidades, 0);
  const impactoTC5 = costoUSD * 0.05 * tcActual;

  return {
    costoVentasTotal: costoVentas,
    gastoVentaProyectado,
    gastoPeriodoProyectado,
    totalGastosProyectado,
    costoRecompras: inventario.costoTotalRecompraPEN,
    costoTotal: costoVentas + totalGastosProyectado,
    ctruPromedioProyectado: ctruProm,
    tendenciaCTRU: tendencia(ctruHist) * 100,
    impactoTC5Pct: impactoTC5,
  };
}

/** P&L proyectado · 3 cajas (bruta → contribución → operativa) */
function calcularMargen(
  ventas: ProyeccionVentas,
  costos: ProyeccionCostos,
  productos: CTRUProductoDetalle[]
): ProyeccionMargen {
  const ingresos = ventas.totalMontoPEN;
  const utilidadBruta = ingresos - costos.costoVentasTotal;
  const utilidadContribucion = utilidadBruta - costos.gastoVentaProyectado;
  const utilidadOperativa = utilidadContribucion - costos.gastoPeriodoProyectado;

  const pct = (v: number) => (ingresos > 0 ? (v / ingresos) * 100 : 0);

  // Margen por producto con SU CTRU específico (no el promedio global · fix 2026-07-01)
  const ctruDeProducto = (productoId: string) =>
    productos.find(pr => pr.productoId === productoId)?.ctruContableProm || 0;
  const margenProducto = (p: VentaProyectadaProducto) =>
    p.precioPromedio > 0
      ? ((p.ingresosProyectados - p.unidadesProyectadas * ctruDeProducto(p.productoId)) / p.ingresosProyectados) * 100
      : 0;

  const productosNeg = ventas.productos.filter(p => margenProducto(p) < 0).length;
  const productosBajo = ventas.productos.filter(p => {
    const margen = margenProducto(p);
    return margen >= 0 && margen < 15;
  }).length;

  // Break-even: unidades para cubrir los gastos (Caja 2 + Caja 3).
  // CTRU unitario PONDERADO por las unidades proyectadas (costoVentas/unidades),
  // no el promedio simple del catálogo — un producto caro sin ventas proyectadas
  // sesgaría el ticket neto a negativo y rompería el break-even.
  const ctruUnitarioProyectado = ventas.totalUnidades > 0
    ? costos.costoVentasTotal / ventas.totalUnidades
    : 0;
  const ticketNeto = ventas.ticketPromedio - ctruUnitarioProyectado;
  const breakEven = ticketNeto > 0 ? Math.ceil(costos.totalGastosProyectado / ticketNeto) : Infinity;

  return {
    ingresosBrutos: ingresos,
    costoVentas: costos.costoVentasTotal,
    utilidadBruta,
    margenBruto: pct(utilidadBruta),
    gastoVenta: costos.gastoVentaProyectado,
    utilidadContribucion,
    margenContribucion: pct(utilidadContribucion),
    gastoPeriodo: costos.gastoPeriodoProyectado,
    utilidadOperativa,
    margenOperativo: pct(utilidadOperativa),
    productosMargenNegativo: productosNeg,
    productosMargenBajo: productosBajo,
    unidadesBreakEven: breakEven === Infinity ? 0 : breakEven,
  };
}

function calcularEscenarios(
  ventas: ProyeccionVentas,
  costos: ProyeccionCostos
): Escenario360[] {
  // costoCompraVar = variación del precio de COMPRA (proveedor) · junto con el
  // TC afecta el CTRU (Caja 1). NO es el precio de venta (ese va en ventasVar).
  const configs = [
    { nombre: 'optimista' as const, prob: 0.2, tcVar: -5, costoCompraVar: -3, gastosVar: -5, ventasVar: 10 },
    { nombre: 'base' as const, prob: 0.6, tcVar: 0, costoCompraVar: 0, gastosVar: 0, ventasVar: 0 },
    { nombre: 'pesimista' as const, prob: 0.2, tcVar: 10, costoCompraVar: 5, gastosVar: 10, ventasVar: -15 },
  ];

  return configs.map(c => {
    const ingresos = ventas.totalMontoPEN * (1 + c.ventasVar / 100);
    const costosAdj = costos.costoVentasTotal * (1 + c.tcVar / 100) * (1 + c.costoCompraVar / 100);
    const gastosAdj = costos.totalGastosProyectado * (1 + c.gastosVar / 100);
    const utilidad = ingresos - costosAdj - gastosAdj;
    return {
      nombre: c.nombre,
      probabilidad: c.prob,
      supuestos: { tcVar: c.tcVar, costoCompraVar: c.costoCompraVar, gastosVar: c.gastosVar, ventasVar: c.ventasVar },
      ingresos,
      costos: costosAdj + gastosAdj,
      utilidad,
      margen: ingresos > 0 ? (utilidad / ingresos) * 100 : 0,
    };
  });
}

function construirTimeline(
  hist: HistorialCostosMes[],
  ventas: ProyeccionVentas,
  costos: ProyeccionCostos,
  periodos: number
): TimelinePoint[] {
  const data: TimelinePoint[] = [];

  // Meses reales
  hist.forEach(h => {
    const ingresos = h.ventasCount * (h.precioVentaProm || 0);
    const costosM = h.ventasCount * h.ctruContableProm;
    data.push({
      label: h.label,
      tipo: 'real',
      ingresos: Math.round(ingresos),
      costos: Math.round(costosM),
      utilidad: Math.round(ingresos - costosM),
      margen: ingresos > 0 ? Math.round(((ingresos - costosM) / ingresos) * 100 * 10) / 10 : null,
    });
  });

  // Meses proyectados
  const ingresosMes = ventas.totalMontoPEN / periodos;
  const costosMes = costos.costoTotal / periodos;
  const utilidadMes = ingresosMes - costosMes;

  for (let i = 1; i <= periodos; i++) {
    const incertidumbre = 0.05 * i;
    data.push({
      label: mesLabel(i),
      tipo: 'proyectado',
      ingresos: Math.round(ingresosMes),
      costos: Math.round(costosMes),
      utilidad: Math.round(utilidadMes),
      margen: ingresosMes > 0 ? Math.round((utilidadMes / ingresosMes) * 100 * 10) / 10 : null,
      bandaSup: Math.round(utilidadMes * (1 + incertidumbre)),
      bandaInf: Math.round(utilidadMes * (1 - incertidumbre)),
    });
  }

  return data;
}

function consolidarAlertas(
  ventas: ProyeccionVentas,
  inventario: ProyeccionInventario,
  margen: ProyeccionMargen
): Alerta360[] {
  const alertas: Alerta360[] = [];

  // Inventario (dato del Motor de Reorden)
  inventario.productos.filter(p => p.estado === 'critico').forEach(p => {
    alertas.push({
      seccion: 'inventario', severidad: 'danger',
      mensaje: `${p.nombre}: stock para ${p.diasStock} días`,
      productoNombre: p.nombre,
      accion: `Comprar ${p.cantidadSugerida} unidades (motor de reorden)`,
    });
  });

  // Ventas limitadas por stock
  ventas.productos.filter(p => p.limitadoPorStock).forEach(p => {
    alertas.push({
      seccion: 'ventas', severidad: 'warning',
      mensaje: `${p.nombre}: ventas limitadas por stock (${p.diasHastaStockout}d)`,
      productoNombre: p.nombre,
      accion: 'Reabastecer para no perder ventas',
    });
  });

  // Margen operativo proyectado
  if (margen.margenOperativo < 10) {
    alertas.push({
      seccion: 'margen', severidad: margen.margenOperativo < 0 ? 'danger' : 'warning',
      mensaje: `Margen operativo proyectado: ${margen.margenOperativo.toFixed(1)}%`,
      accion: margen.margenOperativo < 0 ? 'Revisar precios y costos urgentemente' : 'Considerar ajuste de precios',
    });
  }

  return alertas.sort((a, b) => {
    const sev: Record<string, number> = { danger: 0, warning: 1, info: 2 };
    return (sev[a.severidad] ?? 3) - (sev[b.severidad] ?? 3);
  });
}
