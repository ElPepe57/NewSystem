/**
 * EnvioIStepDetalles — Paso 3 del Wizard I (Transporte + Costos multi-moneda).
 *
 * Similar a E/F pero soporta USD y PEN en los costos porque Caso I suele ser
 * cross-border (ej. Perú → FBA USA). El transporte puede ser viajero, courier
 * internacional o transportista local según el destino.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useColaboradorStore } from '../../../store/colaboradorStore';
import { useTipoCambio } from '../../../hooks/useTipoCambio';
import type { Colaborador } from '../../../types/colaborador.types';
import { cn } from '../../../design-system';
import type {
  EnvioWizardIState,
  EnvioWizardIAction,
  CostoEnvioI,
} from './envioWizardITypes';
import { selectUnidadesCount, selectTotalCostosPEN, selectTotalCostosUSD } from './envioWizardITypes';

export interface EnvioIStepDetallesProps {
  state: EnvioWizardIState;
  dispatch: (action: EnvioWizardIAction) => void;
}

export const EnvioIStepDetalles: React.FC<EnvioIStepDetallesProps> = ({ state, dispatch }) => {
  const colaboradores = useColaboradorStore((s) => s.colaboradores);
  const fetchColaboradores = useColaboradorStore((s) => s.fetchColaboradores);
  const { tc } = useTipoCambio();
  const [nuevoConcepto, setNuevoConcepto] = useState('');

  useEffect(() => {
    if (colaboradores.length === 0) fetchColaboradores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.tipoCambio === 0 && tc?.venta) {
      dispatch({ type: 'SET_TIPO_CAMBIO', tc: tc.venta });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tc]);

  // Cualquier tipo de colaborador aplica (cross-border puede ser viajero o courier)
  const transportadores = useMemo(
    () =>
      colaboradores.filter(
        (c: Colaborador) =>
          (c.tipo === 'transportista_local' ||
            c.tipo === 'viajero' ||
            c.tipo === 'courier_externo') &&
          c.estado === 'activo'
      ),
    [colaboradores]
  );

  const totalUSD = selectTotalCostosUSD(state);
  const totalPEN = selectTotalCostosPEN(state);
  const unidadesCount = selectUnidadesCount(state);

  const agregarCostoRapido = (concepto: string, moneda: 'USD' | 'PEN' = 'PEN') => {
    const nuevo: CostoEnvioI = {
      id: `costo-${Date.now()}`,
      concepto,
      moneda,
      monto: 0,
      metodo: 'monto_total',
      activo: true,
    };
    dispatch({ type: 'AGREGAR_COSTO', costo: nuevo });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Transporte y costos del envío a tercero
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Los costos pueden ser en <strong>USD</strong> o <strong>PEN</strong> (cross-border
          suele requerir USD para flete internacional y PEN para transporte local).
        </p>
      </div>

      {/* Transportador */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
          Transportador <span className="text-slate-400 normal-case text-[11px]">(opcional)</span>
        </label>
        {transportadores.length === 0 ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            No hay transportadores activos. Puedes continuar sin asignar.
          </div>
        ) : (
          <select
            value={state.colaboradorTransporteId}
            onChange={(e) => {
              const id = e.target.value;
              const col = transportadores.find((c) => c.id === id);
              dispatch({
                type: 'SET_COLABORADOR_TRANSPORTE',
                id,
                nombre: col?.nombre || '',
              });
            }}
            className="w-full sm:max-w-md px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">— Sin transportador asignado —</option>
            {transportadores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} · {c.tipo}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tracking */}
      <div>
        <label className="text-xs font-medium text-slate-700 block mb-1.5">
          Tracking / shipment ID <span className="text-slate-400">(opcional)</span>
        </label>
        <input
          type="text"
          value={state.numeroTracking}
          onChange={(e) => dispatch({ type: 'SET_TRACKING', tracking: e.target.value })}
          placeholder="Ej. DHL-1234567, FBA-SHIPMENT-XYZ"
          className="w-full sm:max-w-md px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>

      {/* Tipo de cambio */}
      <div>
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
          className="w-full sm:max-w-xs px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
        <p className="text-xs text-slate-500 mt-1">
          Necesario si hay costos en USD — se usa para convertir a PEN en el prorrateo.
        </p>
      </div>

      {/* Costos multi-moneda */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Costos del envío
          </label>
          <span className="text-xs text-slate-400">Opcional</span>
        </div>

        {/* Sugerencias */}
        {state.costos.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => agregarCostoRapido('Flete internacional', 'USD')}
              className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Flete intl. (USD)
            </button>
            <button
              type="button"
              onClick={() => agregarCostoRapido('Aduana destino', 'USD')}
              className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Aduana (USD)
            </button>
            <button
              type="button"
              onClick={() => agregarCostoRapido('Fee inicial fulfillment', 'USD')}
              className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Fee FBA (USD)
            </button>
            <button
              type="button"
              onClick={() => agregarCostoRapido('Transporte local', 'PEN')}
              className="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Transporte local (PEN)
            </button>
          </div>
        )}

        {/* Lista */}
        {state.costos.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {state.costos.map((c) => (
              <div
                key={c.id}
                className="px-3 py-2 border-b border-slate-100 last:border-b-0 flex items-center gap-2 flex-wrap"
              >
                <input
                  type="checkbox"
                  checked={c.activo}
                  onChange={(e) =>
                    dispatch({
                      type: 'EDITAR_COSTO',
                      id: c.id,
                      updates: { activo: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <input
                  type="text"
                  value={c.concepto}
                  onChange={(e) =>
                    dispatch({
                      type: 'EDITAR_COSTO',
                      id: c.id,
                      updates: { concepto: e.target.value },
                    })
                  }
                  disabled={!c.activo}
                  className="flex-1 min-w-[120px] px-2 py-1 text-sm border border-slate-200 rounded disabled:bg-slate-50"
                />
                <select
                  value={c.moneda}
                  onChange={(e) =>
                    dispatch({
                      type: 'EDITAR_COSTO',
                      id: c.id,
                      updates: { moneda: e.target.value as 'USD' | 'PEN' },
                    })
                  }
                  disabled={!c.activo}
                  className="px-2 py-1 text-sm border border-slate-200 rounded disabled:bg-slate-50"
                >
                  <option value="USD">USD</option>
                  <option value="PEN">PEN</option>
                </select>
                <select
                  value={c.metodo}
                  onChange={(e) =>
                    dispatch({
                      type: 'EDITAR_COSTO',
                      id: c.id,
                      updates: { metodo: e.target.value as CostoEnvioI['metodo'] },
                    })
                  }
                  disabled={!c.activo}
                  className="px-2 py-1 text-sm border border-slate-200 rounded disabled:bg-slate-50"
                >
                  <option value="monto_total">Monto total</option>
                  <option value="por_unidad">Por unidad</option>
                </select>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {c.moneda === 'USD' ? '$' : 'S/'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={c.monto || ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'EDITAR_COSTO',
                        id: c.id,
                        updates: { monto: parseFloat(e.target.value) || 0 },
                      })
                    }
                    disabled={!c.activo}
                    className="w-full pl-7 pr-2 py-1 text-sm border border-slate-200 rounded disabled:bg-slate-50"
                  />
                </div>
                {c.metodo === 'por_unidad' && c.activo && c.monto > 0 && (
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    × {unidadesCount} = {c.moneda === 'USD' ? '$' : 'S/'}
                    {(c.monto * unidadesCount).toFixed(2)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'ELIMINAR_COSTO', id: c.id })}
                  className="p-1 text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Eliminar costo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Agregar custom */}
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={nuevoConcepto}
            onChange={(e) => setNuevoConcepto(e.target.value)}
            placeholder="Agregar otro costo…"
            className="flex-1 sm:max-w-md px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <button
            type="button"
            onClick={() => {
              if (nuevoConcepto.trim()) {
                agregarCostoRapido(nuevoConcepto.trim(), 'PEN');
                setNuevoConcepto('');
              }
            }}
            disabled={!nuevoConcepto.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Agregar (PEN)
          </button>
        </div>

        {/* Totales */}
        {(totalUSD > 0 || totalPEN > 0) && (
          <div className={cn(
            "mt-3 p-3 bg-teal-50 border border-teal-200 rounded-lg grid grid-cols-2 gap-3 text-xs"
          )}>
            <div>
              <div className="text-[10px] font-semibold uppercase text-teal-700">Total USD</div>
              <div className="text-sm font-bold text-teal-900 tabular-nums mt-0.5">
                ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase text-teal-700">Total PEN</div>
              <div className="text-sm font-bold text-teal-900 tabular-nums mt-0.5">
                S/ {totalPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
