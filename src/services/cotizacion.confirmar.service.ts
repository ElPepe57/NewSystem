/**
 * cotizacion.confirmar.service.ts
 * Confirmar cotización: creates a Venta, transfers the adelanto payment,
 * transfers stock reservations, and marks the cotizacion as confirmed.
 */
import {
  doc,
  updateDoc,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTION_NAME } from './cotizacion.shared';
import { resolverCanalNombre } from './cotizacion.shared';
import type { Cotizacion, EstadoCotizacion } from '../types/cotizacion.types';
import type { VentaFormData } from '../types/venta.types';
import { COLLECTIONS } from '../config/collections';
import { ProductoService } from './producto.service';
import { VentaService } from './venta.service';
import { tipoCambioService } from './tipoCambio.service';
import { logger } from '../lib/logger';

export async function confirmar(
  id: string,
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<{ ventaId: string; numeroVenta: string }> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) throw new Error('Cotización no encontrada');

    const estadosValidos: EstadoCotizacion[] = ['validada', 'adelanto_pagado', 'con_abono' as EstadoCotizacion];
    if (!estadosValidos.includes(cotizacion.estado)) {
      throw new Error('Solo se pueden confirmar cotizaciones validadas o con adelanto pagado');
    }

    const ventaData: VentaFormData = {
      clienteId: cotizacion.clienteId,
      nombreCliente: cotizacion.nombreCliente,
      emailCliente: cotizacion.emailCliente,
      telefonoCliente: cotizacion.telefonoCliente,
      direccionEntrega: cotizacion.direccionEntrega,
      distrito: cotizacion.distrito,
      provincia: cotizacion.provincia,
      codigoPostal: cotizacion.codigoPostal,
      referencia: cotizacion.referencia,
      coordenadas: cotizacion.coordenadas,
      dniRuc: cotizacion.dniRuc,
      canal: cotizacion.canal,
      canalNombre: await resolverCanalNombre(cotizacion.canal),
      productos: cotizacion.productos.map(p => ({
        productoId: p.productoId,
        cantidad: p.cantidad,
        precioUnitario: p.precioUnitario
      })),
      descuento: cotizacion.descuento,
      costoEnvio: cotizacion.costoEnvio,
      incluyeEnvio: cotizacion.incluyeEnvio,
      observaciones: `Creada desde cotización ${cotizacion.numeroCotizacion}. ${cotizacion.observaciones || ''}`
    };

    // Verificar precios bajo CTRU
    try {
      const productosConCtru = await Promise.all(
        cotizacion.productos.map(async (p) => {
          const producto = await ProductoService.getById(p.productoId);
          return { precioUnitario: p.precioUnitario, ctruPromedio: producto?.ctruPromedio || 0 };
        })
      );
      const hayBajoCosto = productosConCtru.some(
        p => p.ctruPromedio > 0 && p.precioUnitario < p.ctruPromedio
      );
      if (hayBajoCosto) {
        ventaData.ventaBajoCosto = true;
        ventaData.aprobadoPor = userId;
      }
    } catch (ctruError) {
      logger.warn('[confirmar] Error verificando CTRU:', ctruError);
    }

    const tieneReservaStock = cotizacion.reservaStock?.activo === true;
    const esVentaDirectaSinReserva = cotizacion.estado === 'validada' && !tieneReservaStock;

    // Flag para que crear() NO dispare métricas — confirmarCotizacion() las maneja después
    (ventaData as any)._fromCotizacion = true;

    const venta = await VentaService.create(ventaData, userId, esVentaDirectaSinReserva);

    const ventaUpdateData: Record<string, any> = {
      cotizacionOrigenId: id,
      numeroCotizacionOrigen: cotizacion.numeroCotizacion
    };

    if (cotizacion.expectativaCotizacion) {
      ventaUpdateData.expectativaCotizacion = cotizacion.expectativaCotizacion;
    }

    try {
      const tcDataVenta = await tipoCambioService.getTCDelDia();
      if (tcDataVenta) {
        ventaUpdateData.tcVenta = tcDataVenta.venta;
      }
    } catch { /* no bloquear */ }

    await updateDoc(doc(db, COLLECTIONS.VENTAS, venta.id), ventaUpdateData);

    // Transferir adelanto como pago en la venta
    if (cotizacion.adelanto && cotizacion.adelanto.monto > 0) {
      const montoAdelantoPEN = cotizacion.adelanto.montoEquivalentePEN ||
        cotizacion.adelanto.monto * (cotizacion.adelanto.tipoCambio || 1);

      const pagoAdelanto: any = {
        id: `ADL-COT-${Date.now()}`,
        monto: montoAdelantoPEN,
        metodoPago: cotizacion.adelanto.metodoPago,
        fecha: cotizacion.adelanto.fecha || Timestamp.now(),
        registradoPor: userId,
        notas: `Adelanto transferido desde cotización ${cotizacion.numeroCotizacion}`
      };
      if (cotizacion.adelanto.referencia) {
        pagoAdelanto.referencia = cotizacion.adelanto.referencia;
      }

      const nuevoMontoPagado = montoAdelantoPEN;
      const nuevoMontoPendiente = venta.totalPEN - nuevoMontoPagado;
      const nuevoEstadoPago = nuevoMontoPendiente <= 0 ? 'pagado' :
        nuevoMontoPagado > 0 ? 'parcial' : 'pendiente';

      const adelantoComprometidoData: Record<string, any> = {
        monto: cotizacion.adelanto.monto,
        metodoPago: cotizacion.adelanto.metodoPago,
        fechaCompromiso: cotizacion.adelanto.fecha || Timestamp.now(),
        desdeCotizacion: cotizacion.numeroCotizacion,
        montoEquivalentePEN: montoAdelantoPEN,
        transferidoComoPago: true
      };
      if (cotizacion.adelanto.moneda) {
        adelantoComprometidoData.moneda = cotizacion.adelanto.moneda;
      }
      if (cotizacion.adelanto.tipoCambio) {
        adelantoComprometidoData.tipoCambio = cotizacion.adelanto.tipoCambio;
      }

      await updateDoc(doc(db, COLLECTIONS.VENTAS, venta.id), {
        pagos: [pagoAdelanto],
        montoPagado: nuevoMontoPagado,
        montoPendiente: Math.max(0, nuevoMontoPendiente),
        estadoPago: nuevoEstadoPago,
        adelantoComprometido: adelantoComprometidoData
      });

      logger.log(`[Cotización→Venta] Adelanto de S/${montoAdelantoPEN.toFixed(2)} transferido a venta ${venta.numeroVenta}`);
    }

    // Transferir reservas de stock a la venta
    if (cotizacion.reservaStock?.productosReservados) {
      const batch = writeBatch(db);
      for (const prod of cotizacion.reservaStock.productosReservados) {
        for (const unidadId of prod.unidadesReservadas) {
          const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidadId);
          batch.update(unidadRef, {
            reservadaPara: venta.id,
            ventaId: venta.id
          });
        }
      }
      await batch.commit();
    }

    // Marcar cotización como confirmada
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      estado: 'confirmada' as EstadoCotizacion,
      fechaConfirmacion: serverTimestamp(),
      ventaId: venta.id,
      numeroVenta: venta.numeroVenta,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    });

    return { ventaId: venta.id, numeroVenta: venta.numeroVenta };
  } catch (error: any) {
    logger.error('Error al confirmar cotización:', error);
    throw new Error(error.message || 'Error al confirmar cotización');
  }
}
