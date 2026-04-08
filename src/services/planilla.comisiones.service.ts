/**
 * planilla.comisiones.service.ts
 *
 * Cálculo automático de comisiones desde ventas del periodo.
 * Usa creadoPor como vendedorId.
 */

import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { logger } from '../lib/logger';
import type { Venta } from '../types/venta.types';
import type { EsquemaComision, DetalleComision } from '../types/planilla.types';

/**
 * Calcula las comisiones de un empleado para un periodo dado.
 */
export async function calcularComisionesEmpleado(
  userId: string,
  esquema: EsquemaComision,
  mes: number,
  anio: number
): Promise<{ total: number; detalle: DetalleComision[] }> {
  try {
    // Rango de fechas del periodo
    const inicioMes = new Date(anio, mes - 1, 1);
    const finMes = new Date(anio, mes, 0, 23, 59, 59);

    // Consultar ventas del vendedor en el periodo
    const ventasRef = collection(db, COLLECTIONS.VENTAS);
    const q = query(
      ventasRef,
      where('creadoPor', '==', userId),
      where('fechaVenta', '>=', Timestamp.fromDate(inicioMes)),
      where('fechaVenta', '<=', Timestamp.fromDate(finMes))
    );

    const snap = await getDocs(q);
    const ventas: Venta[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Venta));

    // Filtrar: solo ventas confirmadas/pagadas, no canceladas, no cotizaciones
    const ventasValidas = ventas.filter(v =>
      v.estado !== 'cancelada' &&
      v.estado !== 'cotizacion' &&
      v.estadoPago !== undefined
    );

    // Filtrar por líneas de negocio si el esquema lo requiere
    const ventasFiltradas = esquema.aplicaALineas?.length
      ? ventasValidas.filter(v => {
          const lineaVenta = (v as any).lineaNegocioId;
          return lineaVenta && esquema.aplicaALineas!.includes(lineaVenta);
        })
      : ventasValidas;

    const detalle: DetalleComision[] = [];
    let total = 0;

    for (const venta of ventasFiltradas) {
      const montoVenta = venta.totalPEN || 0;
      if (montoVenta <= 0) continue;

      let montoComision = 0;
      let porcentaje = 0;

      if (esquema.tipo === 'porcentaje_venta' && esquema.porcentaje) {
        porcentaje = esquema.porcentaje;
        montoComision = montoVenta * (porcentaje / 100);
      } else if (esquema.tipo === 'monto_fijo' && esquema.montoFijo) {
        montoComision = esquema.montoFijo;
        porcentaje = montoVenta > 0 ? (esquema.montoFijo / montoVenta) * 100 : 0;
      }

      if (montoComision > 0) {
        detalle.push({
          ventaId: venta.id,
          ventaNumero: venta.numeroVenta || venta.id,
          montoVenta,
          porcentaje: Math.round(porcentaje * 100) / 100,
          montoComision: Math.round(montoComision * 100) / 100,
        });
        total += montoComision;
      }
    }

    return {
      total: Math.round(total * 100) / 100,
      detalle,
    };
  } catch (error) {
    logger.error('[Comisiones] Error calculando comisiones:', error);
    return { total: 0, detalle: [] };
  }
}
