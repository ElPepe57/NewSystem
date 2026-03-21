/**
 * venta.stats.service.ts
 *
 * Métodos de estadísticas e historial de clientes extraídos de VentaService.
 * Contiene: getStats, getHistorialFinancieroCliente.
 *
 * Estas funciones son invocadas como delegados desde VentaService,
 * manteniendo la API pública intacta.
 */

import type { Venta, VentaStats } from '../types/venta.types';

/**
 * Calcular estadísticas agregadas sobre una lista de ventas.
 */
export function calcularStats(ventas: Venta[]): VentaStats {
  const stats: VentaStats = {
    totalVentas: ventas.length,
    cotizaciones: 0,
    confirmadas: 0,
    enProceso: 0,
    entregadas: 0,
    canceladas: 0,
    ventasTotalPEN: 0,
    utilidadTotalPEN: 0,
    margenPromedio: 0,
    ventasML: 0,
    ventasDirecto: 0,
    ventasOtro: 0
  };

  let sumaMargenPonderado = 0;

  ventas.forEach(venta => {
    // Contar por estado
    if (venta.estado === 'cotizacion') stats.cotizaciones++;
    else if (venta.estado === 'confirmada') stats.confirmadas++;
    else if (venta.estado === 'asignada' || venta.estado === 'en_entrega' || venta.estado === 'despachada') stats.enProceso++;
    else if (venta.estado === 'entregada') stats.entregadas++;
    else if (venta.estado === 'cancelada') stats.canceladas++;

    // Contar por canal (solo ventas no canceladas ni cotizaciones)
    if (venta.estado !== 'cancelada' && venta.estado !== 'cotizacion') {
      if (venta.canal === 'mercado_libre') stats.ventasML++;
      else if (venta.canal === 'directo') stats.ventasDirecto++;
      else stats.ventasOtro++;

      stats.ventasTotalPEN += venta.totalPEN;

      if (venta.utilidadBrutaPEN !== undefined) {
        stats.utilidadTotalPEN += venta.utilidadBrutaPEN;
        sumaMargenPonderado += venta.margenPromedio! * venta.totalPEN;
      }
    }
  });

  // Calcular margen promedio ponderado
  if (stats.ventasTotalPEN > 0) {
    stats.margenPromedio = sumaMargenPonderado / stats.ventasTotalPEN;
  }

  return stats;
}

/**
 * Calcular historial financiero de un cliente a partir de ventas ya filtradas.
 * El filtrado por cliente (clienteId, DNI/RUC, teléfono, nombre) se hace en VentaService.
 */
export function calcularHistorialFinanciero(ventas: Venta[]): {
  resumen: {
    totalVentas: number;
    ventasCompletadas: number;
    ventasPendientes: number;
    ventasCanceladas: number;
    totalVendidoPEN: number;
    totalCobradoPEN: number;
    totalPendientePEN: number;
    ticketPromedio: number;
    ultimaCompra?: Date;
    primeraCompra?: Date;
  };
  porCobrar: Venta[];
  cobradas: Venta[];
} {
  const ventasNoCancel = ventas.filter(v => v.estado !== 'cancelada');
  const ventasCompletadas = ventas.filter(v => v.estado === 'entregada').length;
  const ventasPendientes = ventas.filter(v =>
    ['cotizacion', 'confirmada', 'asignada', 'en_entrega', 'despachada'].includes(v.estado)
  ).length;
  const ventasCanceladas = ventas.filter(v => v.estado === 'cancelada').length;

  const totalVendidoPEN = ventasNoCancel.reduce((sum, v) => sum + (v.totalPEN || 0), 0);
  const totalCobradoPEN = ventasNoCancel.reduce((sum, v) => sum + (v.montoPagado || 0), 0);
  const totalPendientePEN = ventasNoCancel.reduce((sum, v) => sum + (v.montoPendiente || 0), 0);
  const ticketPromedio = ventasNoCancel.length > 0 ? totalVendidoPEN / ventasNoCancel.length : 0;

  let ultimaCompra: Date | undefined;
  let primeraCompra: Date | undefined;

  if (ventas.length > 0) {
    const fechas = ventas
      .map(v => v.fechaCreacion?.toDate?.() || new Date(v.fechaCreacion as any))
      .filter(f => f instanceof Date && !isNaN(f.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    if (fechas.length > 0) {
      ultimaCompra = fechas[0];
      primeraCompra = fechas[fechas.length - 1];
    }
  }

  const porCobrar = ventas.filter(v =>
    v.estado !== 'cancelada' &&
    (v.estadoPago === 'pendiente' || v.estadoPago === 'parcial')
  );

  const cobradas = ventas.filter(v =>
    v.estado !== 'cancelada' &&
    v.estadoPago === 'pagado'
  );

  return {
    resumen: {
      totalVentas: ventas.length,
      ventasCompletadas,
      ventasPendientes,
      ventasCanceladas,
      totalVendidoPEN,
      totalCobradoPEN,
      totalPendientePEN,
      ticketPromedio,
      ultimaCompra,
      primeraCompra
    },
    porCobrar,
    cobradas
  };
}
