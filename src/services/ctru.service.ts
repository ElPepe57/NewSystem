import { doc, updateDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { unidadService } from './unidad.service';
import { gastoService } from './gasto.service';
import { ProductoService } from './producto.service';
import { getCTRU, getCostoBasePEN, getTC } from '../utils/ctru.utils';
import type { Unidad } from '../types/unidad.types';
import type { Gasto } from '../types/gasto.types';

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
        console.warn(`[CTRU] Unidad ${unidad.id} sin TC - usando costoUnitarioUSD directo`);
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
      console.error('Error al calcular CTRU inicial:', error);
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
          batch.update(doc(db, 'unidades', id), {
            ctruInicial,
            ctruDinamico: ctruInicial // Inicialmente igual, cambiará con GA/GO
          });
        }

        await batch.commit();
      }

      return unidadIds.length;
    } catch (error: any) {
      console.error('Error al calcular CTRU de lote:', error);
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
      const gastosFleteOC = await gastoService.buscar({
        ordenCompraId,
        tipo: 'flete_usa_peru'
      });

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
      console.error('Error al calcular costo de flete prorrateado:', error);
      return 0;
    }
  },

  /**
   * Recalcular CTRU dinámico de todas las unidades activas.
   *
   * IMPORTANTE: ctruInicial NO se modifica. Solo ctruDinamico cambia.
   * ctruDinamico = ctruInicial + GA/GO prorrateado proporcionalmente.
   *
   * DISTRIBUCIÓN PROPORCIONAL:
   * costoGAGO_unidad = totalGastosGAGO × (costoBase_unidad / costoBase_total)
   *
   * Solo GA (Administrativos) y GO (Operativos) impactan CTRU.
   * GV (Venta) y GD (Distribución) NO impactan CTRU.
   *
   * Unidades activas: disponible_peru, recibida_usa, reservada
   */
  async recalcularCTRUDinamico(): Promise<{
    unidadesActualizadas: number;
    gastosAplicados: number;
    impactoPorUnidad: number;
  }> {
    try {
      // 1. Obtener todas las unidades activas
      const todasUnidades = await unidadService.getAll();
      const unidadesActivas = todasUnidades.filter(u =>
        u.estado === 'disponible_peru' ||
        u.estado === 'recibida_usa' ||
        u.estado === 'reservada'
      );

      if (unidadesActivas.length === 0) {
        return { unidadesActualizadas: 0, gastosAplicados: 0, impactoPorUnidad: 0 };
      }

      // 2. Obtener gastos pendientes de recálculo (solo GA/GO prorrateables)
      const gastosPendientes = await gastoService.getGastosPendientesRecalculoCTRU();
      const gastosProrrateables = gastosPendientes.filter(
        g => g.esProrrateable && (g.categoria === 'GA' || g.categoria === 'GO')
      );

      if (gastosProrrateables.length === 0) {
        return { unidadesActualizadas: 0, gastosAplicados: 0, impactoPorUnidad: 0 };
      }

      // 3. Total de gastos a prorratear
      const totalGastosProrrateables = gastosProrrateables.reduce(
        (sum, g) => sum + g.montoPEN, 0
      );

      // 4. DISTRIBUCIÓN PROPORCIONAL usando getCostoBasePEN (utility centralizado)
      let costoBaseTotalUnidades = 0;
      const unidadesConCostoBase = unidadesActivas.map(unidad => {
        const costoBase = getCostoBasePEN(unidad);
        costoBaseTotalUnidades += costoBase;
        return { unidad, costoBase };
      });

      if (costoBaseTotalUnidades === 0) {
        costoBaseTotalUnidades = 1;
      }

      // 5. Impacto promedio para display
      const impactoPorUnidadPromedio = totalGastosProrrateables / unidadesActivas.length;

      // 6. Actualizar unidades en batches segmentados
      let actualizadas = 0;

      // Combinar updates de unidades + gastos, respetar límite de batch
      const allOps: Array<{ ref: any; data: any }> = [];

      for (const { unidad, costoBase } of unidadesConCostoBase) {
        const proporcion = costoBase / costoBaseTotalUnidades;
        const costoGAGOUnidad = totalGastosProrrateables * proporcion;
        // ctruDinamico = costoBase (ctruInicial) + GA/GO proporcional
        // NO tocamos ctruInicial - es inmutable
        const nuevoCtruDinamico = costoBase + costoGAGOUnidad;

        allOps.push({
          ref: doc(db, 'unidades', unidad.id),
          data: {
            ctruDinamico: nuevoCtruDinamico,
            costoGAGOAsignado: costoGAGOUnidad,
            proporcionGAGO: proporcion
          }
        });
        actualizadas++;
      }

      // Marcar gastos como recalculados
      for (const gasto of gastosProrrateables) {
        allOps.push({
          ref: doc(db, 'gastos', gasto.id),
          data: {
            ctruRecalculado: true,
            fechaRecalculoCTRU: new Date()
          }
        });
      }

      // Ejecutar en batches segmentados
      for (let i = 0; i < allOps.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = allOps.slice(i, i + BATCH_LIMIT);
        for (const op of chunk) {
          batch.update(op.ref, op.data);
        }
        await batch.commit();
      }

      // 7. Actualizar CTRU promedio de productos
      await this.actualizarCTRUPromedioProductos();

      return {
        unidadesActualizadas: actualizadas,
        gastosAplicados: gastosProrrateables.length,
        impactoPorUnidad: impactoPorUnidadPromedio
      };
    } catch (error: any) {
      console.error('Error al recalcular CTRU dinámico:', error);
      throw new Error(`Error al recalcular CTRU dinámico: ${error.message}`);
    }
  },

  /**
   * Actualizar CTRU promedio de todos los productos
   * Basado en las unidades activas de cada producto
   */
  async actualizarCTRUPromedioProductos(): Promise<number> {
    try {
      const productos = await ProductoService.getAll();
      let productosActualizados = 0;

      for (const producto of productos) {
        const todasUnidades = await unidadService.buscar({
          productoId: producto.id
        });

        const unidadesActivas = todasUnidades.filter(u =>
          u.estado === 'disponible_peru' ||
          u.estado === 'recibida_usa' ||
          u.estado === 'reservada'
        );

        if (unidadesActivas.length === 0) {
          continue;
        }

        // Usar utility centralizado
        const sumaCTRU = unidadesActivas.reduce((sum, u) => sum + getCTRU(u), 0);
        const ctruPromedio = sumaCTRU / unidadesActivas.length;

        await ProductoService.update(producto.id, { ctruPromedio } as any);
        productosActualizados++;
      }

      return productosActualizados;
    } catch (error: any) {
      console.error('Error al actualizar CTRU promedio de productos:', error);
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
        u.estado === 'recibida_usa' ||
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
      console.error('Error al obtener CTRU de producto:', error);
      throw new Error(`Error al obtener CTRU de producto: ${error.message}`);
    }
  },

  /**
   * Calcular margen de ganancia real de una venta
   * Basado en el CTRU de las unidades asignadas
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
      console.error('Error al calcular margen de venta:', error);
      throw new Error(`Error al calcular margen de venta: ${error.message}`);
    }
  },

  /**
   * Obtener historial de evolución del CTRU de un producto
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
      console.error('Error al obtener historial CTRU:', error);
      throw new Error(`Error al obtener historial CTRU: ${error.message}`);
    }
  }
};
