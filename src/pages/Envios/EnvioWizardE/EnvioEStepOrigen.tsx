/**
 * EnvioEStepOrigen — Paso 1 del Wizard E (Origen + Picking).
 *
 * Selecciona el almacén Perú origen y las unidades a trasladar. Se muestra
 * solo las casillas tipo 'almacen_propio' en Perú (o Peru_local).
 */
import React, { useEffect, useMemo } from 'react';
import { useAlmacenStore } from '../../../store/casillaStore';
import { unidadService } from '../../../services/unidad.service';
import { useProductoStore } from '../../../store/productoStore';
import { getEmojiPorProducto } from '../../../components/modules/ordenCompra/OCWizardV3/productoEmoji';
import type { Unidad } from '../../../types/unidad.types';
import type { Casilla } from '../../../types/casilla.types';
import { cn } from '../../../design-system';
import {
  BannerPriorizacion,
  ProductoPickingGroup,
  type ProductoPickingGroupUnidad,
} from '../EnvioWizardT2';
import type { EnvioWizardEState, EnvioWizardEAction } from './envioWizardETypes';
import {
  selectPrioritariasDisponibles,
  selectPrioritariasIncluidas,
} from './envioWizardETypes';

export interface EnvioEStepOrigenProps {
  state: EnvioWizardEState;
  dispatch: (action: EnvioWizardEAction) => void;
}

const formatFecha = (ts: { toDate?: () => Date } | Date | null | undefined): string => {
  if (!ts) return '';
  try {
    const date = (ts as { toDate?: () => Date }).toDate
      ? (ts as { toDate: () => Date }).toDate()
      : (ts as Date);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][
      date.getMonth()
    ];
    return `${dd}-${mm}`;
  } catch {
    return '';
  }
};

