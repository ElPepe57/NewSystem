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
    subOrdenId?: string;
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
    if (datos.subOrdenId) nuevoPago.subOrdenId = datos.subOrdenId;

    const historialPagos = orden.historialPagos || [];
    const totalPagadoUSD = historialPagos.reduce((sum, p) => sum + p.montoUSD, 0) + montoUSD;
    const pendienteUSD = orden.totalUSD - totalPagadoUSD;

    const tieneSubOrdenes = !!(orden.subOrdenes && orden.subOrdenes.length > 0);

    const updates: any = {
      historialPagos: [...historialPagos, nuevoPago],
      tcPago: tipoCambio,
      montoPendiente: Math.max(0, pendienteUSD * tipoCambio),
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    // BUG-002-PAG: cuando hay sub-órdenes, el estadoPago de la OC SE DERIVA ÚNICAMENTE
    // desde los estados de las sub-órdenes — no desde el total agregado.
    // Así evitamos dos derivaciones que pueden contradecirse.
    if (tieneSubOrdenes) {
      updates.subOrdenes = orden.subOrdenes!.map(sub => {
        // Pagos acumulados de ESTA sub-orden (incluye el nuevo si aplica)
        const pagosSubOrden = [...historialPagos, nuevoPago].filter(
          (p) => p.subOrdenId === sub.id
        );
        const totalPagadoSub = pagosSubOrden.reduce((s, p) => s + p.montoUSD, 0);
        // BUG-004-PAG: tri-estado pendiente | parcial | pagado
        let estadoPagoSub: 'pendiente' | 'parcial' | 'pagado';
        if (totalPagadoSub >= sub.totalUSD - 0.01) {
          estadoPagoSub = 'pagado';
        } else if (totalPagadoSub > 0.01) {
          estadoPagoSub = 'parcial';
        } else {
          estadoPagoSub = 'pendiente';
        }
        return {
          ...sub,
          estadoPago: estadoPagoSub,
          fechaPago: estadoPagoSub === 'pagado' ? (sub.fechaPago ?? new Date()) : sub.fechaPago,
        };
      });

      const todasPagadas = updates.subOrdenes.every((s: any) => s.estadoPago === 'pagado');
      const algunaConPago = updates.subOrdenes.some(
        (s: any) => s.estadoPago === 'pagado' || s.estadoPago === 'parcial'
      );
      updates.estadoPago = todasPagadas ? 'pagado' : (algunaConPago ? 'parcial' : 'pendiente');
    } else {
      // Sin sub-órdenes: derivación clásica por total agregado
      updates.estadoPago = pendienteUSD <= 0.01 ? 'pagado' : (totalPagadoUSD > 0.01 ? 'parcial' : 'pendiente');
    }

    if (updates.estadoPago === 'pagado') {
      updates.fechaPago = Timestamp.fromDate(fechaPago);
      updates.totalPEN = orden.totalUSD * tipoCambio;

      if (orden.tcCompra) {
        const costoEnCompra = orden.totalUSD * orden.tcCompra;
        const costoEnPago = orden.totalUSD * tipoCambio;
        updates.diferenciaCambiaria = costoEnPago - costoEnCompra;
      }
    }

    // Firestore no acepta undefined — limpiar recursivamente
    const removeUndefined = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(removeUndefined);
      if (obj && typeof obj === 'object' && typeof obj.toDate !== 'function' && !(obj instanceof Date)) {
        const result: any = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v !== undefined) result[k] = removeUndefined(v);
        }
        return result;
      }
      return obj;
    };

    await updateDoc(doc(db, ORDENES_COLLECTION, id), removeUndefined(updates));

    // Register in Tesorería (non-blocking)
    try {
      const esPagoCompleto = updates.estadoPago === 'pagado';

      // S41 Bloque 5 — Deudor alternativo: el concepto del movimiento refleja al
      // destinatario real del pago (colaborador si adelantó pago al proveedor,
      // proveedor en caso contrario).
      const esDeudorAlternativo =
        orden.deudorTipo === 'colaborador' && !!orden.deudorId;
      const destinatarioNombre = esDeudorAlternativo
        ? orden.deudorNombre || 'Colaborador'
        : orden.nombreProveedor;
      const conceptoSufijo = esDeudorAlternativo
        ? `${destinatarioNombre} (adelantó pago a ${orden.nombreProveedor})`
        : destinatarioNombre;

      const movimientoData: any = {
        tipo: 'pago_orden_compra',
        moneda: monedaPago,
        monto: montoOriginal,
        tipoCambio,
        metodo: metodoPago,
        referencia,
        concepto: `Pago ${esPagoCompleto ? 'completo' : 'parcial'} OC ${orden.numeroOrden} - ${conceptoSufijo}`,
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
    } catch (tesoreriaError: any) {
      logger.error('Error registrando pago OC en tesorería:', tesoreriaError);
      // Marcar el pago con error de tesorería para reconciliación posterior
      nuevoPago.errorTesoreria = true;
      nuevoPago.errorTesoreriaMsg = tesoreriaError?.message || 'Error desconocido';
      try {
        const pagosConError = [...historialPagos, nuevoPago];
        await updateDoc(doc(db, ORDENES_COLLECTION, id), { historialPagos: pagosConError });
      } catch (updateErr) {
        logger.error('Error marcando pago OC con errorTesoreria:', updateErr);
      }
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
