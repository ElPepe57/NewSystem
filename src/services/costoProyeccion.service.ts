/**
 * costoProyeccion.service.ts
 *
 * Motor de proyección de costos para el CTRU.
 * Infiere costos futuros basándose en data histórica del sistema:
 *   - Precios de compra por producto/proveedor
 *   - Fletes internacionales promedio
 *   - GA/GO mensual (promedio móvil 3 meses)
 *   - Tipo de cambio (TCPA del Pool USD)
 *   - Sensibilidad al TC
 */

import { logger } from '../lib/logger';
import { getPreciosHistoricos } from './ordenCompra.stats.service';
import { gastoService } from './gasto.service';
import { tipoCambioService } from './tipoCambio.service';
import { poolUSDService } from './poolUSD.service';
import type { CTRUProductoDetalle } from '../store/ctruStore';

// ============================================
// TIPOS
// ============================================

export interface ProyeccionCTRU {
  productoId: string;
  productoNombre: string;

  // Costos estimados por capa
  costoCompraUSD: number;        // Último precio o promedio
  costoCompraFuente: 'ultimo' | 'promedio' | 'sin_data';
  costoCompraTendencia: number;  // % cambio vs compra anterior (-5% = bajó 5%)

  tcEstimado: number;            // TCPA del Pool USD o TC venta actual
  tcFuente: 'tcpa' | 'tc_venta';

  costoCompraPEN: number;        // compraUSD × TC
  costoAdicOCPEN: number;        // Impuesto + envío + otros (promedio histórico)
  costoFletePEN: number;         // Flete/unidad promedio últimas transferencias
  costoGAGOPEN: number;          // GA/GO mensual ÷ unidades activas promedio

  // Totales proyectados
  ctruProyectado: number;        // Suma capas 1-6
  ctruActual: number;            // CTRU actual para comparar

  // Variación
  variacionPct: number;          // % diferencia proyectado vs actual
  variacionPEN: number;          // Diferencia absoluta en PEN

  // Pricing sugerido
  precioMinMargen20: number;
  precioMinMargen30: number;
  precioVentaActual: number;
  margenProyectado: number;      // Margen si vende al precio actual con CTRU proyectado

  // Alertas
  alertas: ProyeccionAlerta[];

  // Sensibilidad TC
  sensibilidadTC: SensibilidadTC[];
}

export interface ProyeccionAlerta {
  tipo: 'erosion_margen' | 'precio_subio' | 'flete_subio' | 'gago_alto' | 'margen_negativo';
  mensaje: string;
  severidad: 'warning' | 'danger';
}

export interface SensibilidadTC {
  tcEscenario: number;
  ctruResultante: number;
  margenResultante: number;
  variacionVsActual: number; // %
}

export interface ProyeccionGAGOMensual {
  mesProyectado: string;        // "2026-04"
  gaEstimado: number;
  goEstimado: number;
  totalEstimado: number;
  basadoEnMeses: number;        // Cuántos meses se usaron
  tendencia: number;            // % cambio vs promedio
  desglose: {
    recurrente: number;
    variable: number;
  };
}

// ============================================
// SERVICIO
// ============================================

