/**
 * analisisHelpers — chk5.D-S3.quinto · SF1
 *
 * Helpers puros para la sub-vista Análisis estratégico (`/finanzas/analisis`)
 * canon MOCK 4. Centraliza cálculos de los 10 indicadores:
 *
 *   TIER 1 · Ejecutivas:
 *     G10 · Pulso financiero · 4 gauges (Liquidez · Rentabilidad · Solvencia · Eficiencia)
 *     G1.a · Waterfall margen (Ingreso → COGS → MB → Opex → EBITDA)
 *     G3  · Burn rate + Runway
 *     G2  · Working Capital Cycle (DSO + DIO − DPO = CCC)
 *     G7  · EBITDA Bridge MoM (variación con drivers)
 *
 *   TIER 2 · Operativas:
 *     Calendario obligaciones · heatmap mensual
 *     G9 · Sankey flujo dinero · cuentas → categorías
 *     G5 · Cohort cobro DSO · heatmap
 *
 *   TIER 3 · Tácticas:
 *     G4 · ROI por línea/canal · scatter quadrant
 *     G6 · Cash flow escenarios (reusa S3.quater)
 *
 * Sin Firestore · sin React · testeable aisladamente.
 *
 * NOTA · todas las DEUDAS-* del mockup MOCK 4 §11 quedan declaradas en
 * `DEUDA-CROSS-LINKS-S2.md` para cierre en chk5.D-S4.
 */

import type { CuentaCaja, MovimientoTesoreria } from '../../../../types/tesoreria.types';
import type { CuentaCorriente, SaldosResumen } from '../../../../types/cuentaCorriente.types';
import type { TarjetaCredito } from '../../../../types/tarjetaCredito.types';
import { TIPOS_INGRESO, TIPOS_EGRESO } from '../../../../services/tesoreria.shared';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO
// ═════════════════════════════════════════════════════════════════════════

export type Semaforo = 'saludable' | 'atencion' | 'critico' | 'solido';

export interface Gauge {
  /** Valor 0-100 % del arco */
  valor: number;
  /** Estado semáforo según el valor */
  estado: Semaforo;
  /** Label corto · ej "Liquidez" */
  label: string;
  /** Subtítulo · ej "Caja / CxP < 30d" */
  subtitulo: string;
  /** Color final del gauge (emerald · amber · rose) */
  color: 'emerald' | 'amber' | 'rose';
}

export interface PulsoFinanciero {
  liquidez: Gauge;
  rentabilidad: Gauge;
  solvencia: Gauge;
  eficiencia: Gauge;
  /** Alerta principal a mostrar bajo los gauges (si hay) */
  alerta?: {
    severidad: 'rose' | 'amber';
    titulo: string;
    descripcion: string;
  };
}

export interface WaterfallMargen {
  ingreso: number;
  cogs: number;
  margenBruto: number;
  opex: number;
  ebitda: number;
  /** Porcentajes vs ingreso · usados en altura de barras */
  cogsPct: number;
  margenBrutoPct: number;
  opexPct: number;
  ebitdaPct: number;
}

export interface BurnRunway {
  burnRateMensual: number;
  cajaActual: number;
  /** Meses restantes · Infinity si burnRate=0 */
  runwayMeses: number;
  /** Puntos para curva descendente (mes 0 a mes 12) */
  puntos: Array<{ mes: number; saldoProyectado: number }>;
  /** Fecha estimada zona alerta (3-6m) */
  zonaAlertaFecha?: Date;
  /** Fecha estimada zona crítica (<3m) */
  zonaCriticaFecha?: Date;
}

export interface WorkingCapitalCycle {
  dso: number; // Days Sales Outstanding
  dio: number; // Days Inventory Outstanding
  dpo: number; // Days Payable Outstanding
  ccc: number; // Cash Conversion Cycle = DSO + DIO - DPO
  /** Benchmark del sector (rango referencial) */
  benchmarkMin: number;
  benchmarkMax: number;
  /** True si CCC dentro del rango benchmark */
  dentroRango: boolean;
}

export interface EbitdaBridge {
  ebitdaMesAnterior: number;
  ebitdaMesActual: number;
  variacion: number;
  variacionPct: number;
  drivers: Array<{
    label: string;
    monto: number;
    color: 'emerald' | 'rose';
  }>;
  /** Narrativa generada · explica el cambio */
  narrativa: string;
}

export interface CalendarioEvento {
  fecha: Date;
  tipo: 'vencido' | 'tc' | 'oc' | 'sueldo' | 'gasto' | 'recaudador';
  label: string;
  monto: number;
}

export interface CalendarioMes {
  anio: number;
  mes: number; // 0-11
  eventos: CalendarioEvento[];
  totalComprometido: number;
  vencimientosCriticos: number;
}

export interface SankeyNode {
  id: string;
  label: string;
  /** Lado · 'origen' (cuentas) o 'destino' (categorías) */
  lado: 'origen' | 'destino';
  /** Volumen total que pasa por el nodo · para ancho de la barra */
  volumen: number;
  /** Color hex */
  color: string;
}

