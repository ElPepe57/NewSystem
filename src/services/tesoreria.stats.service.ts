/**
 * tesoreria.stats.service.ts
 * Materialized statistics, TC transaction tracking, exchange-rate difference
 * calculation, cash-flow reports, and real-time stats fallback.
 */
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { tipoCambioService } from './tipoCambio.service';
import {
  REGISTROS_TC_COLLECTION,
  ESTADISTICAS_DOC,
  esMovimientoIngreso,
  esMovimientoEgreso
} from './tesoreria.shared';
import type {
  RegistroTCTransaccion,
  DiferenciaCambiariaPeriodo,
  TesoreriaStats,
  FlujoCajaMensual,
  EstadisticasTesoreriaAgregadas,
  EstadisticasMensuales,
  TipoMovimientoTesoreria,
  MonedaTesoreria,
  MovimientoTesoreria,
  ConversionCambiaria,
  CuentaCaja
} from '../types/tesoreria.types';

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Helper para obtener la clave del mes actual
 */
export function _getMesKey(fecha: Date = new Date()): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Helper para crear estadísticas mensuales vacías
 */
export function _crearEstadisticasMensualesVacias(mes: number, anio: number): EstadisticasMensuales {
  return {
    mes,
    anio,
    ingresosUSD: 0,
    ingresosPEN: 0,
    cantidadIngresos: 0,
    egresosUSD: 0,
    egresosPEN: 0,
    cantidadEgresos: 0,
    conversionesUSDaPEN: 0,
    conversionesPENaUSD: 0,
    cantidadConversiones: 0,
    spreadAcumulado: 0,
    diferenciaOrdenesCompra: 0,
    diferenciaVentas: 0,
    diferenciaConversiones: 0,
    diferenciaNetaMes: 0,
    sumaTipoCambio: 0,
    cantidadOperacionesTC: 0
  };
}

// ─── TC Transaction tracking ─────────────────────────────────────────────────

/**
 * Registrar TC de una transacción
 * Permite tracking del TC en cada momento del flujo
 */
export async function registrarTCTransaccion(
  tipoDocumento: 'orden_compra' | 'venta' | 'gasto' | 'pago_viajero',
  documentoId: string,
  documentoNumero: string,
  momento: 'cotizacion' | 'creacion' | 'confirmacion' | 'pago' | 'cobro' | 'conversion',
  montoUSD: number,
  tipoCambio: number,
  userId: string
): Promise<string> {
  // Buscar registro anterior del mismo documento
  const q = query(
    collection(db, REGISTROS_TC_COLLECTION),
    where('documentoId', '==', documentoId),
    orderBy('fecha', 'desc'),
    limit(1)
  );
  const snapshot = await getDocs(q);

  let tcMomentoAnterior: number | undefined;
  let diferenciaVsMomentoAnterior: number | undefined;

  if (!snapshot.empty) {
    const registroAnterior = snapshot.docs[0].data();
    tcMomentoAnterior = registroAnterior.tipoCambio;
    if (tcMomentoAnterior !== undefined) {
      diferenciaVsMomentoAnterior = (tipoCambio - tcMomentoAnterior) * montoUSD;
    }
  }

  const registro: Omit<RegistroTCTransaccion, 'id'> = {
    tipoDocumento,
    documentoId,
    documentoNumero,
    momento,
    montoUSD,
    tipoCambio,
    montoPEN: montoUSD * tipoCambio,
    tcMomentoAnterior,
    diferenciaVsMomentoAnterior,
    fecha: Timestamp.now(),
    registradoPor: userId
  };

  const docRef = await addDoc(collection(db, REGISTROS_TC_COLLECTION), registro);
  return docRef.id;
}

/**
 * Obtener historial de TC de un documento
 */
export async function getHistorialTCDocumento(documentoId: string): Promise<RegistroTCTransaccion[]> {
  const q = query(
    collection(db, REGISTROS_TC_COLLECTION),
    where('documentoId', '==', documentoId),
    orderBy('fecha', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  } as RegistroTCTransaccion));
}

// ─── Exchange-rate difference calculation ────────────────────────────────────

/**
 * Calcular diferencia cambiaria de un período
 */
