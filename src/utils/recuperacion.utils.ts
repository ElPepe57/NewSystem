/**
 * recuperacion.utils — Tracker de RECUPERACIÓN / amortización (pata 3 · el "alma" del CTRU).
 *
 * Responde "¿cuánto de lo INVERTIDO ya recuperé vendiendo, en el tiempo?":
 *   - BASE invertida = Σ getCTRU de las unidades del producto (todo el lote · activas + vendidas).
 *   - Curva = contribución acumulada (precio − costo − gasto de venta) ordenada por fecha.
 *   - %recuperado = acumulado / base · break-even = primer punto donde acumulado ≥ base.
 *
 * HONESTIDAD DE PROCEDENCIA (verdict adversarial 2026-06-16): la contribución sale del
 * SNAPSHOT congelado de la venta (ventasDetalle.contribucionUnitaria = precio − costoUnitario
 * − gvgd, donde costoUnitario = costoTotalUnidades/cantidad), NO de una llamada viva a getCTRU.
 * getCTRU solo da la BASE invertida. NO es estrictamente 100%: las ventas con costoTotalUnidades=0
 * (ML / sin unidades asignadas) inflarían la contribución (costo=0) → se EXCLUYEN y se reportan.
 */

export interface VentaRecuperacion {
  fecha: Date | null;
  cantidad: number;
  /** precioUnitario − costoUnitario − gvgdUnitario (de ventasDetalle). */
  contribucionUnitaria: number;
  /** costo unitario snapshot; si ≤ 0 la venta no tiene costo asignado (se excluye). */
  costoUnitario: number;
  canal?: string;
}

export interface PuntoRecuperacion {
  fecha: Date | null;
  ventaIndex: number;
  contribucionVenta: number;   // contribucionUnitaria × cantidad
  acumulado: number;           // contribución acumulada hasta este punto
  pctRecuperado: number;       // acumulado / base × 100
}

export interface CurvaRecuperacion {
  baseInvertida: number;       // Σ getCTRU de las unidades del producto
  totalRecuperado: number;     // contribución acumulada total
  pctRecuperado: number;       // totalRecuperado / base × 100
  porRecuperar: number;        // max(0, base − totalRecuperado)
  breakEvenIndex: number | null;  // índice del punto donde se cubrió la base (o null)
  breakEvenFecha: Date | null;
  puntos: PuntoRecuperacion[];
  ventasSinCosto: number;      // ventas excluidas por costoUnitario ≤ 0 (no es 100%)
}

/**
 * Construye la curva de recuperación de un producto a partir de sus ventas y la base
 * invertida. Ordena ASC por fecha, acumula contribución, y marca el break-even.
 * Las ventas sin costo asignado (costoUnitario ≤ 0) se EXCLUYEN para no inflar la curva.
 */
export function calcularCurvaRecuperacion(
  ventas: VentaRecuperacion[],
  baseInvertida: number,
): CurvaRecuperacion {
  const ventasSinCosto = ventas.filter((v) => v.costoUnitario <= 0).length;

  const validas = ventas
    .filter((v) => v.costoUnitario > 0)
    .slice()
    .sort((a, b) => (a.fecha?.getTime() ?? 0) - (b.fecha?.getTime() ?? 0)); // ASC por fecha

  let acumulado = 0;
  let breakEvenIndex: number | null = null;
  let breakEvenFecha: Date | null = null;

  const puntos: PuntoRecuperacion[] = validas.map((v, i) => {
    const contribucionVenta = v.contribucionUnitaria * v.cantidad;
    acumulado += contribucionVenta;
    if (breakEvenIndex === null && baseInvertida > 0 && acumulado >= baseInvertida) {
      breakEvenIndex = i;
      breakEvenFecha = v.fecha;
    }
    return {
      fecha: v.fecha,
      ventaIndex: i,
      contribucionVenta,
      acumulado,
      pctRecuperado: baseInvertida > 0 ? (acumulado / baseInvertida) * 100 : 0,
    };
  });

  return {
    baseInvertida,
    totalRecuperado: acumulado,
    pctRecuperado: baseInvertida > 0 ? (acumulado / baseInvertida) * 100 : 0,
    porRecuperar: Math.max(0, baseInvertida - acumulado),
    breakEvenIndex,
    breakEvenFecha,
    puntos,
    ventasSinCosto,
  };
}

/**
 * Filtra ventas a una ventana de N meses hacia atrás desde una fecha de referencia.
 * (caveat spec §3.2 · ventana 6m default). `ahora` se inyecta para testabilidad.
 */
export function filtrarVentanaMeses<T extends { fecha: Date | null }>(
  ventas: T[],
  mesesAtras: number,
  ahora: Date,
): T[] {
  const corte = new Date(ahora.getFullYear(), ahora.getMonth() - mesesAtras, ahora.getDate());
  return ventas.filter((v) => v.fecha != null && v.fecha >= corte);
}
