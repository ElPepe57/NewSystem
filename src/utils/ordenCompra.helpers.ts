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

// ─── S42ba: Prorrateo de cargos al CTRU por producto ─────────────────────

/**
 * Detalle del prorrateo de un producto dentro de un bloque (OC o sub-orden).
 */
export interface ProrrateoProducto {
  /** Identificador del producto (normalmente productoId o índice) */
  productoId: string;
  /** SKU para mostrar */
  sku: string;
  /** Nombre para mostrar */
  nombre: string;
  /** Unidades del producto en el bloque */
  cantidad: number;
  /** Precio unitario del proveedor (costo base) */
  costoUnitario: number;
  /** Valor total de la línea (cantidad × costoUnitario) */
  subtotal: number;
  /** % que representa este producto del subtotal del bloque (0-1) */
  pctDelBloque: number;
  /** Cargos asignados por valor (shipping, handling, etc.) */
  cargoAsignado: number;
  /** Descuentos asignados por valor (S&S, cupones) */
  descuentoAsignado: number;
  /** Impuestos asignados por valor */
  impuestoAsignado: number;
  /** Costo comercial por unidad: (subtotal + cargos − desc + imp) / cantidad */
  ctruComercialUnitario: number;
  /** Costo comercial total de la línea: ctruComercialUnitario × cantidad */
  ctruComercialTotal: number;
}

/**
 * Un bloque de prorrateo = OC completa (si no se dividió) o una sub-orden.
 */
export interface BloqueProrrateo {
  /** ID del bloque. Para OC única: 'OC'. Para sub-orden: el id de la sub-orden */
  id: string;
  /** Label legible ("OC única" o "SUB-043-A") */
  nombre: string;
  /** Subtotal de productos en el bloque (suma de las líneas) */
  subtotalProductos: number;
  /** Total de cargos (shipping + otros) que el proveedor cobró a ESTE bloque */
  cargos: number;
  /** Total de descuentos del bloque */
  descuentos: number;
  /** Total de impuestos del bloque */
  impuestos: number;
  /** Total del bloque: subtotalProductos + cargos − descuentos + impuestos */
  totalBloque: number;
  /** Productos del bloque con su prorrateo calculado */
  productos: ProrrateoProducto[];
}

/**
 * Resultado global: todos los bloques + total acumulado de la OC.
 */
export interface DesgloseProrrateoOC {
  /** Bloques a procesar. Si la OC no se dividió: 1 bloque. Si sí: N bloques */
  bloques: BloqueProrrateo[];
  /** Total OC = suma de totalBloque de todos los bloques */
  totalOC: number;
  /** Fuente de los datos: 'oc_padre' o 'subOrdenes' */
  fuente: 'oc_padre' | 'subOrdenes';
}

/**
 * S42ba — Calcula el prorrateo de cargos al CTRU por producto siguiendo la
 * regla de negocio confirmada por el usuario:
 *
 * **Regla (Ejemplo 3 del modelo)**:
 *   1. Los cargos/descuentos/impuestos se quedan como el proveedor los asignó
 *      al bloque (OC completa o sub-orden).
 *   2. Dentro de cada bloque, esos cargos se reparten a los productos de forma
 *      **proporcional al valor del producto** (el que más cuesta absorbe más).
 *   3. El CTRU comercial resultante de un producto en un bloque = (subtotal
 *      línea + cargos_asignados − descuentos_asignados + impuestos_asignados)
 *      / cantidad.
 *   4. Dos unidades del mismo SKU PUEDEN tener CTRU distinto si vinieron de
 *      sub-órdenes con cargos diferentes (refleja realidad comercial del
 *      proveedor).
 *
 * **Nota**: este CTRU es el **comercial** (antes del landed cost logístico:
 * aduana, flete viajero, recojo local). Esos se suman al recibir el envío.
 *
 * @param orden La OC a prorratear.
 * @returns Desglose con los bloques y el detalle producto por producto.
 */