export async function calcularDiferenciaCambiaria(
  mes: number,
  anio: number,
  getConversionesFn: (filtros?: any) => Promise<ConversionCambiaria[]>
): Promise<DiferenciaCambiariaPeriodo> {
  const inicioMes = new Date(anio, mes - 1, 1);
  const finMes = new Date(anio, mes, 0, 23, 59, 59);

  // Obtener registros TC del período
  const q = query(
    collection(db, REGISTROS_TC_COLLECTION),
    orderBy('fecha', 'asc')
  );
  const snapshot = await getDocs(q);

  const registros = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() } as RegistroTCTransaccion))
    .filter(r => {
      const fecha = r.fecha.toDate();
      return fecha >= inicioMes && fecha <= finMes;
    });

  // Agrupar por tipo de documento
  const porOC = registros.filter(r => r.tipoDocumento === 'orden_compra');
  const porVenta = registros.filter(r => r.tipoDocumento === 'venta');

  // Calcular diferencias por OC
  const diferenciaOC = porOC.reduce((sum, r) => sum + (r.diferenciaVsMomentoAnterior || 0), 0);
  const tcPromedioCompraOC = porOC.filter(r => r.momento === 'creacion').length > 0
    ? porOC.filter(r => r.momento === 'creacion').reduce((sum, r) => sum + r.tipoCambio, 0) / porOC.filter(r => r.momento === 'creacion').length
    : 0;
  const tcPromedioPagoOC = porOC.filter(r => r.momento === 'pago').length > 0
    ? porOC.filter(r => r.momento === 'pago').reduce((sum, r) => sum + r.tipoCambio, 0) / porOC.filter(r => r.momento === 'pago').length
    : 0;

  // Calcular diferencias por Venta
  const diferenciaVenta = porVenta.reduce((sum, r) => sum + (r.diferenciaVsMomentoAnterior || 0), 0);
  const tcPromedioVenta = porVenta.filter(r => r.momento === 'creacion').length > 0
    ? porVenta.filter(r => r.momento === 'creacion').reduce((sum, r) => sum + r.tipoCambio, 0) / porVenta.filter(r => r.momento === 'creacion').length
    : 0;
  const tcPromedioCobro = porVenta.filter(r => r.momento === 'cobro').length > 0
    ? porVenta.filter(r => r.momento === 'cobro').reduce((sum, r) => sum + r.tipoCambio, 0) / porVenta.filter(r => r.momento === 'cobro').length
    : 0;

  // Obtener conversiones del período
  const conversiones = await getConversionesFn({
    fechaInicio: inicioMes,
    fechaFin: finMes
  });

  const diferenciaConversiones = conversiones.reduce((sum, c) => sum + c.diferenciaVsReferencia, 0);
  const spreadPromedio = conversiones.length > 0
    ? conversiones.reduce((sum, c) => sum + c.spreadCambiario, 0) / conversiones.length
    : 0;

  const diferenciaNetoMes = diferenciaOC + diferenciaVenta + diferenciaConversiones;

  return {
    mes,
    anio,
    ordenesCompra: {
      cantidad: [...new Set(porOC.map(r => r.documentoId))].length,
      diferenciaTotal: diferenciaOC,
      tcPromedioCompra: tcPromedioCompraOC,
      tcPromedioPago: tcPromedioPagoOC
    },
    ventas: {
      cantidad: [...new Set(porVenta.map(r => r.documentoId))].length,
      diferenciaTotal: diferenciaVenta,
      tcPromedioVenta,
      tcPromedioCobro
    },
    conversiones: {
      cantidad: conversiones.length,
      diferenciaTotal: diferenciaConversiones,
      spreadPromedio
    },
    diferenciaNetoMes,
    impactoEnUtilidad: 0 // Se calcula cuando se tiene la utilidad del mes
  };
}

// ─── Materialized statistics ──────────────────────────────────────────────────

/**
 * Obtener estadísticas agregadas (lectura instantánea)
 */
export async function getEstadisticasAgregadas(): Promise<EstadisticasTesoreriaAgregadas | null> {
  try {
    const docRef = doc(db, ESTADISTICAS_DOC);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docSnap.data() as EstadisticasTesoreriaAgregadas;
  } catch (error) {
    logger.error('Error obteniendo estadísticas agregadas:', error);
    return null;
  }
}

