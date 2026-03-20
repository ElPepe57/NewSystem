import React, { useMemo, useCallback } from 'react';
import {
  CheckCircle2, XCircle, Loader2, Package, MapPin, Building2,
  ShoppingCart, AlertCircle,
} from 'lucide-react';
import { Button } from '../../../common/Button';
import { OrdenCompraService } from '../../../../services/ordenCompra.service';
import { useAuthStore } from '../../../../store/authStore';
import { calcGroupTotals, calcGrandTotals, groupToFormData, formatUSD, formatPEN, formatProductSubtitle } from './ocBuilderUtils';
import type { OCBuilderState, OCBuilderAction, OCDraftGroup, GroupColor } from './ocBuilderTypes';

interface Props {
  state: OCBuilderState;
  dispatch: React.Dispatch<OCBuilderAction>;
  onComplete: (ordenesCreadas: Array<{ id: string; numeroOrden: string; groupName: string }>) => void;
}

const colorBg: Record<GroupColor, string> = {
  blue: 'bg-blue-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', purple: 'bg-purple-500',
  rose: 'bg-rose-500', cyan: 'bg-cyan-500', orange: 'bg-orange-500', indigo: 'bg-indigo-500',
};
const colorBorder: Record<GroupColor, string> = {
  blue: 'border-blue-400', emerald: 'border-emerald-400', amber: 'border-amber-400', purple: 'border-purple-400',
  rose: 'border-rose-400', cyan: 'border-cyan-400', orange: 'border-orange-400', indigo: 'border-indigo-400',
};
const colorHeaderBg: Record<GroupColor, string> = {
  blue: 'bg-blue-50', emerald: 'bg-emerald-50', amber: 'bg-amber-50', purple: 'bg-purple-50',
  rose: 'bg-rose-50', cyan: 'bg-cyan-50', orange: 'bg-orange-50', indigo: 'bg-indigo-50',
};