export function prorratearCargosOC(orden: OrdenCompra): DesgloseProrrateoOC {
  const tieneSubOrdenes = !!orden.subOrdenes && orden.subOrdenes.length > 0;

  const round2 = (n: number) => Number(n.toFixed(2));
  const round4 = (n: number) => Number(n.toFixed(4));

  /**
   * Calcula el prorrateo de un bloque dado su lista de productos y los
   * totales de cargos/desc/imp que el proveedor asignó a ESE bloque.
   */
  const prorratearBloque = (
    bloqueId: string,
    nombre: string,
    productos: Array<{
      productoId: string;
      sku?: string;
      nombreComercial?: string;
      cantidad: number;
      costoUnitario: number;
    }>,
    cargos: number,
    descuentos: number,
    impuestos: number
  ): BloqueProrrateo => {
    const subtotal = productos.reduce(
      (s, p) => s + (p.cantidad || 0) * (p.costoUnitario || 0),
      0
    );

    const items: ProrrateoProducto[] = productos.map((p) => {
      const lineaSubtotal = (p.cantidad || 0) * (p.costoUnitario || 0);
      const pct = subtotal > 0 ? lineaSubtotal / subtotal : 0;

      const cargoAsignado = round2(cargos * pct);
      const descuentoAsignado = round2(descuentos * pct);
      const impuestoAsignado = round2(impuestos * pct);

      const ctruComercialTotal = round2(
        lineaSubtotal + cargoAsignado - descuentoAsignado + impuestoAsignado
      );
      const ctruComercialUnitario =
        p.cantidad > 0 ? round4(ctruComercialTotal / p.cantidad) : 0;

      return {
        productoId: p.productoId,
        sku: p.sku ?? p.productoId,
        nombre: p.nombreComercial ?? p.sku ?? p.productoId,
        cantidad: p.cantidad,
        costoUnitario: p.costoUnitario,
        subtotal: round2(lineaSubtotal),
        pctDelBloque: round4(pct),
        cargoAsignado,
        descuentoAsignado,
        impuestoAsignado,
        ctruComercialUnitario,
        ctruComercialTotal,
      };
    });

    const totalBloque = round2(subtotal + cargos - descuentos + impuestos);

    return {
      id: bloqueId,
      nombre,
      subtotalProductos: round2(subtotal),
      cargos: round2(cargos),
      descuentos: round2(descuentos),
      impuestos: round2(impuestos),
      totalBloque,
      productos: items,
    };
  };

  // ─── Caso A: OC sin sub-órdenes → 1 solo bloque ───
  if (!tieneSubOrdenes) {
    const cargos =
      (orden.cargosOC ?? []).reduce((s, c) => s + (c.montoUSD || 0), 0) ||
      (orden.costoEnvioProveedorUSD ?? 0) + (orden.otrosGastosCompraUSD ?? 0);
    const descuentos =
      (orden.descuentosOC ?? []).reduce((s, d) => s + (d.montoUSD || 0), 0) ||
      (orden.descuentoUSD ?? 0);
    const impuestos =
      (orden.impuestosOC ?? []).reduce((s, i) => s + (i.montoUSD || 0), 0) ||
      (orden.impuestoCompraUSD ?? 0);

    const bloque = prorratearBloque(
      'OC',
      'OC única',
      orden.productos ?? [],
      cargos,
      descuentos,
      impuestos
    );

    return {
      bloques: [bloque],
      totalOC: bloque.totalBloque,
      fuente: 'oc_padre',
    };
  }

  // ─── Caso B: OC con sub-órdenes → 1 bloque por sub-orden ───
  const bloques = orden.subOrdenes!.map((sub) =>
    prorratearBloque(
      sub.id,
      sub.id, // se podría mejorar con un label "SUB-043-A"
      sub.productos ?? [],
      sub.shippingUSD ?? 0,
      sub.descuentoUSD ?? 0,
      sub.impuestoUSD ?? 0
    )
  );

  const totalOC = round2(bloques.reduce((s, b) => s + b.totalBloque, 0));

  return {
    bloques,
    totalOC,
    fuente: 'subOrdenes',
  };
}