/**
 * Inicializar documento de estadísticas (primera vez o reset)
 */
export async function inicializarEstadisticas(
  userId: string,
  getCuentasFn: () => Promise<CuentaCaja[]>
): Promise<void> {
  const ahora = new Date();
  const mesActual = _crearEstadisticasMensualesVacias(ahora.getMonth() + 1, ahora.getFullYear());

  // Calcular saldos actuales de las cuentas
  const cuentas = await getCuentasFn();
  let saldoTotalUSD = 0;
  let saldoTotalPEN = 0;

  cuentas.filter(c => c.activa).forEach(c => {
    if (c.esBiMoneda) {
      saldoTotalUSD += c.saldoUSD || 0;
      saldoTotalPEN += c.saldoPEN || 0;
    } else {
      if (c.moneda === 'USD') {
        saldoTotalUSD += c.saldoActual;
      } else {
        saldoTotalPEN += c.saldoActual;
      }
    }
  });

  // Obtener TC centralizado
  const tcActual = await tipoCambioService.resolverTCVenta();

  const estadisticas: EstadisticasTesoreriaAgregadas = {
    saldoTotalUSD,
    saldoTotalPEN,
    saldoTotalEquivalentePEN: saldoTotalPEN + (saldoTotalUSD * tcActual),
    tipoCambioActual: tcActual,
    mesActual,
    historicoPorMes: {
      [_getMesKey()]: mesActual
    },
    acumuladoAnio: {
      anio: ahora.getFullYear(),
      ingresosUSD: 0,
      ingresosPEN: 0,
      egresosUSD: 0,
      egresosPEN: 0,
      diferenciaNetaAnio: 0,
      cantidadOperaciones: 0
    },
    ultimoNumeroMovimiento: 0,
    ultimoNumeroConversion: 0,
    ultimaActualizacion: Timestamp.now(),
    actualizadoPor: userId,
    version: 1
  };

  const docRef = doc(db, ESTADISTICAS_DOC);
  await updateDoc(docRef, estadisticas as any).catch(async () => {
    // Si el documento no existe, crearlo con setDoc
    const { setDoc } = await import('firebase/firestore');
    await setDoc(docRef, estadisticas);
  });

  logger.success('Estadísticas de tesorería inicializadas');
}

/**
 * Actualizar estadísticas después de un movimiento
 */
