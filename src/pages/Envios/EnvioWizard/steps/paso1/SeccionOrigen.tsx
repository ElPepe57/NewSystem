/**
 * SeccionOrigen — Sección [1] del Paso 1 del Wizard Unificado.
 *
 * Estados:
 *   - EXPANDED: radios de categoría (Casilla intl / Almacén Perú) + buscador +
 *               lista apilada de casillas/almacenes disponibles
 *   - COLLAPSED: card resumen con ubicación específica elegida + "Cambiar"
 *
 * Solo se muestran casillas activas (estado='activa') que coincidan con la
 * categoría elegida:
 *   - casilla_intl  → Casilla.tipo='casilla_viajero' en país ≠ Perú
 *   - almacen_peru  → Casilla.tipo='almacen_propio' en Perú
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useAlmacenStore } from '../../../../../store/casillaStore';
import type { Casilla } from '../../../../../types/casilla.types';
import type { UseEnvioWizardStateReturn } from '../../useEnvioWizardState';
import { SeccionColapsableWizard } from '../../shared/SeccionColapsableWizard';

interface Props {
  wizard: UseEnvioWizardStateReturn;
  collapsed: boolean;
  onToggle: () => void;
}

function paisEmoji(pais: string): string {
  const MAP: Record<string, string> = {
    USA: '🇺🇸',
    China: '🇨🇳',
    Corea: '🇰🇷',
    Peru: '🇵🇪',
    Peru_local: '🇵🇪',
  };
  return MAP[pais] || '🌎';
}

export const SeccionOrigen: React.FC<Props> = ({ wizard, collapsed, onToggle }) => {
  const { state, dispatch } = wizard;
  const { casillas, casillasLoading, fetchCasillas } = useAlmacenStore();
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (casillas.length === 0 && !casillasLoading) {
      fetchCasillas();
    }
  }, [casillas.length, casillasLoading, fetchCasillas]);

  // Filtrar casillas según categoría elegida y búsqueda
  const casillasDisponibles = useMemo(() => {
    if (!state.origenCategoria) return [];
    let filtradas: Casilla[] = [];
    if (state.origenCategoria === 'casilla_intl') {
      filtradas = casillas.filter(
        c =>
          c.tipo === 'casilla_viajero' &&
          c.pais !== 'Peru' &&
          c.pais !== 'Peru_local' &&
          c.estado === 'activa'
      );
    } else if (state.origenCategoria === 'almacen_peru') {
      filtradas = casillas.filter(
        c =>
          c.tipo === 'almacen_propio' &&
          (c.pais === 'Peru' || c.pais === 'Peru_local') &&
          c.estado === 'activa'
      );
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      filtradas = filtradas.filter(
        c =>
          c.nombre.toLowerCase().includes(q) ||
          c.ciudad?.toLowerCase().includes(q) ||
          c.pais.toLowerCase().includes(q) ||
          c.colaboradorNombre.toLowerCase().includes(q)
      );
    }
    return filtradas;
  }, [casillas, state.origenCategoria, busqueda]);

  const casillaSeleccionada = useMemo(
    () => casillas.find(c => c.id === state.ubicacionOrigenId),
    [casillas, state.ubicacionOrigenId]
  );

  const handleCategoriaChange = (categoria: 'casilla_intl' | 'almacen_peru') => {
    dispatch({ type: 'SET_ORIGEN_CATEGORIA', categoria });
  };

  const handleSeleccionar = (casilla: Casilla) => {
    dispatch({
      type: 'SET_UBICACION_ORIGEN',
      id: casilla.id,
      nombre: casilla.nombre,
      pais: casilla.pais,
    });
    // Auto-colapsar al seleccionar (comportamiento OC)
    onToggle();
  };

  // Resumen del estado COLLAPSED
  const resumen = casillaSeleccionada ? (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center text-xl flex-shrink-0">
        {paisEmoji(casillaSeleccionada.pais)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-900">
            {casillaSeleccionada.nombre}
          </span>
          {casillaSeleccionada.esPrincipal && (
            <span className="text-amber-500" title="Casilla principal">
              ⭐
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded uppercase tracking-wider font-semibold">
            {state.origenCategoria === 'casilla_intl' ? 'Casilla intl' : 'Almacén PE'}
          </span>
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {casillaSeleccionada.ciudad || casillaSeleccionada.pais}
          {casillaSeleccionada.unidadesActuales !== undefined &&
            ` · ${casillaSeleccionada.unidadesActuales} uds disponibles`}
        </div>
      </div>
      <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs flex-shrink-0">
        ✓
      </div>
    </div>
  ) : (
    <div className="text-xs text-slate-400 italic">Selección incompleta</div>
  );

  return (
    <SeccionColapsableWizard
      numero={1}
      titulo="¿De dónde salen las unidades?"
      subtitulo="Selecciona el tipo de origen y luego la ubicación específica."
      collapsed={collapsed}
      onToggle={onToggle}
      resumen={resumen}
      variante={collapsed ? 'completado' : 'activo'}
    >
      <div className="space-y-4">
        {/* Categoría origen */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            Tipo de origen
          </label>
          <div className="space-y-2">
            <label
              className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition ${
                state.origenCategoria === 'casilla_intl'
                  ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100'
                  : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50/30'
              }`}
            >
              <input
                type="radio"
                name="origen-categoria"
                checked={state.origenCategoria === 'casilla_intl'}
                onChange={() => handleCategoriaChange('casilla_intl')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xl">🌎</span>
                  <span className="text-sm font-semibold text-slate-900">
                    Casilla internacional
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  USA, China, Corea, Japón, etc.
                </p>
              </div>
            </label>
            <label
              className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition ${
                state.origenCategoria === 'almacen_peru'
                  ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100'
                  : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50/30'
              }`}
            >
              <input
                type="radio"
                name="origen-categoria"
                checked={state.origenCategoria === 'almacen_peru'}
                onChange={() => handleCategoriaChange('almacen_peru')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xl">🇵🇪</span>
                  <span className="text-sm font-semibold text-slate-900">
                    Almacén Perú
                  </span>
                </div>
                <p className="text-xs text-slate-600">Tu almacén local en Perú</p>
              </div>
            </label>
          </div>
        </div>

        {/* Ubicación específica — solo si hay categoría elegida */}
        {state.origenCategoria && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Ubicación específica
            </label>

            {/* Buscador */}
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder={
                  state.origenCategoria === 'casilla_intl'
                    ? 'Buscar casilla por nombre, ciudad, país...'
                    : 'Buscar almacén por nombre, ciudad...'
                }
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
              />
            </div>

            {/* Lista apilada */}
            {casillasLoading ? (
              <div className="text-xs text-slate-500 text-center py-4">
                Cargando ubicaciones...
              </div>
            ) : casillasDisponibles.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center">
                <div className="text-2xl mb-1">📭</div>
                <p className="text-xs text-slate-600">
                  {busqueda
                    ? 'Sin resultados para esa búsqueda.'
                    : state.origenCategoria === 'casilla_intl'
                    ? 'Sin casillas internacionales activas.'
                    : 'Sin almacenes Perú activos.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {casillasDisponibles.map(c => {
                  const selected = c.id === state.ubicacionOrigenId;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSeleccionar(c)}
                      className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition ${
                        selected
                          ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100'
                          : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50/30'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center text-xl flex-shrink-0">
                        {paisEmoji(c.pais)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">
                            {c.nombre}
                          </span>
                          {c.esPrincipal && (
                            <span className="text-amber-500" title="Principal">
                              ⭐
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {c.ciudad || c.pais}
                          {c.colaboradorNombre && ` · ${c.colaboradorNombre}`}
                          {c.unidadesActuales !== undefined &&
                            ` · ${c.unidadesActuales} uds`}
                        </div>
                      </div>
                      {selected && (
                        <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs flex-shrink-0">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </SeccionColapsableWizard>
  );
};
