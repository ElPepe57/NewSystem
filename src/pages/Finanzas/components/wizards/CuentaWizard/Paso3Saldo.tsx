/**
 * Paso 3 — Moneda + saldo del negocio · S58c v2
 *
 * Decisión D-S58-18: el saldo es "del negocio en esta cuenta", NO el saldo
 * total del banco. Default 0 si la cuenta tiene uso mixto personal/empresa.
 *
 * Bi-moneda solo aplica para tipo='banco' o tipo='efectivo'.
 */

import React from 'react';
import { Info } from 'lucide-react';
import { MoneyField } from '../../../../../design-system/components/forms/MoneyField';
import { ToggleGroup } from '../../../../../design-system/components/forms/ToggleGroup';
import type { MonedaTesoreria } from '../../../../../types/tesoreria.types';
import type { CuentaWizardState } from './types';

interface Paso3Props {
  state: CuentaWizardState;
  setState: React.Dispatch<React.SetStateAction<CuentaWizardState>>;
}

export const Paso3Saldo: React.FC<Paso3Props> = ({ state, setState }) => {
  const soportaBiMoneda = state.tipo === 'banco' || state.tipo === 'efectivo';

  return (
    <div className="space-y-5">
      {/* Esquema mono/bi-moneda */}
      {soportaBiMoneda && (
        <ToggleGroup
          label="Esquema de moneda"
          value={state.esBiMoneda ? 'bi' : 'mono'}
          onChange={(v) =>
            setState((s) => ({ ...s, esBiMoneda: v === 'bi' }))
          }
          options={[
            { value: 'mono', label: 'Mono-moneda' },
            { value: 'bi', label: 'Bi-moneda (USD + PEN)' },
          ]}
          hint={
            state.esBiMoneda
              ? 'Cuenta con saldos USD y PEN separados (típico cuentas BCP/IBK/BBVA empresariales)'
              : 'Una sola moneda por cuenta'
          }
        />
      )}

      {/* Moneda principal */}
      {!state.esBiMoneda && (
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
            Moneda
          </label>
          <ToggleGroup<MonedaTesoreria>
            value={state.moneda}
            onChange={(v) => setState((s) => ({ ...s, moneda: v }))}
            options={[
              { value: 'PEN', label: 'PEN · Soles' },
              { value: 'USD', label: 'USD · Dólares' },
            ]}
            fullWidth={false}
          />
        </div>
      )}

      {/* Saldo del negocio actual */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-[12px] font-semibold text-amber-900">
              Saldo del NEGOCIO en esta cuenta
            </div>
            <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Cuánto del dinero del negocio hay en esta cuenta hoy.{' '}
              <strong>NO es el saldo del banco.</strong> Default 0 si la cuenta
              tiene uso mixto personal/empresa.
            </div>
          </div>
        </div>

        {state.esBiMoneda ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MoneyField
              label="Saldo USD"
              value={state.saldoInicialUSD}
              onChange={(v) =>
                setState((s) => ({ ...s, saldoInicialUSD: v ?? 0 }))
              }
              moneda="USD"
              hint="Default 0"
            />
            <MoneyField
              label="Saldo PEN"
              value={state.saldoInicialPEN}
              onChange={(v) =>
                setState((s) => ({ ...s, saldoInicialPEN: v ?? 0 }))
              }
              moneda="PEN"
              hint="Default 0"
            />
          </div>
        ) : (
          <div className="max-w-xs">
            <MoneyField
              label="Saldo del negocio actual"
              value={state.saldoInicial}
              onChange={(v) => setState((s) => ({ ...s, saldoInicial: v ?? 0 }))}
              moneda={state.moneda}
              hint="Default 0"
            />
          </div>
        )}
      </div>
    </div>
  );
};
