/**
 * Paso 2 — Cuenta origen + método + TC · S58d F4
 *
 * Captura: cuenta empresa de donde sale el dinero · método de pago · fecha · TC.
 *
 * Diferencia por modo:
 *   - banco_emisor: el TC ideal es la TCPA del Pool USD (para diferencial)
 *   - reembolso_titular: TC del día sirve (no hay diferencial)
 *
 * Smart defaults: usa cuentaPagoDefaultId de la tarjeta si está configurada.
 */

import React, { useEffect, useMemo } from 'react';
import { Banknote, Building, IdCard } from 'lucide-react';
import { Combobox } from '../../../../../design-system/components/forms/Combobox';
import { DateField } from '../../../../../design-system/components/forms/DateField';
import { TextField } from '../../../../../design-system/components/forms/TextField';
import { useTesoreriaStore } from '../../../../../store/tesoreriaStore';
import { useTipoCambio } from '../../../../../hooks/useTipoCambio';
import type { MetodoTesoreria } from '../../../../../types/tesoreria.types';
import { cn } from '../../../../../design-system/utils';
import type { PagarEstadoCuentaState } from './types';
import { getMontoTotal } from './types';

interface Paso2Props {
  state: PagarEstadoCuentaState;
  setState: React.Dispatch<React.SetStateAction<PagarEstadoCuentaState>>;
}

const METODO_OPTIONS = [
  { value: 'transferencia_bancaria', label: 'Transferencia' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'otro', label: 'Otro' },
];

