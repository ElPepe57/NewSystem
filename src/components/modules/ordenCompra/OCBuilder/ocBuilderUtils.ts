import type {
  OCBuilderState,
  OCDraftGroup,
  PoolProducto,
  OCBuilderProducto,
  GroupTotals,
  GroupColor,
  ProductoOrigen,
} from './ocBuilderTypes';
import { GROUP_COLORS } from './ocBuilderTypes';
import type { Requerimiento, ProductoRequerimiento } from '../../../../types/requerimiento.types';
import type { OrdenCompraFormData } from '../../../../types/ordenCompra.types';

// ============ Pool building ============

/**
 * Build the product pool from one or more requerimientos.
 * Partial-aware: subtracts cantidadEnOC (already in existing OCs) from available quantity.
 * Products fully covered (pendienteCompra === 0) are excluded from the pool.
 */
export function buildPool(requerimientos: Requerimiento[]): PoolProducto[] {
  const map = new Map<string, PoolProducto>();

  for (const req of requerimientos) {
    if (!req.productos) continue;
    for (const p of req.productos) {
      // Calculate available quantity (subtract what's already in OCs)
      const cantidadEnOC = p.cantidadEnOC || 0;
      const disponible = Math.max(0, p.cantidadSolicitada - cantidadEnOC);

      // Skip fully covered products
      if (disponible <= 0) continue;

      const existing = map.get(p.productoId);
      const origen: ProductoOrigen = {
        requerimientoId: req.id!,
        requerimientoNumero: req.numeroRequerimiento,
        cotizacionId: (req as any).ventaRelacionadaId || (req as any).cotizacionId,
        clienteNombre: req.nombreSolicitante || req.nombreClienteSolicitante || 'Administración',
        cantidad: disponible,
      };

      if (existing) {
        existing.cantidadOriginal += disponible;
        existing.cantidad += disponible;
        existing.origenes.push(origen);
        // Use max price if different
        if (p.precioEstimadoUSD && p.precioEstimadoUSD > existing.costoUnitarioUSD) {
          existing.costoUnitarioUSD = p.precioEstimadoUSD;
        }
        // Fill in product details if not yet set
        if (!existing.contenido && p.contenido) existing.contenido = p.contenido;
        if (!existing.dosaje && p.dosaje) existing.dosaje = p.dosaje;
        if (!existing.sabor && p.sabor) existing.sabor = p.sabor;
      } else {
        map.set(p.productoId, {
          productoId: p.productoId,
          sku: p.sku,
          marca: p.marca,
          nombreComercial: p.nombreComercial,
          presentacion: p.presentacion || '',
          contenido: p.contenido,
          dosaje: p.dosaje,
          sabor: p.sabor,
          cantidad: disponible,
          cantidadOriginal: disponible,
          cantidadAsignada: 0,
          costoUnitarioUSD: p.precioEstimadoUSD || 0,
          proveedorSugerido: p.proveedorSugerido,
          urlReferencia: p.urlReferencia,
          origenes: [origen],
        });
      }
    }
  }

  return Array.from(map.values());
}

// ============ Auto-group ============

/** Group products by proveedorSugerido, returns map of proveedorName -> productoIds */
export function autoGroupByProveedor(pool: PoolProducto[]): Map<string, PoolProducto[]> {
  const groups = new Map<string, PoolProducto[]>();

  for (const p of pool) {
    const key = p.proveedorSugerido?.trim() || 'Sin proveedor';
    const list = groups.get(key) || [];
    list.push(p);
    groups.set(key, list);
  }

  return groups;
}

// ============ Color cycling ============

export function getNextGroupColor(existingGroups: OCDraftGroup[]): GroupColor {
  const usedColors = new Set(existingGroups.map(g => g.color));
  const available = GROUP_COLORS.filter(c => !usedColors.has(c));
  return available.length > 0 ? available[0] : GROUP_COLORS[existingGroups.length % GROUP_COLORS.length];
}

// ============ Group totals ============

