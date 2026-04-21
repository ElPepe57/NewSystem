/**
 * EnvioGStepConfirm — Paso 3 del Wizard G (Confirmar).
 *
 * Resumen visual cliente → almacén Perú + datos de la devolución + banner
 * D-7 recordando que las unidades quedan en revisión + efectos al confirmar.
 */
import React from 'react';
import { User, Package } from 'lucide-react';
import { RouteVisual, type RouteNode, type RouteSegment } from '../../../design-system';
import { cn } from '../../../design-system';
import type { EnvioWizardGState, EnvioWizardGAction } from './envioWizardGTypes';
import {
  selectUnidadesCount,
  selectProductosCount,
  selectValorDevolucionPEN,
  selectTotalCostosPEN,
} from './envioWizardGTypes';

export interface EnvioGStepConfirmProps {
  state: EnvioWizardGState;
  dispatch: (action: EnvioWizardGAction) => void;
}

export const EnvioGStepConfirm: React.FC<EnvioGStepConfirmProps> = ({ state, dispatch }) => {
  const unidadesCount = selectUnidadesCount(state);
  const productosCount = selectProductosCount(state);
  const valorDev = selectValorDevolucionPEN(state);
  const totalCostos = selectTotalCostosPEN(state);
  const dev = state.devolucionSnapshot;

  const nodes: RouteNode[] = [
    {
      tipo: 'destino',
      flag: '🏠',
      nombre: dev?.clienteNombre || 'Cliente',
      subtexto: 'Devolvedor',
      state: 'done',
    },
    {
      tipo: 'almacen',
      flag: '🇵🇪',
      nombre: state.almacenDestinoNombre || 'Almacén Perú',
      subtexto: 'Recepción + revisión',
      state: 'done',
    },
  ];
  const segments: RouteSegment[] = [
    {
      label: state.colaboradorTransporteNombre || 'Transporte del retorno',
      subtexto: state.colaboradorTransporteId ? 'Transportista asignado' : 'Sin transportista',
      state: 'done',
      icon: '🔄',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Revisa el retorno físico antes de crearlo
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          El envío G quedará vinculado a la devolución{' '}
          <b className="font-mono">{dev?.numeroDevolucion || '—'}</b>. Las unidades
          transitan a estado de revisión.
        </p>
      </div>

      {/* RouteVisual */}
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <RouteVisual nodes={nodes} segments={segments} size="lg" />
      </div>

      {/* Devolución vinculada */}
      {dev && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <div className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">
              Devolución vinculada
            </div>
            <div className="text-sm font-semibold text-amber-900 mt-0.5">
              {dev.numeroDevolucion} · {dev.ventaNumero}
            </div>
            <div className="flex items-center gap-1 text-amber-800 mt-1">
              <User className="w-3 h-3" />
              <span>{dev.clienteNombre}</span>
            </div>
            <div className="text-amber-800 mt-0.5">
              Motivo: <b>{dev.motivo}</b>
              {dev.detalleMotivo && ` · ${dev.detalleMotivo}`}
            </div>
            <div className="text-amber-700 mt-0.5">
              Monto devolución: S/ {dev.montoDevolucion.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {/* Banner D-7 */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-start gap-3">
        <span className="text-xl">🔍</span>
        <div className="flex-1 text-xs text-sky-900">
          <div className="font-semibold">D-7 · Unidades en revisión al recibir</div>
          <div className="opacity-90 mt-0.5">
            El operador deberá decidir por cada unidad si:
            <span className="ml-1 text-emerald-700 font-medium">→ reintegrable (disponible)</span>,
            <span className="ml-1 text-red-700 font-medium">→ merma (danada)</span>, o
            <span className="ml-1 text-amber-700 font-medium">→ materia de reclamo al courier</span>.
          </div>
        </div>
      </div>

      {/* KPIs 3 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 border-l-4 border-l-slate-500 rounded-lg p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Retorno</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
            {unidadesCount} uds
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {productosCount} producto{productosCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-white border border-slate-200 border-l-4 border-l-slate-500 rounded-lg p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Valor devolución
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
            S/ {valorDev.toFixed(0)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">PEN · proporcional a unidades</p>
        </div>
        <div
          className={cn(
            'border border-l-4 rounded-lg p-4',
            totalCostos > 0
              ? 'bg-teal-50 border-teal-200 border-l-teal-500'
              : 'bg-slate-50 border-slate-200 border-l-slate-300'
          )}
        >
          <p className={cn('text-xs font-medium uppercase tracking-wider', totalCostos > 0 ? 'text-teal-600' : 'text-slate-500')}>
            Costos retorno
          </p>
          <p className={cn('text-2xl font-bold tabular-nums mt-1', totalCostos > 0 ? 'text-teal-900' : 'text-slate-400')}>
            S/ {totalCostos.toFixed(0)}
          </p>
          <p className={cn('text-xs mt-0.5', totalCostos > 0 ? 'text-teal-700' : 'text-slate-500')}>
            {totalCostos > 0 ? 'PEN · delivery inverso' : 'Sin costos'}
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
            Envío <strong>Caso G (retorno devolución)</strong> en estado{' '}
            <strong>
              <code className="bg-white px-1 rounded">borrador</code>
            </strong>
          </li>
          <li>
            Vínculo con devolución{' '}
            <strong className="font-mono">{dev?.numeroDevolucion || '—'}</strong> y
            venta <strong className="font-mono">{dev?.ventaNumero || '—'}</strong>
          </li>
          <li>
            {unidadesCount} unidades cambian:{' '}
            <code className="bg-white px-1 rounded">vendida</code> →{' '}
            <code className="bg-white px-1 rounded">asignada_envio</code> (retorno)
          </li>
          {totalCostos > 0 && (
            <li>
              {state.costosPEN.filter((c) => c.activo).length} costo
              {state.costosPEN.filter((c) => c.activo).length !== 1 ? 's' : ''} landed PEN
              por <strong className="tabular-nums">S/ {totalCostos.toFixed(2)}</strong>
            </li>
          )}
          <li>
            Al recibir físicamente: unidades quedan{' '}
            <strong>pendientes de revisión</strong> (D-7). Operador decide integridad.
          </li>
        </ul>
      </div>

      {/* Notas */}
      <div>
        <label className="text-xs font-medium text-slate-700 block mb-1.5">
          Notas del retorno <span className="text-slate-400">(opcional)</span>
        </label>
        <textarea
          value={state.notas}
          onChange={(e) => dispatch({ type: 'SET_NOTAS', notas: e.target.value })}
          rows={2}
          placeholder="Ej. Cliente reporta producto sin abrir, coordinar revisión con calidad, etc."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>
    </div>
  );
};
