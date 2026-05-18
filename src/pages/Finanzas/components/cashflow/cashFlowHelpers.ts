/**
 * cashFlowHelpers — chk5.D-S3.quater · SF1
 *
 * Helpers puros para la sub-vista Cash flow proyectado (`/finanzas/cash-flow`)
 * canon MOCK 9. Centraliza KPIs · proyección heurística · drivers · escenarios
 * · detección de puntos de tensión.
 *
 * NOTA · drivers configurables (DEUDA-DRIVERS-CONFIG declarada en MOCK 9 §2)
 * NO existen aún en BD · se difiere a chk5.D-S4. Esta implementación es
 * heurística desde data real:
 *   - CxC due dates (fechaUltimoMovimiento + supuesto 30d cobro promedio)
 *   - TC ciclos (diaPago de cada tarjeta)
 *   - OCs abiertas con saldo (placeholder · chk5.D-S4 cierra wiring real)
 *   - Burn rate = promedio egresos últimos 90 días
 *
 * Sin Firestore · sin React · testeable aisladamente.
 */

import { Timestamp } from 'firebase/firestore';
import type { CuentaCaja, MovimientoTesoreria } from '../../../../types/tesoreria.types';
import type { CuentaCorriente } from '../../../../types/cuentaCorriente.types';
import type { TarjetaCredito } from '../../../../types/tarjetaCredito.types';
import { TIPOS_INGRESO, TIPOS_EGRESO } from '../../../../services/tesoreria.shared';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS DEL DOMINIO
// ═════════════════════════════════════════════════════════════════════════

export type EscenarioCashFlow = 'optimista' | 'base' | 'pesimista';
export type HorizonteCashFlow = 30 | 60 | 90;
export type ConfianzaDriver = 'alta' | 'media' | 'baja';
export type TipoDriver =
  | 'cobro'
  | 'pago_proveedor'
  | 'tc_corte'
  | 'pago_critico'
  | 'recaudador'
  | 'wallet_payout'
  | 'fijo_mensual';

/**
 * Evento proyectado en el cash flow · representa una entrada/salida futura
 * con su monto · fecha · confianza · tipo · cuenta destino/origen.
 */
export interface DriverProyectado {
  /** Fecha estimada del evento */
  fecha: Date;
  /** Descripción del evento · ej "Cobro F-015 · Premium SA" */
  descripcion: string;
  /** Nombre/alias de la cuenta involucrada · ej "BCP Soles" */
  cuentaNombre: string;
  /** Monto en moneda nativa (positivo si ingreso, negativo si egreso) */
  monto: number;
  /** Moneda · 'PEN' | 'USD' */
  moneda: 'PEN' | 'USD';
  /** Monto equivalente PEN (para charting · usa tcpa actual) */
  montoEquivPEN: number;
  /** Tipo · matchea con badge color en UI */
  tipo: TipoDriver;
  /** Confianza · alta = comprometido/fijo · media = estimado · baja = supuesto */
  confianza: ConfianzaDriver;
  /** Si true · este driver es el "punto crítico" del periodo */
  esCritico?: boolean;
  /** Sub-monto en USD si aplica (ej. TC bimoneda) · para display dual */
  montoUSDSecundario?: number;
}

export interface PuntoProyeccion {
  /** Fecha del punto */
  fecha: Date;
  /** Saldo proyectado en PEN equivalente · escenario base */
  saldoBase: number;
  /** Saldo en escenario optimista (+15%) */
  saldoOptimista: number;
  /** Saldo en escenario pesimista (−20%) */
  saldoPesimista: number;
  /** True si es punto de tensión detectado (delta grande · zona alerta) */
  esTension?: boolean;
}

export interface ProyeccionResultado {
  /** Serie temporal completa de la proyección · 1 punto por día */
  puntos: PuntoProyeccion[];
  /** Posición HOY (PEN equivalente) */
  posicionHoy: number;
  /** Cierre proyectado al +30d (base) */
  cierre30dBase: number;
  /** Cierre proyectado al +60d (base) */
  cierre60dBase: number;
  /** Cierre +30d optimista */
  cierre30dOptimista: number;
  /** Cierre +60d optimista */
  cierre60dOptimista: number;
  /** Cierre +30d pesimista */
  cierre30dPesimista: number;
  /** Cierre +60d pesimista */
  cierre60dPesimista: number;
  /** Punto crítico detectado (día con menor saldo o vencimientos convergentes) */
  diaCriticoFecha?: Date;
  diaCriticoSaldoBase?: number;
  diaCriticoMotivo?: string;
}

