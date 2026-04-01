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
  deleteDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
  increment,
  writeBatch
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
  MetodoTesoreria,
  NumeroCuentaBancaria
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
  if (data.banco) cuenta.banco = data.banco;
  if (data.bancoNombreCompleto) cuenta.bancoNombreCompleto = data.bancoNombreCompleto;
  if (data.numeroCuenta) cuenta.numeroCuenta = data.numeroCuenta;
  if (data.cci) cuenta.cci = data.cci;
  if (data.metodoPagoAsociado) cuenta.metodoPagoAsociado = data.metodoPagoAsociado;
  if (data.esCuentaPorDefecto !== undefined) cuenta.esCuentaPorDefecto = data.esCuentaPorDefecto;

  // Producto financiero y métodos
  if (data.productoFinanciero) cuenta.productoFinanciero = data.productoFinanciero;
  if (data.titularidad) cuenta.titularidad = data.titularidad;
  if (data.metodosDisponibles?.length) cuenta.metodosDisponibles = data.metodosDisponibles;
  if (data.metodosDetalle) cuenta.metodosDetalle = data.metodosDetalle;
  if (data.cuentaVinculadaId) cuenta.cuentaVinculadaId = data.cuentaVinculadaId;

  // Línea de crédito
  if (data.lineaCreditoLimite) {
    cuenta.lineaCredito = {
      limiteTotal: data.lineaCreditoLimite,
      utilizado: 0,
      disponible: data.lineaCreditoLimite,
      tasaInteres: data.lineaCreditoTasa || 0,
      fechaCorte: data.lineaCreditoFechaCorte || 0,
      fechaPago: data.lineaCreditoFechaPago || 0,
    };
  }

  // Números de cuenta (array múltiple)
  if (data.numerosCuenta?.length) {
    cuenta.numerosCuenta = data.numerosCuenta;
    // Sync campos legacy desde el array
    const principal = data.numerosCuenta.find(n => n.esPrincipal);
    const primerNumero = principal || data.numerosCuenta[0];
    if (primerNumero) cuenta.numeroCuenta = primerNumero.numero;
    const cciEntry = data.numerosCuenta.find(n => n.tipo === 'cci');
    if (cciEntry) cuenta.cci = cciEntry.numero;
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
  if (data.bancoNombreCompleto !== undefined) updates.bancoNombreCompleto = data.bancoNombreCompleto;
  if (data.numeroCuenta !== undefined) updates.numeroCuenta = data.numeroCuenta;
  if (data.cci !== undefined) updates.cci = data.cci;
  if (data.metodoPagoAsociado !== undefined) updates.metodoPagoAsociado = data.metodoPagoAsociado;
  if (data.esCuentaPorDefecto !== undefined) updates.esCuentaPorDefecto = data.esCuentaPorDefecto;

  // Producto financiero y métodos (fix: antes no se persistían)
  if (data.productoFinanciero !== undefined) updates.productoFinanciero = data.productoFinanciero;
  if (data.titularidad !== undefined) updates.titularidad = data.titularidad;
  if (data.metodosDisponibles !== undefined) updates.metodosDisponibles = data.metodosDisponibles;
  if (data.metodosDetalle !== undefined) updates.metodosDetalle = data.metodosDetalle;
  if (data.cuentaVinculadaId !== undefined) updates.cuentaVinculadaId = data.cuentaVinculadaId;

  // Línea de crédito
  if (data.lineaCreditoLimite !== undefined) {
    updates.lineaCredito = {
      limiteTotal: data.lineaCreditoLimite || 0,
      utilizado: 0, // Se preserva el existente abajo
      disponible: data.lineaCreditoLimite || 0,
      tasaInteres: data.lineaCreditoTasa || 0,
      fechaCorte: data.lineaCreditoFechaCorte || 0,
      fechaPago: data.lineaCreditoFechaPago || 0,
    };
    // Preservar utilizado existente si hay
    const existing = await getCuentaById(id);
    if (existing?.lineaCredito?.utilizado) {
      updates.lineaCredito.utilizado = existing.lineaCredito.utilizado;
      updates.lineaCredito.disponible = (data.lineaCreditoLimite || 0) - existing.lineaCredito.utilizado;
    }
  }

  // Números de cuenta (array múltiple)
  if (data.numerosCuenta !== undefined) {
    updates.numerosCuenta = data.numerosCuenta;
    // Sync campos legacy desde el array
    const principal = data.numerosCuenta.find(n => n.esPrincipal);
    const primerNumero = principal || data.numerosCuenta[0];
    if (primerNumero) {
      updates.numeroCuenta = primerNumero.numero;
    }
    const cciEntry = data.numerosCuenta.find(n => n.tipo === 'cci');
    if (cciEntry) {
      updates.cci = cciEntry.numero;
    }
  }

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
 * Verificar si una cuenta tiene saldo pendiente
 */
export function cuentaTieneSaldo(cuenta: CuentaCaja): { tieneSaldo: boolean; detalle: string } {
  if (cuenta.esBiMoneda) {
    const pen = cuenta.saldoPEN || 0;
    const usd = cuenta.saldoUSD || 0;
    if (Math.abs(pen) > 0.01 || Math.abs(usd) > 0.01) {
      return {
        tieneSaldo: true,
        detalle: `S/ ${pen.toFixed(2)} / $ ${usd.toFixed(2)}`
      };
    }
  } else {
    const saldo = cuenta.saldoActual || 0;
    if (Math.abs(saldo) > 0.01) {
      const simbolo = cuenta.moneda === 'USD' ? '$' : 'S/';
      return { tieneSaldo: true, detalle: `${simbolo} ${saldo.toFixed(2)}` };
    }
  }
  return { tieneSaldo: false, detalle: '' };
}

/**
 * Verificar si una cuenta tiene movimientos asociados
 */
export async function cuentaTieneMovimientos(cuentaId: string): Promise<number> {
  const qOrigen = query(
    collection(db, MOVIMIENTOS_COLLECTION),
    where('cuentaOrigen', '==', cuentaId)
  );
  const qDestino = query(
    collection(db, MOVIMIENTOS_COLLECTION),
    where('cuentaDestino', '==', cuentaId)
  );
  const [snapO, snapD] = await Promise.all([getDocs(qOrigen), getDocs(qDestino)]);
  const ids = new Set([...snapO.docs.map(d => d.id), ...snapD.docs.map(d => d.id)]);
  return ids.size;
}

/**
 * Eliminar cuenta permanentemente
 * Requiere saldo en cero. Si tiene movimientos, se advierte pero se permite.
 */
export async function eliminarCuenta(id: string): Promise<void> {
  const cuenta = await getCuentaById(id);
  if (!cuenta) throw new Error('Cuenta no encontrada');

  const { tieneSaldo, detalle } = cuentaTieneSaldo(cuenta);
  if (tieneSaldo) {
    throw new Error(`No se puede eliminar: la cuenta tiene saldo pendiente (${detalle}). Transfiera los fondos primero.`);
  }

  await deleteDoc(doc(db, CUENTAS_COLLECTION, id));
  logger.info(`Cuenta eliminada: ${cuenta.nombre} (${id})`);
}

/**
 * Sincronizar métodos de pago para todas las cuentas de un banco
 * Propaga metodosDisponibles a todas las CuentaCaja que comparten el mismo banco
 */
export async function syncMetodosBanco(
  bancoNombre: string,
  metodos: string[],
  userId: string,
  metodosDetalle?: Record<string, { identificador?: string; cuentaVinculadaId?: string }>
): Promise<number> {
  const q = query(
    collection(db, CUENTAS_COLLECTION),
    where('banco', '==', bancoNombre)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  const now = Timestamp.now();

  for (const d of snapshot.docs) {
    const updates: Record<string, any> = {
      metodosDisponibles: metodos,
      actualizadoPor: userId,
      fechaActualizacion: now,
    };
    if (metodosDetalle) updates.metodosDetalle = metodosDetalle;
    batch.update(d.ref, updates);
  }

  await batch.commit();
  logger.info(`Métodos sincronizados para ${snapshot.size} cuentas de ${bancoNombre}`);
  return snapshot.size;
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
 * Normalizar cuenta legacy: construir numerosCuenta[] desde campos string
 */
function normalizarCuenta(cuenta: CuentaCaja): CuentaCaja {
  if (cuenta.numerosCuenta?.length) return cuenta;

  const numeros: NumeroCuentaBancaria[] = [];
  if (cuenta.numeroCuenta) {
    const tipo = cuenta.productoFinanciero === 'cuenta_corriente' ? 'corriente' : 'ahorros';
    numeros.push({
      id: 'legacy-principal',
      tipo: tipo as NumeroCuentaBancaria['tipo'],
      numero: cuenta.numeroCuenta,
      esPrincipal: true,
    });
  }
  if (cuenta.cci) {
    numeros.push({
      id: 'legacy-cci',
      tipo: 'cci',
      numero: cuenta.cci,
      esPrincipal: false,
    });
  }
  if (numeros.length) {
    cuenta.numerosCuenta = numeros;
  }
  return cuenta;
}

/**
 * Obtener todas las cuentas
 */
export async function getCuentas(): Promise<CuentaCaja[]> {
  const snapshot = await getDocs(collection(db, CUENTAS_COLLECTION));
  return snapshot.docs.map(d => normalizarCuenta({
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

  return normalizarCuenta({
    id: docSnap.id,
    ...docSnap.data()
  } as CuentaCaja);
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
