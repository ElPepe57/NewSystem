/**
 * ordenCompra.stats.service.ts
 *
 * Statistics and market intelligence queries:
 *   getStats, getPreciosHistoricos, getMejorPrecioHistorico,
 *   getPrecioPromedioHistorico, getUltimoPrecioProveedor,
 *   getInvestigacionMercado, getProductosProveedor
 */

import { logger } from '../lib/logger';
import type { OrdenCompraStats, OrdenCompra } from '../types/ordenCompra.types';
import { getAll } from './ordenCompra.crud.service';

export async function getStats(): Promise<OrdenCompraStats> {
  try {
    const ordenes = await getAll();

    const stats: OrdenCompraStats = {
      totalOrdenes: ordenes.length,
      borradores: 0,
      enviadas: 0,
      pagadas: 0,
      enTransito: 0,
      recibidasParcial: 0,
      recibidas: 0,
      canceladas: 0,
      valorTotalUSD: 0,
      valorTotalPEN: 0
    };

    ordenes.forEach(orden => {
      if (orden.estado === 'borrador') stats.borradores++;
      else if (orden.estado === 'enviada') stats.enviadas++;
      else if (orden.estado === 'en_transito') stats.enTransito++;
      else if (orden.estado === 'recibida_parcial') stats.recibidasParcial++;
      else if (orden.estado === 'recibida') stats.recibidas++;
      else if (orden.estado === 'cancelada') stats.canceladas++;

      if (orden.estadoPago === 'pagado') stats.pagadas++;

      if (orden.estado !== 'cancelada') {
        stats.valorTotalUSD += orden.totalUSD;
        if (orden.totalPEN) stats.valorTotalPEN += orden.totalPEN;
      }
    });

    return stats;
  } catch (error: any) {
    logger.error('Error al obtener estadísticas:', error);
    throw new Error('Error al generar estadísticas');
  }
}

type PrecioHistorico = {
  proveedorId: string;
  proveedorNombre: string;
  costoUnitarioUSD: number;
  cantidad: number;
  fechaCompra: Date;
  numeroOrden: string;
  tcCompra?: number;
};

export async function getPreciosHistoricos(productoId: string): Promise<PrecioHistorico[]> {
  try {
    const ordenes = await getAll();
    const precios: PrecioHistorico[] = [];

    ordenes.forEach(orden => {
      if (orden.estado === 'cancelada') return;
      const producto = orden.productos.find(p => p.productoId === productoId);
      if (producto) {
        precios.push({
          proveedorId: orden.proveedorId,
          proveedorNombre: orden.nombreProveedor,
          costoUnitarioUSD: producto.costoUnitario,
          cantidad: producto.cantidad,
          fechaCompra: orden.fechaCreacion.toDate(),
          numeroOrden: orden.numeroOrden,
          tcCompra: orden.tcCompra
        });
      }
    });

    precios.sort((a, b) => b.fechaCompra.getTime() - a.fechaCompra.getTime());
    return precios;
  } catch (error: any) {
    logger.error('Error al obtener precios históricos:', error);
    return [];
  }
}

export async function getMejorPrecioHistorico(productoId: string): Promise<{
  proveedorId: string;
  proveedorNombre: string;
  costoUnitarioUSD: number;
  fechaCompra: Date;
  numeroOrden: string;
} | null> {
  const precios = await getPreciosHistoricos(productoId);
  if (precios.length === 0) return null;
  return precios.reduce((mejor, actual) =>
    actual.costoUnitarioUSD < mejor.costoUnitarioUSD ? actual : mejor
  );
}

export async function getPrecioPromedioHistorico(productoId: string): Promise<number> {
  const precios = await getPreciosHistoricos(productoId);
  if (precios.length === 0) return 0;
  const suma = precios.reduce((sum, p) => sum + p.costoUnitarioUSD, 0);
  return suma / precios.length;
}

export async function getUltimoPrecioProveedor(
  productoId: string,
  proveedorId: string
): Promise<{
  costoUnitarioUSD: number;
  fechaCompra: Date;
  numeroOrden: string;
  tcCompra?: number;
} | null> {
  const precios = await getPreciosHistoricos(productoId);
  const precioProveedor = precios.find(p => p.proveedorId === proveedorId);
  if (!precioProveedor) return null;
  return {
    costoUnitarioUSD: precioProveedor.costoUnitarioUSD,
    fechaCompra: precioProveedor.fechaCompra,
    numeroOrden: precioProveedor.numeroOrden,
    tcCompra: precioProveedor.tcCompra
  };
}

export async function getInvestigacionMercado(
  productoIds: string[]
): Promise<
  Map<
    string,
    {
      productoId: string;
      precioPromedioUSD: number;
      precioMinimoUSD: number;
      precioMaximoUSD: number;
      ultimoPrecioUSD: number;
      proveedorRecomendado?: { id: string; nombre: string; ultimoPrecioUSD: number };
      historial: Array<{
        proveedorNombre: string;
        costoUnitarioUSD: number;
        fechaCompra: Date;
      }>;
    }
  >
