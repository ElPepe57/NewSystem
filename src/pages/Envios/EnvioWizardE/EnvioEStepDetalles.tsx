/**
 * EnvioEStepDetalles — Paso 3 del Wizard E (Transporte + Costos PEN).
 *
 * Unifica transporte + costos en un solo paso para el Caso E porque:
 *   - El transporte puede no existir (traslado interno sin costo)
 *   - Los costos son simples (todo en PEN, sin presets multi-moneda)
 *   - No hay prorrateo complejo — monto total o por unidad
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useColaboradorStore } from '../../../store/colaboradorStore';
import type { Colaborador } from '../../../types/colaborador.types';
import { cn } from '../../../design-system';
import type { EnvioWizardEState, EnvioWizardEAction, CostoPENItem } from './envioWizardETypes';
import { selectUnidadesCount, selectTotalCostosPEN } from './envioWizardETypes';

export interface EnvioEStepDetallesProps {
  state: EnvioWizardEState;
  dispatch: (action: EnvioWizardEAction) => void;
}

export const EnvioEStepDetalles: React.FC<EnvioEStepDetallesProps> = ({ state, dispatch }) => {
  const colaboradores = useColaboradorStore((s) => s.colaboradores);
  const fetchColaboradores = useColaboradorStore((s) => s.fetchColaboradores);
  const [nuevoConcepto, setNuevoConcepto] = useState('');

  useEffect(() => {
    if (colaboradores.length === 0) fetchColaboradores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transportistas locales activos (son los que se usan en Caso E)
  const transportistasLocales = useMemo(
    () =>
      colaboradores.filter(
        (c: Colaborador) => c.tipo === 'transportista_local' && c.estado === 'activo'
      ),
    [colaboradores]
  );

  const totalCostos = selectTotalCostosPEN(state);
  const unidadesCount = selectUnidadesCount(state);

  const agregarCostoRapido = (concepto: string) => {
    const nuevo: CostoPENItem = {
      id: `costo-${Date.now()}`,
      concepto,
      metodo: 'monto_total',
      montoPEN: 0,
      activo: true,
    };
    dispatch({ type: 'AGREGAR_COSTO_PEN', costo: nuevo });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Transporte y costos del traslado
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Todo en <strong>PEN</strong> (sin conversión USD). El transporte es opcional —
          muchos traslados internos no tienen costo explícito.
        </p>
      </div>

      {/* Colaborador transporte (opcional) */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
          Transportista local <span className="text-slate-400 normal-case text-[11px]">(opcional)</span>
        </label>
        {transportistasLocales.length === 0 ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            No hay transportistas locales activos. Puedes continuar sin asignar — el
            traslado queda como movimiento interno sin responsable explícito de transporte.
          </div>
        ) : (
          <select
            value={state.colaboradorTransporteId}
            onChange={(e) => {
              const id = e.target.value;
              const col = transportistasLocales.find((c) => c.id === id);
              dispatch({
                type: 'SET_COLABORADOR_TRANSPORTE',
                id,
                nombre: col?.nombre || '',
              });
            }}
            className="w-full sm:max-w-md px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">— Sin transportista asignado —</option>
            {transportistasLocales.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tracking opcional */}
      <div>
        <label className="text-xs font-medium text-slate-700 block mb-1.5">
          Número de guía/tracking <span className="text-slate-400">(opcional)</span>
        </label>
        <input
          type="text"
          value={state.numeroTracking}
          onChange={(e) => dispatch({ type: 'SET_TRACKING', tracking: e.target.value })}
          placeholder="Ej. GR-12345 (guía de remisión)"
          className="w-full sm:max-w-md px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>

      {/* Costos PEN */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Costos del traslado (PEN)
          </label>
          <span className="text-xs text-slate-400">Opcional</span>
        </div>

        {/* Sugerencias rápidas */}
        {state.costosPEN.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {['Flete local', 'Combustible', 'Peaje', 'Estiba'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => agregarCostoRapido(c)}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> {c}
              </button>
            ))}
          </div>
        )}

        {/* Lista de costos */}
        {state.costosPEN.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {state.costosPEN.map((c) => (
              <div
                key={c.id}
                className="px-3 py-2 border-b border-slate-100 last:border-b-0 flex items-center gap-2 flex-wrap"
              >
                <input
                  type="checkbox"
                  checked={c.activo}
                  onChange={(e) =>
                    dispatch({
                      type: 'EDITAR_COSTO_PEN',
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
                      type: 'EDITAR_COSTO_PEN',
                      id: c.id,
                      updates: { concepto: e.target.value },
                    })
                  }
                  disabled={!c.activo}
                  className="flex-1 min-w-[120px] px-2 py-1 text-sm border border-slate-200 rounded disabled:bg-slate-50"
                />
                <select
                  value={c.metodo}
                  onChange={(e) =>
                    dispatch({
                      type: 'EDITAR_COSTO_PEN',
                      id: c.id,
                      updates: { metodo: e.target.value as CostoPENItem['metodo'] },
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
                    S/
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={c.montoPEN || ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'EDITAR_COSTO_PEN',
                        id: c.id,
                        updates: { montoPEN: parseFloat(e.target.value) || 0 },
                      })
                    }
                    disabled={!c.activo}
                    className="w-full pl-7 pr-2 py-1 text-sm border border-slate-200 rounded disabled:bg-slate-50"
                  />
                </div>
                {c.metodo === 'por_unidad' && c.activo && c.montoPEN > 0 && (
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    × {unidadesCount} = S/ {(c.montoPEN * unidadesCount).toFixed(2)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'ELIMINAR_COSTO_PEN', id: c.id })}
                  className="p-1 text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Eliminar costo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Agregar nuevo costo */}
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={nuevoConcepto}
            onChange={(e) => setNuevoConcepto(e.target.value)}
            placeholder="Agregar otro costo (concepto)…"
            className="flex-1 sm:max-w-md px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <button
            type="button"
            onClick={() => {
              if (nuevoConcepto.trim()) {
                agregarCostoRapido(nuevoConcepto.trim());
                setNuevoConcepto('');
              }
            }}
            disabled={!nuevoConcepto.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Agregar
          </button>
        </div>

        {/* Total */}
        {totalCostos > 0 && (
          <div className="mt-3 p-2.5 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
            <span className="text-xs font-medium text-teal-800">Total costos</span>
            <span className="text-sm font-bold text-teal-900 tabular-nums">
              S/ {totalCostos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
