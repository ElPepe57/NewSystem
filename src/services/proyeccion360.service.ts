/**
 * proyeccion360.service.ts
 *
 * Motor de Proyección 360 del Negocio.
 * Calcula TODO en memoria usando datos del ctruStore — sin queries a Firestore.
 *
 * Cadena: Inventario → Ventas → Costos → Margen → Flujo de Caja
 */

import type {
  Horizonte360, Proyeccion360, ProyeccionVentas, ProyeccionInventario,
  ProyeccionCostos, ProyeccionMargen, ProyeccionFlujoCaja, FlujoCajaSemana,
  Escenario360, TimelinePoint, Alerta360, VentaProyectadaProducto,
  InventarioProyectadoProducto
} from '../types/proyeccion360.types';
import type { CTRUProductoDetalle, HistorialCostosMes, HistorialGastosEntry } from '../store/ctruStore';

// ============================================
// HELPERS
// ============================================

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

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
  horizonte: Horizonte360
): Proyeccion360 {

  const periodos = horizonte === 30 ? 1 : 3;
  const hist = (historialMensual || []).slice(-6);
  const gastos = (historialGastos || []).slice(-6);

  // ─── PASO 1: VENTAS PROYECTADAS ───
  const ventas = calcularVentas(productos, hist, periodos);

  // ─── PASO 2: INVENTARIO PROYECTADO (usa ventas) ───
  const inventario = calcularInventario(productos, ventas, periodos);

  // ─── PASO 3: COSTOS PROYECTADOS (usa ventas + inventario) ───
  const costos = calcularCostos(productos, ventas, inventario, gastos, periodos);

  // ─── PASO 4: MARGEN (derivado de ventas + costos) ───
  const margen = calcularMargen(ventas, costos);

  // ─── PASO 5: FLUJO DE CAJA (usa todo) ───
  const flujoCaja = calcularFlujoCaja(ventas, costos, inventario, periodos);

  // ─── PASO 6: ESCENARIOS ───
  const escenarios = calcularEscenarios(ventas, costos, margen);

  // ─── PASO 7: TIMELINE ───
  const timeline = construirTimeline(hist, ventas, costos, margen, periodos);

  // ─── PASO 8: ALERTAS ───
  const alertas = consolidarAlertas(ventas, inventario, costos, margen, flujoCaja);

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
    utilidadProyectada: margen.utilidadNeta,
    margenNetoProyectado: margen.margenNeto,
    flujoCajaNeto: flujoCaja.saldoFinal,
    ventas, inventario, costos, margen, flujoCaja,
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
  const ventasHist = hist.map(h => h.ventasCount);
  const montoHist = hist.map(h => h.ventasCount * (h.precioVentaProm || 0));
  const trendVentas = tendencia(ventasHist);

  // Mix de canal: estimado desde las ventas de cada producto
  let totalML = 0, totalDirecto = 0;
  productos.forEach(p => {
    const ventas = p.ventasDetalle || [];
    ventas.forEach(v => {
      const monto = (v.cantidad || 1) * (v.precioUnitario || 0);
      // Heurística: si hay canal, usar; si no, asumir 50/50
      totalDirecto += monto * 0.6; // ajustar cuando haya campo canal
      totalML += monto * 0.4;
    });
  });
  const totalMix = totalML + totalDirecto || 1;
  const pctML = totalML / totalMix;
  const pctDirecto = totalDirecto / totalMix;

  const productosVenta: VentaProyectadaProducto[] = productos.map(p => {
    const ventasDetalle = p.ventasDetalle || [];
    // Velocidad de venta: unidades vendidas / días de historial
    const totalUdsVendidas = ventasDetalle.reduce((s, v) => s + (v.cantidad || 1), 0);
    const diasHistorial = 90; // asumir 90 días de ventana
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
      diasHastaStockout: Math.round(diasStock),
    };
  });

  const totalUnidades = productosVenta.reduce((s, p) => s + p.unidadesProyectadas, 0);
  const totalMontoPEN = productosVenta.reduce((s, p) => s + p.ingresosProyectados, 0);
  const ventasMesAnterior = hist.length > 0 ? (hist[hist.length - 1]?.ventasCount || 0) * (hist[hist.length - 1]?.precioVentaProm || 0) : 0;

  return {
    totalUnidades,
    totalMontoPEN,
    ticketPromedio: totalUnidades > 0 ? totalMontoPEN / totalUnidades : 0,
    ventasPorMesEstimadas: totalMontoPEN / periodos,
    montoML: totalMontoPEN * pctML,
    montoDirecto: totalMontoPEN * pctDirecto,
    productos: productosVenta,
    ventasMesAnterior,
    crecimientoPct: ventasMesAnterior > 0 ? ((totalMontoPEN / periodos - ventasMesAnterior) / ventasMesAnterior) * 100 : 0,
  };
}

