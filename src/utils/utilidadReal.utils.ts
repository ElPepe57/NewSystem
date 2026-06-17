/**
 * utilidadReal.utils — Utilidad REAL del período = las 3 cajas, ABIERTA POR CANAL (pata 4).
 *
 *   Ingresos − CTRU producto (caja producto) = Margen bruto
 *   Margen bruto − Gastos de venta (caja venta) = Contribución
 *   Contribución − Gasto fijo del mes prorrateado (caja período) = Utilidad operativa
 *
 * Channel-aware (decisión spec §3.3 · NO promediar canales): cada canal computa sus 3
 * cajas con SU comisión/gasto de venta real, así un producto que pierde en Mercado Libre
 * pero gana en venta directa se ve ABIERTO, no licuado en un promedio.
 *
 * Overhead (caja período) = prorrateado por % de ventas (ingreso del canal / total).
 * NO toca el CTRU (Acuerdo 3 · el overhead vive en el P&L, no en el costo del producto).
 * NO recalcula el margen por venta: la contribución por venta viene del motor existente
 * (useRentabilidadVentas) · este módulo solo AGREGA por canal y prorratea el overhead.
 */

/** Una venta ya reducida a sus 3 componentes (el caller los saca de useRentabilidadVentas/ventasDetalle). */
export interface VentaCaja {
  canal?: string;
  canalNombre?: string;
  ingreso: number;         // precio × cantidad (PEN)
  costoProducto: number;   // CTRU de las unidades de la venta (caja producto)
  gastoVenta: number;      // caja venta (comisión + envío + delivery)
}

export interface UtilidadCanal {
  canal: string;
  canalNombre: string;
  ingresos: number;
  ctru: number;              // caja producto
  margenBruto: number;       // ingresos − ctru
  gastosVenta: number;       // caja venta
  contribucion: number;      // margenBruto − gastosVenta
  overhead: number;          // gasto fijo del mes prorrateado por % ventas
  utilidadOperativa: number; // contribucion − overhead
  margenOperativoPct: number;
}

export type TotalUtilidad = Omit<UtilidadCanal, 'canal' | 'canalNombre'>;

export interface UtilidadReal3Cajas {
  porCanal: UtilidadCanal[];
  total: TotalUtilidad;
  gastoFijoMes: number;
}

/**
 * Calcula la utilidad real del período abierta por canal, prorrateando el gasto fijo
 * del mes por % de ventas. El total reconcilia con Σ de los canales.
 */
export function calcularUtilidad3Cajas(ventas: VentaCaja[], gastoFijoMes: number): UtilidadReal3Cajas {
  const ingresosTotal = ventas.reduce((s, v) => s + v.ingreso, 0);

  const grupos = new Map<string, { nombre: string; ingresos: number; ctru: number; gastosVenta: number }>();
  for (const v of ventas) {
    const key = v.canal || '—';
    const g = grupos.get(key) || { nombre: v.canalNombre || key, ingresos: 0, ctru: 0, gastosVenta: 0 };
    g.ingresos += v.ingreso;
    g.ctru += v.costoProducto;
    g.gastosVenta += v.gastoVenta;
    grupos.set(key, g);
  }

  const porCanal: UtilidadCanal[] = [];
  for (const [canal, g] of grupos) {
    const margenBruto = g.ingresos - g.ctru;
    const contribucion = margenBruto - g.gastosVenta;
    const overhead = ingresosTotal > 0 ? gastoFijoMes * (g.ingresos / ingresosTotal) : 0;
    const utilidadOperativa = contribucion - overhead;
    porCanal.push({
      canal,
      canalNombre: g.nombre,
      ingresos: g.ingresos,
      ctru: g.ctru,
      margenBruto,
      gastosVenta: g.gastosVenta,
      contribucion,
      overhead,
      utilidadOperativa,
      margenOperativoPct: g.ingresos > 0 ? (utilidadOperativa / g.ingresos) * 100 : 0,
    });
  }

  const tIngresos = porCanal.reduce((s, c) => s + c.ingresos, 0);
  const tCtru = porCanal.reduce((s, c) => s + c.ctru, 0);
  const tGastosVenta = porCanal.reduce((s, c) => s + c.gastosVenta, 0);
  const tOverhead = porCanal.reduce((s, c) => s + c.overhead, 0); // == gastoFijoMes si hay ventas
  const tMargenBruto = tIngresos - tCtru;
  const tContribucion = tMargenBruto - tGastosVenta;
  const tUtilidadOperativa = tContribucion - tOverhead;

  return {
    porCanal: porCanal.sort((a, b) => b.ingresos - a.ingresos),
    total: {
      ingresos: tIngresos,
      ctru: tCtru,
      margenBruto: tMargenBruto,
      gastosVenta: tGastosVenta,
      contribucion: tContribucion,
      overhead: tOverhead,
      utilidadOperativa: tUtilidadOperativa,
      margenOperativoPct: tIngresos > 0 ? (tUtilidadOperativa / tIngresos) * 100 : 0,
    },
    gastoFijoMes,
  };
}
