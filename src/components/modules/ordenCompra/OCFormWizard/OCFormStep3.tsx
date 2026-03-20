/**
 * OC FORM WIZARD - STEP 3: COSTS & CONFIRMATION
 * Shows additional costs inputs, cost breakdown, financial impact,
 * a read-only product summary table, and tracking/notes fields.
 */

import React, { useMemo } from 'react';
import { DollarSign, TrendingUp, Package, FileText, Receipt } from 'lucide-react';
import { Input } from '../../../common/Input';
import type { Producto } from '../../../../types/producto.types';
import type { OCFormState, OCFormAction } from './ocFormTypes';
import {
  getSubtotalUSD,
  getImpuestoUSD,
  getTotalUSD,
  getTotalPEN,
  getTotalUnidades,
  getProductosValidos,
} from './ocFormTypes';

// ============================================
// TYPES
// ============================================

interface OCFormStep3Props {
  state: OCFormState;
  dispatch: React.Dispatch<OCFormAction>;
  productos: Producto[];
  paisOrigenNombre?: string;
  fleteEstimadoTotal: number;
}

// ============================================
// HELPERS
// ============================================

/** Compute a rough projected ROI from the intelligence cache margins */
function computeROI(state: OCFormState): number | null {
  const validos = getProductosValidos(state);
  if (validos.length === 0) return null;

  let totalCost = 0;
  let totalRevenue = 0;

  for (const item of validos) {
    const intel = state.intelligenceCache[item.productoId];

    // Try to get margin from intelligence proyeccion
    let precioVentaUSD = 0;
    if (intel?.proyeccionRentabilidad?.precioVentaSugerido && state.tcCompra > 0) {
      // precioVentaSugerido is in PEN, convert to USD
      precioVentaUSD = intel.proyeccionRentabilidad.precioVentaSugerido / state.tcCompra;
    }

    if (precioVentaUSD > 0) {
      totalCost += item.cantidad * item.costoUnitario;
      totalRevenue += item.cantidad * precioVentaUSD;
    }
  }

  if (totalCost <= 0) return null;
  return ((totalRevenue - totalCost) / totalCost) * 100;
}

// ============================================
// COMPONENT
// ============================================

