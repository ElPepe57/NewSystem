import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronUp, DollarSign, Truck, FileText, Globe,
  Tag, Percent, BadgeDollarSign, Receipt,
} from 'lucide-react';
import { Input } from '../../../common/Input';
import { ProveedorAutocomplete } from '../../entidades/ProveedorAutocomplete';
import { AlmacenAutocomplete } from '../../entidades/AlmacenAutocomplete';
import { calcGroupTotals, validateStep2, formatUSD, formatPEN, formatProductSubtitle } from './ocBuilderUtils';
import type { OCBuilderState, OCBuilderAction, OCDraftGroup, GroupColor } from './ocBuilderTypes';

interface Props {
  state: OCBuilderState;
  dispatch: React.Dispatch<OCBuilderAction>;
}

const colorBg: Record<GroupColor, string> = {
  blue: 'bg-blue-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', purple: 'bg-purple-500',
  rose: 'bg-rose-500', cyan: 'bg-cyan-500', orange: 'bg-orange-500', indigo: 'bg-indigo-500',
};
const colorLight: Record<GroupColor, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200', emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200', purple: 'bg-purple-50 text-purple-700 border-purple-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200', cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200', indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const GroupTab: React.FC<{
  group: OCDraftGroup;
  active: boolean;
  onClick: () => void;
}> = ({ group, active, onClick }) => {
  const totals = calcGroupTotals(group);
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border whitespace-nowrap ${
        active
          ? `${colorLight[group.color]} border shadow-sm`
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className={`w-2.5 h-2.5 rounded-full ${colorBg[group.color]} flex-shrink-0`} />
      <span>{group.nombre}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/60' : 'bg-gray-100'}`}>
        {totals.cantidadProductos}
      </span>
    </button>
  );
};

