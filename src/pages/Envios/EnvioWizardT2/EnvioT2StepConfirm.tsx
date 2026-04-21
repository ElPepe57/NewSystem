/**
 * EnvioT2StepConfirm — Paso 5 del Wizard T2 (Confirmar).
 *
 * Muestra el resumen visual grande + los efectos que se producirán al crear
 * el envío. El usuario tiene 2 acciones finales:
 *   - "Guardar como borrador" (mantiene estado `borrador`, no despacha)
 *   - "Crear y despachar" (crea envío y transita a `confirmado`)
 *
 * Nota: este componente SOLO muestra el resumen. Los botones viven en el
 * WizardShell (footer). Aquí solo decoramos el contenido del paso.
 */
import React from 'react';
import { RouteVisual, type RouteNode, type RouteSegment } from '../../../design-system';
import {
  selectCTRUBaseUSD,
  selectMontoTotalFlete,
  selectTotalCostosAdicionales,
  selectUnidadesCount,
  selectProductosCount,
  selectOCsCount,
  selectPrioritariasIncluidas,
} from './envioWizardT2Types';
import type { EnvioWizardT2State, EnvioWizardT2Action } from './envioWizardT2Types';
import { cn } from '../../../design-system';

export interface EnvioT2StepConfirmProps {
  state: EnvioWizardT2State;
  dispatch: (action: EnvioWizardT2Action) => void;
}

const FLAG_MAP: Record<string, string> = {
  USA: '🇺🇸',
  Peru: '🇵🇪',
  Peru_local: '🇵🇪',
  China: '🇨🇳',
  Corea: '🇰🇷',
};

