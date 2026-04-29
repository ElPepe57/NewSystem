/**
 * BankSubheader — Imp-L1.1.4 · Refactor visual S58e
 *
 * Header de sub-grupo banco dentro de la vista por titular. Muestra el
 * logo del banco + nombre completo + count de productos + saldo agregado.
 */

import React from 'react';
import { cn } from '../../../design-system/utils';
import { BankLogo } from './BankLogo';

export interface BankSubheaderProps {
  banco: string;
  bancoNombreCompleto?: string;
  productosCount: number;
  saldoTexto: string;
  className?: string;
}

export const BankSubheader: React.FC<BankSubheaderProps> = ({
  banco,
  bancoNombreCompleto,
  productosCount,
  saldoTexto,
  className,
}) => {
  const isSinBanco = banco === 'Sin banco' || !banco;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2.5 mb-1.5 ml-3',
        'bg-white border border-slate-200 rounded-xl',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isSinBanco ? (
          <div className="w-7 h-7 rounded-md bg-slate-200 flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-bold text-slate-500">—</span>
          </div>
        ) : (
          <BankLogo banco={banco} size="md" />
        )}
        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700 truncate">
            {bancoNombreCompleto || banco}
          </span>
          <span className="text-[10px] text-slate-400">
            {productosCount} producto{productosCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      {saldoTexto && (
        <div className="text-xs font-semibold text-slate-600 tabular-nums flex-shrink-0">
          {saldoTexto}
        </div>
      )}
    </div>
  );
};
