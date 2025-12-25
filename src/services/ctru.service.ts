import { doc, updateDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { unidadService } from './unidad.service';
import { gastoService } from './gasto.service';
import { ProductoService } from './producto.service';
import type { Unidad } from '../types/unidad.types';
import type { Gasto } from '../types/gasto.types';

/**
 * Servicio para cálculo y actualización del CTRU (Costo Total Real por Unidad)
 *
 * CTRU = Costo Base + Costos Prorrateados
 *
 * Costo Base:
 * - Costo USD convertido a PEN (con TC pago o TC compra)
 * - Costos de flete USA→Perú (prorrateado por OC)
 *
 * Costos Prorrateados:
 * - Gastos administrativos del mes
 * - Gastos operativos del mes
 * - Otros gastos prorrateables
 */
export const ctruService = {
  /**
   * Calcular CTRU inicial de una unidad al momento de recibirla en Perú
   * Este es el CTRU base que incluye:
   * - Costo USA en PEN
   * - Costo de flete prorrateado de la OC
   */
  async calcularCTRUInicial(unidad: Unidad): Promise<number> {
    try {
      // 1. Costo USA convertido a PEN
      const tcAplicable = unidad.tcPago || unidad.tcCompra || 3.8;
      const costoBasePEN = unidad.costoUnitarioUSD * tcAplicable;

      // 2. Obtener costos de flete de la OC (si existe)
      let costoFletePorUnidad = 0;
      if (unidad.ordenCompraId) {
        costoFletePorUnidad = await this.calcularCostoFleteProrrateado(
          unidad.ordenCompraId,
          unidad.id
        );
      }

      const ctruInicial = costoBasePEN + costoFletePorUnidad;

      return ctruInicial;
    } catch (error: any) {
      console.error('Error al calcular CTRU inicial:', error);
      throw new Error(`Error al calcular CTRU inicial: ${error.message}`);
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
      // Obtener gastos de flete de esta OC
      const gastosFleteOC = await gastoService.buscar({
        ordenCompraId,
        tipo: 'flete_usa_peru'
      });

      if (gastosFleteOC.length === 0) {
        return 0;
      }

      // Sumar todos los gastos de flete
      const totalFlete = gastosFleteOC.reduce((sum, g) => sum + g.montoPEN, 0);

      // Obtener todas las unidades de esta OC
      const unidadesOC = await unidadService.buscar({ ordenCompraId });

      if (unidadesOC.length === 0) {
        return 0;
      }

      // Prorratear entre todas las unidades
      const fletePorUnidad = totalFlete / unidadesOC.length;

      return fletePorUnidad;
    } catch (error: any) {
      console.error('Error al calcular costo de flete prorrateado:', error);
      return 0;
    }
  },

  /**
   * Recalcular CTRU dinámico de todas las unidades activas
   * Se ejecuta cuando se registra un nuevo gasto prorrateable
   *
   * CTRU Dinámico = CTRU Inicial + Gastos Prorrateados (solo GA/GO)
   *
   * Nota: Solo los gastos GA (Administrativos) y GO (Operativos) impactan CTRU.
   * Los gastos GV (Venta) y GD (Distribución) NO impactan CTRU - se descuentan
   * de la utilidad de cada venta específica.
   *
   * Se consideran unidades activas: disponible_peru, recibida_usa, reservada
   */
  async recalcularCTRUDinamico(): Promise<{
    unidadesActualizadas: number;
    gastosAplicados: number;
    impactoPorUnidad: number;
  }> {
    try {
      // 1. Obtener todas las unidades activas (disponibles + reservadas)
      const todasUnidades = await unidadService.getAll();
      const unidadesActivas = todasUnidades.filter(u =>
        u.estado === 'disponible_peru' ||
        u.estado === 'recibida_usa' ||
        u.estado === 'reservada'
      );

      if (unidadesActivas.length === 0) {
        return {
          unidadesActualizadas: 0,
          gastosAplicados: 0,
          impactoPorUnidad: 0
        };
      }

      // 2. Obtener gastos pendientes de recálculo que impactan CTRU
      const gastosPendientes = await gastoService.getGastosPendientesRecalculoCTRU();
      // Solo considerar GA y GO (gastos que se prorratean entre unidades)
      // GV y GD NO se prorratean - se asocian directamente a ventas
      const gastosProrrateables = gastosPendientes.filter(
        g => g.esProrrateable && (g.categoria === 'GA' || g.categoria === 'GO')
      );

      if (gastosProrrateables.length === 0) {
        return {
          unidadesActualizadas: 0,
          gastosAplicados: 0,
          impactoPorUnidad: 0
        };
      }

      // 3. Calcular total de gastos GA + GO a prorratear
      const totalGastosProrrateables = gastosProrrateables.reduce(
        (sum, g) => sum + g.montoPEN,
        0
      );

      // 4. Calcular impacto por unidad
      const impactoPorUnidad = totalGastosProrrateables / unidadesActivas.length;

      // 5. Actualizar CTRU dinámico de cada unidad
      const batch = writeBatch(db);
      let actualizadas = 0;

      for (const unidad of unidadesActivas) {
        // Si no tiene ctruInicial, calcular el costo base
        // CTRU Base = (CostoUSD + FleteUSD) * TC
        const tc = unidad.tcPago || unidad.tcCompra || 3.70;
        const costoTotalUSD = unidad.costoUnitarioUSD + (unidad.costoFleteUSD || 0);
        const ctruBase = unidad.ctruInicial || (costoTotalUSD * tc);
        const nuevoCtruDinamico = ctruBase + impactoPorUnidad;

        const unidadRef = doc(db, 'unidades', unidad.id);
        batch.update(unidadRef, {
          ctruInicial: ctruBase,
          ctruDinamico: nuevoCtruDinamico
        });

        actualizadas++;
      }

      // 6. Marcar gastos como recalculados
      for (const gasto of gastosProrrateables) {
        const gastoRef = doc(db, 'gastos', gasto.id);
        batch.update(gastoRef, {
          ctruRecalculado: true,
          fechaRecalculoCTRU: new Date()
        });
      }

      await batch.commit();

      // 7. Actualizar CTRU promedio de productos
      await this.actualizarCTRUPromedioProductos();

      return {
        unidadesActualizadas: actualizadas,
        gastosAplicados: gastosProrrateables.length,
        impactoPorUnidad
      };
    } catch (error: any) {
      console.error('Error al recalcular CTRU dinámico:', error);
      throw new Error(`Error al recalcular CTRU dinámico: ${error.message}`);
    }
  },

  /**
   * Actualizar CTRU promedio de todos los productos
   * Basado en las unidades activas de cada producto (disponibles + reservadas)
   *
   * IMPORTANTE: Se consideran todas las unidades que representan inventario real:
   * - disponible_peru: listas para venta en Perú
   * - recibida_usa: disponibles en USA
   * - reservada: comprometidas para una venta/cotización
   *
   * Las unidades vendidas, vencidas o dañadas NO se consideran.
   */
  async actualizarCTRUPromedioProductos(): Promise<number> {
    try {
      const productos = await ProductoService.getAll();
      let productosActualizados = 0;

      for (const producto of productos) {
        // Obtener TODAS las unidades activas del producto (disponibles, recibidas y reservadas)
        const todasUnidades = await unidadService.buscar({
          productoId: producto.id
        });

        // Filtrar solo unidades activas (no vendidas, vencidas ni dañadas)
        const unidadesActivas = todasUnidades.filter(u =>
          u.estado === 'disponible_peru' ||
          u.estado === 'recibida_usa' ||
          u.estado === 'reservada'
        );

        if (unidadesActivas.length === 0) {
          continue;
        }

        // Calcular CTRU promedio (usar ctruDinamico o estimar el base)
        // CTRU = (CostoUSD + FleteUSD) * TC
        const sumaCTRU = unidadesActivas.reduce((sum, u) => {
          const tc = u.tcPago || u.tcCompra || 3.70;
          const costoTotalUSD = u.costoUnitarioUSD + (u.costoFleteUSD || 0);
          const ctru = u.ctruDinamico || u.ctruInicial || (costoTotalUSD * tc);
          return sum + ctru;
        }, 0);
        const ctruPromedio = sumaCTRU / unidadesActivas.length;

        // Actualizar producto
        await ProductoService.update(producto.id, {
          ctruPromedio
        } as any);

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
   * Incluye: disponible_peru, recibida_usa, reservada
   */
  async getCTRUProducto(productoId: string): Promise<{
    ctruPromedio: number;
    unidadesActivas: number;
    ctruMinimo: number;
    ctruMaximo: number;
  }> {
    try {
      const todasUnidades = await unidadService.buscar({
        productoId
      });

      // Filtrar solo unidades activas
      const unidadesActivas = todasUnidades.filter(u =>
        u.estado === 'disponible_peru' ||
        u.estado === 'recibida_usa' ||
        u.estado === 'reservada'
      );

      if (unidadesActivas.length === 0) {
        return {
          ctruPromedio: 0,
          unidadesActivas: 0,
          ctruMinimo: 0,
          ctruMaximo: 0
        };
      }

      // CTRU = (CostoUSD + FleteUSD) * TC
      const ctrus = unidadesActivas.map(u => {
        const tc = u.tcPago || u.tcCompra || 3.70;
        const costoTotalUSD = u.costoUnitarioUSD + (u.costoFleteUSD || 0);
        return u.ctruDinamico || u.ctruInicial || (costoTotalUSD * tc);
      });
      const sumaCTRU = ctrus.reduce((sum, c) => sum + c, 0);
      const ctruPromedio = sumaCTRU / unidadesActivas.length;
      const ctruMinimo = Math.min(...ctrus);
      const ctruMaximo = Math.max(...ctrus);

      return {
        ctruPromedio,
        unidadesActivas: unidadesActivas.length,
        ctruMinimo,
        ctruMaximo
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
    margen: number; // %
  }> {
    try {
      // Obtener las unidades asignadas
      const unidades = await Promise.all(
        unidadesAsignadas.map(id => unidadService.getById(id))
      );

      const unidadesValidas = unidades.filter(u => u !== null) as Unidad[];

      if (unidadesValidas.length === 0) {
        return {
          costoTotal: 0,
          utilidadBruta: 0,
          margen: 0
        };
      }

      // Sumar CTRU de todas las unidades
      // CTRU = (CostoUSD + FleteUSD) * TC
      const costoTotal = unidadesValidas.reduce(
        (sum, u) => {
          const tc = u.tcPago || u.tcCompra || 3.70;
          const costoTotalUSD = u.costoUnitarioUSD + (u.costoFleteUSD || 0);
          const ctru = u.ctruDinamico || u.ctruInicial || (costoTotalUSD * tc);
          return sum + ctru;
        },
        0
      );

      const utilidadBruta = precioVentaPEN - costoTotal;
      const margen = (utilidadBruta / precioVentaPEN) * 100;

      return {
        costoTotal,
        utilidadBruta,
        margen
      };
    } catch (error: any) {
      console.error('Error al calcular margen de venta:', error);
      throw new Error(`Error al calcular margen de venta: ${error.message}`);
    }
  },

  /**
   * Obtener historial de evolución del CTRU de un producto
   * Útil para gráficos y análisis
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

        // Obtener unidades del producto en ese mes
        const unidades = await unidadService.buscar({
          productoId,
          estado: 'disponible_peru'
        });

        // Filtrar por mes/año (aproximado)
        const unidadesMes = unidades.filter(u => {
          const fechaCreacion = u.fechaCreacion.toDate();
          return (
            fechaCreacion.getMonth() + 1 === mes &&
            fechaCreacion.getFullYear() === anio
          );
        });

        if (unidadesMes.length > 0) {
          // CTRU = (CostoUSD + FleteUSD) * TC
          const sumaCTRU = unidadesMes.reduce((sum, u) => {
            const tc = u.tcPago || u.tcCompra || 3.70;
            const costoTotalUSD = u.costoUnitarioUSD + (u.costoFleteUSD || 0);
            const ctru = u.ctruDinamico || u.ctruInicial || (costoTotalUSD * tc);
            return sum + ctru;
          }, 0);
          const ctruPromedio = sumaCTRU / unidadesMes.length;

          historial.push({
            mes,
            anio,
            ctruPromedio,
            unidades: unidadesMes.length
          });
        }
      }

      return historial.reverse(); // Más antiguo primero
    } catch (error: any) {
      console.error('Error al obtener historial CTRU:', error);
      throw new Error(`Error al obtener historial CTRU: ${error.message}`);
    }
  }
};
