/**
 * CajaRecaudadoraPaso2DatosTercero — chk5.D-S1f · F4
 *
 * Paso 2 del wizard cuando tipo='recaudadora' (Caja Recaudadora · D5 + D12).
 * Reemplaza al Paso2Identidad (que es para banco/digital/efectivo/credito).
 *
 * Campos del paso 2 Recaudadora:
 *   - Nombre interno
 *   - Moneda (típicamente PEN · USD raro para recaudadora local)
 *   - Responsable tercero: tipo (proveedor/colaborador/cliente) + entidad + nombre denormalizado
 *   - Tarifa servicio: tipo (fijo/porcentaje/mixto) + valor + (valor adicional si mixto) + eventoLabel
 */

import React from 'react';
import { Truck, User, Percent } from 'lucide-react';
import type { CuentaWizardState } from './types';

interface Paso2RecaudadoraProps {
  state: CuentaWizardState;
  setState: React.Dispatch<React.SetStateAction<CuentaWizardState>>;
}

const TIPO_RESPONSABLE_OPTIONS = [
  { value: 'proveedor', label: 'Proveedor', hint: 'Empresa logística · servicio externo' },
  { value: 'colaborador', label: 'Colaborador', hint: 'Freelance · rider independiente' },
  { value: 'cliente', label: 'Cliente', hint: 'Cliente grande que recauda para su grupo' },
] as const;

const TIPO_TARIFA_OPTIONS = [
  { value: 'fijo_por_evento', label: 'Fijo por evento', hint: 'Monto fijo por cada cobro · ej. S/ 25 por carrera' },
  { value: 'porcentaje', label: 'Porcentaje', hint: '% del monto cobrado · ej. 2.5%' },
  { value: 'mixto', label: 'Mixto · % + fijo', hint: '% + monto fijo por evento · ej. 1.5% + S/ 5' },
] as const;

