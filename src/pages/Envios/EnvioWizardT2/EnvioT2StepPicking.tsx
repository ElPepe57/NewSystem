/**
 * EnvioT2StepPicking — Paso 2 del Wizard T2 (Picking).
 *
 * Permite seleccionar las unidades disponibles en la casilla origen para
 * incluir en este envío. Implementa D-2 híbrido:
 *   - Por producto: stepper +/- (aplica FIFO priorizado)
 *   - Expansión por producto: checkbox individual por unidad
 *
 * Incluye BannerPriorizacion (D-5/D-14) que destaca las unidades con
 * `reservadaPara` y ofrece incluirlas automáticamente.
 */
import React, { useMemo } from 'react';
import { useProductoStore } from '../../../store/productoStore';
import { getEmojiPorProducto } from '../../../components/modules/ordenCompra/OCWizardV3/productoEmoji';
import type { Unidad } from '../../../types/unidad.types';
import { BannerPriorizacion } from './BannerPriorizacion';
import { ProductoPickingGroup, type ProductoPickingGroupUnidad } from './ProductoPickingGroup';
import {
  selectPrioritariasDisponibles,
  selectPrioritariasIncluidas,
} from './envioWizardT2Types';
import type { EnvioWizardT2State, EnvioWizardT2Action } from './envioWizardT2Types';
import { cn } from '../../../design-system';

export interface EnvioT2StepPickingProps {
  state: EnvioWizardT2State;
  dispatch: (action: EnvioWizardT2Action) => void;
}

const formatFecha = (ts: any): string => {
  if (!ts) return '';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][
      date.getMonth()
    ];
    return `${dd}-${mm}`;
  } catch {
    return '';
  }
};

