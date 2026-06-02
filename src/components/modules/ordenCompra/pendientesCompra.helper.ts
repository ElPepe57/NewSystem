import type { Requerimiento } from '../../../types/requerimiento.types';

// chk5.COMERCIALES-F3a · Lógica compartida de "pendientes de compra".
// Fuente única para PendientesCompraPanel (Requerimientos) y TabPendientesCompras (Compras).
// Calcula los productos de requerimientos aprobados/parciales que aún no están en una OC.

export interface PendienteOrigen {
  requerimientoId: string;
  requerimientoNumero: string;
  clienteNombre: string;
  cantidad: number;
  cotizacionId?: string;
}

export interface PendienteItem {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  pendienteTotal: number;
  costoEstimadoUSD: number;
  proveedorSugerido?: string;
  origenes: PendienteOrigen[];
}

/** Productos pendientes de comprar, agregados por productoId (suma de todos los requerimientos). */
export function calcularPendientesCompra(requerimientos: Requerimiento[]): PendienteItem[] {
  const map = new Map<string, PendienteItem>();

  for (const req of requerimientos) {
    if (req.estado !== 'aprobado' && req.estado !== 'parcial') continue;
    if (!req.productos) continue;

    for (const p of req.productos) {
      const cantidadEnOC = p.cantidadEnOC || 0;
      const pendiente = p.cantidadSolicitada - cantidadEnOC;
      if (pendiente <= 0) continue;

      const origen: PendienteOrigen = {
        requerimientoId: req.id!,
        requerimientoNumero: req.numeroRequerimiento,
        clienteNombre: req.nombreSolicitante || req.nombreClienteSolicitante || 'Admin',
        cantidad: pendiente,
        cotizacionId: req.cotizacionId || (req as any).ventaRelacionadaId,
      };

      const existing = map.get(p.productoId);
      if (existing) {
        existing.pendienteTotal += pendiente;
        existing.origenes.push(origen);
        if (p.precioEstimadoUSD && p.precioEstimadoUSD > existing.costoEstimadoUSD) {
          existing.costoEstimadoUSD = p.precioEstimadoUSD;
        }
      } else {
        map.set(p.productoId, {
          productoId: p.productoId,
          sku: p.sku,
          marca: p.marca,
          nombreComercial: p.nombreComercial,
          presentacion: p.presentacion || '',
          pendienteTotal: pendiente,
          costoEstimadoUSD: p.precioEstimadoUSD || 0,
          proveedorSugerido: p.proveedorSugerido,
          origenes: [origen],
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.pendienteTotal - a.pendienteTotal);
}

/** Dado un set de productoIds seleccionados, devuelve los requerimientos que los originan. */
export function requerimientosDeProductos(
  pendientes: PendienteItem[],
  selectedProductIds: Set<string>,
  requerimientos: Requerimiento[],
): Requerimiento[] {
  const selectedItems = pendientes.filter((p) => selectedProductIds.has(p.productoId));
  const reqIdsNeeded = new Set<string>();
  for (const item of selectedItems) for (const o of item.origenes) reqIdsNeeded.add(o.requerimientoId);
  return requerimientos.filter((r) => reqIdsNeeded.has(r.id!));
}

/** Totales agregados para los mini-stats del header. */
export function resumenPendientes(pendientes: PendienteItem[]) {
  const totalProductos = pendientes.length;
  const totalUnidades = pendientes.reduce((s, p) => s + p.pendienteTotal, 0);
  const totalEstimadoUSD = pendientes.reduce((s, p) => s + p.pendienteTotal * p.costoEstimadoUSD, 0);
  return { totalProductos, totalUnidades, totalEstimadoUSD };
}
