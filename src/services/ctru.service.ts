import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { unidadService } from './unidad.service';
import { ProductoService } from './producto.service';
import { getCTRU, getCostoBasePEN } from '../utils/ctru.utils';
import { ctruLockService } from './ctruLock.service';
import type { Unidad } from '../types/unidad.types';
import { ESTADOS_ACTIVOS } from '../types/unidad.types';
import { logger } from '../lib/logger';

/**
 * Servicio para calculo y actualizacion del CTRU (Costo Total Real por Unidad)
 *
 * REINGENIERIA (Acuerdo 3):
 * CTRU = Precio producto (de OC) + Costos Landed (de Envio)
 * GA/GO ya NO se incluyen — son "Gastos Fijos del Mes" en el P&L.
 *
 * ctruInicial: (costoUnitarioUSD + costoFleteUSD) x TC + costosLanded — INMUTABLE
 * ctruDinamico: igual a ctruInicial (ya no cambia con GA/GO)
 */

const BATCH_LIMIT = 450;

export const ctruService = {
  /**
   * Recalcular CTRU de todas las unidades.
   * REINGENIERIA: ya no distribuye GA/GO. Solo recalcula costoBase limpio.
   * Mantiene la interfaz publica para backward compat.
   */
  async recalcularCTRUDinamico(): Promise<{
    unidadesActualizadas: number;
    gastosAplicados: number;
    impactoPorUnidad: number;
    modoDual: boolean;
  }> {
    try {
      const todasUnidades = await unidadService.getAllIncluyendoHistoricas();

      const allOps: Array<{ ref: any; data: any }> = [];
      let actualizadas = 0;

      for (const unidad of todasUnidades) {
        if (unidad.estado === 'vendida' || ESTADOS_ACTIVOS.includes(unidad.estado)) {
          const costoBase = getCostoBasePEN(unidad);
          const ctruLimpio = costoBase;

          const updateData: Record<string, unknown> = {
            ctruDinamico: ctruLimpio,
            ctruContable: ctruLimpio,
            ctruGerencial: ctruLimpio,
          };

          // Corregir ctruInicial SOLO hacia arriba y contra el CTRU REAL completo
          // (getCTRU incluye landed/componentes con signo, p.ej. descuentos negativos).
          // NEW-1: antes comparaba contra (producto+flete) SIN landed, así un descuento
          // neto (landed negativo) hacía costoConFlete > ctruInicial y se pisaba el
          // ctruInicial hacia arriba, borrando el descuento del costo "inmutable".
          const ctruReal = getCTRU(unidad);
          if (unidad.ctruInicial && ctruReal > unidad.ctruInicial + 0.01) {
            updateData.ctruInicial = ctruReal;
          }

          allOps.push({ ref: doc(db, COLLECTIONS.UNIDADES, unidad.id), data: updateData });
          actualizadas++;
        }
      }

      // Ejecutar en batches
      for (let i = 0; i < allOps.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = allOps.slice(i, i + BATCH_LIMIT);
        for (const op of chunk) {
          batch.update(op.ref, op.data);
        }
        await batch.commit();
      }

      // Actualizar CTRU promedio de productos
      await this.actualizarCTRUPromedioProductos();

      logger.info(`CTRU recalculado (sin GA/GO): ${actualizadas} unidades actualizadas`);

      return {
        unidadesActualizadas: actualizadas,
        gastosAplicados: 0,
        impactoPorUnidad: 0,
        modoDual: true
      };
    } catch (error: any) {
      logger.error('Error al recalcular CTRU:', error);
      throw new Error(`Error al recalcular CTRU: ${error.message}`);
    }
  },

  /**
   * Recalculo CTRU con proteccion de lock.
   */
  async recalcularCTRUDinamicoSafe(): Promise<{
    unidadesActualizadas: number;
    gastosAplicados: number;
    impactoPorUnidad: number;
  } | null> {
    return ctruLockService.executeWithLock(() => this.recalcularCTRUDinamico());
  },

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