export async function actualizarEstadisticasPorMovimiento(
  movimiento: {
    tipo: TipoMovimientoTesoreria;
    moneda: MonedaTesoreria;
    monto: number;
    tipoCambio: number;
    cuentaOrigen?: string;
    cuentaDestino?: string;
  },
  esAnulacion: boolean = false,
  getCuentasFn: () => Promise<CuentaCaja[]>
): Promise<void> {
  const docRef = doc(db, ESTADISTICAS_DOC);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    // Si no existe, no hacer nada (se inicializará después)
    return;
  }

  const stats = docSnap.data() as EstadisticasTesoreriaAgregadas;
  const ahora = new Date();
  const mesKey = _getMesKey();
  const multiplicador = esAnulacion ? -1 : 1;

  // Asegurar que existe el mes actual
  if (!stats.historicoPorMes[mesKey]) {
    stats.historicoPorMes[mesKey] = _crearEstadisticasMensualesVacias(ahora.getMonth() + 1, ahora.getFullYear());
  }

  const mesActual = stats.historicoPorMes[mesKey];
  const esIngreso = esMovimientoIngreso(movimiento.tipo, movimiento);
  const esEgreso = esMovimientoEgreso(movimiento.tipo, movimiento);

  // Actualizar estadísticas del mes
  if (esIngreso) {
    if (movimiento.moneda === 'USD') {
      mesActual.ingresosUSD += movimiento.monto * multiplicador;
    } else {
      mesActual.ingresosPEN += movimiento.monto * multiplicador;
    }
    mesActual.cantidadIngresos += 1 * multiplicador;
  }

  if (esEgreso) {
    if (movimiento.moneda === 'USD') {
      mesActual.egresosUSD += movimiento.monto * multiplicador;
    } else {
      mesActual.egresosPEN += movimiento.monto * multiplicador;
    }
    mesActual.cantidadEgresos += 1 * multiplicador;
  }

  // Actualizar TC promedio
  if (movimiento.tipoCambio > 0) {
    mesActual.sumaTipoCambio += movimiento.tipoCambio * multiplicador;
    mesActual.cantidadOperacionesTC += 1 * multiplicador;
  }

  // Actualizar acumulado del año
  if (esIngreso) {
    if (movimiento.moneda === 'USD') {
      stats.acumuladoAnio.ingresosUSD += movimiento.monto * multiplicador;
    } else {
      stats.acumuladoAnio.ingresosPEN += movimiento.monto * multiplicador;
    }
  }
  if (esEgreso) {
    if (movimiento.moneda === 'USD') {
      stats.acumuladoAnio.egresosUSD += movimiento.monto * multiplicador;
    } else {
      stats.acumuladoAnio.egresosPEN += movimiento.monto * multiplicador;
    }
  }
  stats.acumuladoAnio.cantidadOperaciones += 1 * multiplicador;

  // Recalcular saldos de cuentas
  const cuentas = await getCuentasFn();
  let saldoTotalUSD = 0;
  let saldoTotalPEN = 0;

  cuentas.filter(c => c.activa).forEach(c => {
    if (c.esBiMoneda) {
      saldoTotalUSD += c.saldoUSD || 0;
      saldoTotalPEN += c.saldoPEN || 0;
    } else {
      if (c.moneda === 'USD') {
        saldoTotalUSD += c.saldoActual;
      } else {
        saldoTotalPEN += c.saldoActual;
      }
    }
  });

  stats.saldoTotalUSD = saldoTotalUSD;
  stats.saldoTotalPEN = saldoTotalPEN;
  stats.saldoTotalEquivalentePEN = saldoTotalPEN + (saldoTotalUSD * stats.tipoCambioActual);

  // Actualizar mes actual
  stats.mesActual = mesActual;
  stats.historicoPorMes[mesKey] = mesActual;
  stats.ultimaActualizacion = Timestamp.now();

  await updateDoc(docRef, stats as any);
}

/**
 * Actualizar estadísticas después de una conversión
 */
export async function actualizarEstadisticasPorConversion(
  conversion: {
    monedaOrigen: MonedaTesoreria;
    montoOrigen: number;
    montoDestino: number;
    tipoCambio: number;
    spreadCambiario: number;
    diferenciaVsReferencia: number;
  }
): Promise<void> {
  const docRef = doc(db, ESTADISTICAS_DOC);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return;
  }

  const stats = docSnap.data() as EstadisticasTesoreriaAgregadas;
  const mesKey = _getMesKey();

  // Asegurar que existe el mes actual
  if (!stats.historicoPorMes[mesKey]) {
    const ahora = new Date();
    stats.historicoPorMes[mesKey] = _crearEstadisticasMensualesVacias(ahora.getMonth() + 1, ahora.getFullYear());
  }

  const mesActual = stats.historicoPorMes[mesKey];

  // Actualizar conversiones
  if (conversion.monedaOrigen === 'USD') {
    mesActual.conversionesUSDaPEN += conversion.montoOrigen;
  } else {
    mesActual.conversionesPENaUSD += conversion.montoDestino;
  }

  mesActual.cantidadConversiones += 1;
  mesActual.spreadAcumulado += conversion.spreadCambiario;
  mesActual.diferenciaConversiones += conversion.diferenciaVsReferencia;
  mesActual.diferenciaNetaMes = mesActual.diferenciaOrdenesCompra + mesActual.diferenciaVentas + mesActual.diferenciaConversiones;

  // Actualizar acumulado del año
  stats.acumuladoAnio.diferenciaNetaAnio += conversion.diferenciaVsReferencia;

  // Actualizar mes actual
  stats.mesActual = mesActual;
  stats.historicoPorMes[mesKey] = mesActual;
  stats.ultimaActualizacion = Timestamp.now();

  await updateDoc(docRef, stats as any);
}

