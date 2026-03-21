/**
 * tesoreria.movimientos.service.ts
 * CRUD and query operations for MovimientoTesoreria documents.
 * Depends on tesoreria.cuentas.service for account balance updates and
 * tesoreria.stats.service for materialized statistics updates.
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
  Timestamp
} from 'firebase/firestore';
import { getNextSequenceNumber } from '../lib/sequenceGenerator';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger, logBackgroundError } from '../lib/logger';
import {
  MOVIMIENTOS_COLLECTION,
  esMovimientoIngreso,
  esMovimientoEgreso
} from './tesoreria.shared';
import type {
  MovimientoTesoreria,
  MovimientoTesoreriaFormData,
  MovimientoTesoreriaFiltros
} from '../types/tesoreria.types';
import { actividadService } from './actividad.service';

// ─── Forward references to avoid circular imports ────────────────────────────
// These are resolved at runtime via dynamic import or passed as parameters.
// Methods that need cuentas/stats call back to the main tesoreriaService facade.

/**
 * Generar número de movimiento
 */
export async function generateNumeroMovimiento(): Promise<string> {
  const year = new Date().getFullYear();
  return getNextSequenceNumber(`MOV-${year}`, 4);
}

/**
 * Registrar un movimiento de tesorería
 *
 * actualizarSaldoCuenta and actualizarEstadisticasPorMovimiento are received
 * as callbacks to avoid circular module dependencies.
 */