export const EnvioT2StepPicking: React.FC<EnvioT2StepPickingProps> = ({ state, dispatch }) => {
  const productos = useProductoStore((s) => s.productos);

  // Mapeo productoId → (Producto, emoji) para headers del grupo
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

  // Agrupar unidades disponibles por productoId
  const productosConUnidades = useMemo(() => {
    const groups = new Map<string, Unidad[]>();
    for (const u of state.unidadesDisponibles) {
      const existing = groups.get(u.productoId) || [];
      existing.push(u);
      groups.set(u.productoId, existing);
    }
    // Ordenar cada grupo: prioritarias primero, luego FIFO por fechaRecepcion
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

  // Derivar cantidad seleccionada por producto
  const cantidadPorProducto = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of state.unidadesDisponibles) {
      if (state.unidadesIdsSeleccionadas.includes(u.id)) {
        map.set(u.productoId, (map.get(u.productoId) || 0) + 1);
      }
    }
    return map;
  }, [state.unidadesDisponibles, state.unidadesIdsSeleccionadas]);

  // Lista de cotizaciones únicas en las pre-vendidas (para banner)
  const prevendidas = useMemo(() => selectPrioritariasDisponibles(state), [state]);
  const cotizacionesIds = useMemo(() => {
    const ids = new Set<string>();
    for (const u of prevendidas) {
      if (u.reservadaPara) ids.add(u.reservadaPara);
    }
    return Array.from(ids).slice(0, 5); // máx 5 para no saturar el banner
  }, [prevendidas]);

  // Contadores para footer
  const total = state.unidadesIdsSeleccionadas.length;
  const productosSeleccionados = new Set(
    state.unidadesDisponibles
      .filter((u) => state.unidadesIdsSeleccionadas.includes(u.id))
      .map((u) => u.productoId)
  ).size;
  const prioritariasIncluidas = selectPrioritariasIncluidas(state);
  const prioritariasTotales = prevendidas.length;
  const prioritariasPendientes = prioritariasTotales - prioritariasIncluidas;

  if (state.unidadesDisponibles.length === 0) {
    return (
      <div className="p-8 bg-amber-50 border border-amber-200 rounded-xl text-center">
        <div className="text-sm font-medium text-amber-900">
          No hay unidades disponibles en esta casilla
        </div>
        <div className="text-xs text-amber-700 mt-1">
          {state.casillaOrigenNombre ? (
            <>La casilla <strong>{state.casillaOrigenNombre}</strong> no tiene unidades listas para enviar.</>
          ) : (
            'Regresa al Paso 1 y selecciona una casilla de origen.'
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Título */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Selecciona las unidades a enviar
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          La casilla <strong>{state.casillaOrigenNombre}</strong> tiene <strong>{state.unidadesDisponibles.length} unidades disponibles</strong>.
          Usa los steppers por producto o expande cada uno para control individual por unidad.
        </p>
      </div>

      {/* Banner priorización */}
      <BannerPriorizacion
        cantidadPrevendidas={prioritariasTotales}
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
          const info = productoMap.get(productoId);
          const prioritariasDelProducto = unidades.filter((u) => !!u.reservadaPara).length;
          const procedenciaOCs = Array.from(
            new Set(unidades.map((u) => u.ordenCompraNumero).filter(Boolean))
          ).join(', ');

          const unidadesProps: ProductoPickingGroupUnidad[] = unidades.map((u) => ({
            unidadId: u.id,
            codigoUnidad: u.id.slice(-6).toUpperCase(),
            reservadaParaLabel: u.reservadaPara
              ? u.reservadaPara.slice(0, 8).toUpperCase()
              : null,
            fechaRecepcionLabel: u.fechaRecepcion ? `Recibida ${formatFecha(u.fechaRecepcion)}` : undefined,
            extraRightLabel: u.ordenCompraNumero
              ? u.ordenCompraNumero
              : undefined,
          }));

          return (
            <ProductoPickingGroup
              key={productoId}
              productoId={productoId}
              productoNombre={info?.nombre || `Producto ${productoId.slice(0, 6)}`}
              productoSKU={info?.sku}
              productoEmoji={info?.emoji}
              procedenciaLabel={procedenciaOCs || undefined}
              unidades={unidadesProps}
              unidadesIdsSeleccionadas={state.unidadesIdsSeleccionadas}
              cantidadSeleccionada={cantidadPorProducto.get(productoId) || 0}
              prioritariasCount={prioritariasDelProducto}
              onToggleUnidad={(unidadId) =>
                dispatch({ type: 'TOGGLE_UNIDAD', unidadId })
              }
              onChangeCantidad={(cantidad) =>
                dispatch({ type: 'SET_CANTIDAD_PRODUCTO', productoId, cantidad })
              }
            />
          );
        })}
      </div>

      {/* Resumen inferior */}
      <div
        className={cn(
          'p-4 border rounded-xl flex items-center justify-between flex-wrap gap-3',
          total > 0 ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'
        )}
      >
        <div>
          <div className={cn('text-sm font-semibold', total > 0 ? 'text-teal-900' : 'text-slate-700')}>
            <span className="tabular-nums">{total}</span> unidad{total !== 1 ? 'es' : ''} seleccionada{total !== 1 ? 's' : ''}
          </div>
          <div className={cn('text-xs mt-0.5', total > 0 ? 'text-teal-700' : 'text-slate-500')}>
            {productosSeleccionados} producto{productosSeleccionados !== 1 ? 's' : ''}
            {prioritariasTotales > 0 && (
              <>
                {' · '}
                <strong>
                  {prioritariasIncluidas} de {prioritariasTotales} prioritarias incluidas
                </strong>
                {prioritariasIncluidas === prioritariasTotales && ' ✓'}
              </>
            )}
          </div>
        </div>
        {prioritariasPendientes > 0 && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'APLICAR_PRIORITARIAS' })}
            className="text-xs px-3 py-1.5 bg-white border border-teal-300 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors font-medium"
          >
            🎯 Agregar las {prioritariasPendientes} restante{prioritariasPendientes !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
};
