/**
 * EnvioJStepCostos — Paso 4 del Wizard J (Costos landed).
 *
 * Adaptación del paso Costos del Wizard T2 al state shape del Caso J.
 * La UX es idéntica: 3 presets (Monto total · Por unidad · Variable) + fee
 * de recepción + preview CTRU landed.
 *
 * D-17/D-18: timing flexible, scope='envio' implícito en S47.
 */
import React, { useEffect, useMemo } from 'react';
import { useProductoStore } from '../../../store/productoStore';
import { useTipoCambio } from '../../../hooks/useTipoCambio';
import { getEmojiPorProducto } from '../../../components/modules/ordenCompra/OCWizardV3/productoEmoji';
import {
  TarifaPresetSelector,
  CTRULandedPreview,
  type CTRULandedPreviewFila,
  type CostoAdicionalT2,
} from '../EnvioWizardT2';
import { cn } from '../../../design-system';
import type { EnvioWizardJState, EnvioWizardJAction } from './envioWizardJTypes';
import {
  selectMontoTotalFlete,
  selectUnidadesCount,
  selectCTRUBaseUSD,
  selectPesoTotalLb,
  selectTotalCostosAdicionales,
} from './envioWizardJTypes';

export interface EnvioJStepCostosProps {
  state: EnvioWizardJState;
  dispatch: (action: EnvioWizardJAction) => void;
}