export async function registrarMovimiento(
  data: MovimientoTesoreriaFormData,
  userId: string,
  actualizarSaldoCuenta: (cuentaId: string, diferencia: number, moneda?: any) => Promise<void>,
  actualizarEstadisticasPorMovimiento: (mov: any, esAnulacion?: boolean) => Promise<void>
): Promise<string> {
  const numeroMovimiento = await generateNumeroMovimiento();

  // Calcular equivalentes
  let montoEquivalentePEN = data.monto;
  let montoEquivalenteUSD = data.monto;

  if (data.moneda === 'USD') {
    montoEquivalentePEN = data.monto * data.tipoCambio;
    montoEquivalenteUSD = data.monto;
  } else {
    montoEquivalentePEN = data.monto;
    montoEquivalenteUSD = data.monto / data.tipoCambio;
  }

  // Construir objeto base (solo campos requeridos)
  const movimiento: Record<string, any> = {
    numeroMovimiento,
    tipo: data.tipo,
    estado: 'ejecutado',
    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    montoEquivalentePEN,
    montoEquivalenteUSD,
    metodo: data.metodo,
    concepto: data.concepto,
    fecha: Timestamp.fromDate(data.fecha),
    creadoPor: userId,
    fechaCreacion: Timestamp.now()
  };

  // Agregar campos opcionales solo si tienen valor (Firebase no acepta undefined)
  if (data.referencia) movimiento.referencia = data.referencia;
  if (data.notas) movimiento.notas = data.notas;
  if (data.ordenCompraId) movimiento.ordenCompraId = data.ordenCompraId;
  if (data.ordenCompraNumero) movimiento.ordenCompraNumero = data.ordenCompraNumero;
  if (data.ventaId) movimiento.ventaId = data.ventaId;
  if (data.ventaNumero) movimiento.ventaNumero = data.ventaNumero;
  if (data.gastoId) movimiento.gastoId = data.gastoId;
  if (data.gastoNumero) movimiento.gastoNumero = data.gastoNumero;
  if (data.cotizacionId) movimiento.cotizacionId = data.cotizacionId;
  if (data.cotizacionNumero) movimiento.cotizacionNumero = data.cotizacionNumero;
  if (data.transferenciaId) movimiento.transferenciaId = data.transferenciaId;
  if (data.transferenciaNumero) movimiento.transferenciaNumero = data.transferenciaNumero;
  if (data.cuentaOrigen) movimiento.cuentaOrigen = data.cuentaOrigen;
  if (data.cuentaDestino) movimiento.cuentaDestino = data.cuentaDestino;

  const docRef = await addDoc(collection(db, MOVIMIENTOS_COLLECTION), movimiento);

  // Actualizar saldos de cuentas si aplica
  // Pasamos la moneda del movimiento para cuentas bi-moneda
  if (data.cuentaOrigen) {
    await actualizarSaldoCuenta(data.cuentaOrigen, -data.monto, data.moneda);
  }
  if (data.cuentaDestino) {
    await actualizarSaldoCuenta(data.cuentaDestino, data.monto, data.moneda);
  }

  // Actualizar estadísticas agregadas
  await actualizarEstadisticasPorMovimiento({
    tipo: data.tipo,
    moneda: data.moneda,
    monto: data.monto,
    tipoCambio: data.tipoCambio,
    cuentaOrigen: data.cuentaOrigen,
    cuentaDestino: data.cuentaDestino
  }).catch(err => logger.warn('Error actualizando estadísticas:', err));

  // ── Pool USD: registrar movimiento automático si es operación en USD ──
  // Mapeo: tipo tesorería → tipo pool. Conversiones se manejan en registrarConversion().
  // Transferencias internas USD↔USD no afectan el pool (solo mueven entre cuentas).
  if (data.moneda === 'USD' && !['conversion_pen_usd', 'conversion_usd_pen', 'transferencia_interna'].includes(data.tipo)) {
    const tipoPoolMap: Record<string, string> = {
      // Entradas USD
      ingreso_venta: 'COBRO_VENTA_USD',
      ingreso_anticipo: 'COBRO_VENTA_USD',
      ingreso_otro: 'AJUSTE_CONCILIACION_ENTRADA',
      aporte_capital: 'AJUSTE_CONCILIACION_ENTRADA',
      ajuste_positivo: 'AJUSTE_CONCILIACION_ENTRADA',
      // Salidas USD
      pago_orden_compra: 'PAGO_OC',
      pago_viajero: 'GASTO_IMPORTACION_USD',
      pago_proveedor_local: 'PAGO_OC',
      gasto_operativo: 'GASTO_SERVICIO_USD',
      retiro_socio: 'RETIRO_CAPITAL',
      ajuste_negativo: 'AJUSTE_CONCILIACION_SALIDA',
    };
    const tipoPool = tipoPoolMap[data.tipo];
    if (tipoPool) {
      const refNumero = data.ordenCompraNumero || data.ventaNumero || data.gastoNumero || numeroMovimiento;
      const refId = data.ordenCompraId || data.ventaId || data.gastoId || docRef.id;
      import('../services/poolUSD.service').then(({ poolUSDService }) => {
        poolUSDService.registrarMovimiento(
          {
            tipo: tipoPool as any,
            montoUSD: data.monto,
            tcOperacion: data.tipoCambio,
            fecha: data.fecha,
            documentoOrigenTipo: 'manual',
            documentoOrigenId: refId,
            documentoOrigenNumero: refNumero,
            notas: `Auto: ${data.concepto}`,
          },
          userId
        ).catch(err => {
          logger.warn('[PoolUSD] Error registrando desde movimiento tesorería:', err);
          logBackgroundError('poolUSD.movimientoTesoreria', err, 'critical', { refId, refNumero, tipoPool });
        });
      }).catch(() => {});
    }
  }

  // Broadcast actividad (fire-and-forget)
  actividadService.registrar({
    tipo: 'pago_registrado',
    mensaje: `Movimiento ${numeroMovimiento} registrado: ${data.concepto} - ${data.moneda} ${data.monto.toFixed(2)}`,
    userId,
    displayName: userId,
    metadata: { entidadId: docRef.id, entidadTipo: 'movimientoTesoreria', monto: data.monto, moneda: data.moneda }
  }).catch(() => {});

  return docRef.id;
}

/**
 * Actualizar un movimiento de tesorería existente
 * Solo para administradores
 */
