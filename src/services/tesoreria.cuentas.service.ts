/**
 * tesoreria.cuentas.service.ts
 * Account (CuentaCaja) management: CRUD, balance updates, and recalculation.
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
  Timestamp,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import {
  CUENTAS_COLLECTION,
  MOVIMIENTOS_COLLECTION,
  esMovimientoIngreso,
  esMovimientoEgreso
} from './tesoreria.shared';
import type {
  CuentaCaja,
  CuentaCajaFormData,
  MovimientoTesoreria,
  MonedaTesoreria,
  MetodoTesoreria
} from '../types/tesoreria.types';

/**
 * Crear cuenta de caja
 * Soporta cuentas mono-moneda y bi-moneda
 */
export async function crearCuenta(data: CuentaCajaFormData, userId: string): Promise<string> {
  // Validar campo obligatorio
  if (!data.titular?.trim()) {
    throw new Error('El titular de la cuenta es obligatorio');
  }

  const esBiMoneda = data.esBiMoneda || false;

  // Filtrar campos undefined para evitar errores de Firebase
  const cuenta: Record<string, any> = {
    nombre: data.nombre,
    titular: data.titular.trim(),
    tipo: data.tipo,
    esBiMoneda,
    moneda: data.moneda,
    activa: true,
    creadoPor: userId,
    fechaCreacion: Timestamp.now()
  };

  // Configurar saldos según tipo de cuenta
  if (esBiMoneda) {
    // Cuenta bi-moneda: saldos separados para USD y PEN
    cuenta.saldoUSD = data.saldoInicialUSD || 0;
    cuenta.saldoPEN = data.saldoInicialPEN || 0;
    cuenta.saldoActual = 0; // No se usa en bi-moneda, pero mantenemos compatibilidad

    // Saldos mínimos bi-moneda
    if (data.saldoMinimoUSD !== undefined && data.saldoMinimoUSD !== null) {
      cuenta.saldoMinimoUSD = data.saldoMinimoUSD;
    }
    if (data.saldoMinimoPEN !== undefined && data.saldoMinimoPEN !== null) {
      cuenta.saldoMinimoPEN = data.saldoMinimoPEN;
    }
  } else {
    // Cuenta mono-moneda
    cuenta.saldoActual = data.saldoInicial || 0;
    if (data.saldoMinimo !== undefined && data.saldoMinimo !== null) {
      cuenta.saldoMinimo = data.saldoMinimo;
    }
  }

  // Campos opcionales
  if (data.banco) {
    cuenta.banco = data.banco;
  }
  if (data.numeroCuenta) {
    cuenta.numeroCuenta = data.numeroCuenta;
  }
  if (data.cci) {
    cuenta.cci = data.cci;
  }
  if (data.metodoPagoAsociado) {
    cuenta.metodoPagoAsociado = data.metodoPagoAsociado;
  }
  if (data.esCuentaPorDefecto !== undefined) {
    cuenta.esCuentaPorDefecto = data.esCuentaPorDefecto;
  }

  const docRef = await addDoc(collection(db, CUENTAS_COLLECTION), cuenta);
  return docRef.id;
}

/**
 * Actualizar cuenta de caja
 * Soporta actualización de cuentas mono-moneda y bi-moneda
 */
export async function actualizarCuenta(
  id: string,
  data: Partial<Omit<CuentaCajaFormData, 'saldoInicial' | 'saldoInicialUSD' | 'saldoInicialPEN'>>,
  userId: string
): Promise<void> {
  // Validar campo obligatorio si se está actualizando
  if (data.titular !== undefined && !data.titular?.trim()) {
    throw new Error('El titular de la cuenta es obligatorio');
  }

  const updates: Record<string, any> = {
    actualizadoPor: userId,
    fechaActualizacion: Timestamp.now()
  };

  // Campos básicos
  if (data.nombre !== undefined) updates.nombre = data.nombre;
  if (data.titular !== undefined) updates.titular = data.titular.trim();
  if (data.tipo !== undefined) updates.tipo = data.tipo;
  if (data.moneda !== undefined) updates.moneda = data.moneda;
  if (data.esBiMoneda !== undefined) updates.esBiMoneda = data.esBiMoneda;

  // Saldos mínimos mono-moneda
  if (data.saldoMinimo !== undefined) updates.saldoMinimo = data.saldoMinimo;

  // Saldos mínimos bi-moneda
  if (data.saldoMinimoUSD !== undefined) updates.saldoMinimoUSD = data.saldoMinimoUSD;
  if (data.saldoMinimoPEN !== undefined) updates.saldoMinimoPEN = data.saldoMinimoPEN;

  // Datos bancarios
  if (data.banco !== undefined) updates.banco = data.banco;
  if (data.numeroCuenta !== undefined) updates.numeroCuenta = data.numeroCuenta;
  if (data.cci !== undefined) updates.cci = data.cci;
  if (data.metodoPagoAsociado !== undefined) updates.metodoPagoAsociado = data.metodoPagoAsociado;
  if (data.esCuentaPorDefecto !== undefined) updates.esCuentaPorDefecto = data.esCuentaPorDefecto;

  await updateDoc(doc(db, CUENTAS_COLLECTION, id), updates);
}

