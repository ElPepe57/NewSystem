/**
 * cotizacion.adelanto.service.ts
 * Adelanto flow: registrarPagoAdelanto (with multi-warehouse stock reservation)
 * and the deprecated registrarAdelanto shim.
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
import type {
  Cotizacion,
  EstadoCotizacion,
  RegistrarAdelantoData,
  AdelantoPagado,
  ReservaStockCotizacion
} from '../types/cotizacion.types';
import type {
  TipoReserva,
  ProductoReservado,
  ProductoStockVirtual,
  MetodoPago
} from '../types/venta.types';
import type { MetodoTesoreria } from '../types/tesoreria.types';
import { COLLECTIONS } from '../config/collections';
import { ProductoService } from './producto.service';
import { stockDisponibilidadService } from './stockDisponibilidad.service';
import { expectativaService } from './expectativa.service';
import { tipoCambioService } from './tipoCambio.service';
import { tesoreriaService } from './tesoreria.service';
import { logger } from '../lib/logger';

export async function registrarPagoAdelanto(
  id: string,
  data: RegistrarAdelantoData,
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<{
  tipoReserva: TipoReserva;
  productosReservados: ProductoReservado[];
  productosVirtuales?: ProductoStockVirtual[];
  requerimientosGenerados?: Array<{ id: string; numero: string }>;
}> {
  try {
    const cotizacion = await getCotizacionById(id);
    if (!cotizacion) throw new Error('Cotización no encontrada');

    if (cotizacion.estado !== 'pendiente_adelanto') {
      throw new Error('Solo se puede registrar pago en cotizaciones con adelanto pendiente');
    }
    if (data.monto <= 0) throw new Error('El monto del pago debe ser mayor a 0');

    const consultaDisponibilidad = await stockDisponibilidadService.consultarDisponibilidad({
      productos: cotizacion.productos.map(p => ({
        productoId: p.productoId,
        cantidadRequerida: p.cantidad
      })),
      incluirRecomendacion: true,
      priorizarPeru: true
    });

    const batch = writeBatch(db);
    const productosReservados: ProductoReservado[] = [];
    const productosVirtuales: ProductoStockVirtual[] = [];
    const productosParaRequerimiento: Array<{
      productoId: string;
      sku: string;
      marca: string;
      nombreComercial: string;
      cantidadFaltante: number;
      precioEstimadoUSD?: number;
      impuestoPorcentaje?: number;
      logisticaEstimadaUSD?: number;
      ctruEstimado?: number;
    }> = [];

    let tieneStockFisico = false;
    let tieneFaltantes = false;

    const productosInfo = await Promise.all(
      cotizacion.productos.map(p => ProductoService.getById(p.productoId))
    );
    const productosInfoMap = new Map(
      productosInfo.filter(p => p !== null).map(p => [p!.id, p!])
    );

    for (const producto of cotizacion.productos) {
      const nombreProducto = `${producto.marca} ${producto.nombreComercial}`;
      const disponibilidad = consultaDisponibilidad.productos.find(
        d => d.productoId === producto.productoId
      );

      const productoInfo = productosInfoMap.get(producto.productoId);
      const investigacion = productoInfo?.investigacion;
      const precioEstimadoUSD = investigacion?.precioUSAPromedio || investigacion?.precioUSAMin || undefined;
      const logisticaEstimadaUSD = investigacion?.logisticaEstimada || undefined;
      const ctruEstimado = investigacion?.ctruEstimado || undefined;

      let impuestoPorcentaje: number | undefined;
      if (investigacion?.proveedoresUSA && investigacion.proveedoresUSA.length > 0) {
        const proveedoresConImpuesto = investigacion.proveedoresUSA.filter(p => p.impuesto !== undefined && p.impuesto > 0);
        if (proveedoresConImpuesto.length > 0) {
          impuestoPorcentaje = proveedoresConImpuesto.reduce((sum, p) => sum + (p.impuesto || 0), 0) / proveedoresConImpuesto.length;
        }
      }

      if (!disponibilidad) {
        tieneFaltantes = true;
        productosVirtuales.push({
          productoId: producto.productoId,
          sku: producto.sku,
          nombreProducto,
          cantidadRequerida: producto.cantidad,
          cantidadDisponible: 0,
          cantidadFaltante: producto.cantidad
        });
        productosParaRequerimiento.push({
          productoId: producto.productoId,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          cantidadFaltante: producto.cantidad,
          precioEstimadoUSD,
          impuestoPorcentaje,
          logisticaEstimadaUSD,
          ctruEstimado
        });
        continue;
      }

      const cantidadRequerida = producto.cantidad;
      const cantidadDisponible = disponibilidad.totalLibre;
      const cantidadFaltante = Math.max(0, cantidadRequerida - cantidadDisponible);

      if (disponibilidad.recomendacion && disponibilidad.recomendacion.almacenesRecomendados.length > 0) {
        tieneStockFisico = true;
        const unidadesIds: string[] = [];

        for (const almacenRec of disponibilidad.recomendacion.almacenesRecomendados) {
          const almacenInfo = disponibilidad.almacenes.find(a => a.almacenId === almacenRec.almacenId);
          if (!almacenInfo) continue;

          const unidadesDeEsteAlmacen = almacenInfo.unidadesIds.slice(0, almacenRec.cantidad);
          for (const unidadId of unidadesDeEsteAlmacen) {
            const unidadRef = doc(db, COLLECTIONS.UNIDADES, unidadId);
            batch.update(unidadRef, {
              estado: 'reservada',
              reservadaPara: id,
              fechaReserva: serverTimestamp()
            });
            unidadesIds.push(unidadId);
          }
        }

        if (unidadesIds.length > 0) {
          productosReservados.push({
            productoId: producto.productoId,
            sku: producto.sku,
            cantidad: unidadesIds.length,
            unidadesReservadas: unidadesIds
          });
        }
      }

      if (cantidadFaltante > 0) {
        tieneFaltantes = true;
        productosVirtuales.push({
          productoId: producto.productoId,
          sku: producto.sku,
          nombreProducto,
          cantidadRequerida,
          cantidadDisponible,
          cantidadFaltante
        });
        productosParaRequerimiento.push({
          productoId: producto.productoId,
          sku: producto.sku,
          marca: producto.marca,
          nombreComercial: producto.nombreComercial,
          cantidadFaltante,
          precioEstimadoUSD,
          impuestoPorcentaje,
          logisticaEstimadaUSD,
          ctruEstimado
        });
        if (cantidadDisponible === 0) {
          productosReservados.push({
            productoId: producto.productoId,
            sku: producto.sku,
            cantidad: cantidadRequerida,
            unidadesReservadas: []
          });
        }
      }
    }

    // Generar requerimiento automático si hay faltantes (con anti-duplicados)
    const requerimientosGenerados: Array<{ id: string; numero: string }> = [];
    if (productosParaRequerimiento.length > 0) {
      try {
        const reqsExistentes = await expectativaService.getRequerimientos();
        const reqExistente = reqsExistentes.find(r =>
          r.ventaRelacionadaId === id && r.estado !== 'cancelado'
        );
        if (reqExistente) {
          requerimientosGenerados.push({ id: reqExistente.id!, numero: reqExistente.numeroRequerimiento });
        } else {
          const requerimiento = await expectativaService.crearRequerimientoDesdeCotizacion(
            id,
            cotizacion.numeroCotizacion,
            cotizacion.nombreCliente,
            productosParaRequerimiento,
            userId
          );
          requerimientosGenerados.push(requerimiento);
        }
      } catch (reqError) {
        logger.warn('No se pudo crear requerimiento automático:', reqError);
      }
    }

    const tipoReserva: TipoReserva = (tieneStockFisico && !tieneFaltantes) ? 'fisica' : 'virtual';

    const monedaPago = data.moneda || 'PEN';
    const adelantoPagado: AdelantoPagado = {
      id: `ADL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      monto: data.monto,
      moneda: monedaPago,
      metodoPago: data.metodoPago,
      fecha: Timestamp.now(),
      registradoPor: userId
    };
    if (monedaPago === 'USD' && data.tipoCambio) {
      adelantoPagado.tipoCambio = data.tipoCambio;
      adelantoPagado.montoEquivalentePEN = data.montoEquivalentePEN;
    }
    if (data.referencia) adelantoPagado.referencia = data.referencia;
    if (data.cuentaDestinoId) adelantoPagado.cuentaDestinoId = data.cuentaDestinoId;

    const nuevaVigencia = new Date();
    nuevaVigencia.setDate(nuevaVigencia.getDate() + 90);

    const reservaStock: ReservaStockCotizacion = {
      activo: true,
      tipoReserva,
      fechaReserva: Timestamp.now(),
      vigenciaHasta: Timestamp.fromDate(nuevaVigencia),
      horasVigencia: 90 * 24,
      productosReservados
    };

    if (productosVirtuales.length > 0) {
      reservaStock.stockVirtual = {
        productosVirtuales,
        requerimientoId: requerimientosGenerados[0]?.id,
        fechaEstimadaStock: requerimientosGenerados.length > 0
          ? Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
          : undefined
      };
    }

    const cotizacionRef = doc(db, COLLECTION_NAME, id);
    const updateData: Record<string, any> = {
      estado: 'adelanto_pagado' as EstadoCotizacion,
      fechaAdelanto: serverTimestamp(),
      adelanto: adelantoPagado,
      reservaStock,
      diasVigencia: 90,
      fechaVencimiento: Timestamp.fromDate(nuevaVigencia),
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    if (requerimientosGenerados.length > 0) {
      updateData.requerimientosIds = requerimientosGenerados.map(r => r.id);
      updateData.requerimientosNumeros = requerimientosGenerados.map(r => r.numero);
    }

    batch.update(cotizacionRef, updateData);
    await batch.commit();

    // Registrar movimiento en Tesorería (si hay cuenta destino)
    if (data.cuentaDestinoId) {
      try {
        const metodoTesoreriaMap: Record<MetodoPago, MetodoTesoreria> = {
          'yape': 'yape',
          'plin': 'plin',
          'transferencia': 'transferencia_bancaria',
          'efectivo': 'efectivo',
          'tarjeta': 'tarjeta',
          'mercado_pago': 'mercado_pago',
          'paypal': 'paypal',
          'zelle': 'zelle',
          'otro': 'otro'
        };

        let tcParaMovimiento = data.tipoCambio || 1;
        if (!data.tipoCambio) {
          tcParaMovimiento = await tipoCambioService.resolverTCVenta();
        }

        const montoMovimiento = data.monto;
        const monedaMovimiento = monedaPago;
        const conceptoMovimiento = `Adelanto cotización ${cotizacion.numeroCotizacion} - ${cotizacion.nombreCliente}`;

        await tesoreriaService.registrarMovimiento({
          tipo: 'ingreso_anticipo',
          moneda: monedaMovimiento,
          monto: montoMovimiento,
          tipoCambio: tcParaMovimiento,
          metodo: metodoTesoreriaMap[data.metodoPago] || 'otro',
          referencia: data.referencia,
          concepto: conceptoMovimiento,
          fecha: new Date(),
          cuentaDestino: data.cuentaDestinoId,
          cotizacionId: id,
          cotizacionNumero: cotizacion.numeroCotizacion,
          notas: monedaPago === 'USD'
            ? `Pago en USD. Equivalente PEN: S/ ${data.montoEquivalentePEN?.toFixed(2) || 'N/A'}`
            : undefined
        }, userId);
      } catch (tesoreriaError) {
        logger.warn('No se pudo registrar en tesorería:', tesoreriaError);
      }
    }

    return {
      tipoReserva,
      productosReservados,
      productosVirtuales: productosVirtuales.length > 0 ? productosVirtuales : undefined,
      requerimientosGenerados: requerimientosGenerados.length > 0 ? requerimientosGenerados : undefined
    };
  } catch (error: any) {
    logger.error('Error al registrar pago de adelanto:', error);
    throw new Error(error.message || 'Error al registrar pago de adelanto');
  }
}

/** @deprecated Usar comprometerAdelanto + registrarPagoAdelanto */
export async function registrarAdelanto(
  id: string,
  data: RegistrarAdelantoData & { horasVigencia?: number },
  userId: string,
  getCotizacionById: (id: string) => Promise<Cotizacion | null>
): Promise<{
  tipoReserva: TipoReserva;
  productosReservados: ProductoReservado[];
  productosVirtuales?: ProductoStockVirtual[];
  requerimientosGenerados?: Array<{ id: string; numero: string }>;
}> {
  return registrarPagoAdelanto(id, data, userId, getCotizacionById);
}
