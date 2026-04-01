/**
 * tesoreria.conversiones.service.ts
 * Currency conversion (ConversionCambiaria) operations.
 */
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { db } from '../lib/firebase';
import { logger, logBackgroundError } from '../lib/logger';
import { tipoCambioService } from './tipoCambio.service';
import {
  CONVERSIONES_COLLECTION,
  MOVIMIENTOS_COLLECTION
} from './tesoreria.shared';
import type {
  ConversionCambiaria,
  ConversionCambiariaFormData,
  ConversionCambiariaFiltros,
  TipoMovimientoTesoreria,
  MonedaTesoreria
} from '../types/tesoreria.types';
import { actividadService } from './actividad.service';

/**
 * Generar número de conversión
 */
export async function generateNumeroConversion(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`CONV-${year}`, 4);
}

/**
 * Registrar una conversión cambiaria
 * Ahora vinculada a cuentas de tesorería y registra movimientos
 *
 * generateNumeroMovimiento, actualizarSaldoCuenta and
 * actualizarEstadisticasPorConversion are received as callbacks to avoid
 * circular module dependencies.
 */
export async function registrarConversion(
  data: ConversionCambiariaFormData,
  userId: string,
  generateNumeroMovimientoFn: () => Promise<string>,
  actualizarSaldoCuenta: (cuentaId: string, diferencia: number, moneda?: MonedaTesoreria) => Promise<void>,
  actualizarEstadisticasPorConversion: (conv: any) => Promise<void>
): Promise<string> {
  const numeroConversion = await generateNumeroConversion();

  // Obtener TC de referencia del día
  let tipoCambioReferencia = data.tipoCambio;
  try {
    const tcDelDia = await tipoCambioService.getTCDelDia();
    if (tcDelDia) {
      tipoCambioReferencia = data.monedaOrigen === 'USD' ? tcDelDia.venta : tcDelDia.compra;
    }
  } catch (e) {
    logger.warn('No se pudo obtener TC de referencia');
  }

  // Calcular monto destino
  const montoDestino = data.monedaOrigen === 'USD'
    ? data.montoOrigen * data.tipoCambio
    : data.montoOrigen / data.tipoCambio;

  const monedaDestino: MonedaTesoreria = data.monedaOrigen === 'USD' ? 'PEN' : 'USD';

  // Calcular spread (diferencia vs TC referencia)
  const spreadCambiario = ((data.tipoCambio - tipoCambioReferencia) / tipoCambioReferencia) * 100;

  // Calcular diferencia vs referencia (pérdida/ganancia)
  const diferenciaVsReferencia = data.monedaOrigen === 'USD'
    ? (data.tipoCambio - tipoCambioReferencia) * data.montoOrigen
    : (tipoCambioReferencia - data.tipoCambio) * montoDestino;

  // Construir objeto de conversión (sin campos undefined para Firestore)
  const conversion: Record<string, any> = {
    numeroConversion,
    monedaOrigen: data.monedaOrigen,
    monedaDestino,
    montoOrigen: data.montoOrigen,
    montoDestino,
    tipoCambio: data.tipoCambio,
    tipoCambioReferencia,
    spreadCambiario,
    diferenciaVsReferencia,
    fecha: Timestamp.fromDate(data.fecha),
    creadoPor: userId,
    fechaCreacion: Timestamp.now()
  };

  // Agregar campos opcionales solo si tienen valor
  if (data.entidadCambio) conversion.entidadCambio = data.entidadCambio;
  if (data.motivo) conversion.motivo = data.motivo;
  if (data.notas) conversion.notas = data.notas;
  if (data.cuentaOrigenId) conversion.cuentaOrigenId = data.cuentaOrigenId;
  if (data.cuentaDestinoId) conversion.cuentaDestinoId = data.cuentaDestinoId;

  // Validar cuentas ANTES de escribir en Firestore (previene docs huérfanos)
  if (data.cuentaOrigenId) {
    const { getCuentaById } = await import('./tesoreria.cuentas.service');
    const ctaOrigen = await getCuentaById(data.cuentaOrigenId);
    if (!ctaOrigen) throw new Error('Cuenta de origen no encontrada');
    if (!ctaOrigen.activa) throw new Error('La cuenta de origen está inactiva');
    const saldoDisponible = ctaOrigen.esBiMoneda
      ? (data.monedaOrigen === 'USD' ? (ctaOrigen.saldoUSD || 0) : (ctaOrigen.saldoPEN || 0))
      : (ctaOrigen.saldoActual || 0);
    if (saldoDisponible < data.montoOrigen) {
      throw new Error(`Saldo insuficiente en ${ctaOrigen.nombre}. Disponible: ${saldoDisponible.toFixed(2)} ${data.monedaOrigen}`);
    }
  }
  if (data.cuentaDestinoId) {
    const { getCuentaById } = await import('./tesoreria.cuentas.service');
    const ctaDestino = await getCuentaById(data.cuentaDestinoId);
    if (!ctaDestino) throw new Error('Cuenta de destino no encontrada');
    if (!ctaDestino.activa) throw new Error('La cuenta de destino está inactiva');
  }

  const docRef = await addDoc(collection(db, CONVERSIONES_COLLECTION), conversion);
  const conversionId = docRef.id;

  // Si se especificaron cuentas, actualizar saldos y registrar movimientos
  if (data.cuentaOrigenId || data.cuentaDestinoId) {
    const tipoMovimiento: TipoMovimientoTesoreria = data.monedaOrigen === 'USD'
      ? 'conversion_usd_pen'
      : 'conversion_pen_usd';

    const conceptoConversion = `Conversión ${numeroConversion}: ${data.monedaOrigen} ${data.montoOrigen.toFixed(2)} → ${monedaDestino} ${montoDestino.toFixed(2)} (TC: ${data.tipoCambio.toFixed(3)})`;

    // Registrar movimiento de salida (moneda origen)
    if (data.cuentaOrigenId) {
      const movSalida: Record<string, any> = {
        numeroMovimiento: await generateNumeroMovimientoFn(),
        tipo: tipoMovimiento,
        estado: 'ejecutado',
        moneda: data.monedaOrigen,
        monto: data.montoOrigen,
        tipoCambio: data.tipoCambio,
        montoEquivalentePEN: data.monedaOrigen === 'PEN' ? data.montoOrigen : data.montoOrigen * data.tipoCambio,
        montoEquivalenteUSD: data.monedaOrigen === 'USD' ? data.montoOrigen : data.montoOrigen / data.tipoCambio,
        metodo: 'conversion',
        concepto: conceptoConversion,
        cuentaOrigen: data.cuentaOrigenId,
        fecha: Timestamp.fromDate(data.fecha),
        creadoPor: userId,
        fechaCreacion: Timestamp.now(),
        conversionId // Vincular al registro de conversión
      };

      await addDoc(collection(db, MOVIMIENTOS_COLLECTION), movSalida);

      // Actualizar saldo de cuenta origen (resta)
      await actualizarSaldoCuenta(data.cuentaOrigenId, -data.montoOrigen, data.monedaOrigen);
    }

    // Registrar movimiento de entrada (moneda destino)
    if (data.cuentaDestinoId) {
      const movEntrada: Record<string, any> = {
        numeroMovimiento: await generateNumeroMovimientoFn(),
        tipo: tipoMovimiento,
        estado: 'ejecutado',
        moneda: monedaDestino,
        monto: montoDestino,
        tipoCambio: data.tipoCambio,
        montoEquivalentePEN: monedaDestino === 'PEN' ? montoDestino : montoDestino * data.tipoCambio,
        montoEquivalenteUSD: monedaDestino === 'USD' ? montoDestino : montoDestino / data.tipoCambio,
        metodo: 'conversion',
        concepto: conceptoConversion,
        cuentaDestino: data.cuentaDestinoId,
        fecha: Timestamp.fromDate(data.fecha),
        creadoPor: userId,
        fechaCreacion: Timestamp.now(),
        conversionId // Vincular al registro de conversión
      };

      await addDoc(collection(db, MOVIMIENTOS_COLLECTION), movEntrada);

      // Actualizar saldo de cuenta destino (suma)
      await actualizarSaldoCuenta(data.cuentaDestinoId, montoDestino, monedaDestino);
    }
  }

  // Actualizar estadísticas agregadas con la conversión
  await actualizarEstadisticasPorConversion({
    monedaOrigen: data.monedaOrigen,
    montoOrigen: data.montoOrigen,
    montoDestino,
    tipoCambio: data.tipoCambio,
    spreadCambiario,
    diferenciaVsReferencia
  }).catch(err => logger.warn('Error actualizando estadísticas por conversión:', err));

  // Registrar movimiento en Pool USD (fire-and-forget)
  import('../services/poolUSD.service').then(({ poolUSDService }) => {
    poolUSDService.registrarDesdeConversion(
      conversionId,
      numeroConversion,
      data.monedaOrigen as 'USD' | 'PEN',
      monedaDestino as 'USD' | 'PEN',
      data.montoOrigen,
      montoDestino,
      data.tipoCambio,
      data.fecha,
      userId
    ).catch(err => {
      logger.warn('[PoolUSD] Error registrando movimiento desde conversión:', err);
      logBackgroundError('poolUSD.conversion', err, 'critical', { conversionId, numeroConversion });
    });
  }).catch(() => {});

  // Broadcast actividad (fire-and-forget)
  actividadService.registrar({
    tipo: 'conversion_registrada',
    mensaje: `Conversión ${numeroConversion}: ${data.monedaOrigen} ${data.montoOrigen.toFixed(2)} → ${monedaDestino} ${montoDestino.toFixed(2)} (TC: ${data.tipoCambio.toFixed(3)})`,
    userId,
    displayName: userId,
    metadata: { entidadId: conversionId, entidadTipo: 'conversion', monto: data.montoOrigen, moneda: data.monedaOrigen }
  }).catch(() => {});

  return conversionId;
}

/**
 * Obtener conversiones con filtros
 */
export async function getConversiones(filtros?: ConversionCambiariaFiltros): Promise<ConversionCambiaria[]> {
  let q = query(
    collection(db, CONVERSIONES_COLLECTION),
    orderBy('fecha', 'desc')
  );

  if (filtros?.monedaOrigen) {
    q = query(q, where('monedaOrigen', '==', filtros.monedaOrigen));
  }
  if (filtros?.entidadCambio) {
    q = query(q, where('entidadCambio', '==', filtros.entidadCambio));
  }

  const snapshot = await getDocs(q);
  let conversiones = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  } as ConversionCambiaria));

  // Filtros de fecha en memoria
  if (filtros?.fechaInicio) {
    const desde = Timestamp.fromDate(filtros.fechaInicio);
    conversiones = conversiones.filter(c => c.fecha.seconds >= desde.seconds);
  }
  if (filtros?.fechaFin) {
    const hasta = Timestamp.fromDate(filtros.fechaFin);
    conversiones = conversiones.filter(c => c.fecha.seconds <= hasta.seconds);
  }

  return conversiones;
}