/**
 * Activar/Desactivar cuenta
 */
export async function toggleActivaCuenta(id: string, activa: boolean, userId: string): Promise<void> {
  await updateDoc(doc(db, CUENTAS_COLLECTION, id), {
    activa,
    actualizadoPor: userId,
    fechaActualizacion: Timestamp.now()
  });
}

/**
 * Crear cuentas por defecto asociadas a métodos de pago
 * Esta función se ejecuta una sola vez para inicializar el sistema
 */
export async function crearCuentasPorDefecto(
  userId: string,
  getCuentasFn: () => Promise<CuentaCaja[]>,
  crearCuentaFn: (data: CuentaCajaFormData, userId: string) => Promise<string>
): Promise<void> {
  const cuentasExistentes = await getCuentasFn();

  // Si ya hay cuentas, no crear las por defecto
  if (cuentasExistentes.length > 0) {
    logger.info('Ya existen cuentas, omitiendo creación de cuentas por defecto');
    return;
  }

  const cuentasPorDefecto: CuentaCajaFormData[] = [
    {
      nombre: 'Caja Efectivo',
      titular: 'Empresa',
      tipo: 'efectivo' as const,
      moneda: 'PEN' as const,
      esBiMoneda: false,
      saldoInicial: 0,
      metodoPagoAsociado: 'efectivo' as const,
      esCuentaPorDefecto: true
    },
    {
      nombre: 'Cuenta BCP',
      titular: 'Empresa',
      tipo: 'banco' as const,
      moneda: 'PEN' as const,
      esBiMoneda: false,
      saldoInicial: 0,
      banco: 'BCP',
      metodoPagoAsociado: 'transferencia_bancaria' as const,
      esCuentaPorDefecto: true
    },
    {
      nombre: 'Cuenta Interbank',
      titular: 'Empresa',
      tipo: 'banco' as const,
      moneda: 'PEN' as const,
      esBiMoneda: false,
      saldoInicial: 0,
      banco: 'Interbank',
      metodoPagoAsociado: 'transferencia_bancaria' as const,
      esCuentaPorDefecto: false
    },
    {
      nombre: 'Yape',
      titular: 'Empresa',
      tipo: 'digital' as const,
      moneda: 'PEN' as const,
      esBiMoneda: false,
      saldoInicial: 0,
      metodoPagoAsociado: 'yape' as const,
      esCuentaPorDefecto: true
    },
    {
      nombre: 'Plin',
      titular: 'Empresa',
      tipo: 'digital' as const,
      moneda: 'PEN' as const,
      esBiMoneda: false,
      saldoInicial: 0,
      metodoPagoAsociado: 'plin' as const,
      esCuentaPorDefecto: true
    },
    {
      nombre: 'Mercado Pago',
      titular: 'Empresa',
      tipo: 'digital' as const,
      moneda: 'PEN' as const,
      esBiMoneda: false,
      saldoInicial: 0,
      metodoPagoAsociado: 'mercado_pago' as const,
      esCuentaPorDefecto: true
    },
    {
      nombre: 'Tarjeta (POS)',
      titular: 'Empresa',
      tipo: 'digital' as const,
      moneda: 'PEN' as const,
      esBiMoneda: false,
      saldoInicial: 0,
      metodoPagoAsociado: 'tarjeta' as const,
      esCuentaPorDefecto: true
    },
    {
      nombre: 'Cuenta USD',
      titular: 'Empresa',
      tipo: 'banco' as const,
      moneda: 'USD' as const,
      esBiMoneda: false,
      saldoInicial: 0,
      banco: 'BCP',
      metodoPagoAsociado: 'transferencia_bancaria' as const,
      esCuentaPorDefecto: false
    }
  ];

  for (const cuenta of cuentasPorDefecto) {
    await crearCuentaFn(cuenta, userId);
  }

  logger.success('Cuentas por defecto creadas exitosamente');
}

