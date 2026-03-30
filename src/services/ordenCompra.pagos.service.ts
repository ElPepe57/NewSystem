/**
 * ordenCompra.pagos.service.ts
 *
 * Payment registration for OrdenesCompra.
 * Integrates with Tesorería and Pool USD.
 */

import {
  doc,
  updateDoc,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import type { PagoOrdenCompra } from '../types/ordenCompra.types';
import type { MetodoTesoreria } from '../types/tesoreria.types';
import { tesoreriaService } from './tesoreria.service';
// poolUSDService: eliminado — tesorería registra automáticamente en Pool USD
import { ORDENES_COLLECTION } from './ordenCompra.shared';
import { getById } from './ordenCompra.crud.service';

export async function registrarPago(
  id: string,
  datos: {
    fechaPago: Date;
    monedaPago: 'USD' | 'PEN';
    montoOriginal: number;
    tipoCambio: number;
    metodoPago: MetodoTesoreria;
    cuentaOrigenId?: string;
    referencia?: string;
    notas?: string;
  },
  userId: string
): Promise<PagoOrdenCompra> {
  try {
    const orden = await getById(id);
    if (!orden) throw new Error('Orden no encontrada');
    if (orden.estado === 'cancelada') {
      throw new Error('No se puede registrar pago en una orden cancelada');
    }

    const {
      fechaPago,
      monedaPago,
      montoOriginal,
      tipoCambio,
      metodoPago,
      cuentaOrigenId,
      referencia,
      notas
    } = datos;

    if (!tipoCambio || tipoCambio <= 0) {
      throw new Error('El tipo de cambio es requerido y debe ser mayor a 0');
    }
    if (!montoOriginal || montoOriginal <= 0) {
      throw new Error('El monto es requerido y debe ser mayor a 0');
    }

    const montoUSD = monedaPago === 'USD' ? montoOriginal : montoOriginal / tipoCambio;
    const montoPEN = monedaPago === 'PEN' ? montoOriginal : montoOriginal * tipoCambio;

    let cuentaOrigenNombre: string | undefined;
    if (cuentaOrigenId) {
      try {
        const cuenta = await tesoreriaService.getCuentaById(cuentaOrigenId);
        if (cuenta) cuentaOrigenNombre = cuenta.nombre;
      } catch (e) {
        logger.warn('No se pudo obtener nombre de cuenta:', e);
      }
    }

    const pagoId = `PAG-OC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nuevoPago: PagoOrdenCompra = {
      id: pagoId,
      fecha: Timestamp.fromDate(fechaPago),
      monedaPago,
      montoOriginal,
      montoUSD,
      montoPEN,
      tipoCambio,
      metodoPago,
      registradoPor: userId,
      fechaRegistro: Timestamp.now()
    };

    if (cuentaOrigenId) nuevoPago.cuentaOrigenId = cuentaOrigenId;
    if (cuentaOrigenNombre) nuevoPago.cuentaOrigenNombre = cuentaOrigenNombre;
    if (referencia) nuevoPago.referencia = referencia;
    if (notas) nuevoPago.notas = notas;

    const historialPagos = orden.historialPagos || [];
    const totalPagadoUSD = historialPagos.reduce((sum, p) => sum + p.montoUSD, 0) + montoUSD;
    const pendienteUSD = orden.totalUSD - totalPagadoUSD;
    const estadoPago = pendienteUSD <= 0.01 ? 'pagada' : 'pago_parcial';

    const updates: any = {
      historialPagos: [...historialPagos, nuevoPago],
      estadoPago,
      tcPago: tipoCambio,
      montoPendiente: Math.max(0, pendienteUSD * tipoCambio),
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    if (estadoPago === 'pagada') {
      updates.fechaPago = Timestamp.fromDate(fechaPago);
      updates.totalPEN = orden.totalUSD * tipoCambio;

      if (orden.tcCompra) {
        const costoEnCompra = orden.totalUSD * orden.tcCompra;
        const costoEnPago = orden.totalUSD * tipoCambio;
        updates.diferenciaCambiaria = costoEnPago - costoEnCompra;
      }
    }

    await updateDoc(doc(db, ORDENES_COLLECTION, id), updates);

    // Register in Tesorería (non-blocking)
    try {
      const esPagoCompleto = estadoPago === 'pagada';
      const movimientoData: any = {
        tipo: 'pago_orden_compra',
        moneda: monedaPago,
        monto: montoOriginal,
        tipoCambio,
        metodo: metodoPago,
        referencia,
        concepto: `Pago ${esPagoCompleto ? 'completo' : 'parcial'} OC ${orden.numeroOrden} - ${orden.nombreProveedor}`,
        ordenCompraId: id,
        ordenCompraNumero: orden.numeroOrden,
        notas:
          notas ||
          `${monedaPago === 'USD' ? `≈ S/ ${montoPEN.toFixed(2)}` : `≈ $${montoUSD.toFixed(2)} USD`}`,
        fecha: fechaPago
      };
      if (cuentaOrigenId) movimientoData.cuentaOrigen = cuentaOrigenId;

      const movimientoId = await tesoreriaService.registrarMovimiento(movimientoData, userId);
      nuevoPago.movimientoTesoreriaId = movimientoId;

      // Persistir el movimientoTesoreriaId en Firestore (segunda escritura)
      const pagosActualizados = [...historialPagos, nuevoPago];
      await updateDoc(doc(db, ORDENES_COLLECTION, id), { historialPagos: pagosActualizados });

      logger.success(
        `Pago OC registrado en tesorería: ${monedaPago} ${montoOriginal} para ${orden.numeroOrden}`
      );
    } catch (tesoreriaError) {
      logger.error('Error registrando pago OC en tesorería:', tesoreriaError);
    }

    // Pool USD: NO registrar aquí — tesorería.movimientos.service lo hace automáticamente
    // al recibir un movimiento tipo 'pago_orden_compra' en USD.
    // Registrarlo aquí causaba DOBLE REGISTRO en Pool USD.

    return nuevoPago;
  } catch (error: any) {
    logger.error('Error al registrar pago:', error);
    throw new Error(error.message || 'Error al registrar pago');
  }
}