export const Paso2CuentaPago: React.FC<Paso2Props> = ({ state, setState }) => {
  const { tc } = useTipoCambio();
  const cuentas = useTesoreriaStore((s) => s.cuentas);
  const fetchCuentas = useTesoreriaStore((s) => s.fetchCuentas);
  const cuentasLoading = useTesoreriaStore((s) => s.loading);

  // Cargar cuentas si no están en store
  useEffect(() => {
    if (cuentas.length === 0) void fetchCuentas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-aplicar TC del día si tipoCambio === 0
  useEffect(() => {
    if (state.tipoCambio === 0 && tc?.venta) {
      setState((s) => ({
        ...s,
        tipoCambio: tc.venta,
        fuenteTipoCambio: 'tipocambio_service',
      }));
    }
  }, [tc, state.tipoCambio, setState]);

  // Auto-seleccionar cuenta default si la tarjeta tiene una
  useEffect(() => {
    if (state.cuentaOrigenId || !state.tarjeta) return;
    const def = state.tarjeta.cuentaPagoDefaultId
      ? cuentas.find((c) => c.id === state.tarjeta!.cuentaPagoDefaultId)
      : cuentas.find(
          (c) => c.esCuentaPorDefecto && (c.moneda === state.monedaPago || c.esBiMoneda),
        ) ??
        cuentas.find(
          (c) => c.moneda === state.monedaPago || c.esBiMoneda,
        );
    if (def) {
      setState((s) => ({
        ...s,
        cuentaOrigenId: def.id,
        cuentaOrigenNombre: def.nombre,
      }));
    }
  }, [cuentas, state.tarjeta, state.cuentaOrigenId, state.monedaPago, setState]);

  // Filtrar cuentas según moneda
  const cuentasDisponibles = useMemo(() => {
    return cuentas.filter((c) => {
      if (c.esBiMoneda) return true;
      return c.moneda === state.monedaPago;
    });
  }, [cuentas, state.monedaPago]);

  const cuentaSel = useMemo(
    () => cuentasDisponibles.find((c) => c.id === state.cuentaOrigenId),
    [cuentasDisponibles, state.cuentaOrigenId],
  );

  const saldoActualCuenta = useMemo(() => {
    if (!cuentaSel) return undefined;
    if (cuentaSel.esBiMoneda) {
      return state.monedaPago === 'USD'
        ? (cuentaSel.saldoUSD ?? 0)
        : (cuentaSel.saldoPEN ?? 0);
    }
    return cuentaSel.saldoActual ?? 0;
  }, [cuentaSel, state.monedaPago]);

  const total = getMontoTotal(state);
  const tcEsDelDia =
    tc?.venta && Math.abs(state.tipoCambio - tc.venta) < 0.001;

  const monedaSym = state.monedaPago === 'USD' ? 'US$' : 'S/';

  const accentColor =
    state.modo === 'reembolso_titular' ? 'sky' : 'amber';
  const accentClasses: Record<string, string> = {
    'border-active': 'border-sky-500',
    'ring-active': 'focus:ring-sky-500',
    'text-soft': 'text-sky-700',
    'bg-soft-50': 'bg-sky-50',
    'border-soft': 'border-sky-200',
  };
  const accent = (key: string) => {
    const map: Record<string, Record<string, string>> = {
      sky: {
        'border-active': 'border-sky-500',
        'ring-active': 'focus:ring-sky-500 focus:border-sky-500',
        'text-soft': 'text-sky-700',
        'bg-soft-50': 'bg-sky-50',
        'border-soft': 'border-sky-200',
      },
      amber: {
        'border-active': 'border-amber-500',
        'ring-active': 'focus:ring-amber-500 focus:border-amber-500',
        'text-soft': 'text-amber-700',
        'bg-soft-50': 'bg-amber-50',
        'border-soft': 'border-amber-200',
      },
    };
    return map[accentColor]?.[key] ?? accentClasses[key] ?? '';
  };

  return (
    <div className="space-y-5">
      {/* Resumen del modo */}
      <div
        className={cn(
          'border rounded-lg p-3 flex items-start gap-2',
          accent('bg-soft-50'),
          accent('border-soft'),
        )}
      >
        {state.modo === 'reembolso_titular' ? (
          <IdCard className={cn('w-4 h-4 mt-0.5 flex-shrink-0', accent('text-soft'))} />
        ) : (
          <Building className={cn('w-4 h-4 mt-0.5 flex-shrink-0', accent('text-soft'))} />
        )}
        <div className="flex-1 text-[12px]">
          <div className={cn('font-semibold', accent('text-soft'))}>
            {state.modo === 'reembolso_titular'
              ? `Reembolsar ${monedaSym} ${total.toFixed(2)} a ${state.tarjeta?.titularNombre || 'titular'}`
              : `Pagar ${monedaSym} ${total.toFixed(2)} al banco ${state.tarjeta?.banco}`}
          </div>
          <div className="text-[11px] text-slate-700 mt-0.5">
            {state.aplicaciones.length} cargo
            {state.aplicaciones.length !== 1 ? 's' : ''} se saldará
            {state.aplicaciones.length !== 1 ? 'n' : ''} con este pago
          </div>
        </div>
      </div>

      {/* Cuenta origen */}
      <Combobox
        label={`Pagar desde · cuenta empresa en ${state.monedaPago}`}
        value={state.cuentaOrigenId}
        onChange={(v) => {
          const c = cuentasDisponibles.find((c) => c.id === v);
          setState((s) => ({
            ...s,
            cuentaOrigenId: v,
            cuentaOrigenNombre: c?.nombre ?? '',
          }));
        }}
        groups={[
          {
            options: cuentasDisponibles.map((c) => ({
              value: c.id,
              label: c.nombre,
              subLabel: c.banco ? `${c.banco} · ${c.tipo}` : c.tipo,
              badge: (
                <span className="text-[10px] tabular-nums text-slate-500">
                  {monedaSym}{' '}
                  {(c.esBiMoneda
                    ? state.monedaPago === 'USD'
                      ? (c.saldoUSD ?? 0)
                      : (c.saldoPEN ?? 0)
                    : (c.saldoActual ?? 0)
                  ).toLocaleString('es-PE', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </span>
              ),
            })),
          },
        ]}
        placeholder="Seleccionar cuenta…"
        hint={
          cuentaSel && saldoActualCuenta !== undefined && total
            ? `Saldo: ${monedaSym} ${saldoActualCuenta.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → ${monedaSym} ${(saldoActualCuenta - total).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : cuentaSel && saldoActualCuenta !== undefined
              ? `Saldo: ${monedaSym} ${saldoActualCuenta.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : cuentasLoading
                ? 'Cargando cuentas…'
                : `No hay cuentas en ${state.monedaPago}`
        }
        emptyMessage="Sin cuentas disponibles"
      />

      {/* Fecha + Método */}
      <div className="grid grid-cols-2 gap-3">
        <DateField
          label="Fecha del pago"
          value={state.fecha}
          onChange={(v) => v && setState((s) => ({ ...s, fecha: v }))}
          showShortcuts
        />

        <Combobox
          label="Método"
          value={state.metodo}
          onChange={(v) =>
            setState((s) => ({ ...s, metodo: v as MetodoTesoreria }))
          }
          groups={[{ options: METODO_OPTIONS }]}
          placeholder="Método de pago…"
        />
      </div>

      {/* TC */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            Tipo de cambio
          </label>
          <div className="flex items-center gap-1.5">
            {tcEsDelDia && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                Día auto · {tc?.venta.toFixed(3)}
              </span>
            )}
            {!tcEsDelDia && tc?.venta && (
              <button
                type="button"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    tipoCambio: tc.venta,
                    fuenteTipoCambio: 'tipocambio_service',
                  }))
                }
                className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium hover:bg-amber-100"
              >
                Usar día ({tc.venta.toFixed(3)})
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <input
            type="number"
            step="0.001"
            value={state.tipoCambio || ''}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                tipoCambio: parseFloat(e.target.value) || 0,
                fuenteTipoCambio:
                  parseFloat(e.target.value) === tc?.venta
                    ? 'tipocambio_service'
                    : 'manual',
              }))
            }
            className={cn(
              'w-full h-10 pl-3 pr-10 text-sm border border-slate-300 rounded-md bg-white tabular-nums outline-none',
              accent('ring-active'),
            )}
            placeholder="3.700"
          />
          <Banknote className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        {state.modo === 'banco_emisor' && (
          <p className="text-[10px] text-amber-700 mt-1.5 flex items-start gap-1">
            <strong>Importante:</strong> ideal usar TCPA del Pool USD si el
            dinero proviene de cobranzas USD acumuladas. El diferencial
            cambiario se calcula contra TC de cada cargo.
          </p>
        )}
        {state.modo === 'reembolso_titular' && (
          <p className="text-[10px] text-sky-700 mt-1.5">
            En modo reembolso, el TC es solo para conversión informativa. NO
            se calcula diferencial cambiario.
          </p>
        )}
      </div>

      {/* Referencia */}
      <TextField
        label="Nro de operación / referencia"
        value={state.referencia}
        onChange={(v) => setState((s) => ({ ...s, referencia: v }))}
        placeholder="Ej: Transferencia BCP #ZL-2026-0428-001"
        optional
      />
    </div>
  );
};
