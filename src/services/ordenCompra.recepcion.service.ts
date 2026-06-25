/**
 * ordenCompra.recepcion.service.ts
 *
 * S40: el flujo canónico de recepción se movió a envio.recepcion.service.ts.
 * Este archivo solo preserva `revertirRecepciones` como utilidad administrativa
 * (scripts de limpieza y rollback manual de data legacy).
 */

import {
  doc,
  getDoc,
  updateDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import { inventarioService } from './inventario.service';
import { actividadService } from './actividad.service';
import { ORDENES_COLLECTION } from './ordenCompra.shared';
import { getById } from './ordenCompra.crud.service';
import { getCargosEfectivosOC } from '../utils/ordenCompra.helpers';
import type { Unidad } from '../types/unidad.types';

// S40 Bloque E: recibirOrden + recibirOrdenParcial eliminados — la recepción se gestiona
// ahora desde el Envío asociado vía envio.recepcion.service.ts::registrarRecepcion().
// El sync Envío→OC actualiza automáticamente el estado de la OC cuando todos sus envíos
// completan (ver envio.recepcion.service.ts:337-390).
//
// revertirRecepciones preservado para uso administrativo (scripts de limpieza).

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
    const ef = getCargosEfectivosOC(orden);
    const impuestoPorUnidad =
      totalUnidadesOrden > 0 ? ef.impuestos / totalUnidadesOrden : 0;
    const costosProrrateo = ef.cargos - ef.descuentos;

    const totalUnidadesRecibidas = orden.totalUnidadesRecibidas || 0;

    if (orden.almacenDestino && totalUnidadesRecibidas > 0) {
      const { casillaCrudService: casillaSvc } = await import('./casilla.crud.service');
      const casDest = await casillaSvc.getById(orden.almacenDestino);
      if (casDest) {
        await casillaSvc.incrementarUnidadesRecibidas(orden.almacenDestino, -totalUnidadesRecibidas);
      }
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

/**
 * CANCELACION_OC · F2 · REVERSA FÍSICA al cancelar una OC.
 *
 * Cuando una OC FIRME se cancela (la mercadería NO va a llegar), las unidades 'pedida'
 * que `confirmarOC` creó quedan HUÉRFANAS (vivas, apuntando a una OC cancelada · ensucian
 * CTRU/conteos/históricos). Esta función las borra y libera las reservas que colgaban de ellas.
 *
 * ⚠️ RUTA DE INVENTARIO · SEGURIDAD POR-UNIDAD: SOLO se borran unidades en estado **'pedida'**
 * (nunca llegaron físicamente). CUALQUIER unidad en un estado recibido/arribado (recibida, en
 * tránsito, disponible_peru, reservada con stock real, asignada, etc.) es inventario REAL y NO
 * se toca — ese territorio es DEVOLUCIÓN, no cancelación.
 *
 * No crea estados de unidad nuevos · no toca `revertirRecepciones` · hard-delete (decisión #1 del spec:
 * una 'pedida' no es inventario real · el rastro vive en la OC cancelada + su motivo).
 *
 * @param ordenId - ID de la OC que se está cancelando
 * @param motivo - motivo de la cancelación (para la actividad · opcional)
 * @param userId - usuario que ejecuta la cancelación
 */
export async function revertirFisicoOC(
  ordenId: string,
  motivo: string | undefined,
  userId: string
): Promise<{
  unidadesBorradas: number;
  reservasLiberadas: number;
  productosAfectados: string[];
}> {
  try {
    const orden = await getById(ordenId);
    if (!orden) throw new Error('Orden no encontrada');

    const idsGenerados = orden.unidadesGeneradas || [];

    // (a) Sin unidades generadas → nada físico que revertir (ej. borrador nunca confirmado).
    if (idsGenerados.length === 0) {
      return { unidadesBorradas: 0, reservasLiberadas: 0, productosAfectados: [] };
    }

    // (b) SEGURIDAD POR-UNIDAD: cargar cada unidad y FILTRAR — SOLO las que están en
    // estado EXACTO 'pedida' (no-recibidas) son candidatas a borrado. Cualquier otro
    // estado (recibido/arribado/reservado real/asignado/en tránsito/etc.) es inventario
    // REAL → NO se toca. El filtro es por igualdad estricta de estado, no por exclusión.
    const idsABorrar: string[] = [];
    const idsNoBorrados: string[] = []; // unidades que siguen en la lista (no eran 'pedida')
    const productosAfectados = new Set<string>();
    let reservasLiberadas = 0;

    for (const unidadId of idsGenerados) {
      const snap = await getDoc(doc(db, COLLECTIONS.UNIDADES, unidadId));
      if (!snap.exists()) {
        // La unidad ya no existe (borrada por otro flujo) → la quitamos de la lista igual.
        continue;
      }
      const unidad = { id: snap.id, ...snap.data() } as Unidad;

      // GUARD DURO: SOLO 'pedida'. Cualquier otro estado se respeta y permanece en la OC.
      if (unidad.estado !== 'pedida') {
        idsNoBorrados.push(unidadId);
        logger.warn(
          `[CANCELACION_OC] Unidad ${unidadId} en estado '${unidad.estado}' (no 'pedida') · ` +
            `NO se borra (inventario real · territorio de devolución). OC ${orden.numeroOrden}.`
        );
        continue;
      }

      // (c) Si la 'pedida' tenía una reserva activa, al borrar la unidad la reserva desaparece
      // con ella (no hace falta liberarUnidades porque el doc se elimina). Solo la contamos.
      const tieneReserva =
        !!unidad.reserva ||
        !!(unidad as { reservadaPara?: string }).reservadaPara ||
        !!(unidad as { reservadoPara?: string }).reservadoPara;
      if (tieneReserva) reservasLiberadas++;

      idsABorrar.push(unidadId);
      if (unidad.productoId) productosAfectados.add(unidad.productoId);
    }

    // (d) Borrar las unidades 'pedida' en batches (mismo patrón que revertirRecepciones).
    let unidadesBorradas = 0;
    const batchSize = 400;
    for (let i = 0; i < idsABorrar.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = idsABorrar.slice(i, i + batchSize);
      for (const unidadId of chunk) {
        batch.delete(doc(db, COLLECTIONS.UNIDADES, unidadId));
        unidadesBorradas++;
      }
      await batch.commit();
    }

    // (e) Quitar los ids borrados de orden.unidadesGeneradas. Si NO queda ninguna unidad
    // generada viva → unidadesGeneradas:[] + inventarioGenerado:false. Si quedan unidades
    // NO-'pedida' (inventario real) → preservamos SOLO esas en la lista (no se tocan).
    const updates: Record<string, unknown> = {
      unidadesGeneradas: idsNoBorrados,
      ultimaEdicion: serverTimestamp(),
      editadoPor: userId
    };
    if (idsNoBorrados.length === 0) {
      updates.inventarioGenerado = false;
    }
    await updateDoc(doc(db, ORDENES_COLLECTION, ordenId), updates);

    // (f) Sincronizar el stock de cada producto afectado (mismo helper que revertirRecepciones).
    const productosAfectadosArr = [...productosAfectados];
    if (productosAfectadosArr.length > 0) {
      await inventarioService.sincronizarStockProductos_batch(productosAfectadosArr);
    }

    // (g) Registrar actividad (no bloqueante · nunca debe fallar la cancelación).
    void actividadService.registrar({
      tipo: 'oc_cancelada',
      mensaje:
        `OC ${orden.numeroOrden || ordenId} cancelada · reversa física: ${unidadesBorradas} ` +
        `unidades pedidas borradas` +
        (reservasLiberadas > 0 ? ` · ${reservasLiberadas} reservas liberadas` : '') +
        (motivo ? ` · motivo: ${motivo}` : ''),
      userId,
      displayName: userId,
      metadata: {
        entidadId: ordenId,
        entidadTipo: 'oc'
      }
    }).catch(() => {});

    logger.log(
      `[CANCELACION_OC] OC ${orden.numeroOrden || ordenId}: ${unidadesBorradas} unidades 'pedida' ` +
        `borradas (${idsNoBorrados.length} preservadas no-'pedida') · ${reservasLiberadas} reservas ` +
        `liberadas · ${productosAfectadosArr.length} productos resincronizados.`
    );

    return {
      unidadesBorradas,
      reservasLiberadas,
      productosAfectados: productosAfectadosArr
    };
  } catch (error: any) {
    logger.error('Error al revertir físico de OC cancelada:', error);
    throw new Error(error.message || 'Error al revertir físico de OC cancelada');
  }
}