export const EnvioT2StepConfirm: React.FC<EnvioT2StepConfirmProps> = ({ state, dispatch }) => {
  const unidadesCount = selectUnidadesCount(state);
  const productosCount = selectProductosCount(state);
  const ocsCount = selectOCsCount(state);
  const prioritariasIncluidas = selectPrioritariasIncluidas(state);
  const ctruBaseUSD = selectCTRUBaseUSD(state);
  const fleteUSD = selectMontoTotalFlete(state);
  const costosAdicionales = selectTotalCostosAdicionales(state);
  const landedUSD = fleteUSD + costosAdicionales;
  const totalUSD = ctruBaseUSD + landedUSD;
  const totalPEN = state.tipoCambio > 0 ? totalUSD * state.tipoCambio : 0;

  // Nodos de RouteVisual
  const origenFlag = FLAG_MAP[state.casillaOrigenPais] || '🌎';
  const destinoFlag = '🇵🇪';
  const nodes: RouteNode[] = [
    {
      tipo: 'casilla',
      flag: origenFlag,
      nombre: state.casillaOrigenNombre || 'Casilla origen',
      subtexto: state.casillaOrigenPais,
      state: 'done',
    },
    {
      tipo: 'almacen',
      flag: destinoFlag,
      nombre: state.almacenDestinoNombre || 'Almacén destino',
      subtexto: 'Perú',
      state: 'done',
    },
  ];
  const segments: RouteSegment[] = [
    {
      label: state.colaboradorNombre || 'Transporte',
      subtexto:
        state.tipoTransporte === 'viajero'
          ? 'Viajero personal'
          : state.tipoTransporte === 'courier'
          ? 'Courier internacional'
          : undefined,
      state: 'done',
      icon: state.tipoTransporte === 'viajero' ? '✈️' : '📦',
    },
  ];

  // Responsable default de reclamos (D-11)
  const responsableLabel =
    state.tipoTransporte === 'viajero'
      ? `Viajero (${state.colaboradorNombre || 'sin asignar'})`
      : state.tipoTransporte === 'courier'
      ? `Courier (${state.colaboradorNombre || 'sin asignar'})`
      : 'Sin asignar';

  return (
    <div className="space-y-5">
      {/* Título */}
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Revisa los detalles antes de crear el envío
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Al crear el envío se registran las unidades, se abre la CxP del transporte y queda
          listo para despachar.
        </p>
      </div>

      {/* RouteVisual grande */}
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <RouteVisual nodes={nodes} segments={segments} size="lg" />
      </div>

      {/* KPIs 3 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 border-l-4 border-l-slate-500 rounded-lg p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Contenido</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
            {unidadesCount} uds
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {productosCount} producto{productosCount !== 1 ? 's' : ''} · {ocsCount} OC
            {ocsCount !== 1 ? 's' : ''}
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
            Valor de productos
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
            ${ctruBaseUSD.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">CTRU base total</p>
        </div>
        <div
          className={cn(
            'border border-l-4 rounded-lg p-4',
            landedUSD > 0
              ? 'bg-teal-50 border-teal-200 border-l-teal-500'
              : 'bg-slate-50 border-slate-200 border-l-slate-300'
          )}
        >
          <p
            className={cn(
              'text-xs font-medium uppercase tracking-wider',
              landedUSD > 0 ? 'text-teal-600' : 'text-slate-500'
            )}
          >
            Costos landed
          </p>
          <p
            className={cn(
              'text-2xl font-bold tabular-nums mt-1',
              landedUSD > 0 ? 'text-teal-900' : 'text-slate-400'
            )}
          >
            ${landedUSD.toFixed(2)}
          </p>
          <p className={cn('text-xs mt-0.5', landedUSD > 0 ? 'text-teal-700' : 'text-slate-500')}>
            {landedUSD > 0 ? (
              <>
                Flete ${fleteUSD.toFixed(0)}
                {costosAdicionales > 0 && ` + Adicionales $${costosAdicionales.toFixed(0)}`}
              </>
            ) : (
              'Sin costos definidos (se agregan luego)'
            )}
          </p>
        </div>
      </div>

      {/* Efectos al confirmar */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg" aria-hidden>✨</span>
          <div className="text-sm font-semibold text-sky-900">Al confirmar se creará:</div>
        </div>
        <ul className="text-xs text-sky-800 space-y-1.5 pl-7 list-disc">
          <li>
            Envío <strong>tipo C (Casilla → Perú)</strong> en estado{' '}
            <strong>
              <code className="bg-white px-1 rounded">borrador</code>
            </strong>{' '}
            <span className="text-sky-600">(caso manual — editable hasta despachar)</span>
          </li>
          <li>
            {unidadesCount} unidades cambian de estado:{' '}
            <code className="bg-white px-1 rounded">disponible</code> →{' '}
            <code className="bg-white px-1 rounded">asignada_envio</code>
          </li>
          {landedUSD > 0 && (
            <li>
              CxP al colaborador <strong>{state.colaboradorNombre || 'del transporte'}</strong>{' '}
              por <strong className="tabular-nums">${landedUSD.toFixed(2)} USD</strong>
              {state.tipoCambio > 0 && (
                <span className="text-sky-600">
                  {' '}
                  (S/ {(landedUSD * state.tipoCambio).toFixed(2)} PEN al TC {state.tipoCambio})
                </span>
              )}
            </li>
          )}
          <li>
            Al confirmar desde /envios: estado transita{' '}
            <code className="bg-white px-1 rounded">borrador → confirmado</code>
          </li>
          <li>
            Al despachar: unidades pasan a <code className="bg-white px-1 rounded">en_transito</code>
          </li>
          <li>
            Al recibir: CTRU landed se aplica a cada unidad prorrateado
          </li>
        </ul>
      </div>

      {/* Responsable de reclamo */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm">
            🛡️
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900">
              Responsable default de reclamos
            </div>
            <div className="text-xs text-slate-500">
              Puedes cambiar al abrir un reclamo si aplica
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
          {responsableLabel}
        </span>
      </div>

      {/* Notas opcionales */}
      <div>
        <label className="text-xs font-medium text-slate-700 block mb-1.5">
          Notas internas del envío <span className="text-slate-400">(opcional)</span>
        </label>
        <textarea
          value={state.notas}
          onChange={(e) => dispatch({ type: 'SET_NOTAS', notas: e.target.value })}
          rows={2}
          placeholder="Ej. Prioridad alta, verificar fragilidad al empacar, etc."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>

      {/* Total destacado */}
      {totalUSD > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-teal-700 mb-1">
            Gran total del envío
          </div>
          <div className="text-3xl font-bold tabular-nums text-teal-900">
            ${totalUSD.toFixed(2)}
          </div>
          <div className="text-sm text-teal-700 mt-1">
            USD
            {totalPEN > 0 && (
              <>
                {' · '}
                <span className="tabular-nums">S/ {totalPEN.toFixed(2)} PEN</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