/**
 * Obtener cuenta por defecto según método de pago
 */
export async function getCuentaPorMetodoPago(
  metodo: MetodoTesoreria,
  moneda: MonedaTesoreria = 'PEN',
  getCuentasFn: () => Promise<CuentaCaja[]>
): Promise<CuentaCaja | null> {
  const cuentas = await getCuentasFn();

  // Helper para verificar si la cuenta acepta la moneda
  const aceptaMoneda = (c: CuentaCaja): boolean => {
    // Cuentas bi-moneda aceptan ambas monedas
    if (c.esBiMoneda) return true;
    // Cuentas mono-moneda solo aceptan su moneda configurada
    return c.moneda === moneda;
  };

  // Primero buscar cuenta por defecto para ese método
  let cuenta = cuentas.find(
    c => c.metodoPagoAsociado === metodo &&
         c.esCuentaPorDefecto === true &&
         aceptaMoneda(c) &&
         c.activa
  );

  // Si no hay cuenta por defecto, buscar cualquier cuenta activa con ese método
  if (!cuenta) {
    cuenta = cuentas.find(
      c => c.metodoPagoAsociado === metodo &&
           aceptaMoneda(c) &&
           c.activa
    );
  }

  // Si aún no hay, buscar cualquier cuenta activa que acepte esa moneda
  if (!cuenta) {
    cuenta = cuentas.find(
      c => aceptaMoneda(c) && c.activa
    );
  }

  return cuenta || null;
}

/**
 * Obtener cuentas activas por moneda
 * Las cuentas bi-moneda aparecen para ambas monedas (USD y PEN)
 */
export async function getCuentasActivas(
  moneda?: MonedaTesoreria,
  getCuentasFn?: () => Promise<CuentaCaja[]>
): Promise<CuentaCaja[]> {
  const cuentas = await (getCuentasFn ? getCuentasFn() : getCuentas());
  return cuentas.filter(c => {
    if (!c.activa) return false;
    if (!moneda) return true;

    // Cuentas bi-moneda aplican para ambas monedas
    if (c.esBiMoneda) return true;

    // Cuentas mono-moneda solo para su moneda
    return c.moneda === moneda;
  });
}

/**
 * Obtener todas las cuentas
 */
export async function getCuentas(): Promise<CuentaCaja[]> {
  const snapshot = await getDocs(collection(db, CUENTAS_COLLECTION));
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  } as CuentaCaja));
}

/**
 * Obtener cuenta por ID
 */
export async function getCuentaById(id: string): Promise<CuentaCaja | null> {
  const docRef = doc(db, CUENTAS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data()
  } as CuentaCaja;
}

/**
 * Actualizar saldo de cuenta
 * Para cuentas bi-moneda, requiere especificar la moneda del movimiento
 */
export async function actualizarSaldoCuenta(
  cuentaId: string,
  diferencia: number,
  monedaMovimiento?: MonedaTesoreria
): Promise<void> {
  const cuenta = await getCuentaById(cuentaId);
  if (!cuenta) {
    throw new Error('Cuenta no encontrada');
  }

  const updates: Record<string, any> = {
    fechaActualizacion: serverTimestamp()
  };

  if (cuenta.esBiMoneda) {
    // Cuenta bi-moneda: actualizar el saldo de la moneda correspondiente
    if (!monedaMovimiento) {
      throw new Error('Para cuentas bi-moneda se debe especificar la moneda del movimiento');
    }

    if (monedaMovimiento === 'USD') {
      updates.saldoUSD = increment(diferencia);
    } else {
      updates.saldoPEN = increment(diferencia);
    }
  } else {
    // Cuenta mono-moneda: actualizar saldoActual con increment atómico
    updates.saldoActual = increment(diferencia);
  }

  await updateDoc(doc(db, CUENTAS_COLLECTION, cuentaId), updates);
}

/**
 * Recalcular saldo de una cuenta basándose en los movimientos existentes
 * Útil para corregir inconsistencias en los saldos
 */
