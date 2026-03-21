/**
 * cotizacion.stats.service.ts
 * Analytics: getStats and getAnalisisDemanda.
 */
import type { Cotizacion, CotizacionStats, MotivoRechazo } from '../types/cotizacion.types';
import { logger } from '../lib/logger';

export async function getStats(
  getAllCotizaciones: () => Promise<Cotizacion[]>
): Promise<CotizacionStats> {
  try {
    const cotizaciones = await getAllCotizaciones();

    const stats: CotizacionStats = {
      total: cotizaciones.length,
      nuevas: 0,
      validadas: 0,
      pendienteAdelanto: 0,
      adelantoPagado: 0,
      conAbono: 0,
      confirmadas: 0,
      rechazadas: 0,
      vencidas: 0,
      tasaValidacion: 0,
      tasaConversion: 0,
      tasaRechazo: 0,
      tasaPagoAdelanto: 0,
      montoTotalCotizado: 0,
      montoConfirmado: 0,
      montoPerdido: 0,
      montoEsperandoPago: 0,
      rechazosPorMotivo: {
        precio_alto: 0,
        encontro_mejor_opcion: 0,
        sin_presupuesto: 0,
        producto_diferente: 0,
        demora_entrega: 0,
        cambio_necesidad: 0,
        sin_respuesta: 0,
        otro: 0
      },
      productosRechazados: []
    };

    const productosRechazadosMap: Record<string, {
      productoId: string;
      nombreProducto: string;
      vezesRechazado: number;
      motivos: Record<MotivoRechazo, number>;
    }> = {};

    cotizaciones.forEach(cot => {
      stats.montoTotalCotizado += cot.totalPEN;

      switch (cot.estado) {
        case 'nueva':
          stats.nuevas++;
          break;
        case 'validada':
          stats.validadas++;
          break;
        case 'pendiente_adelanto':
          stats.pendienteAdelanto++;
          stats.montoEsperandoPago += cot.totalPEN;
          break;
        case 'adelanto_pagado':
          stats.adelantoPagado++;
          stats.conAbono++;
          break;
        case 'con_abono':
          stats.adelantoPagado++;
          stats.conAbono++;
          break;
        case 'confirmada':
          stats.confirmadas++;
          stats.montoConfirmado += cot.totalPEN;
          break;
        case 'rechazada':
          stats.rechazadas++;
          stats.montoPerdido += cot.totalPEN;
          if (cot.rechazo?.motivo) {
            stats.rechazosPorMotivo[cot.rechazo.motivo]++;
          }
          cot.productos.forEach(prod => {
            const key = prod.productoId;
            if (!productosRechazadosMap[key]) {
              productosRechazadosMap[key] = {
                productoId: prod.productoId,
                nombreProducto: `${prod.marca} ${prod.nombreComercial}`,
                vezesRechazado: 0,
                motivos: {
                  precio_alto: 0,
                  encontro_mejor_opcion: 0,
                  sin_presupuesto: 0,
                  producto_diferente: 0,
                  demora_entrega: 0,
                  cambio_necesidad: 0,
                  sin_respuesta: 0,
                  otro: 0
                }
              };
            }
            productosRechazadosMap[key].vezesRechazado++;
            if (cot.rechazo?.motivo) {
              productosRechazadosMap[key].motivos[cot.rechazo.motivo]++;
            }
          });
          break;
        case 'vencida':
          stats.vencidas++;
          stats.montoPerdido += cot.totalPEN;
          break;
      }
    });

    const cotizacionesAceptadas = stats.validadas + stats.pendienteAdelanto + stats.adelantoPagado + stats.confirmadas;
    if (stats.total > 0) {
      stats.tasaValidacion = (cotizacionesAceptadas / stats.total) * 100;
      stats.tasaConversion = (stats.confirmadas / stats.total) * 100;
      stats.tasaRechazo = ((stats.rechazadas + stats.vencidas) / stats.total) * 100;
    }
    const prometieronAdelanto = stats.pendienteAdelanto + stats.adelantoPagado;
    if (prometieronAdelanto > 0) {
      stats.tasaPagoAdelanto = (stats.adelantoPagado / prometieronAdelanto) * 100;
    }

    stats.productosRechazados = Object.values(productosRechazadosMap)
      .map(p => {
        let motivoPrincipal: MotivoRechazo = 'otro';
        let maxCount = 0;
        Object.entries(p.motivos).forEach(([motivo, count]) => {
          if (count > maxCount) {
            maxCount = count;
            motivoPrincipal = motivo as MotivoRechazo;
          }
        });
        return {
          productoId: p.productoId,
          nombreProducto: p.nombreProducto,
          vezesRechazado: p.vezesRechazado,
          motivoPrincipal
        };
      })
      .sort((a, b) => b.vezesRechazado - a.vezesRechazado);

    return stats;
  } catch (error: any) {
    logger.error('Error al obtener estadísticas:', error);
    throw new Error('Error al generar estadísticas');
  }
}

