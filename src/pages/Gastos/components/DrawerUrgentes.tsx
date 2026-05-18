/**
 * DrawerUrgentes · panel lateral de urgentes · Gastos rework v3
 *
 * chk5.C6 (S3.6 M3 · Gastos Rework) · refactor del componente F4.b canon:
 *   - Reemplaza TODOS los emojis por lucide-icons (canon F8 · zero emojis en chrome)
 *   - Header con color sólido rose (sin gradient pesado · acorde canon F8/F11)
 *   - Chevron expand/collapse usa <ChevronDown> rotable
 *
 * Panel lateral sticky con gastos urgentes (vencidos + vencen en 7d).
 * Comportamiento:
 * - Si no hay urgentes → mensaje compacto verde (lo renderiza el padre · este
 *   componente solo se monta cuando hay urgentes en F5).
 * - Si hay urgentes → panel expandido con cards mini · CTA Pagar HOY/Pagar →
 * - Colapsable manual via ChevronDown
 */

import React, { useState } from 'react';
import { AlertTriangle, Clock, ChevronDown, CheckCircle2 } from 'lucide-react';
import type { Gasto } from '../../../types/gasto.types';

interface DrawerUrgentesProps {
  vencidos: Gasto[];
  vencenPronto: Gasto[];
  onPagar: (g: Gasto) => void;
  onVerDetalle: (g: Gasto) => void;
}

const formatPEN = (n: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n);

const formatFecha = (timestamp: any): string => {
  const fecha = timestamp?.toDate?.() ?? new Date(timestamp);
  if (isNaN(fecha.getTime())) return '-';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${fecha.getDate()} ${meses[fecha.getMonth()]}`;
};

const diasHasta = (timestamp: any): number => {
  const fecha = timestamp?.toDate?.() ?? new Date(timestamp);
  if (isNaN(fecha.getTime())) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);
  return Math.round((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

export const DrawerUrgentes: React.FC<DrawerUrgentesProps> = ({
  vencidos,
  vencenPronto,
  onPagar,
  onVerDetalle,
}) => {
  const [expandido, setExpandido] = useState(true);
  const totalUrgentes = vencidos.length + vencenPronto.length;
  const totalMontoVencido = vencidos.reduce((acc, g) => acc + (g.montoPEN - (g.montoPagado || 0)), 0);
  const totalMontoPronto = vencenPronto.reduce((acc, g) => acc + (g.montoPEN - (g.montoPagado || 0)), 0);
  const totalMonto = totalMontoVencido + totalMontoPronto;

  // Estado vacio · canon v9.0 M1 · gradient sutil + icon wrapper
  if (totalUrgentes === 0) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl p-4 text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <div className="text-sm font-bold text-emerald-900">Sin pendientes urgentes</div>
        <p className="text-xs text-emerald-700 mt-1">No hay gastos vencidos ni que venzan en 7 días.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-md overflow-hidden">
      {/* Header del drawer · canon F8/F11 · color sólido (no gradient pesado) */}
      <button
        type="button"
        onClick={() => setExpandido((e) => !e)}
        className="w-full bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <div className="text-left">
            <div className="text-xs uppercase tracking-wider text-white/80 font-bold">Urgentes</div>
            <div className="text-sm font-bold">{totalUrgentes} pendientes</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-white/80 font-bold">Total</div>
            <div className="text-sm font-bold tabular-nums">{formatPEN(totalMonto)}</div>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${expandido ? '' : '-rotate-90'}`} />
        </div>
      </button>

      {/* Cuerpo · stack de cards */}
      {expandido && (
        <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
          {/* Vencidos primero · destacados */}
          {vencidos.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Vencidos · {vencidos.length}
              </div>
              {vencidos.slice(0, 5).map((g) => {
                const dias = Math.abs(diasHasta(g.fecha));
                const saldo = (g.montoPEN || 0) - (g.montoPagado || 0);
                return (
                  <div
                    key={g.id}
                    className="bg-rose-50 border-2 border-rose-300 rounded-lg p-2.5 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3 h-3 text-rose-700" />
                      <span className="text-[9px] uppercase tracking-wider text-rose-700 font-bold tabular-nums">
                        −{dias}d
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onVerDetalle(g)}
                      className="text-left w-full text-xs font-bold text-slate-900 hover:text-rose-700 truncate"
                      title={g.descripcion}
                    >
                      {g.descripcion || g.tipo || g.numeroGasto}
                    </button>
                    {(g.proveedor || g.proveedorNombre) && (
                      <div className="text-[10px] text-slate-500 truncate">{g.proveedor || g.proveedorNombre}</div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-sm font-bold tabular-nums text-rose-900">{formatPEN(saldo)}</span>
                      <button
                        type="button"
                        onClick={() => onPagar(g)}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm animate-pulse"
                      >
                        Pagar HOY
                      </button>
                    </div>
                  </div>
                );
              })}
              {vencidos.length > 5 && (
                <div className="text-center text-[10px] text-rose-600 italic">
                  + {vencidos.length - 5} vencidos más
                </div>
              )}
            </>
          )}

          {/* Vencen pronto */}
          {vencenPronto.length > 0 && (
            <>
              {vencidos.length > 0 && <div className="border-t border-slate-200 my-2"></div>}
              <div className="text-[10px] uppercase tracking-wider text-amber-700 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Vencen en 7 días · {vencenPronto.length}
              </div>
              {vencenPronto.slice(0, 5).map((g) => {
                const dias = diasHasta(g.fecha);
                const saldo = (g.montoPEN || 0) - (g.montoPagado || 0);
                return (
                  <div
                    key={g.id}
                    className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] uppercase tracking-wider text-amber-700 font-bold flex items-center gap-0.5 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {dias === 0 ? 'HOY' : `EN ${dias}d`}
                      </span>
                      <span className="text-[9px] text-amber-600 tabular-nums">{formatFecha(g.fecha)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onVerDetalle(g)}
                      className="text-left w-full text-xs font-bold text-slate-900 hover:text-amber-700 truncate"
                      title={g.descripcion}
                    >
                      {g.descripcion || g.tipo || g.numeroGasto}
                    </button>
                    {(g.proveedor || g.proveedorNombre) && (
                      <div className="text-[10px] text-slate-500 truncate">{g.proveedor || g.proveedorNombre}</div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-sm font-bold tabular-nums text-amber-900">{formatPEN(saldo)}</span>
                      <button
                        type="button"
                        onClick={() => onPagar(g)}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-lg"
                      >
                        Pagar →
                      </button>
                    </div>
                  </div>
                );
              })}
              {vencenPronto.length > 5 && (
                <div className="text-center text-[10px] text-amber-600 italic">
                  + {vencenPronto.length - 5} próximos más
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