export async function actualizarMovimiento(
  id: string,
  data: Partial<MovimientoTesoreriaFormData>,
  userId: string,
  getMovimientoById: (id: string) => Promise<MovimientoTesoreria | null>,
  actualizarSaldoCuenta: (cuentaId: string, diferencia: number, moneda?: any) => Promise<void>
): Promise<void> {
  // Obtener movimiento actual para calcular diferencias de saldo
  const movimientoActual = await getMovimientoById(id);
  if (!movimientoActual) {
    throw new Error('Movimiento no encontrado');
  }

  const updates: Record<string, any> = {
    actualizadoPor: userId,
    fechaActualizacion: Timestamp.now()
  };

  // Campos que se pueden actualizar
  if (data.tipo !== undefined) updates.tipo = data.tipo;
  if (data.concepto !== undefined) updates.concepto = data.concepto;
  if (data.referencia !== undefined) updates.referencia = data.referencia;
  if (data.notas !== undefined) updates.notas = data.notas;
  if (data.fecha !== undefined) updates.fecha = Timestamp.fromDate(data.fecha);

  // Si cambia el monto o el tipo de cambio, recalcular equivalentes
  if (data.monto !== undefined || data.tipoCambio !== undefined || data.moneda !== undefined) {
    const nuevoMonto = data.monto ?? movimientoActual.monto;
    const nuevoTC = data.tipoCambio ?? movimientoActual.tipoCambio;
    const nuevaMoneda = data.moneda ?? movimientoActual.moneda;

    updates.monto = nuevoMonto;
    updates.tipoCambio = nuevoTC;
    updates.moneda = nuevaMoneda;

    if (nuevaMoneda === 'USD') {
      updates.montoEquivalentePEN = nuevoMonto * nuevoTC;
      updates.montoEquivalenteUSD = nuevoMonto;
    } else {
      updates.montoEquivalentePEN = nuevoMonto;
      updates.montoEquivalenteUSD = nuevoMonto / nuevoTC;
    }

    // Calcular diferencia de saldo si hay cuenta asociada
    const diferenciaMonto = nuevoMonto - movimientoActual.monto;

    if (diferenciaMonto !== 0) {
      // Ajustar saldo de cuenta si aplica
      if (movimientoActual.cuentaOrigen) {
        const esEgreso = esMovimientoEgreso(movimientoActual.tipo, movimientoActual);
        // Si es egreso, una diferencia positiva significa más egreso (más negativo para la cuenta)
        await actualizarSaldoCuenta(
          movimientoActual.cuentaOrigen,
          esEgreso ? -diferenciaMonto : diferenciaMonto,
          nuevaMoneda
        );
      }
      if (movimientoActual.cuentaDestino) {
        const esIngreso = esMovimientoIngreso(movimientoActual.tipo, movimientoActual);
        // Si es ingreso, una diferencia positiva significa más ingreso (más positivo para la cuenta)
        await actualizarSaldoCuenta(
          movimientoActual.cuentaDestino,
          esIngreso ? diferenciaMonto : -diferenciaMonto,
          nuevaMoneda
        );
      }
    }
  }

  if (data.metodo !== undefined) updates.metodo = data.metodo;

  // Manejo de cambio de cuenta origen
  if (data.cuentaOrigen !== undefined && data.cuentaOrigen !== movimientoActual.cuentaOrigen) {
    const monedaActual = data.moneda ?? movimientoActual.moneda;
    const montoActual = data.monto ?? movimientoActual.monto;
    const esEgreso = esMovimientoEgreso(movimientoActual.tipo, movimientoActual);

    // Revertir saldo de cuenta origen anterior (si existía)
    if (movimientoActual.cuentaOrigen) {
      // Si era egreso, devolver el dinero a la cuenta anterior
      await actualizarSaldoCuenta(
        movimientoActual.cuentaOrigen,
        esEgreso ? movimientoActual.monto : -movimientoActual.monto,
        movimientoActual.moneda
      );
    }

    // Aplicar saldo a nueva cuenta origen (si se especificó)
    if (data.cuentaOrigen) {
      // Si es egreso, restar de la nueva cuenta
      await actualizarSaldoCuenta(
        data.cuentaOrigen,
        esEgreso ? -montoActual : montoActual,
        monedaActual
      );
    }

    updates.cuentaOrigen = data.cuentaOrigen || null;
  }

  // Manejo de cambio de cuenta destino
  if (data.cuentaDestino !== undefined && data.cuentaDestino !== movimientoActual.cuentaDestino) {
    const monedaActual = data.moneda ?? movimientoActual.moneda;
    const montoActual = data.monto ?? movimientoActual.monto;
    const esIngreso = esMovimientoIngreso(movimientoActual.tipo, movimientoActual);

    // Revertir saldo de cuenta destino anterior (si existía)
    if (movimientoActual.cuentaDestino) {
      // Si era ingreso, quitar el dinero de la cuenta anterior
      await actualizarSaldoCuenta(
        movimientoActual.cuentaDestino,
        esIngreso ? -movimientoActual.monto : movimientoActual.monto,
        movimientoActual.moneda
      );
    }

    // Aplicar saldo a nueva cuenta destino (si se especificó)
    if (data.cuentaDestino) {
      // Si es ingreso, sumar a la nueva cuenta
      await actualizarSaldoCuenta(
        data.cuentaDestino,
        esIngreso ? montoActual : -montoActual,
        monedaActual
      );
    }

    updates.cuentaDestino = data.cuentaDestino || null;
  }

  await updateDoc(doc(db, MOVIMIENTOS_COLLECTION, id), updates);
}

