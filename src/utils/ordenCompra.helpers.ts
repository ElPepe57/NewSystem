import type { EstadoOrden, EstadoPagoOC, OrdenCompra, SubOrdenCompra } from '../types/ordenCompra.types';

// ─── Estado derivado de la OC basado en sus sub-ordenes ────────────────

/**
 * Calcula el estado logistico de la OC a partir del estado de sus sub-ordenes.
 * Si no hay sub-ordenes, retorna el estado actual sin cambios.
 */
export function calcularEstadoDerivadoOC(
  subOrdenes: SubOrdenCompra[],
  estadoActual: EstadoOrden
): EstadoOrden {
  if (!subOrdenes?.length) return estadoActual;

  const total = subOrdenes.length;
  const recibidas = subOrdenes.filter(s => s.estado === 'recibida').length;
  const enTransito = subOrdenes.filter(s => s.estado === 'en_transito').length;

  if (recibidas === total) return 'completada';
  if (recibidas > 0 || enTransito > 0) return 'en_proceso';
  return estadoActual;
}

/**
 * Calcula el estado de pago de la OC a partir del pago de sus sub-ordenes.
 * Si no hay sub-ordenes, retorna el estado actual sin cambios.
 */
export function calcularEstadoPagoDerivado(
  subOrdenes: SubOrdenCompra[],
  estadoPagoActual: EstadoPagoOC
): EstadoPagoOC {
  if (!subOrdenes?.length) return estadoPagoActual;

  const pagadas = subOrdenes.filter(s => s.estadoPago === 'pagado').length;
  if (pagadas === subOrdenes.length) return 'pagado';
  if (pagadas > 0) return 'parcial';
  return 'pendiente';
}

// ─── Resumen para badges de tabla ──────────────────────────────────────

export interface SubOrdenResumen {
  total: number;
  recibidas: number;
  enTransito: number;
  pendientes: number;
  pagadas: number;
}

/**
 * Genera un resumen compacto de sub-ordenes para mostrar en badges de tabla.
 * Retorna null si la OC no tiene sub-ordenes.
 */
export function getSubOrdenResumen(subOrdenes?: SubOrdenCompra[]): SubOrdenResumen | null {
  if (!subOrdenes?.length) return null;
  return {
    total: subOrdenes.length,
    recibidas: subOrdenes.filter(s => s.estado === 'recibida').length,
    enTransito: subOrdenes.filter(s => s.estado === 'en_transito').length,
    pendientes: subOrdenes.filter(s => !s.estado || s.estado === 'borrador').length,
    pagadas: subOrdenes.filter(s => s.estadoPago === 'pagado').length,
  };
}

// ─── S42az: Cargos efectivos de la OC ───────────────────────────────────

/**
 * Resultado de `getCargosEfectivosOC`. Representa los cargos reales que
 * aplican para cálculos operativos (CTRU, envíos, pagos, reportes).
 *
 * - `fuente = 'subOrdenes'`: se agregaron desde las sub-órdenes que
 *   subdividieron la OC según el proveedor real (fuente de verdad operativa).
 * - `fuente = 'oc_padre'`: se tomaron de la OC padre porque no se dividió
 *   en sub-órdenes (la OC es tanto borrador como realidad).
 */
export interface CargosEfectivosOC {
  subtotalProductos: number;
  cargos: number;       // Cargos positivos (shipping, handling, etc.)
  descuentos: number;   // Descuentos (se restan del total)
  impuestos: number;    // Impuestos
  total: number;        // subtotalProductos + cargos - descuentos + impuestos
  fuente: 'subOrdenes' | 'oc_padre';
}

/**
 * Devuelve los cargos efectivos de una OC, eligiendo la fuente de verdad
 * correcta según el estado de la OC:
 *
 * **Semántica del modelo (S42az):**
 * - La OC padre es el **borrador de cómo fue concebida** la orden.
 *   Contiene `cargosOC[]`, `descuentosOC[]`, `impuestosOC[]` tal como el
 *   usuario los capturó en el wizard. Es un snapshot inmutable de la
 *   intención original.
 * - Las sub-órdenes son el **detalle real de cómo se subdividió** la
 *   orden según el proveedor. Cada una tiene sus propios `shippingUSD`,
 *   `descuentoUSD`, `impuestoUSD` que son el **reflejo distribuido** de
 *   los cargos de la OC padre.
 * - **Regla de oro**: `Σ(sub-órdenes) === OC padre` (el delta de redondeo
 *   por impuestos % se absorbe en la última sub-orden para garantizarlo).
 *
 * **Cuándo usar cada fuente:**
 * - Cálculos de CTRU, pagos, envíos, reportes → usar este helper.
 *   Si la OC se dividió, la fuente de verdad son las sub-órdenes
 *   (reflejan lo que el proveedor realmente facturó en cada tanda).
 *   Si no, la OC padre es la única fuente.
 * - Auditoría, histórico, "qué pidió originalmente el usuario" →
 *   leer directamente `orden.cargosOC[]`, etc. (fuente siempre inmutable).
 */
export function getCargosEfectivosOC(orden: OrdenCompra): CargosEfectivosOC {
  const tieneSubOrdenes = !!orden.subOrdenes && orden.subOrdenes.length > 0;

  if (tieneSubOrdenes) {
    const subs = orden.subOrdenes!;
    const subtotalProductos = subs.reduce(
      (s, so) => s + (so.subtotalProductosUSD ?? 0),
      0
    );
    const cargos = subs.reduce((s, so) => s + (so.shippingUSD ?? 0), 0);
    const descuentos = subs.reduce((s, so) => s + (so.descuentoUSD ?? 0), 0);
    const impuestos = subs.reduce((s, so) => s + (so.impuestoUSD ?? 0), 0);
    const total = subs.reduce((s, so) => s + so.totalUSD, 0);
    return {
      subtotalProductos: Number(subtotalProductos.toFixed(2)),
      cargos: Number(cargos.toFixed(2)),
      descuentos: Number(descuentos.toFixed(2)),
      impuestos: Number(impuestos.toFixed(2)),
      total: Number(total.toFixed(2)),
      fuente: 'subOrdenes',
    };
  }

  // OC sin sub-órdenes: el borrador padre ES la realidad.
  // Usamos los arrays tipados (v2) si existen; fallback a campos legacy (v1).
  const cargos =
    (orden.cargosOC ?? []).reduce((s, c) => s + (c.montoUSD || 0), 0) ||
    (orden.costoEnvioProveedorUSD ?? 0) + (orden.otrosGastosCompraUSD ?? 0);
  const descuentos =
    (orden.descuentosOC ?? []).reduce((s, d) => s + (d.montoUSD || 0), 0) ||
    (orden.descuentoUSD ?? 0);
  const impuestos =
    (orden.impuestosOC ?? []).reduce((s, i) => s + (i.montoUSD || 0), 0) ||
    (orden.impuestoCompraUSD ?? 0);

  return {
    subtotalProductos: Number((orden.subtotalUSD ?? 0).toFixed(2)),
    cargos: Number(cargos.toFixed(2)),
    descuentos: Number(descuentos.toFixed(2)),
    impuestos: Number(impuestos.toFixed(2)),
    total: Number((orden.totalUSD ?? 0).toFixed(2)),
    fuente: 'oc_padre',
  };
}
