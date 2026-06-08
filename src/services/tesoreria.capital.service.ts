/**
 * tesoreria.capital.service.ts
 * Inter-account transfers and partner capital contributions/withdrawals.
 */
import {
  collection,
  addDoc,
  getDocs,
  doc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import { MOVIMIENTOS_COLLECTION } from './tesoreria.shared';
import type {
  CuentaCaja,
  TransferenciaEntreCuentasFormData,
  AporteCapitalFormData,
  RetiroCapitalFormData,
  TipoMovimientoTesoreria,
  MonedaTesoreria
} from '../types/tesoreria.types';

/**
 * Transferir fondos entre cuentas propias
 * NO afecta el patrimonio, solo redistribuye efectivo
 * Genera 2 movimientos: salida de origen + entrada en destino
 */
export async function transferirEntreCuentas(
  data: TransferenciaEntreCuentasFormData,
  userId: string,
  getCuentaByIdFn: (id: string) => Promise<CuentaCaja | null>,
  generateNumeroMovimientoFn: () => Promise<string>,
  actualizarSaldoCuentaFn: (cuentaId: string, diferencia: number, moneda?: MonedaTesoreria) => Promise<void>
): Promise<{ movimientoSalidaId: string; movimientoEntradaId: string }> {
  // Validaciones
  if (data.cuentaOrigenId === data.cuentaDestinoId) {
    throw new Error('La cuenta de origen y destino no pueden ser la misma');
  }
  if (data.monto <= 0) {
    throw new Error('El monto debe ser mayor a 0');
  }

  const cuentaOrigen = await getCuentaByIdFn(data.cuentaOrigenId);
  const cuentaDestino = await getCuentaByIdFn(data.cuentaDestinoId);

  if (!cuentaOrigen) throw new Error('Cuenta de origen no encontrada');
  if (!cuentaDestino) throw new Error('Cuenta de destino no encontrada');
  if (!cuentaOrigen.activa) throw new Error('La cuenta de origen está inactiva');
  if (!cuentaDestino.activa) throw new Error('La cuenta de destino está inactiva');

  // Verificar saldo suficiente
  const saldoDisponible = cuentaOrigen.esBiMoneda
    ? (data.moneda === 'USD' ? cuentaOrigen.saldoUSD || 0 : cuentaOrigen.saldoPEN || 0)
    : cuentaOrigen.saldoActual;

  if (saldoDisponible < data.monto) {
    throw new Error(`Saldo insuficiente. Disponible: ${saldoDisponible.toFixed(2)} ${data.moneda}`);
  }

  // Verificar saldo mínimo post-transferencia
  const saldoPost = saldoDisponible - data.monto;
  if (cuentaOrigen.esBiMoneda) {
    const min = data.moneda === 'USD' ? cuentaOrigen.saldoMinimoUSD : cuentaOrigen.saldoMinimoPEN;
    if (min !== undefined && saldoPost < min) {
      throw new Error(`La transferencia dejaría el saldo (${saldoPost.toFixed(2)}) por debajo del mínimo (${min.toFixed(2)} ${data.moneda})`);
    }
  } else if (cuentaOrigen.saldoMinimo !== undefined && saldoPost < cuentaOrigen.saldoMinimo) {
    throw new Error(`La transferencia dejaría el saldo (${saldoPost.toFixed(2)}) por debajo del mínimo (${cuentaOrigen.saldoMinimo.toFixed(2)} ${data.moneda})`);
  }

  const concepto = data.concepto || `Transferencia de ${cuentaOrigen.nombre} a ${cuentaDestino.nombre}`;
  const numeroSalida = await generateNumeroMovimientoFn();
  const numeroEntrada = await generateNumeroMovimientoFn();

  // Calcular equivalentes
  const montoEquivalentePEN = data.moneda === 'USD' ? data.monto * data.tipoCambio : data.monto;
  const montoEquivalenteUSD = data.moneda === 'USD' ? data.monto : data.monto / data.tipoCambio;

  // Movimiento de SALIDA (desde cuenta origen)
  const movimientoSalida: Record<string, any> = {
    numeroMovimiento: numeroSalida,
    tipo: 'transferencia_interna',
    estado: 'ejecutado',
    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    montoEquivalentePEN,
    montoEquivalenteUSD,
    metodo: 'transferencia_interna',
    concepto: `[SALIDA] ${concepto}`,
    cuentaOrigen: data.cuentaOrigenId,
    fecha: Timestamp.fromDate(data.fecha),
    creadoPor: userId,
    fechaCreacion: Timestamp.now()
  };
  if (data.notas) movimientoSalida.notas = data.notas;

  // Movimiento de ENTRADA (hacia cuenta destino)
  const movimientoEntrada: Record<string, any> = {
    numeroMovimiento: numeroEntrada,
    tipo: 'transferencia_interna',
    estado: 'ejecutado',
    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    montoEquivalentePEN,
    montoEquivalenteUSD,
    metodo: 'transferencia_interna',
    concepto: `[ENTRADA] ${concepto}`,
    cuentaDestino: data.cuentaDestinoId,
    fecha: Timestamp.fromDate(data.fecha),
    creadoPor: userId,
    fechaCreacion: Timestamp.now()
  };
  if (data.notas) movimientoEntrada.notas = data.notas;

  // Ejecutar en batch
  const batch = writeBatch(db);

  const salidaRef = doc(collection(db, MOVIMIENTOS_COLLECTION));
  const entradaRef = doc(collection(db, MOVIMIENTOS_COLLECTION));

  batch.set(salidaRef, movimientoSalida);
  batch.set(entradaRef, movimientoEntrada);

  await batch.commit();

  // Actualizar saldos de cuentas
  await actualizarSaldoCuentaFn(data.cuentaOrigenId, -data.monto, data.moneda);
  await actualizarSaldoCuentaFn(data.cuentaDestinoId, data.monto, data.moneda);

  logger.success(`Transferencia completada: ${data.monto} ${data.moneda} de ${cuentaOrigen.nombre} a ${cuentaDestino.nombre}`);

  return {
    movimientoSalidaId: salidaRef.id,
    movimientoEntradaId: entradaRef.id
  };
}

/**
 * Registrar aporte/inyección de capital por un socio
 * AUMENTA el patrimonio y el efectivo
 * Se registra en la colección de aportes para tracking contable
 */
export async function registrarAporteCapital(
  data: AporteCapitalFormData,
  userId: string,
  getCuentaByIdFn: (id: string) => Promise<CuentaCaja | null>,
  generateNumeroMovimientoFn: () => Promise<string>,
  actualizarSaldoCuentaFn: (cuentaId: string, diferencia: number, moneda?: MonedaTesoreria) => Promise<void>,
  actualizarEstadisticasPorMovimientoFn: (mov: any, esAnulacion?: boolean) => Promise<void>
): Promise<string> {
  if (data.monto <= 0) {
    throw new Error('El monto debe ser mayor a 0');
  }

  const cuentaDestino = await getCuentaByIdFn(data.cuentaDestinoId);
  if (!cuentaDestino) throw new Error('Cuenta de destino no encontrada');
  if (!cuentaDestino.activa) throw new Error('La cuenta de destino está inactiva');

  const numeroMovimiento = await generateNumeroMovimientoFn();
  const concepto = data.concepto || `Aporte de capital - ${data.socioNombre}`;

  // Calcular equivalentes
  const montoEquivalentePEN = data.moneda === 'USD' ? data.monto * data.tipoCambio : data.monto;
  const montoEquivalenteUSD = data.moneda === 'USD' ? data.monto : data.monto / data.tipoCambio;

  // Crear movimiento de tesorería
  const movimiento: Record<string, any> = {
    numeroMovimiento,
    tipo: 'aporte_capital' as TipoMovimientoTesoreria,
    estado: 'ejecutado',
    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    montoEquivalentePEN,
    montoEquivalenteUSD,
    metodo: data.metodo,
    concepto,
    cuentaDestino: data.cuentaDestinoId,
    fecha: Timestamp.fromDate(data.fecha),
    creadoPor: userId,
    fechaCreacion: Timestamp.now(),
    // Metadata específica de aporte
    socioNombre: data.socioNombre,
    esAporteCapital: true
  };
  if (data.socioId) movimiento.socioId = data.socioId;
  if (data.referencia) movimiento.referencia = data.referencia;
  if (data.notas) movimiento.notas = data.notas;

  const docRef = await addDoc(collection(db, MOVIMIENTOS_COLLECTION), movimiento);

  // Actualizar saldo de cuenta destino
  await actualizarSaldoCuentaFn(data.cuentaDestinoId, data.monto, data.moneda);

  // Actualizar estadísticas
  await actualizarEstadisticasPorMovimientoFn({
    tipo: 'aporte_capital',
    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    cuentaDestino: data.cuentaDestinoId
  }).catch(err => logger.warn('Error actualizando estadísticas:', err));

  // Registrar también en colección de aportes para contabilidad
  await addDoc(collection(db, COLLECTIONS.APORTES_CAPITAL), {
    movimientoId: docRef.id,
    numeroMovimiento,
    socioNombre: data.socioNombre,
    socioId: data.socioId || null,
    monto: data.monto,
    moneda: data.moneda,
    montoEquivalentePEN,
    tipoCambio: data.tipoCambio,
    fecha: Timestamp.fromDate(data.fecha),
    creadoPor: userId,
    fechaCreacion: Timestamp.now()
  });

  logger.success(`Aporte de capital registrado: ${data.monto} ${data.moneda} por ${data.socioNombre}`);

  return docRef.id;
}

/**
 * Registrar retiro de capital/utilidades por un socio
 * DISMINUYE el patrimonio y el efectivo
 */
export async function registrarRetiroCapital(
  data: RetiroCapitalFormData,
  userId: string,
  getCuentaByIdFn: (id: string) => Promise<CuentaCaja | null>,
  generateNumeroMovimientoFn: () => Promise<string>,
  actualizarSaldoCuentaFn: (cuentaId: string, diferencia: number, moneda?: MonedaTesoreria) => Promise<void>,
  actualizarEstadisticasPorMovimientoFn: (mov: any, esAnulacion?: boolean) => Promise<void>
): Promise<string> {
  if (data.monto <= 0) {
    throw new Error('El monto debe ser mayor a 0');
  }

  const cuentaOrigen = await getCuentaByIdFn(data.cuentaOrigenId);
  if (!cuentaOrigen) throw new Error('Cuenta de origen no encontrada');
  if (!cuentaOrigen.activa) throw new Error('La cuenta de origen está inactiva');

  // Verificar saldo
  const saldoDisponible = cuentaOrigen.esBiMoneda
    ? (data.moneda === 'USD' ? cuentaOrigen.saldoUSD || 0 : cuentaOrigen.saldoPEN || 0)
    : cuentaOrigen.saldoActual;

  if (saldoDisponible < data.monto) {
    throw new Error(`Saldo insuficiente. Disponible: ${saldoDisponible.toFixed(2)} ${data.moneda}`);
  }

  const numeroMovimiento = await generateNumeroMovimientoFn();
  const tipoRetiroLabel = data.tipoRetiro === 'utilidades' ? 'utilidades' :
                         data.tipoRetiro === 'capital' ? 'capital' : 'préstamo a socio';
  const concepto = data.concepto || `Retiro de ${tipoRetiroLabel} - ${data.socioNombre}`;

  // Calcular equivalentes
  const montoEquivalentePEN = data.moneda === 'USD' ? data.monto * data.tipoCambio : data.monto;
  const montoEquivalenteUSD = data.moneda === 'USD' ? data.monto : data.monto / data.tipoCambio;

  // Crear movimiento de tesorería
  const movimiento: Record<string, any> = {
    numeroMovimiento,
    tipo: 'retiro_socio' as TipoMovimientoTesoreria,
    estado: 'ejecutado',
    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    montoEquivalentePEN,
    montoEquivalenteUSD,
    metodo: data.metodo,
    concepto,
    cuentaOrigen: data.cuentaOrigenId,
    fecha: Timestamp.fromDate(data.fecha),
    creadoPor: userId,
    fechaCreacion: Timestamp.now(),
    // Metadata específica de retiro
    socioNombre: data.socioNombre,
    tipoRetiro: data.tipoRetiro,
    esRetiroCapital: true
  };
  if (data.socioId) movimiento.socioId = data.socioId;
  if (data.referencia) movimiento.referencia = data.referencia;
  if (data.notas) movimiento.notas = data.notas;

  const docRef = await addDoc(collection(db, MOVIMIENTOS_COLLECTION), movimiento);

  // Actualizar saldo de cuenta origen (resta)
  await actualizarSaldoCuentaFn(data.cuentaOrigenId, -data.monto, data.moneda);

  // Actualizar estadísticas
  await actualizarEstadisticasPorMovimientoFn({
    tipo: 'retiro_socio',
    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    cuentaOrigen: data.cuentaOrigenId
  }).catch(err => logger.warn('Error actualizando estadísticas:', err));

  // Registrar también en colección de retiros para contabilidad
  await addDoc(collection(db, COLLECTIONS.RETIROS_CAPITAL), {
    movimientoId: docRef.id,
    numeroMovimiento,
    socioNombre: data.socioNombre,
    socioId: data.socioId || null,
    tipoRetiro: data.tipoRetiro,
    monto: data.monto,
    moneda: data.moneda,
    montoEquivalentePEN,
    tipoCambio: data.tipoCambio,
    fecha: Timestamp.fromDate(data.fecha),
    creadoPor: userId,
    fechaCreacion: Timestamp.now()
  });

  logger.success(`Retiro de ${tipoRetiroLabel} registrado: ${data.monto} ${data.moneda} por ${data.socioNombre}`);

  return docRef.id;
}

/**
 * Obtener total de aportes de capital (para contabilidad)
 * Suma todos los aportes registrados
 */
export async function getTotalAportesCapital(): Promise<{ totalPEN: number; totalUSD: number; cantidad: number }> {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.APORTES_CAPITAL));

    let totalPEN = 0;
    let totalUSD = 0;
    let cantidad = 0;

    snapshot.forEach(d => {
      const aporte = d.data();
      if (aporte.moneda === 'USD') {
        totalUSD += aporte.monto || 0;
      }
      totalPEN += aporte.montoEquivalentePEN || 0;
      cantidad++;
    });

    return { totalPEN, totalUSD, cantidad };
  } catch (error) {
    logger.warn('Error obteniendo total de aportes:', error);
    return { totalPEN: 0, totalUSD: 0, cantidad: 0 };
  }
}