const SummaryCard: React.FC<{ group: OCDraftGroup; state: OCBuilderState }> = ({ group, state }) => {
  const totals = calcGroupTotals(group);
  const tc = state.tcMode === 'global' ? state.tcGlobal : group.tcCompra;

  // Check if this OC was already created
  const created = state.createdOCs.find(oc => oc.groupName === group.nombre);
  const error = state.creationErrors.find(e => e.groupId === group.id);

  return (
    <div className={`rounded-lg border-l-4 ${colorBorder[group.color]} border border-gray-200 bg-white overflow-hidden ${
      created ? 'ring-2 ring-green-300' : error ? 'ring-2 ring-red-300' : ''
    }`}>
      {/* Header */}
      <div className={`px-4 py-3 ${colorHeaderBg[group.color]} flex items-center gap-2`}>
        <div className={`w-3 h-3 rounded-full ${colorBg[group.color]}`} />
        <h4 className="font-semibold text-gray-900 flex-1">{group.nombre}</h4>
        {created && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        {error && <XCircle className="h-5 w-5 text-red-500" />}
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Provider & Destination */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Building2 className="h-4 w-4 text-gray-400" />
            <span className="truncate">{group.proveedor?.nombre || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span className="truncate">{group.almacenDestino?.nombre || '—'}</span>
          </div>
        </div>

        {/* Products */}
        <div className="space-y-1">
          {group.productos.map(p => {
            const subtitle = formatProductSubtitle(p);
            return (
              <div key={p.productoId} className="flex items-start justify-between text-xs text-gray-600 py-0.5">
                <div className="truncate flex-1 mr-2">
                  <span>{p.marca} - {p.nombreComercial}</span>
                  {subtitle && <div className="text-[10px] text-gray-400">{subtitle}</div>}
                </div>
                <span className="text-gray-400 mr-2 flex-shrink-0">{p.cantidad}ud</span>
                <span className="font-medium flex-shrink-0">{formatUSD(p.cantidad * p.costoUnitarioUSD)}</span>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="border-t pt-2 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>{formatUSD(totals.subtotalUSD)}</span>
          </div>
          {totals.impuestoUSD > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Tax</span>
              <span>+{formatUSD(totals.impuestoUSD)}</span>
            </div>
          )}
          {totals.gastosEnvioUSD > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Envío</span>
              <span>+{formatUSD(totals.gastosEnvioUSD)}</span>
            </div>
          )}
          {totals.descuentoUSD > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Descuento</span>
              <span>-{formatUSD(totals.descuentoUSD)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-gray-900 border-t pt-1">
            <span>Total</span>
            <span>{formatUSD(totals.totalUSD)}</span>
          </div>
          {tc > 0 && (
            <div className="flex justify-between text-xs text-gray-400">
              <span>PEN (TC {tc.toFixed(3)})</span>
              <span>{formatPEN(totals.totalPEN)}</span>
            </div>
          )}
        </div>

        {/* Created OC number */}
        {created && (
          <div className="bg-green-50 text-green-700 text-xs px-3 py-2 rounded-lg font-medium">
            Creada: {created.numeroOrden}
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg">
            Error: {error.error}
          </div>
        )}
      </div>
    </div>
  );
};

export const OCBuilderStep3: React.FC<Props> = ({ state, dispatch, onComplete }) => {
  const { user } = useAuthStore();
  const grandTotals = useMemo(() => calcGrandTotals(state.groups), [state.groups]);

  const handleCreateAll = useCallback(async () => {
    if (!user?.uid) return;
    dispatch({ type: 'START_CREATION' });

    const total = state.groups.length;

    for (let i = 0; i < state.groups.length; i++) {
      const group = state.groups[i];
      dispatch({
        type: 'CREATION_PROGRESS',
        payload: { completed: i, total, currentName: group.nombre },
      });

      try {
        const formData = groupToFormData(group, state.requerimientos, state.tcMode, state.tcGlobal);
        const result = await OrdenCompraService.create(formData, user.uid);
        dispatch({
          type: 'CREATION_SUCCESS',
          payload: { id: result.id, numeroOrden: result.numeroOrden, groupName: group.nombre },
        });
      } catch (err: any) {
        dispatch({
          type: 'CREATION_ERROR',
          payload: { groupId: group.id, groupName: group.nombre, error: err?.message || 'Error desconocido' },
        });
      }
    }

    dispatch({ type: 'CREATION_COMPLETE' });
  }, [state.groups, state.requerimientos, state.tcMode, state.tcGlobal, user, dispatch]);

  const isComplete = !state.isCreating && state.createdOCs.length > 0;
  const hasErrors = state.creationErrors.length > 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">
          {isComplete ? 'OCs Creadas' : 'Revisar antes de crear'}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {isComplete
            ? `${state.createdOCs.length} de ${state.groups.length} OC(s) creadas correctamente`
            : `Se crearán ${state.groups.length} orden(es) de compra`
          }
        </p>
      </div>

      {/* Cards grid */}
      <div className={`grid gap-4 ${
        state.groups.length === 1 ? 'max-w-lg mx-auto' :
        state.groups.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto' :
        'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      }`}>
        {state.groups.map(g => (
          <SummaryCard key={g.id} group={g} state={state} />
        ))}
      </div>

      {/* Grand total + action */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 mt-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-5xl mx-auto">
          {/* Totals summary */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">{state.groups.length} OC(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">{grandTotals.cantidadProductos} productos, {grandTotals.cantidadUnidades} uds</span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-gray-900">{formatUSD(grandTotals.totalUSD)}</div>
              {state.tcGlobal > 0 && (
                <div className="text-xs text-gray-400">{formatPEN(grandTotals.totalPEN)}</div>
              )}
            </div>
          </div>

          {/* Action button */}
          {!isComplete ? (
            <Button
              variant="primary"
              size="lg"
              onClick={handleCreateAll}
              disabled={state.isCreating}
            >
              {state.isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando {state.creationProgress?.completed ?? 0}/{state.creationProgress?.total ?? 0}...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Crear {state.groups.length} OC{state.groups.length > 1 ? 's' : ''}
                </>
              )}
            </Button>
          ) : (
            <Button
              variant={hasErrors ? 'warning' : 'success'}
              size="lg"
              onClick={() => onComplete(state.createdOCs)}
            >
              {hasErrors ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Cerrar ({state.createdOCs.length} creadas, {state.creationErrors.length} error{state.creationErrors.length > 1 ? 'es' : ''})
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Listo
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