export const EnvioEStepOrigen: React.FC<EnvioEStepOrigenProps> = ({ state, dispatch }) => {
  const casillas = useAlmacenStore((s) => s.casillas);
  const loading = useAlmacenStore((s) => s.casillasLoading);
  const fetchCasillas = useAlmacenStore((s) => s.fetchCasillas);
  const productos = useProductoStore((s) => s.productos);

  useEffect(() => {
    if (casillas.length === 0 && !loading) fetchCasillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo almacenes Perú activos (tipo 'almacen_propio' o cualquier casilla en Perú)
  const almacenesPeruActivos = useMemo(
    () =>
      casillas.filter(
        (c) =>
          c.estado === 'activa' && (c.pais === 'Peru' || c.pais === 'Peru_local')
      ),
    [casillas]
  );

  const almacenSeleccionado: Casilla | undefined = useMemo(
    () => almacenesPeruActivos.find((c) => c.id === state.almacenOrigenId),
    [almacenesPeruActivos, state.almacenOrigenId]
  );

  useEffect(() => {
    if (!almacenSeleccionado) return;
    let cancelled = false;
    unidadService
      .getDisponiblesPorAlmacen(almacenSeleccionado.id)
      .then((unidades: Unidad[]) => {
        if (cancelled) return;
        // Unidades físicamente disponibles en el almacén Perú para re-trasladar
        const disponibles = unidades.filter(
          (u) => u.estado === 'disponible' || u.estado === 'reservada'
        );
        dispatch({ type: 'SET_UNIDADES_DISPONIBLES', unidades: disponibles });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'SET_UNIDADES_DISPONIBLES', unidades: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [almacenSeleccionado, dispatch]);

  const productoMap = useMemo(() => {
    const map = new Map<string, { nombre: string; sku: string; emoji: string }>();
    for (const p of productos) {
      const { emoji } = getEmojiPorProducto({
        nombreComercial: p.nombreComercial,
        marca: p.marca,
        atributosSkincare: p.atributosSkincare,
      });
      map.set(p.id, {
        nombre: p.nombreComercial,
        sku: p.sku || '',
        emoji,
      });
    }
    return map;
  }, [productos]);

  const productosConUnidades = useMemo(() => {
    const groups = new Map<string, Unidad[]>();
    for (const u of state.unidadesDisponibles) {
      const existing = groups.get(u.productoId) || [];
      existing.push(u);
      groups.set(u.productoId, existing);
    }
    for (const [key, arr] of groups.entries()) {
      arr.sort((a, b) => {
        const aPrio = a.reservadaPara ? 1 : 0;
        const bPrio = b.reservadaPara ? 1 : 0;
        if (aPrio !== bPrio) return bPrio - aPrio;
        const aFecha = a.fechaRecepcion?.toMillis?.() ?? 0;
        const bFecha = b.fechaRecepcion?.toMillis?.() ?? 0;
        return aFecha - bFecha;
      });
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [state.unidadesDisponibles]);

  const cantidadPorProducto = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of state.unidadesDisponibles) {
      if (state.unidadesIdsSeleccionadas.includes(u.id)) {
        map.set(u.productoId, (map.get(u.productoId) || 0) + 1);
      }
    }
    return map;
  }, [state.unidadesDisponibles, state.unidadesIdsSeleccionadas]);

  const prevendidas = useMemo(() => selectPrioritariasDisponibles(state), [state]);
  const cotizacionesIds = useMemo(() => {
    const ids = new Set<string>();
    for (const u of prevendidas) {
      if (u.reservadaPara) ids.add(u.reservadaPara);
    }
    return Array.from(ids).slice(0, 5);
  }, [prevendidas]);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Almacén origen del traslado
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Elige el almacén Perú desde donde saldrán las unidades. Caso E es un traslado
          interno entre almacenes tuyos (no sale del país).
        </p>
      </div>

      {loading && casillas.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">Cargando almacenes…</div>
      ) : almacenesPeruActivos.length === 0 ? (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
          <div className="text-sm text-amber-900 font-medium">
            No hay almacenes Perú activos
          </div>
          <div className="text-xs text-amber-700 mt-1">
            Configura al menos 2 almacenes en Perú antes de hacer un traslado interno.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {almacenesPeruActivos.map((c) => {
            const sel = c.id === state.almacenOrigenId;
            const sinStock = (c.unidadesActuales ?? 0) === 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'SET_ORIGEN',
                    almacenId: c.id,
                    almacenNombre: c.nombre,
                  })
                }
                disabled={sinStock}
                className={cn(
                  'relative rounded-xl p-4 text-left transition-all',
                  sel
                    ? 'bg-teal-50 border-2 border-teal-500 ring-4 ring-teal-100'
                    : sinStock
                      ? 'bg-slate-50 border border-slate-200 opacity-60 cursor-not-allowed'
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
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{c.direccion}</div>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                          sinStock ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'
                        )}
                      >
                        {!sinStock && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        {sinStock ? 'Sin stock' : 'Activa'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {c.unidadesActuales ?? 0} unidades
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Picking inline */}
      {almacenSeleccionado && state.unidadesDisponibles.length > 0 && (
        <div className="pt-3 border-t border-slate-200 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Unidades disponibles en {almacenSeleccionado.nombre}
            </span>
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-xs text-slate-500">
              {state.unidadesIdsSeleccionadas.length} de {state.unidadesDisponibles.length} seleccionadas
            </span>
          </div>

          <BannerPriorizacion
            cantidadPrevendidas={prevendidas.length}
            cotizacionesLabel={cotizacionesIds.map((id) => id.slice(0, 8).toUpperCase())}
            incluirAuto={state.incluirPrevendidasAuto}
            onToggleAuto={(checked) => {
              dispatch({ type: 'SET_INCLUIR_PREVENDIDAS_AUTO', incluir: checked });
              if (checked) dispatch({ type: 'APLICAR_PRIORITARIAS' });
            }}
          />

          <div className="space-y-3">
            {productosConUnidades.map(([productoId, unidades]) => {
              const pInfo = productoMap.get(productoId);
              const prioritariasCount = unidades.filter((u) => !!u.reservadaPara).length;
              const unidadesGroup: ProductoPickingGroupUnidad[] = unidades.map((u) => ({
                unidadId: u.id,
                codigoUnidad: u.id.slice(-6).toUpperCase(),
                reservadaParaLabel: u.reservadaPara
                  ? `COT ${u.reservadaPara.slice(0, 8).toUpperCase()}`
                  : null,
                fechaRecepcionLabel: formatFecha(u.fechaRecepcion),
              }));
              return (
                <ProductoPickingGroup
                  key={productoId}
                  productoId={productoId}
                  productoNombre={pInfo?.nombre ?? productoId}
                  productoSKU={pInfo?.sku}
                  productoEmoji={pInfo?.emoji ?? '📦'}
                  procedenciaLabel={`${unidades.length} unidades disponibles`}
                  unidades={unidadesGroup}
                  unidadesIdsSeleccionadas={state.unidadesIdsSeleccionadas}
                  cantidadSeleccionada={cantidadPorProducto.get(productoId) ?? 0}
                  prioritariasCount={prioritariasCount}
                  onToggleUnidad={(uid) => dispatch({ type: 'TOGGLE_UNIDAD', unidadId: uid })}
                  onChangeCantidad={(cantidad) =>
                    dispatch({ type: 'SET_CANTIDAD_PRODUCTO', productoId, cantidad })
                  }
                />
              );
            })}
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
            <div className="text-slate-600">
              <b className="text-slate-900">{state.unidadesIdsSeleccionadas.length}</b> unidades seleccionadas ·{' '}
              <b>{selectPrioritariasIncluidas(state)}</b> de <b>{prevendidas.length}</b> pre-vendidas incluidas
            </div>
          </div>
        </div>
      )}

      {almacenSeleccionado && state.unidadesDisponibles.length === 0 && (
        <div className="pt-3 border-t border-slate-200">
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <div className="text-sm text-slate-700 font-medium">
              El almacén {almacenSeleccionado.nombre} no tiene unidades disponibles.
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Elige otro almacén Perú con stock.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
