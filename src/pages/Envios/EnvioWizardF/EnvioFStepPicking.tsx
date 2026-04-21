/**
 * EnvioFStepPicking — Paso 2 del Wizard F (Almacén origen + Picking).
 *
 * El usuario elige el almacén Perú desde el que sale el despacho. Al cargar
 * unidades, se pre-seleccionan automáticamente las que tienen reservadaPara
 * === ventaId. Permite ajustar la selección si hace falta.
 */
import React, { useEffect, useMemo } from 'react';
import { Star } from 'lucide-react';
import { useAlmacenStore } from '../../../store/casillaStore';
import { unidadService } from '../../../services/unidad.service';
import { useProductoStore } from '../../../store/productoStore';
import { getEmojiPorProducto } from '../../../components/modules/ordenCompra/OCWizardV3/productoEmoji';
import type { Unidad } from '../../../types/unidad.types';
import type { Casilla } from '../../../types/casilla.types';
import { cn } from '../../../design-system';
import { ProductoPickingGroup, type ProductoPickingGroupUnidad } from '../EnvioWizardT2';
import type { EnvioWizardFState, EnvioWizardFAction } from './envioWizardFTypes';
import { selectUnidadesReservadasVenta } from './envioWizardFTypes';

export interface EnvioFStepPickingProps {
  state: EnvioWizardFState;
  dispatch: (action: EnvioWizardFAction) => void;
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

export const EnvioFStepPicking: React.FC<EnvioFStepPickingProps> = ({ state, dispatch }) => {
  const casillas = useAlmacenStore((s) => s.casillas);
  const fetchCasillas = useAlmacenStore((s) => s.fetchCasillas);
  const productos = useProductoStore((s) => s.productos);

  useEffect(() => {
    if (casillas.length === 0) fetchCasillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo almacenes Perú
  const almacenesPeruActivos = useMemo(
    () =>
      casillas.filter(
        (c) => c.estado === 'activa' && (c.pais === 'Peru' || c.pais === 'Peru_local')
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

  // Agrupar unidades por producto: reservadas-para-esta-venta primero
  const productosConUnidades = useMemo(() => {
    const groups = new Map<string, Unidad[]>();
    for (const u of state.unidadesDisponibles) {
      const existing = groups.get(u.productoId) || [];
      existing.push(u);
      groups.set(u.productoId, existing);
    }
    for (const [key, arr] of groups.entries()) {
      arr.sort((a, b) => {
        const aReserva = a.reservadaPara === state.ventaId ? 2 : a.reservadaPara ? 1 : 0;
        const bReserva = b.reservadaPara === state.ventaId ? 2 : b.reservadaPara ? 1 : 0;
        if (aReserva !== bReserva) return bReserva - aReserva;
        const aFecha = a.fechaRecepcion?.toMillis?.() ?? 0;
        const bFecha = b.fechaRecepcion?.toMillis?.() ?? 0;
        return aFecha - bFecha;
      });
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [state.unidadesDisponibles, state.ventaId]);

  const cantidadPorProducto = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of state.unidadesDisponibles) {
      if (state.unidadesIdsSeleccionadas.includes(u.id)) {
        map.set(u.productoId, (map.get(u.productoId) || 0) + 1);
      }
    }
    return map;
  }, [state.unidadesDisponibles, state.unidadesIdsSeleccionadas]);

  const reservadas = selectUnidadesReservadasVenta(state);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Almacén origen + unidades a despachar
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Las unidades reservadas para esta venta se pre-seleccionan con una estrella ★.
          Puedes ajustar la selección si hay faltantes o reemplazos.
        </p>
      </div>

      {/* Selector almacén origen */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
          Almacén origen
        </label>
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
                    type: 'SET_ALMACEN_ORIGEN',
                    almacenId: c.id,
                    almacenNombre: c.nombre,
                  })
                }
                disabled={sinStock}
                className={cn(
                  'relative rounded-xl p-3 text-left transition-all border',
                  sel
                    ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-100'
                    : sinStock
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-teal-300 cursor-pointer'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🇵🇪</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{c.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {c.unidadesActuales ?? 0} unidades actuales
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Banner de reservadas */}
      {almacenSeleccionado && reservadas.length > 0 && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-3">
          <Star className="w-5 h-5 text-purple-700 fill-purple-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <div className="font-semibold text-purple-900">
              {reservadas.length} unidades ya reservadas para la venta{' '}
              <span className="font-mono">
                {state.ventaSnapshot?.numeroVenta || state.ventaId.slice(0, 8)}
              </span>
            </div>
            <div className="text-purple-800 mt-0.5">
              Pre-seleccionadas automáticamente. Si agregas otras, el sistema actualizará
              la reserva al crear el envío.
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SELECCIONAR_TODAS_RESERVADAS' })}
            className="text-[11px] px-2 py-1 rounded bg-purple-200 text-purple-900 hover:bg-purple-300 font-medium whitespace-nowrap"
          >
            Re-incluir todas
          </button>
        </div>
      )}

      {/* Grupos por producto */}
      {almacenSeleccionado && productosConUnidades.length > 0 && (
        <div className="space-y-3">
          {productosConUnidades.map(([productoId, unidades]) => {
            const pInfo = productoMap.get(productoId);
            const unidadesGroup: ProductoPickingGroupUnidad[] = unidades.map((u) => ({
              unidadId: u.id,
              codigoUnidad: u.id.slice(-6).toUpperCase(),
              reservadaParaLabel:
                u.reservadaPara === state.ventaId
                  ? 'RESERVADA'
                  : u.reservadaPara
                    ? `COT ${u.reservadaPara.slice(0, 8).toUpperCase()}`
                    : null,
              fechaRecepcionLabel: formatFecha(u.fechaRecepcion),
            }));
            const reservadasEnGrupo = unidades.filter(
              (u) => u.reservadaPara === state.ventaId
            ).length;
            return (
              <ProductoPickingGroup
                key={productoId}
                productoId={productoId}
                productoNombre={pInfo?.nombre ?? productoId}
                productoSKU={pInfo?.sku}
                productoEmoji={pInfo?.emoji ?? '📦'}
                procedenciaLabel={
                  reservadasEnGrupo > 0 ? `${reservadasEnGrupo} reservadas` : undefined
                }
                unidades={unidadesGroup}
                unidadesIdsSeleccionadas={state.unidadesIdsSeleccionadas}
                cantidadSeleccionada={cantidadPorProducto.get(productoId) ?? 0}
                prioritariasCount={reservadasEnGrupo}
                onToggleUnidad={(uid) => dispatch({ type: 'TOGGLE_UNIDAD', unidadId: uid })}
                onChangeCantidad={() => {
                  // En Caso F no queremos reset por stepper — dejamos el toggle individual
                  // El stepper no aplica aquí porque las reservas son explícitas por unidad.
                }}
              />
            );
          })}
        </div>
      )}

      {almacenSeleccionado && state.unidadesDisponibles.length === 0 && (
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center">
          <div className="text-sm text-slate-700 font-medium">
            El almacén {almacenSeleccionado.nombre} no tiene unidades disponibles.
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Verifica que la venta esté reservada contra un almacén con stock.
          </div>
        </div>
      )}
    </div>
  );
};