export function calcGroupTotals(group: OCDraftGroup): GroupTotals {
  const subtotalUSD = group.productos.reduce(
    (sum, p) => sum + p.cantidad * p.costoUnitarioUSD, 0
  );
  const impuestoUSD = subtotalUSD * (group.porcentajeTax / 100);
  const descuentoUSD = group.descuentoUSD || 0;
  const totalUSD = subtotalUSD + impuestoUSD + group.costoEnvioProveedorUSD + group.otrosGastosCompraUSD - descuentoUSD;
  const tc = group.tcCompra || 1;
  const totalPEN = totalUSD * tc;
  const cantidadUnidades = group.productos.reduce((sum, p) => sum + p.cantidad, 0);

  return {
    subtotalUSD,
    impuestoUSD,
    costoEnvioProveedorUSD: group.costoEnvioProveedorUSD,
    otrosGastosCompraUSD: group.otrosGastosCompraUSD,
    descuentoUSD,
    totalUSD,
    totalPEN,
    cantidadProductos: group.productos.length,
    cantidadUnidades,
  };
}

export function calcGrandTotals(groups: OCDraftGroup[]): GroupTotals {
  return groups.reduce<GroupTotals>(
    (acc, g) => {
      const t = calcGroupTotals(g);
      return {
        subtotalUSD: acc.subtotalUSD + t.subtotalUSD,
        impuestoUSD: acc.impuestoUSD + t.impuestoUSD,
        costoEnvioProveedorUSD: acc.costoEnvioProveedorUSD + t.costoEnvioProveedorUSD,
        otrosGastosCompraUSD: acc.otrosGastosCompraUSD + t.otrosGastosCompraUSD,
        descuentoUSD: acc.descuentoUSD + t.descuentoUSD,
        totalUSD: acc.totalUSD + t.totalUSD,
        totalPEN: acc.totalPEN + t.totalPEN,
        cantidadProductos: acc.cantidadProductos + t.cantidadProductos,
        cantidadUnidades: acc.cantidadUnidades + t.cantidadUnidades,
      };
    },
    { subtotalUSD: 0, impuestoUSD: 0, costoEnvioProveedorUSD: 0, otrosGastosCompraUSD: 0, descuentoUSD: 0, totalUSD: 0, totalPEN: 0, cantidadProductos: 0, cantidadUnidades: 0 }
  );
}

// ============ Recalculate pool from groups ============

export function recalcPool(pool: PoolProducto[], groups: OCDraftGroup[]): PoolProducto[] {
  return pool.map(p => {
    const cantidadAsignada = groups.reduce((sum, g) => {
      const inGroup = g.productos.find(gp => gp.productoId === p.productoId);
      return sum + (inGroup?.cantidad || 0);
    }, 0);
    return {
      ...p,
      cantidadAsignada,
      cantidad: p.cantidadOriginal - cantidadAsignada,
    };
  });
}

