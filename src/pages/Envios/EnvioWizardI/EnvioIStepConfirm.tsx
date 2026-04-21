/**
 * EnvioIStepConfirm — Paso 4 del Wizard I (Confirmar).
 *
 * Resumen visual (RouteVisual almacén propio → tercero), badge de bloqueo D-10
 * destacado, referencia + tipo relación + KPIs + efectos al confirmar.
 */
import React from 'react';
import { Lock, Building2 } from 'lucide-react';
import { RouteVisual, type RouteNode, type RouteSegment } from '../../../design-system';
import { PAISES_CONFIG } from '../../../types/casilla.types';
import { cn } from '../../../design-system';
import type { EnvioWizardIState, EnvioWizardIAction } from './envioWizardITypes';
import {
  selectUnidadesCount,
  selectProductosCount,
  selectCTRUBaseUSD,
  selectTotalCostosPEN,
  selectTotalCostosUSD,
} from './envioWizardITypes';

export interface EnvioIStepConfirmProps {
  state: EnvioWizardIState;
  dispatch: (action: EnvioWizardIAction) => void;
}

const RELACION_LABEL: Record<string, string> = {
  fulfillment: 'Fulfillment',
  consignacion: 'Consignación',
  distribucion: 'Distribución',
  otro: 'Otro',
};

export const EnvioIStepConfirm: React.FC<EnvioIStepConfirmProps> = ({ state, dispatch }) => {
  const unidadesCount = selectUnidadesCount(state);
  const productosCount = selectProductosCount(state);
  const ctruBaseUSD = selectCTRUBaseUSD(state);
  const totalUSD = selectTotalCostosUSD(state);
  const totalPEN = selectTotalCostosPEN(state);

  const origenFlag = PAISES_CONFIG[state.almacenOrigenPais]?.emoji ?? '🏭';
  const destinoFlag = PAISES_CONFIG[state.almacenTerceroDestinoPais]?.emoji ?? '🌐';
  const paisDistinto = state.almacenOrigenPais !== state.almacenTerceroDestinoPais;

  const nodes: RouteNode[] = [
    {
      tipo: 'almacen',
      flag: origenFlag,
      nombre: state.almacenOrigenNombre || 'Almacén propio',
      subtexto: `${state.almacenOrigenPais || 'Origen'} · Propio`,
      state: 'done',
    },
    {
      tipo: 'destino',
      flag: destinoFlag,
      nombre: state.almacenTerceroDestinoNombre || 'Almacén tercero',
      subtexto: `${state.almacenTerceroDestinoPais || 'Destino'} · Tercero`,
      state: 'done',
    },
  ];
  const segments: RouteSegment[] = [
    {
      label: state.colaboradorTransporteNombre || 'Transportador',
      subtexto: state.colaboradorTransporteId
        ? 'Transporte asignado'
        : 'Sin transportador',
      state: 'done',
      icon: paisDistinto ? '✈️' : '🚚',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Revisa el envío al tercero antes de crearlo
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          Caso I aplica <strong>D-10: bloqueo de stock</strong>. Las unidades no podrán
          venderse desde Perú hasta que regresen o se liquiden en el tercero.
        </p>
      </div>

      {/* RouteVisual */}
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <RouteVisual nodes={nodes} segments={segments} size="lg" />
      </div>

      {/* Banner de bloqueo D-10 */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="flex-1 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-red-700 font-semibold">
            D-10 · Stock bloqueado al confirmar
          </div>
          <div className="text-sm font-semibold text-red-900 mt-0.5">
            {unidadesCount} unidades dejarán de estar disponibles para venta
          </div>
          <div className="text-red-800 mt-1">
            Se marcan con <code className="bg-white px-1 rounded">enAlmacenTerceroFlag=true</code>.
            Solo volverán vendibles si las devuelves a Perú mediante un envío inverso o las
            liquidas en el tercero.
          </div>
        </div>
      </div>

      {/* Tercero destacado */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider text-violet-700 font-semibold">
            Tercero · {RELACION_LABEL[state.tipoRelacion] ?? state.tipoRelacion}
          </div>
          <div className="text-sm font-semibold text-violet-900">
            {state.almacenTerceroDestinoNombre}
          </div>
          <div className="text-xs text-violet-800 mt-1">
            Referencia: <span className="font-mono">{state.referenciaTercero}</span>
          </div>
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
          </p>
        </div>
        <div className="bg-white border border-slate-200 border-l-4 border-l-slate-500 rounded-lg p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Valor inventario
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
            ${ctruBaseUSD.toFixed(0)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">USD · CTRU base bloqueado</p>
        </div>
        <div
          className={cn(
            'border border-l-4 rounded-lg p-4',
            totalUSD + totalPEN > 0
              ? 'bg-teal-50 border-teal-200 border-l-teal-500'
              : 'bg-slate-50 border-slate-200 border-l-slate-300'
          )}
        >
          <p className={cn('text-xs font-medium uppercase tracking-wider', totalUSD + totalPEN > 0 ? 'text-teal-600' : 'text-slate-500')}>
            Costos del envío
          </p>
          <p className={cn('text-lg font-bold tabular-nums mt-1 leading-tight', totalUSD + totalPEN > 0 ? 'text-teal-900' : 'text-slate-400')}>
            {totalUSD > 0 && <>${totalUSD.toFixed(0)}</>}
            {totalUSD > 0 && totalPEN > 0 && <span className="text-slate-400 text-sm mx-1">+</span>}
            {totalPEN > 0 && <>S/ {totalPEN.toFixed(0)}</>}
            {totalUSD + totalPEN === 0 && 'Sin costos'}
          </p>
          <p className={cn('text-xs mt-0.5', totalUSD + totalPEN > 0 ? 'text-teal-700' : 'text-slate-500')}>
            {totalUSD + totalPEN > 0 ? 'Multi-moneda' : 'No capturados'}
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
            Envío <strong>Caso I</strong> en estado{' '}
            <strong>
              <code className="bg-white px-1 rounded">borrador</code>
            </strong>{' '}
            · relación{' '}
            <strong>{RELACION_LABEL[state.tipoRelacion] ?? state.tipoRelacion}</strong>{' '}
            con referencia{' '}
            <strong className="font-mono">{state.referenciaTercero}</strong>
          </li>
          <li className="text-red-800">
            <strong>{unidadesCount} unidades BLOQUEADAS</strong>:{' '}
            <code className="bg-white px-1 rounded">disponible</code> →{' '}
            <code className="bg-white px-1 rounded">asignada_envio</code> + flag{' '}
            <code className="bg-white px-1 rounded">enAlmacenTerceroFlag=true</code>
          </li>
          {(totalUSD > 0 || totalPEN > 0) && (
            <li>
              {state.costos.filter((c) => c.activo).length} costo
              {state.costos.filter((c) => c.activo).length !== 1 ? 's' : ''} landed
              multi-moneda capturados
            </li>
          )}
          <li>
            Al despachar: unidades pasan a{' '}
            <code className="bg-white px-1 rounded">en_transito</code>
          </li>
          <li>
            Al llegar al tercero: permanecen bloqueadas hasta venta liquidada o retorno
          </li>
        </ul>
      </div>

      {/* Notas */}
      <div>
        <label className="text-xs font-medium text-slate-700 block mb-1.5">
          Notas del envío <span className="text-slate-400">(opcional)</span>
        </label>
        <textarea
          value={state.notas}
          onChange={(e) => dispatch({ type: 'SET_NOTAS', notas: e.target.value })}
          rows={2}
          placeholder="Ej. Primera remesa Q2 2026, FBA plan check-in 15-abr, etc."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>
    </div>
  );
};