function calcularInventario(
  productos: CTRUProductoDetalle[],
  ventas: ProyeccionVentas,
  periodos: number
): ProyeccionInventario {
  const productosInv: InventarioProyectadoProducto[] = productos.map(p => {
    const ventaProd = ventas.productos.find(v => v.productoId === p.productoId);
    const ventasDiarias = ventaProd?.ventasDiarias || 0;
    const diasStock = ventasDiarias > 0 ? p.totalUnidades / ventasDiarias : Infinity;
    const leadTime = 30; // conservador para importación

    const fechaStockout = new Date();
    fechaStockout.setDate(fechaStockout.getDate() + Math.min(diasStock, 999));
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + Math.max(diasStock - leadTime, 0));

    const necesitaRecompra = diasStock < (periodos * 30 + leadTime);
    const cantidadSugerida = necesitaRecompra ? Math.ceil(ventasDiarias * 60) : 0;
    const costoRecompra = cantidadSugerida * (p.costoCompraUSDProm || 0) *
      ((p.lotes || []).find(l => l.tc > 0)?.tc || 3.75);

    // Riesgo vencimiento: simplificado
    const unidadesEnRiesgo = 0; // requiere fecha vencimiento por unidad

    let estado: InventarioProyectadoProducto['estado'] = 'ok';
    if (diasStock < 15) estado = 'critico';
    else if (diasStock < 45) estado = 'atencion';

    return {
      productoId: p.productoId,
      nombre: p.productoNombre,
      sku: p.productoSKU,
      disponibles: p.totalUnidades,
      enTransito: 0, // TODO: cruzar con transferencias activas
      diasStock: Math.round(diasStock),
      fechaStockout,
      fechaLimiteCompra: fechaLimite,
      leadTimeDias: leadTime,
      necesitaRecompra,
      cantidadSugerida,
      costoRecompraPEN: costoRecompra,
      unidadesEnRiesgo,
      fechaVencProxima: null,
      estado,
    };
  });

  return {
    totalDisponibles: productosInv.reduce((s, p) => s + p.disponibles, 0),
    totalEnTransito: productosInv.reduce((s, p) => s + p.enTransito, 0),
    valorInventarioPEN: productos.reduce((s, p) => s + p.totalUnidades * p.ctruPromedio, 0),
    productosEnRiesgo: productosInv.filter(p => p.estado !== 'ok').length,
    costoTotalRecompraPEN: productosInv.reduce((s, p) => s + p.costoRecompraPEN, 0),
    productos: productosInv,
  };
}

function calcularCostos(
  productos: CTRUProductoDetalle[],
  ventas: ProyeccionVentas,
  inventario: ProyeccionInventario,
  gastos: HistorialGastosEntry[],
  periodos: number
): ProyeccionCostos {
  // Costo de ventas = CTRU × unidades vendidas
  let costoVentas = 0;
  ventas.productos.forEach(vp => {
    const prod = productos.find(p => p.productoId === vp.productoId);
    if (prod) {
      costoVentas += vp.unidadesProyectadas * prod.ctruPromedio;
    }
  });

  // GA/GO/GV/GD proyectados
  const gaHist = gastos.map(g => g.GA || 0);
  const goHist = gastos.map(g => g.GO || 0);
  const gvHist = gastos.map(g => g.GV || 0);
  const gdHist = gastos.map(g => g.GD || 0);

  const gaProyMes = promMovil(gaHist);
  const goProyMes = promMovil(goHist);
  const gvgdProyMes = promMovil(gvHist) + promMovil(gdHist);

  const gaProyectado = gaProyMes * periodos;
  const goProyectado = goProyMes * periodos;
  const gvgdProyectado = gvgdProyMes * periodos;

  // Tendencia CTRU
  const ctruHist = productos.filter(p => p.ctruPromedio > 0).map(p => p.ctruPromedio);
  const ctruProm = ctruHist.length > 0 ? ctruHist.reduce((s, v) => s + v, 0) / ctruHist.length : 0;

  // Impacto TC +5%
  const costoUSD = productos.reduce((s, p) => s + p.costoCompraUSDProm * p.totalUnidades, 0);
  const impactoTC5 = costoUSD * 0.05 * (productos[0]?.lotes?.[0]?.tc || 3.75);

  return {
    costoVentasTotal: costoVentas,
    gaProyectado,
    goProyectado,
    gvgdProyectado,
    costoRecompras: inventario.costoTotalRecompraPEN,
    costoOperativoTotal: gaProyectado + goProyectado + gvgdProyectado,
    costoTotal: costoVentas + gaProyectado + goProyectado + gvgdProyectado,
    ctruPromedioProyectado: ctruProm,
    tendenciaCTRU: tendencia(ctruHist) * 100,
    impactoTC5Pct: impactoTC5,
  };
}

