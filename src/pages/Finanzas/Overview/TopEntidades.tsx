/**
 * TopEntidades — S57 Fase C · Top 5 saldos del Overview
 *
 * Lista de las 5 entidades con MAYOR magnitud absoluta de saldo
 * (suma de |saldoPEN| + |saldoUSD|). Click en una entidad abre
 * EntidadCCDetailModal con su detalle.
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '../../../design-system';
import type { CuentaCorriente, TipoEntidadCC } from '../../../types/cuentaCorriente.types';
import { TIPO_ENTIDAD_CC_LABELS } from '../../../types/cuentaCorriente.types';

interface TopEntidadesProps {
  ccs: CuentaCorriente[];
  loading?: boolean;
  onEntidadClick?: (cc: CuentaCorriente) => void;
  onVerTodas?: () => void;
  topN?: number;
}

const COLOR_TIPO: Record<TipoEntidadCC, string> = {
  cliente: 'bg-sky-100 text-sky-700',
  proveedor: 'bg-amber-100 text-amber-700',
  colaborador: 'bg-purple-100 text-purple-700',
  empleado: 'bg-emerald-100 text-emerald-700',
};

function getInitials(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '?';
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

function fmtSaldoDominante(cc: CuentaCorriente): { texto: string; clase: string } {
  // Prioriza la moneda con mayor magnitud
  const usePEN = Math.abs(cc.saldoPEN) >= Math.abs(cc.saldoUSD);
  const saldo = usePEN ? cc.saldoPEN : cc.saldoUSD;
  const moneda = usePEN ? 'S/' : 'US$';
  const abs = Math.abs(saldo).toLocaleString('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  if (Math.abs(saldo) < 0.01) {
    return { texto: `${moneda} 0`, clase: 'text-slate-400' };
  }
  if (saldo > 0) {
    return { texto: `+${moneda} ${abs}`, clase: 'text-emerald-700' };
  }
  return { texto: `−${moneda} ${abs}`, clase: 'text-red-700' };
}

export const TopEntidades: React.FC<TopEntidadesProps> = ({
  ccs,
  loading,
  onEntidadClick,
  onVerTodas,
  topN = 5,
}) => {
  // Top N por magnitud absoluta combinada
  const top = React.useMemo(() => {
    return [...ccs]
      .filter((cc) => Math.abs(cc.saldoPEN) > 0.01 || Math.abs(cc.saldoUSD) > 0.01)
      .sort(
        (a, b) =>
          Math.abs(b.saldoPEN) +
          Math.abs(b.saldoUSD) -
          (Math.abs(a.saldoPEN) + Math.abs(a.saldoUSD)),
      )
      .slice(0, topN);
  }, [ccs, topN]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">TOP {topN} saldos</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Mayor magnitud actual</p>
        </div>
        {onVerTodas && (
          <button
            type="button"
            onClick={onVerTodas}
            className="text-[11px] text-teal-600 hover:underline"
          >
            Ver todos →
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 mt-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-slate-50 rounded-md animate-pulse" />
          ))}
        </div>
      ) : top.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400 italic">
          Sin entidades con saldo
        </div>
      ) : (
        <div className="space-y-2 mt-3">
          {top.map((cc) => {
            const saldo = fmtSaldoDominante(cc);
            return (
              <button
                key={cc.id}
                type="button"
                onClick={() => onEntidadClick?.(cc)}
                className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer text-left transition"
              >
                <div
                  className={cn(
                    'w-7 h-7 rounded-md flex items-center justify-center font-bold text-[10px] flex-shrink-0',
                    COLOR_TIPO[cc.tipo],
                  )}
                >
                  {getInitials(cc.entidadNombre)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-slate-900 truncate">
                    {cc.entidadNombre}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {TIPO_ENTIDAD_CC_LABELS[cc.tipo]}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className={cn(
                      'text-[12px] font-bold tabular-nums',
                      saldo.clase,
                    )}
                  >
                    {saldo.texto}
                  </div>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
