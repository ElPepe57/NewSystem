import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Plane,
  UserCheck,
  Info,
  Check,
  Users,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../../design-system';
import type {
  EnvioWizardState,
  EnvioWizardAction,
  TipoRuta,
} from './envioWizardTypes';
import type { Almacen } from '../../../types/almacen.types';
import type { MotivoEnvioInterno } from '../../../types/envio.types';
import { useColaboradorStore } from '../../../store/colaboradorStore';
import { unidadService } from '../../../services/unidad.service';

// ════════════════════════════════════════════════════════════════════════════
// EnvioStepRuta — Paso 1 EnvioWizardV2 (reescritura alineada al mockup S40)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Estructura fiel al mockup `rework-maestro-s40.html` pane-env-1:
 *
 *   Sección "Tipo de envío" (2 cards grandes)
 *   Sección A "Casilla origen" (grid 2-col cards con avatar + "X unidades disponibles")
 *   Sección B "Casilla destino" (grid 2-col cards con subtexto contextual)
 *   Sección "Colaborador que transporta" (opcional) — select agrupado
 *   Sección "Motivo" — select predefinido
 *
 * NOTA: el mockup define este Paso 1 para la Opción A (envíos manuales entre
 * casillas o casilla→Perú). Los envíos proveedor→casilla nacen automáticos al
 * confirmar OC (mostramos nota informativa sky arriba).
 */

interface EnvioStepRutaProps {
  state: EnvioWizardState;
  dispatch: React.Dispatch<EnvioWizardAction>;
  casillasOrigen: Almacen[];      // casillas en origen (USA/CN/etc)
  casillasDestinoPeru: Almacen[]; // casillas/almacenes en Perú
  colaboradores: Almacen[];        // viajeros/couriers
}

// ─── Main component ─────────────────────────────────────────────────────────