/**
 * Obtener total de retiros de capital (para contabilidad)
 */
export async function getTotalRetirosCapital(): Promise<{ totalPEN: number; totalUSD: number; cantidad: number; porTipo: Record<string, number> }> {
  try {
    const snapshot = await getDocs(collection(db, COLLECTIONS.RETIROS_CAPITAL));

    let totalPEN = 0;
    let totalUSD = 0;
    let cantidad = 0;
    const porTipo: Record<string, number> = {
      utilidades: 0,
      capital: 0,
      prestamo: 0
    };

    snapshot.forEach(d => {
      const retiro = d.data();
      if (retiro.moneda === 'USD') {
        totalUSD += retiro.monto || 0;
      }
      totalPEN += retiro.montoEquivalentePEN || 0;
      cantidad++;

      if (retiro.tipoRetiro && porTipo[retiro.tipoRetiro] !== undefined) {
        porTipo[retiro.tipoRetiro] += retiro.montoEquivalentePEN || 0;
      }
    });

    return { totalPEN, totalUSD, cantidad, porTipo };
  } catch (error) {
    logger.warn('Error obteniendo total de retiros:', error);
    return { totalPEN: 0, totalUSD: 0, cantidad: 0, porTipo: { utilidades: 0, capital: 0, prestamo: 0 } };
  }
}