/**
 * Obtener movimiento por ID
 */
export async function getMovimientoById(id: string): Promise<MovimientoTesoreria | null> {
  const docRef = doc(db, MOVIMIENTOS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data()
  } as MovimientoTesoreria;
}

/**
 * Eliminar un movimiento de tesorería
 * Solo para administradores - Revierte el efecto en saldos
 */
export async function eliminarMovimiento(
  id: string,
  userId: string,
  getMovimientoByIdFn: (id: string) => Promise<MovimientoTesoreria | null>,
  actualizarSaldoCuenta: (cuentaId: string, diferencia: number, moneda?: any) => Promise<void>,
  actualizarEstadisticasPorMovimiento: (mov: any, esAnulacion?: boolean) => Promise<void>
): Promise<void> {
  const movimiento = await getMovimientoByIdFn(id);
  if (!movimiento) {
    throw new Error('Movimiento no encontrado');
  }

  // Revertir efecto en saldos
  if (movimiento.cuentaOrigen) {
    const esEgreso = esMovimientoEgreso(movimiento.tipo, movimiento);
    // Si era egreso, al eliminarlo devolvemos el dinero (suma)
    await actualizarSaldoCuenta(
      movimiento.cuentaOrigen,
      esEgreso ? movimiento.monto : -movimiento.monto,
      movimiento.moneda
    );
  }
  if (movimiento.cuentaDestino) {
    const esIngreso = esMovimientoIngreso(movimiento.tipo, movimiento);
    // Si era ingreso, al eliminarlo quitamos el dinero (resta)
    await actualizarSaldoCuenta(
      movimiento.cuentaDestino,
      esIngreso ? -movimiento.monto : movimiento.monto,
      movimiento.moneda
    );
  }

  // En lugar de eliminar, marcamos como anulado para mantener historial
  await updateDoc(doc(db, MOVIMIENTOS_COLLECTION, id), {
    estado: 'anulado',
    anuladoPor: userId,
    fechaAnulacion: Timestamp.now()
  });

  // Actualizar estadísticas agregadas (revertir el movimiento)
  await actualizarEstadisticasPorMovimiento({
    tipo: movimiento.tipo,
    moneda: movimiento.moneda,
    monto: movimiento.monto,
    tipoCambio: movimiento.tipoCambio,
    cuentaOrigen: movimiento.cuentaOrigen,
    cuentaDestino: movimiento.cuentaDestino
  }, true).catch(err => logger.warn('Error actualizando estadísticas:', err));
}

