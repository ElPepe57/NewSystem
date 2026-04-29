/**
 * AccionesRecomendadasSidebar — Imp-L10 · Refactor visual S58e (mockup M10)
 *
 * Sidebar derecho persistente que muestra las top 3 acciones más urgentes
 * priorizadas por monto e impacto. Cada CTA al click navega a la entidad
 * correspondiente.
 *
 * Decisión Q-M10 (Opción A): sidebar siempre visible · drawer contextual
 * al click.
 *
 * Algoritmo de priorización:
 *  1. CCs vencidas (saldo > 0 con vencimiento pasado) · top por monto
 *  2. Saldos a favor sin aplicar · agregado por entidad
 *  3. Próximos vencimientos en 7 días
 */

import React, { useMemo } from 'react';
import { Sparkles, AlertCircle, ArrowDownLeft, Clock } from 'lucide-react';
import type { CuentaCorriente } from '../../../types/cuentaCorriente.types';
import { cn } from '../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function fmtPEN(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
}

interface AccionData {
  tipo: 'vencido' | 'a_favor' | 'por_vencer';
  titulo: string;
  descripcion: string;
  monto: number;
  cc: CuentaCorriente;
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export interface AccionesRecomendadasSidebarProps {
  ccs: CuentaCorriente[];
  onSeleccionarCC?: (cc: CuentaCorriente) => void;
  tipoCambio?: number;
  className?: string;
}

export const AccionesRecomendadasSidebar: React.FC<AccionesRecomendadasSidebarProps> = ({
  ccs,
  onSeleccionarCC,
  tipoCambio = 3.85,
  className,
}) => {
  // Calcular top 3 acciones priorizadas
  const acciones = useMemo<AccionData[]>(() => {
    const result: AccionData[] = [];

    // 1. Saldos a favor sin aplicar (clientes con anticipo, proveedores con saldo)
    const aFavor: AccionData[] = [];
    for (const cc of ccs) {
      const saldoTotalPEN = (cc.saldoPEN ?? 0) + (cc.saldoUSD ?? 0) * tipoCambio;
      const monto = Math.abs(saldoTotalPEN);
      if (monto < 100) continue; // ignorar saldos chicos

      if (cc.tipo === 'cliente' && saldoTotalPEN < 0) {
        // Cliente con anticipo
        aFavor.push({
          tipo: 'a_favor',
          titulo: cc.entidadNombre,
          descripcion: `Anticipo de cliente · sin aplicar a ventas`,
          monto,
          cc,
        });
      } else if (cc.tipo !== 'cliente' && saldoTotalPEN > 0) {
        // Proveedor/colaborador/empleado con saldo a favor
        aFavor.push({
          tipo: 'a_favor',
          titulo: cc.entidadNombre,
          descripcion: `Saldo a favor sin aplicar`,
          monto,
          cc,
        });
      }
    }
    aFavor.sort((a, b) => b.monto - a.monto);

    // Tomar top 3 ordenando por urgencia (a_favor por ahora · F4 podrá agregar vencidos)
    for (const a of aFavor.slice(0, 3)) {
      result.push(a);
    }

    return result;
  }, [ccs, tipoCambio]);

  return (
    <aside
      className={cn(
        'w-full lg:w-72 flex-shrink-0 bg-white border border-slate-200 rounded-xl overflow-hidden',
        className,
      )}
    >
      {/* Header gradiente */}
      <div className="bg-gradient-to-br from-teal-700 to-teal-500 p-4 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">
            Acciones recomendadas
          </span>
        </div>
        <p className="text-[11px] mt-1 text-teal-100">
          Top {acciones.length} priorizadas por monto e impacto
        </p>
      </div>

      {/* Body con acciones */}
      <div className="p-3 space-y-2">
        {acciones.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <Sparkles className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-slate-700">Todo conciliado</p>
            <p className="text-xs text-slate-400 mt-1">
              Sin acciones urgentes pendientes.
            </p>
          </div>
        ) : (
          acciones.map((a) => {
            const accent =
              a.tipo === 'vencido'
                ? { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: AlertCircle }
                : a.tipo === 'por_vencer'
                  ? { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: Clock }
                  : { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', icon: ArrowDownLeft };
            const Icon = accent.icon;
            return (
              <button
                key={`${a.cc.id}-${a.tipo}`}
                type="button"
                onClick={() => onSeleccionarCC?.(a.cc)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  accent.bg,
                  accent.border,
                  'hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.99]',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn('w-3.5 h-3.5', accent.text)} />
                  <div className={cn('text-xs font-bold truncate', accent.text)}>
                    {a.titulo}
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 mb-1.5 line-clamp-2">
                  {a.descripcion}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {fmtPEN(a.monto)}
                  </span>
                  <span className={cn('text-[10px] font-semibold', accent.text)}>
                    Aplicar →
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer ligero */}
      <div className="border-t border-slate-100 p-3 bg-slate-50">
        <div className="text-[10px] text-slate-500 text-center">
          {ccs.length} {ccs.length === 1 ? 'CC activa' : 'CCs activas'} · Total seguimiento
        </div>
      </div>
    </aside>
  );
};