function calcularMargen(ventas: ProyeccionVentas, costos: ProyeccionCostos): ProyeccionMargen {
  const ingresos = ventas.totalMontoPEN;
  const utilBruta = ingresos - costos.costoVentasTotal;
  const utilNeta = utilBruta - costos.costoOperativoTotal;

  const productosNeg = ventas.productos.filter(p => {
    const margen = p.precioPromedio > 0 ? ((p.ingresosProyectados - p.unidadesProyectadas * (costos.ctruPromedioProyectado || 0)) / p.ingresosProyectados) * 100 : 0;
    return margen < 0;
  }).length;

  const productosBajo = ventas.productos.filter(p => {
    const margen = p.precioPromedio > 0 ? ((p.ingresosProyectados - p.unidadesProyectadas * (costos.ctruPromedioProyectado || 0)) / p.ingresosProyectados) * 100 : 0;
    return margen >= 0 && margen < 15;
  }).length;

  // Break-even: cuántas unidades para cubrir gastos fijos
  const ticketNeto = ventas.ticketPromedio - costos.ctruPromedioProyectado;
  const breakEven = ticketNeto > 0 ? Math.ceil(costos.costoOperativoTotal / ticketNeto) : Infinity;

  return {
    ingresosBrutos: ingresos,
    costoVentas: costos.costoVentasTotal,
    utilidadBruta: utilBruta,
    margenBruto: ingresos > 0 ? (utilBruta / ingresos) * 100 : 0,
    gastosOperativos: costos.costoOperativoTotal,
    utilidadNeta: utilNeta,
    margenNeto: ingresos > 0 ? (utilNeta / ingresos) * 100 : 0,
    productosMargenNegativo: productosNeg,
    productosMargenBajo: productosBajo,
    unidadesBreakEven: breakEven === Infinity ? 0 : breakEven,
  };
}

function calcularFlujoCaja(
  ventas: ProyeccionVentas,
  costos: ProyeccionCostos,
  inventario: ProyeccionInventario,
  periodos: number
): ProyeccionFlujoCaja {
  const numSemanas = periodos === 1 ? 4 : 12;
  const ingresoSemanal = ventas.totalMontoPEN / numSemanas;
  const tasaCobro = 0.85; // 85% se cobra a tiempo
  const egresoGastosSemanal = costos.costoOperativoTotal / numSemanas;

  // Distribuir recompras en las semanas donde se necesitan
  const recompraPorSemana = inventario.costoTotalRecompraPEN / Math.max(periodos, 1);

  const semanas: FlujoCajaSemana[] = [];
  let saldo = 0; // empezar en 0 (relativo)

  for (let i = 1; i <= numSemanas; i++) {
    const cobrosVentas = ingresoSemanal * tasaCobro;
    const cobrosCartera = i <= 2 ? ingresoSemanal * (1 - tasaCobro) * 0.5 : 0;
    const totalCobros = cobrosVentas + cobrosCartera;

    const egresosRecompras = (i % 4 === 0) ? recompraPorSemana : 0; // recompra mensual
    const totalEgresos = egresoGastosSemanal + egresosRecompras;

    const flujoNeto = totalCobros - totalEgresos;
    saldo += flujoNeto;

    const fecha = new Date();
    fecha.setDate(fecha.getDate() + (i - 1) * 7);

    semanas.push({
      semana: i,
      label: `Sem ${i}`,
      cobrosVentas, cobrosCartera, totalCobros,
      egresosGastos: egresoGastosSemanal,
      egresosRecompras,
      totalEgresos,
      flujoNeto,
      saldoAcumulado: Math.round(saldo),
      critico: saldo < 0,
    });
  }

  const saldoFinal = semanas[semanas.length - 1]?.saldoAcumulado || 0;
  const minSaldo = Math.min(...semanas.map(s => s.saldoAcumulado));

  return {
    saldoInicial: 0,
    totalCobros: semanas.reduce((s, w) => s + w.totalCobros, 0),
    totalEgresos: semanas.reduce((s, w) => s + w.totalEgresos, 0),
    saldoFinal,
    necesitaFinanciamiento: minSaldo < 0,
    montoFinanciamiento: minSaldo < 0 ? Math.abs(minSaldo) : 0,
    semanas,
  };
}