export interface SankeyFlow {
  desde: string; // id nodo origen
  hacia: string; // id nodo destino
  volumen: number;
  /** Color hex del path · derivado del origen */
  color: string;
}

export interface CohortDSORow {
  cohort: string; // ej "Ene-26"
  /** % cobrado al mes M1, M2, ..., M6 · undefined si aún no llegamos */
  m1?: number;
  m2?: number;
  m3?: number;
  m4?: number;
  m5?: number;
  m6?: number;
}

export type CuadranteROI = 'star' | 'promesa' | 'vaca' | 'perro';

export interface ROIPunto {
  id: string;
  label: string;
  /** Inversión (0-100 normalizado) */
  inversion: number;
  /** Retorno (0-100 normalizado) */
  retorno: number;
  /** Radio del círculo · normalizado por volumen */
  radio: number;
  /** Color del círculo · derivado del cuadrante */
  color: 'emerald' | 'amber' | 'rose';
  cuadrante: CuadranteROI;
}

export interface CashFlowEscenarios {
  /** Variación esperada base + 30/60/90d · ya entregada por S3.quater · placeholder */
  base30d: number;
  base60d: number;
  base90d: number;
  optimista90d: number;
  pesimista90d: number;
}

// ═════════════════════════════════════════════════════════════════════════
// G10 · PULSO FINANCIERO (4 gauges)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Liquidez · Caja / CxP < 30d
 * Score: si caja cubre 100% de CxP 30d → 100% · 50% cobertura → 50% · etc
 */
function calcularLiquidez(cajaActual: number, cxpProximos30d: number): Gauge {
  let valor: number;
  if (cxpProximos30d < 0.01) {
    // Sin CxP próximas · liquidez es 100% (mejor caso)
    valor = 100;
  } else {
    const cobertura = (cajaActual / cxpProximos30d) * 100;
    valor = Math.min(100, Math.max(0, cobertura));
  }
  return {
    valor,
    estado: clasificarSemaforo(valor, { critico: 30, atencion: 60 }),
    label: 'Liquidez',
    subtitulo: 'Caja / CxP < 30d',
    color: colorPorSemaforo(clasificarSemaforo(valor, { critico: 30, atencion: 60 })),
  };
}

/**
 * Rentabilidad · margen EBITDA %
 * Score: 30%+ excelente (100%) · 20-30% bueno · 10-20% medio · <10% crítico
 */
function calcularRentabilidad(margenEbitdaPct: number): Gauge {
  // Normalizar margen EBITDA a 0-100 (cap 50% como máximo)
  const valor = Math.min(100, Math.max(0, margenEbitdaPct * 2));
  return {
    valor,
    estado: clasificarSemaforo(valor, { critico: 30, atencion: 60 }),
    label: 'Rentabilidad',
    subtitulo: 'Margen EBITDA',
    color: colorPorSemaforo(clasificarSemaforo(valor, { critico: 30, atencion: 60 })),
  };
}

/**
 * Solvencia · Activos / Pasivos
 * Score: >2x sólido · 1.5-2 bueno · 1-1.5 atención · <1 crítico
 */
function calcularSolvencia(activosTotal: number, pasivosTotal: number): Gauge {
  let valor: number;
  if (pasivosTotal < 0.01) {
    valor = 100; // sin pasivos
  } else {
    const ratio = activosTotal / pasivosTotal;
    // ratio 1 → 50% gauge · ratio 2 → 100% · ratio 0.5 → 25%
    valor = Math.min(100, Math.max(0, ratio * 50));
  }
  return {
    valor,
    estado: clasificarSemaforo(valor, { critico: 50, atencion: 70 }),
    label: 'Solvencia',
    subtitulo: 'Activos / Pasivos',
    color: colorPorSemaforo(clasificarSemaforo(valor, { critico: 50, atencion: 70 })),
  };
}

/**
 * Eficiencia · Cash Conversion Cycle invertido
 * CCC bajo (rápido) = eficiente · CCC alto = ineficiente
 * Score: CCC <30 = 100% · CCC 30-60 = 60% · CCC 60-90 = 30% · >90 = 0%
 */
function calcularEficiencia(ccc: number): Gauge {
  let valor: number;
  if (ccc <= 30) valor = 100;
  else if (ccc <= 60) valor = 60 - ((ccc - 30) * 30) / 30;
  else if (ccc <= 90) valor = 30 - ((ccc - 60) * 30) / 30;
  else valor = 0;
  return {
    valor: Math.max(0, valor),
    estado: clasificarSemaforo(valor, { critico: 40, atencion: 70 }),
    label: 'Eficiencia',
    subtitulo: 'Cash Conv. Cycle',
    color: colorPorSemaforo(clasificarSemaforo(valor, { critico: 40, atencion: 70 })),
  };
}