export const EnvioJStepCostos: React.FC<EnvioJStepCostosProps> = ({ state, dispatch }) => {
  const productos = useProductoStore((s) => s.productos);
  const { tc } = useTipoCambio();

  const pesosPorProducto = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of productos) {
      map[p.id] = p.pesoLibras || 0;
    }
    return map;
  }, [productos]);

  useEffect(() => {
    if (state.tipoCambio === 0 && tc?.venta) {
      dispatch({ type: 'SET_TIPO_CAMBIO', tc: tc.venta });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tc]);

  const pesoTotalLb = selectPesoTotalLb(state, pesosPorProducto);
  const unidadesCount = selectUnidadesCount(state);
  const ctruBaseUSD = selectCTRUBaseUSD(state);
  const montoTotalFlete = selectMontoTotalFlete(state);
  const costosAdicionales = selectTotalCostosAdicionales(state);
  const totalLandedUSD = montoTotalFlete + costosAdicionales;

  const filasPreview: CTRULandedPreviewFila[] = useMemo(() => {
    const grupos = new Map<string, { uds: number; ctruBase: number; pesoTotal: number }>();
    const seleccionadas = state.unidadesDisponibles.filter((u) =>
      state.unidadesIdsSeleccionadas.includes(u.id)
    );
    for (const u of seleccionadas) {
      const existente = grupos.get(u.productoId) || { uds: 0, ctruBase: 0, pesoTotal: 0 };
      existente.uds += 1;
      existente.ctruBase += u.ctruDinamico ?? u.costoUnitarioUSD ?? 0;
      existente.pesoTotal += pesosPorProducto[u.productoId] ?? 0;
      grupos.set(u.productoId, existente);
    }

    const prorratearLanded = (pId: string, uds: number, pesoGrupo: number): number => {
      if (totalLandedUSD === 0) return 0;
      switch (state.presetTarifa) {
        case 'monto_total': {
          if (pesoTotalLb === 0) return 0;
          return (pesoGrupo / pesoTotalLb) * totalLandedUSD;
        }
        case 'por_unidad': {
          if (unidadesCount === 0) return 0;
          return (uds / unidadesCount) * totalLandedUSD;
        }
        case 'variable': {
          const tarifaUnit = state.tarifaVariablePorProducto[pId] ?? 0;
          return tarifaUnit * uds + (uds / Math.max(unidadesCount, 1)) * costosAdicionales;
        }
        default:
          return 0;
      }
    };

    return Array.from(grupos.entries()).map(([productoId, g]) => {
      const prod = productos.find((p) => p.id === productoId);
      const { emoji } = prod
        ? getEmojiPorProducto({
            nombreComercial: prod.nombreComercial,
            marca: prod.marca,
            atributosSkincare: prod.atributosSkincare,
          })
        : { emoji: '📦' };
      return {
        productoId,
        productoNombre: prod?.nombreComercial || `Producto ${productoId.slice(0, 6)}`,
        emoji,
        uds: g.uds,
        ctruBaseUSD: g.ctruBase,
        landedUSD: prorratearLanded(productoId, g.uds, g.pesoTotal),
      };
    });
  }, [
    state.unidadesDisponibles,
    state.unidadesIdsSeleccionadas,
    state.presetTarifa,
    state.tarifaVariablePorProducto,
    totalLandedUSD,
    pesoTotalLb,
    unidadesCount,
    costosAdicionales,
    pesosPorProducto,
    productos,
  ]);

  const feeRecepcion = state.costosAdicionales.find((c) => c.id === 'fee-recepcion');
  const toggleFeeRecepcion = (activo: boolean) => {
    if (activo && !feeRecepcion) {
      const nuevo: CostoAdicionalT2 = {
        id: 'fee-recepcion',
        concepto: 'Recepción en casilla destino',
        metodo: 'monto_total',
        monto: 0,
        activo: true,
      };
      dispatch({ type: 'AGREGAR_COSTO_ADICIONAL', costo: nuevo });
    } else if (feeRecepcion) {
      dispatch({
        type: 'EDITAR_COSTO_ADICIONAL',
        id: 'fee-recepcion',
        updates: { activo },
      });
    }
  };

  // No-op to silence unused variable warning when CTRU base no se renderiza aquí
  void ctruBaseUSD;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Costos landed conocidos al momento
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Captura lo que ya sabes. <strong>No tienes que llenar todo ahora</strong> — puedes agregar,
          editar o eliminar costos después en el detalle del envío (hasta que se cierre).
        </p>
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0 text-sm">
          ⏱️
        </div>
        <div className="text-xs text-sky-900">
          <div className="font-semibold mb-0.5">
            Los costos pueden registrarse antes, durante o incluso después de recibir
          </div>
          <div className="text-sky-800">
            En Caso J el transportador suele facturar tras completar el viaje. El CTRU queda{' '}
            <strong>preliminar</strong> hasta que todos los costos estén confirmados.
          </div>
        </div>
      </div>

      {/* Preset de tarifa */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
          Método de tarifa del colaborador
        </label>
        <TarifaPresetSelector
          value={state.presetTarifa}
          onChange={(preset) => dispatch({ type: 'SET_PRESET_TARIFA', preset })}
        />
      </div>

      {/* Inputs según preset */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {state.presetTarifa === 'monto_total' && (
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">
              Monto total del flete (USD){' '}
              <span className="text-slate-400">(si ya lo conoces)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                value={state.montoTotalFlete || ''}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_MONTO_TOTAL_FLETE',
                    monto: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Peso total del envío:{' '}
              <strong className="text-slate-700 tabular-nums">
                {pesoTotalLb.toFixed(1)} lb
              </strong>{' '}
              · se prorratea por peso relativo
            </p>
          </div>
        )}
        {state.presetTarifa === 'por_unidad' && (
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">
              Tarifa por unidad (USD)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                value={state.tarifaPorUnidad || ''}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_TARIFA_POR_UNIDAD',
                    monto: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full pl-7 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {unidadesCount} uds × tarifa · Total:{' '}
              <strong className="text-slate-900 tabular-nums">
                ${(state.tarifaPorUnidad * unidadesCount).toFixed(2)}
              </strong>
            </p>
          </div>
        )}
        {state.presetTarifa === 'variable' && (
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-700 block mb-1.5">
              Tarifa por producto (USD por unidad)
            </label>
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              {filasPreview.map((f) => (
                <div
                  key={f.productoId}
                  className="px-3 py-2 flex items-center justify-between gap-3 border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {f.emoji && <span className="text-lg">{f.emoji}</span>}
                    <span className="text-sm text-slate-900 truncate">{f.productoNombre}</span>
                    <span className="text-xs text-slate-500">× {f.uds}</span>
                  </div>
                  <div className="relative w-32">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={state.tarifaVariablePorProducto[f.productoId] || ''}
                      onChange={(e) =>
                        dispatch({
                          type: 'SET_TARIFA_VARIABLE',
                          productoId: f.productoId,
                          monto: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full pl-5 pr-2 py-1 text-xs border border-slate-200 rounded"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={state.presetTarifa === 'variable' ? 'sm:col-span-2' : ''}>
          <label className="text-xs font-medium text-slate-700 block mb-1.5">
            Tipo de cambio (PEN/USD)
          </label>
          <input
            type="number"
            step="0.001"
            value={state.tipoCambio || ''}
            onChange={(e) =>
              dispatch({ type: 'SET_TIPO_CAMBIO', tc: parseFloat(e.target.value) || 0 })
            }
            placeholder={tc?.venta ? String(tc.venta) : ''}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            TC del día desde tesorería · aplicable solo al prorrateo
          </p>
        </div>
      </div>

      {/* Costos adicionales */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Costos adicionales</div>
          <span className="text-xs text-slate-500">Opcional</span>
        </div>
        <div className="divide-y divide-slate-100">
          <div className="px-4 py-3 flex items-center gap-3">
            <input
              type="checkbox"
              checked={feeRecepcion?.activo ?? false}
              onChange={(e) => toggleFeeRecepcion(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={feeRecepcion?.concepto ?? 'Recepción en casilla destino'}
                onChange={(e) =>
                  dispatch({
                    type: 'EDITAR_COSTO_ADICIONAL',
                    id: 'fee-recepcion',
                    updates: { concepto: e.target.value },
                  })
                }
                disabled={!feeRecepcion?.activo}
                className="px-2 py-1.5 text-sm border border-slate-200 rounded disabled:bg-slate-50"
              />
              <select
                value={feeRecepcion?.metodo ?? 'monto_total'}
                onChange={(e) =>
                  dispatch({
                    type: 'EDITAR_COSTO_ADICIONAL',
                    id: 'fee-recepcion',
                    updates: {
                      metodo: e.target.value as CostoAdicionalT2['metodo'],
                    },
                  })
                }
                disabled={!feeRecepcion?.activo}
                className="px-2 py-1.5 text-sm border border-slate-200 rounded disabled:bg-slate-50"
              >
                <option value="monto_total">Monto total</option>
                <option value="por_unidad">Por unidad</option>
              </select>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={feeRecepcion?.monto || ''}
                  onChange={(e) =>
                    dispatch({
                      type: 'EDITAR_COSTO_ADICIONAL',
                      id: 'fee-recepcion',
                      updates: { monto: parseFloat(e.target.value) || 0 },
                    })
                  }
                  disabled={!feeRecepcion?.activo}
                  className="w-full pl-5 pr-2 py-1.5 text-sm border border-slate-200 rounded disabled:bg-slate-50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <CTRULandedPreview filas={filasPreview} />

      <div
        className={cn(
          'p-3 rounded-lg border flex items-center justify-between flex-wrap gap-2 text-xs',
          totalLandedUSD > 0 ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'
        )}
      >
        <div className="text-slate-700">
          {totalLandedUSD > 0 ? (
            <>
              <strong className="text-teal-900">Total landed:</strong>{' '}
              <span className="tabular-nums font-semibold text-teal-700">
                ${totalLandedUSD.toFixed(2)} USD
              </span>
              {state.tipoCambio > 0 && (
                <>
                  {' · '}
                  <span className="tabular-nums text-slate-600">
                    S/ {(totalLandedUSD * state.tipoCambio).toFixed(2)}
                  </span>
                </>
              )}
            </>
          ) : (
            'Sin costos definidos — puedes avanzar y agregarlos después.'
          )}
        </div>
      </div>
    </div>
  );
};
