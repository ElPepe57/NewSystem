/**
 * venta.pagos.service.ts
 *
 * Métodos de pago de ventas extraídos de VentaService.
 * Este módulo contiene la lógica de registrarPago, eliminarPago y
 * las consultas relacionadas con estado de pago.
 *
 * No exporta una clase — expone funciones estáticas que son invocadas
 * por VentaService como delegados, manteniendo la API pública intacta.
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import type {
  Venta,
  EstadoPago,
  MetodoPago,
  PagoVenta,
} from '../types/venta.types';
import { tipoCambioService } from './tipoCambio.service';
import { tesoreriaService } from './tesoreria.service';
import { logger } from '../lib/logger';

const COLLECTION_NAME = COLLECTIONS.VENTAS;

/**
 * Registrar un pago para una venta.
 * Usa una transacción atómica para leer + validar + escribir,
 * y registra el movimiento en Tesorería en un paso post-transacción.
 */
export async function registrarPago(
  ventaId: string,
  datosPago: {
    monto: number;
    metodoPago: MetodoPago;
    referencia?: string;
    comprobante?: string;
    notas?: string;
    cuentaDestinoId?: string;
  },
  userId: string,
  registrarEnTesoreria: boolean = true
): Promise<PagoVenta> {
  // Obtener TC ANTES de la transacción (llamada de red, no puede ir dentro)
  let tcCobro: number | undefined;
  try {
    tcCobro = await tipoCambioService.resolverTCVentaEstricto();
  } catch { /* fallback: undefined */ }

  // Determinar moneda del pago según método (Zelle/PayPal = USD)
  const metodosEnUSD: string[] = ['paypal', 'zelle'];
  const monedaCobro: 'USD' | 'PEN' = metodosEnUSD.includes(datosPago.metodoPago) ? 'USD' : 'PEN';

  const ventaRef = doc(db, COLLECTION_NAME, ventaId);

  const nuevoPago = await runTransaction(db, async (transaction) => {
    const ventaSnap = await transaction.get(ventaRef);
    if (!ventaSnap.exists()) {
      throw new Error('Venta no encontrada');
    }
    const venta = { id: ventaSnap.id, ...ventaSnap.data() } as Venta;

    if (venta.estado === 'cancelada') {
      throw new Error('No se puede registrar pago en una venta cancelada');
    }

    if (venta.estado === 'cotizacion') {
      throw new Error('No se puede registrar pago en una cotización. Confirme la venta primero.');
    }

    if (venta.estadoPago === 'pagado') {
      throw new Error('Esta venta ya está completamente pagada. No se pueden registrar pagos adicionales.');
    }

    const pagosExistentes = venta.pagos || [];
    const tienepagoML = pagosExistentes.some(
      (p: any) => p.registradoPor === 'ml-auto-processor' || p.registradoPor === 'ml-webhook'
    );
    if (tienepagoML && datosPago.metodoPago === 'mercado_pago') {
      throw new Error('Esta venta ya tiene un pago automático de MercadoLibre. No se puede duplicar.');
    }

    if (datosPago.monto <= 0) {
      throw new Error('El monto debe ser mayor a 0');
    }

    // Rechazar pagos USD sin TC disponible (evita comparar USD raw vs PEN)
    if (monedaCobro === 'USD' && !tcCobro) {
      throw new Error('No se puede registrar pago en USD: tipo de cambio no disponible. Intente nuevamente.');
    }

    // Comparar en PEN cuando el pago es en USD
    const montoValidacionPEN = monedaCobro === 'USD' && tcCobro
      ? datosPago.monto * tcCobro
      : datosPago.monto;
    if (montoValidacionPEN > venta.montoPendiente * 1.01) {
      throw new Error(
        `El monto excede el saldo pendiente. Pendiente: S/ ${venta.montoPendiente.toFixed(2)}`
      );
    }

    const pagosAnteriores = venta.pagos || [];

    const pago: PagoVenta = {
      id: `PAG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      monto: datosPago.monto,
      moneda: monedaCobro,
      metodoPago: datosPago.metodoPago,
      tipoPago: pagosAnteriores.some(p => p.tipoPago === 'anticipo') ? 'saldo' : 'pago',
      fecha: Timestamp.now(),
      registradoPor: userId
    };

    // Solo agregar campos opcionales si tienen valor (Firestore rechaza undefined)
    if (tcCobro !== undefined) pago.tipoCambio = tcCobro;
    if (monedaCobro === 'USD' && tcCobro) pago.montoEquivalentePEN = datosPago.monto * tcCobro;

    if (datosPago.referencia) pago.referencia = datosPago.referencia;
    if (datosPago.comprobante) pago.comprobante = datosPago.comprobante;
    if (datosPago.notas) pago.notas = datosPago.notas;

    const nuevosPagos = [...pagosAnteriores, pago];
    const montoPagoEnPEN = monedaCobro === 'USD' && tcCobro
      ? datosPago.monto * tcCobro
      : datosPago.monto;
    const nuevoMontoPagado = venta.montoPagado + montoPagoEnPEN;
    const nuevoMontoPendiente = venta.totalPEN - nuevoMontoPagado;

    let nuevoEstadoPago: EstadoPago;
    if (nuevoMontoPendiente <= 0) {
      nuevoEstadoPago = 'pagado';
    } else if (nuevoMontoPagado > 0) {
      nuevoEstadoPago = 'parcial';
    } else {
      nuevoEstadoPago = 'pendiente';
    }

    const updates: any = {
      pagos: nuevosPagos,
      montoPagado: nuevoMontoPagado,
      montoPendiente: Math.max(0, nuevoMontoPendiente),
      estadoPago: nuevoEstadoPago,
      tcCobro: tcCobro ?? null,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    if (nuevoEstadoPago === 'pagado') {
      updates.fechaPagoCompleto = serverTimestamp();
    }

    transaction.update(ventaRef, updates);

    return { pago, numeroVenta: venta.numeroVenta || ventaId };
  });

  // POST-TRANSACCIÓN: Registrar en Tesorería (no crítico)
  if (registrarEnTesoreria) {
    try {
      const metodoTesoreriaMap: Record<MetodoPago, string> = {
        'yape': 'yape',
        'plin': 'plin',
        'efectivo': 'efectivo',
        'transferencia': 'transferencia_bancaria',
        'mercado_pago': 'mercado_pago',
        'tarjeta': 'tarjeta',
        'otro': 'otro',
        'paypal': 'paypal',
        'zelle': 'otro'
      };

      const metodoTesoreria = metodoTesoreriaMap[datosPago.metodoPago] || 'efectivo';
      const metodosUSD: string[] = ['paypal', 'zelle'];
      const monedaPago = metodosUSD.includes(datosPago.metodoPago) ? 'USD' : 'PEN';

      let cuentaDestinoId = datosPago.cuentaDestinoId;
      if (!cuentaDestinoId) {
        const cuentaPorDefecto = await tesoreriaService.getCuentaPorMetodoPago(
          metodoTesoreria as any,
          monedaPago
        );
        cuentaDestinoId = cuentaPorDefecto?.id;
      }

      const tipoCambio = await tipoCambioService.resolverTCVentaEstricto();

      const movimientoId = await tesoreriaService.registrarMovimiento(
        {
          tipo: 'ingreso_venta',
          moneda: monedaPago as any,
          monto: datosPago.monto,
          tipoCambio,
          metodo: metodoTesoreria as any,
          concepto: `Cobro venta ${nuevoPago.numeroVenta}`,
          fecha: new Date(),
          referencia: datosPago.referencia,
          notas: datosPago.notas || `Pago registrado desde venta`,
          ventaId: ventaId,
          cuentaDestino: cuentaDestinoId
        },
        userId
      );

      // Persistir tesoreriaMovimientoId en Firestore
      nuevoPago.pago.tesoreriaMovimientoId = movimientoId;
      const ventaActualSnap = await import('firebase/firestore').then(({ getDoc }) =>
        getDoc(doc(db, COLLECTION_NAME, ventaId))
      );
      if (ventaActualSnap.exists()) {
        const ventaActual = { id: ventaActualSnap.id, ...ventaActualSnap.data() } as Venta;
        const pagosActualizados = (ventaActual.pagos || []).map((p: PagoVenta) =>
          p.id === nuevoPago.pago.id ? { ...p, tesoreriaMovimientoId: movimientoId } : p
        );
        await updateDoc(ventaRef, { pagos: pagosActualizados });
      }
    } catch (tesoreriaError: any) {
      logger.error('Error registrando en tesorería (el pago fue registrado):', tesoreriaError);
      // Marcar el pago con error de tesorería para reconciliación posterior
      try {
        const ventaActualSnap = await import('firebase/firestore').then(({ getDoc }) =>
          getDoc(doc(db, COLLECTION_NAME, ventaId))
        );
        if (ventaActualSnap.exists()) {
          const ventaActual = { id: ventaActualSnap.id, ...ventaActualSnap.data() } as Venta;
          const pagosConError = (ventaActual.pagos || []).map((p: PagoVenta) =>
            p.id === nuevoPago.pago.id ? { ...p, errorTesoreria: true, errorTesoreriaMsg: tesoreriaError?.message || 'Error desconocido' } : p
          );
          await updateDoc(ventaRef, { pagos: pagosConError });
        }
      } catch (updateErr) {
        logger.error('Error marcando pago con errorTesoreria:', updateErr);
      }
    }
  }

  return nuevoPago.pago;
}

/**
 * Eliminar un pago registrado y revertir el movimiento de Tesorería asociado.
 */
export async function eliminarPago(
  ventaId: string,
  pagoId: string,
  userId: string
): Promise<void> {
  const { getDoc } = await import('firebase/firestore');
  const ventaSnap = await getDoc(doc(db, COLLECTION_NAME, ventaId));
  if (!ventaSnap.exists()) {
    throw new Error('Venta no encontrada');
  }
  const venta = { id: ventaSnap.id, ...ventaSnap.data() } as Venta;

  if (venta.estado === 'entregada') {
    throw new Error('No se pueden eliminar pagos de ventas entregadas');
  }

  const pagos = venta.pagos || [];
  const pagoIndex = pagos.findIndex(p => p.id === pagoId);

  if (pagoIndex === -1) {
    throw new Error('Pago no encontrado');
  }

  const pagoEliminado = pagos[pagoIndex];
  const nuevosPagos = pagos.filter(p => p.id !== pagoId);

  // Restar equivalente PEN cuando el pago fue en USD
  const montoRestarPEN = pagoEliminado.moneda === 'USD' && pagoEliminado.montoEquivalentePEN
    ? pagoEliminado.montoEquivalentePEN
    : pagoEliminado.monto;
  const nuevoMontoPagado = venta.montoPagado - montoRestarPEN;
  const nuevoMontoPendiente = venta.totalPEN - nuevoMontoPagado;

  // Revertir movimiento en Tesorería si existe
  if (pagoEliminado.tesoreriaMovimientoId && pagoEliminado.tesoreriaMovimientoId !== 'registrado') {
    try {
      await tesoreriaService.eliminarMovimiento(pagoEliminado.tesoreriaMovimientoId, userId, true);
    } catch (tesoreriaError) {
      logger.error(`[eliminarPago] Error revirtiendo tesorería (movId: ${pagoEliminado.tesoreriaMovimientoId}):`, tesoreriaError);
    }
  } else if (pagoEliminado.tesoreriaMovimientoId === 'registrado') {
    // Legacy: pagos con ID='registrado' — buscar por ventaId + monto + tipo
    try {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.MOVIMIENTOS_TESORERIA),
        where('ventaId', '==', ventaId),
        where('tipo', '==', 'ingreso_venta')
      ));
      const movimientoCorrespondiente = snap.docs.find(d => {
        const data = d.data();
        return data.estado !== 'anulado' && Math.abs(data.monto - pagoEliminado.monto) < 0.01;
      });
      if (movimientoCorrespondiente) {
        await tesoreriaService.eliminarMovimiento(movimientoCorrespondiente.id, userId, true);
      }
    } catch (tesoreriaError) {
      logger.error(`[eliminarPago] Error revirtiendo tesorería (legacy):`, tesoreriaError);
    }
  }

  let nuevoEstadoPago: EstadoPago;
  if (nuevoMontoPagado <= 0) {
    nuevoEstadoPago = 'pendiente';
  } else if (nuevoMontoPendiente > 0) {
    nuevoEstadoPago = 'parcial';
  } else {
    nuevoEstadoPago = 'pagado';
  }

  const updates: any = {
    pagos: nuevosPagos,
    montoPagado: Math.max(0, nuevoMontoPagado),
    montoPendiente: nuevoMontoPendiente,
    estadoPago: nuevoEstadoPago,
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId
  };

  if (nuevoEstadoPago !== 'pagado') {
    updates.fechaPagoCompleto = null;
  }

  await updateDoc(doc(db, COLLECTION_NAME, ventaId), updates);
}

/**
 * Obtener ventas por estado de pago.
 */
export async function getByEstadoPago(estadoPago: EstadoPago): Promise<Venta[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('estadoPago', '==', estadoPago),
    orderBy('fechaCreacion', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  } as Venta));
}

/**
 * Obtener ventas con pagos pendientes o parciales.
 */
export async function getVentasPendientesPago(): Promise<Venta[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('estadoPago', 'in', ['pendiente', 'parcial']),
    where('estado', '!=', 'cancelada'),
    orderBy('estado'),
    orderBy('fechaCreacion', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  } as Venta));
}

/**
 * Obtener resumen de pagos: totales por cobrar, ventas por estado de pago,
 * y cobranza del mes actual.
 */
export async function getResumenPagos(ventas: Venta[]): Promise<{
  totalPorCobrar: number;
  ventasPendientes: number;
  ventasParciales: number;
  ventasPagadas: number;
  cobranzaMesActual: number;
}> {
  const ventasActivas = ventas.filter(v => v.estado !== 'cancelada' && v.estado !== 'cotizacion');

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  let totalPorCobrar = 0;
  let ventasPendientes = 0;
  let ventasParciales = 0;
  let ventasPagadas = 0;
  let cobranzaMesActual = 0;

  ventasActivas.forEach(venta => {
    totalPorCobrar += venta.montoPendiente || 0;

    if (venta.estadoPago === 'pendiente') ventasPendientes++;
    else if (venta.estadoPago === 'parcial') ventasParciales++;
    else if (venta.estadoPago === 'pagado') ventasPagadas++;

    if (venta.pagos) {
      venta.pagos.forEach(pago => {
        const fechaPago = pago.fecha.toDate();
        if (fechaPago >= inicioMes) {
          const montoEnPEN = pago.moneda === 'USD' && pago.montoEquivalentePEN
            ? pago.montoEquivalentePEN
            : pago.monto;
          cobranzaMesActual += montoEnPEN;
        }
      });
    }
  });

  return {
    totalPorCobrar,
    ventasPendientes,
    ventasParciales,
    ventasPagadas,
    cobranzaMesActual
  };
}