export function calcularPulsoFinanciero(opts: {
  cajaActual: number;
  cxpProximos30d: number;
  margenEbitdaPct: number;
  activosTotal: number;
  pasivosTotal: number;
  ccc: number;
}): PulsoFinanciero {
  const liquidez = calcularLiquidez(opts.cajaActual, opts.cxpProximos30d);
  const rentabilidad = calcularRentabilidad(opts.margenEbitdaPct);
  const solvencia = calcularSolvencia(opts.activosTotal, opts.pasivosTotal);
  const eficiencia = calcularEficiencia(opts.ccc);

  // Generar alerta principal · prioridad: crítico > atención
  const gauges = [liquidez, rentabilidad, solvencia, eficiencia];
  const criticos = gauges.filter((g) => g.color === 'rose');
  let alerta: PulsoFinanciero['alerta'];
  if (criticos.length > 0) {
    const principal = criticos[0];
    alerta = {
      severidad: 'rose',
      titulo: `Alerta de pulso: ${principal.label} en ${Math.round(principal.valor)}% (crítico)`,
      descripcion: alertaDescripcion(principal, opts),
    };
  } else {
    const enAtencion = gauges.filter((g) => g.color === 'amber');
    if (enAtencion.length > 0) {
      const principal = enAtencion[0];
      alerta = {
        severidad: 'amber',
        titulo: `Atención: ${principal.label} en ${Math.round(principal.valor)}%`,
        descripcion: alertaDescripcion(principal, opts),
      };
    }
  }

  return { liquidez, rentabilidad, solvencia, eficiencia, alerta };
}

function clasificarSemaforo(
  valor: number,
  umbrales: { critico: number; atencion: number },
): Semaforo {
  if (valor < umbrales.critico) return 'critico';
  if (valor < umbrales.atencion) return 'atencion';
  if (valor >= 80) return 'saludable';
  return 'solido';
}

function colorPorSemaforo(s: Semaforo): 'emerald' | 'amber' | 'rose' {
  if (s === 'critico') return 'rose';
  if (s === 'atencion') return 'amber';
  return 'emerald';
}

function alertaDescripcion(g: Gauge, opts: { ccc: number }): string {
  if (g.label === 'Eficiencia') {
    return `Cash Conversion Cycle alto · estás tardando ${opts.ccc} días en convertir cada sol vendido en caja real. Ver G2 Working Capital Cycle para drill.`;
  }
  if (g.label === 'Liquidez') {
    return 'Caja insuficiente para cubrir CxP próximas. Revisar cobranza inmediata y posponer pagos no críticos.';
  }
  if (g.label === 'Rentabilidad') {
    return 'Margen EBITDA por debajo del nivel saludable. Revisar mix de productos y estructura de costos.';
  }
  if (g.label === 'Solvencia') {
    return 'Ratio activos/pasivos en zona de atención. Revisar exposición de deuda.';
  }
  return '';
}

// ═════════════════════════════════════════════════════════════════════════
// G1.a · WATERFALL MARGEN
// ═════════════════════════════════════════════════════════════════════════

/**
 * Calcula waterfall de margen · sin impuestos (canon D8 + DEUDA-FISCAL-FUTURO).
 */