const OCFormStep3: React.FC<OCFormStep3Props> = ({
  state,
  dispatch,
  productos,
  paisOrigenNombre,
  fleteEstimadoTotal,
}) => {
  const subtotalUSD = getSubtotalUSD(state);
  const impuestoUSD = getImpuestoUSD(state);
  const totalUSD = getTotalUSD(state);
  const totalPEN = getTotalPEN(state);
  const totalUnidades = getTotalUnidades(state);
  const productosValidos = getProductosValidos(state);

  const roi = useMemo(() => computeROI(state), [state]);

  return (
    <div className="space-y-5">
      {/* ── Costos Adicionales ── */}
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <DollarSign className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-900 text-sm">Costos Adicionales</span>
          {(state.porcentajeTax > 0 || state.gastosEnvioUSD > 0 || state.otrosGastosUSD > 0 || state.descuentoUSD > 0) && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              +${(impuestoUSD + state.gastosEnvioUSD + state.otrosGastosUSD - state.descuentoUSD).toFixed(2)}
            </span>
          )}
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Input
                label="Tax / Impuesto (%)"
                type="number"
                min="0"
                step="0.01"
                value={state.porcentajeTax}
                onChange={(e) => dispatch({ type: 'SET_TAX', payload: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
              {impuestoUSD > 0 && (
                <p className="text-xs text-amber-600 mt-1">= ${impuestoUSD.toFixed(2)} USD</p>
              )}
            </div>

            <Input
              label="Gastos de Envio (USD)"
              type="number"
              min="0"
              step="0.01"
              value={state.gastosEnvioUSD}
              onChange={(e) => dispatch({ type: 'SET_ENVIO', payload: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />

            <Input
              label="Otros Gastos (USD)"
              type="number"
              min="0"
              step="0.01"
              value={state.otrosGastosUSD}
              onChange={(e) => dispatch({ type: 'SET_OTROS', payload: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />

            <Input
              label="Descuento (USD)"
              type="number"
              min="0"
              step="0.01"
              value={state.descuentoUSD}
              onChange={(e) => dispatch({ type: 'SET_DESCUENTO', payload: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />
          </div>
        </div>
      </section>

      {/* ── Desglose de Costos ── */}
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <Receipt className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-900 text-sm">Desglose de Costos</span>
        </div>
        <div className="p-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal ({productosValidos.length} producto{productosValidos.length !== 1 ? 's' : ''}, {totalUnidades} uds):</span>
              <span>${subtotalUSD.toFixed(2)}</span>
            </div>
            {impuestoUSD > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Tax ({state.porcentajeTax}%):</span>
                <span>${impuestoUSD.toFixed(2)}</span>
              </div>
            )}
            {state.gastosEnvioUSD > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Envio:</span>
                <span>${state.gastosEnvioUSD.toFixed(2)}</span>
              </div>
            )}
            {state.otrosGastosUSD > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Otros gastos:</span>
                <span>${state.otrosGastosUSD.toFixed(2)}</span>
              </div>
            )}
            {fleteEstimadoTotal > 0 && (
              <div className="flex justify-between text-gray-500 italic">
                <span>Flete intl estimado{paisOrigenNombre ? ` (${paisOrigenNombre})` : ''}:</span>
                <span>${fleteEstimadoTotal.toFixed(2)}</span>
              </div>
            )}
            {state.descuentoUSD > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Descuento:</span>
                <span>-${state.descuentoUSD.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 my-1" />
            <div className="flex justify-between font-semibold text-primary-700 pt-1">
              <span>TOTAL USD:</span>
              <span>${totalUSD.toFixed(2)}</span>
            </div>
            {state.tcCompra > 0 && (
              <div className="flex justify-between font-semibold text-primary-800">
                <span>TOTAL PEN (TC {state.tcCompra.toFixed(3)}):</span>
                <span>S/ {totalPEN.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Impacto Financiero ── */}
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <TrendingUp className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-900 text-sm">Impacto Financiero</span>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <DollarSign className="h-5 w-5 text-blue-600 shrink-0" />
            <div>
              <div className="text-xs text-blue-600 font-medium">Inversion</div>
              <div className="text-sm font-semibold text-blue-800">
                S/ {totalPEN.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <div className="text-xs text-green-600 font-medium">ROI proyectado</div>
              <div className="text-sm font-semibold text-green-800">
                {roi !== null ? `~${roi.toFixed(0)}%` : 'N/D'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
            <Package className="h-5 w-5 text-purple-600 shrink-0" />
            <div>
              <div className="text-xs text-purple-600 font-medium">Unidades totales</div>
              <div className="text-sm font-semibold text-purple-800">
                {totalUnidades}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Productos (resumen) ── */}
      {productosValidos.length > 0 && (
        <section className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="font-medium text-gray-900 text-sm">Productos ({productosValidos.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-xs">
                  <th className="text-left py-2 px-4 font-medium">#</th>
                  <th className="text-left py-2 px-4 font-medium">Producto</th>
                  <th className="text-right py-2 px-4 font-medium">Cant</th>
                  <th className="text-right py-2 px-4 font-medium">Precio</th>
                  <th className="text-right py-2 px-4 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {productosValidos.map((item, idx) => (
                  <tr key={item.productoId + '-' + idx} className="border-b border-gray-50">
                    <td className="py-2 px-4 text-gray-400">{idx + 1}</td>
                    <td className="py-2 px-4">
                      <div className="font-medium text-gray-800 truncate max-w-[200px]">
                        {item.nombreComercial || item.sku || 'Producto'}
                      </div>
                      {item.marca && (
                        <div className="text-xs text-gray-400">{item.marca}{item.presentacion ? ` - ${item.presentacion}` : ''}</div>
                      )}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-700">{item.cantidad}</td>
                    <td className="py-2 px-4 text-right text-gray-700">${item.costoUnitario.toFixed(2)}</td>
                    <td className="py-2 px-4 text-right font-medium text-gray-900">
                      ${(item.cantidad * item.costoUnitario).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Tracking y Observaciones ── */}
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-900 text-sm">Tracking y Observaciones</span>
          {(state.numeroTracking || state.courier || state.observaciones) && (
            <span className="w-2 h-2 bg-green-500 rounded-full" />
          )}
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Numero de Tracking"
              type="text"
              value={state.numeroTracking}
              onChange={(e) => dispatch({ type: 'SET_TRACKING', payload: e.target.value })}
              placeholder="Ej: 1Z999AA10123456784"
            />
            <Input
              label="Courier"
              type="text"
              value={state.courier}
              onChange={(e) => dispatch({ type: 'SET_COURIER', payload: e.target.value })}
              placeholder="Ej: FedEx, UPS, DHL"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={state.observaciones}
              onChange={(e) => dispatch({ type: 'SET_OBSERVACIONES', payload: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="Notas internas..."
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export { OCFormStep3 };
export default OCFormStep3;
