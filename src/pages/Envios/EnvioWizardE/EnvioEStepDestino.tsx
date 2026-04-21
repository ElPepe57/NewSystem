/**
 * EnvioEStepDestino — Paso 2 del Wizard E (Destino + Motivo).
 *
 * Selecciona el almacén Perú destino (distinto del origen) y el motivo del
 * traslado interno. El motivo es obligatorio y usa el enum MotivoEnvioInterno
 * existente (consolidación / capacidad / viaje_proximo / costo_menor / otro).
 */
import React, { useEffect, useMemo } from 'react';
import { useAlmacenStore } from '../../../store/casillaStore';
import { cn } from '../../../design-system';
import type { EnvioWizardEState, EnvioWizardEAction } from './envioWizardETypes';
import type { MotivoEnvioInterno } from '../../../types/envio.types';

export interface EnvioEStepDestinoProps {
  state: EnvioWizardEState;
  dispatch: (action: EnvioWizardEAction) => void;
}

const MOTIVOS: Array<{ id: MotivoEnvioInterno; emoji: string; titulo: string; descripcion: string }> = [
  {
    id: 'consolidacion',
    emoji: '📦',
    titulo: 'Consolidación',
    descripcion: 'Juntar inventario en un solo almacén',
  },
  {
    id: 'capacidad',
    emoji: '🏢',
    titulo: 'Capacidad',
    descripcion: 'El almacén actual no tiene espacio',
  },
  {
    id: 'costo_menor',
    emoji: '💰',
    titulo: 'Costo menor',
    descripcion: 'Almacén destino cobra menos por unidad',
  },
  {
    id: 'viaje_proximo',
    emoji: '🚚',
    titulo: 'Viaje próximo',
    descripcion: 'Mover a almacén cerca de ruta de despacho',
  },
  {
    id: 'otro',
    emoji: '✏️',
    titulo: 'Otro',
    descripcion: 'Especifica el motivo abajo',
  },
];

export const EnvioEStepDestino: React.FC<EnvioEStepDestinoProps> = ({ state, dispatch }) => {
  const casillas = useAlmacenStore((s) => s.casillas);
  const loading = useAlmacenStore((s) => s.casillasLoading);
  const fetchCasillas = useAlmacenStore((s) => s.fetchCasillas);

  useEffect(() => {
    if (casillas.length === 0 && !loading) fetchCasillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const almacenesPeruActivos = useMemo(
    () =>
      casillas.filter(
        (c) =>
          c.estado === 'activa' &&
          (c.pais === 'Peru' || c.pais === 'Peru_local') &&
          c.id !== state.almacenOrigenId
      ),
    [casillas, state.almacenOrigenId]
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Destino + motivo del traslado</h3>
        <p className="text-sm text-slate-600 mt-1">
          Elige el almacén Perú destino y por qué se hace el traslado. El motivo queda
          registrado en el envío para análisis y auditoría.
        </p>
      </div>

      {/* Selector de destino */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
          Almacén destino
        </label>
        {almacenesPeruActivos.length === 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            Solo hay un almacén Perú activo. Para un traslado interno necesitas al menos 2.
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
                    'relative rounded-xl p-4 text-left transition-all',
                    sel
                      ? 'bg-teal-50 border-2 border-teal-500 ring-4 ring-teal-100'
                      : 'bg-white border border-slate-200 hover:border-teal-300 cursor-pointer'
                  )}
                >
                  {sel && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">🇵🇪</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{c.nombre}</div>
                      {c.direccion && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {c.direccion}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 mt-1">
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

      {/* Motivo del traslado */}
      {state.almacenDestinoId && (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            Motivo del traslado <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {MOTIVOS.map((m) => {
              const sel = state.motivo === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_MOTIVO', motivo: m.id })}
                  className={cn(
                    'relative rounded-lg p-3 text-left transition-all border',
                    sel
                      ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-100'
                      : 'bg-white border-slate-200 hover:border-teal-300'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{m.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-sm font-semibold', sel ? 'text-slate-900' : 'text-slate-700')}>
                        {m.titulo}
                      </div>
                      <div className={cn('text-xs mt-0.5', sel ? 'text-slate-600' : 'text-slate-500')}>
                        {m.descripcion}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detalle de motivo cuando es 'otro' */}
          {state.motivo === 'otro' && (
            <div className="mt-3">
              <input
                type="text"
                value={state.motivoDetalle}
                onChange={(e) => dispatch({ type: 'SET_MOTIVO_DETALLE', detalle: e.target.value })}
                placeholder="Describe brevemente el motivo del traslado..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Este texto quedará en el envío para auditoría.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