/**
 * Recalcular estadísticas completas (para admin/corrección)
 * NOTA: Esta función es pesada, solo usar cuando sea necesario
 */
export async function recalcularEstadisticasCompletas(
  userId: string,
  inicializarEstadisticasFn: (userId: string) => Promise<void>,
  getMovimientosFn: (filtros?: any) => Promise<MovimientoTesoreria[]>,
  getConversionesFn: (filtros?: any) => Promise<ConversionCambiaria[]>
): Promise<{ mensaje: string; tiempoMs: number }> {
  const inicio = Date.now();
  const ahora = new Date();

  // Inicializar estructura
  await inicializarEstadisticasFn(userId);

  // Obtener todos los movimientos del año
  const inicioAnio = new Date(ahora.getFullYear(), 0, 1);
  const movimientos = await getMovimientosFn({
    fechaInicio: inicioAnio,
    fechaFin: ahora
  });

  // Obtener todas las conversiones del año
  const conversiones = await getConversionesFn({
    fechaInicio: inicioAnio,
    fechaFin: ahora
  });

  // Agrupar por mes y procesar
  const docRef = doc(db, ESTADISTICAS_DOC);
  const docSnap = await getDoc(docRef);
  const stats = docSnap.data() as EstadisticasTesoreriaAgregadas;

  // Procesar movimientos
  for (const mov of movimientos) {
    if (mov.estado === 'anulado') continue;

    const fechaMov = mov.fecha.toDate();
    const mesKey = _getMesKey(fechaMov);

    if (!stats.historicoPorMes[mesKey]) {
      stats.historicoPorMes[mesKey] = _crearEstadisticasMensualesVacias(fechaMov.getMonth() + 1, fechaMov.getFullYear());
    }

    const mes = stats.historicoPorMes[mesKey];
    const esIngreso = esMovimientoIngreso(mov.tipo, mov);
    const esEgreso = esMovimientoEgreso(mov.tipo, mov);

    if (esIngreso) {
      if (mov.moneda === 'USD') {
        mes.ingresosUSD += mov.monto;
        stats.acumuladoAnio.ingresosUSD += mov.monto;
      } else {
        mes.ingresosPEN += mov.monto;
        stats.acumuladoAnio.ingresosPEN += mov.monto;
      }
      mes.cantidadIngresos++;
    }

    if (esEgreso) {
      if (mov.moneda === 'USD') {
        mes.egresosUSD += mov.monto;
        stats.acumuladoAnio.egresosUSD += mov.monto;
      } else {
        mes.egresosPEN += mov.monto;
        stats.acumuladoAnio.egresosPEN += mov.monto;
      }
      mes.cantidadEgresos++;
    }

    if (mov.tipoCambio > 0) {
      mes.sumaTipoCambio += mov.tipoCambio;
      mes.cantidadOperacionesTC++;
    }

    stats.acumuladoAnio.cantidadOperaciones++;
  }

  // Procesar conversiones
  for (const conv of conversiones) {
    const fechaConv = conv.fecha.toDate();
    const mesKey = _getMesKey(fechaConv);

    if (!stats.historicoPorMes[mesKey]) {
      stats.historicoPorMes[mesKey] = _crearEstadisticasMensualesVacias(fechaConv.getMonth() + 1, fechaConv.getFullYear());
    }

    const mes = stats.historicoPorMes[mesKey];

    if (conv.monedaOrigen === 'USD') {
      mes.conversionesUSDaPEN += conv.montoOrigen;
    } else {
      mes.conversionesPENaUSD += conv.montoDestino;
    }

    mes.cantidadConversiones++;
    mes.spreadAcumulado += conv.spreadCambiario;
    mes.diferenciaConversiones += conv.diferenciaVsReferencia;
    mes.diferenciaNetaMes = mes.diferenciaOrdenesCompra + mes.diferenciaVentas + mes.diferenciaConversiones;

    stats.acumuladoAnio.diferenciaNetaAnio += conv.diferenciaVsReferencia;
  }

  // Actualizar mes actual
  const mesKeyActual = _getMesKey();
  if (stats.historicoPorMes[mesKeyActual]) {
    stats.mesActual = stats.historicoPorMes[mesKeyActual];
  }

  stats.ultimaActualizacion = Timestamp.now();
  stats.actualizadoPor = userId;

  await updateDoc(docRef, stats as any);

  const tiempoMs = Date.now() - inicio;
  logger.success(`Estadísticas recalculadas en ${tiempoMs}ms`);

  return {
    mensaje: `Recálculo completo: ${movimientos.length} movimientos, ${conversiones.length} conversiones procesados`,
    tiempoMs
  };
}

