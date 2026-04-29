/**
 * TitularItemRow — S58c parte 2
 *
 * Fila individual dentro de un grupo de titular. Renderiza una CuentaCaja o
 * una TarjetaCredito con icono + nombre + saldo (lee saldo de TC desde CC).
 *
 * Botones edit/delete inline en hover (solo cuentas — las tarjetas usan
 * el modal detalle para sus acciones).
 */

import React from 'react';
import {
  Building2,
  Smartphone,
  Banknote,
  CreditCard,
  PiggyBank,
  Edit2,
  Trash2,
} from 'lucide-react';
import { cn } from '../../../design-system/utils';
import { useSaldoCCTarjeta } from '../TarjetasCreditoV2/hooks';
import type { CuentaCaja } from '../../../types/tesoreria.types';
import type { TitularItem } from './helpers';

// ═════════════════════════════════════════════════════════════════════════
// PROPS
// ═════════════════════════════════════════════════════════════════════════

export interface TitularItemRowProps {
  item: TitularItem;
  onClick?: () => void;
  /** Solo aplica para cuentas. */
  onEditarCuenta?: (cuenta: CuentaCaja) => void;
  onEliminarCuenta?: (cuenta: CuentaCaja) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function fmtSaldo(saldo: number, moneda: 'USD' | 'PEN'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${saldo.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtSaldoDecimal(saldo: number, moneda: 'USD' | 'PEN'): string {
  const sym = moneda === 'USD' ? 'US$' : 'S/';
  return `${sym} ${Math.abs(saldo).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ═════════════════════════════════════════════════════════════════════════
// CUENTA ROW
// ═════════════════════════════════════════════════════════════════════════

const CuentaRow: React.FC<{
  item: Extract<TitularItem, { kind: 'cuenta' }>;
  onClick?: () => void;
  onEditarCuenta?: (cuenta: CuentaCaja) => void;
  onEliminarCuenta?: (cuenta: CuentaCaja) => void;
}> = ({ item, onClick, onEditarCuenta, onEliminarCuenta }) => {
  const c = item.cuenta;
  const Icon =
    c.tipo === 'banco'
      ? Building2
      : c.tipo === 'digital'
        ? Smartphone
        : c.tipo === 'efectivo'
          ? Banknote
          : c.productoFinanciero === 'tarjeta_debito'
            ? CreditCard
            : PiggyBank;

  const iconColor =
    c.tipo === 'banco'
      ? 'text-emerald-600'
      : c.tipo === 'digital'
        ? 'text-purple-600'
        : c.tipo === 'efectivo'
          ? 'text-amber-600'
          : 'text-sky-600';

  // Saldo a mostrar: para bi-moneda mostramos el dominante; mono lo de la cuenta
  let saldoDisplay = '';
  if (c.esBiMoneda) {
    const usd = c.saldoUSD ?? 0;
    const pen = c.saldoPEN ?? 0;
    if (Math.abs(usd) > Math.abs(pen)) {
      saldoDisplay = fmtSaldo(usd, 'USD');
    } else {
      saldoDisplay = fmtSaldo(pen, 'PEN');
    }
  } else {
    saldoDisplay = fmtSaldo(c.saldoActual, c.moneda);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded text-left transition-colors group cursor-pointer"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', iconColor)} />
        <span className="text-[12px] text-slate-700 truncate group-hover:text-slate-900">
          {c.nombre}
        </span>
        {c.tipo === 'credito' &&
          c.productoFinanciero === 'tarjeta_debito' && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">
              débito
            </span>
          )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[12px] tabular-nums font-medium text-slate-700">
          {saldoDisplay}
        </span>
        {/* Acciones inline en hover */}
        {(onEditarCuenta || onEliminarCuenta) && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEditarCuenta && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditarCuenta(c);
                }}
                className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                title="Editar cuenta"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
            {onEliminarCuenta && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEliminarCuenta(c);
                }}
                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Eliminar cuenta"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// TARJETA ROW (lee saldo desde CC)
// ═════════════════════════════════════════════════════════════════════════

const TarjetaRow: React.FC<{
  item: Extract<TitularItem, { kind: 'tarjeta' }>;
  onClick?: () => void;
}> = ({ item, onClick }) => {
  const t = item.tarjeta;
  const { saldoUSD, saldoPEN, loading } = useSaldoCCTarjeta(t.id);

  // Saldo dominante para mostrar
  const usd = saldoUSD;
  const pen = saldoPEN;
  const dominante = Math.abs(usd) > Math.abs(pen) ? usd : pen;
  const monedaDom: 'USD' | 'PEN' =
    Math.abs(usd) > Math.abs(pen) ? 'USD' : 'PEN';

  // Color: positivo = deuda con titular/banco (rojo) · negativo = anticipo (verde)
  const color =
    dominante > 0.01
      ? 'text-red-700'
      : dominante < -0.01
        ? 'text-emerald-700'
        : 'text-slate-400';

  const display = loading
    ? '…'
    : Math.abs(dominante) < 0.01
      ? fmtSaldo(0, t.moneda)
      : `${dominante > 0 ? '−' : '+'}${fmtSaldoDecimal(dominante, monedaDom)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded text-left transition-colors group"
      title="Click para ver detalle, cargos y pagos"
    >
      <div className="flex items-center gap-2 min-w-0">
        <CreditCard className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
        <span className="text-[12px] text-slate-700 truncate group-hover:text-slate-900">
          {t.nombre}
        </span>
        <span className="text-[9px] px-1 py-0.5 rounded bg-rose-100 text-rose-700 flex-shrink-0">
          TC
        </span>
      </div>
      <span
        className={cn(
          'text-[12px] tabular-nums font-medium flex-shrink-0',
          color,
        )}
      >
        {display}
      </span>
    </button>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// EXPORT
// ═════════════════════════════════════════════════════════════════════════

export const TitularItemRow: React.FC<TitularItemRowProps> = ({
  item,
  onClick,
  onEditarCuenta,
  onEliminarCuenta,
}) => {
  if (item.kind === 'cuenta') {
    return (
      <CuentaRow
        item={item}
        onClick={onClick}
        onEditarCuenta={onEditarCuenta}
        onEliminarCuenta={onEliminarCuenta}
      />
    );
  }
  return <TarjetaRow item={item} onClick={onClick} />;
};
