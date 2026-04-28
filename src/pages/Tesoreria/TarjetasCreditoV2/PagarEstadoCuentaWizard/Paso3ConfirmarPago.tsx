/**
 * Paso 3 — Confirmar pago · S58d F4
 *
 * Vista doble según modo:
 *
 *   - 'banco_emisor':
 *     Hero amber + tabla diferencial cambiario por cargo
 *     (TC del cargo vs TC del pago) + total Δ
 *
 *   - 'reembolso_titular':
 *     Hero sky + lista de cargos saldados (sin tabla diferencial)
 *     + nota "sin diferencial cambiario"
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Coins,
  CircleCheck,
  IdCard,
  Building,
  Lightbulb,
  Info,
} from 'lucide-react';
import { useEffect as _useEffect } from 'react';
import { pagoEstadoCuentaTarjetaService } from '../../../../services/pagoEstadoCuentaTarjeta.service';
import type { CargoTarjeta } from '../../../../types/tarjetaCredito.types';
import { cn } from '../../../../design-system/utils';
import type { PagarEstadoCuentaState } from './types';
import { getMontoTotal } from './types';

interface Paso3Props {
  state: PagarEstadoCuentaState;
  setState: React.Dispatch<React.SetStateAction<PagarEstadoCuentaState>>;
}

function formatMoney(n: number, moneda: 'USD' | 'PEN'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcularDiferencial(
  cargoTcDelDia: number,
  tcPago: number,
  montoAplicado: number,
): number {
  return (cargoTcDelDia - tcPago) * montoAplicado;
}

export const Paso3ConfirmarPago: React.FC<Paso3Props> = ({
  state,
  setState,
}) => {
  const total = getMontoTotal(state);
  const [cargosFull, setCargosFull] = useState<CargoTarjeta[]>([]);
  const [loadingCargos, setLoadingCargos] = useState(false);
  void _useEffect; // silenciar import

  // Cargar info completa de los cargos seleccionados (para tcDelDia)
  useEffect(() => {
    let cancelled = false;
    if (!state.tarjeta) return;
    setLoadingCargos(true);
    pagoEstadoCuentaTarjetaService
      .getCargosByTarjeta(state.tarjeta.id)
      .then((list) => {
        if (cancelled) return;
        const seleccionados = state.aplicaciones
          .map((app) => list.find((c) => c.id === app.cargoId))
          .filter((c): c is CargoTarjeta => !!c);
        setCargosFull(seleccionados);
      })
      .catch(() => {
        if (!cancelled) setCargosFull([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCargos(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tarjeta?.id]);

  // Diferencial cambiario por cargo (solo modo banco_emisor)
  const diferencialPorCargo = useMemo(() => {
    if (state.modo !== 'banco_emisor') return [];
    return state.aplicaciones.map((app) => {
      const cargo = cargosFull.find((c) => c.id === app.cargoId);
      const tcCargo = cargo?.tcDelDia ?? 0;
      const diferencial = tcCargo
        ? calcularDiferencial(tcCargo, state.tipoCambio, app.montoAplicado)
        : 0;
      return {
        ...app,
        cargoMonto: cargo?.monto ?? app.montoAplicado,
        cargoMoneda: cargo?.moneda ?? state.monedaPago,
        tcCargo,
        diferencial,
      };
    });
  }, [state.modo, state.aplicaciones, state.tipoCambio, state.monedaPago, cargosFull]);

  const diferencialTotalPEN = useMemo(
    () => diferencialPorCargo.reduce((s, d) => s + d.diferencial, 0),
    [diferencialPorCargo],
  );

  const equivalentePEN = useMemo(() => {
    if (!total || !state.tipoCambio) return null;
    return state.monedaPago === 'USD'
      ? total * state.tipoCambio
      : total / state.tipoCambio;
  }, [total, state.tipoCambio, state.monedaPago]);

  const monedaEquiv: 'USD' | 'PEN' =
    state.monedaPago === 'USD' ? 'PEN' : 'USD';

  if (!state.tarjeta) {
    return (
      <div className="text-[12px] text-slate-500">
        Volve al Paso 1 — falta tarjeta seleccionada.
      </div>
    );
  }

  const heroColor =
    state.modo === 'reembolso_titular'
      ? {
          gradient: 'from-sky-50 to-white',
          border: 'border-sky-200',
          text: 'text-sky-700',
        }
      : {
          gradient: 'from-amber-50 to-white',
          border: 'border-amber-200',
          text: 'text-amber-700',
        };

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div
        className={cn(
          'bg-gradient-to-br border-2 rounded-xl p-5',
          heroColor.gradient,
          heroColor.border,
        )}
      >
        <div className="text-center">
          <div
            className={cn(
              'text-[11px] uppercase tracking-wider font-semibold mb-1',
              heroColor.text,
            )}
          >
            {state.modo === 'reembolso_titular'
              ? `A reembolsar a ${state.tarjeta.titularNombre || 'titular'}`
              : `Pagarás al banco ${state.tarjeta.banco}`}
          </div>
          <div
            className={cn(
              'text-3xl font-bold tabular-nums',
              heroColor.text,
            )}
          >
            {formatMoney(total, state.monedaPago)}
          </div>
          {equivalentePEN && (
            <div className="text-[12px] text-slate-600 mt-1">
              ≈ {formatMoney(equivalentePEN, monedaEquiv)} al TC{' '}
              {state.tipoCambio.toFixed(3)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-200/60">
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
              Desde
            </div>
            <div className="text-[13px] font-semibold text-slate-900 truncate">
              {state.cuentaOrigenNombre}
            </div>
            <div className="text-[10px] text-slate-500">
              {state.aplicaciones.length} cargo
              {state.aplicaciones.length !== 1 ? 's' : ''} a saldar
            </div>
          </div>
        </div>
      </div>

      {/* MODO BANCO_EMISOR — Tabla diferencial cambiario */}
      {state.modo === 'banco_emisor' && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
            Vista previa del diferencial cambiario
          </div>
          {loadingCargos ? (
            <div className="text-[12px] text-slate-500 text-center py-4">
              Cargando datos…
            </div>
          ) : (
            <>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[9px] uppercase tracking-wider text-slate-600 font-semibold bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2">Cargo</th>
                      <th className="text-right px-3 py-2">Monto</th>
                      <th className="text-right px-3 py-2">TC cargo</th>
                      <th className="text-right px-3 py-2">TC pago</th>
                      <th className="text-right px-3 py-2">Δ (PEN)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {diferencialPorCargo.map((d) => (
                      <tr key={d.cargoId}>
                        <td className="px-3 py-2.5 font-mono">
                          {d.cargoNumero}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatMoney(d.montoAplicado, state.monedaPago)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {d.tcCargo ? d.tcCargo.toFixed(3) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {state.tipoCambio.toFixed(3)}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2.5 text-right tabular-nums font-bold',
                            d.diferencial > 0.01
                              ? 'text-emerald-700'
                              : d.diferencial < -0.01
                                ? 'text-red-700'
                                : 'text-slate-400',
                          )}
                        >
                          {d.diferencial === 0
                            ? '—'
                            : `${d.diferencial > 0 ? '+' : ''}${d.diferencial.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300">
                      <td className="px-3 py-3 font-bold text-slate-900">
                        Total
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-bold">
                        {formatMoney(total, state.monedaPago)}
                      </td>
                      <td className="px-3 py-3 text-slate-400">—</td>
                      <td className="px-3 py-3 text-slate-400">—</td>
                      <td
                        className={cn(
                          'px-3 py-3 text-right tabular-nums font-bold',
                          diferencialTotalPEN > 0.01
                            ? 'text-emerald-700'
                            : diferencialTotalPEN < -0.01
                              ? 'text-red-700'
                              : 'text-slate-500',
                        )}
                      >
                        {diferencialTotalPEN === 0
                          ? '—'
                          : `${diferencialTotalPEN > 0 ? '+' : ''}S/ ${diferencialTotalPEN.toFixed(2)}`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Insight diferencial */}
              {Math.abs(diferencialTotalPEN) > 0.01 && (
                <div
                  className={cn(
                    'mt-3 border-l-4 rounded-r-md p-3 flex items-start gap-2',
                    diferencialTotalPEN > 0
                      ? 'bg-emerald-50 border-emerald-500'
                      : 'bg-red-50 border-red-500',
                  )}
                >
                  <Lightbulb
                    className={cn(
                      'w-4 h-4 mt-0.5 flex-shrink-0',
                      diferencialTotalPEN > 0
                        ? 'text-emerald-600'
                        : 'text-red-600',
                    )}
                  />
                  <div
                    className={cn(
                      'text-[12px]',
                      diferencialTotalPEN > 0
                        ? 'text-emerald-900'
                        : 'text-red-900',
                    )}
                  >
                    <strong>
                      {diferencialTotalPEN > 0 ? 'Estás ganando' : 'Estás perdiendo'}{' '}
                      S/ {Math.abs(diferencialTotalPEN).toFixed(2)}
                    </strong>{' '}
                    en este pago.
                    {diferencialTotalPEN > 0
                      ? ' El USD del Pool entró más barato y los cargos fueron registrados a TC más altos.'
                      : ' El TC del pago es mayor al de los cargos — TC subió en el período.'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* MODO REEMBOLSO — Lista simple */}
      {state.modo === 'reembolso_titular' && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
            Cargos a saldar
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-slate-600 font-semibold bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2">Cargo</th>
                  <th className="text-left px-3 py-2">Descripción</th>
                  <th className="text-right px-3 py-2">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.aplicaciones.map((app) => {
                  const cargo = cargosFull.find((c) => c.id === app.cargoId);
                  return (
                    <tr key={app.cargoId}>
                      <td className="px-3 py-2.5 font-mono">{app.cargoNumero}</td>
                      <td className="px-3 py-2.5 text-slate-600 truncate max-w-[240px]">
                        {cargo?.descripcion || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatMoney(app.montoAplicado, state.monedaPago)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300">
                  <td className="px-3 py-3 font-bold text-slate-900" colSpan={2}>
                    Total
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold">
                    {formatMoney(total, state.monedaPago)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Lo que se ejecutará */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Al confirmar se ejecutará
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2 p-2.5 border border-slate-200 rounded-md">
            <ArrowLeftRight className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-[12px]">
              <div className="font-semibold text-slate-900">
                1 movimiento de tesorería
              </div>
              <div className="text-[11px] text-slate-500">
                Egreso de {formatMoney(total, state.monedaPago)} desde{' '}
                {state.cuentaOrigenNombre}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 border border-slate-200 rounded-md">
            <Coins className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-[12px]">
              <div className="font-semibold text-slate-900">
                1 crédito en CC de la tarjeta
              </div>
              <div className="text-[11px] text-slate-500">
                {state.tarjeta.nombre} ····{state.tarjeta.ultimosDigitos}: saldo
                baja en {formatMoney(total, state.monedaPago)}
              </div>
            </div>
          </div>

          {state.modo === 'reembolso_titular' && (
            <div className="flex items-start gap-2 p-2.5 border border-sky-200 bg-sky-50/40 rounded-md">
              <IdCard className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-[12px]">
                <div className="font-semibold text-sky-900">
                  1 ingreso en CC de {state.tarjeta.titularNombre}
                </div>
                <div className="text-[11px] text-sky-700">
                  Su CC personal queda con la deuda saldada · sin diferencial
                  cambiario
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 p-2.5 border border-slate-200 rounded-md">
            <CircleCheck className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-[12px]">
              <div className="font-semibold text-slate-900">
                {state.aplicaciones.length} cargo
                {state.aplicaciones.length !== 1 ? 's' : ''} actualizado
                {state.aplicaciones.length !== 1 ? 's' : ''}
              </div>
              <div className="text-[11px] text-slate-500">
                Estado de los cargos: pasan a "saldado" o "parcial"
                {state.modo === 'banco_emisor' &&
                  ' · Diferencial cambiario registrado por cargo'}
              </div>
            </div>
          </div>

          {state.modo === 'reembolso_titular' && (
            <div className="flex items-start gap-2 p-2.5 border border-slate-200 rounded-md opacity-60">
              <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-[12px]">
                <div className="font-semibold text-slate-700">
                  Sin diferencial cambiario
                </div>
                <div className="text-[11px] text-slate-500">
                  El titular asume su propio diferencial al pagar al banco con
                  plata mixta. El sistema solo registra el reembolso.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
          Notas internas (opcional)
        </label>
        <textarea
          rows={2}
          value={state.notas}
          onChange={(e) => setState((s) => ({ ...s, notas: e.target.value }))}
          placeholder={
            state.modo === 'reembolso_titular'
              ? 'Ej: Reembolso compras de febrero · Jose'
              : 'Ej: Pago estado de cuenta marzo · BCP Mastercard'
          }
          className={cn(
            'w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white placeholder:text-slate-400 resize-none outline-none',
            state.modo === 'reembolso_titular'
              ? 'focus:ring-2 focus:ring-sky-500 focus:border-sky-500'
              : 'focus:ring-2 focus:ring-amber-500 focus:border-amber-500',
          )}
        />
      </div>
    </div>
  );
};

void Building;
