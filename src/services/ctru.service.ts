import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { unidadService } from './unidad.service';
import { ProductoService } from './producto.service';
import { getCTRU } from '../utils/ctru.utils';
import type { Unidad } from '../types/unidad.types';
import { ESTADOS_ACTIVOS } from '../types/unidad.types';
import { logger } from '../lib/logger';

/**
 * Servicio de agregados de CTRU a nivel PRODUCTO.
 *
 * El CTRU por unidad NO se recalcula ni se persiste como escalar: vive en
 * `componentesCosto[]` (congelado en la recepción) y se lee con getCTRU
 * (limpieza 2026-07 · fuente única · el antiguo recalcularCTRUDinamico que
 * escribía ctruInicial/ctruDinamico/ctruContable/ctruGerencial fue eliminado).
 *
 * GA/GO no tocan el CTRU (Acuerdo 3): son "Gastos Fijos del Mes" en el P&L.
 */

const BATCH_LIMIT = 450;

export const ctruService = {
  /**
   * Actualizar CTRU promedio de todos los productos.
   * Basado en las unidades activas (disponible, reservada, asignada_venta).
   */
  async actualizarCTRUPromedioProductos(): Promise<number> {
    try {
      const [productos, todasLasUnidades] = await Promise.all([
        ProductoService.getAll(false, Infinity),
        unidadService.getAllIncluyendoHistoricas()
      ]);

      const unidadesActivasPorProducto = new Map<string, Unidad[]>();
      for (const u of todasLasUnidades) {
        if (ESTADOS_ACTIVOS.includes(u.estado) ||
            // Legacy compat
            u.estado === 'disponible_peru' ||
            u.estado === 'recibida_origen' || u.estado === 'recibida_usa') {
          const pid = u.productoId;
          if (!unidadesActivasPorProducto.has(pid)) {
            unidadesActivasPorProducto.set(pid, []);
          }
          unidadesActivasPorProducto.get(pid)!.push(u);
        }
      }

      let productosActualizados = 0;
      let batch = writeBatch(db);
      let opsEnBatch = 0;

      for (const producto of productos) {
        const unidadesActivas = unidadesActivasPorProducto.get(producto.id);
        if (!unidadesActivas || unidadesActivas.length === 0) continue;

        const sumaCTRU = unidadesActivas.reduce((sum, u) => sum + getCTRU(u), 0);
        const ctruPromedio = sumaCTRU / unidadesActivas.length;

        batch.update(doc(db, COLLECTIONS.PRODUCTOS, producto.id), { ctruPromedio });
        productosActualizados++;
        opsEnBatch++;

        if (opsEnBatch >= BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          opsEnBatch = 0;
        }
      }

      if (opsEnBatch > 0) {
        await batch.commit();
      }

      return productosActualizados;
    } catch (error: any) {
      logger.error('Error al actualizar CTRU promedio de productos:', error);
      throw new Error(`Error al actualizar CTRU promedio de productos: ${error.message}`);
    }
  },

  /**
   * Obtener el CTRU actual de un producto (promedio de unidades activas)
   */
  async getCTRUProducto(productoId: string): Promise<{
    ctruPromedio: number;
    unidadesActivas: number;
    ctruMinimo: number;
    ctruMaximo: number;
  }> {
    try {
      const todasUnidades = await unidadService.buscar({ productoId });

      const unidadesActivas = todasUnidades.filter(u =>
        ESTADOS_ACTIVOS.includes(u.estado) ||
        u.estado === 'disponible_peru' ||
        u.estado === 'recibida_origen' || u.estado === 'recibida_usa'
      );

      if (unidadesActivas.length === 0) {
        return { ctruPromedio: 0, unidadesActivas: 0, ctruMinimo: 0, ctruMaximo: 0 };
      }

      const ctrus = unidadesActivas.map(u => getCTRU(u));
      const sumaCTRU = ctrus.reduce((sum, c) => sum + c, 0);

      return {
        ctruPromedio: sumaCTRU / unidadesActivas.length,
        unidadesActivas: unidadesActivas.length,
        ctruMinimo: Math.min(...ctrus),
        ctruMaximo: Math.max(...ctrus)
      };
    } catch (error: any) {
      logger.error('Error al obtener CTRU de producto:', error);
      throw new Error(`Error al obtener CTRU de producto: ${error.message}`);
    }
  },
};