> {
  const resultado = new Map();

  const todosLosPrecios = await Promise.all(
    productoIds.map(id =>
      getPreciosHistoricos(id).then(precios => ({ productoId: id, precios }))
    )
  );

  for (const { productoId, precios } of todosLosPrecios) {
    if (precios.length === 0) {
      resultado.set(productoId, {
        productoId,
        precioPromedioUSD: 0,
        precioMinimoUSD: 0,
        precioMaximoUSD: 0,
        ultimoPrecioUSD: 0,
        proveedorRecomendado: undefined,
        historial: []
      });
      continue;
    }

    const preciosUSD = precios.map(p => p.costoUnitarioUSD);
    const precioMinimo = Math.min(...preciosUSD);
    const precioMaximo = Math.max(...preciosUSD);
    const precioPromedio = preciosUSD.reduce((a, b) => a + b, 0) / preciosUSD.length;

    const seismesesAtras = new Date();
    seismesesAtras.setMonth(seismesesAtras.getMonth() - 6);

    const preciosRecientes = precios.filter(p => p.fechaCompra >= seismesesAtras);
    const mejorReciente =
      preciosRecientes.length > 0
        ? preciosRecientes.reduce((mejor, actual) =>
            actual.costoUnitarioUSD < mejor.costoUnitarioUSD ? actual : mejor
          )
        : precios[0];

    resultado.set(productoId, {
      productoId,
      precioPromedioUSD: precioPromedio,
      precioMinimoUSD: precioMinimo,
      precioMaximoUSD: precioMaximo,
      ultimoPrecioUSD: precios[0].costoUnitarioUSD,
      proveedorRecomendado: {
        id: mejorReciente.proveedorId,
        nombre: mejorReciente.proveedorNombre,
        ultimoPrecioUSD: mejorReciente.costoUnitarioUSD
      },
      historial: precios.slice(0, 5).map(p => ({
        proveedorNombre: p.proveedorNombre,
        costoUnitarioUSD: p.costoUnitarioUSD,
        fechaCompra: p.fechaCompra
      }))
    });
  }

  return resultado;
}

/**
 * Referencia de precio EN MEMORIA (pura · sin Firestore) por SKU, a partir de las OCs ya
 * cargadas en el store. Para el wizard de OC (referencia inline al capturar el precio · F3).
 * última compra = la más reciente con costo > 0 · promedio = simple sobre esas compras.
 * Mismo filtro de estados que getPreciosHistoricos (excluye 'cancelada') para no mostrar "dos números".
 */
export function getReferenciaPreciosEnMemoria(
  productoIds: string[],
  ordenes: OrdenCompra[],
): Map<string, { ultimaCompra: number | null; promedio: number | null; nMuestras: number }> {
  const idSet = new Set(productoIds);
  const acc = new Map<string, { precio: number; fecha: number }[]>();
  for (const o of ordenes) {
    if (o.estado === 'cancelada') continue;
    const fecha = (o.fechaCreacion as { toMillis?: () => number })?.toMillis?.() ?? 0;
    for (const p of o.productos || []) {
      const id = p.productoId;
      if (!id || !idSet.has(id) || !(p.costoUnitario > 0)) continue;
      const list = acc.get(id) ?? [];
      list.push({ precio: p.costoUnitario, fecha });
      acc.set(id, list);
    }
  }
  const res = new Map<string, { ultimaCompra: number | null; promedio: number | null; nMuestras: number }>();
  for (const id of productoIds) {
    const list = acc.get(id) ?? [];
    if (list.length === 0) {
      res.set(id, { ultimaCompra: null, promedio: null, nMuestras: 0 });
      continue;
    }
    list.sort((a, b) => b.fecha - a.fecha);
    const promedio = list.reduce((s, x) => s + x.precio, 0) / list.length;
    res.set(id, { ultimaCompra: list[0].precio, promedio, nMuestras: list.length });
  }
  return res;
}

export async function getProductosProveedor(
  proveedorId: string
): Promise<
  Array<{
    productoId: string;
    sku: string;
    marca: string;
    nombreComercial: string;
    ultimoCostoUSD: number;
    cantidadTotal: number;
    ordenesCount: number;
  }>
> {
  try {
    const ordenes = await getAll();
    const productosMap = new Map<
      string,
      {
        productoId: string;
        sku: string;
        marca: string;
        nombreComercial: string;
        ultimoCostoUSD: number;
        cantidadTotal: number;
        ordenesCount: number;
        ultimaFecha: Date;
      }
    >();

    ordenes
      .filter(o => o.proveedorId === proveedorId && o.estado !== 'cancelada')
      .forEach(orden => {
        orden.productos.forEach(producto => {
          const existing = productosMap.get(producto.productoId);
          const fechaOrden = orden.fechaCreacion.toDate();

          if (existing) {
            existing.cantidadTotal += producto.cantidad;
            existing.ordenesCount += 1;
            if (fechaOrden > existing.ultimaFecha) {
              existing.ultimoCostoUSD = producto.costoUnitario;
              existing.ultimaFecha = fechaOrden;
            }
          } else {
            productosMap.set(producto.productoId, {
              productoId: producto.productoId,
              sku: producto.sku,
              marca: producto.marca,
              nombreComercial: producto.nombreComercial,
              ultimoCostoUSD: producto.costoUnitario,
              cantidadTotal: producto.cantidad,
              ordenesCount: 1,
              ultimaFecha: fechaOrden
            });
          }
        });
      });

    return Array.from(productosMap.values()).map(({ ultimaFecha, ...rest }) => rest);
  } catch (error: any) {
    logger.error('Error al obtener productos del proveedor:', error);
    return [];
  }
}
