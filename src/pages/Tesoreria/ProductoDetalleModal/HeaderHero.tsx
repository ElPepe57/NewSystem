/**
 * HeaderHero — Imp-L2 · M2 detalle producto
 *
 * Header hero del modal con gradiente diferenciado por tipo:
 *   - Cuentas/cajas/wallets → gradiente teal
 *   - Tarjetas crédito → gradiente indigo
 *
 * Replica el patrón de OrdenCompraCard (S54.x referencia canónica):
 * icono grande + código + chips de estado + título + subtítulo + cerrar.
 */

import React from 'react';
import {
  Building2,
  PiggyBank,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowLeftRight,
  CheckCircle2,
  X,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '../../../design-system/utils';
import type { CuentaCaja } from '../../../types/tesoreria.types';
import { SaldoAlertChip, calcularEstadoSaldo } from '../components';

function getIconoYColor(c: CuentaCaja): {
  Icon: React.ComponentType<{ className?: string }>;
  esTC: boolean;
} {
  if (c.tipo === 'credito') {
    if (c.productoFinanciero === 'tarjeta_credito') return { Icon: CreditCard, esTC: true };
    return { Icon: CreditCard, esTC: false };
  }
  if (c.tipo === 'efectivo') return { Icon: Banknote, esTC: false };
  if (c.tipo === 'digital') return { Icon: Smartphone, esTC: false };
  if (c.productoFinanciero === 'cuenta_ahorros') return { Icon: PiggyBank, esTC: false };
  return { Icon: Building2, esTC: false };
}

export interface HeaderHeroProps {
  cuenta: CuentaCaja;
  /** Código del producto (PF-001) */
  codigo?: string;
  onClose: () => void;
}

export const HeaderHero: React.FC<HeaderHeroProps> = ({ cuenta, codigo, onClose }) => {
  const { Icon, esTC } = getIconoYColor(cuenta);
  const estado = calcularEstadoSaldo({
    saldoActual: cuenta.esBiMoneda ? (cuenta.saldoPEN ?? 0) : cuenta.saldoActual,
    saldoMinimo: cuenta.saldoMinimo,
    esTarjetaCredito: esTC,
  });

  // Gradiente según tipo
  const gradientClass = esTC
    ? 'bg-gradient-to-br from-indigo-700 to-indigo-500'
    : 'bg-gradient-to-br from-teal-700 to-teal-500';
  const accentText = esTC ? 'text-indigo-200' : 'text-teal-200';
  const accentDivider = esTC ? 'text-indigo-400' : 'text-teal-400';

  const subtitulo = (() => {
    if (cuenta.tipo === 'banco') return cuenta.productoFinanciero === 'cuenta_ahorros' ? 'Cuenta de ahorros' : 'Cuenta corriente';
    if (cuenta.tipo === 'efectivo') return 'Caja efectivo';
    if (cuenta.tipo === 'digital') return 'Wallet digital';
    if (esTC) return 'Tarjeta de crédito';
    return 'Tarjeta de débito';
  })();

  return (
    <div className={cn('p-5 sm:p-6 text-white', gradientClass)}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-4 min-w-0">
          {/* Icon grande */}
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center flex-shrink-0">
            <Icon className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            {/* Chips: codigo + estado activa + saldo alert */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {codigo && (
                <span className={cn('text-xs font-mono font-semibold', accentText)}>
                  {codigo}
                </span>
              )}
              {cuenta.activa && (
                <span className="text-[10px] font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">
                  Activa
                </span>
              )}
              {estado === 'saludable' ? (
                <span className="text-[10px] font-semibold bg-emerald-400/30 text-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Saludable
                </span>
              ) : (
                <SaldoAlertChip estado={estado} />
              )}
            </div>
            {/* Título */}
            <h2 className="text-xl font-bold text-white leading-tight truncate">
              {cuenta.nombre}
            </h2>
            {/* Subtítulo: banco + titular + bi-moneda */}
            <div className={cn('flex items-center gap-3 mt-1 text-sm flex-wrap', accentText)}>
              {cuenta.banco && (
                <>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {cuenta.bancoNombreCompleto || cuenta.banco}
                  </span>
                  <span className={accentDivider}>·</span>
                </>
              )}
              {(cuenta.titularNombre || cuenta.titular) && (
                <>
                  <span className="flex items-center gap-1 truncate">
                    <UserIcon className="w-3.5 h-3.5" />
                    {cuenta.titularNombre || cuenta.titular}
                  </span>
                  {cuenta.esBiMoneda && <span className={accentDivider}>·</span>}
                </>
              )}
              {cuenta.esBiMoneda && (
                <span className="flex items-center gap-1">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Bi-moneda PEN + USD
                </span>
              )}
              {!cuenta.esBiMoneda && !cuenta.titular && !cuenta.banco && (
                <span>{subtitulo} · {cuenta.moneda}</span>
              )}
            </div>
          </div>
        </div>
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-all flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
