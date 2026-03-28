import { doc, updateDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { unidadService } from './unidad.service';
import { gastoService } from './gasto.service';
import { ProductoService } from './producto.service';
import { getCTRU, getCostoBasePEN, getTC, calcularGAGOProporcional } from '../utils/ctru.utils';
import { ctruLockService } from './ctruLock.service';
import type { Unidad } from '../types/unidad.types';
import type { Gasto } from '../types/gasto.types';
import { esFleteInternacional } from '../utils/multiOrigen.helpers';
import { esEstadoEnOrigen } from '../utils/multiOrigen.helpers';
import { logger } from '../lib/logger';

/**
 * Servicio para cálculo y actualización del CTRU (Costo Total Real por Unidad)
 *
 * CTRU = Costo Base + Costos Prorrateados
 *
 * Costo Base (ctruInicial - INMUTABLE después de recepción):
 * - Costo USD convertido a PEN (con TC pago o TC compra)
 * - Costos de flete USA→Perú (prorrateado por OC)
 *
 * Costos Prorrateados (ctruDinamico - CAMBIA con cada recálculo):
 * - Gastos administrativos (GA)
 * - Gastos operativos (GO)
 */

/** Límite seguro de operaciones por batch de Firestore */
const BATCH_LIMIT = 450;

export const ctruService = {
  /**
   * Calcular CTRU inicial de una unidad al momento de recibirla.
   * Este valor es INMUTABLE - no debe cambiar después de la recepción.
   * Incluye: costo USA en PEN + flete prorrateado de la OC
   */
  async calcularCTRUInicial(unidad: Unidad): Promise<number> {
    try {
      const tc = getTC(unidad);
      if (tc === 0) {
        logger.warn(`[CTRU] Unidad ${unidad.id} sin TC - usando costoUnitarioUSD directo`);
      }
      const costoBasePEN = unidad.costoUnitarioUSD * (tc || 1);

      // Obtener costos de flete de la OC (si existe)
      let costoFletePorUnidad = 0;
      if (unidad.ordenCompraId) {
        costoFletePorUnidad = await this.calcularCostoFleteProrrateado(
          unidad.ordenCompraId,
          unidad.id
        );
      }

      return costoBasePEN + costoFletePorUnidad;
    } catch (error: any) {
      logger.error('Error al calcular CTRU inicial:', error);
      throw new Error(`Error al calcular CTRU inicial: ${error.message}`);
    }
  },

  /**
   * Calcular y guardar CTRU inicial para un lote de unidades recién recibidas.
   * Se llama después de crearLote() en la recepción de OC.
   */
  async calcularCTRULote(unidadIds: string[], ordenCompraId: string): Promise<number> {
    try {
      if (unidadIds.length === 0) return 0;

      // Obtener la primera unidad para calcular flete (es igual para todas del mismo lote)
      const primeraUnidad = await unidadService.getById(unidadIds[0]);
      if (!primeraUnidad) return 0;

      // Calcular flete prorrateado una sola vez
      let costoFletePorUnidad = 0;
      if (ordenCompraId) {
        costoFletePorUnidad = await this.calcularCostoFleteProrrateado(
          ordenCompraId,
          primeraUnidad.id
        );
      }

      const tc = getTC(primeraUnidad);
      const costoBasePEN = primeraUnidad.costoUnitarioUSD * (tc || 1);
      const ctruInicial = costoBasePEN + costoFletePorUnidad;

      // Actualizar todas las unidades del lote en batches
      for (let i = 0; i < unidadIds.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = unidadIds.slice(i, i + BATCH_LIMIT);

        for (const id of chunk) {
          batch.update(doc(db, COLLECTIONS.UNIDADES, id), {
            ctruInicial,
            ctruDinamico: ctruInicial // Inicialmente igual, cambiará con GA/GO
          });
        }

        await batch.commit();
      }

      return unidadIds.length;
    } catch (error: any) {
      logger.error('Error al calcular CTRU de lote:', error);
      return 0;
    }
  },

  /**
   * Calcular costo de flete prorrateado de una OC para una unidad
   */
  async calcularCostoFleteProrrateado(
    ordenCompraId: string,
    unidadId: string
  ): Promise<number> {
    try {
      // Search for both legacy and generic flete types
      const todosGastosOC = await gastoService.buscar({ ordenCompraId });
      const gastosFleteOC = todosGastosOC.filter(g => esFleteInternacional(g.tipo));

      if (gastosFleteOC.length === 0) {
        return 0;
      }

      const totalFlete = gastosFleteOC.reduce((sum, g) => sum + g.montoPEN, 0);
      const unidadesOC = await unidadService.buscar({ ordenCompraId });

      if (unidadesOC.length === 0) {
        return 0;
      }

      return totalFlete / unidadesOC.length;
    } catch (error: any) {
      logger.error('Error al calcular costo de flete prorrateado:', error);
      return 0;
    }
  },

  /**
   * Recalcular CTRU dinámico — GA/GO solo entre unidades VENDIDAS.
   *
   * IMPORTANTE: ctruInicial NO se modifica. Solo ctruDinamico cambia.
   * ctruDinamico = ctruInicial + GA/GO prorrateado proporcionalmente.
   *
   * MODELO FULL-RECALC: Cada ejecución redistribuye TODOS los GA/GO
   * entre TODAS las unidades vendidas. Las unidades activas se resetean
   * (ctruDinamico = costoBase, costoGAGOAsignado = 0).
   *
   * DISTRIBUCIÓN PROPORCIONAL al costo base:
   * costoGAGO_unidad = totalGastosGAGO × (costoBase_unidad / costoBase_total_vendidas)
   *
   * Solo GA (Administrativos) y GO (Operativos) impactan CTRU.
   * GV (Venta) y GD (Distribución) NO impactan CTRU.
   */
  /**
   * CTRU v2 — Recálculo con dual-view (contable + gerencial)
   *
   * VISTA CONTABLE (ctruContable / ctruDinamico):
   *   GA/GO distribuido SOLO entre unidades VENDIDAS, proporcional al costo base.
   *   Para P&L, estados financieros, rentabilidad histórica.
   *
   * VISTA GERENCIAL (ctruGerencial):
   *   GA/GO distribuido entre TODAS las unidades (vendidas + activas), proporcional al costo base.
   *   Para cotizar, fijar precios, alertas de margen.
   *
   * Filtro de gastos respeta los flags impactaCTRU y esProrrateable.
   */
  async recalcularCTRUDinamico(): Promise<{
    unidadesActualizadas: number;
    gastosAplicados: number;
    impactoPorUnidad: number;
    modoDual: boolean;
  }> {
    try {
      // 1. Obtener todas las unidades
      const todasUnidades = await unidadService.getAllIncluyendoHistoricas();
      const unidadesVendidas = todasUnidades.filter(u => u.estado === 'vendida');
      const unidadesActivas = todasUnidades.filter(u =>
        u.estado === 'disponible_peru' ||
        esEstadoEnOrigen(u.estado) ||
        u.estado === 'reservada' ||
        u.estado === 'en_transito_peru' ||
        u.estado === 'asignada_pedido'
      );
      const todasParaGerencial = [...unidadesVendidas, ...unidadesActivas];

      // 2. Obtener gastos GA/GO — respetar flags impactaCTRU y esProrrateable
      const todosGastos = await gastoService.getAll();
      const gastosGAGO = todosGastos.filter(
        g => (g.categoria === 'GA' || g.categoria === 'GO') &&
             g.impactaCTRU !== false &&
             g.esProrrateable !== false
      );

      if (gastosGAGO.length === 0) {
        return { unidadesActualizadas: 0, gastosAplicados: 0, impactoPorUnidad: 0, modoDual: true };
      }

      // 3. Totales GA/GO (separados para desglose)
      const totalGA = gastosGAGO.filter(g => g.categoria === 'GA').reduce((sum, g) => sum + g.montoPEN, 0);
      const totalGO = gastosGAGO.filter(g => g.categoria === 'GO').reduce((sum, g) => sum + g.montoPEN, 0);
      const totalGAGO = totalGA + totalGO;

      // 4. Calcular costo base total para cada pool
      let costoBaseTotalVendidas = unidadesVendidas.reduce((sum, u) => sum + getCostoBasePEN(u), 0);
      if (costoBaseTotalVendidas === 0) costoBaseTotalVendidas = 1;

      let costoBaseTotalGerencial = todasParaGerencial.reduce((sum, u) => sum + getCostoBasePEN(u), 0);
      if (costoBaseTotalGerencial === 0) costoBaseTotalGerencial = 1;

      const allOps: Array<{ ref: any; data: any }> = [];
      let actualizadas = 0;

      // Helper para corregir ctruInicial si falta flete o recojo
      const corregirCtruInicial = (unidad: any): Record<string, unknown> => {
        const updates: Record<string, unknown> = {};
        const tc = getTC(unidad);
        const costoRecojo = unidad.costoRecojoPEN || 0;
        const costoConFleteYRecojo = ((unidad.costoUnitarioUSD || 0) + (unidad.costoFleteUSD || 0)) * tc + costoRecojo;
        if (unidad.ctruInicial && unidad.ctruInicial > 0 && costoConFleteYRecojo > unidad.ctruInicial + 0.01) {
          updates.ctruInicial = costoConFleteYRecojo;
        }
        return updates;
      };

      // ====== VENDIDAS: reciben ambas vistas ======
      for (const unidad of unidadesVendidas) {
        const costoBase = getCostoBasePEN(unidad);

        // Vista contable: GA/GO solo entre vendidas
        const gagoContable = calcularGAGOProporcional(costoBase, costoBaseTotalVendidas, totalGAGO);
        const ctruContable = costoBase + gagoContable;

        // Vista gerencial: GA/GO entre todas
        const gagoGerencial = calcularGAGOProporcional(costoBase, costoBaseTotalGerencial, totalGAGO);
        const ctruGerencial = costoBase + gagoGerencial;

        // Desglose GA vs GO (proporcional)
        const costoGAAsignado = calcularGAGOProporcional(costoBase, costoBaseTotalVendidas, totalGA);
        const costoGOAsignado = calcularGAGOProporcional(costoBase, costoBaseTotalVendidas, totalGO);

        const updateData: Record<string, unknown> = {
          ctruDinamico: ctruContable,         // backward compat
          ctruContable,
          ctruGerencial,
          costoGAGOAsignado: gagoContable,    // backward compat
          costoGAAsignado,
          costoGOAsignado,
          proporcionGAGO: costoBase / costoBaseTotalVendidas,
          ...corregirCtruInicial(unidad)
        };

        allOps.push({ ref: doc(db, COLLECTIONS.UNIDADES, unidad.id), data: updateData });
        actualizadas++;
      }

      // ====== ACTIVAS: contable = costo base (sin GA/GO), gerencial = con GA/GO ======
      for (const unidad of unidadesActivas) {
        const costoBase = getCostoBasePEN(unidad);

        // Vista gerencial: GA/GO entre todas
        const gagoGerencial = calcularGAGOProporcional(costoBase, costoBaseTotalGerencial, totalGAGO);
        const ctruGerencial = costoBase + gagoGerencial;

        const updateData: Record<string, unknown> = {
          ctruDinamico: costoBase,            // backward compat: activas = sin GA/GO
          ctruContable: costoBase,
          ctruGerencial,
          costoGAGOAsignado: 0,               // backward compat
          costoGAAsignado: 0,
          costoGOAsignado: 0,
          proporcionGAGO: 0,
          ...corregirCtruInicial(unidad)
        };

        allOps.push({ ref: doc(db, COLLECTIONS.UNIDADES, unidad.id), data: updateData });
      }

      // 6. Marcar gastos como recalculados
      for (const gasto of gastosGAGO) {
        allOps.push({
          ref: doc(db, COLLECTIONS.GASTOS, gasto.id),
          data: {
            ctruRecalculado: true,
            ctruPendienteRecalculo: false,
            fechaRecalculoCTRU: new Date()
          }
        });
      }

      // 7. Ejecutar en batches segmentados
      for (let i = 0; i < allOps.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = allOps.slice(i, i + BATCH_LIMIT);
        for (const op of chunk) {
          batch.update(op.ref, op.data);
        }
        await batch.commit();
      }

      // 8. Actualizar CTRU promedio de productos
      await this.actualizarCTRUPromedioProductos();

      const impactoPorUnidadPromedio = unidadesVendidas.length > 0
        ? totalGAGO / unidadesVendidas.length : 0;

      logger.info(`CTRU v2 recalculado: ${actualizadas} vendidas + ${unidadesActivas.length} activas. GA: S/${totalGA.toFixed(2)}, GO: S/${totalGO.toFixed(2)}`);

      return {
        unidadesActualizadas: actualizadas + unidadesActivas.length,
        gastosAplicados: gastosGAGO.length,
        impactoPorUnidad: impactoPorUnidadPromedio,
        modoDual: true
      };
    } catch (error: any) {
      logger.error('Error al recalcular CTRU dinámico:', error);
      throw new Error(`Error al recalcular CTRU dinámico: ${error.message}`);
    }
  },

  /**
   * Recálculo CTRU con protección de lock contra ejecuciones concurrentes.
   * TODOS los callers externos deben usar este método en lugar de recalcularCTRUDinamico().
   */
  async recalcularCTRUDinamicoSafe(): Promise<{
    unidadesActualizadas: number;
    gastosAplicados: number;
    impactoPorUnidad: number;
  } | null> {
    return ctruLockService.executeWithLock(() => this.recalcularCTRUDinamico());
  },

  /**
   * Actualizar CTRU promedio de todos los productos
   * Basado en las unidades activas de cada producto (sin GA/GO para activas)
   */
  async actualizarCTRUPromedioProductos(): Promise<number> {
    try {
      // Cargar productos y TODAS las unidades en paralelo (2 queries, no N+1)
      const [productos, todasLasUnidades] = await Promise.all([
        ProductoService.getAll(false, Infinity),
        unidadService.getAllIncluyendoHistoricas()
      ]);

      // Agrupar unidades activas por productoId en un Map
      const unidadesActivasPorProducto = new Map<string, Unidad[]>();
      for (const u of todasLasUnidades) {
        if (
          u.estado === 'disponible_peru' ||
          esEstadoEnOrigen(u.estado) ||
          u.estado === 'reservada'
        ) {
          const pid = u.productoId;
          if (!unidadesActivasPorProducto.has(pid)) {
            unidadesActivasPorProducto.set(pid, []);
          }
          unidadesActivasPorProducto.get(pid)!.push(u);
        }
      }

      // Preparar batch de updates (evitar N writes seriales)
      let productosActualizados = 0;
      let batch = writeBatch(db);
      let opsEnBatch = 0;
      const MAX_BATCH = 450;

      for (const producto of productos) {
        const unidadesActivas = unidadesActivasPorProducto.get(producto.id);
        if (!unidadesActivas || unidadesActivas.length === 0) {
          continue;
        }

        const sumaCTRU = unidadesActivas.reduce((sum, u) => sum + getCTRU(u), 0);
        const ctruPromedio = sumaCTRU / unidadesActivas.length;

        const prodRef = doc(db, COLLECTIONS.PRODUCTOS, producto.id);
        batch.update(prodRef, { ctruPromedio });
        productosActualizados++;
        opsEnBatch++;

        // Commit en chunks si se acerca al límite
        if (opsEnBatch >= MAX_BATCH) {
          await batch.commit();
          batch = writeBatch(db);
          opsEnBatch = 0;
        }
      }

      // Commit final del batch restante
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
        u.estado === 'disponible_peru' ||
        esEstadoEnOrigen(u.estado) ||
        u.estado === 'reservada'
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

  /**
   * Calcular margen de ganancia real de una venta
   * Basado en el CTRU de las unidades asignadas
   *
   * @deprecated Sin callers activos. El cálculo de margen por venta vive en
   * VentaService directamente usando getCTRU() de ctru.utils.ts. Para análisis
   * histórico mensual usar ctruStore.processHistorialMensual() en su lugar.
   */
  async calcularMargenVenta(
    precioVentaPEN: number,
    unidadesAsignadas: string[]
  ): Promise<{
    costoTotal: number;
    utilidadBruta: number;
    margen: number;
  }> {
    try {
      const unidades = await Promise.all(
        unidadesAsignadas.map(id => unidadService.getById(id))
      );

      const unidadesValidas = unidades.filter(u => u !== null) as Unidad[];

      if (unidadesValidas.length === 0) {
        return { costoTotal: 0, utilidadBruta: 0, margen: 0 };
      }

      const costoTotal = unidadesValidas.reduce((sum, u) => sum + getCTRU(u), 0);
      const utilidadBruta = precioVentaPEN - costoTotal;
      const margen = precioVentaPEN > 0 ? (utilidadBruta / precioVentaPEN) * 100 : 0;

      return { costoTotal, utilidadBruta, margen };
    } catch (error: any) {
      logger.error('Error al calcular margen de venta:', error);
      throw new Error(`Error al calcular margen de venta: ${error.message}`);
    }
  },

  /**
   * Obtener historial de evolución del CTRU de un producto
   *
   * @deprecated Sin callers activos. El historial mensual de CTRU se procesa
   * en ctruStore.processHistorialMensual() con acceso directo a Firestore.
   * Esta función hace N lecturas síncronas al Firestore (una por mes) y no
   * escala. Usar ctruStore como reemplazo.
   */
  async getHistorialCTRUProducto(
    productoId: string,
    meses: number = 6
  ): Promise<Array<{
    mes: number;
    anio: number;
    ctruPromedio: number;
    unidades: number;
  }>> {
    try {
      const ahora = new Date();
      const historial: Array<{
        mes: number;
        anio: number;
        ctruPromedio: number;
        unidades: number;
      }> = [];

      for (let i = 0; i < meses; i++) {
        const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        const mes = fecha.getMonth() + 1;
        const anio = fecha.getFullYear();

        const unidades = await unidadService.buscar({
          productoId,
          estado: 'disponible_peru'
        });

        const unidadesMes = unidades.filter(u => {
          const fechaCreacion = u.fechaCreacion.toDate();
          return (
            fechaCreacion.getMonth() + 1 === mes &&
            fechaCreacion.getFullYear() === anio
          );
        });

        if (unidadesMes.length > 0) {
          const sumaCTRU = unidadesMes.reduce((sum, u) => sum + getCTRU(u), 0);

          historial.push({
            mes,
            anio,
            ctruPromedio: sumaCTRU / unidadesMes.length,
            unidades: unidadesMes.length
          });
        }
      }

      return historial.reverse();
    } catch (error: any) {
      logger.error('Error al obtener historial CTRU:', error);
      throw new Error(`Error al obtener historial CTRU: ${error.message}`);
    }
  }
};
