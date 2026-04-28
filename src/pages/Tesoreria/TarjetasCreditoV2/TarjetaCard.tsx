/**
 * TarjetaCard — S58d v2
 *
 * Card visual de una tarjeta de crédito con gradiente bancario y datos del
 * mockup. Diferencia visualmente:
 *   - Empresarial (banco emisor) → emerald hint
 *   - Personal (de empleado/colaborador) → sky hint
 *
 * Saldo se lee desde la CC espejo (`useSaldoCCTarjeta`) — fuente de verdad.
 */

import React from 'react';
import { ArrowRight, Building, IdCard } from 'lucide-react';
import { cn } from '../../../design-system/utils';
import type { TarjetaCredito } from '../../../types/tarjetaCredito.types';
import { useSaldoCCTarjeta, useCargosPendientes } from './hooks';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface TarjetaCardProps {
  tarjeta: TarjetaCredito;
  onClick?: (tarjeta: TarjetaCredito) => void;
  /** Si true, muestra acciones rápidas (Cargar / Pagar) en hover. */
  withActions?: boolean;
  onCargar?: (tarjeta: TarjetaCredito) => void;
  onPagar?: (tarjeta: TarjetaCredito) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Gradiente del plástico según marca y banco.
 * Sigue las paletas del mockup (sky/blue para BBVA, indigo para BCP, etc).
 */
function getCardGradient(banco: string, marca?: string): string {
  const b = banco.toLowerCase();
  if (b.includes('bbva'))
    return 'bg-gradient-to-br from-blue-700 to-blue-500';
  if (b.includes('bcp'))
    return 'bg-gradient-to-br from-indigo-800 to-sky-500';
  if (b.includes('interbank') || b.includes('ibk'))
    return 'bg-gradient-to-br from-emerald-700 to-emerald-500';
  if (b.includes('scotia'))
    return 'bg-gradient-to-br from-red-700 to-red-500';
  if (marca === 'amex')
    return 'bg-gradient-to-br from-slate-800 to-slate-600';
  // Default
  return 'bg-gradient-to-br from-slate-700 to-slate-500';
}

function fmtMoney(n: number, moneda: 'USD' | 'PEN'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${Math.abs(n).toLocaleString('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export const TarjetaCard: React.FC<TarjetaCardProps> = ({
  tarjeta,
  onClick,
}) => {
  const titularidad = tarjeta.titularidad ?? 'empresa';
  const esPersonal = titularidad === 'personal';
  const gradient = getCardGradient(tarjeta.banco, tarjeta.marca);

  // Saldo desde CC (fuente de verdad)
  const { saldoUSD, saldoPEN, loading: loadingSaldo } = useSaldoCCTarjeta(
    tarjeta.id,
  );
  const { cargos, loading: loadingCargos } = useCargosPendientes(tarjeta.id);

  // Saldo dominante para mostrar
  const monedaPrincipal = tarjeta.moneda;
  const saldoPrincipal = monedaPrincipal === 'USD' ? saldoUSD : saldoPEN;
  const saldoSecundario = monedaPrincipal === 'USD' ? saldoPEN : saldoUSD;
  const monedaSecundaria: 'USD' | 'PEN' =
    monedaPrincipal === 'USD' ? 'PEN' : 'USD';

  const tope =
    monedaPrincipal === 'USD' ? tarjeta.topeControlUSD : tarjeta.topeControlPEN;
  const cargosPendCount = cargos.length;

  return (
    <div
      className="cursor-pointer group"
      onClick={() => onClick?.(tarjeta)}
    >
      {/* Plástico de la tarjeta */}
      <div
        className={cn(
          gradient,
          'text-white rounded-xl p-4 mb-2 shadow-md group-hover:shadow-lg transition relative',
        )}
      >
        {/* Badge titularidad */}
        <div
          className={cn(
            'absolute top-2 right-2 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold',
            esPersonal ? 'bg-sky-500/30 text-sky-50' : 'bg-emerald-500/30 text-emerald-50',
          )}
        >
          {esPersonal
            ? `Personal · ${tarjeta.titularNombre?.split(' ')[0] || 'Titular'}`
            : 'Empresarial'}
        </div>

        {/* Banco + marca */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-[10px] uppercase tracking-wider opacity-80">
            {tarjeta.banco}
          </div>
          {tarjeta.marca && (
            <div className="text-[10px] uppercase tracking-wider opacity-80">
              {tarjeta.marca}
            </div>
          )}
        </div>

        {/* Número masked */}
        <div className="text-[11px] font-mono opacity-70 tracking-widest">
          •••• •••• •••• {tarjeta.ultimosDigitos}
        </div>

        {/* Titular */}
        <div className="flex items-end justify-between mt-3">
          <div>
            <div className="text-[8px] uppercase tracking-wider opacity-60">
              Titular
            </div>
            <div className="text-[11px] font-medium uppercase">
              {(tarjeta.titularNombre || 'Vita Skin Peru SAC').toUpperCase()}
            </div>
          </div>
          {!tarjeta.activa && (
            <span className="text-[8px] px-1.5 py-0.5 bg-red-500/30 rounded font-semibold uppercase">
              Inactiva
            </span>
          )}
        </div>
      </div>

      {/* Footer con saldo + cargos */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            {esPersonal
              ? `El negocio le debe a ${tarjeta.titularNombre?.split(' ')[0] || 'titular'}`
              : `Deuda con ${tarjeta.banco} (banco emisor)`}
          </span>
          <span
            className={cn(
              'text-[14px] font-bold tabular-nums',
              saldoPrincipal > 0.01
                ? 'text-red-700'
                : saldoPrincipal < -0.01
                  ? 'text-emerald-700'
                  : 'text-slate-400',
            )}
          >
            {loadingSaldo
              ? '…'
              : saldoPrincipal > 0.01
                ? `−${fmtMoney(saldoPrincipal, monedaPrincipal)}`
                : saldoPrincipal < -0.01
                  ? `+${fmtMoney(saldoPrincipal, monedaPrincipal)}`
                  : `${fmtMoney(0, monedaPrincipal)}`}
          </span>
        </div>

        {/* Saldo secundario solo si bi-moneda y hay saldo */}
        {tarjeta.esBiMoneda && Math.abs(saldoSecundario) > 0.01 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {monedaSecundaria}
            </span>
            <span
              className={cn(
                'text-[12px] font-semibold tabular-nums',
                saldoSecundario > 0.01 ? 'text-red-600' : 'text-emerald-600',
              )}
            >
              {saldoSecundario > 0.01 ? '−' : '+'}
              {fmtMoney(saldoSecundario, monedaSecundaria)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>
            {loadingCargos
              ? 'Cargando cargos…'
              : cargosPendCount === 0
                ? 'Sin cargos pendientes'
                : `${cargosPendCount} cargo${cargosPendCount !== 1 ? 's' : ''} pendiente${cargosPendCount !== 1 ? 's' : ''}`}
          </span>
          <span>
            {tope
              ? `Tope alerta: ${fmtMoney(tope, monedaPrincipal)}`
              : 'Sin tope'}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 mt-1.5">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            {esPersonal ? (
              <>
                <IdCard className="w-3 h-3 text-sky-600" />
                Personal · reembolso al titular
              </>
            ) : (
              <>
                <Building className="w-3 h-3 text-emerald-600" />
                Empresarial · pago al banco
              </>
            )}
          </span>
          <span className="text-[10px] text-teal-600 font-medium flex items-center gap-0.5">
            Ver detalle
            <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
};
