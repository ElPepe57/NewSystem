/**
 * Paso 2 — Definir el abono
 *
 * Captura: monto + moneda · cuenta de origen · método · fecha · TC · referencia.
 * Smart defaults: TC del día, fecha=hoy, cuenta más usada para la moneda.
 * Quick actions: "Pagar todo (Total deudas)" + "Solo vencidas".
 */

import React, { useEffect, useMemo } from 'react';
import { Banknote } from 'lucide-react';
import { MoneyField } from '../../../../design-system/components/forms/MoneyField';
import { ToggleGroup } from '../../../../design-system/components/forms/ToggleGroup';
import { Combobox } from '../../../../design-system/components/forms/Combobox';
import { TextField } from '../../../../design-system/components/forms/TextField';
import { DateField } from '../../../../design-system/components/forms/DateField';
import { useTipoCambio } from '../../../../hooks/useTipoCambio';
import { useTesoreriaStore } from '../../../../store/tesoreriaStore';
import type {
  MetodoTesoreria,
  MonedaTesoreria,
} from '../../../../types/tesoreria.types';
import type { PagoAbonoState } from './types';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

interface Paso2Props {
  state: PagoAbonoState;
  setState: React.Dispatch<React.SetStateAction<PagoAbonoState>>;
}

const METODO_OPTIONS = [
  { value: 'transferencia_bancaria', label: 'Transferencia' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'tarjeta_credito', label: 'Tarjeta crédito' },
  { value: 'tarjeta', label: 'Tarjeta débito' },
  { value: 'otro', label: 'Otro' },
];

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const Paso2Abono: React.FC<Paso2Props> = ({ state, setState }) => {
  const { tc } = useTipoCambio();
  const cuentas = useTesoreriaStore((s) => s.cuentas);
  const fetchCuentas = useTesoreriaStore((s) => s.fetchCuentas);
  const cuentasLoading = useTesoreriaStore((s) => s.loading);

  // ── Cargar cuentas si no están en store ──
  useEffect(() => {
    if (cuentas.length === 0) {
      fetchCuentas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-aplicar TC del día si tipoCambio === 0 ──
  useEffect(() => {
    if (state.tipoCambio === 0 && tc?.venta) {
      setState((s) => ({ ...s, tipoCambio: tc.venta }));
    }
  }, [tc, state.tipoCambio, setState]);

  // ── Filtrar cuentas según moneda del abono ──
  const cuentasDisponibles = useMemo(() => {
    return cuentas.filter((c) => {
      if (c.esBiMoneda) return true;
      return c.moneda === state.monedaAbono;
    });
  }, [cuentas, state.monedaAbono]);

  // ── Auto-seleccionar cuenta default si no hay seleccionada ──
  useEffect(() => {
    if (!state.cuentaId && cuentasDisponibles.length > 0) {
      const def =
        cuentasDisponibles.find((c) => c.esCuentaPorDefecto) ??
        cuentasDisponibles[0];
      setState((s) => ({
        ...s,
        cuentaId: def.id,
        cuentaNombre: def.nombre,
      }));
    }
  }, [cuentasDisponibles, state.cuentaId, setState]);

  // ── Re-validar cuenta al cambiar moneda ──
  useEffect(() => {
    if (state.cuentaId) {
      const sigueValida = cuentasDisponibles.some((c) => c.id === state.cuentaId);
      if (!sigueValida) {
        const nueva = cuentasDisponibles[0];
        setState((s) => ({
          ...s,
          cuentaId: nueva?.id,
          cuentaNombre: nueva?.nombre ?? '',
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.monedaAbono, cuentasDisponibles]);

  // ── Cuenta seleccionada para mostrar saldo después ──
  const cuentaSel = useMemo(() => {
    return cuentasDisponibles.find((c) => c.id === state.cuentaId);
  }, [cuentasDisponibles, state.cuentaId]);

  const saldoActualCuenta = useMemo(() => {
    if (!cuentaSel) return undefined;
    if (cuentaSel.esBiMoneda) {
      return state.monedaAbono === 'USD'
        ? (cuentaSel.saldoUSD ?? 0)
        : (cuentaSel.saldoPEN ?? 0);
    }
    return cuentaSel.saldoActual ?? 0;
  }, [cuentaSel, state.monedaAbono]);

  // ── Total adeudado para botón "pagar todo" ──
  const totalAdeudado = useMemo(() => {
    return state.deudas
      .filter((d) => d.moneda === state.monedaAbono)
      .reduce((s, d) => s + d.montoPendiente, 0);
  }, [state.deudas, state.monedaAbono]);

  const totalVencido = useMemo(() => {
    return state.deudas
      .filter((d) => d.estaVencido && d.moneda === state.monedaAbono)
      .reduce((s, d) => s + d.montoPendiente, 0);
  }, [state.deudas, state.monedaAbono]);

  // ── Equivalente en otra moneda ──
  const equivalente = useMemo(() => {
    if (!state.montoAbono || !state.tipoCambio) return undefined;
    return state.monedaAbono === 'USD'
      ? {
          valor: state.montoAbono * state.tipoCambio,
          moneda: 'PEN' as const,
          tcUsado: state.tipoCambio,
        }
      : {
          valor: state.montoAbono / state.tipoCambio,
          moneda: 'USD' as const,
          tcUsado: state.tipoCambio,
        };
  }, [state.montoAbono, state.tipoCambio, state.monedaAbono]);

  // ── Es el TC actualmente del día? ──
  const tcEsDelDia = tc?.venta && Math.abs(state.tipoCambio - tc.venta) < 0.001;

  return (
    <div className="space-y-5">
      {/* Monto + moneda + quick actions */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            Monto del abono
          </label>
          <div className="flex gap-1.5">
            {totalAdeudado > 0 && (
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, montoAbono: totalAdeudado }))}
                className="text-[10px] px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded hover:bg-teal-100"
              >
                Pagar todo ({state.monedaAbono === 'USD' ? 'US$' : 'S/'}{' '}
                {totalAdeudado.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
              </button>
            )}
            {totalVencido > 0 && totalVencido < totalAdeudado && (
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, montoAbono: totalVencido }))}
                className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100"
              >
                Solo vencidas
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-9">
            <MoneyField
              label=""
              value={state.montoAbono}
              onChange={(v) => setState((s) => ({ ...s, montoAbono: v }))}
              moneda={state.monedaAbono}
              equivalente={equivalente}
              autoFocus
            />
          </div>
          <div className="col-span-3 pt-[2px]">
            <ToggleGroup<MonedaTesoreria>
              value={state.monedaAbono}
              onChange={(v) => setState((s) => ({ ...s, monedaAbono: v }))}
              options={[
                { value: 'USD', label: 'USD' },
                { value: 'PEN', label: 'PEN' },
              ]}
              fullWidth
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Cuenta + fecha */}
      <div className="grid grid-cols-2 gap-3">
        <Combobox
          label={state.entidad?.entidadTipo === 'cliente' ? 'Entra a' : 'Sale de'}
          value={state.cuentaId}
          onChange={(v) => {
            const c = cuentasDisponibles.find((c) => c.id === v);
            setState((s) => ({
              ...s,
              cuentaId: v,
              cuentaNombre: c?.nombre ?? '',
            }));
          }}
          groups={[
            {
              options: cuentasDisponibles.map((c) => ({
                value: c.id,
                label: c.nombre,
                subLabel: c.banco
                  ? `${c.banco} · ${c.titularidad === 'personal' ? 'Personal' : 'Empresa'}`
                  : c.tipo,
                badge: (
                  <span className="text-[10px] tabular-nums text-slate-500">
                    {state.monedaAbono === 'USD' ? 'US$' : 'S/'}{' '}
                    {(c.esBiMoneda
                      ? state.monedaAbono === 'USD'
                        ? (c.saldoUSD ?? 0)
                        : (c.saldoPEN ?? 0)
                      : (c.saldoActual ?? 0)
                    ).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                ),
              })),
            },
          ]}
          placeholder="Seleccionar cuenta..."
          hint={
            cuentaSel && saldoActualCuenta !== undefined && state.montoAbono
              ? `Saldo: ${state.monedaAbono === 'USD' ? 'US$' : 'S/'} ${saldoActualCuenta.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → ${state.monedaAbono === 'USD' ? 'US$' : 'S/'} ${(saldoActualCuenta - state.montoAbono).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : cuentaSel && saldoActualCuenta !== undefined
                ? `Saldo: ${state.monedaAbono === 'USD' ? 'US$' : 'S/'} ${saldoActualCuenta.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : cuentasLoading
                  ? 'Cargando cuentas...'
                  : `No hay cuentas en ${state.monedaAbono}`
          }
          emptyMessage="Sin cuentas disponibles"
        />

        <DateField
          label="Fecha"
          value={state.fecha}
          onChange={(v) => v && setState((s) => ({ ...s, fecha: v }))}
          showShortcuts
        />
      </div>

      {/* Método + TC */}
      <div className="grid grid-cols-2 gap-3">
        <Combobox
          label="Método"
          value={state.metodo}
          onChange={(v) =>
            setState((s) => ({ ...s, metodo: v as MetodoTesoreria }))
          }
          groups={[{ options: METODO_OPTIONS }]}
          placeholder="Método de pago..."
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Tipo de cambio
            </label>
            {tcEsDelDia && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                Día ({tc?.venta.toFixed(3)})
              </span>
            )}
            {!tcEsDelDia && tc?.venta && (
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, tipoCambio: tc.venta }))}
                className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium hover:bg-amber-100"
              >
                Usar día ({tc.venta.toFixed(3)})
              </button>
            )}
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
                }))
              }
              className="w-full h-10 pl-3 pr-10 text-sm border border-slate-300 rounded-md bg-white tabular-nums focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              placeholder="3.700"
            />
            <Banknote className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Referencia */}
      <TextField
        label="Nro de operación / referencia"
        value={state.referencia}
        onChange={(v) => setState((s) => ({ ...s, referencia: v }))}
        placeholder="Ej: Zelle #ZL-2026-0427-001"
        optional
      />
    </div>
  );
};