export interface KPIsCashFlow {
  /** Saldo total consolidado HOY (PEN equivalente) */
  posicionHoy: number;
  /** Cierre proyectado +30d (escenario base) */
  cierre30dBase: number;
  /** Delta +30d (positivo = entra · negativo = sale) */
  delta30d: number;
  /** Cierre proyectado +60d (escenario base) */
  cierre60dBase: number;
  /** Delta +60d */
  delta60d: number;
  /** Burn rate mensual · promedio egresos últimos 90d / 3 */
  burnRateMensual: number;
  /** Runway en meses · posicionHoy / burnRate */
  runwayMeses: number;
  /** Día crítico próximo (vencimiento + pico de tensión) */
  diaCriticoFecha?: Date;
  diaCriticoMotivo?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS · cálculos base
// ═════════════════════════════════════════════════════════════════════════

/**
 * Calcula la posición de caja consolidada HOY en PEN equivalente.
 * Suma saldos de todas las cuentas activas · USD se convierte con tcpa.
 */
export function calcularPosicionHoy(cuentas: CuentaCaja[], tcpa: number): number {
  let pen = 0;
  let usd = 0;
  for (const c of cuentas) {
    if (!c.activa) continue;
    if (c.esBiMoneda) {
      pen += c.saldoPEN ?? 0;
      usd += c.saldoUSD ?? 0;
    } else if (c.moneda === 'PEN') {
      pen += c.saldoActual ?? 0;
    } else {
      usd += c.saldoActual ?? 0;
    }
  }
  return pen + usd * (tcpa || 0);
}

/**
 * Calcula el burn rate mensual · promedio egresos PEN equivalente últimos 90d / 3.
 * Si hay menos de 30 días de historia · devuelve 0 (insuficiente).
 */
export function calcularBurnRate(movimientos: MovimientoTesoreria[]): number {
  const hoy = new Date();
  const hace90d = new Date();
  hace90d.setDate(hace90d.getDate() - 90);
  hace90d.setHours(0, 0, 0, 0);

  let totalEgresos = 0;
  let mesesConData = 0;
  const mesesConMov = new Set<string>();

  for (const m of movimientos) {
    if (m.estado === 'anulado') continue;
    if (!m.fecha) continue;
    const fecha = m.fecha.toDate();
    if (fecha < hace90d || fecha > hoy) continue;
    if (TIPOS_EGRESO.includes(m.tipo)) {
      totalEgresos += m.montoEquivalentePEN || 0;
      const mesKey = `${fecha.getFullYear()}-${fecha.getMonth()}`;
      mesesConMov.add(mesKey);
    }
  }
  mesesConData = mesesConMov.size;
  if (mesesConData === 0) return 0;
  return totalEgresos / mesesConData;
}

/**
 * Calcula el runway en meses · posicionHoy / burnRate.
 * Si burnRate = 0 · devuelve Infinity (interpretado como "sin egresos detectables").
 */
export function calcularRunway(posicionHoy: number, burnRate: number): number {
  if (burnRate <= 0) return Infinity;
  return posicionHoy / burnRate;
}

// ═════════════════════════════════════════════════════════════════════════
// EXTRAER DRIVERS PROYECTADOS · canon MOCK 9 tabla
// ═════════════════════════════════════════════════════════════════════════

/**
 * Construye la lista de drivers proyectados próximos N días desde data real:
 *   - CxC con saldo positivo → cobros (confianza alta si vencido · media si próximo)
 *   - CxP con saldo negativo → pagos (confianza alta · son compromisos)
 *   - TC ciclos → corte mensual (confianza alta · fecha fija)
 *   - Saldos recaudadora → liquidación quincenal (confianza media · estimado)
 *
 * Orden: por fecha ascendente.
 */
export function extraerDriversProyectados(opts: {
  ccs: CuentaCorriente[];
  tarjetas: TarjetaCredito[];
  recaudadorasPendientes: Array<{ nombre: string; pendientePEN: number; ultimaLiqDias: number }>;
  horizonte: HorizonteCashFlow;
  tcpa: number;
}): DriverProyectado[] {
  const { ccs, tarjetas, recaudadorasPendientes, horizonte, tcpa } = opts;
  const drivers: DriverProyectado[] = [];

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + horizonte);