const GroupConfigForm: React.FC<{
  group: OCDraftGroup;
  state: OCBuilderState;
  dispatch: React.Dispatch<OCBuilderAction>;
}> = ({ group, state, dispatch }) => {
  const [showObs, setShowObs] = useState(false);
  const totals = useMemo(() => calcGroupTotals(group), [group]);
  const tc = state.tcMode === 'global' ? state.tcGlobal : group.tcCompra;
  const costoUnitarioPromedio = totals.cantidadUnidades > 0
    ? totals.totalUSD / totals.cantidadUnidades
    : 0;

  return (
    <div className="space-y-5">
      {/* Row 1: Proveedor + Destino + TC */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Proveedor <span className="text-red-500">*</span>
          </label>
          <ProveedorAutocomplete
            value={group.proveedor}
            onChange={prov => dispatch({ type: 'SET_GROUP_PROVEEDOR', payload: { groupId: group.id, proveedor: prov } })}
            placeholder="Seleccionar proveedor..."
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Almacén Destino <span className="text-red-500">*</span>
          </label>
          <AlmacenAutocomplete
            value={group.almacenDestino}
            onChange={alm => dispatch({ type: 'SET_GROUP_DESTINO', payload: { groupId: group.id, almacen: alm } })}
            placeholder="Seleccionar destino..."
            required
          />
        </div>
        {state.tcMode === 'per_group' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Cambio <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.001"
              value={group.tcCompra || ''}
              onChange={e => dispatch({ type: 'SET_GROUP_TC', payload: { groupId: group.id, tc: parseFloat(e.target.value) || 0 } })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="3.500"
            />
          </div>
        )}
      </div>

      {/* Products table */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Productos ({group.productos.length})</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium">Producto</th>
                <th className="text-center px-3 py-2 font-medium w-20">Cant</th>
                <th className="text-center px-3 py-2 font-medium w-28">Precio USD</th>
                <th className="text-right px-3 py-2 font-medium w-24">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {group.productos.map((p, idx) => (
                <tr key={p.productoId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <div className="text-xs text-gray-400 font-mono">{p.sku}</div>
                    <div className="text-gray-900 truncate max-w-[200px] lg:max-w-[300px]">
                      {p.marca} - {p.nombreComercial}
                    </div>
                    {formatProductSubtitle(p) && (
                      <div className="text-[10px] text-gray-400 truncate">{formatProductSubtitle(p)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={p.cantidad}
                      onChange={e => dispatch({
                        type: 'UPDATE_PRODUCT_IN_GROUP',
                        payload: { groupId: group.id, productoId: p.productoId, changes: { cantidad: Math.max(1, parseInt(e.target.value) || 1) } }
                      })}
                      className="w-full px-2 py-1 border rounded text-center text-sm focus:ring-1 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={p.costoUnitarioUSD || ''}
                        onChange={e => dispatch({
                          type: 'UPDATE_PRODUCT_IN_GROUP',
                          payload: { groupId: group.id, productoId: p.productoId, changes: { costoUnitarioUSD: parseFloat(e.target.value) || 0 } }
                        })}
                        className="w-full px-2 py-1 border rounded text-right text-sm focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">
                    ${(p.cantidad * p.costoUnitarioUSD).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modo de entrega */}
      <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 mb-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Truck className="h-3.5 w-3.5 text-blue-500" />
          <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">Forma de llegada a Perú</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_GROUP_MODO_ENTREGA', payload: { groupId: group.id, modoEntrega: 'viajero', fleteIncluidoEnPrecio: false } })}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              group.modoEntrega !== 'envio_directo'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Compra vía viajero
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_GROUP_MODO_ENTREGA', payload: { groupId: group.id, modoEntrega: 'envio_directo', fleteIncluidoEnPrecio: true } })}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              group.modoEntrega === 'envio_directo'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Envío directo del proveedor
          </button>
        </div>
        {group.modoEntrega === 'envio_directo' && (
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-xs text-blue-700">
              <input
                type="checkbox"
                checked={group.fleteIncluidoEnPrecio}
                onChange={(e) => dispatch({ type: 'SET_GROUP_MODO_ENTREGA', payload: { groupId: group.id, modoEntrega: 'envio_directo', fleteIncluidoEnPrecio: e.target.checked } })}
                className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              />
              El proveedor cubre el envío internacional
            </label>
            <input
              type="text"
              placeholder="Operador logístico (DHL, FedEx, EMS...)"
              value={group.operadorLogistico || ''}
              onChange={(e) => dispatch({ type: 'SET_GROUP_OPERADOR', payload: { groupId: group.id, operadorLogistico: e.target.value } })}
              className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Número de tracking"
              value={group.numeroTracking || ''}
              onChange={(e) => dispatch({ type: 'SET_GROUP_TRACKING', payload: { groupId: group.id, numeroTracking: e.target.value } })}
              className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Costos y Descuento — modern card grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Tax */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Percent className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tax</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number" step="0.1" min={0}
              value={group.porcentajeTax || ''}
              onChange={e => dispatch({ type: 'SET_GROUP_TAX', payload: { groupId: group.id, porcentajeTax: parseFloat(e.target.value) || 0 } })}
              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="0"
            />
            <span className="text-xs text-gray-400 flex-shrink-0">%</span>
          </div>
          {totals.impuestoUSD > 0 && (
            <p className="text-[10px] text-gray-400 mt-1.5 text-right">{formatUSD(totals.impuestoUSD)}</p>
          )}
        </div>

        {/* Envío */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Truck className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Envío</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 flex-shrink-0">$</span>
            <input
              type="number" step="0.01" min={0}
              value={group.costoEnvioProveedorUSD || ''}
              onChange={e => dispatch({ type: 'SET_GROUP_ENVIO', payload: { groupId: group.id, costoEnvioProveedorUSD: parseFloat(e.target.value) || 0 } })}
              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Otros */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Receipt className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Otros</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 flex-shrink-0">$</span>
            <input
              type="number" step="0.01" min={0}
              value={group.otrosGastosCompraUSD || ''}
              onChange={e => dispatch({ type: 'SET_GROUP_OTROS', payload: { groupId: group.id, otrosGastosCompraUSD: parseFloat(e.target.value) || 0 } })}
              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Descuento */}
        <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Descuento</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-emerald-400 flex-shrink-0">-$</span>
            <input
              type="number" step="0.01" min={0}
              value={group.descuentoUSD || ''}
              onChange={e => dispatch({ type: 'SET_GROUP_DESCUENTO', payload: { groupId: group.id, descuentoUSD: parseFloat(e.target.value) || 0 } })}
              className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Observaciones (collapsible) */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowObs(!showObs)}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <FileText className="h-4 w-4 text-gray-400" />
          Observaciones
          {group.observaciones && <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />}
          {showObs ? <ChevronUp className="h-4 w-4 ml-auto text-gray-400" /> : <ChevronDown className="h-4 w-4 ml-auto text-gray-400" />}
        </button>
        {showObs && (
          <div className="px-4 pb-4">
            <textarea
              value={group.observaciones}
              onChange={e => dispatch({ type: 'SET_GROUP_OBSERVACIONES', payload: { groupId: group.id, observaciones: e.target.value } })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={3}
              placeholder="Observaciones opcionales..."
            />
          </div>
        )}
      </div>

      {/* Summary — modern card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-300">
            <span>Subtotal ({totals.cantidadUnidades} uds)</span>
            <span>{formatUSD(totals.subtotalUSD)}</span>
          </div>
          {totals.impuestoUSD > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Tax ({group.porcentajeTax}%)</span>
              <span>+{formatUSD(totals.impuestoUSD)}</span>
            </div>
          )}
          {totals.costoEnvioProveedorUSD > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Envío</span>
              <span>+{formatUSD(totals.costoEnvioProveedorUSD)}</span>
            </div>
          )}
          {totals.otrosGastosCompraUSD > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Otros</span>
              <span>+{formatUSD(totals.otrosGastosCompraUSD)}</span>
            </div>
          )}
          {totals.descuentoUSD > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Descuento</span>
              <span>-{formatUSD(totals.descuentoUSD)}</span>
            </div>
          )}
          <div className="border-t border-slate-600 pt-2 flex justify-between items-baseline">
            <span className="font-semibold text-base">Total USD</span>
            <span className="text-xl font-bold">{formatUSD(totals.totalUSD)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Total PEN (TC {tc.toFixed(3)})</span>
            <span>{formatPEN(totals.totalPEN)}</span>
          </div>
          {costoUnitarioPromedio > 0 && (
            <div className="flex justify-between items-center text-slate-500 text-xs pt-1 border-t border-slate-700">
              <span>Costo unitario promedio</span>
              <span>{formatUSD(costoUnitarioPromedio)}/ud</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const OCBuilderStep2: React.FC<Props> = ({ state, dispatch }) => {
  const activeGroup = state.groups.find(g => g.id === state.activeGroupId) || state.groups[0];
  const validation = useMemo(() => validateStep2(state), [state]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Global TC toggle */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
        <Globe className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Tipo de Cambio</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: 'SET_TC_MODE', payload: { mode: 'global' } })}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              state.tcMode === 'global' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            Global
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_TC_MODE', payload: { mode: 'per_group' } })}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              state.tcMode === 'per_group' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-200'
            }`}
          >
            Por OC
          </button>
        </div>
        {state.tcMode === 'global' && (
          <input
            type="number"
            step="0.001"
            value={state.tcGlobal || ''}
            onChange={e => dispatch({ type: 'SET_TC_GLOBAL', payload: { tc: parseFloat(e.target.value) || 0 } })}
            className="w-24 px-3 py-1.5 border rounded-lg text-sm text-right focus:ring-2 focus:ring-primary-500"
            placeholder="3.500"
          />
        )}
      </div>

      {/* Group tabs */}
      {state.groups.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {state.groups.map(g => (
            <GroupTab
              key={g.id}
              group={g}
              active={g.id === (activeGroup?.id || '')}
              onClick={() => dispatch({ type: 'SET_ACTIVE_GROUP', payload: { groupId: g.id } })}
            />
          ))}
        </div>
      )}

      {/* Active group form */}
      {activeGroup && (
        <GroupConfigForm
          key={activeGroup.id}
          group={activeGroup}
          state={state}
          dispatch={dispatch}
        />
      )}

      {/* Validation warnings */}
      {!validation.valid && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 space-y-0.5">
          {validation.errors.map((err, i) => <p key={i}>{err}</p>)}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700 space-y-0.5">
          {validation.warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}
    </div>
  );
};
