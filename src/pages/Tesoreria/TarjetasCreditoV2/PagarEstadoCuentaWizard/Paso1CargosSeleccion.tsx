/**
 * Paso 1 — Tarjeta + selección de cargos pendientes · S58d F4
 *
 * Tabla con todos los cargos no pagados de la tarjeta. Usuario marca
 * cuáles saldar y opcionalmente edita el monto (default: pendiente
 * completo). El total se calcula sumando montoAplicado.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  CheckCheck,
  X,
  CircleAlert,
  Building,
  IdCard,
} from 'lucide-react';
import { Combobox } from '../../../../design-system/components/forms/Combobox';
import { useTarjetaCreditoStore } from '../../../../store/tarjetaCreditoStore';
import { pagoEstadoCuentaTarjetaService } from '../../../../services/pagoEstadoCuentaTarjeta.service';
import type { CargoTarjeta } from '../../../../types/tarjetaCredito.types';
import { cn } from '../../../../design-system/utils';
import type { PagarEstadoCuentaState } from './types';

interface Paso1Props {
  state: PagarEstadoCuentaState;
  setState: React.Dispatch<React.SetStateAction<PagarEstadoCuentaState>>;
}

const TOLERANCIA = 0.01;

function formatMoney(n: number, moneda: 'USD' | 'PEN'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function diasDesde(fechaMs: number): number {
  return Math.floor((Date.now() - fechaMs) / (24 * 60 * 60 * 1000));
}

export const Paso1CargosSeleccion: React.FC<Paso1Props> = ({ state, setState }) => {
  const { tarjetas, fetchTarjetas } = useTarjetaCreditoStore();

  const [cargos, setCargos] = useState<CargoTarjeta[]>([]);
  const [loadingCargos, setLoadingCargos] = useState(false);

  // Cargar tarjetas al montar
  useEffect(() => {
    if (tarjetas.length === 0) void fetchTarjetas();
  }, [tarjetas.length, fetchTarjetas]);

  // Cargar cargos pendientes cuando cambia la tarjeta
  useEffect(() => {
    let cancelled = false;
    if (!state.tarjeta) {
      setCargos([]);
      return;
    }
    setLoadingCargos(true);
    pagoEstadoCuentaTarjetaService
      .getCargosPendientes(state.tarjeta.id)
      .then((list) => {
        if (cancelled) return;
        // Filtrar por moneda del pago (consistencia)
        const filtrados = list.filter(
          (c) => c.moneda === (state.tarjeta?.moneda ?? state.monedaPago),
        );
        setCargos(filtrados);
      })
      .catch(() => {
        if (!cancelled) setCargos([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCargos(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tarjeta?.id]);

  // Tarjetas activas como combobox
  const tarjetaGroups = useMemo(() => {
    const activas = tarjetas.filter((t) => t.activa);
    if (activas.length === 0) return [];

    // Separar por titularidad
    const empresariales = activas.filter(
      (t) => (t.titularidad ?? 'empresa') === 'empresa',
    );
    const personales = activas.filter((t) => t.titularidad === 'personal');

    const groups: Array<{
      label: string;
      options: Array<{ value: string; label: string; subLabel?: string }>;
    }> = [];

    if (empresariales.length > 0) {
      groups.push({
        label: `Empresariales · paga al banco · ${empresariales.length}`,
        options: empresariales.map((t) => ({
          value: t.id,
          label: t.nombre,
          subLabel: `${t.banco} · ····${t.ultimosDigitos} · ${t.moneda}`,
        })),
      });
    }
    if (personales.length > 0) {
      groups.push({
        label: `Personales · reembolso al titular · ${personales.length}`,
        options: personales.map((t) => ({
          value: t.id,
          label: t.nombre,
          subLabel: `${t.banco} · ····${t.ultimosDigitos} · titular: ${t.titularNombre || '(sin nombre)'}`,
        })),
      });
    }
    return groups;
  }, [tarjetas]);

  const handleSeleccionarTarjeta = (tarjetaId: string) => {
    const t = tarjetas.find((x) => x.id === tarjetaId);
    if (!t) return;
    const inferModo: 'banco_emisor' | 'reembolso_titular' =
      t.titularidad === 'personal' ? 'reembolso_titular' : 'banco_emisor';
    setState((s) => ({
      ...s,
      tarjeta: t,
      modo: inferModo,
      monedaPago: t.moneda,
      aplicaciones: [], // reset
    }));
  };

  // ── Helpers selección cargos ──
  const incluirTodos = () => {
    setState((s) => ({
      ...s,
      aplicaciones: cargos.map((c) => ({
        cargoId: c.id,
        cargoNumero: c.numeroCargo,
        montoAplicado: c.montoPendiente,
      })),
    }));
  };

  const limpiarTodos = () => {
    setState((s) => ({ ...s, aplicaciones: [] }));
  };

  const toggleCargo = (cargoId: string, incluir: boolean) => {
    if (incluir) {
      const cargo = cargos.find((c) => c.id === cargoId);
      if (!cargo) return;
      setState((s) => ({
        ...s,
        aplicaciones: [
          ...s.aplicaciones,
          {
            cargoId: cargo.id,
            cargoNumero: cargo.numeroCargo,
            montoAplicado: cargo.montoPendiente,
          },
        ],
      }));
    } else {
      setState((s) => ({
        ...s,
        aplicaciones: s.aplicaciones.filter((a) => a.cargoId !== cargoId),
      }));
    }
  };

  const setMonto = (cargoId: string, monto: number) => {
    setState((s) => ({
      ...s,
      aplicaciones: s.aplicaciones.map((a) =>
        a.cargoId === cargoId ? { ...a, montoAplicado: monto } : a,
      ),
    }));
  };

  const total = state.aplicaciones.reduce((s, a) => s + a.montoAplicado, 0);
  const totalCargos = cargos.reduce((s, c) => s + c.montoPendiente, 0);
  const incluidos = state.aplicaciones.length;

  return (
    <div className="space-y-4">
      {/* Selección de tarjeta */}
      <Combobox
        label="Tarjeta de crédito a saldar"
        value={state.tarjeta?.id}
        onChange={handleSeleccionarTarjeta}
        groups={tarjetaGroups}
        placeholder={
          tarjetas.length === 0
            ? 'Cargando tarjetas…'
            : tarjetaGroups.length === 0
              ? 'No hay tarjetas activas'
              : 'Seleccionar tarjeta…'
        }
        emptyMessage="Sin tarjetas disponibles"
      />

      {/* Banner modo */}
      {state.tarjeta && (
        <div
          className={cn(
            'border-l-4 rounded-r-md p-3 flex items-start gap-2',
            state.modo === 'reembolso_titular'
              ? 'bg-sky-50 border-sky-500'
              : 'bg-amber-50 border-amber-500',
          )}
        >
          {state.modo === 'reembolso_titular' ? (
            <IdCard className="w-4 h-4 text-sky-700 mt-0.5 flex-shrink-0" />
          ) : (
            <Building className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 text-[12px]">
            <div
              className={cn(
                'font-semibold',
                state.modo === 'reembolso_titular'
                  ? 'text-sky-900'
                  : 'text-amber-900',
              )}
            >
              Modo:{' '}
              {state.modo === 'reembolso_titular'
                ? `Reembolso a ${state.tarjeta.titularNombre || 'titular'}`
                : `Pago al banco ${state.tarjeta.banco}`}
            </div>
            <div
              className={cn(
                'text-[11px] mt-0.5',
                state.modo === 'reembolso_titular'
                  ? 'text-sky-800'
                  : 'text-amber-800',
              )}
            >
              {state.modo === 'reembolso_titular'
                ? 'Sin diferencial cambiario · el titular ya lo asumió al pagar al banco con plata mixta'
                : 'Diferencial cambiario calculado contra TCPA del Pool USD'}
            </div>
          </div>
        </div>
      )}

      {/* Lista de cargos pendientes */}
      {state.tarjeta && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[11px] text-slate-600">
              <strong className="text-slate-900">{incluidos}</strong> de{' '}
              {cargos.length} cargo{cargos.length !== 1 ? 's' : ''} seleccionados
              {' · '}
              <strong
                className={cn(
                  'tabular-nums',
                  state.modo === 'reembolso_titular'
                    ? 'text-sky-700'
                    : 'text-amber-700',
                )}
              >
                {formatMoney(total, state.monedaPago)}
              </strong>
            </div>
            {cargos.length > 0 && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={incluirTodos}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded border flex items-center gap-1',
                    state.modo === 'reembolso_titular'
                      ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
                  )}
                >
                  <CheckCheck className="w-3 h-3" />
                  Incluir todos ({cargos.length})
                </button>
                {incluidos > 0 && (
                  <button
                    type="button"
                    onClick={limpiarTodos}
                    className="text-[10px] px-2 py-1 bg-white text-slate-600 border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>

          {loadingCargos ? (
            <div className="text-center py-8 text-[12px] text-slate-500 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
              Cargando cargos pendientes…
            </div>
          ) : cargos.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
              <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-[12px] text-slate-500 font-medium">
                Sin cargos pendientes
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Esta tarjeta no tiene cargos por pagar en {state.monedaPago}.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="text-[10px] uppercase text-slate-500 font-semibold border-b border-slate-200">
                      <th className="text-left py-2 px-3 w-10">Inc.</th>
                      <th className="text-left py-2 pr-2">Cargo</th>
                      <th className="text-right py-2 pr-2">Pendiente</th>
                      <th className="text-right py-2 pr-2 w-32">A pagar</th>
                      <th className="text-left py-2 px-3 w-32">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cargos.map((cargo) => {
                      const app = state.aplicaciones.find(
                        (a) => a.cargoId === cargo.id,
                      );
                      const incluido = !!app && app.montoAplicado > 0;
                      const aplicado = app?.montoAplicado ?? 0;
                      const queda = cargo.montoPendiente - aplicado;
                      const cubreTotal =
                        aplicado >= cargo.montoPendiente - TOLERANCIA;
                      const esParcial = aplicado > TOLERANCIA && !cubreTotal;
                      const exceso = aplicado > cargo.montoPendiente + TOLERANCIA;

                      const diasAtras = cargo.fecha
                        ? diasDesde(cargo.fecha.toMillis())
                        : 0;

                      return (
                        <tr
                          key={cargo.id}
                          className={cn(
                            'hover:bg-slate-50/50 transition-colors',
                            !incluido && 'opacity-60',
                            esParcial && 'bg-amber-50/30',
                            exceso && 'bg-red-50/30',
                          )}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={incluido}
                              onChange={(e) =>
                                toggleCargo(cargo.id, e.target.checked)
                              }
                              className="rounded text-amber-600 focus:ring-amber-500"
                            />
                          </td>
                          <td className="py-2.5 pr-2">
                            <div className="font-mono font-semibold text-slate-900">
                              {cargo.numeroCargo}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                              {cargo.descripcion || '—'}
                            </div>
                            {diasAtras > 0 && (
                              <div className="text-[9px] text-slate-400">
                                Hace {diasAtras}d
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pr-2 text-right tabular-nums">
                            {formatMoney(cargo.montoPendiente, cargo.moneda)}
                            {cargo.estado === 'parcial' && (
                              <div className="text-[9px] text-amber-700">
                                de {formatMoney(cargo.monto, cargo.moneda)}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pr-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={aplicado || ''}
                              placeholder="—"
                              onChange={(e) =>
                                setMonto(
                                  cargo.id,
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              disabled={!incluido}
                              className={cn(
                                'w-24 h-7 px-2 text-[11px] rounded text-right tabular-nums bg-white outline-none focus:ring-1',
                                state.modo === 'reembolso_titular'
                                  ? 'focus:ring-sky-500'
                                  : 'focus:ring-amber-500',
                                exceso
                                  ? 'border border-red-400'
                                  : esParcial
                                    ? 'border border-amber-400'
                                    : cubreTotal
                                      ? 'border border-emerald-400'
                                      : 'border border-slate-300',
                                !incluido && 'bg-slate-50 cursor-not-allowed',
                              )}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            {!incluido ? (
                              <span className="text-[10px] text-slate-400">
                                No incluido
                              </span>
                            ) : exceso ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold flex items-center gap-1">
                                <CircleAlert className="w-2.5 h-2.5" />
                                Excede
                              </span>
                            ) : cubreTotal ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                                Saldado
                              </span>
                            ) : (
                              <>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                                  Parcial
                                </span>
                                <div className="text-[9px] text-amber-700 mt-0.5 tabular-nums">
                                  Resta {formatMoney(queda, cargo.moneda)}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer balance */}
          {cargos.length > 0 && (
            <div
              className={cn(
                'rounded-lg px-4 py-3 border',
                state.modo === 'reembolso_titular'
                  ? 'bg-sky-50 border-sky-200'
                  : 'bg-amber-50 border-amber-200',
              )}
            >
              <div className="grid grid-cols-3 gap-3 text-center text-[12px]">
                <div>
                  <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
                    Total pendiente
                  </div>
                  <div className="font-bold text-slate-900 tabular-nums">
                    {formatMoney(totalCargos, state.monedaPago)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
                    A pagar
                  </div>
                  <div
                    className={cn(
                      'font-bold tabular-nums',
                      state.modo === 'reembolso_titular'
                        ? 'text-sky-700'
                        : 'text-amber-700',
                    )}
                  >
                    {formatMoney(total, state.monedaPago)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
                    Quedará pendiente
                  </div>
                  <div className="font-bold text-slate-700 tabular-nums">
                    {formatMoney(Math.max(0, totalCargos - total), state.monedaPago)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

