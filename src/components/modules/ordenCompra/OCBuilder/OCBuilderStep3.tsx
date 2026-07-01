import React, { useMemo, useCallback } from 'react';
import {
  CheckCircle2, XCircle, Loader2, Package, MapPin, Building2,
  ShoppingCart, AlertCircle, RefreshCw,
} from 'lucide-react';
import { Button } from '../../../common/Button';
import { OrdenCompraService } from '../../../../services/ordenCompra.service';
import { useAuthStore } from '../../../../store/authStore';
import { useProductoStore } from '../../../../store/productoStore';
import { useOrdenCompraStore } from '../../../../store/ordenCompraStore';
import { calcGroupTotals, calcGrandTotals, groupToFormData, analizarGrupoParaSnapshot, formatUSD, formatPEN, formatProductSubtitle } from './ocBuilderUtils';
import type { OCBuilderState, OCBuilderAction, OCDraftGroup } from './ocBuilderTypes';
import { GroupBadge } from './OCBuilderGroupBadge';

interface Props {
  state: OCBuilderState;
  dispatch: React.Dispatch<OCBuilderAction>;
  onComplete: (ordenesCreadas: Array<{ id: string; numeroOrden: string; groupName: string }>) => void;
}

const SummaryCard: React.FC<{ group: OCDraftGroup; numero: number; state: OCBuilderState }> = ({ group, numero, state }) => {
  const totals = calcGroupTotals(group);
  const tc = state.tcMode === 'global' ? state.tcGlobal : group.tcCompra;

  // Check if this OC was already created (por groupId · robusto ante nombres repetidos)
  const created = state.createdOCs.find(oc => oc.groupId === group.id);
  const error = state.creationErrors.find(e => e.groupId === group.id);

  return (
    <div className={`rounded-lg border-l-4 border-blue-400 border border-slate-200 bg-white overflow-hidden ${
      created ? 'ring-2 ring-emerald-300' : error ? 'ring-2 ring-red-300' : ''
    }`}>
      {/* Header */}
      <div className="px-4 py-3 bg-blue-50 flex items-center gap-2">
        <GroupBadge numero={numero} />
        <h4 className="font-semibold text-slate-900 flex-1">{group.nombre}</h4>
        {created && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        {error && <XCircle className="h-5 w-5 text-red-500" />}
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Provider & Destination */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Building2 className="h-4 w-4 text-slate-400" />
            <span className="truncate">{group.proveedor?.nombre || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="truncate">{group.almacenDestino?.nombre || '—'}</span>
          </div>
        </div>

        {/* Products */}
        <div className="space-y-1">
          {group.productos.map(p => {
            const subtitle = formatProductSubtitle(p);
            return (
              <div key={p.productoId} className="flex items-start justify-between text-xs text-slate-600 py-0.5">
                <div className="truncate flex-1 mr-2">
                  <span>{p.marca} - {p.nombreComercial}</span>
                  {subtitle && <div className="text-[10px] text-slate-400">{subtitle}</div>}
                </div>
                <span className="text-slate-400 mr-2 flex-shrink-0">{p.cantidad}ud</span>
                <span className="font-medium flex-shrink-0">{formatUSD(p.cantidad * p.costoUnitarioUSD)}</span>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="border-t pt-2 space-y-1 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span>{formatUSD(totals.subtotalUSD)}</span>
          </div>
          {totals.impuestoUSD > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Tax</span>
              <span>+{formatUSD(totals.impuestoUSD)}</span>
            </div>
          )}
          {totals.costoEnvioProveedorUSD > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Envío</span>
              <span>+{formatUSD(totals.costoEnvioProveedorUSD)}</span>
            </div>
          )}
          {totals.descuentoUSD > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Descuento</span>
              <span>-{formatUSD(totals.descuentoUSD)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-slate-900 border-t pt-1">
            <span>Total</span>
            <span>{formatUSD(totals.totalUSD)}</span>
          </div>
          {tc > 0 && (
            <div className="flex justify-between text-xs text-slate-400">
              <span>PEN (TC {tc.toFixed(3)})</span>
              <span>{formatPEN(totals.totalPEN)}</span>
            </div>
          )}
        </div>

        {/* Created OC number */}
        {created && (
          <div className="bg-emerald-50 text-emerald-700 text-xs px-3 py-2 rounded-lg font-medium">
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
  // Lente 2 · catálogo + histórico para congelar el forecast por producto al crear.
  const catalogo = useProductoStore((s) => s.productos);
  const ordenes = useOrdenCompraStore((s) => s.ordenes);
  const grandTotals = useMemo(() => calcGrandTotals(state.groups), [state.groups]);

  const handleCreateAll = useCallback(async () => {
    if (!user?.uid) return;
    dispatch({ type: 'START_CREATION' });

    // Retry idempotente: saltar los grupos cuya OC YA fue creada (por groupId).
    // En el primer run createdOCs viene vacío → se crean todos. En un reintento de
    // fallidas, solo se procesan los grupos sin OC creada (evita drafts duplicados).
    const yaCreados = new Set(state.createdOCs.map(oc => oc.groupId));
    const gruposACrear = state.groups.filter(g => !yaCreados.has(g.id));
    const total = gruposACrear.length;

    for (let i = 0; i < gruposACrear.length; i++) {
      const group = gruposACrear[i];
      dispatch({
        type: 'CREATION_PROGRESS',
        payload: { completed: i, total, currentName: group.nombre },
      });

      try {
        const formData = groupToFormData(group, state.requerimientos, state.tcMode, state.tcGlobal);
        // Lente 2 · congelar el forecast por producto (opcional · si falla, la OC se crea igual).
        try {
          const tcGrupo = state.tcMode === 'global' ? state.tcGlobal : group.tcCompra;
          const snaps = analizarGrupoParaSnapshot(group, tcGrupo, catalogo, ordenes);
          formData.productos = formData.productos.map((fp) =>
            snaps.has(fp.productoId) ? { ...fp, forecastSnapshot: snaps.get(fp.productoId) } : fp
          );
        } catch { /* snapshot es retrospectivo · no bloquea la creación de la OC */ }
        const result = await OrdenCompraService.create(formData, user.uid);
        dispatch({
          type: 'CREATION_SUCCESS',
          payload: { id: result.id, numeroOrden: result.numeroOrden, groupName: group.nombre, groupId: group.id },
        });
      } catch (err: any) {
        dispatch({
          type: 'CREATION_ERROR',
          payload: { groupId: group.id, groupName: group.nombre, error: err?.message || 'Error desconocido' },
        });
      }
    }

    dispatch({ type: 'CREATION_COMPLETE' });
  }, [state.groups, state.createdOCs, state.requerimientos, state.tcMode, state.tcGlobal, catalogo, ordenes, user, dispatch]);

  const isComplete = !state.isCreating && state.createdOCs.length > 0;
  const hasErrors = state.creationErrors.length > 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-900">
          {isComplete ? 'OCs Creadas' : 'Revisar antes de crear'}
        </h3>
        <p className="text-sm text-slate-500 mt-1">
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
        {state.groups.map((g, idx) => (
          <SummaryCard key={g.id} group={g} numero={idx + 1} state={state} />
        ))}
      </div>

      {/* Grand total + action */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 mt-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-5xl mx-auto">
          {/* Totals summary */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600">{state.groups.length} OC(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600">{grandTotals.cantidadProductos} productos, {grandTotals.cantidadUnidades} uds</span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-slate-900">{formatUSD(grandTotals.totalUSD)}</div>
              {state.tcGlobal > 0 && (
                <div className="text-xs text-slate-400">{formatPEN(grandTotals.totalPEN)}</div>
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
          ) : hasErrors ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                variant="primary"
                size="lg"
                onClick={handleCreateAll}
                disabled={state.isCreating}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar {state.creationErrors.length} fallida{state.creationErrors.length > 1 ? 's' : ''}
              </Button>
              <Button
                variant="warning"
                size="lg"
                onClick={() => onComplete(state.createdOCs)}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Cerrar ({state.createdOCs.length} creada{state.createdOCs.length > 1 ? 's' : ''})
              </Button>
            </div>
          ) : (
            <Button
              variant="success"
              size="lg"
              onClick={() => onComplete(state.createdOCs)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Listo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