export const costoProyeccionService = {

  /**
   * Proyectar CTRU para un producto específico
   */
  async proyectarCTRU(
    producto: CTRUProductoDetalle,
    opciones?: { tcOverride?: number }
  ): Promise<ProyeccionCTRU> {
    const alertas: ProyeccionAlerta[] = [];

    // --- CAPA 1: Costo de compra estimado ---
    const preciosHist = await getPreciosHistoricos(producto.productoId);
    let costoCompraUSD = 0;
    let costoCompraFuente: ProyeccionCTRU['costoCompraFuente'] = 'sin_data';
    let costoCompraTendencia = 0;

    if (preciosHist.length > 0) {
      // Ordenar por fecha descendente (más reciente primero)
      const ordenados = [...preciosHist].sort((a, b) =>
        b.fechaCompra.getTime() - a.fechaCompra.getTime()
      );
      costoCompraUSD = ordenados[0].costoUnitarioUSD;
      costoCompraFuente = 'ultimo';

      // Tendencia: comparar último vs anterior
      if (ordenados.length >= 2) {
        const anterior = ordenados[1].costoUnitarioUSD;
        costoCompraTendencia = anterior > 0
          ? ((costoCompraUSD - anterior) / anterior) * 100
          : 0;

        if (costoCompraTendencia > 10) {
          alertas.push({
            tipo: 'precio_subio',
            mensaje: `Precio de compra subió ${costoCompraTendencia.toFixed(1)}% vs compra anterior`,
            severidad: costoCompraTendencia > 20 ? 'danger' : 'warning'
          });
        }
      }
    } else {
      // Sin historial — usar costo actual del CTRU
      costoCompraUSD = producto.costoCompraUSDProm;
      costoCompraFuente = producto.costoCompraUSDProm > 0 ? 'promedio' : 'sin_data';
    }

    // --- TC estimado ---
    let tcEstimado: number;
    let tcFuente: ProyeccionCTRU['tcFuente'];

    if (opciones?.tcOverride) {
      tcEstimado = opciones.tcOverride;
      tcFuente = 'tc_venta';
    } else {
      try {
        const resumenPool = await poolUSDService.getResumen();
        if (resumenPool.tcpa > 0) {
          tcEstimado = resumenPool.tcpa;
          tcFuente = 'tcpa';
        } else {
          const tcActual = await tipoCambioService.resolverTC();
          tcEstimado = tcActual.venta;
          tcFuente = 'tc_venta';
        }
      } catch {
        const tcActual = await tipoCambioService.resolverTC();
        tcEstimado = tcActual.venta;
        tcFuente = 'tc_venta';
      }
    }

    // --- CAPA 1 en PEN ---
    const costoCompraPEN = costoCompraUSD * tcEstimado;

    // --- CAPAS 2-4: Adicionales de OC (promedio histórico del producto) ---
    const costoAdicOCPEN = producto.costoImpuestoPENProm
      + producto.costoEnvioPENProm
      + producto.costoOtrosPENProm;

    // --- CAPA 5: Flete internacional promedio ---
    const costoFletePEN = producto.costoFleteIntlPENProm;

    if (costoFletePEN > 0 && producto.costoFleteIntlPENProm > 0) {
      // Comparar con costo de compra para detectar flete alto
      const pctFlete = (costoFletePEN / costoCompraPEN) * 100;
      if (pctFlete > 25) {
        alertas.push({
          tipo: 'flete_subio',
          mensaje: `Flete representa ${pctFlete.toFixed(0)}% del costo de compra`,
          severidad: pctFlete > 40 ? 'danger' : 'warning'
        });
      }
    }

    // --- CAPA 6: GA/GO estimado ---
    const gagoProyectado = await this.estimarGAGOPorUnidad(producto);

    if (gagoProyectado > 0 && costoCompraPEN > 0) {
      const pctGAGO = (gagoProyectado / costoCompraPEN) * 100;
      if (pctGAGO > 100) {
        alertas.push({
          tipo: 'gago_alto',
          mensaje: `GA/GO (S/${gagoProyectado.toFixed(2)}) supera el costo de compra del producto`,
          severidad: 'danger'
        });
      }
    }

    // --- CTRU Proyectado ---
    const ctruProyectado = costoCompraPEN + costoAdicOCPEN + costoFletePEN + gagoProyectado;
    const ctruActual = producto.ctruPromedio || producto.ctruGerencialProm || 0;

    const variacionPEN = ctruProyectado - ctruActual;
    const variacionPct = ctruActual > 0
      ? ((ctruProyectado - ctruActual) / ctruActual) * 100
      : 0;

    // --- Pricing sugerido ---
    const precioMinMargen20 = ctruProyectado / (1 - 0.20);
    const precioMinMargen30 = ctruProyectado / (1 - 0.30);
    const precioVentaActual = producto.precioVentaProm;

    const margenProyectado = precioVentaActual > 0
      ? ((precioVentaActual - ctruProyectado) / precioVentaActual) * 100
      : 0;

    // Alerta de erosión
    if (margenProyectado < 0) {
      alertas.push({
        tipo: 'margen_negativo',
        mensaje: `CTRU proyectado (S/${ctruProyectado.toFixed(2)}) supera precio de venta (S/${precioVentaActual.toFixed(2)})`,
        severidad: 'danger'
      });
    } else if (margenProyectado < 15 && precioVentaActual > 0) {
      alertas.push({
        tipo: 'erosion_margen',
        mensaje: `Margen proyectado de ${margenProyectado.toFixed(1)}% está por debajo del 15%`,
        severidad: 'warning'
      });
    }

    // --- Sensibilidad al TC ---
    const sensibilidadTC = this.calcularSensibilidadTC(
      costoCompraUSD,
      costoAdicOCPEN,
      costoFletePEN,
      gagoProyectado,
      precioVentaActual,
      tcEstimado
    );

    return {
      productoId: producto.productoId,
      productoNombre: producto.productoNombre,
      costoCompraUSD,
      costoCompraFuente,
      costoCompraTendencia,
      tcEstimado,
      tcFuente,
      costoCompraPEN,
      costoAdicOCPEN,
      costoFletePEN,
      costoGAGOPEN: gagoProyectado,
      ctruProyectado,
      ctruActual,
      variacionPct,
      variacionPEN,
      precioMinMargen20,
      precioMinMargen30,
      precioVentaActual,
      margenProyectado,
      alertas,
      sensibilidadTC,
    };
  },

  /**
   * Estimar GA/GO por unidad basado en promedio móvil de 3 meses
   */
  async estimarGAGOPorUnidad(producto: CTRUProductoDetalle): Promise<number> {
    try {
      const ahora = new Date();
      let totalGA = 0;
      let totalGO = 0;
      let mesesConData = 0;

      // Promedio móvil de los últimos 3 meses
      for (let i = 1; i <= 3; i++) {
        const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        const mes = fecha.getMonth() + 1;
        const anio = fecha.getFullYear();

        try {
          const resumen = await gastoService.getResumenMes(mes, anio);
          const ga = resumen.porCategoria.find(c => c.categoria === 'GA')?.totalPEN || 0;
          const go = resumen.porCategoria.find(c => c.categoria === 'GO')?.totalPEN || 0;

          if (ga > 0 || go > 0) {
            totalGA += ga;
            totalGO += go;
            mesesConData++;
          }
        } catch {
          // Mes sin datos, continuar
        }
      }

      if (mesesConData === 0) {
        // Fallback: usar GA/GO actual del producto si existe
        return producto.gastoGAGOGerencialProm || producto.gastoGAGOEstimado || 0;
      }

      const gagoMensualProm = (totalGA + totalGO) / mesesConData;

      // Prorratear entre unidades activas del producto
      // Usamos totalUnidades como proxy (todas las unidades activas en el sistema)
      const unidadesBase = producto.totalUnidades > 0 ? producto.totalUnidades : 1;

      // Proporción: el GA/GO de este producto = (costo base del producto / costo base total) × GA/GO total
      // Simplificación: usamos costoCompraPEN del producto como peso
      const costoBase = producto.costoCompraPENProm || 1;
      const factor = costoBase / (costoBase * unidadesBase); // = 1/unidades
      const gagoEstimado = gagoMensualProm * factor;

      return gagoEstimado;
    } catch (error) {
      logger.error('Error estimando GA/GO:', error);
      return producto.gastoGAGOGerencialProm || producto.gastoGAGOEstimado || 0;
    }
  },

  /**
   * Proyectar GA/GO mensual total (no por producto)
   */
  async proyectarGAGOMensual(): Promise<ProyeccionGAGOMensual> {
    const ahora = new Date();
    let totalGA = 0;
    let totalGO = 0;
    let totalRecurrente = 0;
    let totalVariable = 0;
    let mesesConData = 0;

    const dataMensual: { ga: number; go: number }[] = [];

    for (let i = 1; i <= 3; i++) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const mes = fecha.getMonth() + 1;
      const anio = fecha.getFullYear();

      try {
        const resumen = await gastoService.getResumenMes(mes, anio);
        const ga = resumen.porCategoria.find(c => c.categoria === 'GA')?.totalPEN || 0;
        const go = resumen.porCategoria.find(c => c.categoria === 'GO')?.totalPEN || 0;

        if (resumen.totalGastos > 0) {
          totalGA += ga;
          totalGO += go;
          totalRecurrente += resumen.montoRecurrente;
          totalVariable += (resumen.totalPEN - resumen.montoRecurrente);
          mesesConData++;
          dataMensual.push({ ga, go });
        }
      } catch {
        // Continuar
      }
    }

    if (mesesConData === 0) {
      const mesProx = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
      return {
        mesProyectado: `${mesProx.getFullYear()}-${String(mesProx.getMonth() + 1).padStart(2, '0')}`,
        gaEstimado: 0,
        goEstimado: 0,
        totalEstimado: 0,
        basadoEnMeses: 0,
        tendencia: 0,
        desglose: { recurrente: 0, variable: 0 }
      };
    }

    const gaEstimado = totalGA / mesesConData;
    const goEstimado = totalGO / mesesConData;
    const totalEstimado = gaEstimado + goEstimado;

    // Tendencia: comparar último mes vs promedio
    const tendencia = dataMensual.length >= 2
      ? (() => {
          const ultimo = dataMensual[0].ga + dataMensual[0].go;
          return totalEstimado > 0 ? ((ultimo - totalEstimado) / totalEstimado) * 100 : 0;
        })()
      : 0;

    const mesProx = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);

    return {
      mesProyectado: `${mesProx.getFullYear()}-${String(mesProx.getMonth() + 1).padStart(2, '0')}`,
      gaEstimado,
      goEstimado,
      totalEstimado,
      basadoEnMeses: mesesConData,
      tendencia,
      desglose: {
        recurrente: totalRecurrente / mesesConData,
        variable: totalVariable / mesesConData
      }
    };
  },

  /**
   * Calcular sensibilidad del CTRU a variaciones del TC
   */
  calcularSensibilidadTC(
    costoCompraUSD: number,
    costoAdicOCPEN: number,
    costoFletePEN: number,
    costoGAGOPEN: number,
    precioVentaPEN: number,
    tcBase: number
  ): SensibilidadTC[] {
    const escenarios = [-10, -5, -2, 0, 2, 5, 10];

    return escenarios.map(pct => {
      const tcEscenario = tcBase * (1 + pct / 100);
      const compraPEN = costoCompraUSD * tcEscenario;
      const ctruResultante = compraPEN + costoAdicOCPEN + costoFletePEN + costoGAGOPEN;
      const margenResultante = precioVentaPEN > 0
        ? ((precioVentaPEN - ctruResultante) / precioVentaPEN) * 100
        : 0;
      const ctruBase = costoCompraUSD * tcBase + costoAdicOCPEN + costoFletePEN + costoGAGOPEN;
      const variacionVsActual = ctruBase > 0
        ? ((ctruResultante - ctruBase) / ctruBase) * 100
        : 0;

      return { tcEscenario, ctruResultante, margenResultante, variacionVsActual };
    });
  },

  /**
   * Proyectar CTRU para todos los productos (batch)
   */
  async proyectarTodos(productos: CTRUProductoDetalle[]): Promise<Map<string, ProyeccionCTRU>> {
    const resultados = new Map<string, ProyeccionCTRU>();

    for (const producto of productos) {
      try {
        const proyeccion = await this.proyectarCTRU(producto);
        resultados.set(producto.productoId, proyeccion);
      } catch (error) {
        logger.error(`Error proyectando CTRU para ${producto.productoNombre}:`, error);
      }
    }

    return resultados;
  },
};