function calcularEscenarios(
  ventas: ProyeccionVentas,
  costos: ProyeccionCostos,
  margen: ProyeccionMargen
): Escenario360[] {
  const configs = [
    { nombre: 'optimista' as const, prob: 0.2, tcVar: -5, precioVar: -3, gagoVar: -5, ventasVar: 10 },
    { nombre: 'base' as const, prob: 0.6, tcVar: 0, precioVar: 0, gagoVar: 0, ventasVar: 0 },
    { nombre: 'pesimista' as const, prob: 0.2, tcVar: 10, precioVar: 5, gagoVar: 10, ventasVar: -15 },
  ];

  return configs.map(c => {
    const ingresos = ventas.totalMontoPEN * (1 + c.ventasVar / 100);
    const costosAdj = costos.costoVentasTotal * (1 + c.tcVar / 100) * (1 + c.precioVar / 100);
    const gastosAdj = costos.costoOperativoTotal * (1 + c.gagoVar / 100);
    const utilidad = ingresos - costosAdj - gastosAdj;
    return {
      nombre: c.nombre,
      probabilidad: c.prob,
      supuestos: { tcVar: c.tcVar, precioVar: c.precioVar, gagoVar: c.gagoVar, ventasVar: c.ventasVar },
      ingresos,
      costos: costosAdj + gastosAdj,
      utilidad,
      margen: ingresos > 0 ? (utilidad / ingresos) * 100 : 0,
      flujoCaja: utilidad * 0.85, // ajuste por timing de cobro
    };
  });
}

function construirTimeline(
  hist: HistorialCostosMes[],
  ventas: ProyeccionVentas,
  costos: ProyeccionCostos,
  margen: ProyeccionMargen,
  periodos: number
): TimelinePoint[] {
  const data: TimelinePoint[] = [];

  // Meses reales
  hist.forEach(h => {
    const ingresos = h.ventasCount * (h.precioVentaProm || 0);
    const costosM = h.ventasCount * h.ctruPromedio;
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
      margen: ingresosMes > 0 ? Math.round(((utilidadMes) / ingresosMes) * 100 * 10) / 10 : null,
      bandaSup: Math.round(utilidadMes * (1 + incertidumbre)),
      bandaInf: Math.round(utilidadMes * (1 - incertidumbre)),
    });
  }

  return data;
}

function consolidarAlertas(
  ventas: ProyeccionVentas,
  inventario: ProyeccionInventario,
  costos: ProyeccionCostos,
  margen: ProyeccionMargen,
  flujoCaja: ProyeccionFlujoCaja
): Alerta360[] {
  const alertas: Alerta360[] = [];

  // Inventario
  inventario.productos.filter(p => p.estado === 'critico').forEach(p => {
    alertas.push({
      seccion: 'inventario', severidad: 'danger',
      mensaje: `${p.nombre}: stock para ${p.diasStock} días`,
      productoNombre: p.nombre,
      accion: `Comprar ${p.cantidadSugerida} unidades antes del ${p.fechaLimiteCompra.toLocaleDateString('es-PE')}`,
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

  // Margen
  if (margen.margenNeto < 10) {
    alertas.push({
      seccion: 'margen', severidad: margen.margenNeto < 0 ? 'danger' : 'warning',
      mensaje: `Margen neto proyectado: ${margen.margenNeto.toFixed(1)}%`,
      accion: margen.margenNeto < 0 ? 'Revisar precios y costos urgentemente' : 'Considerar ajuste de precios',
    });
  }

  // Flujo de caja
  if (flujoCaja.necesitaFinanciamiento) {
    alertas.push({
      seccion: 'caja', severidad: 'danger',
      mensaje: `Déficit de caja proyectado: ${formatC(flujoCaja.montoFinanciamiento)}`,
      accion: 'Necesita inyección de capital o postergar recompras',
    });
  }

  return alertas.sort((a, b) => {
    const sev = { danger: 0, warning: 1, info: 2 };
    return sev[a.severidad] - sev[b.severidad];
  });
}

function formatC(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
