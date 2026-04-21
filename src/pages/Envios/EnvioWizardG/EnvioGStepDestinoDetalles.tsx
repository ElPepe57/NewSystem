/**
 * EnvioGStepDestinoDetalles — Paso 2 del Wizard G (Almacén destino + Transporte + Costos).
 *
 * Combina destino + detalles en un solo paso porque Caso G es un retorno
 * simple: almacén Perú receptor + transporte opcional + costos PEN.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAlmacenStore } from '../../../store/casillaStore';
import { useColaboradorStore } from '../../../store/colaboradorStore';
import type { Colaborador } from '../../../types/colaborador.types';
import { cn } from '../../../design-system';
import type {
  EnvioWizardGState,
  EnvioWizardGAction,
  CostoRetornoPEN,
} from './envioWizardGTypes';
import { selectUnidadesCount, selectTotalCostosPEN } from './envioWizardGTypes';

export interface EnvioGStepDestinoDetallesProps {
  state: EnvioWizardGState;
  dispatch: (action: EnvioWizardGAction) => void;
}

export const EnvioGStepDestinoDetalles: React.FC<EnvioGStepDestinoDetallesProps> = ({
  state,
  dispatch,
}) => {
  const casillas = useAlmacenStore((s) => s.casillas);
  const fetchCasillas = useAlmacenStore((s) => s.fetchCasillas);
  const colaboradores = useColaboradorStore((s) => s.colaboradores);
  const fetchColaboradores = useColaboradorStore((s) => s.fetchColaboradores);
  const [nuevoConcepto, setNuevoConcepto] = useState('');

  useEffect(() => {
    if (casillas.length === 0) fetchCasillas();
    if (colaboradores.length === 0) fetchColaboradores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const almacenesPeruActivos = useMemo(
    () =>
      casillas.filter(
        (c) =>
          c.estado === 'activa' &&
          (c.pais === 'Peru' || c.pais === 'Peru_local') &&
          c.tipo === 'almacen_propio'
      ),
    [casillas]
  );

  const transportistas = useMemo(
    () =>
      colaboradores.filter(
        (c: Colaborador) => c.tipo === 'transportista_local' && c.estado === 'activo'
      ),
    [colaboradores]
  );

  const totalCostos = selectTotalCostosPEN(state);
  const unidadesCount = selectUnidadesCount(state);

  const agregarCostoRapido = (concepto: string) => {
    const nuevo: CostoRetornoPEN = {
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
          Almacén destino + detalles del retorno
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Todo en <strong>PEN</strong>. Elige dónde recibirás las unidades devueltas y
          captura el transporte / costos del retorno si aplica.
        </p>
      </div>

      {/* Almacén destino */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
          Almacén receptor (Perú) <span className="text-red-500 normal-case">*</span>
        </label>
        {almacenesPeruActivos.length === 0 ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            No hay almacenes propios activos en Perú. Configura uno antes de registrar
            el retorno físico.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {almacenesPeruActivos.map((c) => {
              const sel = c.id === state.almacenDestinoId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'SET_DESTINO',
                      almacenId: c.id,
                      almacenNombre: c.nombre,
                    })
                  }
                  className={cn(
                    'relative rounded-xl p-3 text-left transition-all border',
                    sel
                      ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-100'
                      : 'bg-white border-slate-200 hover:border-teal-300 cursor-pointer'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🇵🇪</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{c.nombre}</div>
                      {c.direccion && (
                        <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {c.direccion}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 mt-0.5">
                        {c.unidadesActuales ?? 0} unidades actuales
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Transportista opcional */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
          Transportista del retorno{' '}
          <span className="text-slate-400 normal-case text-[11px]">(opcional)</span>
        </label>
        {transportistas.length === 0 ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            No hay transportistas locales activos. Puedes continuar sin asignar — el
            retorno queda registrado sin responsable explícito.
          </div>
        ) : (
          <select
            value={state.colaboradorTransporteId}
            onChange={(e) => {
              const id = e.target.value;
              const col = transportistas.find((c) => c.id === id);
              dispatch({
                type: 'SET_COLABORADOR_TRANSPORTE',
                id,
                nombre: col?.nombre || '',
              });
            }}
            className="w-full sm:max-w-md px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">— Sin transportista asignado —</option>
            {transportistas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tracking */}
      <div>
        <label className="text-xs font-medium text-slate-700 block mb-1.5">
          Guía de retorno <span className="text-slate-400">(opcional)</span>
        </label>
        <input
          type="text"
          value={state.numeroTracking}
          onChange={(e) => dispatch({ type: 'SET_TRACKING', tracking: e.target.value })}
          placeholder="Ej. OLVA-98765, GR-RET-001"
          className="w-full sm:max-w-md px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>

      {/* Costos PEN */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Costos del retorno (PEN)
          </label>
          <span className="text-xs text-slate-400">Opcional</span>
        </div>

        {state.costosPEN.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {['Delivery inverso', 'Courier retorno', 'Combustible'].map((c) => (
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
                      updates: { metodo: e.target.value as CostoRetornoPEN['metodo'] },
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

        {totalCostos > 0 && (
          <div className="mt-3 p-2.5 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
            <span className="text-xs font-medium text-teal-800">Total costos retorno</span>
            <span className="text-sm font-bold text-teal-900 tabular-nums">
              S/ {totalCostos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