  // ─── CxC · clientes con saldo positivo · cobros esperados ────────────
  for (const cc of ccs) {
    if (cc.tipo !== 'cliente') continue;
    const pen = cc.saldoPEN || 0;
    const usd = cc.saldoUSD || 0;
    if (pen < 0.01 && usd < 0.01) continue;

    // Heurística · fecha esperada = fechaUltimoMov + 30d (DSO supuesto)
    // Si ya está vencido · fecha = hoy + 7d (cobro próximo)
    const baseFecha = cc.fechaUltimoMovimiento?.toDate() ?? hoy;
    let fechaEsperada = new Date(baseFecha);
    fechaEsperada.setDate(fechaEsperada.getDate() + 30);
    if (fechaEsperada < hoy) {
      // Vencido · proyectar cobro en 7d
      fechaEsperada = new Date(hoy);
      fechaEsperada.setDate(fechaEsperada.getDate() + 7);
    }
    if (fechaEsperada > limite) continue;

    // Cobro PEN
    if (pen > 0.01) {
      drivers.push({
        fecha: fechaEsperada,
        descripcion: `Cobro · ${cc.entidadNombre}`,
        cuentaNombre: 'BCP Soles',
        monto: pen,
        moneda: 'PEN',
        montoEquivPEN: pen,
        tipo: 'cobro',
        confianza: estaVencido(cc) ? 'media' : 'alta',
      });
    }
    // Cobro USD
    if (usd > 0.01) {
      drivers.push({
        fecha: fechaEsperada,
        descripcion: `Cobro USD · ${cc.entidadNombre}`,
        cuentaNombre: 'Pool USD',
        monto: usd,
        moneda: 'USD',
        montoEquivPEN: usd * tcpa,
        tipo: 'cobro',
        confianza: estaVencido(cc) ? 'media' : 'alta',
      });
    }
  }

  // ─── CxP · proveedores con saldo negativo · pagos comprometidos ──────
  for (const cc of ccs) {
    if (cc.tipo !== 'proveedor') continue;
    const pen = cc.saldoPEN || 0;
    const usd = cc.saldoUSD || 0;
    if (pen > -0.01 && usd > -0.01) continue;

    const baseFecha = cc.fechaUltimoMovimiento?.toDate() ?? hoy;
    let fechaEsperada = new Date(baseFecha);
    fechaEsperada.setDate(fechaEsperada.getDate() + 30);
    if (fechaEsperada < hoy) {
      fechaEsperada = new Date(hoy);
      fechaEsperada.setDate(fechaEsperada.getDate() + 7);
    }
    if (fechaEsperada > limite) continue;

    if (pen < -0.01) {
      drivers.push({
        fecha: fechaEsperada,
        descripcion: `Pago · ${cc.entidadNombre}`,
        cuentaNombre: 'BCP Soles',
        monto: pen, // negativo
        moneda: 'PEN',
        montoEquivPEN: pen,
        tipo: 'pago_proveedor',
        confianza: 'alta',
      });
    }
    if (usd < -0.01) {
      drivers.push({
        fecha: fechaEsperada,
        descripcion: `Pago USD · ${cc.entidadNombre}`,
        cuentaNombre: 'Pool USD',
        monto: usd,
        moneda: 'USD',
        montoEquivPEN: usd * tcpa,
        tipo: 'pago_proveedor',
        confianza: 'alta',
      });
    }
  }

  // ─── TC · día corte mensual ──────────────────────────────────────────
  for (const tc of tarjetas) {
    if (!tc.activa) continue;
    const diaPago = tc.diaPago;
    if (!diaPago) continue;
    // Próximo día de pago dentro del horizonte
    const proxFecha = new Date(hoy);
    proxFecha.setDate(diaPago);
    if (proxFecha < hoy) proxFecha.setMonth(proxFecha.getMonth() + 1);
    if (proxFecha > limite) continue;

    const saldoUSD = Math.abs(tc.saldoActualUSD ?? 0); // legacy field
    if (saldoUSD < 0.01) continue;

    drivers.push({
      fecha: proxFecha,
      descripcion: `${tc.titularidad === 'personal' ? 'Reembolso' : 'Cierre TC'} · ${tc.nombre}`,
      cuentaNombre: tc.nombre,
      monto: -saldoUSD,
      moneda: 'USD',
      montoEquivPEN: -saldoUSD * tcpa,
      tipo: 'tc_corte',
      confianza: 'alta',
    });
  }