export const CajaRecaudadoraPaso2DatosTercero: React.FC<Paso2RecaudadoraProps> = ({
  state,
  setState,
}) => {
  return (
    <div className="space-y-5">
      {/* Nombre + moneda */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
            Nombre interno de la caja recaudadora
          </label>
          <input
            type="text"
            value={state.nombre}
            onChange={(e) => setState((s) => ({ ...s, nombre: e.target.value }))}
            placeholder="Ej: GK Xpress · multi-canal"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
            Moneda
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, moneda: 'PEN' }))}
              className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border-2 ${
                state.moneda === 'PEN'
                  ? 'border-pink-500 bg-pink-50 text-pink-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              PEN
            </button>
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, moneda: 'USD' }))}
              className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border-2 ${
                state.moneda === 'USD'
                  ? 'border-pink-500 bg-pink-50 text-pink-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              USD
            </button>
          </div>
        </div>
      </div>

      {/* Responsable tercero */}
      <div className="bg-purple-50 ring-1 ring-purple-200 rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-purple-700" />
          <h3 className="text-[12px] font-bold text-purple-900">Responsable tercero (obligatorio)</h3>
        </div>
        <p className="text-[10px] text-purple-700">
          Entidad que recauda en nombre del negocio · típicamente un proveedor logístico o
          colaborador externo. Genera CC con esta entidad para descontar servicios.
        </p>

        {/* Tipo entidad */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-purple-600 font-semibold mb-1">
            Tipo de entidad
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {TIPO_RESPONSABLE_OPTIONS.map((opt) => {
              const active = state.responsableTerceroTipo === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setState((s) => ({ ...s, responsableTerceroTipo: opt.value }))
                  }
                  className={`px-2 py-1.5 text-[11px] font-bold rounded-lg border-2 ${
                    active
                      ? 'border-purple-500 bg-white text-purple-700'
                      : 'border-purple-200 bg-white text-slate-600 hover:bg-purple-50'
                  }`}
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Entidad + nombre */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-purple-600 font-semibold mb-1">
              ID entidad (selector futuro)
            </label>
            <input
              type="text"
              value={state.responsableTerceroId}
              onChange={(e) =>
                setState((s) => ({ ...s, responsableTerceroId: e.target.value }))
              }
              placeholder="ej: prov_gk_xpress_001"
              className="w-full px-2 py-1.5 text-xs font-mono border border-purple-300 rounded bg-white"
            />
            <p className="text-[9px] text-purple-600 mt-0.5 italic">
              [TODO F5] · reemplazar por autocomplete entidades
            </p>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-purple-600 font-semibold mb-1">
              Nombre denormalizado (display)
            </label>
            <input
              type="text"
              value={state.responsableTerceroNombre}
              onChange={(e) =>
                setState((s) => ({ ...s, responsableTerceroNombre: e.target.value }))
              }
              placeholder="Ej: GK Xpress (Carlos M.)"
              className="w-full px-2 py-1.5 text-xs border border-purple-300 rounded bg-white"
            />
          </div>
        </div>
      </div>

      {/* Tarifa de servicio */}
      <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-amber-700" />
          <h3 className="text-[12px] font-bold text-amber-900">Tarifa que cobra el recaudador</h3>
        </div>
        <p className="text-[10px] text-amber-700">
          Cómo cobra el tercero su servicio · se descuenta automáticamente en cada
          liquidación. El snapshot se preserva en cada evento para auditoría histórica.
        </p>

        {/* Tipo tarifa */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">
            Tipo de tarifa
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {TIPO_TARIFA_OPTIONS.map((opt) => {
              const active = state.tarifaServicioTipo === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setState((s) => ({ ...s, tarifaServicioTipo: opt.value }))
                  }
                  className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border-2 text-left ${
                    active
                      ? 'border-amber-500 bg-white text-amber-700'
                      : 'border-amber-200 bg-white text-slate-600 hover:bg-amber-50'
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className="text-[9px] text-slate-500 font-normal mt-0.5">{opt.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Valor + valor adicional + eventoLabel */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">
              {state.tarifaServicioTipo === 'porcentaje' ? 'Porcentaje (%)' : 'Valor'}
            </label>
            <div className="relative">
              {state.tarifaServicioTipo !== 'porcentaje' && (
                <span className="absolute left-2 top-1.5 text-slate-500 text-xs">
                  {state.moneda === 'PEN' ? 'S/' : '$'}
                </span>
              )}
              <input
                type="number"
                step="0.01"
                min="0"
                value={state.tarifaServicioValor || ''}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    tarifaServicioValor: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="25.00"
                className={`w-full ${
                  state.tarifaServicioTipo === 'porcentaje' ? 'pl-2' : 'pl-7'
                } pr-2 py-1.5 text-sm border border-amber-300 rounded text-right tabular-nums bg-white`}
              />
              {state.tarifaServicioTipo === 'porcentaje' && (
                <span className="absolute right-2 top-1.5 text-slate-500 text-xs">%</span>
              )}
            </div>
          </div>
          {state.tarifaServicioTipo === 'mixto' && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">
                + Fijo
              </label>
              <div className="relative">
                <span className="absolute left-2 top-1.5 text-slate-500 text-xs">
                  {state.moneda === 'PEN' ? 'S/' : '$'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={state.tarifaServicioValorAdicional || ''}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      tarifaServicioValorAdicional: parseFloat(e.target.value) || 0,
                    }))
                  }
                  placeholder="5.00"
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-amber-300 rounded text-right tabular-nums bg-white"
                />
              </div>
            </div>
          )}
          <div className={state.tarifaServicioTipo === 'mixto' ? '' : 'col-span-2'}>
            <label className="block text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">
              Unidad de cobro
            </label>
            <input
              type="text"
              value={state.tarifaServicioEventoLabel}
              onChange={(e) =>
                setState((s) => ({ ...s, tarifaServicioEventoLabel: e.target.value }))
              }
              placeholder="por carrera · por envío · por transacción"
              className="w-full px-2 py-1.5 text-xs border border-amber-300 rounded bg-white"
            />
          </div>
        </div>

        {/* Preview tarifa */}
        {state.tarifaServicioTipo && state.tarifaServicioValor > 0 && (
          <div className="bg-white ring-1 ring-amber-300 rounded p-2 text-[11px] text-amber-900">
            <strong>Preview:</strong> el recaudador cobrará{' '}
            <strong>
              {state.tarifaServicioTipo === 'porcentaje'
                ? `${state.tarifaServicioValor}% del monto`
                : `${state.moneda === 'PEN' ? 'S/' : '$'} ${state.tarifaServicioValor.toFixed(2)}`}
              {state.tarifaServicioTipo === 'mixto' &&
                ` + ${state.moneda === 'PEN' ? 'S/' : '$'} ${state.tarifaServicioValorAdicional.toFixed(2)} fijo`}
            </strong>{' '}
            <em>{state.tarifaServicioEventoLabel || 'por evento'}</em>. Se descontará
            automáticamente del saldo a liquidar en cada cierre periódico.
          </div>
        )}
      </div>
    </div>
  );
};
