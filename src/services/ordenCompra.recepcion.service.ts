/**
 * ordenCompra.recepcion.service.ts
 *
 * Partial/full reception of purchase orders and the reversion utility.
 *   recibirOrdenParcial
 *   recibirOrden
 *   revertirRecepciones
 */

import {
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import type { RecepcionParcial } from '../types/ordenCompra.types';
import { ProductoService } from './producto.service';
import { inventarioService } from './inventario.service';
import { unidadService } from './unidad.service';
import { almacenService } from './almacen.service';
import { requerimientoService } from './requerimiento.service';
import { ctruService } from './ctru.service';
import { actividadService } from './actividad.service';
import { ORDENES_COLLECTION } from './ordenCompra.shared';
import { getById } from './ordenCompra.crud.service';

export async function recibirOrdenParcial(
  id: string,
  productosRecibidos: Array<{ productoId: string; cantidadRecibida: number }>,
  userId: string,
  observaciones?: string
): Promise<{
  recepcionId: string;
  unidadesGeneradas: string[];
  unidadesReservadas: string[];
  unidadesDisponibles: string[];
  esRecepcionFinal: boolean;
  cotizacionVinculada?: string;
}> {
  try {
    const orden = await getById(id);
    if (!orden) throw new Error('Orden no encontrada');

    if (!['en_transito', 'enviada', 'recibida_parcial'].includes(orden.estado)) {
      throw new Error(
        'La orden debe estar enviada, en tránsito o recibida parcial para recibir productos'
      );
    }

    const tcAplicable = orden.tcPago ?? orden.tcCompra;
    if (!tcAplicable) throw new Error('Se requiere tipo de cambio para generar inventario');
    if (!orden.almacenDestino) throw new Error('Se requiere almacén destino para generar inventario');

    const productosValidos = productosRecibidos.filter(pr => pr.cantidadRecibida > 0);
    if (productosValidos.length === 0) {
      throw new Error('Debe recibir al menos 1 producto con cantidad mayor a 0');
    }

    for (const pr of productosValidos) {
      const productoOC = orden.productos.find(p => p.productoId === pr.productoId);
      if (!productoOC) throw new Error(`Producto ${pr.productoId} no existe en esta orden`);
      const yaRecibido = productoOC.cantidadRecibida || 0;
      const pendiente = productoOC.cantidad - yaRecibido;
      if (pr.cantidadRecibida > pendiente) {
        throw new Error(
          `${productoOC.nombreComercial}: no se pueden recibir ${pr.cantidadRecibida} unidades, solo quedan ${pendiente} pendientes`
        );
      }
    }

    // Build reservation map from requirements
    const reservationMap = new Map<
      string,
      Array<{ requerimientoId: string; cotizacionId: string; cantidad: number }>
    >();

    const reqIds: string[] = [];
    if (orden.requerimientoIds && orden.requerimientoIds.length > 0) {
      reqIds.push(...orden.requerimientoIds);
    } else if (orden.requerimientoId) {
      reqIds.push(orden.requerimientoId);
    }

    let cotizacionId: string | undefined;

    for (const reqId of reqIds) {
      try {
        const req = await requerimientoService.getRequerimientoById(reqId);
        if (!req) continue;

        const cotId = req.ventaRelacionadaId || '';
        if (cotId && !cotizacionId) cotizacionId = cotId;

        const productosDeEsteReq =
          orden.productosOrigen?.filter(po => po.requerimientoId === reqId) ||
          req.productos.map((p: any) => ({
            productoId: p.productoId,
            cantidad: p.cantidadSolicitada
          }));

        for (const prod of productosDeEsteReq) {
          const existing = reservationMap.get(prod.productoId) || [];
          existing.push({ requerimientoId: reqId, cotizacionId: cotId, cantidad: prod.cantidad });
          reservationMap.set(prod.productoId, existing);
        }
      } catch (error) {
        logger.error(`Error al obtener requerimiento ${reqId}:`, error);
      }
    }

    // Cost proration
    const totalUnidadesOrden = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
    const costoBaseTotal = orden.productos.reduce(
      (sum, p) => sum + p.costoUnitario * p.cantidad,
      0
    );
    const impuestoPorUnidad =
      totalUnidadesOrden > 0 ? (orden.impuestoCompraUSD ?? orden.impuestoUSD ?? 0) / totalUnidadesOrden : 0;
    const costosProrrateo =
      (orden.costoEnvioProveedorUSD ?? orden.gastosEnvioUSD ?? 0) +
      (orden.otrosGastosCompraUSD ?? orden.otrosGastosUSD ?? 0) -
      (orden.descuentoUSD || 0);

    const getCostoAdicional = (costoUnitario: number): number => {
      const proporcional =
        costoBaseTotal > 0 ? costosProrrateo * (costoUnitario / costoBaseTotal) : 0;
      return impuestoPorUnidad + proporcional;
    };

    const costoAdicionalPorUnidad =
      totalUnidadesOrden > 0
        ? ((orden.impuestoCompraUSD ?? orden.impuestoUSD ?? 0) + costosProrrateo) / totalUnidadesOrden
        : 0;

    const unidadesGeneradas: string[] = [];
    const unidadesReservadas: string[] = [];
    const unidadesDisponibles: string[] = [];
    let totalUnidadesRecepcion = 0;

    const almacen = await almacenService.getById(orden.almacenDestino);
    if (!almacen) throw new Error(`Almacén ${orden.almacenDestino} no encontrado`);
    const almacenInfo = { nombre: almacen.nombre, pais: almacen.pais };

    for (const pr of productosValidos) {
      const productoOC = orden.productos.find(p => p.productoId === pr.productoId)!;
      const productoInfo = await ProductoService.getById(pr.productoId);
      if (!productoInfo) throw new Error(`Producto ${pr.productoId} no encontrado`);

      const costoUnitarioReal =
        productoOC.costoUnitario + getCostoAdicional(productoOC.costoUnitario);

      const reservations = reservationMap.get(pr.productoId) || [];
      const yaRecibidoEsteProducto = productoOC.cantidadRecibida || 0;

      let totalReservaRequerida = 0;
      for (const res of reservations) totalReservaRequerida += res.cantidad;
      const yaReservadoPrevio = Math.min(totalReservaRequerida, yaRecibidoEsteProducto);
      const reservaPendiente = totalReservaRequerida - yaReservadoPrevio;

      let unidadesRestantes = pr.cantidadRecibida;

      const datosBaseLote = {
        productoId: pr.productoId,
        lote: `OC-${orden.numeroOrden}`,
        fechaVencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        almacenId: orden.almacenDestino,
        costoUnitarioUSD: costoUnitarioReal,
        ordenCompraId: id,
        ordenCompraNumero: orden.numeroOrden,
        fechaRecepcion: new Date(),
        tcCompra: orden.tcCompra,
        tcPago: orden.tcPago
      };

      if (reservaPendiente > 0 && reservations.length > 0) {
        let reservaPendienteRestante = reservaPendiente;
        let yaConsumidoPrevio = yaReservadoPrevio;

        for (const reserva of reservations) {
          if (unidadesRestantes <= 0 || reservaPendienteRestante <= 0) break;
          if (!reserva.cotizacionId) continue;

          const consumidoDeEstaReserva = Math.min(reserva.cantidad, yaConsumidoPrevio);
          yaConsumidoPrevio -= consumidoDeEstaReserva;
          const pendienteDeEstaReserva = reserva.cantidad - consumidoDeEstaReserva;
          if (pendienteDeEstaReserva <= 0) continue;

          const cantReservar = Math.min(pendienteDeEstaReserva, unidadesRestantes);

          const reservadasIds = await unidadService.crearLote(
            {
              ...datosBaseLote,
              cantidad: cantReservar,
              estadoInicial: 'reservada',
              reservadoPara: reserva.cotizacionId,
              requerimientoId: reserva.requerimientoId
            },
            userId,
            { sku: productoInfo.sku, nombre: productoInfo.nombreComercial },
            almacenInfo
          );

          unidadesGeneradas.push(...reservadasIds);
          unidadesReservadas.push(...reservadasIds);
          unidadesRestantes -= cantReservar;
          reservaPendienteRestante -= cantReservar;

          logger.success(
            `  → ${cantReservar} unidades de ${productoInfo.sku} RESERVADAS para cotización ${reserva.cotizacionId}`
          );
        }
      }

      if (unidadesRestantes > 0) {
        const disponiblesIds = await unidadService.crearLote(
          { ...datosBaseLote, cantidad: unidadesRestantes },
          userId,
          { sku: productoInfo.sku, nombre: productoInfo.nombreComercial },
          almacenInfo
        );
        unidadesGeneradas.push(...disponiblesIds);
        unidadesDisponibles.push(...disponiblesIds);
      }

      totalUnidadesRecepcion += pr.cantidadRecibida;
    }

    // Calculate CTRU for the new batch
    if (unidadesGeneradas.length > 0) {
      try {
        const ctruCalculadas = await ctruService.calcularCTRULote(unidadesGeneradas, id);
        logger.success(`  → CTRU inicial calculado para ${ctruCalculadas} unidades`);
      } catch (ctruError) {
        logger.error('Error al calcular CTRU de lote (no bloqueante):', ctruError);
      }
    }

    // Update received quantities on OC products
    const productosActualizados = orden.productos.map(p => {
      const recibido = productosValidos.find(pr => pr.productoId === p.productoId);
      if (recibido) {
        return { ...p, cantidadRecibida: (p.cantidadRecibida || 0) + recibido.cantidadRecibida };
      }
      return p;
    });

    const esRecepcionFinal = productosActualizados.every(
      p => (p.cantidadRecibida || 0) >= p.cantidad
    );

    const recepcionesPrevias = orden.recepcionesParciales || [];
    const recepcionNumero = recepcionesPrevias.length + 1;
    const recepcionId = `REC-${Date.now()}`;

    const nuevaRecepcion: RecepcionParcial = {
      id: recepcionId,
      fecha: Timestamp.now(),
      numero: recepcionNumero,
      productosRecibidos: productosValidos.map(pr => {
        const productoOC = orden.productos.find(p => p.productoId === pr.productoId)!;
        return {
          productoId: pr.productoId,
          cantidadRecibida: pr.cantidadRecibida,
          cantidadAcumulada: (productoOC.cantidadRecibida || 0) + pr.cantidadRecibida
        };
      }),
      unidadesGeneradas,
      unidadesReservadas,
      unidadesDisponibles,
      totalUnidadesRecepcion,
      costoAdicionalPorUnidad,
      registradoPor: userId,
      ...(observaciones ? { observaciones } : {})
    };

    // Update warehouse counters
    const valorRecepcionUSD = productosValidos.reduce((sum, pr) => {
      const productoOC = orden.productos.find(p => p.productoId === pr.productoId)!;
      return (
        sum +
        pr.cantidadRecibida *
          (productoOC.costoUnitario + getCostoAdicional(productoOC.costoUnitario))
      );
    }, 0);

    await almacenService.incrementarUnidadesRecibidas(
      orden.almacenDestino,
      totalUnidadesRecepcion
    );
    await almacenService.actualizarValorInventario(orden.almacenDestino, valorRecepcionUSD);

    // Sync stock
    const productosAfectados = productosValidos.map(pr => pr.productoId);
    await inventarioService.sincronizarStockProductos_batch(productosAfectados);

    // Push to ML (fire-and-forget)
    try {
      const { mercadoLibreService } = await import('./mercadoLibre.service');
      for (const pid of productosAfectados) {
        mercadoLibreService
          .syncStock(pid)
          .catch(e => logger.warn(`ML sync failed for ${pid} after OC reception:`, e.message));
      }
    } catch {
      // ML not configured — do not block OC
    }

    // Update OC document
    const todasUnidadesGeneradas = [...(orden.unidadesGeneradas || []), ...unidadesGeneradas];
    const totalUnidadesRecibidasGlobal =
      (orden.totalUnidadesRecibidas || 0) + totalUnidadesRecepcion;

    const ocUpdates: any = {
      productos: productosActualizados,
      recepcionesParciales: [...recepcionesPrevias, nuevaRecepcion],
      unidadesGeneradas: todasUnidadesGeneradas,
      totalUnidadesRecibidas: totalUnidadesRecibidasGlobal,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    if (esRecepcionFinal) {
      ocUpdates.estado = 'recibida';
      ocUpdates.fechaRecibida = Timestamp.now();
      ocUpdates.inventarioGenerado = true;
      ocUpdates.cotizacionVinculada = cotizacionId || null;
    } else {
      ocUpdates.estado = 'recibida_parcial';
      if (!orden.fechaPrimeraRecepcion) ocUpdates.fechaPrimeraRecepcion = Timestamp.now();
    }

    await updateDoc(doc(db, ORDENES_COLLECTION, id), ocUpdates);

    // Mark requirements as completed on final reception
    if (esRecepcionFinal) {
      for (const reqId of reqIds) {
        try {
          await requerimientoService.actualizarEstado(reqId, 'completado', userId);
        } catch (error) {
          logger.error(`Error al marcar requerimiento ${reqId} como completado:`, error);
        }
      }
    }

    logger.success(
      `OC ${orden.numeroOrden} - Recepción #${recepcionNumero}: ${totalUnidadesRecepcion} unidades (${unidadesReservadas.length} reservadas, ${unidadesDisponibles.length} disponibles)${esRecepcionFinal ? ' - RECEPCIÓN FINAL' : ''}`
    );

    actividadService
      .registrar({
        tipo: 'oc_recibida',
        mensaje: `OC ${orden.numeroOrden} - Recepción #${recepcionNumero}: ${totalUnidadesRecepcion} unidades${esRecepcionFinal ? ' (FINAL)' : ''}`,
        userId,
        displayName: userId,
        metadata: { entidadId: id, entidadTipo: 'ordenCompra' }
      })
      .catch(() => {});

    return {
      recepcionId,
      unidadesGeneradas,
      unidadesReservadas,
      unidadesDisponibles,
      esRecepcionFinal,
      cotizacionVinculada: cotizacionId
    };
  } catch (error: any) {
    logger.error('Error al recibir orden parcial:', error);
    throw new Error(error.message || 'Error al recibir orden parcial');
  }
}

export async function recibirOrden(
  id: string,
  userId: string
): Promise<{
  unidadesGeneradas: string[];
  unidadesReservadas: string[];
  unidadesDisponibles: string[];
  cotizacionVinculada?: string;
}> {
  const orden = await getById(id);
  if (!orden) throw new Error('Orden no encontrada');

  const productosRecibidos = orden.productos
    .map(p => ({
      productoId: p.productoId,
      cantidadRecibida: p.cantidad - (p.cantidadRecibida || 0)
    }))
    .filter(p => p.cantidadRecibida > 0);

  if (productosRecibidos.length === 0) {
    throw new Error('Todos los productos ya fueron recibidos');
  }

  const result = await recibirOrdenParcial(id, productosRecibidos, userId, 'Recepción completa');

  return {
    unidadesGeneradas: result.unidadesGeneradas,
    unidadesReservadas: result.unidadesReservadas,
    unidadesDisponibles: result.unidadesDisponibles,
    cotizacionVinculada: result.cotizacionVinculada
  };
}

export async function revertirRecepciones(
  ordenId: string,
  userId: string
): Promise<{
  unidadesEliminadas: number;
  recepcionesEliminadas: number;
  estadoRestaurado: string;
}> {
  try {
    const orden = await getById(ordenId);
    if (!orden) throw new Error('Orden no encontrada');

    if (!['recibida_parcial', 'recibida'].includes(orden.estado)) {
      throw new Error('La orden no tiene recepciones que revertir');
    }

    const recepciones = orden.recepcionesParciales || [];
    const todasUnidadesGeneradas = orden.unidadesGeneradas || [];

    // Delete generated units in batches
    let unidadesEliminadas = 0;
    const batchSize = 400;
    for (let i = 0; i < todasUnidadesGeneradas.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = todasUnidadesGeneradas.slice(i, i + batchSize);
      for (const unidadId of chunk) {
        batch.delete(doc(db, COLLECTIONS.UNIDADES, unidadId));
        unidadesEliminadas++;
      }
      await batch.commit();
    }

    // Calculate value to subtract from warehouse
    const totalUnidadesOrden = orden.productos.reduce((sum, p) => sum + p.cantidad, 0);
    const costoBaseTotal = orden.productos.reduce(
      (sum, p) => sum + p.costoUnitario * p.cantidad,
      0
    );
    const impuestoPorUnidad =
      totalUnidadesOrden > 0 ? (orden.impuestoCompraUSD ?? orden.impuestoUSD ?? 0) / totalUnidadesOrden : 0;
    const costosProrrateo =
      (orden.costoEnvioProveedorUSD ?? orden.gastosEnvioUSD ?? 0) +
      (orden.otrosGastosCompraUSD ?? orden.otrosGastosUSD ?? 0) -
      (orden.descuentoUSD || 0);

    const totalUnidadesRecibidas = orden.totalUnidadesRecibidas || 0;

    if (orden.almacenDestino && totalUnidadesRecibidas > 0) {
      await almacenService.incrementarUnidadesRecibidas(
        orden.almacenDestino,
        -totalUnidadesRecibidas
      );
    }

    const productosRestaurados = orden.productos.map(p => ({ ...p, cantidadRecibida: 0 }));
    const estadoRestaurado = 'en_transito';

    const updates: any = {
      estado: estadoRestaurado,
      productos: productosRestaurados,
      recepcionesParciales: [],
      unidadesGeneradas: [],
      totalUnidadesRecibidas: 0,
      inventarioGenerado: false,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };

    await updateDoc(doc(db, ORDENES_COLLECTION, ordenId), updates);

    const productosAfectados = orden.productos.map(p => p.productoId);
    await inventarioService.sincronizarStockProductos_batch(productosAfectados);

    logger.log(
      `[LIMPIEZA] OC ${orden.numeroOrden}: ${unidadesEliminadas} unidades eliminadas, ${recepciones.length} recepciones revertidas, estado → ${estadoRestaurado}`
    );

    // Suppress unused variable warning for costosProrrateo / impuestoPorUnidad (used in original)
    void costosProrrateo;
    void impuestoPorUnidad;

    return { unidadesEliminadas, recepcionesEliminadas: recepciones.length, estadoRestaurado };
  } catch (error: any) {
    logger.error('Error al revertir recepciones:', error);
    throw new Error(error.message || 'Error al revertir recepciones');
  }
}
