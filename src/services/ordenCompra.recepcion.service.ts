/**
 * ordenCompra.recepcion.service.ts
 *
 * S40: el flujo canónico de recepción se movió a envio.recepcion.service.ts.
 * Este archivo solo preserva `revertirRecepciones` como utilidad administrativa
 * (scripts de limpieza y rollback manual de data legacy).
 */

import {
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';
import { COLLECTIONS } from '../config/collections';
import type { RecepcionParcial } from '../types/ordenCompra.types';
import { ProductoService } from './producto.service';
import { inventarioService } from './inventario.service';
import { unidadService } from './unidad.service';
import { almacenService } from './casilla.service';
import { requerimientoService } from './requerimiento.service';
import { ctruService } from './ctru.service';
import { actividadService } from './actividad.service';
import { ORDENES_COLLECTION } from './ordenCompra.shared';
import { getById } from './ordenCompra.crud.service';
import { calcularEstadoDerivadoOC } from '../utils/ordenCompra.helpers';

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
    const costoBaseTotal = orden.productos.reduce(
      (sum, p) => sum + p.costoUnitario * p.cantidad,
      0
    );
    const impuestoPorUnidad =
      totalUnidadesOrden > 0 ? (orden.impuestoCompraUSD ?? 0) / totalUnidadesOrden : 0;
    const costosProrrateo =
      (orden.costoEnvioProveedorUSD ?? 0) +
      (orden.otrosGastosCompraUSD ?? 0) -
      (orden.descuentoUSD || 0);

    const totalUnidadesRecibidas = orden.totalUnidadesRecibidas || 0;

    if (orden.almacenDestino && totalUnidadesRecibidas > 0) {
      const { casillaCrudService: casillaSvc } = await import('./casilla.crud.service');
      const casDest = await casillaSvc.getById(orden.almacenDestino);
      if (casDest) {
        await casillaSvc.incrementarUnidadesRecibidas(orden.almacenDestino, -totalUnidadesRecibidas);
      } else {
        const almDest = await almacenService.getById(orden.almacenDestino);
        if (almDest) {
          await almacenService.incrementarUnidadesRecibidas(orden.almacenDestino, -totalUnidadesRecibidas);
        }
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
