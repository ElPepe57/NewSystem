/**
 * EnvioJStepOrigen — Paso 1 del Wizard J (Origen + Picking combinado).
 *
 * Combina en un solo paso la selección de casilla origen + el picking de
 * unidades. En Caso J no hay consulta de OCs — el picking opera sobre el
 * stock físico ya depositado en la casilla.
 *
 * Flujo:
 *   1. Usuario elige casilla origen de la lista (cualquier país internacional)
 *   2. Al seleccionar, se cargan unidades disponibles y se pre-seleccionan
 *      las pre-vendidas si `incluirPrevendidasAuto` está activo
 *   3. Usuario ajusta selección con ProductoPickingGroup (stepper + picker)
 */
import React, { useEffect, useMemo } from 'react';
import { User, Star } from 'lucide-react';
import { useAlmacenStore } from '../../../store/casillaStore';
import { unidadService } from '../../../services/unidad.service';
import { useProductoStore } from '../../../store/productoStore';
import { getEmojiPorProducto } from '../../../components/modules/ordenCompra/OCWizardV3/productoEmoji';
import type { Unidad } from '../../../types/unidad.types';
import type { Casilla } from '../../../types/casilla.types';
import { PAISES_CONFIG } from '../../../types/casilla.types';
import { cn } from '../../../design-system';
import {
  BannerPriorizacion,
  ProductoPickingGroup,
  type ProductoPickingGroupUnidad,
} from '../EnvioWizardT2';
import type { EnvioWizardJState, EnvioWizardJAction } from './envioWizardJTypes';
import {
  selectPrioritariasDisponibles,
  selectPrioritariasIncluidas,
} from './envioWizardJTypes';

export interface EnvioJStepOrigenProps {
  state: EnvioWizardJState;
  dispatch: (action: EnvioWizardJAction) => void;
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

export const EnvioJStepOrigen: React.FC<EnvioJStepOrigenProps> = ({ state, dispatch }) => {
  const casillas = useAlmacenStore((s) => s.casillas);
  const loading = useAlmacenStore((s) => s.casillasLoading);
  const fetchCasillas = useAlmacenStore((s) => s.fetchCasillas);
  const productos = useProductoStore((s) => s.productos);

  useEffect(() => {
    if (casillas.length === 0 && !loading) fetchCasillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo casillas internacionales activas (Caso J no usa almacenes Perú)
  const casillasActivas = useMemo(
    () =>
      casillas.filter(
        (c) => c.estado === 'activa' && c.pais !== 'Peru' && c.pais !== 'Peru_local'
      ),
    [casillas]
  );

  const casillaSeleccionada: Casilla | undefined = useMemo(
    () => casillasActivas.find((c) => c.id === state.casillaOrigenId),
    [casillasActivas, state.casillaOrigenId]
  );

  // Cargar unidades al seleccionar casilla
  useEffect(() => {
    if (!casillaSeleccionada) return;
    let cancelled = false;
    unidadService
      .getDisponiblesPorAlmacen(casillaSeleccionada.id)
      .then((unidades: Unidad[]) => {
        if (cancelled) return;
        const disponibles = unidades.filter(
          (u) =>
            u.estado === 'recibida_usa' ||
            u.estado === 'recibida_origen' ||
            u.estado === 'reservada'
        );
        dispatch({ type: 'SET_UNIDADES_DISPONIBLES', unidades: disponibles });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'SET_UNIDADES_DISPONIBLES', unidades: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [casillaSeleccionada, dispatch]);

  // Mapa productoId → (Producto, emoji)
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

  // Agrupar unidades disponibles por productoId (prioritarias primero, FIFO después)
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

  // Cantidad seleccionada por producto
  const cantidadPorProducto = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of state.unidadesDisponibles) {
      if (state.unidadesIdsSeleccionadas.includes(u.id)) {
        map.set(u.productoId, (map.get(u.productoId) || 0) + 1);
      }
    }
    return map;
  }, [state.unidadesDisponibles, state.unidadesIdsSeleccionadas]);

  // Pre-vendidas (banner)
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
      {/* Título */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Origen del envío entre casillas
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Elige la casilla internacional desde donde saldrán las unidades. El Caso J opera
          entre casillas de colaboradores — el destino no es un almacén Perú.
        </p>
      </div>

      {/* Grid de casillas */}
      {loading && casillas.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">Cargando casillas…</div>
      ) : casillasActivas.length === 0 ? (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
          <div className="text-sm text-amber-900 font-medium">
            No hay casillas internacionales activas
          </div>
          <div className="text-xs text-amber-700 mt-1">
            Configura al menos 2 casillas en Red Logística antes de crear un envío J.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {casillasActivas.map((c) => {
            const sel = c.id === state.casillaOrigenId;
            const sinStock = (c.unidadesActuales ?? 0) === 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'SET_ORIGEN',
                    casillaId: c.id,
                    casillaNombre: c.nombre,
                    pais: c.pais,
                    colaboradorId: c.colaboradorId,
                    colaboradorNombre: c.colaboradorNombre,
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
                  <span className="text-3xl">{PAISES_CONFIG[c.pais]?.emoji ?? '🌎'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 truncate">{c.nombre}</span>
                      {c.esPrincipal && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-600 mt-0.5">
                      <User className="w-3 h-3" />
                      <span className="truncate">{c.colaboradorNombre}</span>
                    </div>
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

      {/* Picking inline si hay casilla seleccionada con unidades */}
      {casillaSeleccionada && state.unidadesDisponibles.length > 0 && (
        <div className="pt-3 border-t border-slate-200 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Unidades disponibles en {casillaSeleccionada.nombre}
            </span>
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-xs text-slate-500">
              {state.unidadesIdsSeleccionadas.length} de {state.unidadesDisponibles.length} seleccionadas
            </span>
          </div>

          {/* Banner priorización de pre-vendidas */}
          <BannerPriorizacion
            cantidadPrevendidas={prevendidas.length}
            cotizacionesLabel={cotizacionesIds.map((id) => id.slice(0, 8).toUpperCase())}
            incluirAuto={state.incluirPrevendidasAuto}
            onToggleAuto={(checked) => {
              dispatch({ type: 'SET_INCLUIR_PREVENDIDAS_AUTO', incluir: checked });
              if (checked) dispatch({ type: 'APLICAR_PRIORITARIAS' });
            }}
          />

          {/* Grupos por producto */}
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
                extraRightLabel:
                  u.ctruDinamico != null
                    ? `$${u.ctruDinamico.toFixed(2)}`
                    : u.costoUnitarioUSD != null
                      ? `$${u.costoUnitarioUSD.toFixed(2)}`
                      : undefined,
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

          {/* Footer con contadores */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
            <div className="text-slate-600">
              <b className="text-slate-900">{state.unidadesIdsSeleccionadas.length}</b> unidades seleccionadas ·{' '}
              <b>{selectPrioritariasIncluidas(state)}</b> de <b>{prevendidas.length}</b> pre-vendidas incluidas
            </div>
          </div>
        </div>
      )}

      {/* Empty state picking */}
      {casillaSeleccionada && state.unidadesDisponibles.length === 0 && (
        <div className="pt-3 border-t border-slate-200">
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <div className="text-sm text-slate-700 font-medium">
              La casilla {casillaSeleccionada.nombre} no tiene unidades disponibles.
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Elige otra casilla origen con stock, o genera ingresos antes de crear el envío.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
