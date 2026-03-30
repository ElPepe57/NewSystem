/**
 * Capa de cálculo compartida para KPIs.
 * Dashboard, Reportes y Stats deben usar estas funciones
 * para evitar divergencias en números.
 */

import type { Venta } from '../types/venta.types';
import { esEstadoVentaValido } from '../constants/venta.constants';

// ---- Filtrado canónico ----

/** Filtra ventas válidas para reportes (excluye cotizaciones, canceladas, socios) */
export function filtrarVentasReporte(ventas: Venta[]): Venta[] {
  return ventas.filter(v =>
    esEstadoVentaValido(v.estado) && !v.esVentaSocio
  );
}

/** Filtra ventas del mes usando fechaCreacion (criterio Dashboard) */
export function filtrarVentasMes(ventas: Venta[], fecha: Date = new Date()): Venta[] {
  const mes = fecha.getMonth();
  const anio = fecha.getFullYear();
  return filtrarVentasReporte(ventas).filter(v => {
    const f = v.fechaCreacion?.toDate?.();
    return f && f.getMonth() === mes && f.getFullYear() === anio;
  });
}

/** Filtra ventas por rango usando fechaEntrega (criterio Contabilidad/Reportes) */
export function filtrarVentasRango(ventas: Venta[], inicio: Date, fin: Date): Venta[] {
  return filtrarVentasReporte(ventas).filter(v => {
    const f = v.fechaEntrega?.toDate?.() || v.fechaConfirmacion?.toDate?.() || v.fechaCreacion?.toDate?.();
    return f && f >= inicio && f <= fin;
  });
}

// ---- Cálculos canónicos ----

export interface KPIVentas {
  cantidad: number;
  totalPEN: number;
  utilidadPEN: number;
  ticketPromedio: number;
  margenPonderado: number;
}

/** Calcula KPIs de ventas desde un array ya filtrado */
export function calcularKPIVentas(ventas: Venta[]): KPIVentas {
  const cantidad = ventas.length;
  const totalPEN = ventas.reduce((s, v) => s + (v.totalPEN || 0), 0);
  const utilidadPEN = ventas.reduce((s, v) => s + (v.utilidadBrutaPEN || 0), 0);
  const ticketPromedio = cantidad > 0 ? totalPEN / cantidad : 0;

  // Margen ponderado por monto (no promedio simple)
  let sumaMargenPonderado = 0;
  for (const v of ventas) {
    if (v.margenPromedio != null && v.totalPEN > 0) {
      sumaMargenPonderado += v.margenPromedio * v.totalPEN;
    }
  }
  const margenPonderado = totalPEN > 0 ? sumaMargenPonderado / totalPEN : 0;

  return { cantidad, totalPEN, utilidadPEN, ticketPromedio, margenPonderado };
}
