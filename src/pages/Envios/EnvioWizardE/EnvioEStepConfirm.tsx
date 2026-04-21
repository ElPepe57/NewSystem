/**
 * EnvioEStepConfirm — Paso 4 del Wizard E (Confirmar).
 *
 * Resumen visual grande (RouteVisual entre dos almacenes Perú) + KPIs +
 * efectos al confirmar. Destaca el motivo del traslado y los costos PEN.
 */
import React from 'react';
import { RouteVisual, type RouteNode, type RouteSegment } from '../../../design-system';
import { cn } from '../../../design-system';
import type { EnvioWizardEState, EnvioWizardEAction } from './envioWizardETypes';
import {
  selectUnidadesCount,
  selectProductosCount,
  selectPrioritariasIncluidas,
  selectCTRUBaseUSD,
  selectTotalCostosPEN,
} from './envioWizardETypes';

export interface EnvioEStepConfirmProps {
  state: EnvioWizardEState;
  dispatch: (action: EnvioWizardEAction) => void;
}

const MOTIVO_LABEL: Record<string, string> = {
  consolidacion: 'Consolidación',
  capacidad: 'Capacidad',
  viaje_proximo: 'Viaje próximo',
  costo_menor: 'Costo menor',
  otro: 'Otro',
};

export const EnvioEStepConfirm: React.FC<EnvioEStepConfirmProps> = ({ state, dispatch }) => {
  const unidadesCount = selectUnidadesCount(state);
  const productosCount = selectProductosCount(state);
  const prioritariasIncluidas = selectPrioritariasIncluidas(state);
  const ctruBaseUSD = selectCTRUBaseUSD(state);
  const totalCostosPEN = selectTotalCostosPEN(state);

  const nodes: RouteNode[] = [
    {
      tipo: 'almacen',
      flag: '🇵🇪',
      nombre: state.almacenOrigenNombre || 'Almacén origen',
      subtexto: 'Perú',
      state: 'done',
    },
    {
      tipo: 'almacen',
      flag: '🇵🇪',
      nombre: state.almacenDestinoNombre || 'Almacén destino',
      subtexto: 'Perú',
      state: 'done',
    },
  ];
  const segments: RouteSegment[] = [
    {
      label: state.colaboradorTransporteNombre || 'Traslado interno',
      subtexto: state.colaboradorTransporteId ? 'Transportista local' : 'Sin transportista externo',
      state: 'done',
      icon: '🚚',
    },
  ];

  const motivoLabel = state.motivo ? MOTIVO_LABEL[state.motivo] ?? state.motivo : 'Sin motivo';

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Revisa el traslado antes de crearlo
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Al crear se registran las unidades en tránsito interno. Si hay costos PEN se
          abren como costos landed del envío.
        </p>
      </div>

      {/* RouteVisual */}
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <RouteVisual nodes={nodes} segments={segments} size="lg" />
      </div>

      {/* Motivo destacado */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-lg flex-shrink-0">
          🎯
        </div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-violet-700 font-semibold">
            Motivo del traslado
          </div>
          <div className="text-sm font-semibold text-violet-900 mt-0.5">{motivoLabel}</div>
          {state.motivo === 'otro' && state.motivoDetalle && (
            <div className="text-xs text-violet-800 mt-1">{state.motivoDetalle}</div>
          )}
        </div>
      </div>

      {/* KPIs 3 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 border-l-4 border-l-slate-500 rounded-lg p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Contenido</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
            {unidadesCount} uds
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {productosCount} producto{productosCount !== 1 ? 's' : ''}
            {prioritariasIncluidas > 0 && (
              <>
                {' · '}
                <span className="text-emerald-700 font-medium">
                  🎯 {prioritariasIncluidas} pre-vendida{prioritariasIncluidas !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="bg-white border border-slate-200 border-l-4 border-l-slate-500 rounded-lg p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Valor inventario
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
            ${ctruBaseUSD.toFixed(0)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">CTRU base USD (referencia)</p>
        </div>
        <div
          className={cn(
            'border border-l-4 rounded-lg p-4',
            totalCostosPEN > 0
              ? 'bg-teal-50 border-teal-200 border-l-teal-500'
              : 'bg-slate-50 border-slate-200 border-l-slate-300'
          )}
        >
          <p
            className={cn(
              'text-xs font-medium uppercase tracking-wider',
              totalCostosPEN > 0 ? 'text-teal-600' : 'text-slate-500'
            )}
          >
            Costos del traslado
          </p>
          <p
            className={cn(
              'text-2xl font-bold tabular-nums mt-1',
              totalCostosPEN > 0 ? 'text-teal-900' : 'text-slate-400'
            )}
          >
            S/ {totalCostosPEN.toFixed(0)}
          </p>
          <p className={cn('text-xs mt-0.5', totalCostosPEN > 0 ? 'text-teal-700' : 'text-slate-500')}>
            {totalCostosPEN > 0 ? 'PEN · directo sin conversión' : 'Sin costos capturados'}
          </p>
        </div>
      </div>

      {/* Efectos */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">✨</span>
          <div className="text-sm font-semibold text-sky-900">Al confirmar se creará:</div>
        </div>
        <ul className="text-xs text-sky-800 space-y-1.5 pl-7 list-disc">
          <li>
            Envío <strong>Caso E</strong> (traslado interno Perú) en estado{' '}
            <strong>
              <code className="bg-white px-1 rounded">borrador</code>
            </strong>{' '}
            · motivo <strong>{motivoLabel}</strong>
          </li>
          <li>
            {unidadesCount} unidades cambian:{' '}
            <code className="bg-white px-1 rounded">disponible</code> →{' '}
            <code className="bg-white px-1 rounded">asignada_envio</code>
          </li>
          {totalCostosPEN > 0 && (
            <li>
              {state.costosPEN.filter((c) => c.activo).length} costo
              {state.costosPEN.filter((c) => c.activo).length !== 1 ? 's' : ''} landed en PEN por{' '}
              <strong className="tabular-nums">S/ {totalCostosPEN.toFixed(2)}</strong>
            </li>
          )}
          <li>
            Al despachar: unidades pasan a{' '}
            <code className="bg-white px-1 rounded">en_transito</code>
          </li>
          <li>
            Al recibir en <strong>{state.almacenDestinoNombre || 'destino'}</strong>: el stock se
            actualiza en el almacén destino
          </li>
        </ul>
      </div>

      {/* Notas */}
      <div>
        <label className="text-xs font-medium text-slate-700 block mb-1.5">
          Notas internas del traslado <span className="text-slate-400">(opcional)</span>
        </label>
        <textarea
          value={state.notas}
          onChange={(e) => dispatch({ type: 'SET_NOTAS', notas: e.target.value })}
          rows={2}
          placeholder="Ej. Preparar para ruta sur, verificar fragilidad, etc."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>
    </div>
  );
};