export async function recalcularSaldoCuenta(
  cuentaId: string
): Promise<{ saldoAnterior: number; saldoNuevo: number; movimientos: number }> {
  const cuenta = await getCuentaById(cuentaId);
  if (!cuenta) {
    throw new Error('Cuenta no encontrada');
  }

  // Obtener movimientos donde esta cuenta es ORIGEN (query directa, no cargar todo)
  const qOrigen = query(
    collection(db, MOVIMIENTOS_COLLECTION),
    where('cuentaOrigen', '==', cuentaId)
  );
  const qDestino = query(
    collection(db, MOVIMIENTOS_COLLECTION),
    where('cuentaDestino', '==', cuentaId)
  );

  const [snapOrigen, snapDestino] = await Promise.all([
    getDocs(qOrigen),
    getDocs(qDestino)
  ]);

  // Combinar movimientos sin duplicados (un movimiento puede tener la misma cuenta como origen y destino)
  const movsMap = new Map<string, { data: MovimientoTesoreria; esOrigen: boolean; esDestino: boolean }>();

  for (const d of snapOrigen.docs) {
    movsMap.set(d.id, {
      data: { id: d.id, ...d.data() } as MovimientoTesoreria,
      esOrigen: true,
      esDestino: false
    });
  }
  for (const d of snapDestino.docs) {
    if (movsMap.has(d.id)) {
      movsMap.get(d.id)!.esDestino = true;
    } else {
      movsMap.set(d.id, {
        data: { id: d.id, ...d.data() } as MovimientoTesoreria,
        esOrigen: false,
        esDestino: true
      });
    }
  }

  // Calcular saldos basándose en movimientos ACTIVOS (excluir anulados)
  let saldoPEN = 0;
  let saldoUSD = 0;
  let movimientosContados = 0;

  for (const [, { data: mov, esOrigen, esDestino }] of movsMap) {
    // FILTRAR ANULADOS — este era el bug principal
    if (mov.estado === 'anulado') continue;

    movimientosContados++;

    const esIngreso = esMovimientoIngreso(mov.tipo, mov);
    const esEgreso = esMovimientoEgreso(mov.tipo, mov);

    let diferencia = 0;
    if (esDestino && esIngreso) {
      // Dinero que entra a esta cuenta
      diferencia = mov.monto;
    } else if (esOrigen && esEgreso) {
      // Dinero que sale de esta cuenta
      diferencia = -mov.monto;
    } else if (esDestino) {
      // Para movimientos que llegan a destino (transferencias, etc.), sumar
      diferencia = mov.monto;
    } else if (esOrigen) {
      // Para movimientos que salen de origen (transferencias, etc.), restar
      diferencia = -mov.monto;
    }

    if (mov.moneda === 'USD') {
      saldoUSD += diferencia;
    } else {
      saldoPEN += diferencia;
    }
  }

  // Guardar saldo anterior para el reporte
  const saldoAnterior = cuenta.esBiMoneda
    ? (cuenta.saldoPEN || 0)
    : cuenta.saldoActual;

  // Actualizar la cuenta con los saldos calculados
  const updates: Record<string, any> = {
    fechaActualizacion: serverTimestamp()
  };

  if (cuenta.esBiMoneda) {
    updates.saldoUSD = saldoUSD;
    updates.saldoPEN = saldoPEN;
  } else {
    updates.saldoActual = cuenta.moneda === 'USD' ? saldoUSD : saldoPEN;
  }

  await updateDoc(doc(db, CUENTAS_COLLECTION, cuentaId), updates);

  return {
    saldoAnterior,
    saldoNuevo: cuenta.esBiMoneda ? saldoPEN : (cuenta.moneda === 'USD' ? saldoUSD : saldoPEN),
    movimientos: movimientosContados
  };
}

/**
 * Recalcular saldos de todas las cuentas
 */
export async function recalcularTodosLosSaldos(): Promise<{ cuentasActualizadas: number; errores: string[] }> {
  const cuentas = await getCuentas();
  const errores: string[] = [];
  let cuentasActualizadas = 0;

  for (const cuenta of cuentas) {
    try {
      await recalcularSaldoCuenta(cuenta.id);
      cuentasActualizadas++;
    } catch (error) {
      errores.push(`${cuenta.nombre}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  return { cuentasActualizadas, errores };
}
