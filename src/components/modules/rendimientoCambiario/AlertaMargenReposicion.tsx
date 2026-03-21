import React from 'react';
import { TrendingDown, Info } from 'lucide-react';

// ============================================================
// INTERFACES
// ============================================================

export interface AlertaMargenReposicionProps {
  /**
   * Precio unitario de venta en PEN.
   * La alerta solo se muestra si precioVenta > ctruPromedio (ya pagamos el costo)
   * pero precioVenta < costoReposicion (no alcanzamos a reponer al TC actual).
   */
  precioVenta: number;
  /** Costo Total Real por Unidad (CTRU) en PEN */
  ctruPromedio: number;
  /** Costo de reposición calculado en PEN (costoUSD * tcMercado + costosAdicionalesPEN) */
  costoReposicion: number;
  /** TCPA del pool — se muestra en el mensaje informativo */
  tcpa: number;
  /** Nombre del producto para personalizar el mensaje */
  nombreProducto?: string;
}

/**
 * Determina si la alerta de reposición debe mostrarse.
 *
 * Condiciones:
 * - precio > ctru (no es venta bajo costo — ese caso ya tiene alerta roja)
 * - precio < costoReposicion (no alcanza para reponer al TC de mercado)
 */
export function debesMostrarAlertaReposicion(
  precioVenta: number,
  ctruPromedio: number,
  costoReposicion: number,
): boolean {
  return (
    precioVenta > 0 &&
    ctruPromedio > 0 &&
    costoReposicion > 0 &&
    precioVenta > ctruPromedio &&         // ya pasó el umbral de costo actual
    precioVenta < costoReposicion         // no cubre el costo de reposición
  );
}

// ============================================================
// COMPONENTE
// ============================================================

/**
 * AlertaMargenReposicion
 *
 * Banner amarillo que aparece cuando el precio de venta cubre el CTRU actual
 * pero no alcanza el costo de reposición al TC de mercado vigente.
 *
 * Se coloca DEBAJO de la alerta roja de ventaBajoCosto en VentaForm.tsx,
 * dentro del bloque del paso de revisión/confirmación.
 *
 * Ejemplo de uso en VentaForm:
 *
 *   {hayVentaBajoCosto && <AlertaBajoCosto ... />}
 *
 *   {!hayVentaBajoCosto && debesMostrarAlertaReposicion(precio, ctru, costoRepo) && (
 *     <AlertaMargenReposicion
 *       precioVenta={precio}
 *       ctruPromedio={ctru}
 *       costoReposicion={costoRepo}
 *       tcpa={resumen.tcpa}
 *       nombreProducto={producto.nombre}
 *     />
 *   )}
 */
