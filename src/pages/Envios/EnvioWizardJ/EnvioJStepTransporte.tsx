/**
 * EnvioJStepTransporte — Paso 3 del Wizard J (Transporte).
 *
 * Captura cómo viajan las unidades entre las dos casillas internacionales:
 *   - Tipo de transporte (viajero personal / courier internacional)
 *   - Colaborador transportador (filtrado por tipo)
 *   - Número de tracking (opcional)
 *
 * Diferencia vs. T2: NO hay selector de almacén destino — ya se eligió en
 * el Paso 2 (Destino). En variante J1 se pre-selecciona al colaborador origen
 * como transportador default (logica en el reducer SET_DESTINO).
 */
import React, { useEffect, useMemo } from 'react';
import { useColaboradorStore } from '../../../store/colaboradorStore';
import type { Colaborador } from '../../../types/colaborador.types';
import { ColaboradorTransporteCard } from '../EnvioWizardT2';
import type { TipoTransporteT2, PresetTarifa } from '../EnvioWizardT2';
import { cn } from '../../../design-system';
import type { EnvioWizardJState, EnvioWizardJAction } from './envioWizardJTypes';

export interface EnvioJStepTransporteProps {
  state: EnvioWizardJState;
  dispatch: (action: EnvioWizardJAction) => void;
}

interface TipoCard {
  id: TipoTransporteT2;
  emoji: string;
  titulo: string;
  descripcion: string;
}

const TIPO_CARDS: TipoCard[] = [
  {
    id: 'viajero',
    emoji: '✈️',
    titulo: 'Viajero personal',
    descripcion: 'Persona que viaja entre las casillas cargando equipaje',
  },
  {
    id: 'courier',
    emoji: '📦',
    titulo: 'Courier internacional',
    descripcion: 'DHL, FedEx, empresas de envío',
  },
];