// ============ Validation ============

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateStep1(state: OCBuilderState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Unassigned products are now a WARNING, not an error (allows partial OC)
  const unassigned = state.pool.filter(p => p.cantidadOriginal - p.cantidadAsignada > 0);
  if (unassigned.length > 0) {
    const totalPendiente = unassigned.reduce((s, p) => s + (p.cantidadOriginal - p.cantidadAsignada), 0);
    warnings.push(`${unassigned.length} producto(s) con ${totalPendiente} uds quedarán pendientes de compra`);
  }

  // Must have at least one group
  if (state.groups.length === 0) {
    errors.push('Debes crear al menos un grupo de OC');
  }

  // No empty groups allowed
  const emptyGroups = state.groups.filter(g => g.productos.length === 0);
  if (emptyGroups.length > 0) {
    errors.push(`${emptyGroups.length} grupo(s) están vacíos`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateStep2(state: OCBuilderState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const g of state.groups) {
    if (!g.proveedor) {
      errors.push(`"${g.nombre}" necesita un proveedor`);
    }
    if (!g.almacenDestino) {
      errors.push(`"${g.nombre}" necesita un almacén destino`);
    }
    const tc = state.tcMode === 'global' ? state.tcGlobal : g.tcCompra;
    if (!tc || tc <= 0) {
      errors.push(`"${g.nombre}" necesita un tipo de cambio válido`);
    }
    const hasZeroPrice = g.productos.some(p => !p.costoUnitarioUSD || p.costoUnitarioUSD <= 0);
    if (hasZeroPrice) {
      warnings.push(`"${g.nombre}" tiene productos con precio $0`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============ Convert group to OrdenCompraFormData ============

export function groupToFormData(
  group: OCDraftGroup,
  _requerimientos: Requerimiento[],
  tcMode: 'global' | 'per_group',
  tcGlobal: number
): OrdenCompraFormData {
  const tc = tcMode === 'global' ? tcGlobal : group.tcCompra;
  const subtotalUSD = group.productos.reduce(
    (sum, p) => sum + p.cantidad * p.costoUnitarioUSD, 0
  );
  const impuestoUSD = subtotalUSD * (group.porcentajeTax / 100);
  const descuentoUSD = group.descuentoUSD || 0;
  const totalUSD = subtotalUSD + impuestoUSD + group.costoEnvioProveedorUSD + group.otrosGastosCompraUSD - descuentoUSD;

  // Derive reqIds from the actual product origenes in this group (not from all reqs)
  const reqIdSet = new Set<string>();
  for (const p of group.productos) {
    for (const o of p.origenes) {
      reqIdSet.add(o.requerimientoId);
    }
  }
  const reqIds = Array.from(reqIdSet);
  const isSingleReq = reqIds.length === 1;

  return {
    proveedorId: group.proveedor!.proveedorId,
    productos: group.productos.map(p => {
      const prod: any = {
        productoId: p.productoId,
        sku: p.sku,
        marca: p.marca,
        nombreComercial: p.nombreComercial,
        presentacion: p.presentacion,
        cantidad: p.cantidad,
        costoUnitario: p.costoUnitarioUSD,
        subtotal: p.cantidad * p.costoUnitarioUSD,
      };
      if (p.contenido) prod.contenido = p.contenido;
      if (p.dosaje) prod.dosaje = p.dosaje;
      if (p.sabor) prod.sabor = p.sabor;
      return prod;
    }),
    subtotalUSD,
    impuestoCompraUSD: impuestoUSD > 0 ? impuestoUSD : undefined,
    costoEnvioProveedorUSD: group.costoEnvioProveedorUSD > 0 ? group.costoEnvioProveedorUSD : undefined,
    otrosGastosCompraUSD: group.otrosGastosCompraUSD > 0 ? group.otrosGastosCompraUSD : undefined,
    descuentoUSD: descuentoUSD > 0 ? descuentoUSD : undefined,
    totalUSD,
    tcCompra: tc,
    almacenDestino: group.almacenDestino!.almacenId,
    observaciones: group.observaciones || undefined,
    requerimientoId: isSingleReq ? reqIds[0] : undefined,
    requerimientoIds: !isSingleReq ? reqIds : undefined,
    productosOrigen: group.productos.flatMap(p =>
      p.origenes.map(o => ({
        productoId: p.productoId,
        requerimientoId: o.requerimientoId,
        cantidad: o.cantidad,
        cotizacionId: o.cotizacionId,
        clienteNombre: o.clienteNombre,
      }))
    ),
    // CTRU v2: modo de entrega
    modoEntrega: group.modoEntrega || 'viajero',
    fleteIncluidoEnPrecio: group.fleteIncluidoEnPrecio || false,
    numeroTracking: group.numeroTracking || undefined,
    courier: group.operadorLogistico || undefined,
  };
}

// ============ Helpers ============

export function generateGroupId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Distribute origenes proportionally when splitting a product across groups */
export function distributeOrigenes(
  origenes: ProductoOrigen[],
  cantidad: number,
  totalOriginal: number
): ProductoOrigen[] {
  if (origenes.length <= 1) {
    return origenes.map(o => ({ ...o, cantidad }));
  }
  // Proportional distribution
  const ratio = cantidad / totalOriginal;
  let remaining = cantidad;
  return origenes.map((o, i) => {
    if (i === origenes.length - 1) {
      return { ...o, cantidad: remaining };
    }
    const assigned = Math.round(o.cantidad * ratio);
    remaining -= assigned;
    return { ...o, cantidad: assigned };
  });
}

/** Format product detail subtitle from available fields */
export function formatProductSubtitle(p: {
  presentacion?: string;
  contenido?: string;
  dosaje?: string;
  sabor?: string;
}): string {
  const parts: string[] = [];
  if (p.presentacion) parts.push(p.presentacion);
  if (p.contenido) parts.push(p.contenido);
  if (p.dosaje) parts.push(p.dosaje);
  if (p.sabor) parts.push(p.sabor);
  return parts.join(' · ');
}

export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPEN(amount: number): string {
  return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