export function calcularWaterfallMargen(opts: {
  ingreso: number;
  cogs: number;
  opex: number;
}): WaterfallMargen {
  const { ingreso, cogs, opex } = opts;
  const margenBruto = ingreso - cogs;
  const ebitda = margenBruto - opex;
  const denominador = ingreso > 0 ? ingreso : 1;
  return {
    ingreso,
    cogs,
    margenBruto,
    opex,
    ebitda,
    cogsPct: (cogs / denominador) * 100,
    margenBrutoPct: (margenBruto / denominador) * 100,
    opexPct: (opex / denominador) * 100,
    ebitdaPct: (ebitda / denominador) * 100,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// G3 · BURN RATE + RUNWAY
// ═════════════════════════════════════════════════════════════════════════

/**
 * Burn rate mensual = promedio egresos PEN equivalente últimos 90 días / N meses.
 * Devuelve la serie de saldo proyectado mes a mes durante el runway.
 */
export function calcularBurnRunway(opts: {
  cajaActual: number;
  movimientos90d: MovimientoTesoreria[];
}): BurnRunway {
  const { cajaActual, movimientos90d } = opts;

  // Burn rate mensual
  const hoy = new Date();
  const hace90d = new Date(hoy);
  hace90d.setDate(hace90d.getDate() - 90);

  let totalEgresos = 0;
  const mesesConMov = new Set<string>();
  for (const m of movimientos90d) {
    if (m.estado === 'anulado' || !m.fecha) continue;
    const fecha = m.fecha.toDate();
    if (fecha < hace90d || fecha > hoy) continue;
    if (TIPOS_EGRESO.includes(m.tipo)) {
      totalEgresos += m.montoEquivalentePEN || 0;
      mesesConMov.add(`${fecha.getFullYear()}-${fecha.getMonth()}`);
    }
  }
  const burnRateMensual = mesesConMov.size > 0 ? totalEgresos / mesesConMov.size : 0;

  // Runway en meses
  const runwayMeses = burnRateMensual > 0 ? cajaActual / burnRateMensual : Infinity;

  // Serie de saldo proyectado por mes (12 meses · o hasta caja=0)
  const puntos: Array<{ mes: number; saldoProyectado: number }> = [];
  for (let m = 0; m <= 12; m++) {
    const saldo = Math.max(0, cajaActual - burnRateMensual * m);
    puntos.push({ mes: m, saldoProyectado: saldo });
    if (saldo <= 0) break;
  }

  // Fechas zonas
  let zonaAlertaFecha: Date | undefined;
  let zonaCriticaFecha: Date | undefined;
  if (burnRateMensual > 0 && runwayMeses !== Infinity) {
    const mesesAlerta = Math.max(0, runwayMeses - 6);
    const mesesCritico = Math.max(0, runwayMeses - 3);
    if (mesesAlerta < 12) {
      zonaAlertaFecha = new Date(hoy);
      zonaAlertaFecha.setMonth(zonaAlertaFecha.getMonth() + Math.ceil(mesesAlerta));
    }
    if (mesesCritico < 12) {
      zonaCriticaFecha = new Date(hoy);
      zonaCriticaFecha.setMonth(zonaCriticaFecha.getMonth() + Math.ceil(mesesCritico));
    }
  }

  return {
    burnRateMensual,
    cajaActual,
    runwayMeses,
    puntos,
    zonaAlertaFecha,
    zonaCriticaFecha,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// G2 · WORKING CAPITAL CYCLE (DSO · DIO · DPO · CCC)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Working Capital Cycle = DSO + DIO − DPO
 *   - DSO: días promedio para cobrar a clientes
 *   - DIO: días promedio que el stock tarda en venderse (DEUDA · estimado fijo)
 *   - DPO: días promedio para pagar a proveedores
 */
export function calcularWorkingCapitalCycle(opts: {
  ccs: CuentaCorriente[];
  /** Benchmark configurable por sector · default rango skincare eCommerce */
  benchmarkMin?: number;
  benchmarkMax?: number;
}): WorkingCapitalCycle {
  const { ccs, benchmarkMin = 45, benchmarkMax = 65 } = opts;

  // DSO ponderado por monto
  let dsoSumaPonderada = 0;
  let dsoSumaPesos = 0;
  // DPO ponderado por monto
  let dpoSumaPonderada = 0;
  let dpoSumaPesos = 0;

  for (const cc of ccs) {
    const dias = diasDesde(cc.fechaUltimoMovimiento);
    const magnitud = Math.abs(cc.saldoPEN ?? 0) + Math.abs(cc.saldoUSD ?? 0);
    if (magnitud < 0.01) continue;

    if (cc.tipo === 'cliente' && (cc.saldoPEN > 0 || cc.saldoUSD > 0)) {
      dsoSumaPonderada += magnitud * dias;
      dsoSumaPesos += magnitud;
    }
    if (cc.tipo === 'proveedor' && (cc.saldoPEN < 0 || cc.saldoUSD < 0)) {
      dpoSumaPonderada += magnitud * dias;
      dpoSumaPesos += magnitud;
    }
  }

  const dso = dsoSumaPesos > 0 ? Math.round(dsoSumaPonderada / dsoSumaPesos) : 0;
  const dpo = dpoSumaPesos > 0 ? Math.round(dpoSumaPonderada / dpoSumaPesos) : 0;

  // DIO · DEUDA-DIO-REAL · placeholder fijo por sector (skincare ~70d)
  // En chk5.D-S4 conectar con inventario real
  const dio = 70;

  const ccc = dso + dio - dpo;
  const dentroRango = ccc >= benchmarkMin && ccc <= benchmarkMax;

  return { dso, dio, dpo, ccc, benchmarkMin, benchmarkMax, dentroRango };
}

// ═════════════════════════════════════════════════════════════════════════
// G7 · EBITDA BRIDGE MoM
// ═════════════════════════════════════════════════════════════════════════

/**
 * EBITDA Bridge · descomposición simplificada de la variación MoM.
 * Algoritmo simple · DEUDA-EBITDA-DRIVERS para descomposición completa.
 */
export function calcularEbitdaBridge(opts: {
  movimientosMesActual: MovimientoTesoreria[];
  movimientosMesAnterior: MovimientoTesoreria[];
}): EbitdaBridge {
  const ebitdaActual = calcularEbitdaSimple(opts.movimientosMesActual);
  const ebitdaAnterior = calcularEbitdaSimple(opts.movimientosMesAnterior);

  const variacion = ebitdaActual - ebitdaAnterior;
  const variacionPct =
    ebitdaAnterior !== 0 ? Math.round((variacion / Math.abs(ebitdaAnterior)) * 100) : 0;

  // Drivers heurísticos · descomposición simplificada
  const ingresosActual = sumarPorTipo(opts.movimientosMesActual, TIPOS_INGRESO);
  const ingresosAnterior = sumarPorTipo(opts.movimientosMesAnterior, TIPOS_INGRESO);
  const egresosActual = sumarPorTipo(opts.movimientosMesActual, TIPOS_EGRESO);
  const egresosAnterior = sumarPorTipo(opts.movimientosMesAnterior, TIPOS_EGRESO);

  const deltaIngresos = ingresosActual - ingresosAnterior;
  const deltaEgresos = egresosActual - egresosAnterior;

  // Drivers simplificados (placeholder · DEUDA-EBITDA-DRIVERS para descomposición real)
  const drivers: EbitdaBridge['drivers'] = [];
  if (deltaIngresos > 0) {
    drivers.push({ label: '+Volumen', monto: deltaIngresos, color: 'emerald' });
  } else if (deltaIngresos < 0) {
    drivers.push({ label: '−Volumen', monto: deltaIngresos, color: 'rose' });
  }
  if (deltaEgresos > 0) {
    drivers.push({ label: '−Costos', monto: -deltaEgresos, color: 'rose' });
  } else if (deltaEgresos < 0) {
    drivers.push({ label: '+Ahorros', monto: -deltaEgresos, color: 'emerald' });
  }

  const narrativa = generarNarrativaEbitda(variacion, variacionPct, drivers);

  return {
    ebitdaMesAnterior: ebitdaAnterior,
    ebitdaMesActual: ebitdaActual,
    variacion,
    variacionPct,
    drivers,
    narrativa,
  };
}

function calcularEbitdaSimple(movs: MovimientoTesoreria[]): number {
  const ingresos = sumarPorTipo(movs, TIPOS_INGRESO);
  const egresos = sumarPorTipo(movs, TIPOS_EGRESO);
  return ingresos - egresos;
}

function sumarPorTipo(movs: MovimientoTesoreria[], tipos: typeof TIPOS_INGRESO): number {
  let total = 0;
  for (const m of movs) {
    if (m.estado === 'anulado') continue;
    if (tipos.includes(m.tipo)) total += m.montoEquivalentePEN || 0;
  }
  return total;
}

function generarNarrativaEbitda(
  variacion: number,
  variacionPct: number,
  drivers: EbitdaBridge['drivers'],
): string {
  if (Math.abs(variacion) < 100) {
    return 'EBITDA estable mes a mes · sin cambios significativos.';
  }
  const direccion = variacion >= 0 ? 'creció' : 'cayó';
  const pctTxt = `${variacionPct >= 0 ? '+' : ''}${variacionPct}%`;
  const driverPrincipal = drivers.reduce<EbitdaBridge['drivers'][0] | undefined>(
    (max, d) => (!max || Math.abs(d.monto) > Math.abs(max.monto) ? d : max),
    undefined,
  );
  const driverTxt = driverPrincipal
    ? `Driver principal: ${driverPrincipal.label} (${driverPrincipal.monto >= 0 ? '+' : ''}S/ ${fmtMonto(driverPrincipal.monto)}).`
    : '';
  return `EBITDA ${direccion} ${pctTxt} mes a mes (S/ ${fmtMonto(Math.abs(variacion))}). ${driverTxt}`;
}

// ═════════════════════════════════════════════════════════════════════════
// CALENDARIO OBLIGACIONES (heatmap mensual)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Construye los eventos del mes para el heatmap calendario.
 * Mezcla CxP venc 30d + TC ciclos + sueldos fijos + recaudadoras pendientes.
 */
export function calcularCalendarioObligaciones(opts: {
  anio: number;
  mes: number;
  ccs: CuentaCorriente[];
  tarjetas: TarjetaCredito[];
  /** Día fijo nómina · default 28 */
  diaNomina?: number;
  /** Día fijo alquiler · default 1 */
  diaAlquiler?: number;
}): CalendarioMes {
  const { anio, mes, ccs, tarjetas, diaNomina = 28, diaAlquiler = 1 } = opts;
  const hoy = new Date();
  const eventos: CalendarioEvento[] = [];

  // CxP vencidos / próximos
  for (const cc of ccs) {
    if (cc.tipo !== 'proveedor') continue;
    if (cc.saldoPEN >= -0.01 && cc.saldoUSD >= -0.01) continue;
    if (!cc.fechaUltimoMovimiento) continue;
    const fechaEsperada = new Date(cc.fechaUltimoMovimiento.toDate());
    fechaEsperada.setDate(fechaEsperada.getDate() + 30);
    if (fechaEsperada.getFullYear() !== anio || fechaEsperada.getMonth() !== mes) continue;
    const monto = Math.abs(cc.saldoPEN ?? 0) + Math.abs(cc.saldoUSD ?? 0);
    const esVencido = fechaEsperada < hoy;
    eventos.push({
      fecha: fechaEsperada,
      tipo: esVencido ? 'vencido' : 'gasto',
      label: `${esVencido ? 'Vencido' : 'Pago'} ${cc.entidadNombre}`,
      monto,
    });
  }

  // TC ciclos (día pago mensual)
  for (const tc of tarjetas) {
    if (!tc.activa || !tc.diaPago) continue;
    const fechaPago = new Date(anio, mes, Math.min(28, tc.diaPago));
    eventos.push({
      fecha: fechaPago,
      tipo: 'tc',
      label: `Pago TC ${tc.nombre}`,
      monto: Math.abs(tc.saldoActualUSD ?? 0),
    });
  }

  // Nómina fija (día N)
  const fechaNomina = new Date(anio, mes, Math.min(28, diaNomina));
  eventos.push({
    fecha: fechaNomina,
    tipo: 'sueldo',
    label: 'Nómina mensual',
    monto: 8400, // placeholder · DEUDA-PLANILLA-INTEGRACION
  });

  // Alquiler fijo (día 1)
  const fechaAlquiler = new Date(anio, mes, diaAlquiler);
  eventos.push({
    fecha: fechaAlquiler,
    tipo: 'sueldo',
    label: 'Alquiler oficina',
    monto: 2800, // placeholder
  });

  const totalComprometido = eventos.reduce((s, e) => s + e.monto, 0);
  const vencimientosCriticos = eventos.filter((e) => e.tipo === 'vencido').length;

  return { anio, mes, eventos, totalComprometido, vencimientosCriticos };
}

// ═════════════════════════════════════════════════════════════════════════
// G9 · SANKEY (flujo dinero · simplificado)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Construye nodos + flows del Sankey para el periodo dado.
 * Versión simplificada: 4 cuentas principales → 4 categorías principales.
 */
export function calcularSankey(opts: {
  cuentas: CuentaCaja[];
  movimientos: MovimientoTesoreria[];
}): { nodos: SankeyNode[]; flows: SankeyFlow[] } {
  const { cuentas, movimientos } = opts;

  // Agrupar volumen por cuenta (origen) y por tipo (destino)
  const porCuenta = new Map<string, number>();
  const porTipo = new Map<string, number>();

  for (const m of movimientos) {
    if (m.estado === 'anulado') continue;
    const equiv = Math.abs(m.montoEquivalentePEN || 0);
    const cuentaId = m.cuentaOrigen ?? m.cuentaDestino ?? 'sin_cuenta';
    porCuenta.set(cuentaId, (porCuenta.get(cuentaId) ?? 0) + equiv);
    porTipo.set(m.tipo, (porTipo.get(m.tipo) ?? 0) + equiv);
  }

  // Top 4 cuentas + top 4 tipos
  const topCuentas = Array.from(porCuenta.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const topTipos = Array.from(porTipo.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const nodos: SankeyNode[] = [];
  topCuentas.forEach(([cuentaId, vol], idx) => {
    const cuenta = cuentas.find((c) => c.id === cuentaId);
    nodos.push({
      id: `origen_${cuentaId}`,
      label: cuenta?.nombre.slice(0, 14) ?? 'Sin cuenta',
      lado: 'origen',
      volumen: vol,
      color: SANKEY_COLORES_ORIGEN[idx % SANKEY_COLORES_ORIGEN.length],
    });
  });
  topTipos.forEach(([tipo, vol], idx) => {
    nodos.push({
      id: `destino_${tipo}`,
      label: SANKEY_TIPO_LABEL[tipo] ?? tipo,
      lado: 'destino',
      volumen: vol,
      color: SANKEY_COLORES_DESTINO[idx % SANKEY_COLORES_DESTINO.length],
    });
  });

  // Flows · matriz cuenta × tipo
  const flows: SankeyFlow[] = [];
  const matriz = new Map<string, number>();
  for (const m of movimientos) {
    if (m.estado === 'anulado') continue;
    const cuentaId = m.cuentaOrigen ?? m.cuentaDestino ?? 'sin_cuenta';
    if (!topCuentas.find(([id]) => id === cuentaId)) continue;
    if (!topTipos.find(([t]) => t === m.tipo)) continue;
    const key = `${cuentaId}__${m.tipo}`;
    matriz.set(key, (matriz.get(key) ?? 0) + Math.abs(m.montoEquivalentePEN || 0));
  }
  for (const [key, vol] of matriz) {
    const [cuentaId, tipo] = key.split('__');
    const nodoOrigen = nodos.find((n) => n.id === `origen_${cuentaId}`);
    flows.push({
      desde: `origen_${cuentaId}`,
      hacia: `destino_${tipo}`,
      volumen: vol,
      color: nodoOrigen?.color ?? '#94a3b8',
    });
  }

  return { nodos, flows };
}

const SANKEY_COLORES_ORIGEN = ['#0d9488', '#06b6d4', '#9333ea', '#f59e0b'];
const SANKEY_COLORES_DESTINO = ['#10b981', '#f59e0b', '#6366f1', '#9333ea'];
const SANKEY_TIPO_LABEL: Record<string, string> = {
  ingreso_venta: 'Ventas',
  ingreso_anticipo: 'Anticipos',
  ingreso_otro: 'Otros ingr.',
  aporte_capital: 'Capital',
  pago_orden_compra: 'Stock/COGS',
  pago_proveedor_local: 'Proveed.',
  pago_viajero: 'Logística',
  gasto_operativo: 'Opex',
  retiro_socio: 'Retiros',
  conversion_pen_usd: 'Conv. USD',
  conversion_usd_pen: 'Conv. PEN',
  transferencia_interna: 'Transf.',
  pago_nomina: 'Sueldos',
  adelanto_empleado: 'Adelantos',
  ajuste_positivo: 'Aj. (+)',
  ajuste_negativo: 'Aj. (−)',
};

// ═════════════════════════════════════════════════════════════════════════
// G5 · COHORT COBRO DSO (heatmap)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Cohort DSO · DEUDA-COHORT-DSO en mockup §11.
 * Versión simplificada heurística · agrupa ventas por mes de emisión y
 * estima % cobrado al mes M1, M2, ..., M6.
 *
 * Esta implementación es ILUSTRATIVA · requiere tracking real de cobros
 * por venta para ser precisa (próximo en chk5.D-S4).
 */
export function calcularCohortDSO(opts: {
  ccs: CuentaCorriente[];
  /** Número de cohortes a mostrar · default últimos 5 meses */
  meses?: number;
}): CohortDSORow[] {
  const { ccs, meses = 5 } = opts;
  const hoy = new Date();
  const rows: CohortDSORow[] = [];

  // Generar cohortes desde hace N meses hasta el actual
  for (let i = meses - 1; i >= 0; i--) {
    const fechaCohort = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const cohortKey = fechaCohort.toLocaleDateString('es-PE', {
      month: 'short',
      year: '2-digit',
    }).replace('.', '').replace(' de ', '-');

    // Heurística simplificada · % cobrado decae con cohortes recientes
    // (los clientes nuevos suelen pagar más lento al principio)
    const baseM1 = 85 - i * 5; // 85, 80, 75, 70, 65
    rows.push({
      cohort: capitalize(cohortKey),
      m1: i >= meses ? undefined : Math.max(0, baseM1),
      m2: i >= 1 ? Math.min(100, baseM1 + 10) : undefined,
      m3: i >= 2 ? Math.min(100, baseM1 + 18) : undefined,
      m4: i >= 3 ? Math.min(100, baseM1 + 24) : undefined,
      m5: i >= 4 ? Math.min(100, baseM1 + 28) : undefined,
      m6: i >= 5 ? Math.min(100, baseM1 + 30) : undefined,
    });
  }

  // Suprimir warning · ccs reservado para próximo cálculo real
  void ccs;
  return rows;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ═════════════════════════════════════════════════════════════════════════
// G4 · ROI POR LÍNEA (scatter quadrant)
// ═════════════════════════════════════════════════════════════════════════

/**
 * ROI por línea de negocio · scatter X=inversión Y=retorno.
 * Versión heurística · requiere costos por línea + ingresos por línea
 * (chk5.D-S4 conecta con Cost Intelligence).
 */
export function calcularROIScatter(opts: {
  movimientos: MovimientoTesoreria[];
}): ROIPunto[] {
  const { movimientos } = opts;
  const lineas = new Map<string, { ingreso: number; egreso: number; nombre: string }>();
  for (const m of movimientos) {
    if (m.estado === 'anulado') continue;
    const lin = m.lineaNegocioId ?? 'sin_linea';
    const nombre = m.lineaNegocioNombre ?? 'Sin línea';
    if (!lineas.has(lin)) lineas.set(lin, { ingreso: 0, egreso: 0, nombre });
    const e = lineas.get(lin)!;
    const equiv = m.montoEquivalentePEN || 0;
    if (TIPOS_INGRESO.includes(m.tipo)) e.ingreso += equiv;
    else if (TIPOS_EGRESO.includes(m.tipo)) e.egreso += equiv;
  }

  // Normalizar a 0-100 para el scatter
  const maxIngreso = Math.max(1, ...Array.from(lineas.values()).map((l) => l.ingreso));
  const maxEgreso = Math.max(1, ...Array.from(lineas.values()).map((l) => l.egreso));

  const puntos: ROIPunto[] = [];
  for (const [id, data] of lineas) {
    if (data.ingreso < 0.01 && data.egreso < 0.01) continue;
    const inversion = (data.egreso / maxEgreso) * 100;
    const retorno = (data.ingreso / maxIngreso) * 100;
    const cuadrante: CuadranteROI =
      retorno >= 50 ? (inversion >= 50 ? 'promesa' : 'star') : inversion >= 50 ? 'perro' : 'vaca';
    const color =
      cuadrante === 'star' || cuadrante === 'vaca'
        ? 'emerald'
        : cuadrante === 'promesa'
        ? 'amber'
        : 'rose';
    puntos.push({
      id,
      label: data.nombre.slice(0, 6).toUpperCase(),
      inversion,
      retorno,
      radio: Math.max(4, Math.min(22, (data.ingreso / maxIngreso) * 20 + 4)),
      color,
      cuadrante,
    });
  }

  return puntos;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS GENERALES
// ═════════════════════════════════════════════════════════════════════════

function diasDesde(fecha: { toMillis: () => number } | undefined | null): number {
  if (!fecha) return 0;
  return Math.floor((Date.now() - fecha.toMillis()) / (1000 * 60 * 60 * 24));
}

export function fmtMonto(n: number): string {
  return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ═════════════════════════════════════════════════════════════════════════
// AGREGADOR · cálculo combinado para FinanzasAnalisis.tsx
// ═════════════════════════════════════════════════════════════════════════

/**
 * Calcula los principales valores agregados necesarios para todos los gauges
 * y waterfalls · ingreso · egreso · margen · CxP 30d · etc.
 */
export interface AgregadosFinancieros {
  ingresoMes: number;
  egresoMes: number;
  /** COGS estimado · 40% del ingreso (DEUDA-COGS-REAL) */
  cogsEstimado: number;
  /** Opex = egreso - COGS estimado */
  opexEstimado: number;
  /** EBITDA = ingreso - COGS - opex */
  ebitda: number;
  margenEbitdaPct: number;
  /** CxP próximas 30 días (PEN equivalente) */
  cxpProximos30d: number;
  /** Activos · suma cuentas activas + CxC */
  activosTotal: number;
  /** Pasivos · CxP + saldos TC */
  pasivosTotal: number;
}

export function calcularAgregados(opts: {
  cuentas: CuentaCaja[];
  movimientosMes: MovimientoTesoreria[];
  ccs: CuentaCorriente[];
  tarjetas: TarjetaCredito[];
  resumenCC: SaldosResumen | null;
  tcpa: number;
}): AgregadosFinancieros {
  const { cuentas, movimientosMes, ccs, tarjetas, resumenCC, tcpa } = opts;

  const ingresoMes = sumarPorTipo(movimientosMes, TIPOS_INGRESO);
  const egresoMes = sumarPorTipo(movimientosMes, TIPOS_EGRESO);
  // DEUDA-COGS-REAL · estimación 40% del ingreso típica eCommerce skincare
  const cogsEstimado = ingresoMes * 0.4;
  const opexEstimado = Math.max(0, egresoMes - cogsEstimado);
  const ebitda = ingresoMes - cogsEstimado - opexEstimado;
  const margenEbitdaPct = ingresoMes > 0 ? (ebitda / ingresoMes) * 100 : 0;

  // CxP próximas 30d (PEN equivalente)
  let cxpProximos30d = 0;
  const hoy = Date.now();
  const en30d = hoy + 30 * 24 * 60 * 60 * 1000;
  for (const cc of ccs) {
    if (cc.tipo !== 'proveedor') continue;
    if (cc.saldoPEN >= -0.01 && cc.saldoUSD >= -0.01) continue;
    if (!cc.fechaUltimoMovimiento) continue;
    const fechaProxima = cc.fechaUltimoMovimiento.toMillis() + 30 * 24 * 60 * 60 * 1000;
    if (fechaProxima >= hoy && fechaProxima <= en30d) {
      cxpProximos30d += Math.abs(cc.saldoPEN ?? 0) + Math.abs(cc.saldoUSD ?? 0) * tcpa;
    }
  }

  // Activos = cuentas activas + CxC
  let activosCuentas = 0;
  for (const c of cuentas) {
    if (!c.activa) continue;
    if (c.esBiMoneda) {
      activosCuentas += (c.saldoPEN ?? 0) + (c.saldoUSD ?? 0) * tcpa;
    } else if (c.moneda === 'PEN') {
      activosCuentas += c.saldoActual ?? 0;
    } else {
      activosCuentas += (c.saldoActual ?? 0) * tcpa;
    }
  }
  const cxcTotal =
    (resumenCC?.totalDebenAEmpresa.PEN ?? 0) +
    (resumenCC?.totalDebenAEmpresa.USD ?? 0) * tcpa;
  const activosTotal = activosCuentas + cxcTotal;

  // Pasivos = CxP + saldos TC
  const cxpTotal =
    (resumenCC?.totalEmpresaDebe.PEN ?? 0) +
    (resumenCC?.totalEmpresaDebe.USD ?? 0) * tcpa;
  let deudaTC = 0;
  for (const tc of tarjetas) {
    if (!tc.activa) continue;
    deudaTC += Math.abs(tc.saldoActualUSD ?? 0) * tcpa;
  }
  const pasivosTotal = cxpTotal + deudaTC;

  return {
    ingresoMes,
    egresoMes,
    cogsEstimado,
    opexEstimado,
    ebitda,
    margenEbitdaPct,
    cxpProximos30d,
    activosTotal,
    pasivosTotal,
  };
}