// ─── Quick-read stats ─────────────────────────────────────────────────────────

/**
 * Obtener estadísticas generales de tesorería (OPTIMIZADO)
 * Lee directamente del documento materializado
 */
export async function getStats(
  getCuentasFn: () => Promise<CuentaCaja[]>,
  getMovimientosFn: (filtros?: any) => Promise<MovimientoTesoreria[]>,
  getConversionesFn: (filtros?: any) => Promise<ConversionCambiaria[]>
): Promise<TesoreriaStats> {
  // Siempre calcular saldos reales desde las cuentas (evita desync con doc materializado)
  const cuentas = await getCuentasFn();
  let saldoTotalUSD = 0;
  let saldoTotalPEN = 0;

  cuentas.filter(c => c.activa).forEach(c => {
    if (c.esBiMoneda) {
      saldoTotalUSD += c.saldoUSD || 0;
      saldoTotalPEN += c.saldoPEN || 0;
    } else {
      if (c.moneda === 'USD') {
        saldoTotalUSD += c.saldoActual;
      } else {
        saldoTotalPEN += c.saldoActual;
      }
    }
  });

  const tcActual = await tipoCambioService.resolverTCVenta();
  const saldoTotalEquivalentePEN = saldoTotalPEN + (saldoTotalUSD * tcActual);

  // Siempre calcular ingresos/egresos mensuales en tiempo real (evita desync con doc materializado)
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const movimientosMes = await getMovimientosFn({
    fechaInicio: inicioMes,
    fechaFin: ahora
  });

  const ingresosMes = movimientosMes.filter(m => m.estado !== 'anulado' && esMovimientoIngreso(m.tipo, m));
  const egresosMes = movimientosMes.filter(m => m.estado !== 'anulado' && esMovimientoEgreso(m.tipo, m));

  const ingresosMesUSD = ingresosMes.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
  const ingresosMesPEN = ingresosMes.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);
  const egresosMesUSD = egresosMes.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
  const egresosMesPEN = egresosMes.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);

  // Conversiones y métricas secundarias desde doc materializado o cálculo directo
  const conversionesMes = await getConversionesFn({
    fechaInicio: inicioMes,
    fechaFin: ahora
  });
  const montoConvertidoMes = conversionesMes.reduce((sum, c) => sum + c.montoOrigen, 0);
  const spreadPromedioMes = conversionesMes.length > 0
    ? conversionesMes.reduce((sum, c) => sum + c.spreadCambiario, 0) / conversionesMes.length
    : 0;

  const movimientosConTC = movimientosMes.filter(m => m.tipoCambio > 0 && m.estado !== 'anulado');
  const tcPromedioMes = movimientosConTC.length > 0
    ? movimientosConTC.reduce((sum, m) => sum + m.tipoCambio, 0) / movimientosConTC.length
    : tcActual;

  const diferenciaConversiones = conversionesMes.reduce((sum, c) => sum + c.diferenciaVsReferencia, 0);

  // Intentar leer diferencia acumulada del año desde doc materializado
  let diferenciaAcumuladaAnio = diferenciaConversiones;
  try {
    const statsAgregadas = await getEstadisticasAgregadas();
    if (statsAgregadas) {
      diferenciaAcumuladaAnio = statsAgregadas.acumuladoAnio.diferenciaNetaAnio;
    }
  } catch (e) {
    // Use monthly as fallback
  }

  return {
    saldoTotalUSD,
    saldoTotalPEN,
    saldoTotalEquivalentePEN,
    ingresosMesUSD,
    ingresosMesPEN,
    egresosMesUSD,
    egresosMesPEN,
    conversionesMes: conversionesMes.length,
    montoConvertidoMes,
    spreadPromedioMes,
    tcPromedioMes,
    diferenciaNetaMes: diferenciaConversiones,
    diferenciaAcumuladaAnio,
    pagosPendientesUSD: 0,
    pagosPendientesPEN: 0,
    porCobrarPEN: 0
  };
}