export async function getAnalisisDemanda(
  getAllCotizaciones: () => Promise<Cotizacion[]>
): Promise<{
  productosMasCotizados: Array<{
    productoId: string;
    nombreProducto: string;
    vecesCotizado: number;
    vecesConfirmado: number;
    tasaConversion: number;
    montoTotalCotizado: number;
  }>;
  tendenciaMensual: Array<{
    mes: string;
    cotizaciones: number;
    confirmadas: number;
    rechazadas: number;
    montoTotal: number;
  }>;
}> {
  try {
    const cotizaciones = await getAllCotizaciones();

    const productosMap: Record<string, {
      productoId: string;
      nombreProducto: string;
      vecesCotizado: number;
      vecesConfirmado: number;
      montoTotalCotizado: number;
    }> = {};

    const mensualMap: Record<string, {
      mes: string;
      cotizaciones: number;
      confirmadas: number;
      rechazadas: number;
      montoTotal: number;
    }> = {};

    cotizaciones.forEach(cot => {
      cot.productos.forEach(prod => {
        const key = prod.productoId;
        if (!productosMap[key]) {
          productosMap[key] = {
            productoId: prod.productoId,
            nombreProducto: `${prod.marca} ${prod.nombreComercial}`,
            vecesCotizado: 0,
            vecesConfirmado: 0,
            montoTotalCotizado: 0
          };
        }
        productosMap[key].vecesCotizado++;
        productosMap[key].montoTotalCotizado += prod.subtotal;
        if (cot.estado === 'confirmada') {
          productosMap[key].vecesConfirmado++;
        }
      });

      const fecha = cot.fechaCreacion.toDate();
      const mesKey = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!mensualMap[mesKey]) {
        mensualMap[mesKey] = { mes: mesKey, cotizaciones: 0, confirmadas: 0, rechazadas: 0, montoTotal: 0 };
      }
      mensualMap[mesKey].cotizaciones++;
      mensualMap[mesKey].montoTotal += cot.totalPEN;
      if (cot.estado === 'confirmada') mensualMap[mesKey].confirmadas++;
      if (cot.estado === 'rechazada' || cot.estado === 'vencida') mensualMap[mesKey].rechazadas++;
    });

    return {
      productosMasCotizados: Object.values(productosMap)
        .map(p => ({
          ...p,
          tasaConversion: p.vecesCotizado > 0 ? (p.vecesConfirmado / p.vecesCotizado) * 100 : 0
        }))
        .sort((a, b) => b.vecesCotizado - a.vecesCotizado),
      tendenciaMensual: Object.values(mensualMap).sort((a, b) => a.mes.localeCompare(b.mes))
    };
  } catch (error: any) {
    logger.error('Error al obtener análisis de demanda:', error);
    throw new Error('Error al generar análisis');
  }
}