  // ─── Recaudadoras · liquidación quincenal ────────────────────────────
  for (const r of recaudadorasPendientes) {
    if (r.pendientePEN < 0.01) continue;
    // Próxima liquidación · 15 días desde última (o hoy+15 si nunca)
    const fechaProx = new Date(hoy);
    const diasHastaLiq = Math.max(1, 15 - r.ultimaLiqDias);
    fechaProx.setDate(fechaProx.getDate() + diasHastaLiq);
    if (fechaProx > limite) continue;
    drivers.push({
      fecha: fechaProx,
      descripcion: `Liquidación · ${r.nombre}`,
      cuentaNombre: `${r.nombre} → BCP`,
      monto: r.pendientePEN,
      moneda: 'PEN',
      montoEquivPEN: r.pendientePEN,
      tipo: 'recaudador',
      confianza: 'media',
    });
  }

  // ─── Drivers fijos mensuales (heurística · alquiler + nómina) ────────
  // Placeholder · chk5.D-S4 leerá de drivers configurables reales.
  // Por ahora · si hay nómina/alquiler en histórico · proyectar 1 evento.

  // Orden por fecha
  drivers.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  // Marcar el primer driver "pago_critico" (mayor egreso convergente)
  marcarPuntoCritico(drivers);

  return drivers;
}

/**
 * Marca como esCritico el día donde convergen los mayores egresos consecutivos.
 * Heurística: el día con suma de egresos > umbral del 10% de la posición.
 */
function marcarPuntoCritico(drivers: DriverProyectado[]): void {
  const porDia = new Map<string, DriverProyectado[]>();
  for (const d of drivers) {
    const key = fechaKey(d.fecha);
    if (!porDia.has(key)) porDia.set(key, []);
    porDia.get(key)!.push(d);
  }
  let maxEgresoDia = 0;
  let diaCriticoKey: string | null = null;
  for (const [key, lista] of porDia) {
    let egresoDia = 0;
    for (const d of lista) {
      if (d.montoEquivPEN < 0) egresoDia += Math.abs(d.montoEquivPEN);
    }
    if (egresoDia > maxEgresoDia) {
      maxEgresoDia = egresoDia;
      diaCriticoKey = key;
    }
  }
  if (diaCriticoKey) {
    const lista = porDia.get(diaCriticoKey)!;
    // Marcar el evento de mayor monto del día
    let mayor: DriverProyectado | undefined;
    for (const d of lista) {
      if (!mayor || Math.abs(d.montoEquivPEN) > Math.abs(mayor.montoEquivPEN)) {
        mayor = d;
      }
    }
    if (mayor) mayor.esCritico = true;
  }
}

function fechaKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function estaVencido(cc: CuentaCorriente): boolean {
  if (!cc.fechaUltimoMovimiento) return false;
  const dias = Math.floor((Date.now() - cc.fechaUltimoMovimiento.toMillis()) / (1000 * 60 * 60 * 24));
  return dias > 30;
}

// ═════════════════════════════════════════════════════════════════════════
// PROYECTAR HEURISTICO · construir serie temporal
// ═════════════════════════════════════════════════════════════════════════

/**
 * Construye la serie temporal de cash flow proyectado · 1 punto por día.
 *   - Día 0 (hoy) = posicionHoy
 *   - Cada día siguiente = saldo anterior + drivers del día
 *   - Escenarios:
 *       optimista: +15% sobre cobros · −0% sobre pagos
 *       base:      drivers tal cual
 *       pesimista: −20% sobre cobros · +5% sobre pagos
 */