/**
 * Reclasificar anticipos a ingreso_venta cuando la venta es entregada.
 * Busca movimientos 'ingreso_anticipo' vinculados por ventaId o cotizacionId.
 * Solo cambia el tipo del movimiento (in-place), sin afectar saldos de cuenta.
 */
export async function reclasificarAnticipos(
  ventaId: string,
  cotizacionOrigenId: string | undefined,
  userId: string,
  getMovimientosFn: (filtros?: MovimientoTesoreriaFiltros) => Promise<MovimientoTesoreria[]>
): Promise<number> {
  try {
    // Buscar movimientos anticipo por ventaId
    const movimientos = await getMovimientosFn({});
    const anticipos = movimientos.filter(m =>
      m.tipo === 'ingreso_anticipo' &&
      m.estado === 'ejecutado' &&
      (
        m.ventaId === ventaId ||
        (cotizacionOrigenId && m.cotizacionId === cotizacionOrigenId)
      )
    );

    if (anticipos.length === 0) return 0;

    let count = 0;
    for (const mov of anticipos) {
      await updateDoc(doc(db, MOVIMIENTOS_COLLECTION, mov.id), {
        tipo: 'ingreso_venta',
        actualizadoPor: userId,
        fechaActualizacion: Timestamp.now(),
        notas: `${mov.notas || ''} [Reclasificado: anticipo → ingreso al entregar venta]`.trim()
      });
      count++;
    }

    logger.log(`[Reclasificación] ${count} anticipo(s) reclasificados a ingreso_venta para venta ${ventaId}`);
    return count;
  } catch (error) {
    logger.error('[Reclasificación] Error:', error);
    return 0;
  }
}

/**
 * Migración única: reclasificar movimientos históricos de ingreso_venta a ingreso_anticipo
 * cuando están vinculados a ventas que aún están en estado 'reservada' (producto no entregado).
 * Ejecutar una vez desde consola: await tesoreriaService.migrarAnticiposHistoricos('USER_ID')
 */
export async function migrarAnticiposHistoricos(
  userId: string,
  getMovimientosFn: (filtros?: MovimientoTesoreriaFiltros) => Promise<MovimientoTesoreria[]>
): Promise<{ migrados: number; detalles: string[] }> {
  try {
    const detalles: string[] = [];

    // 1. Obtener todos los movimientos ingreso_venta
    const movimientos = await getMovimientosFn({});
    const ingresosVenta = movimientos.filter(m =>
      m.tipo === 'ingreso_venta' && m.estado === 'ejecutado' && m.ventaId
    );

    detalles.push(`Encontrados ${ingresosVenta.length} movimientos ingreso_venta con ventaId`);

    // 2. Para cada uno, verificar si la venta está en estado 'reservada'
    let migrados = 0;
    for (const mov of ingresosVenta) {
      try {
        const ventaSnap = await getDoc(doc(db, COLLECTIONS.VENTAS, mov.ventaId!));
        if (!ventaSnap.exists()) {
          // Intentar como cotización (ventaId puede ser cotizacionId en adelantos)
          const cotSnap = await getDoc(doc(db, COLLECTIONS.COTIZACIONES, mov.ventaId!));
          if (cotSnap.exists()) {
            const cot = cotSnap.data();
            // Si la cotización no se ha convertido en venta entregada, es anticipo
            if (cot.estado !== 'entregada' && cot.estado !== 'completada') {
              await updateDoc(doc(db, MOVIMIENTOS_COLLECTION, mov.id), {
                tipo: 'ingreso_anticipo',
                actualizadoPor: userId,
                fechaActualizacion: Timestamp.now(),
                notas: `${mov.notas || ''} [Migrado: ingreso_venta → ingreso_anticipo (cotización pendiente)]`.trim()
              });
              migrados++;
              detalles.push(`Migrado: ${mov.concepto} (cotización ${mov.ventaId})`);
            }
          }
          continue;
        }

        const venta = ventaSnap.data();
        // Solo migrar si la venta está en reservada (producto no entregado)
        if (venta.estado === 'reservada') {
          await updateDoc(doc(db, MOVIMIENTOS_COLLECTION, mov.id), {
            tipo: 'ingreso_anticipo',
            actualizadoPor: userId,
            fechaActualizacion: Timestamp.now(),
            notas: `${mov.notas || ''} [Migrado: ingreso_venta → ingreso_anticipo (venta reservada)]`.trim()
          });
          migrados++;
          detalles.push(`Migrado: ${mov.concepto} - ${venta.numeroVenta} (${venta.estado})`);
        }
      } catch (e) {
        detalles.push(`Error procesando mov ${mov.id}: ${e}`);
      }
    }

    detalles.push(`\nTotal migrados: ${migrados} de ${ingresosVenta.length} revisados`);
    logger.log('[Migración Anticipos]', detalles.join('\n'));
    return { migrados, detalles };
  } catch (error) {
    logger.error('[Migración Anticipos] Error:', error);
    return { migrados: 0, detalles: [`Error: ${error}`] };
  }
}

