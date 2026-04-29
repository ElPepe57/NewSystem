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
// S55 Fase 3 — Cuenta Corriente del cliente (escritura en paralelo a la
// escritura legacy de venta.pagos[]). La doble escritura se elimina al
// final de Fase 3 cuando todos los consumers usen CC.
import { cuentaCorrienteService } from './cuentaCorriente.service';

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
    tipoCambio?: number;
    referencia?: string;
    comprobante?: string;
    notas?: string;
    cuentaDestinoId?: string;
  },
  userId: string,
  registrarEnTesoreria: boolean = true
): Promise<PagoVenta> {
  // TC: usar el del formulario si se provee, sino resolver del servicio
  let tcCobro: number | undefined;
  if (datosPago.tipoCambio && datosPago.tipoCambio > 0) {
    tcCobro = datosPago.tipoCambio;
  } else {
    try {
      tcCobro = await tipoCambioService.resolverTCVentaEstricto();
    } catch { /* fallback: undefined */ }
  }

  // Determinar moneda del pago según método (Zelle/PayPal = USD)
  const metodosEnUSD: string[] = ['paypal', 'zelle'];
  const monedaCobro: 'USD' | 'PEN' = metodosEnUSD.includes(datosPago.metodoPago) ? 'USD' : 'PEN';

  const ventaRef = doc(db, COLLECTION_NAME, ventaId);

  // S55 Fase 3 — Pre-validación: detectar pagos ML duplicados leyendo
  // movimientos CC ANTES de iniciar la transacción (Firestore no permite
  // queries arbitrarias dentro de runTransaction).
  if (datosPago.metodoPago === 'mercado_pago') {
    const { getCobrosVenta } = await import('./cuentaCorriente.adaptadores');
    const cobrosPrev = await getCobrosVenta(ventaId);
    const tienePagoML = cobrosPrev.some((c) =>
      c.registradoPor === 'ml-auto-processor' || c.registradoPor === 'ml-webhook'
    );
    if (tienePagoML) {
      throw new Error('Esta venta ya tiene un pago automático de MercadoLibre. No se puede duplicar.');
    }
  }

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

    // S55 Fase 3 — `pago` queda como objeto en memoria solo para retornar al caller
    // (compatibilidad con APIs públicas). YA NO se persiste en venta.pagos[] —
    // el movimiento real se crea como `credito_cobro_venta` en CC post-transacción.
    const pago: PagoVenta = {
      id: `PAG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      monto: datosPago.monto,
      moneda: monedaCobro,
      metodoPago: datosPago.metodoPago,
      tipoPago: 'pago',
      fecha: Timestamp.now(),
      registradoPor: userId
    };

    if (tcCobro !== undefined) pago.tipoCambio = tcCobro;
    if (monedaCobro === 'USD' && tcCobro) pago.montoEquivalentePEN = datosPago.monto * tcCobro;
    if (datosPago.referencia) pago.referencia = datosPago.referencia;
    if (datosPago.comprobante) pago.comprobante = datosPago.comprobante;
    if (datosPago.notas) pago.notas = datosPago.notas;

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

    // S55 Fase 3 — Solo actualiza denormalizados (estadoPago/montoPagado/
    // montoPendiente). El detalle de cobros vive en movimientosCC.
    const updates: Record<string, unknown> = {
      montoPagado: nuevoMontoPagado,
      montoPendiente: Math.max(0, nuevoMontoPendiente),
      estadoPago: nuevoEstadoPago,
      tcCobro: tcCobro ?? null,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

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

      // Usar tcCobro ya resuelto (del formulario o del servicio) — NO resolver otra vez
      const tipoCambio = tcCobro || 1;

      // F4a.3 · ADR-PF-001 · escribe al libro mayor unificado
      const { registrarMovimientoFinanciero } = await import(
        './movimientoFinanciero.service'
      );
      const movimientoId = await registrarMovimientoFinanciero(
        {
          categoria: 'ingreso_venta',
          moneda: monedaPago as 'USD' | 'PEN',
          monto: datosPago.monto,
          tipoCambio,
          metodo: metodoTesoreria as string,
          concepto: `Cobro venta ${nuevoPago.numeroVenta}`,
          fecha: new Date(),
          referencia: datosPago.referencia,
          notas: datosPago.notas || `Pago registrado desde venta`,
          refDocumentoTipo: 'venta',
          refDocumentoId: ventaId,
          refDocumentoNumero: nuevoPago.numeroVenta,
          productoDestinoId: cuentaDestinoId,
        },
        userId,
      );

      // S55 Fase 3 — `tesoreriaMovimientoId` se referencia al crear el
      // MovimientoCC abajo. Ya no se persiste en venta.pagos[] (eliminado).
      nuevoPago.pago.tesoreriaMovimientoId = movimientoId;
      const ventaActualSnap = await import('firebase/firestore').then(({ getDoc }) =>
        getDoc(doc(db, COLLECTION_NAME, ventaId))
      );
      let ventaActualData: Venta | null = null;
      if (ventaActualSnap.exists()) {
        ventaActualData = { id: ventaActualSnap.id, ...ventaActualSnap.data() } as Venta;
      }

      // S55 Fase 3 — Crear movimiento `credito_cobro_venta` en CC del cliente.
      // Solo si la venta tiene clienteId vinculado al catálogo. Las ventas
      // anónimas (sin cliente registrado) no entran a CC.
      // No bloqueante: si falla, el pago ya quedó registrado y se resuelve
      // con ajusteManual.
      if (ventaActualData?.clienteId && datosPago.monto > 0) {
        try {
          const montoEnPEN = monedaCobro === 'USD' && tcCobro
            ? datosPago.monto * tcCobro
            : datosPago.monto;
          await cuentaCorrienteService.registrarMovimiento(
            {
              entidadId: ventaActualData.clienteId,
              tipo: 'cliente',
              entidadNombre: ventaActualData.nombreCliente || 'Cliente',
              tipoMovimiento: 'credito_cobro_venta',
              descripcion: `Cobro venta ${nuevoPago.numeroVenta} · ${monedaCobro} ${datosPago.monto.toFixed(2)} vía ${datosPago.metodoPago}`,
              moneda: 'PEN',
              monto: montoEnPEN,
              refDocumentoTipo: 'venta',
              refDocumentoId: ventaId,
              refDocumentoNumero: ventaActualData.numeroVenta,
              movimientoTesoreriaId: movimientoId,
              notas: datosPago.notas,
            },
            userId,
          );
        } catch (ccErr) {
          logger.warn(
            '[CC] No se pudo crear credito_cobro_venta (no bloqueante): ' +
              (ccErr instanceof Error ? ccErr.message : String(ccErr)),
          );
        }
      }
    } catch (tesoreriaError: unknown) {
      logger.error('Error registrando en tesorería (el pago fue registrado):', tesoreriaError);
      // S55 Fase 3 — El error de tesorería se logea. El movimiento CC
      // se creó (o se intentó crear) igual; si también falló, queda log warning
      // en el catch de CC arriba. La venta ya tiene los denormalizados
      // actualizados correctamente.
      const errMsg = tesoreriaError instanceof Error
        ? tesoreriaError.message
        : 'Error desconocido';
      nuevoPago.pago.errorTesoreria = true;
      nuevoPago.pago.errorTesoreriaMsg = errMsg;
    }
  }

  return nuevoPago.pago;
}

/**
 * Eliminar un pago registrado y revertir el movimiento de Tesorería asociado.
 *
 * S55 Fase 3 — el `pagoId` es el ID del MovimientoCC (anteriormente PagoVenta).
 * Se considera "eliminar" como crear un ajuste negativo via `ajusteManual` ya
 * que los movimientos CC son inmutables (audit trail). Este flujo se usa para
 * reversiones excepcionales (ej: pago duplicado).
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

  // Buscar el MovimientoCC por ID
  const movSnap = await getDoc(doc(db, COLLECTIONS.MOVIMIENTOS_CC, pagoId));
  if (!movSnap.exists()) {
    throw new Error('Pago no encontrado en CC');
  }
  const mov = movSnap.data() as { monto: number; movimientoTesoreriaId?: string };

  // Revertir movimiento en Tesorería si existe
  if (mov.movimientoTesoreriaId) {
    try {
      await tesoreriaService.eliminarMovimiento(mov.movimientoTesoreriaId, userId, true);
    } catch (tesoreriaError) {
      logger.error(`[eliminarPago] Error revirtiendo tesorería (movId: ${mov.movimientoTesoreriaId}):`, tesoreriaError);
    }
  }

  // Crear ajuste manual de reversión (los movimientos CC son inmutables)
  if (venta.clienteId) {
    try {
      await cuentaCorrienteService.ajusteManual({
        entidadId: venta.clienteId,
        tipo: 'cliente',
        entidadNombre: venta.nombreCliente,
        monto: mov.monto,
        moneda: 'PEN',
        direccion: 'debito', // anula el credito_cobro_venta original
        motivo: `Reversión de pago ${pagoId.slice(-8)} en venta ${venta.numeroVenta || ventaId}`,
        userId,
      });
    } catch (ccErr) {
      logger.error('[eliminarPago] Error creando ajuste de reversión en CC:', ccErr);
    }
  }

  // Recalcular denormalizados desde CC
  const { getCobrosVenta } = await import('./cuentaCorriente.adaptadores');
  const cobrosActuales = await getCobrosVenta(ventaId);
  const nuevoMontoPagado = cobrosActuales.reduce((s, c) => s + c.monto, 0);
  const nuevoMontoPendiente = venta.totalPEN - nuevoMontoPagado;

  let nuevoEstadoPago: EstadoPago;
  if (nuevoMontoPagado <= 0) nuevoEstadoPago = 'pendiente';
  else if (nuevoMontoPendiente > 0.01) nuevoEstadoPago = 'parcial';
  else nuevoEstadoPago = 'pagado';

  await updateDoc(doc(db, COLLECTION_NAME, ventaId), {
    montoPagado: Math.max(0, nuevoMontoPagado),
    montoPendiente: Math.max(0, nuevoMontoPendiente),
    estadoPago: nuevoEstadoPago,
    ultimaEdicion: serverTimestamp(),
    editadoPor: userId,
  });
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
  });

  // S55 Fase 3 — Cobranza del mes: query directa a movimientosCC con
  // tipo='credito_cobro_venta' y fecha >= inicioMes. Reemplaza la iteración
  // de venta.pagos[] que ya no existe.
  try {
    const movsSnap = await getDocs(query(
      collection(db, COLLECTIONS.MOVIMIENTOS_CC),
      where('tipo', '==', 'credito_cobro_venta'),
      where('fecha', '>=', Timestamp.fromDate(inicioMes)),
    ));
    cobranzaMesActual = movsSnap.docs.reduce((sum, d) => {
      const data = d.data() as { monto?: number; moneda?: string };
      return sum + (data.monto || 0);
    }, 0);
  } catch (err) {
    logger.warn('[getResumenPagos] No se pudo calcular cobranza del mes:', err);
  }

  return {
    totalPorCobrar,
    ventasPendientes,
    ventasParciales,
    ventasPagadas,
    cobranzaMesActual
  };
}
