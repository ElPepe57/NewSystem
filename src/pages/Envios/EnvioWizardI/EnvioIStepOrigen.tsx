/**
 * EnvioIStepOrigen — Paso 1 del Wizard I (Origen + Picking).
 *
 * Selecciona el almacén propio origen (tipo='almacen_propio', cualquier país)
 * y las unidades a enviar al tercero. A diferencia del Caso F (venta), aquí
 * NO se pre-selecciona por reservadaPara — es stock neto que se enviará a
 * fulfillment/consignación.
 */
import React, { useEffect, useMemo } from 'react';
import { Warehouse } from 'lucide-react';
import { useAlmacenStore } from '../../../store/casillaStore';
import { unidadService } from '../../../services/unidad.service';
import { useProductoStore } from '../../../store/productoStore';
import { getEmojiPorProducto } from '../../../components/modules/ordenCompra/OCWizardV3/productoEmoji';
import type { Unidad } from '../../../types/unidad.types';
import type { Casilla } from '../../../types/casilla.types';
import { PAISES_CONFIG } from '../../../types/casilla.types';
import { cn } from '../../../design-system';
import { ProductoPickingGroup, type ProductoPickingGroupUnidad } from '../EnvioWizardT2';
import type { EnvioWizardIState, EnvioWizardIAction } from './envioWizardITypes';

export interface EnvioIStepOrigenProps {
  state: EnvioWizardIState;
  dispatch: (action: EnvioWizardIAction) => void;
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

export const EnvioIStepOrigen: React.FC<EnvioIStepOrigenProps> = ({ state, dispatch }) => {
  const casillas = useAlmacenStore((s) => s.casillas);
  const loading = useAlmacenStore((s) => s.casillasLoading);
  const fetchCasillas = useAlmacenStore((s) => s.fetchCasillas);
  const productos = useProductoStore((s) => s.productos);

  useEffect(() => {
    if (casillas.length === 0 && !loading) fetchCasillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo almacenes propios activos (NO terceros, NO casillas viajero)
  const almacenesPropios = useMemo(
    () =>
      casillas.filter(
        (c) => c.estado === 'activa' && c.tipo === 'almacen_propio'
      ),
    [casillas]
  );

  const almacenSeleccionado: Casilla | undefined = useMemo(
    () => almacenesPropios.find((c) => c.id === state.almacenOrigenId),
    [almacenesPropios, state.almacenOrigenId]
  );

  useEffect(() => {
    if (!almacenSeleccionado) return;
    let cancelled = false;
    unidadService
      .getDisponiblesPorAlmacen(almacenSeleccionado.id)
      .then((unidades: Unidad[]) => {
        if (cancelled) return;
        // Solo disponibles — en Caso I no enviamos unidades reservadas (bloquearíamos ventas)
        const disponibles = unidades.filter((u) => u.estado === 'disponible');
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

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Almacén origen del envío a tercero
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Elige el almacén propio desde donde saldrán las unidades. D-10: una vez
          enviadas, el stock queda <strong>BLOQUEADO</strong> — no aparecerá como
          vendible hasta que regresen a Perú o se liquiden en el tercero.
        </p>
      </div>

      {/* Grid de almacenes propios */}
      {loading && casillas.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">Cargando almacenes…</div>
      ) : almacenesPropios.length === 0 ? (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
          <div className="text-sm text-amber-900 font-medium">
            No hay almacenes propios activos
          </div>
          <div className="text-xs text-amber-700 mt-1">
            Configura al menos un almacén (tipo='almacen_propio') antes de crear un envío I.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {almacenesPropios.map((c) => {
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
                    pais: c.pais,
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
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{PAISES_CONFIG[c.pais]?.emoji ?? '🏭'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <Warehouse className="w-3 h-3 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-900 truncate">{c.nombre}</span>
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
                        {c.unidadesActuales ?? 0} unidades disponibles
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

          {/* Banner D-10 bloqueo */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <span className="text-xl">🔒</span>
            <div className="flex-1 text-xs">
              <div className="font-semibold text-red-900">D-10: Bloqueo de stock al confirmar</div>
              <div className="text-red-800 mt-0.5">
                Las unidades seleccionadas dejarán de aparecer como stock vendible. Solo
                volverán disponibles si las devuelves a Perú mediante un envío inverso
                o las liquidas en el tercero.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {productosConUnidades.map(([productoId, unidades]) => {
              const pInfo = productoMap.get(productoId);
              const unidadesGroup: ProductoPickingGroupUnidad[] = unidades.map((u) => ({
                unidadId: u.id,
                codigoUnidad: u.id.slice(-6).toUpperCase(),
                reservadaParaLabel: null, // Caso I no prioriza reservas
                fechaRecepcionLabel: formatFecha(u.fechaRecepcion),
              }));
              return (
                <ProductoPickingGroup
                  key={productoId}
                  productoId={productoId}
                  productoNombre={pInfo?.nombre ?? productoId}
                  productoSKU={pInfo?.sku}
                  productoEmoji={pInfo?.emoji ?? '📦'}
                  procedenciaLabel={`${unidades.length} disponibles`}
                  unidades={unidadesGroup}
                  unidadesIdsSeleccionadas={state.unidadesIdsSeleccionadas}
                  cantidadSeleccionada={cantidadPorProducto.get(productoId) ?? 0}
                  prioritariasCount={0}
                  onToggleUnidad={(uid) => dispatch({ type: 'TOGGLE_UNIDAD', unidadId: uid })}
                  onChangeCantidad={(cantidad) =>
                    dispatch({ type: 'SET_CANTIDAD_PRODUCTO', productoId, cantidad })
                  }
                />
              );
            })}
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
              Caso I solo envía unidades en estado <code>disponible</code> (stock neto).
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
