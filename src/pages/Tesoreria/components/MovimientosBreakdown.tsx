/**
 * MovimientosBreakdown — Imp-L6 · M6 movimientos
 *
 * Sidebar collapsible con donut SVG inline + breakdown por categoría.
 * Calcula los segmentos a partir de los movimientos visibles.
 */

import React, { useMemo, useState } from 'react';
import { PieChart, ChevronDown } from 'lucide-react';
import type { MovimientoTesoreria } from '../../../types/tesoreria.types';
import { cn } from '../../../design-system/utils';

function fmtPEN(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
}

interface SegmentoData {
  label: string;
  monto: number;
  color: string;
  count: number;
}

const CATEGORIA_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  ingresos: { label: 'Ingresos', color: '#10b981' },     // emerald-500
  egresos: { label: 'Egresos', color: '#dc2626' },        // red-600
  conversiones: { label: 'Conversiones', color: '#7c3aed' }, // purple-600
  transferencias: { label: 'Transferencias internas', color: '#0ea5e9' }, // sky-500
  ajustes: { label: 'Ajustes', color: '#94a3b8' },        // slate-400
};

function clasificarMov(tipo: string): keyof typeof CATEGORIA_CONFIG {
  if (
    [
      'ingreso_venta',
      'ingreso_anticipo',
      'ingreso_otro',
      'aporte_capital',
    ].includes(tipo)
  )
    return 'ingresos';
  if (
    [
      'pago_orden_compra',
      'pago_viajero',
      'pago_proveedor_local',
      'gasto_operativo',
      'retiro_socio',
      'pago_nomina',
      'adelanto_empleado',
    ].includes(tipo)
  )
    return 'egresos';
  if (['conversion_pen_usd', 'conversion_usd_pen'].includes(tipo))
    return 'conversiones';
  if (tipo === 'transferencia_interna') return 'transferencias';
  return 'ajustes';
}

export interface MovimientosBreakdownProps {
  movimientos: MovimientoTesoreria[];
  tipoCambio?: number;
  className?: string;
}

export const MovimientosBreakdown: React.FC<MovimientosBreakdownProps> = ({
  movimientos,
  tipoCambio = 3.85,
  className,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const segmentos = useMemo<SegmentoData[]>(() => {
    const map = new Map<string, { monto: number; count: number }>();
    for (const m of movimientos) {
      if (m.estado === 'anulado') continue;
      const cat = clasificarMov(m.tipo);
      const montoPEN =
        m.montoEquivalentePEN ?? (m.moneda === 'PEN' ? m.monto : m.monto * tipoCambio);
      const curr = map.get(cat) ?? { monto: 0, count: 0 };
      map.set(cat, { monto: curr.monto + montoPEN, count: curr.count + 1 });
    }
    const result: SegmentoData[] = [];
    for (const [key, data] of map) {
      const cfg = CATEGORIA_CONFIG[key];
      if (!cfg) continue;
      if (data.monto <= 0) continue;
      result.push({
        label: cfg.label,
        monto: data.monto,
        color: cfg.color,
        count: data.count,
      });
    }
    return result.sort((a, b) => b.monto - a.monto);
  }, [movimientos, tipoCambio]);

  const total = segmentos.reduce((sum, s) => sum + s.monto, 0);

  // SVG donut
  const cx = 50;
  const cy = 50;
  const radius = 40;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <aside
      className={cn(
        'w-full lg:w-72 flex-shrink-0 bg-white border border-slate-200 rounded-xl overflow-hidden',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100"
      >
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-semibold text-slate-800">
            Resumen del periodo
          </span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-400 transition-transform',
            collapsed && '-rotate-90',
          )}
        />
      </button>

      {!collapsed && (
        <div className="p-4">
          {segmentos.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              Sin datos para mostrar
            </div>
          ) : (
            <>
              {/* Donut SVG */}
              <div className="flex justify-center mb-4">
                <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth={strokeWidth}
                  />
                  {segmentos.map((s) => {
                    const portion = s.monto / total;
                    const dasharray = `${portion * circumference} ${circumference}`;
                    const dashoffset = -cumulativeOffset;
                    cumulativeOffset += portion * circumference;
                    return (
                      <circle
                        key={s.label}
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dasharray}
                        strokeDashoffset={dashoffset}
                        strokeLinecap="butt"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Total centrado */}
              <div className="text-center mb-4">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Total movido
                </div>
                <div className="text-lg font-bold text-slate-900 tabular-nums">
                  {fmtPEN(total)}
                </div>
              </div>

              {/* Lista de segmentos */}
              <div className="space-y-2">
                {segmentos.map((s) => {
                  const pct = ((s.monto / total) * 100).toFixed(1);
                  return (
                    <div
                      key={s.label}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-slate-700 truncate">
                          {s.label}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold text-slate-900 tabular-nums">
                          {fmtPEN(s.monto)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {pct}% · {s.count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
};
