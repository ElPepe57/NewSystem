/**
 * Paso 3 — Confirmar cargo · S58d F3
 *
 * Muestra hero con monto del cargo, descripción libre, TC auto del día
 * con override opcional, y resumen de "lo que se ejecutará".
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Info,
  ArrowLeftRight,
  Coins,
  CircleCheck,
  Pencil,
} from 'lucide-react';
import { TextField } from '../../../../design-system/components/forms/TextField';
import { DateField } from '../../../../design-system/components/forms/DateField';
import { useTipoCambio } from '../../../../hooks/useTipoCambio';
import type { CargarTarjetaState } from './types';
import { getTotalCargo } from './types';
import { cn } from '../../../../design-system/utils';

interface Paso3Props {
  state: CargarTarjetaState;
  setState: React.Dispatch<React.SetStateAction<CargarTarjetaState>>;
}

function formatMoney(n: number, moneda: 'USD' | 'PEN'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const Paso3Confirmar: React.FC<Paso3Props> = ({ state, setState }) => {
  const { tc } = useTipoCambio();
  const [showOverride, setShowOverride] = useState(false);

  const total = getTotalCargo(state);

  // Auto-aplicar TC del día si es la primera vez
  useEffect(() => {
    if (state.tcDelDia === 0 && tc?.venta) {
      setState((s) => ({
        ...s,
        tcDelDia: tc.venta,
        fuenteTcDelDia: 'auto',
      }));
    }
  }, [tc, state.tcDelDia, setState]);

  // Auto-generar descripción inicial
  useEffect(() => {
    if (
      !state.descripcion &&
      state.entidad &&
      state.distribucion.length > 0
    ) {
      const docsResumen = state.distribucion
        .slice(0, 3)
        .map((d) => d.documentoNumero)
        .join(', ');
      const sufijo = state.distribucion.length > 3 ? `, +${state.distribucion.length - 3} más` : '';
      setState((s) => ({
        ...s,
        descripcion: `Compra a ${state.entidad!.entidadNombre} · ${docsResumen}${sufijo}`,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.entidad, state.distribucion]);

  // Equivalente PEN del cargo
  const equivalentePEN = useMemo(() => {
    if (!total || !state.tcDelDia) return null;
    return state.monedaCargo === 'USD'
      ? total * state.tcDelDia
      : total / state.tcDelDia;
  }, [total, state.tcDelDia, state.monedaCargo]);

  const monedaEquiv: 'USD' | 'PEN' =
    state.monedaCargo === 'USD' ? 'PEN' : 'USD';

  // ¿TC actual coincide con TC del día?
  const tcEsDelDia =
    tc?.venta && Math.abs(state.tcDelDia - tc.venta) < 0.001;

  if (!state.tarjeta || !state.entidad) {
    return (
      <div className="text-[12px] text-slate-500">
        Volve al Paso 1 — falta información.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero del cargo */}
      <div className="bg-gradient-to-br from-amber-50 to-white border-2 border-amber-200 rounded-xl p-5">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-wider text-amber-700 font-semibold mb-1">
            Cargo a tarjeta
          </div>
          <div className="text-3xl font-bold text-amber-700 tabular-nums">
            {formatMoney(total, state.monedaCargo)}
          </div>
          {equivalentePEN && (
            <div className="text-[12px] text-slate-600 mt-1">
              ≈ {formatMoney(equivalentePEN, monedaEquiv)} al TC{' '}
              {state.tcDelDia.toFixed(3)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-amber-200/60">
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
              Tarjeta
            </div>
            <div className="text-[13px] font-semibold text-slate-900 truncate">
              {state.tarjeta.nombre}
            </div>
            <div className="text-[10px] text-slate-500">
              ····{state.tarjeta.ultimosDigitos}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
              Origen deudas
            </div>
            <div className="text-[13px] font-semibold text-slate-900 truncate">
              {state.entidad.entidadNombre}
            </div>
            <div className="text-[10px] text-slate-500">
              {state.distribucion.length} doc
              {state.distribucion.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Fecha + TC */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DateField
          label="Fecha del cargo"
          value={state.fecha}
          onChange={(v) => v && setState((s) => ({ ...s, fecha: v }))}
          showShortcuts
        />
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Tipo de cambio
            </label>
            {tcEsDelDia && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                Día auto · {tc?.venta.toFixed(3)}
              </span>
            )}
            {!tcEsDelDia && tc?.venta && state.fuenteTcDelDia !== 'manual' && (
              <button
                type="button"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    tcDelDia: tc.venta,
                    fuenteTcDelDia: 'auto',
                  }))
                }
                className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium hover:bg-amber-100"
              >
                Usar día ({tc.venta.toFixed(3)})
              </button>
            )}
          </div>
          <input
            type="number"
            step="0.001"
            value={state.tcDelDia || ''}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                tcDelDia: parseFloat(e.target.value) || 0,
                fuenteTcDelDia:
                  parseFloat(e.target.value) === tc?.venta ? 'auto' : 'manual',
              }))
            }
            className="w-full h-10 px-3 text-sm border border-slate-300 rounded-md bg-white tabular-nums focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            placeholder="3.700"
          />
          {state.fuenteTcDelDia === 'manual' && !showOverride && (
            <button
              type="button"
              onClick={() => setShowOverride(true)}
              className="text-[10px] text-amber-700 mt-1 hover:underline flex items-center gap-1"
            >
              <Pencil className="w-2.5 h-2.5" />
              Agregar motivo del override
            </button>
          )}
        </div>
      </div>

      {/* Motivo override */}
      {state.fuenteTcDelDia === 'manual' && showOverride && (
        <TextField
          label="Motivo del override de TC"
          value={state.motivoOverrideTc}
          onChange={(v) => setState((s) => ({ ...s, motivoOverrideTc: v }))}
          placeholder="TC pactado contractual / error del feed automático…"
          hint="Se registra en auditoría del cargo."
        />
      )}

      {/* Descripción */}
      <TextField
        label="Descripción del cargo"
        value={state.descripcion}
        onChange={(v) => setState((s) => ({ ...s, descripcion: v }))}
        placeholder="Compra Asian Beauty Wholesale · OC-001, OC-008"
        hint="Como aparecerá en el extracto de la tarjeta y en CC."
      />

      {/* Lo que va a pasar */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Al confirmar se ejecutará
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2 p-2.5 border border-amber-200 bg-amber-50/40 rounded-md">
            <ArrowLeftRight className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-amber-900">
                1 cargo en CC de la tarjeta
              </div>
              <div className="text-[11px] text-amber-700">
                Saldo TC{' '}
                {state.tarjeta.titularidad === 'personal'
                  ? `(deuda con ${state.tarjeta.titularNombre || 'titular'})`
                  : `(deuda con ${state.tarjeta.banco})`}
                : sube en {formatMoney(total, state.monedaCargo)}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2.5 border border-emerald-200 bg-emerald-50/40 rounded-md">
            <Coins className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-emerald-900">
                {state.distribucion.length} crédito
                {state.distribucion.length !== 1 ? 's' : ''} en CC de{' '}
                {state.entidad.entidadNombre}
              </div>
              <div className="text-[11px] text-emerald-700 truncate">
                {state.distribucion
                  .slice(0, 4)
                  .map((d) => d.documentoNumero)
                  .join(', ')}
                {state.distribucion.length > 4 &&
                  `, +${state.distribucion.length - 4} más`}{' '}
                · saldados con cargo a TC
              </div>
            </div>
          </div>
          <div className={cn(
            'flex items-start gap-2 p-2.5 border rounded-md',
            'border-slate-200 bg-white',
          )}>
            <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-slate-700">
                NO toca tesorería
              </div>
              <div className="text-[11px] text-slate-500">
                El dinero sale después al pagar el estado de cuenta.{' '}
                {state.tarjeta.titularidad === 'personal'
                  ? 'En su momento se reembolsará al titular.'
                  : 'Pago directo al banco emisor.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

void CircleCheck;