const getIniciales = (nombre: string): string => {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const EnvioJStepTransporte: React.FC<EnvioJStepTransporteProps> = ({
  state,
  dispatch,
}) => {
  const colaboradores = useColaboradorStore((s) => s.colaboradores);
  const fetchColaboradores = useColaboradorStore((s) => s.fetchColaboradores);

  useEffect(() => {
    if (colaboradores.length === 0) fetchColaboradores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtrar por tipo seleccionado
  const colaboradoresFiltrados = useMemo(() => {
    if (!state.tipoTransporte) return [];
    const tipoMap: Record<TipoTransporteT2, Colaborador['tipo']> = {
      viajero: 'viajero',
      courier: 'courier_externo',
    };
    const tipoBackend = tipoMap[state.tipoTransporte];
    return colaboradores.filter((c) => c.tipo === tipoBackend && c.estado === 'activo');
  }, [colaboradores, state.tipoTransporte]);

  const colaboradorSeleccionado = useMemo(
    () => colaboradoresFiltrados.find((c) => c.id === state.colaboradorTransporteId),
    [colaboradoresFiltrados, state.colaboradorTransporteId]
  );

  const deducirTarifaPrellenar = (
    c: Colaborador
  ): { tarifaBaseUSD?: number; metodoBase?: PresetTarifa } => {
    if (c.tarifas?.tarifaPorLibraUSD && c.tarifas.tarifaPorLibraUSD > 0) {
      return { tarifaBaseUSD: c.tarifas.tarifaPorLibraUSD, metodoBase: 'monto_total' };
    }
    if (c.tarifas?.tarifaBasePorEnvioUSD && c.tarifas.tarifaBasePorEnvioUSD > 0) {
      return { tarifaBaseUSD: c.tarifas.tarifaBasePorEnvioUSD, metodoBase: 'monto_total' };
    }
    return {};
  };

  return (
    <div className="space-y-5">
      {/* Título */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          ¿Quién transporta las unidades?
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          {state.variante === 'J1' ? (
            <>
              Por default <b>{state.colaboradorOrigenNombre}</b> es el transportador
              (variante J1 · mismo colaborador). Puedes cambiarlo si el movimiento
              se hace por un tercero.
            </>
          ) : (
            <>
              Elige al transportador que llevará las unidades desde{' '}
              <b>{state.colaboradorOrigenNombre}</b> hasta <b>{state.colaboradorDestinoNombre}</b>.
            </>
          )}
        </p>
      </div>

      {/* Tipo de transporte */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
          Tipo de transporte
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIPO_CARDS.map((tipo) => {
            const sel = state.tipoTransporte === tipo.id;
            return (
              <label
                key={tipo.id}
                className={cn(
                  'relative rounded-xl p-4 cursor-pointer transition-all',
                  sel
                    ? 'bg-teal-50 border-2 border-teal-500 ring-4 ring-teal-100'
                    : 'bg-white border border-slate-200 hover:border-teal-300'
                )}
              >
                <input
                  type="radio"
                  name="tipo-transporte-j"
                  checked={sel}
                  onChange={() => dispatch({ type: 'SET_TIPO_TRANSPORTE', tipo: tipo.id })}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0',
                      sel ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-700'
                    )}
                  >
                    {tipo.emoji}
                  </div>
                  <div>
                    <div className={cn('text-sm font-semibold', sel ? 'text-slate-900' : 'text-slate-700')}>
                      {tipo.titulo}
                    </div>
                    <div className={cn('text-xs mt-1', sel ? 'text-slate-600' : 'text-slate-500')}>
                      {tipo.descripcion}
                    </div>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Colaborador */}
      {state.tipoTransporte && (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            Colaborador ({state.tipoTransporte === 'viajero' ? 'viajero' : 'courier'})
          </label>
          {colaboradoresFiltrados.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              No hay colaboradores tipo <strong>{state.tipoTransporte}</strong> activos.
              Configura al menos uno en Red Logística antes de continuar.
            </div>
          ) : colaboradorSeleccionado ? (
            <ColaboradorTransporteCard
              id={colaboradorSeleccionado.id}
              nombre={colaboradorSeleccionado.nombre}
              iniciales={getIniciales(colaboradorSeleccionado.nombre)}
              tipo={state.tipoTransporte}
              disponible={colaboradorSeleccionado.estado === 'activo'}
              seleccionado
              info={
                colaboradorSeleccionado.metricas?.viajesRealizados
                  ? `${colaboradorSeleccionado.metricas.viajesRealizados} viaje${
                      colaboradorSeleccionado.metricas.viajesRealizados !== 1 ? 's' : ''
                    } realizado${colaboradorSeleccionado.metricas.viajesRealizados !== 1 ? 's' : ''}`
                  : undefined
              }
              tarifaBadge={
                colaboradorSeleccionado.tarifas?.tarifaPorLibraUSD
                  ? `💰 Base: $${colaboradorSeleccionado.tarifas.tarifaPorLibraUSD}/libra`
                  : colaboradorSeleccionado.tarifas?.tarifaBasePorEnvioUSD
                    ? `💰 Base: $${colaboradorSeleccionado.tarifas.tarifaBasePorEnvioUSD}/envío`
                    : null
              }
              onCambiar={() =>
                dispatch({
                  type: 'SET_COLABORADOR_TRANSPORTE',
                  id: '',
                  nombre: '',
                })
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {colaboradoresFiltrados.map((c) => {
                const { tarifaBaseUSD, metodoBase } = deducirTarifaPrellenar(c);
                return (
                  <ColaboradorTransporteCard
                    key={c.id}
                    id={c.id}
                    nombre={c.nombre}
                    iniciales={getIniciales(c.nombre)}
                    tipo={state.tipoTransporte!}
                    disponible={c.estado === 'activo'}
                    seleccionado={false}
                    info={
                      c.metricas?.viajesRealizados
                        ? `${c.metricas.viajesRealizados} viaje${
                            c.metricas.viajesRealizados !== 1 ? 's' : ''
                          } realizado${c.metricas.viajesRealizados !== 1 ? 's' : ''}`
                        : c.metricas?.enviosRealizados
                          ? `${c.metricas.enviosRealizados} envío${
                              c.metricas.enviosRealizados !== 1 ? 's' : ''
                            } realizado${c.metricas.enviosRealizados !== 1 ? 's' : ''}`
                          : undefined
                    }
                    tarifaBadge={
                      c.tarifas?.tarifaPorLibraUSD
                        ? `💰 Base: $${c.tarifas.tarifaPorLibraUSD}/libra`
                        : c.tarifas?.tarifaBasePorEnvioUSD
                          ? `💰 Base: $${c.tarifas.tarifaBasePorEnvioUSD}/envío`
                          : null
                    }
                    onSelect={() =>
                      dispatch({
                        type: 'SET_COLABORADOR_TRANSPORTE',
                        id: c.id,
                        nombre: c.nombre,
                        tarifaBaseUSD,
                        metodoBase,
                      })
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tracking */}
      {state.tipoTransporte && state.colaboradorTransporteId && (
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1.5">
            Número de tracking <span className="text-slate-400">(opcional)</span>
          </label>
          <input
            type="text"
            value={state.numeroTracking}
            onChange={(e) => dispatch({ type: 'SET_TRACKING', tracking: e.target.value })}
            placeholder="Ej. DHL12345 o #vuelo AA2421"
            className="w-full sm:max-w-md px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Si el viajero da su vuelo o el courier te da tracking
          </p>
        </div>
      )}

      {/* Info responsable reclamos (D-11 adaptado a Caso J) */}
      {state.colaboradorTransporteNombre && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0 text-sm">
            💡
          </div>
          <div className="text-xs text-sky-900">
            <strong>Responsable default de reclamos:</strong>{' '}
            {state.variante === 'J1'
              ? 'El mismo colaborador (auto-gestión)'
              : `${state.tipoTransporte === 'viajero' ? 'Viajero' : 'Courier'} (${state.colaboradorTransporteNombre})`}
            . Si las unidades llegan dañadas o se pierden en tránsito, el reclamo inicial se levanta
            contra él. Puedes cambiar el responsable al abrir el reclamo.
          </div>
        </div>
      )}
    </div>
  );
};
