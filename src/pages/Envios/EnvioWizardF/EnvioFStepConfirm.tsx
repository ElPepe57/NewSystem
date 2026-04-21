/**
 * EnvioFStepConfirm — Paso 4 del Wizard F (Confirmar).
 *
 * Resumen visual (RouteVisual almacén Perú → cliente) + datos del cliente
 * desde la venta + KPIs + efectos al confirmar.
 */
import React from 'react';
import { User, MapPin, Phone, Package } from 'lucide-react';
import { RouteVisual, type RouteNode, type RouteSegment } from '../../../design-system';
import { cn } from '../../../design-system';
import type { EnvioWizardFState, EnvioWizardFAction } from './envioWizardFTypes';
import {
  selectUnidadesCount,
  selectProductosCount,
  selectTotalCostosPEN,
  selectValorVentaPEN,
  selectUnidadesReservadasVenta,
} from './envioWizardFTypes';

export interface EnvioFStepConfirmProps {
  state: EnvioWizardFState;
  dispatch: (action: EnvioWizardFAction) => void;
}

export const EnvioFStepConfirm: React.FC<EnvioFStepConfirmProps> = ({ state, dispatch }) => {
  const unidadesCount = selectUnidadesCount(state);
  const productosCount = selectProductosCount(state);
  const totalCostosPEN = selectTotalCostosPEN(state);
  const valorVenta = selectValorVentaPEN(state);
  const reservadasVenta = selectUnidadesReservadasVenta(state).length;
  const reservadasIncluidas = state.unidadesDisponibles.filter(
    (u) => u.reservadaPara === state.ventaId && state.unidadesIdsSeleccionadas.includes(u.id)
  ).length;

  const cliente = state.ventaSnapshot;

  const nodes: RouteNode[] = [
    {
      tipo: 'almacen',
      flag: '🇵🇪',
      nombre: state.almacenOrigenNombre || 'Almacén origen',
      subtexto: 'Perú',
      state: 'done',
    },
    {
      tipo: 'destino',
      flag: '🏠',
      nombre: cliente?.nombreCliente || 'Cliente',
      subtexto: cliente?.distrito || 'Despacho a domicilio',
      state: 'done',
    },
  ];
  const segments: RouteSegment[] = [
    {
      label: state.colaboradorTransporteNombre || 'Delivery',
      subtexto: state.colaboradorTransporteId ? 'Transportista local' : 'Sin transportista asignado',
      state: 'done',
      icon: '🚚',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-900">
          Revisa el despacho antes de crearlo
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          El envío quedará vinculado a la venta <b className="font-mono">{cliente?.numeroVenta || '—'}</b>{' '}
          y las unidades se marcarán para despacho.
        </p>
      </div>

      {/* RouteVisual */}
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <RouteVisual nodes={nodes} segments={segments} size="lg" />
      </div>

      {/* Cliente destacado */}
      {cliente && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs space-y-0.5">
            <div className="text-[10px] uppercase tracking-wider text-rose-700 font-semibold">
              Cliente destinatario (desde la venta)
            </div>
            <div className="text-sm font-semibold text-rose-900">{cliente.nombreCliente}</div>
            {cliente.direccionEntrega && (
              <div className="flex items-start gap-1 text-rose-800">
                <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  {cliente.direccionEntrega}
                  {cliente.distrito && ` · ${cliente.distrito}`}
                </span>
              </div>
            )}
            {cliente.telefonoCliente && (
              <div className="flex items-center gap-1 text-rose-800">
                <Phone className="w-3 h-3" />
                <span>{cliente.telefonoCliente}</span>
              </div>
            )}
            {cliente.referencia && (
              <div className="text-rose-700 italic">Ref: {cliente.referencia}</div>
            )}
          </div>
        </div>
      )}

      {/* KPIs 3 cols */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 border-l-4 border-l-slate-500 rounded-lg p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Contenido</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
            {unidadesCount} uds
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {productosCount} producto{productosCount !== 1 ? 's' : ''}
            {reservadasIncluidas > 0 && (
              <>
                {' · '}
                <span className="text-purple-700 font-medium">
                  ★ {reservadasIncluidas}/{reservadasVenta} reservadas
                </span>
              </>
            )}
          </p>
        </div>
        <div className="bg-white border border-slate-200 border-l-4 border-l-slate-500 rounded-lg p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Valor de la venta
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
            S/ {valorVenta.toFixed(0)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">PEN · total cobrado al cliente</p>
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
            Costos del despacho
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
            {totalCostosPEN > 0 ? 'PEN · delivery / costos locales' : 'Sin costos capturados'}
          </p>
        </div>
      </div>

      {/* Efectos */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-4 h-4 text-sky-700" />
          <div className="text-sm font-semibold text-sky-900">Al confirmar se creará:</div>
        </div>
        <ul className="text-xs text-sky-800 space-y-1.5 pl-7 list-disc">
          <li>
            Envío <strong>Caso F (despacho venta)</strong> en estado{' '}
            <strong>
              <code className="bg-white px-1 rounded">borrador</code>
            </strong>
          </li>
          <li>
            Vínculo con venta{' '}
            <strong className="font-mono">{cliente?.numeroVenta || state.ventaId.slice(0, 8)}</strong>{' '}
            (cliente <strong>{cliente?.nombreCliente}</strong>)
          </li>
          <li>
            {unidadesCount} unidades cambian:{' '}
            <code className="bg-white px-1 rounded">disponible/reservada</code> →{' '}
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
            Al entregar: la venta transita a <code className="bg-white px-1 rounded">despachada</code>{' '}
            o <code className="bg-white px-1 rounded">entregada</code> automáticamente
          </li>
        </ul>
      </div>

      {/* Notas */}
      <div>
        <label className="text-xs font-medium text-slate-700 block mb-1.5">
          Notas del despacho <span className="text-slate-400">(opcional)</span>
        </label>
        <textarea
          value={state.notas}
          onChange={(e) => dispatch({ type: 'SET_NOTAS', notas: e.target.value })}
          rows={2}
          placeholder="Ej. Entrega en horario de oficina, llamar antes de llegar, etc."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>
    </div>
  );
};
