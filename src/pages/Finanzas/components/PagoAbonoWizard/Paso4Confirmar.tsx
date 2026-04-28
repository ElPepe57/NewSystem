/**
 * Paso 4 — Confirmar y ejecutar
 *
 * Hero con el monto + datos del pago + lista visual de "lo que va a pasar".
 * Notas opcionales. El submit lo dispara el footer del shell del wizard.
 */

import React, { useMemo } from 'react';
import { ArrowLeftRight, Coins, CircleCheck, FileText, PiggyBank } from 'lucide-react';
import type { PagoAbonoState } from './types';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

interface Paso4Props {
  state: PagoAbonoState;
  setState: React.Dispatch<React.SetStateAction<PagoAbonoState>>;
}

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia_bancaria: 'Transferencia',
  yape: 'Yape',
  plin: 'Plin',
  zelle: 'Zelle',
  paypal: 'PayPal',
  mercado_pago: 'Mercado Pago',
  tarjeta: 'Tarjeta débito',
  tarjeta_credito: 'Tarjeta crédito',
  prestamo_viajero: 'Préstamo viajero',
  otro: 'Otro',
};

function formatMoney(n: number, moneda: 'USD' | 'PEN'): string {
  const symbol = moneda === 'USD' ? 'US$' : 'S/';
  return `${symbol} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const Paso4Confirmar: React.FC<Paso4Props> = ({ state, setState }) => {
  const docsTotalmentePagados = useMemo(() => {
    return state.distribucion.filter((item) => {
      const deuda = state.deudas.find((d) => d.documentoId === item.documentoId);
      if (!deuda) return false;
      return item.montoAplicado >= deuda.montoPendiente - 0.01;
    });
  }, [state.distribucion, state.deudas]);

  const docsParciales = state.distribucion.length - docsTotalmentePagados.length;

  // S58b F6 — Saldo a favor (Σ distribución < montoAbono)
  const saldoAFavor = useMemo(() => {
    const sumaDistribuido = state.distribucion.reduce(
      (s, d) => s + d.montoAplicado,
      0,
    );
    const dif = (state.montoAbono ?? 0) - sumaDistribuido;
    return dif > 0.01 ? dif : 0;
  }, [state.distribucion, state.montoAbono]);

  const equivalente = useMemo(() => {
    if (!state.montoAbono || !state.tipoCambio) return null;
    return state.monedaAbono === 'USD'
      ? state.montoAbono * state.tipoCambio
      : state.montoAbono / state.tipoCambio;
  }, [state.montoAbono, state.tipoCambio, state.monedaAbono]);

  const monedaEquivalente: 'USD' | 'PEN' =
    state.monedaAbono === 'USD' ? 'PEN' : 'USD';

  const fechaFormateada = state.fecha.toLocaleDateString('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      {/* Hero del pago */}
      <div className="bg-gradient-to-br from-teal-50 to-white border-2 border-teal-200 rounded-xl p-5">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-wider text-teal-700 font-semibold mb-1">
            {state.entidad?.entidadTipo === 'cliente' ? 'Cobrarás' : 'Pagarás'}
          </div>
          <div className="text-3xl font-bold text-teal-700 tabular-nums">
            {formatMoney(state.montoAbono ?? 0, state.monedaAbono)}
          </div>
          {equivalente && (
            <div className="text-[12px] text-slate-600 mt-1">
              ≈ {formatMoney(equivalente, monedaEquivalente)} al TC{' '}
              {state.tipoCambio.toFixed(3)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-teal-200/60">
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
              {state.entidad?.entidadTipo === 'cliente' ? 'De' : 'A'}
            </div>
            <div className="text-[13px] font-semibold text-slate-900 truncate">
              {state.entidad?.entidadNombre ?? '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">
              {state.entidad?.entidadTipo === 'cliente' ? 'Entra a' : 'Desde'}
            </div>
            <div className="text-[13px] font-semibold text-slate-900 truncate">
              {state.cuentaNombre || '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2 text-[11px] text-slate-600">
          <div>
            {fechaFormateada} · {METODO_LABEL[state.metodo] ?? state.metodo}
          </div>
          {state.referencia && (
            <div className="text-right truncate">Ref: {state.referencia}</div>
          )}
        </div>
      </div>

      {/* Lo que va a pasar */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Al confirmar se ejecutará
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2 p-2.5 border border-slate-200 rounded-md bg-white">
            <ArrowLeftRight className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-slate-900">
                1 movimiento de tesorería
              </div>
              <div className="text-[11px] text-slate-500">
                {state.entidad?.entidadTipo === 'cliente' ? 'Ingreso' : 'Egreso'}{' '}
                de {formatMoney(state.montoAbono ?? 0, state.monedaAbono)}{' '}
                {state.entidad?.entidadTipo === 'cliente' ? 'a' : 'desde'}{' '}
                {state.cuentaNombre}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 border border-slate-200 rounded-md bg-white">
            <Coins className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-slate-900">
                {state.distribucion.length + (saldoAFavor > 0.01 ? 1 : 0)}{' '}
                {state.distribucion.length + (saldoAFavor > 0.01 ? 1 : 0) === 1
                  ? 'movimiento'
                  : 'movimientos'}{' '}
                en cuenta corriente
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {state.entidad?.entidadNombre} ·{' '}
                {state.distribucion.map((d) => d.documentoNumero).join(', ')}
                {saldoAFavor > 0.01 && state.distribucion.length > 0 && ', '}
                {saldoAFavor > 0.01 && (
                  <span className="text-sky-700">anticipo</span>
                )}
              </div>
            </div>
          </div>

          {docsTotalmentePagados.length > 0 && (
            <div className="flex items-start gap-2 p-2.5 border border-emerald-200 bg-emerald-50/40 rounded-md">
              <CircleCheck className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-emerald-900">
                  {docsTotalmentePagados.length}{' '}
                  {docsTotalmentePagados.length === 1
                    ? 'documento cerrado'
                    : 'documentos cerrados'}
                </div>
                <div className="text-[11px] text-emerald-700 truncate">
                  {docsTotalmentePagados.map((d) => d.documentoNumero).join(', ')}{' '}
                  pasa{docsTotalmentePagados.length === 1 ? '' : 'n'} a{' '}
                  <strong>Pagado</strong>
                </div>
              </div>
            </div>
          )}

          {docsParciales > 0 && (
            <div className="flex items-start gap-2 p-2.5 border border-amber-200 bg-amber-50/40 rounded-md">
              <FileText className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-amber-900">
                  {docsParciales}{' '}
                  {docsParciales === 1 ? 'documento parcial' : 'documentos parciales'}
                </div>
                <div className="text-[11px] text-amber-700">
                  Quedará{docsParciales === 1 ? '' : 'n'} con saldo pendiente
                </div>
              </div>
            </div>
          )}

          {saldoAFavor > 0.01 && (
            <div className="flex items-start gap-2 p-2.5 border border-sky-200 bg-sky-50/40 rounded-md">
              <PiggyBank className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-sky-900">
                  Saldo a favor en CC ·{' '}
                  {formatMoney(saldoAFavor, state.monedaAbono)}
                </div>
                <div className="text-[11px] text-sky-700">
                  {state.entidad?.entidadTipo === 'cliente'
                    ? `Quedará como anticipo del cliente · aplicable a futuras ventas`
                    : `Quedará como anticipo a aplicar · usable en futuras ${state.entidad?.entidadTipo === 'proveedor' ? 'OCs' : 'transacciones'}`}
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
          placeholder="Ej: Pago consolidado mensual abril"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white placeholder:text-slate-400 resize-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
        />
      </div>
    </div>
  );
};
