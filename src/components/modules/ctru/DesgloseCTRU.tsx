import React from 'react';
import { Calculator, Info } from 'lucide-react';
import { cn } from '../../../design-system';
import { prorratearCargosOC } from '../../../utils/ordenCompra.helpers';
import type { OrdenCompra } from '../../../types/ordenCompra.types';

// ════════════════════════════════════════════════════════════════════════════
// DesgloseCTRU — S42ba
// ════════════════════════════════════════════════════════════════════════════

/**
 * Muestra el prorrateo de cargos comerciales al CTRU por producto, siguiendo
 * la regla del Ejemplo 3 validada por el usuario:
 *
 *   1. Los cargos se quedan como el proveedor los asignó al bloque (OC o
 *      sub-orden).
 *   2. Dentro de cada bloque se reparten proporcional al valor del producto.
 *   3. El CTRU comercial unitario = (subtotal + cargos_pro − desc_pro + imp_pro)
 *      / cantidad.
 *
 * Si la OC tiene sub-órdenes con cargos desiguales, productos del mismo SKU en
 * distintas sub-órdenes tendrán CTRU distinto — esto es correcto y refleja
 * la realidad comercial que el proveedor facturó.
 *
 * Esta vista es READ-ONLY: solo muestra el cálculo, no modifica datos. Sirve
 * para auditar antes de recibir el envío. El CTRU landed (con aduana, flete,
 * etc.) se calcula al recibir.
 */
