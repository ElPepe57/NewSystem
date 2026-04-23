/**
 * SeccionDestino — Sección [2] del Paso 1 del Wizard Unificado.
 *
 * Igual estructura que SeccionOrigen pero con 3 categorías (Casilla intl /
 * Almacén Perú / Almacén tercero) y filtros específicos:
 *   - casilla_intl   → Casilla.tipo='casilla_viajero' en país ≠ Perú
 *   - almacen_peru   → Casilla.tipo='almacen_propio' en Perú
 *   - almacen_tercero → Casilla.tipo='almacen_tercero' (S50)
 *
 * Restricciones por combinación según la matriz de inferencia:
 *   - Si origen='casilla_intl': destino puede ser casilla_intl (J) o almacen_peru (C)
 *   - Si origen='almacen_peru': destino puede ser almacen_peru (E) o almacen_tercero (I)
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useAlmacenStore } from '../../../../../store/casillaStore';
import type { Casilla } from '../../../../../types/casilla.types';
import type { UseEnvioWizardStateReturn } from '../../useEnvioWizardState';
import type { DestinoCategoria } from '../../envioWizardTypes';
import { SeccionColapsableWizard } from '../../shared/SeccionColapsableWizard';

interface Props {
  wizard: UseEnvioWizardStateReturn;
  collapsed: boolean;
  onToggle: () => void;
  disabled: boolean;
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

// Qué categorías de destino son válidas según el origen
function getCategoriasPermitidas(
  origenCategoria: 'casilla_intl' | 'almacen_peru' | null
): DestinoCategoria[] {
  if (!origenCategoria) return [];
  if (origenCategoria === 'casilla_intl') return ['casilla_intl', 'almacen_peru'];
  if (origenCategoria === 'almacen_peru') return ['almacen_peru', 'almacen_tercero'];
  return [];
}

export const SeccionDestino: React.FC<Props> = ({
  wizard,
  collapsed,
  onToggle,
  disabled,
}) => {
  const { state, dispatch } = wizard;
  const { casillas } = useAlmacenStore();
  const [busqueda, setBusqueda] = useState('');

  const categoriasPermitidas = getCategoriasPermitidas(state.origenCategoria);

  const CATEGORIAS_INFO: Record<
    DestinoCategoria,
    { icon: string; label: string; descripcion: string }
  > = {
    casilla_intl: {
      icon: '🌎',
      label: 'Casilla internacional',
      descripcion: 'Otra casilla tuya en el extranjero',
    },
    almacen_peru: {
      icon: '🇵🇪',
      label: 'Almacén Perú',
      descripcion: 'Tu almacén local',
    },
    almacen_tercero: {
      icon: '🏭',
      label: 'Almacén tercero',
      descripcion: 'FBA Amazon, distribuidor, consignación',
    },
  };

  // Filtrar ubicaciones destino según categoría + excluir origen
  const ubicacionesDisponibles = useMemo(() => {
    if (!state.destinoCategoria) return [];
    let filtradas: Casilla[] = [];
    if (state.destinoCategoria === 'casilla_intl') {
      filtradas = casillas.filter(
        c =>
          c.tipo === 'casilla_viajero' &&
          c.pais !== 'Peru' &&
          c.pais !== 'Peru_local' &&
          c.estado === 'activa' &&
          c.id !== state.ubicacionOrigenId // no mismo origen
      );
    } else if (state.destinoCategoria === 'almacen_peru') {
      filtradas = casillas.filter(
        c =>
          c.tipo === 'almacen_propio' &&
          (c.pais === 'Peru' || c.pais === 'Peru_local') &&
          c.estado === 'activa' &&
          c.id !== state.ubicacionOrigenId
      );
    } else if (state.destinoCategoria === 'almacen_tercero') {
      filtradas = casillas.filter(
        c => c.tipo === 'almacen_tercero' && c.estado === 'activa'
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
  }, [casillas, state.destinoCategoria, state.ubicacionOrigenId, busqueda]);

  const ubicacionSeleccionada = useMemo(
    () => casillas.find(c => c.id === state.ubicacionDestinoId),
    [casillas, state.ubicacionDestinoId]
  );

  const handleCategoriaChange = (categoria: DestinoCategoria) => {
    dispatch({ type: 'SET_DESTINO_CATEGORIA', categoria });
  };

  const handleSeleccionar = (casilla: Casilla) => {
    dispatch({
      type: 'SET_UBICACION_DESTINO',
      id: casilla.id,
      nombre: casilla.nombre,
      pais: casilla.pais,
    });
    onToggle();
  };

  // Resumen COLLAPSED
  const resumen = ubicacionSeleccionada ? (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-xl flex-shrink-0">
        {state.destinoCategoria === 'almacen_tercero'
          ? '🏭'
          : paisEmoji(ubicacionSeleccionada.pais)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-900">
            {ubicacionSeleccionada.nombre}
          </span>
          {ubicacionSeleccionada.esPrincipal && (
            <span className="text-amber-500">⭐</span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded uppercase tracking-wider font-semibold">
            {state.destinoCategoria === 'casilla_intl' && 'Casilla intl'}
            {state.destinoCategoria === 'almacen_peru' && 'Propio PE'}
            {state.destinoCategoria === 'almacen_tercero' && 'Tercero'}
          </span>
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {ubicacionSeleccionada.ciudad || ubicacionSeleccionada.pais}
          {ubicacionSeleccionada.colaboradorNombre &&
            ` · ${ubicacionSeleccionada.colaboradorNombre}`}
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
      numero={2}
      titulo="¿A dónde llegan las unidades?"
      subtitulo="Selecciona el tipo de destino y luego la ubicación específica."
      collapsed={collapsed}
      onToggle={onToggle}
      disabled={disabled}
      resumen={resumen}
      variante={collapsed ? 'completado' : 'activo'}
    >
      <div className="space-y-4">
        {/* Banner D-9 · advertencia de cambio de país para tipo J */}
        {state.advertenciaCambioPais && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 flex items-start gap-3">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div className="text-xs">
              <div className="font-semibold text-amber-900 mb-0.5">
                Cambio de país detectado
              </div>
              <p className="text-amber-800">
                El origen está en {state.ubicacionOrigenPais} y el destino en{' '}
                {state.ubicacionDestinoPais}. Los envíos entre casillas se
                recomiendan intra-país. Esto queda auditado.
              </p>
            </div>
          </div>
        )}

        {/* Categoría destino */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            Tipo de destino
          </label>
          <div className="space-y-2">
            {(['casilla_intl', 'almacen_peru', 'almacen_tercero'] as DestinoCategoria[]).map(
              cat => {
                const info = CATEGORIAS_INFO[cat];
                const permitida = categoriasPermitidas.includes(cat);
                const selected = state.destinoCategoria === cat;
                return (
                  <label
                    key={cat}
                    className={`flex items-start gap-3 p-3 border-2 rounded-xl transition ${
                      !permitida
                        ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                        : selected
                        ? 'border-teal-600 bg-teal-50 ring-[3px] ring-teal-100 cursor-pointer'
                        : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50/30 cursor-pointer'
                    }`}
                    title={
                      !permitida
                        ? 'Combinación no estándar · contactá al administrador'
                        : undefined
                    }
                  >
                    <input
                      type="radio"
                      name="destino-categoria"
                      checked={selected}
                      disabled={!permitida}
                      onChange={() => permitida && handleCategoriaChange(cat)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xl">{info.icon}</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {info.label}
                        </span>
                        {!permitida && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded uppercase tracking-wider font-semibold">
                            No disponible
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">{info.descripcion}</p>
                    </div>
                  </label>
                );
              }
            )}
          </div>
        </div>

        {/* Ubicación destino específica */}
        {state.destinoCategoria && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Ubicación específica
            </label>

            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, ciudad, país..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
              />
            </div>

            {ubicacionesDisponibles.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4 text-center">
                <div className="text-2xl mb-1">📭</div>
                <p className="text-xs text-slate-600">
                  {busqueda
                    ? 'Sin resultados para esa búsqueda.'
                    : 'Sin ubicaciones disponibles en esta categoría.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {ubicacionesDisponibles.map(c => {
                  const selected = c.id === state.ubicacionDestinoId;
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
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-xl flex-shrink-0">
                        {state.destinoCategoria === 'almacen_tercero'
                          ? '🏭'
                          : paisEmoji(c.pais)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">
                            {c.nombre}
                          </span>
                          {c.esPrincipal && (
                            <span className="text-amber-500">⭐</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {c.ciudad || c.pais}
                          {c.colaboradorNombre && ` · ${c.colaboradorNombre}`}
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
