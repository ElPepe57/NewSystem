/**
 * EnvioT2StepTransporte — Paso 3 del Wizard T2 (Transporte).
 *
 * Captura cómo viajan las unidades desde la casilla origen hasta el almacén
 * destino en Perú:
 *   - Tipo de transporte (viajero personal / courier internacional)
 *   - Colaborador específico (filtrado por tipo)
 *   - Número de tracking (opcional)
 *   - Almacén destino en Perú (D-3: este selector vive aquí, no en Paso 1)
 *
 * Nota: las fechas estimadas de salida/llegada fueron eliminadas por
 * indicación del usuario (no se usan en T2).
 */
import React, { useEffect, useMemo } from 'react';
import { useColaboradorStore } from '../../../store/colaboradorStore';
import { useAlmacenStore } from '../../../store/casillaStore';
import type { Colaborador } from '../../../types/colaborador.types';
import { ColaboradorTransporteCard } from './ColaboradorTransporteCard';
import type {
  EnvioWizardT2State,
  EnvioWizardT2Action,
  TipoTransporteT2,
  PresetTarifa,
} from './envioWizardT2Types';
import { cn } from '../../../design-system';

export interface EnvioT2StepTransporteProps {
  state: EnvioWizardT2State;
  dispatch: (action: EnvioWizardT2Action) => void;
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
    descripcion: 'Persona de confianza que viaja a Perú cargando equipaje',
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

export const EnvioT2StepTransporte: React.FC<EnvioT2StepTransporteProps> = ({
  state,
  dispatch,
}) => {
  // Cargar colaboradores y almacenes Perú al montar
  const colaboradores = useColaboradorStore((s) => s.colaboradores);
  const fetchColaboradores = useColaboradorStore((s) => s.fetchColaboradores);
  const almacenesPeru = useAlmacenStore((s) => s.almacenesPeru);
  const fetchAlmacenesPeru = useAlmacenStore((s) => s.fetchAlmacenesPeru);

  useEffect(() => {
    if (colaboradores.length === 0) fetchColaboradores();
    if (almacenesPeru.length === 0) fetchAlmacenesPeru();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtrar colaboradores por tipo seleccionado
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
    () => colaboradoresFiltrados.find((c) => c.id === state.colaboradorId),
    [colaboradoresFiltrados, state.colaboradorId]
  );

  // Derivar tarifa base + método a prellenar si el colaborador la tiene configurada
  const deducirTarifaPrellenar = (
    c: Colaborador
  ): { tarifaBaseUSD?: number; metodoBase?: PresetTarifa } => {
    if (c.tarifas?.tarifaPorLibraUSD && c.tarifas.tarifaPorLibraUSD > 0) {
      // En D-18 "Por peso" se fusionó con "Monto total" (prorrateo por peso).
      // El prellenado se deja en Paso 4 (el usuario ingresa monto total).
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
          ¿Cómo viajan las unidades a Perú?
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Elige el tipo de transporte, el colaborador responsable y el almacén destino.
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
                  name="tipo-transporte"
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
                    aria-hidden
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
                  ? `Viajero · ${colaboradorSeleccionado.metricas.viajesRealizados} viaje${
                      colaboradorSeleccionado.metricas.viajesRealizados !== 1 ? 's' : ''
                    } completado${colaboradorSeleccionado.metricas.viajesRealizados !== 1 ? 's' : ''}`
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
                  type: 'SET_COLABORADOR',
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
                          } completado${c.metricas.viajesRealizados !== 1 ? 's' : ''}`
                        : c.metricas?.enviosRealizados
                        ? `${c.metricas.enviosRealizados} envío${
                            c.metricas.enviosRealizados !== 1 ? 's' : ''
                          } completado${c.metricas.enviosRealizados !== 1 ? 's' : ''}`
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
                        type: 'SET_COLABORADOR',
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

          {colaboradorSeleccionado && (
            <p className="text-xs text-slate-500 mt-2">
              Su tarifa base se prellenará en el paso de costos — puedes ajustarla ahí.
            </p>
          )}
        </div>
      )}

      {/* Tracking + Almacén destino */}
      {state.tipoTransporte && state.colaboradorId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">
              Número de tracking <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={state.numeroTracking}
              onChange={(e) => dispatch({ type: 'SET_TRACKING', tracking: e.target.value })}
              placeholder="Ej. DHL12345 o #vuelo AA2421"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Si el viajero da su vuelo o el courier te da tracking
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">
              Almacén destino en Perú <span className="text-red-500">*</span>
            </label>
            <select
              value={state.almacenDestinoId}
              onChange={(e) => {
                const id = e.target.value;
                const alm = almacenesPeru.find((a) => a.id === id);
                dispatch({
                  type: 'SET_ALMACEN_DESTINO',
                  id,
                  nombre: alm?.nombre || '',
                });
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">Selecciona un almacén…</option>
              {almacenesPeru
                .filter((a) => a.estadoAlmacen === 'activo')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                    {a.ciudad ? ` · ${a.ciudad}` : ''}
                  </option>
                ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">Dónde se recibirán las unidades</p>
          </div>
        </div>
      )}

      {/* Info responsable reclamos */}
      {state.colaboradorNombre && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0 text-sm">
            💡
          </div>
          <div className="text-xs text-sky-900">
            <strong>Responsable default de reclamos:</strong>{' '}
            {state.tipoTransporte === 'viajero' ? 'Viajero' : 'Courier'} ({state.colaboradorNombre}).
            Si las unidades llegan dañadas o se pierden en tránsito, el reclamo inicial se levanta
            contra él. Puedes cambiar el responsable manualmente al abrir el reclamo.
          </div>
        </div>
      )}
    </div>
  );
};