export const DesgloseCTRU: React.FC<{ orden: OrdenCompra }> = ({ orden }) => {
  const desglose = prorratearCargosOC(orden);
  const tieneMultiplesBloques = desglose.bloques.length > 1;

  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2 flex-wrap">
        <Calculator className="w-3.5 h-3.5" />
        <span>Desglose CTRU por producto</span>
        <span className="normal-case font-normal text-slate-400">
          (comercial — antes del landed cost logístico)
        </span>
        {desglose.fuente === 'subOrdenes' && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-semibold border border-teal-200 normal-case"
            title="Prorrateo calculado por sub-orden: cada bloque tiene sus propios cargos del proveedor."
          >
            Por sub-orden
          </span>
        )}
      </div>

      <div className="space-y-4">
        {desglose.bloques.map((bloque) => (
          <BloqueTabla
            key={bloque.id}
            bloque={bloque}
            mostrarNombre={tieneMultiplesBloques}
          />
        ))}
      </div>

      {/* Total consolidado si hay múltiples bloques */}
      {tieneMultiplesBloques && (
        <div className="mt-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
          <span className="font-semibold text-teal-900">
            Total consolidado ({desglose.bloques.length} sub-órdenes)
          </span>
          <span className="text-base font-bold text-teal-700 tabular-nums">
            ${desglose.totalOC.toFixed(2)}
          </span>
        </div>
      )}

      {/* Nota informativa */}
      <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
        <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
        <div>
          El CTRU mostrado es el <strong>comercial</strong>: costo del producto
          + cargos del proveedor prorrateados por valor. Al recibir el envío se
          sumarán los costos logísticos (aduana, flete viajero, recojo local)
          para obtener el <strong>CTRU landed final</strong>.
          {desglose.fuente === 'subOrdenes' && (
            <span className="block mt-1">
              Como la OC se dividió en sub-órdenes con cargos propios, productos
              del mismo SKU en diferentes sub-órdenes pueden tener CTRU distinto.
              Esto refleja la realidad comercial: el proveedor cobró diferente
              a cada tanda.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Componente interno: tabla de un bloque ────────────────────────────────

const BloqueTabla: React.FC<{
  bloque: ReturnType<typeof prorratearCargosOC>['bloques'][number];
  mostrarNombre: boolean;
}> = ({ bloque, mostrarNombre }) => {
  const tieneCargos = bloque.cargos > 0;
  const tieneDesc = bloque.descuentos > 0;
  const tieneImp = bloque.impuestos > 0;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header del bloque (solo si hay múltiples) */}
      {mostrarNombre && (
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-semibold text-slate-700 font-mono">
            {bloque.nombre}
          </span>
          <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
            <span>Subtotal <strong className="tabular-nums text-slate-900">${bloque.subtotalProductos.toFixed(2)}</strong></span>
            {tieneCargos && (
              <span>+ Cargos <strong className="tabular-nums text-slate-900">${bloque.cargos.toFixed(2)}</strong></span>
            )}
            {tieneDesc && (
              <span>− Desc <strong className="tabular-nums text-emerald-700">${bloque.descuentos.toFixed(2)}</strong></span>
            )}
            {tieneImp && (
              <span>+ Imp <strong className="tabular-nums text-slate-900">${bloque.impuestos.toFixed(2)}</strong></span>
            )}
            <span className="pl-2 border-l border-slate-300">
              Total <strong className="tabular-nums text-teal-700">${bloque.totalBloque.toFixed(2)}</strong>
            </span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Producto</th>
              <th className="px-3 py-2 text-right font-medium">Cant.</th>
              <th className="px-3 py-2 text-right font-medium">Precio/u</th>
              <th className="px-3 py-2 text-right font-medium">Subtotal</th>
              <th className="px-3 py-2 text-right font-medium">% bloque</th>
              {tieneCargos && (
                <th className="px-3 py-2 text-right font-medium">+ Cargos</th>
              )}
              {tieneDesc && (
                <th className="px-3 py-2 text-right font-medium">− Desc.</th>
              )}
              {tieneImp && (
                <th className="px-3 py-2 text-right font-medium">+ Imp.</th>
              )}
              <th className="px-4 py-2 text-right font-medium bg-teal-50 text-teal-900">
                CTRU/u
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bloque.productos.map((p) => (
              <tr key={p.productoId} className="hover:bg-slate-50/40 transition-colors">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-teal-700">{p.sku}</span>
                    <span className="text-slate-800 truncate">{p.nombre}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{p.cantidad}</td>
                <td className="px-3 py-2 text-right text-slate-700 tabular-nums">
                  ${p.costoUnitario.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-slate-900 font-medium tabular-nums">
                  ${p.subtotal.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-slate-500 tabular-nums text-[11px]">
                  {(p.pctDelBloque * 100).toFixed(2)}%
                </td>
                {tieneCargos && (
                  <td className="px-3 py-2 text-right text-slate-700 tabular-nums">
                    +${p.cargoAsignado.toFixed(2)}
                  </td>
                )}
                {tieneDesc && (
                  <td className="px-3 py-2 text-right text-emerald-700 tabular-nums">
                    −${p.descuentoAsignado.toFixed(2)}
                  </td>
                )}
                {tieneImp && (
                  <td className="px-3 py-2 text-right text-slate-700 tabular-nums">
                    +${p.impuestoAsignado.toFixed(2)}
                  </td>
                )}
                <td
                  className={cn(
                    'px-4 py-2 text-right font-bold tabular-nums bg-teal-50 text-teal-900'
                  )}
                >
                  ${p.ctruComercialUnitario.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Fila de totales del bloque */}
          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
            <tr>
              <td className="px-4 py-2 text-xs font-semibold text-slate-700">
                {mostrarNombre ? 'Total bloque' : 'Total OC'}
              </td>
              <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700 tabular-nums">
                {bloque.productos.reduce((s, p) => s + p.cantidad, 0)}
              </td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700 tabular-nums">
                ${bloque.subtotalProductos.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right text-xs font-semibold text-slate-500 tabular-nums">
                100%
              </td>
              {tieneCargos && (
                <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700 tabular-nums">
                  +${bloque.cargos.toFixed(2)}
                </td>
              )}
              {tieneDesc && (
                <td className="px-3 py-2 text-right text-xs font-semibold text-emerald-700 tabular-nums">
                  −${bloque.descuentos.toFixed(2)}
                </td>
              )}
              {tieneImp && (
                <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700 tabular-nums">
                  +${bloque.impuestos.toFixed(2)}
                </td>
              )}
              <td className="px-4 py-2 text-right bg-teal-100">
                <div className="text-xs font-semibold text-teal-700">
                  Total
                </div>
                <div className="text-sm font-bold text-teal-900 tabular-nums">
                  ${bloque.totalBloque.toFixed(2)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