export function proyectarHeuristico(opts: {
  posicionHoy: number;
  drivers: DriverProyectado[];
  horizonte: HorizonteCashFlow;
  burnRateMensual: number;
}): ProyeccionResultado {
  const { posicionHoy, drivers, horizonte, burnRateMensual } = opts;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Drivers indexados por fecha key
  const driversPorDia = new Map<string, DriverProyectado[]>();
  for (const d of drivers) {
    const k = fechaKey(d.fecha);
    if (!driversPorDia.has(k)) driversPorDia.set(k, []);
    driversPorDia.get(k)!.push(d);
  }

  // Burn rate diario · gastos NO cubiertos por drivers explícitos (sueldos · servicios)
  // Heurística: distribuir burnRateMensual / 30 como egreso diario uniforme.
  const burnDiario = burnRateMensual / 30;

  const puntos: PuntoProyeccion[] = [];
  let saldoBase = posicionHoy;
  let saldoOpt = posicionHoy;
  let saldoPes = posicionHoy;

  let diaCriticoFecha: Date | undefined;
  let diaCriticoSaldo = posicionHoy;
  let diaCriticoMotivo: string | undefined;

  for (let i = 0; i <= horizonte; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() + i);
    const key = fechaKey(fecha);

    const drvDia = driversPorDia.get(key) ?? [];
    let deltaBase = 0;
    let deltaOpt = 0;
    let deltaPes = 0;
    for (const d of drvDia) {
      const m = d.montoEquivPEN;
      deltaBase += m;
      // Escenarios · ajuste sólo a cobros (positivos)
      if (m > 0) {
        deltaOpt += m * 1.15;
        deltaPes += m * 0.8;
      } else {
        deltaOpt += m;
        deltaPes += m * 1.05;
      }
    }
    // Burn diario uniforme (descontar todos los días excepto hoy)
    if (i > 0) {
      saldoBase -= burnDiario;
      saldoOpt -= burnDiario;
      saldoPes -= burnDiario * 1.05;
    }
    saldoBase += deltaBase;
    saldoOpt += deltaOpt;
    saldoPes += deltaPes;

    // Detectar día crítico · saldo base mínimo
    if (saldoBase < diaCriticoSaldo) {
      diaCriticoSaldo = saldoBase;
      diaCriticoFecha = fecha;
      const evCriticos = drvDia.filter((d) => d.esCritico);
      if (evCriticos.length > 0) {
        diaCriticoMotivo = evCriticos[0].descripcion;
      }
    }

    puntos.push({
      fecha,
      saldoBase,
      saldoOptimista: saldoOpt,
      saldoPesimista: saldoPes,
      esTension: saldoBase < posicionHoy * 0.4, // 40% de posición inicial = zona alerta
    });
  }

  // Cierre +30d · índice 30
  const cierre30 = puntos[Math.min(30, puntos.length - 1)] ?? puntos[puntos.length - 1];
  // Cierre +60d · índice 60
  const cierre60 = puntos[Math.min(60, puntos.length - 1)] ?? puntos[puntos.length - 1];

  return {
    puntos,
    posicionHoy,
    cierre30dBase: cierre30.saldoBase,
    cierre60dBase: cierre60.saldoBase,
    cierre30dOptimista: cierre30.saldoOptimista,
    cierre60dOptimista: cierre60.saldoOptimista,
    cierre30dPesimista: cierre30.saldoPesimista,
    cierre60dPesimista: cierre60.saldoPesimista,
    diaCriticoFecha,
    diaCriticoSaldoBase: diaCriticoFecha ? diaCriticoSaldo : undefined,
    diaCriticoMotivo,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// DETECTAR PUNTO DE TENSIÓN · banner alerta canon MOCK 9
// ═════════════════════════════════════════════════════════════════════════

export interface PuntoTensionDetectado {
  fecha: Date;
  diasHasta: number;
  /** Total egresos del día (PEN equivalente · positivo) */
  totalEgresos: number;
  /** Lista de eventos del día */
  eventos: DriverProyectado[];
  /** Caja proyectada base ese día */
  cajaEseDia: number;
  /** Si es 'critica' · caja < 0 · 'alerta' · caja < 30K · 'segura' · resto */
  zona: 'critica' | 'alerta' | 'segura';
  /** Mensaje sugerido para el banner */
  mensaje: string;
}

/**
 * Detecta el próximo punto de tensión en la proyección.
 * Es el día con mayor convergencia de egresos · o el día con menor saldo proyectado.
 */
export function detectarPuntoTension(
  proyeccion: ProyeccionResultado,
  drivers: DriverProyectado[],
): PuntoTensionDetectado | null {
  if (!proyeccion.diaCriticoFecha) return null;

  const fechaCrit = proyeccion.diaCriticoFecha;
  const keyCrit = fechaKey(fechaCrit);
  const eventosDia = drivers.filter((d) => fechaKey(d.fecha) === keyCrit);

  let totalEgresos = 0;
  for (const e of eventosDia) {
    if (e.montoEquivPEN < 0) totalEgresos += Math.abs(e.montoEquivPEN);
  }

  if (totalEgresos < 0.01) return null;

  const diasHasta = Math.max(
    0,
    Math.floor((fechaCrit.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  const cajaEseDia = proyeccion.diaCriticoSaldoBase ?? 0;
  let zona: PuntoTensionDetectado['zona'] = 'segura';
  if (cajaEseDia < 0) zona = 'critica';
  else if (cajaEseDia < 30000) zona = 'alerta';

  const fechaTxt = fechaCrit.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  let mensaje: string;
  if (eventosDia.length === 1) {
    mensaje = `En ${diasHasta} días vence ${eventosDia[0].descripcion}. La caja proyectada ese día queda en S/ ${fmt0(cajaEseDia)}.`;
  } else {
    const descripciones = eventosDia
      .filter((e) => e.montoEquivPEN < 0)
      .map((e) => e.descripcion)
      .slice(0, 3)
      .join(' + ');
    mensaje = `En ${diasHasta} días convergen: ${descripciones} = S/ ${fmt0(totalEgresos)} salida. La caja proyectada ese día baja a S/ ${fmt0(cajaEseDia)}${zona === 'alerta' ? ' (zona alerta)' : zona === 'critica' ? ' (zona crítica)' : ' (zona segura)'}.`;
  }

  return {
    fecha: fechaCrit,
    diasHasta,
    totalEgresos,
    eventos: eventosDia,
    cajaEseDia,
    zona,
    mensaje: mensaje + (zona !== 'segura' ? ' Revisar planificación de cobranza antes para holgura.' : ''),
  };
}

// ═════════════════════════════════════════════════════════════════════════
// KPIs CANON MOCK 9 · 5 KPIs específicos Cash flow
// ═════════════════════════════════════════════════════════════════════════

export function calcularKPIsCashFlow(opts: {
  cuentas: CuentaCaja[];
  movimientos90d: MovimientoTesoreria[];
  proyeccion: ProyeccionResultado;
  puntoTension: PuntoTensionDetectado | null;
  tcpa: number;
}): KPIsCashFlow {
  const { cuentas, movimientos90d, proyeccion, puntoTension, tcpa } = opts;

  const posicionHoy = calcularPosicionHoy(cuentas, tcpa);
  const burnRate = calcularBurnRate(movimientos90d);
  const runway = calcularRunway(posicionHoy, burnRate);

  return {
    posicionHoy,
    cierre30dBase: proyeccion.cierre30dBase,
    delta30d: proyeccion.cierre30dBase - posicionHoy,
    cierre60dBase: proyeccion.cierre60dBase,
    delta60d: proyeccion.cierre60dBase - posicionHoy,
    burnRateMensual: burnRate,
    runwayMeses: runway,
    diaCriticoFecha: puntoTension?.fecha,
    diaCriticoMotivo: puntoTension?.eventos[0]?.descripcion,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// FORMATO HELPERS
// ═════════════════════════════════════════════════════════════════════════

export function fmt0(n: number): string {
  return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function fmtK(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}K`;
  }
  return fmt0(n);
}

export function fmtFechaCorta(d: Date): string {
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }).replace(/\./g, '');
}

export function fmtFechaLarga(d: Date): string {
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ═════════════════════════════════════════════════════════════════════════
// FILTROS STATE
// ═════════════════════════════════════════════════════════════════════════

export interface FiltrosCashFlowState {
  horizonte: HorizonteCashFlow;
  escenariosVisibles: Set<EscenarioCashFlow>;
}

export function defaultFiltrosCashFlow(): FiltrosCashFlowState {
  return {
    horizonte: 60,
    escenariosVisibles: new Set<EscenarioCashFlow>(['optimista', 'base', 'pesimista']),
  };
}

// Suprime warning de import no usado · TIPOS_INGRESO reservado para próxima iter
void TIPOS_INGRESO;
void Timestamp;
