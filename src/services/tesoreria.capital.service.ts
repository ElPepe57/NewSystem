/**
 * tesoreria.capital.service.ts
 * Inter-account transfers and partner capital contributions/withdrawals.
 */
import {
  collection,
  addDoc,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import { requiereAutorizacionSocio } from './autorizacionEgreso.helper';
import { registrarRetiroCashTesoreriaFn } from './retiroCash.client';
import type { RetiroCapitalDoc } from './egresosPendientesSocio.helper';
import type {
  CuentaCaja,
  TransferenciaEntreCuentasFormData,
  AporteCapitalFormData,
  RetiroCapitalFormData,
  TipoMovimientoTesoreria,
  MonedaTesoreria,
  MetodoTesoreria
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
  // F3.5 Fase B · el cash (los 2 movimientos + los 2 saldos) lo escribe la CF registrarMovimientoTesoreriaCash
  // (admin SDK · única escritora del saldo) · una llamada por pata: SALIDA desde la cuenta origen (resta) +
  // ENTRADA hacia la cuenta destino (suma). El cliente ya no hace batch + actualizarSaldoCuenta directo.
  void generateNumeroMovimientoFn; void actualizarSaldoCuentaFn; // la CF los hace · compat del facade
  const { registrarMovimientoTesoreriaCashFn } = await import('./movimientoTesoreriaCash.client');
  const salida = await registrarMovimientoTesoreriaCashFn({
    tipo: 'transferencia_interna' as TipoMovimientoTesoreria,
    moneda: data.moneda, monto: data.monto, tipoCambio: data.tipoCambio,
    metodo: 'transferencia_interna' as MetodoTesoreria, concepto: `[SALIDA] ${concepto}`,
    fecha: data.fecha, cuentaOrigen: data.cuentaOrigenId,
    ...(data.notas ? { notas: data.notas } : {}),
  });
  const entrada = await registrarMovimientoTesoreriaCashFn({
    tipo: 'transferencia_interna' as TipoMovimientoTesoreria,
    moneda: data.moneda, monto: data.monto, tipoCambio: data.tipoCambio,
    metodo: 'transferencia_interna' as MetodoTesoreria, concepto: `[ENTRADA] ${concepto}`,
    fecha: data.fecha, cuentaDestino: data.cuentaDestinoId,
    ...(data.notas ? { notas: data.notas } : {}),
  });

  logger.success(`Transferencia completada: ${data.monto} ${data.moneda} de ${cuentaOrigen.nombre} a ${cuentaDestino.nombre}`);

  return {
    movimientoSalidaId: salida.movimientoId,
    movimientoEntradaId: entrada.movimientoId
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

  const concepto = data.concepto || `Aporte de capital - ${data.socioNombre}`;
  const montoEquivalentePEN = data.moneda === 'USD' ? data.monto * data.tipoCambio : data.monto;

  // F3.5 Fase B · el cash (movimiento + saldo · suma a la cuenta destino) lo escribe la CF
  // registrarMovimientoTesoreriaCash (admin SDK · única escritora del saldo). El cliente ya no hace addDoc +
  // actualizarSaldoCuenta directo. El doc de aportesCapital (contabilidad) se mantiene abajo.
  void actualizarSaldoCuentaFn; void generateNumeroMovimientoFn; // la CF los hace · compat del facade
  const { registrarMovimientoTesoreriaCashFn } = await import('./movimientoTesoreriaCash.client');
  const { movimientoId, numeroMovimiento } = await registrarMovimientoTesoreriaCashFn({
    tipo: 'aporte_capital' as TipoMovimientoTesoreria,
    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    metodo: data.metodo,
    concepto,
    fecha: data.fecha,
    cuentaDestino: data.cuentaDestinoId,
    ...(data.referencia ? { referencia: data.referencia } : {}),
    ...(data.notas ? { notas: data.notas } : {}),
  });

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
    movimientoId,
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

  return movimientoId;
}

/**
 * Registrar retiro de capital/utilidades por un socio
 * DISMINUYE el patrimonio y el efectivo
 */
export async function registrarRetiroCapital(
  data: RetiroCapitalFormData,
  userId: string,
  getCuentaByIdFn: (id: string) => Promise<CuentaCaja | null>
): Promise<{ retiroId: string; requiereAutorizacion: boolean }> {
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

  const tipoRetiroLabel = data.tipoRetiro === 'utilidades' ? 'utilidades' :
                         data.tipoRetiro === 'capital' ? 'capital' : 'préstamo a socio';
  const concepto = data.concepto || `Retiro de ${tipoRetiroLabel} - ${data.socioNombre}`;

  // Calcular equivalentes
  const montoEquivalentePEN = data.moneda === 'USD' ? data.monto * data.tipoCambio : data.monto;
  const montoEquivalenteUSD = data.moneda === 'USD' ? data.monto : data.monto / data.tipoCambio;

  // F3c · el cliente ya NO mueve el cash del retiro · lo hace la CF registrarRetiroCashTesoreria (única
  // escritora · las rules bloquean el create de movimientosTesoreria tipo:'retiro_socio'). El service crea
  // el doc retirosCapital y delega el cash: ≤$1k directo (la CF lo mueve ya) · >$1k queda PENDIENTE de
  // quórum de socios (aparece en la bandeja · la CF mueve el cash recién tras la aprobación).
  const requiereAutorizacion = requiereAutorizacionSocio(montoEquivalenteUSD);

  const retiroDoc: Record<string, any> = {
    estado: 'pendiente',
    monto: data.monto,
    moneda: data.moneda,
    tipoCambio: data.tipoCambio,
    montoEquivalentePEN,
    montoEquivalenteUSD,
    cuentaOrigenId: data.cuentaOrigenId,
    metodo: data.metodo,
    concepto,
    fecha: Timestamp.fromDate(data.fecha),
    socioNombre: data.socioNombre,
    tipoRetiro: data.tipoRetiro,
    creadoPor: userId,
    fechaCreacion: Timestamp.now()
  };
  if (data.socioId) retiroDoc.socioId = data.socioId;
  if (data.referencia) retiroDoc.referencia = data.referencia;
  if (data.notas) retiroDoc.notas = data.notas;
  if (requiereAutorizacion) {
    // nace pendiente de firma · la CF de aprobación (autorizarEgreso · colección retirosCapital) la completa.
    retiroDoc.autorizacion = { estado: 'pendiente', firmas: [], solicitadaPor: userId };
  }

  const retiroRef = await addDoc(collection(db, COLLECTIONS.RETIROS_CAPITAL), retiroDoc);

  if (requiereAutorizacion) {
    logger.info(`Retiro de ${tipoRetiroLabel} >$1k · pendiente de aprobación de socios: ${data.monto} ${data.moneda} por ${data.socioNombre}`);
    return { retiroId: retiroRef.id, requiereAutorizacion: true };
  }

  // ≤$1k · directo: la CF mueve el cash ahora (mismo backstop que F3a · única escritora).
  await registrarRetiroCashTesoreriaFn(retiroRef.id);
  logger.success(`Retiro de ${tipoRetiroLabel} registrado: ${data.monto} ${data.moneda} por ${data.socioNombre}`);
  return { retiroId: retiroRef.id, requiereAutorizacion: false };
}

/**
 * F3c · lista los retiros de capital como docs individuales (la bandeja de socio los agrega como 4ª
 * fuente). inversionista.service solo AGREGA por socio · esto trae los docs con su autorización/estado.
 */
export async function getAllRetirosCapital(): Promise<RetiroCapitalDoc[]> {
  const snap = await getDocs(collection(db, COLLECTIONS.RETIROS_CAPITAL));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RetiroCapitalDoc, 'id'>) }));
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