/**
 * Cálculo de estadísticas en tiempo real (fallback)
 * Solo se usa si no existen estadísticas materializadas
 */
export async function _calcularStatsEnTiempoReal(
  getCuentasFn: () => Promise<CuentaCaja[]>,
  getMovimientosFn: (filtros?: any) => Promise<MovimientoTesoreria[]>,
  getConversionesFn: (filtros?: any) => Promise<ConversionCambiaria[]>
): Promise<TesoreriaStats> {
  const cuentas = await getCuentasFn();
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  let saldoTotalUSD = 0;
  let saldoTotalPEN = 0;

  cuentas.filter(c => c.activa).forEach(c => {
    if (c.esBiMoneda) {
      saldoTotalUSD += c.saldoUSD || 0;
      saldoTotalPEN += c.saldoPEN || 0;
    } else {
      if (c.moneda === 'USD') {
        saldoTotalUSD += c.saldoActual;
      } else {
        saldoTotalPEN += c.saldoActual;
      }
    }
  });

  const tcActual = await tipoCambioService.resolverTCVenta();
  const saldoTotalEquivalentePEN = saldoTotalPEN + (saldoTotalUSD * tcActual);

  const movimientosMes = await getMovimientosFn({
    fechaInicio: inicioMes,
    fechaFin: ahora
  });

  const ingresosMes = movimientosMes.filter(m => esMovimientoIngreso(m.tipo, m));
  const egresosMes = movimientosMes.filter(m => esMovimientoEgreso(m.tipo, m));

  const ingresosMesUSD = ingresosMes.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
  const ingresosMesPEN = ingresosMes.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);
  const egresosMesUSD = egresosMes.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
  const egresosMesPEN = egresosMes.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);

  const conversionesMes = await getConversionesFn({
    fechaInicio: inicioMes,
    fechaFin: ahora
  });

  const montoConvertidoMes = conversionesMes.reduce((sum, c) => sum + c.montoOrigen, 0);
  const spreadPromedioMes = conversionesMes.length > 0
    ? conversionesMes.reduce((sum, c) => sum + c.spreadCambiario, 0) / conversionesMes.length
    : 0;

  const movimientosConTC = movimientosMes.filter(m => m.tipoCambio > 0 && m.estado !== 'anulado');
  const tcPromedioMes = movimientosConTC.length > 0
    ? movimientosConTC.reduce((sum, m) => sum + m.tipoCambio, 0) / movimientosConTC.length
    : tcActual;

  // Solo calcular diferencia del mes actual (no todo el año)
  const diferenciaConversiones = conversionesMes.reduce((sum, c) => sum + c.diferenciaVsReferencia, 0);

  return {
    saldoTotalUSD,
    saldoTotalPEN,
    saldoTotalEquivalentePEN,
    ingresosMesUSD,
    ingresosMesPEN,
    egresosMesUSD,
    egresosMesPEN,
    conversionesMes: conversionesMes.length,
    montoConvertidoMes,
    spreadPromedioMes,
    tcPromedioMes,
    diferenciaNetaMes: diferenciaConversiones,
    diferenciaAcumuladaAnio: diferenciaConversiones, // Solo mes actual como fallback
    pagosPendientesUSD: 0,
    pagosPendientesPEN: 0,
    porCobrarPEN: 0
  };
}

// ─── Cash-flow report ─────────────────────────────────────────────────────────

/**
 * Obtener flujo de caja mensual
 */