/**
 * Obtener movimientos con filtros
 */
export async function getMovimientos(filtros?: MovimientoTesoreriaFiltros): Promise<MovimientoTesoreria[]> {
  const buildQuery = (cuentaField?: string, cuentaValue?: string) => {
    let q = query(
      collection(db, MOVIMIENTOS_COLLECTION),
      orderBy('fecha', 'desc')
    );

    if (filtros?.tipo) {
      q = query(q, where('tipo', '==', filtros.tipo));
    }
    if (filtros?.estado) {
      q = query(q, where('estado', '==', filtros.estado));
    }
    if (filtros?.moneda) {
      q = query(q, where('moneda', '==', filtros.moneda));
    }
    if (cuentaField && cuentaValue) {
      q = query(q, where(cuentaField, '==', cuentaValue));
    }
    return q;
  };

  let movimientos: MovimientoTesoreria[];

  if (filtros?.cuentaId) {
    // Ejecutar dos queries: una por cuentaOrigen, otra por cuentaDestino
    const [snapOrigen, snapDestino] = await Promise.all([
      getDocs(buildQuery('cuentaOrigen', filtros.cuentaId)),
      getDocs(buildQuery('cuentaDestino', filtros.cuentaId))
    ]);

    const movMap = new Map<string, MovimientoTesoreria>();
    for (const d of snapOrigen.docs) {
      movMap.set(d.id, { id: d.id, ...d.data() } as MovimientoTesoreria);
    }
    for (const d of snapDestino.docs) {
      movMap.set(d.id, { id: d.id, ...d.data() } as MovimientoTesoreria);
    }
    movimientos = Array.from(movMap.values());
    // Re-sort since we merged two queries
    movimientos.sort((a, b) => (b.fecha?.seconds ?? 0) - (a.fecha?.seconds ?? 0));
  } else {
    const snapshot = await getDocs(buildQuery());
    movimientos = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as MovimientoTesoreria));
  }

  // Filtros adicionales en memoria
  if (filtros?.fechaInicio) {
    const desde = Timestamp.fromDate(filtros.fechaInicio);
    movimientos = movimientos.filter(m => m.fecha.seconds >= desde.seconds);
  }
  if (filtros?.fechaFin) {
    const hasta = Timestamp.fromDate(filtros.fechaFin);
    movimientos = movimientos.filter(m => m.fecha.seconds <= hasta.seconds);
  }

  return movimientos;
}
