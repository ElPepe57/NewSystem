/**
 * Paso 3 — Moneda + saldo del negocio · S58c v2
 *
 * Decisión D-S58-18: el saldo es "del negocio en esta cuenta", NO el saldo
 * total del banco. Default 0 si la cuenta tiene uso mixto personal/empresa.
 *
 * Bi-moneda solo aplica para tipo='banco' o tipo='efectivo'.
 */

import React, { useEffect } from 'react';
import { Info, Coins } from 'lucide-react';
import { MoneyField } from '../../../../../design-system/components/forms/MoneyField';
import { ToggleGroup } from '../../../../../design-system/components/forms/ToggleGroup';
import { useSocioStore } from '../../../../../store/socioStore';
import type { MonedaTesoreria } from '../../../../../types/tesoreria.types';
import type { CuentaWizardState } from './types';

interface Paso3Props {
  state: CuentaWizardState;
  setState: React.Dispatch<React.SetStateAction<CuentaWizardState>>;
}

export const Paso3Saldo: React.FC<Paso3Props> = ({ state, setState }) => {
  const soportaBiMoneda = state.tipo === 'banco' || state.tipo === 'efectivo';

  // F14.6 · D2 · catálogo de socios para atribuir el saldo inicial (aporte fundacional)
  const socios = useSocioStore((s) => s.socios);
  const fetchSocios = useSocioStore((s) => s.fetchSocios);
  useEffect(() => {
    if (socios.length === 0) void fetchSocios();
  }, [socios.length, fetchSocios]);

  const hayMontoInicial = state.esBiMoneda
    ? state.saldoInicialUSD > 0 || state.saldoInicialPEN > 0
    : state.saldoInicial > 0;

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

      {/* F14.6 · D2 · atribución del saldo inicial a un socio (aporte fundacional
          · solo cuentas de cash con saldo > 0 · sin doble conteo) */}
      {soportaBiMoneda && hayMontoInicial && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-2">
            <Coins className="w-4 h-4 text-violet-700 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-[12px] font-semibold text-violet-900">
                ¿Este saldo es aporte de un socio?{' '}
                <span className="font-normal text-violet-700">· opcional</span>
              </div>
              <div className="text-[11px] text-violet-800 mt-0.5 leading-relaxed">
                Si el saldo proviene del aporte de un socio, atribuíselo. Aparecerá
                como su capital aportado en Inversionistas, sin doble conteo del saldo.
              </div>
            </div>
          </div>
          <select
            value={state.aporteFundacionalSocioId}
            onChange={(e) =>
              setState((s) => ({ ...s, aporteFundacionalSocioId: e.target.value }))
            }
            className="w-full border border-violet-300 rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            <option value="">Sin atribuir · capital del negocio</option>
            {socios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
