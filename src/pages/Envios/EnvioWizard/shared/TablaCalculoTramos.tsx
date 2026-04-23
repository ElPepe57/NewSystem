/**
 * TablaCalculoTramos — Tabla de cálculo automático del flete por tramos (D-11)
 *
 * S52 v7: cuando la modalidad de costo es "por_tramos", esta tabla muestra
 * una fila por cada producto seleccionado en el Paso 1, con el tramo de peso
 * que le aplica y el subtotal calculado.
 *
 * Input:
 *   - unidades: las unidades seleccionadas en Paso 1 (con pesoLibras)
 *   - tramos: la tabla de tramos cargada del colaborador (o editada)
 *
 * Output: total derivado (sum de subtotales).
 */
import React from 'react';
import type { TramoPeso } from '../../../../types/colaborador.types';
import type { UnidadSeleccionadaWizard } from '../envioWizardTypes';
import { encontrarTramoPorPeso } from '../envioWizardTypes';

interface Props {
  unidades: UnidadSeleccionadaWizard[];
  tramos: TramoPeso[];
  totalFleteUSD: number;
}

function formatTramoLabel(tramo: TramoPeso): string {
  const desde = tramo.pesoDesde;
  const hasta = tramo.pesoHasta;
  if (hasta === null) return `≥ ${desde} lb · $${tramo.costoUnitario.toFixed(2)}`;
  if (desde === 0) return `< ${hasta} lb · $${tramo.costoUnitario.toFixed(2)}`;
  return `${desde}-${hasta} lb · $${tramo.costoUnitario.toFixed(2)}`;
}

export const TablaCalculoTramos: React.FC<Props> = ({
  unidades,
  tramos,
  totalFleteUSD,
}) => {
  if (unidades.length === 0) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center text-xs text-slate-600">
        Sin unidades seleccionadas. Agregá productos en el Paso 1 para ver el
        cálculo.
      </div>
    );
  }

  if (tramos.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div className="text-xs">
          <div className="font-semibold text-amber-900 mb-0.5">
            Sin tramos configurados
          </div>
          <p className="text-amber-800">
            Elegí un transportador que tenga tramos preset, o configurá la
            tabla manualmente arriba.
          </p>
        </div>
      </div>
    );
  }

  // Detectar unidades sin peso configurado
  const unidadesSinPeso = unidades.filter(u => u.pesoLibras === undefined);

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Cálculo automático · por producto del Paso 1
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Producto</th>
                <th className="px-3 py-2 text-right font-semibold">Peso unit.</th>
                <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                <th className="px-3 py-2 text-left font-semibold">Tramo aplicado</th>
                <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unidades.map(u => {
                const tramo =
                  u.pesoLibras !== undefined
                    ? encontrarTramoPorPeso(tramos, u.pesoLibras)
                    : null;
                const subtotal =
                  u.pesoLibras !== undefined && tramo
                    ? tramo.costoUnitario * u.cantidadSeleccionada
                    : 0;
                const rowClass =
                  u.pesoLibras === undefined ? 'bg-amber-50/50' : '';
                return (
                  <tr key={u.productoId} className={rowClass}>
                    <td className="px-3 py-2">📦 {u.productoNombre}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {u.pesoLibras !== undefined ? (
                        `${u.pesoLibras} lb`
                      ) : (
                        <span className="text-amber-600">Sin peso</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {u.cantidadSeleccionada}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-600">
                      {tramo ? formatTramoLabel(tramo) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                      ${subtotal.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-teal-50 border-t-2 border-teal-200">
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-2 font-semibold text-teal-900 text-right"
                >
                  TOTAL DEL FLETE:
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-teal-900 text-sm">
                  ${totalFleteUSD.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Advertencia si hay productos sin peso */}
      {unidadesSinPeso.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div className="text-xs flex-1">
            <div className="font-semibold text-amber-900 mb-0.5">
              {unidadesSinPeso.length} producto
              {unidadesSinPeso.length > 1 ? 's sin' : ' sin'} peso configurado
            </div>
            <p className="text-amber-800 mb-1">
              Los siguientes productos no tienen peso en el catálogo y no se
              incluyen en el cálculo:
            </p>
            <ul className="text-amber-800 list-disc pl-4">
              {unidadesSinPeso.map(u => (
                <li key={u.productoId}>{u.productoNombre}</li>
              ))}
            </ul>
            <p className="text-amber-800 mt-1">
              Definí el peso en la ficha del producto, o usá otra modalidad de
              costo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