export async function getFlujoCajaMensual(
  mes: number,
  anio: number,
  getMovimientosFn: (filtros?: any) => Promise<MovimientoTesoreria[]>,
  getConversionesFn: (filtros?: any) => Promise<ConversionCambiaria[]>,
  getCuentasFn: () => Promise<CuentaCaja[]>,
  calcularDiferenciaCambiarieFn: (mes: number, anio: number) => Promise<DiferenciaCambiariaPeriodo>
): Promise<FlujoCajaMensual> {
  const inicioMes = new Date(anio, mes - 1, 1);
  const finMes = new Date(anio, mes, 0, 23, 59, 59);

  // Obtener movimientos del mes
  const movimientos = await getMovimientosFn({
    fechaInicio: inicioMes,
    fechaFin: finMes
  });

  // Obtener conversiones del mes
  const conversiones = await getConversionesFn({
    fechaInicio: inicioMes,
    fechaFin: finMes
  });

  // Clasificar movimientos usando helpers centralizados
  const ingresos = movimientos.filter(m => esMovimientoIngreso(m.tipo, m));
  const egresos = movimientos.filter(m => esMovimientoEgreso(m.tipo, m));

  const ingresosUSD = ingresos.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
  const ingresosPEN = ingresos.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);
  const egresosUSD = egresos.filter(m => m.moneda === 'USD').reduce((sum, m) => sum + m.monto, 0);
  const egresosPEN = egresos.filter(m => m.moneda === 'PEN').reduce((sum, m) => sum + m.monto, 0);

  // Conversiones
  const convUSDaPEN = conversiones.filter(c => c.monedaOrigen === 'USD').reduce((sum, c) => sum + c.montoOrigen, 0);
  const convPENaUSD = conversiones.filter(c => c.monedaOrigen === 'PEN').reduce((sum, c) => sum + c.montoDestino, 0);

  // Diferencia cambiaria
  const diferencia = await calcularDiferenciaCambiarieFn(mes, anio);

  // TC promedio del mes (si no hay movimientos, usar TC actual)
  const tcPromedio = movimientos.length > 0
    ? movimientos.reduce((sum, m) => sum + m.tipoCambio, 0) / movimientos.length
    : await tipoCambioService.resolverTCVenta();

  // Calcular saldo inicial del mes (saldo final del mes anterior)
  // Obtenemos movimientos hasta el inicio del mes actual
  const movimientosAnteriores = await getMovimientosFn({
    fechaFin: new Date(inicioMes.getTime() - 1) // Hasta un ms antes del inicio del mes
  });

  // Obtener saldos iniciales de las cuentas
  const cuentas = await getCuentasFn();
  let saldoBaseUSD = 0;
  let saldoBasePEN = 0;

  cuentas.filter(c => c.activa).forEach(c => {
    if (c.esBiMoneda) {
      saldoBaseUSD += c.saldoUSD || 0;
      saldoBasePEN += c.saldoPEN || 0;
    } else {
      if (c.moneda === 'USD') {
        saldoBaseUSD += c.saldoActual || 0;
      } else {
        saldoBasePEN += c.saldoActual || 0;
      }
    }
  });

  // Calcular saldo al inicio del mes (saldo base + movimientos anteriores)
  let saldoInicialUSD = saldoBaseUSD;
  let saldoInicialPEN = saldoBasePEN;

  for (const mov of movimientosAnteriores) {
    // Usar el helper para determinar si es ingreso basándose en el tipo y contexto
    const esIngreso = esMovimientoIngreso(mov.tipo, mov);
    if (mov.moneda === 'USD') {
      saldoInicialUSD += esIngreso ? mov.monto : -mov.monto;
    } else {
      saldoInicialPEN += esIngreso ? mov.monto : -mov.monto;
    }
  }

  // Calcular saldo final del mes
  const saldoFinalUSD = saldoInicialUSD + ingresosUSD - egresosUSD - convUSDaPEN + convPENaUSD;
  const saldoFinalPEN = saldoInicialPEN + ingresosPEN - egresosPEN + (convUSDaPEN * tcPromedio) - (convPENaUSD / tcPromedio);

  return {
    mes,
    anio,
    saldoInicialUSD,
    saldoInicialPEN,
    ingresosUSD,
    ingresosPEN,
    egresosUSD,
    egresosPEN,
    totalConvertidoUSDaPEN: convUSDaPEN,
    totalConvertidoPENaUSD: convPENaUSD,
    diferenciaNetaMes: diferencia.diferenciaNetoMes,
    saldoFinalUSD,
    saldoFinalPEN,
    tcPromedioMes: tcPromedio
  };
}