export const AlertaMargenReposicion: React.FC<AlertaMargenReposicionProps> = ({
  precioVenta,
  ctruPromedio,
  costoReposicion,
  tcpa,
  nombreProducto,
}) => {
  // Margen real sobre el precio (vs costo de reposición)
  const margenReposicion = costoReposicion > 0
    ? ((precioVenta - costoReposicion) / precioVenta) * 100
    : 0;

  // Gap en soles por unidad
  const gapPorUnidad = costoReposicion - precioVenta;

  // Margen sobre CTRU actual (positivo, ya que pasó la validación)
  const margenCtru = ctruPromedio > 0
    ? ((precioVenta - ctruPromedio) / precioVenta) * 100
    : 0;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3.5 space-y-2">
      {/* Cabecera */}
      <div className="flex items-start gap-2.5">
        <TrendingDown className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h5 className="text-sm font-semibold text-amber-800">
            Margen de reposición negativo
            {nombreProducto ? ` — ${nombreProducto}` : ''}
          </h5>
          <p className="text-xs text-amber-700 mt-0.5">
            El precio cubre el costo actual (CTRU) pero no alcanza para reponer
            la mercadería al tipo de cambio de mercado.
          </p>
        </div>
      </div>

      {/* Cifras clave */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/60 rounded-md p-2.5">
        <div className="text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Precio venta</p>
          <p className="text-sm font-bold text-gray-800">S/ {precioVenta.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">CTRU actual</p>
          <p className="text-sm font-bold text-green-700">S/ {ctruPromedio.toFixed(2)}</p>
          <p className="text-[10px] text-green-600">+{margenCtru.toFixed(1)}%</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Costo reposición</p>
          <p className="text-sm font-bold text-amber-700">S/ {costoReposicion.toFixed(2)}</p>
          <p className="text-[10px] text-amber-600">TCPA {tcpa.toFixed(4)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Gap cambiario</p>
          <p className="text-sm font-bold text-red-600">-S/ {gapPorUnidad.toFixed(2)}</p>
          <p className="text-[10px] text-red-600">{margenReposicion.toFixed(1)}% margen repo</p>
        </div>
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-700 leading-relaxed">
          Esta venta es rentable hoy, pero cada unidad vendida acumula un gap de{' '}
          <strong>S/ {gapPorUnidad.toFixed(2)}</strong> que erosiona la capacidad de reposición al TC de mercado.
          Considera ajustar el precio o compensar con otras líneas de mayor margen.
        </p>
      </div>
    </div>
  );
};

// ============================================================
// VERSIÓN MULTI-PRODUCTO
// ============================================================

export interface ProductoConGapReposicion {
  productoId: string;
  nombre: string;
  precioVenta: number;
  ctruPromedio: number;
  costoReposicion: number;
  cantidad: number;
}

export interface AlertaMargenReposicionMultiProps {
  productos: ProductoConGapReposicion[];
  tcpa: number;
}

/**
 * Variante multi-producto para cuando hay varios ítems en la venta.
 * Muestra un resumen colapsado con el total del gap acumulado.
 */
export const AlertaMargenReposicionMulti: React.FC<AlertaMargenReposicionMultiProps> = ({
  productos,
  tcpa,
}) => {
  const conGap = productos.filter((p) =>
    debesMostrarAlertaReposicion(p.precioVenta, p.ctruPromedio, p.costoReposicion)
  );

  if (conGap.length === 0) return null;

  const gapTotalPEN = conGap.reduce((sum, p) => {
    const gapUnitario = p.costoReposicion - p.precioVenta;
    return sum + gapUnitario * p.cantidad;
  }, 0);

  const margenPromedioReposicion = (() => {
    const totalIngreso = conGap.reduce((s, p) => s + p.precioVenta * p.cantidad, 0);
    const totalCostoRepo = conGap.reduce((s, p) => s + p.costoReposicion * p.cantidad, 0);
    if (totalIngreso === 0) return 0;
    return ((totalIngreso - totalCostoRepo) / totalIngreso) * 100;
  })();

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3.5 space-y-2">
      {/* Cabecera */}
      <div className="flex items-start gap-2.5">
        <TrendingDown className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h5 className="text-sm font-semibold text-amber-800">
            {conGap.length === 1
              ? `Margen de reposición negativo — ${conGap[0].nombre}`
              : `${conGap.length} productos con gap de reposición`
            }
          </h5>
          <p className="text-xs text-amber-700 mt-0.5">
            Precio mayor al CTRU pero insuficiente para reponer al TC actual (TCPA {tcpa.toFixed(4)})
          </p>
        </div>
      </div>

      {/* Detalle por producto */}
      <div className="bg-white/60 rounded-md p-2 space-y-1">
        {conGap.map((p) => {
          const gapUnitario = p.costoReposicion - p.precioVenta;
          const margenRepo = p.costoReposicion > 0
            ? ((p.precioVenta - p.costoReposicion) / p.precioVenta) * 100
            : 0;

          return (
            <div key={p.productoId} className="flex items-center justify-between text-xs">
              <span className="text-amber-800 font-medium truncate mr-2 max-w-[200px]">
                {p.nombre}
              </span>
              <span className="text-amber-700 whitespace-nowrap">
                Margen repo:{' '}
                <strong className="text-red-600">{margenRepo.toFixed(1)}%</strong>
                {' · '}
                Gap:{' '}
                <strong className="text-red-600">
                  -S/ {gapUnitario.toFixed(2)}
                </strong>
                {p.cantidad > 1 && ` × ${p.cantidad} = -S/ ${(gapUnitario * p.cantidad).toFixed(2)}`}
              </span>
            </div>
          );
        })}

        <div className="border-t border-amber-200 pt-1 mt-1 flex justify-between font-semibold text-xs text-amber-800">
          <span>Gap total acumulado:</span>
          <span className="text-red-600">-S/ {gapTotalPEN.toFixed(2)}</span>
        </div>
      </div>

      {/* Nota */}
      <div className="flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-700 leading-relaxed">
          Margen promedio de reposición en estos productos:{' '}
          <strong>{margenPromedioReposicion.toFixed(1)}%</strong>.
          Esta venta es rentable hoy, pero erosiona el capital de trabajo en{' '}
          <strong>S/ {gapTotalPEN.toFixed(2)}</strong> respecto al ciclo siguiente.
        </p>
      </div>
    </div>
  );
};