export const EnvioStepRuta: React.FC<EnvioStepRutaProps> = ({
  state,
  dispatch,
  casillasOrigen,
  casillasDestinoPeru,
  colaboradores,
}) => {
  const { getByTipo } = useColaboradorStore();
  const viajeros = getByTipo('viajero');
  const couriers = getByTipo('courier_externo');

  // ─── Conteo de unidades disponibles por casilla origen ──────────────────
  // Se carga async al montar para mostrar "X unidades disponibles" en cada card
  const [unidadesCountMap, setUnidadesCountMap] = useState<Map<string, number>>(
    new Map()
  );

  useEffect(() => {
    let cancelled = false;
    const cargarConteos = async () => {
      const nuevosConteos = new Map<string, number>();
      await Promise.all(
        casillasOrigen.map(async (c) => {
          try {
            const unidades = await unidadService.getDisponiblesPorAlmacen(c.id);
            nuevosConteos.set(c.id, unidades.length);
          } catch {
            nuevosConteos.set(c.id, 0);
          }
        })
      );
      if (!cancelled) setUnidadesCountMap(nuevosConteos);
    };
    if (casillasOrigen.length > 0) cargarConteos();
    return () => {
      cancelled = true;
    };
  }, [casillasOrigen]);

  // ─── Destinos según tipo de ruta ─────────────────────────────────────────
  const casillasDestino = useMemo(() => {
    if (state.tipoRuta === 'casilla_peru') return casillasDestinoPeru;
    if (state.tipoRuta === 'casilla_casilla') {
      return casillasOrigen.filter((c) => c.id !== state.origenCasillaId);
    }
    return [];
  }, [state.tipoRuta, state.origenCasillaId, casillasOrigen, casillasDestinoPeru]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleSetTipoRuta = (tipo: TipoRuta) => {
    dispatch({ type: 'SET_TIPO_RUTA', tipoRuta: tipo });
  };

  const handleSetOrigen = (c: Almacen) => {
    dispatch({ type: 'SET_ORIGEN', id: c.id, nombre: c.nombre });
  };

  const handleSetDestino = (c: Almacen) => {
    dispatch({ type: 'SET_DESTINO', id: c.id, nombre: c.nombre });
  };

  const handleSetColaborador = (id: string) => {
    if (!id) {
      dispatch({ type: 'SET_COLABORADOR', id: '', nombre: '' });
      return;
    }
    const sel = [...viajeros, ...couriers, ...colaboradores].find((c) => c.id === id);
    dispatch({ type: 'SET_COLABORADOR', id, nombre: sel?.nombre ?? '' });
  };

  const handleSetMotivo = (motivo: MotivoEnvioInterno | '') => {
    dispatch({
      type: 'SET_MOTIVO',
      motivo: motivo === '' ? undefined : motivo,
    });
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Nota aclaratoria Opción A — solo si no hay tipo aún */}
      {!state.tipoRuta && (
        <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-sky-800">
            <strong>Los envíos desde proveedor nacen automáticos al confirmar una OC.</strong>{' '}
            Desde aquí creas envíos <strong>manuales</strong> — movimientos entre
            casillas que no derivan de una compra.
          </div>
        </div>
      )}

      {/* ═══ Sección Tipo de envío ═══ */}
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Tipo de envío</h3>
        <p className="text-xs text-slate-500 mb-3">
          Solo envíos que no derivan de una OC.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TipoEnvioCard
            icon={<ArrowRightLeft className="w-5 h-5 text-purple-600" />}
            iconBg="bg-purple-100"
            titulo="Entre casillas origen"
            subtitulo="Consolidar mercadería entre viajeros/couriers en USA/China antes del cruce"
            selected={state.tipoRuta === 'casilla_casilla'}
            onClick={() => handleSetTipoRuta('casilla_casilla')}
          />
          <TipoEnvioCard
            icon={<Plane className="w-5 h-5 text-sky-600" />}
            iconBg="bg-sky-100"
            titulo="Casilla → Perú"
            subtitulo="Cruce internacional de mercadería que ya está en una casilla origen"
            selected={state.tipoRuta === 'casilla_peru'}
            onClick={() => handleSetTipoRuta('casilla_peru')}
          />
        </div>
      </section>

      {/* ═══ Sección A: Casilla origen ═══ */}
      {state.tipoRuta && (
        <section className="fade-in">
          <h3 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-[10px] flex items-center justify-center font-bold">
              A
            </span>
            Casilla origen
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            ¿De qué casilla sale la mercadería?
          </p>
          {casillasOrigen.length === 0 ? (
            <EmptyHint>
              No hay casillas de origen activas.{' '}
              <a href="/red-logistica" className="underline font-medium">
                Crear una en Red Logística
              </a>
            </EmptyHint>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {casillasOrigen.map((c) => (
                <CasillaCard
                  key={c.id}
                  casilla={c}
                  selected={state.origenCasillaId === c.id}
                  onClick={() => handleSetOrigen(c)}
                  unidadesDisponibles={unidadesCountMap.get(c.id) ?? null}
                  subtextoTipo="disponibles"
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══ Sección B: Casilla destino ═══ */}
      {state.tipoRuta && state.origenCasillaId && (
        <section className="fade-in">
          <h3 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-[10px] flex items-center justify-center font-bold">
              B
            </span>
            Casilla destino
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            ¿A qué casilla va la mercadería?
          </p>
          {casillasDestino.length === 0 ? (
            <EmptyHint>
              No hay casillas destino disponibles.
            </EmptyHint>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {casillasDestino.map((c) => (
                <CasillaCard
                  key={c.id}
                  casilla={c}
                  selected={state.destinoCasillaId === c.id}
                  onClick={() => handleSetDestino(c)}
                  unidadesDisponibles={null}
                  subtextoTipo="destino"
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══ Sección Colaborador que transporta (opcional) ═══ */}
      {state.tipoRuta && state.origenCasillaId && state.destinoCasillaId && (
        <section className="fade-in">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
            Colaborador que transporta
            <span className="text-xs font-normal text-slate-400">(opcional)</span>
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Déjalo en blanco y asígnalo después cuando el colaborador confirme.
          </p>
          <select
            value={state.colaboradorId}
            onChange={(e) => handleSetColaborador(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Sin asignar — decidir después</option>
            {couriers.length > 0 && (
              <>
                <option disabled>──── Couriers externos ────</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </>
            )}
            {viajeros.length > 0 && (
              <>
                <option disabled>──── Viajeros ────</option>
                {viajeros.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                    {v.metricas?.enviosCompletados
                      ? ` — ${v.metricas.enviosCompletados} envíos previos`
                      : ''}
                  </option>
                ))}
              </>
            )}
          </select>
        </section>
      )}

      {/* ═══ Sección Motivo ═══ */}
      {state.tipoRuta && state.origenCasillaId && state.destinoCasillaId && (
        <section className="fade-in">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Motivo</h3>
          <select
            value={state.motivo ?? ''}
            onChange={(e) =>
              handleSetMotivo(e.target.value as MotivoEnvioInterno | '')
            }
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">— Sin especificar —</option>
            <option value="consolidacion">
              Consolidación — juntar antes de cruzar
            </option>
            <option value="capacidad">
              Capacidad — la casilla actual no tiene espacio
            </option>
            <option value="viaje_proximo">
              Viaje próximo — mover a viajero que sale pronto
            </option>
            <option value="costo_menor">
              Costo menor — viajero con mejor tarifa
            </option>
            <option value="otro">Otro…</option>
          </select>
        </section>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Subcomponentes
// ════════════════════════════════════════════════════════════════════════════

const TipoEnvioCard: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  titulo: string;
  subtitulo: string;
  selected: boolean;
  onClick: () => void;
}> = ({ icon, iconBg, titulo, subtitulo, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'relative border-2 rounded-xl p-4 text-left transition-all',
      selected
        ? 'border-teal-500 bg-teal-50 shadow-sm'
        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
    )}
  >
    {selected && (
      <div className="absolute top-2 right-2">
        <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      </div>
    )}
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0',
          iconBg
        )}
      >
        {icon}
      </div>
      <div>
        <div className="font-semibold text-slate-900 text-sm">{titulo}</div>
        <div className="text-xs text-slate-500 mt-0.5">{subtitulo}</div>
      </div>
    </div>
  </button>
);

const CasillaCard: React.FC<{
  casilla: Almacen;
  selected: boolean;
  onClick: () => void;
  unidadesDisponibles: number | null;
  subtextoTipo: 'disponibles' | 'destino';
}> = ({ casilla, selected, onClick, unidadesDisponibles, subtextoTipo }) => {
  const iniciales = casilla.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  const flag = getFlagByPais(casilla.pais);

  // Subtexto contextual
  const subtexto = (() => {
    if (subtextoTipo === 'disponibles') {
      if (unidadesDisponibles === null) return 'Cargando unidades...';
      if (unidadesDisponibles === 0) return 'Sin unidades disponibles';
      return `${unidadesDisponibles} unidades disponibles`;
    }
    // destino
    if (casilla.pais === 'Peru') return 'Almacén en Perú';
    return 'Consolidar en esta casilla';
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border-2 rounded-xl p-3 text-left transition-all',
        selected
          ? 'border-teal-500 bg-teal-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
          {iniciales || <Users className="w-3.5 h-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {casilla.nombre}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">{casilla.codigo}</div>
        </div>
        <span className="text-base flex-shrink-0">{flag}</span>
      </div>
      <div className="text-[11px] text-slate-600">{subtexto}</div>
    </button>
  );
};

const EmptyHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
    <div>{children}</div>
  </div>
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function getFlagByPais(pais?: string): string {
  if (!pais) return '🌐';
  const flags: Record<string, string> = {
    USA: '🇺🇸',
    'Estados Unidos': '🇺🇸',
    CHINA: '🇨🇳',
    China: '🇨🇳',
    COREA: '🇰🇷',
    Corea: '🇰🇷',
    'Corea del Sur': '🇰🇷',
    JAPÓN: '🇯🇵',
    Japón: '🇯🇵',
    MÉXICO: '🇲🇽',
    México: '🇲🇽',
    PERÚ: '🇵🇪',
    Perú: '🇵🇪',
    Peru: '🇵🇪',
  };
  return flags[pais] ?? '🌐';
}
