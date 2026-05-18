/**
 * CajaRecaudadoraPaso3LiquidacionConfig — chk5.D-S1f · F4
 *
 * Paso 3 del wizard cuando tipo='recaudadora'. Reemplaza al Paso3Saldo
 * (que es para banco/digital/efectivo/credito).
 *
 * Caja Recaudadora NO tiene saldo inicial (es vista derivada de eventos
 * cobros − servicios − liquidaciones). En su lugar, este paso configura:
 *   - Cuenta destino de liquidación (banco donde se transfiere el saldo)
 *   - Frecuencia esperada de liquidación (informativo · para alertas)
 */

import React from 'react';
import { Building2, CalendarClock } from 'lucide-react';
import type { CuentaWizardState } from './types';

interface Paso3RecaudadoraProps {
  state: CuentaWizardState;
  setState: React.Dispatch<React.SetStateAction<CuentaWizardState>>;
}

const FRECUENCIA_OPTIONS = [
  { value: 'diaria', label: 'Diaria', hint: 'Cada día se liquida lo recaudado' },
  { value: 'semanal', label: 'Semanal', hint: 'Liquidación cada 7 días · típico viernes' },
  { value: 'quincenal', label: 'Quincenal', hint: 'Liquidación cada 15 días · típico GK Xpress' },
  { value: 'mensual', label: 'Mensual', hint: 'Liquidación fin de mes' },
  { value: 'a_demanda', label: 'A demanda', hint: 'Sin frecuencia fija · cuando se solicita' },
] as const;

export const CajaRecaudadoraPaso3LiquidacionConfig: React.FC<Paso3RecaudadoraProps> = ({
  state,
  setState,
}) => {
  return (
    <div className="space-y-5">
      {/* Banner informativo */}
      <div className="bg-pink-50 border border-pink-200 rounded-md p-3 text-[11px] text-pink-900">
        <strong>Caja Recaudadora · saldo derivado:</strong> El saldo de una caja recaudadora
        es vista calculada en tiempo real desde los eventos (cobros − servicios − liquidaciones
        ya transferidas). NO se ingresa saldo inicial. Aquí configuramos a dónde se transfiere
        el saldo cuando el tercero liquida.
      </div>

      {/* Cuenta destino */}
      <div className="bg-teal-50 ring-1 ring-teal-200 rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-700" />
          <h3 className="text-[12px] font-bold text-teal-900">Cuenta destino de liquidación</h3>
        </div>
        <p className="text-[10px] text-teal-700">
          Cuenta bancaria del negocio donde el tercero (recaudador) transferirá el saldo
          neto periódico. Típicamente la cuenta operativa principal.
        </p>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-teal-700 font-semibold mb-1">
            ID cuenta destino (selector futuro)
          </label>
          <input
            type="text"
            value={state.cuentaLiquidacionDefaultId}
            onChange={(e) =>
              setState((s) => ({ ...s, cuentaLiquidacionDefaultId: e.target.value }))
            }
            placeholder="ej: pf_bcp_soles_operativa_001"
            className="w-full px-3 py-2 text-sm font-mono border border-teal-300 rounded bg-white"
          />
          <p className="text-[9px] text-teal-600 mt-0.5 italic">
            [TODO F5] · reemplazar por autocomplete productosFinancieros activos en moneda{' '}
            {state.moneda}
          </p>
        </div>
        <div className="bg-white ring-1 ring-teal-300 rounded p-2 text-[11px] text-teal-900">
          <strong>Moneda:</strong> debe coincidir con la moneda de la recaudadora (
          <strong>{state.moneda}</strong>). Si se necesita conversión, usar wizard
          Conversión USD↔PEN antes de la liquidación.
        </div>
      </div>

      {/* Frecuencia */}
      <div className="bg-indigo-50 ring-1 ring-indigo-200 rounded-xl p-3 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-700" />
          <h3 className="text-[12px] font-bold text-indigo-900">Frecuencia esperada de liquidación</h3>
        </div>
        <p className="text-[10px] text-indigo-700">
          Cada cuánto el tercero se compromete a liquidar el saldo. Informativo · usado
          para alertas tempranas si la liquidación se atrasa.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {FRECUENCIA_OPTIONS.map((opt) => {
            const active = state.frecuenciaLiquidacion === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setState((s) => ({ ...s, frecuenciaLiquidacion: opt.value }))
                }
                className={`px-2 py-2 text-[10px] font-bold rounded-lg border-2 ${
                  active
                    ? 'border-indigo-500 bg-white text-indigo-700'
                    : 'border-indigo-200 bg-white text-slate-600 hover:bg-indigo-50'
                }`}
                title={opt.hint}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {state.frecuenciaLiquidacion && (
          <div className="text-[10px] text-indigo-700 italic">
            {
              FRECUENCIA_OPTIONS.find((o) => o.value === state.frecuenciaLiquidacion)
                ?.hint
            }
          </div>
        )}
      </div>
    </div>
  );
};
