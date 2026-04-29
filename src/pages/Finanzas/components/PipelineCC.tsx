/**
 * PipelineCC — Imp-L10 · Refactor visual S58e (mockup M10)
 *
 * Pipeline horizontal de 5 estados de Cuentas Corrientes (entidades):
 *   - Al día (verde) · CC con saldo en plazo
 *   - Por vencer (amber) · saldo con vencimiento próximos 7 días
 *   - Vencido (red) · saldo con vencimiento pasado
 *   - Saldo a favor (sky) · cliente con anticipo (saldo positivo)
 *   - Conciliada (slate) · CC sin movimientos pendientes
 *
 * Replica el patrón de PipelineCompras (S54.x referencia canónica) y
 * PipelineTesoreria (Imp-L1) pero adaptado a entidades CC.
 */

import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowDownLeft,
  CheckSquare,
  ChevronRight,
} from 'lucide-react';
import type { CuentaCorriente } from '../../../types/cuentaCorriente.types';
import { cn } from '../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export type EstadoCC =
  | 'al_dia'
  | 'por_vencer'
  | 'vencido'
  | 'saldo_a_favor'
  | 'conciliada';

interface BloqueCfg {
  estado: EstadoCC;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  bgHover: string;
  border: string;
  text: string;
  textMonto: string;
  ringColor: string;
  desc: string;
}

const BLOQUES: BloqueCfg[] = [
  {
    estado: 'al_dia',
    label: 'Al día',
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    bgHover: 'hover:bg-emerald-100',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    textMonto: 'text-emerald-800',
    ringColor: '#059669',
    desc: 'En plazo',
  },
  {
    estado: 'por_vencer',
    label: 'Por vencer',
    icon: Clock,
    bg: 'bg-amber-50',
    bgHover: 'hover:bg-amber-100',
    border: 'border-amber-200',
    text: 'text-amber-700',
    textMonto: 'text-amber-800',
    ringColor: '#d97706',
    desc: 'Próximos 7 días',
  },
  {
    estado: 'vencido',
    label: 'Vencido',
    icon: AlertCircle,
    bg: 'bg-red-50',
    bgHover: 'hover:bg-red-100',
    border: 'border-red-200',
    text: 'text-red-700',
    textMonto: 'text-red-800',
    ringColor: '#dc2626',
    desc: 'Vencimiento pasado',
  },
  {
    estado: 'saldo_a_favor',
    label: 'Saldo a favor',
    icon: ArrowDownLeft,
    bg: 'bg-sky-50',
    bgHover: 'hover:bg-sky-100',
    border: 'border-sky-200',
    text: 'text-sky-700',
    textMonto: 'text-sky-800',
    ringColor: '#0284c7',
    desc: 'Anticipos sin aplicar',
  },
  {
    estado: 'conciliada',
    label: 'Conciliada',
    icon: CheckSquare,
    bg: 'bg-slate-50',
    bgHover: 'hover:bg-slate-100',
    border: 'border-slate-200',
    text: 'text-slate-600',
    textMonto: 'text-slate-700',
    ringColor: '#64748b',
    desc: 'Sin pendientes',
  },
];

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function fmtPEN(n: number): string {
  return n > 0
    ? `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
    : '—';
}

function clasificarCC(cc: CuentaCorriente, tipoCambio = 3.85): EstadoCC {
  const totalPEN = (cc.saldoPEN ?? 0) + (cc.saldoUSD ?? 0) * tipoCambio;

  // Sin saldo y sin movimientos pendientes → conciliada
  if (Math.abs(totalPEN) < 0.01) return 'conciliada';

  // Saldo positivo a favor del titular (cliente anticipó)
  if (cc.tipo === 'cliente' && totalPEN < 0) return 'saldo_a_favor';
  if (cc.tipo !== 'cliente' && totalPEN > 0) return 'saldo_a_favor'; // proveedor con saldo a su favor

  // Por simplicidad: por ahora todo lo demás se considera al_dia.
  // F4 puede refinar con campo fechaVencimiento real.
  return 'al_dia';
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export interface PipelineCCProps {
  ccs: CuentaCorriente[];
  estadoActivo?: EstadoCC | null;
  onEstadoClick?: (estado: EstadoCC) => void;
  onClear?: () => void;
  tipoCambio?: number;
  className?: string;
}

export const PipelineCC: React.FC<PipelineCCProps> = ({
  ccs,
  estadoActivo = null,
  onEstadoClick,
  onClear,
  tipoCambio = 3.85,
  className,
}) => {
  // Calcular contadores y montos por estado
  const stats = React.useMemo(() => {
    const map: Record<EstadoCC, { count: number; monto: number }> = {
      al_dia: { count: 0, monto: 0 },
      por_vencer: { count: 0, monto: 0 },
      vencido: { count: 0, monto: 0 },
      saldo_a_favor: { count: 0, monto: 0 },
      conciliada: { count: 0, monto: 0 },
    };
    for (const cc of ccs) {
      const estado = clasificarCC(cc, tipoCambio);
      const totalPEN = Math.abs(
        (cc.saldoPEN ?? 0) + (cc.saldoUSD ?? 0) * tipoCambio,
      );
      map[estado].count++;
      map[estado].monto += totalPEN;
    }
    return map;
  }, [ccs, tipoCambio]);

  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-xl p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-800">
          Estado de las cuentas corrientes
        </h3>
        <span className="text-xs text-slate-500 hidden sm:block">
          Click para filtrar · doble click para limpiar
        </span>
      </div>
      <div className="grid grid-cols-2 lg:flex lg:items-center gap-2">
        {BLOQUES.map((cfg, idx) => {
          const Icon = cfg.icon;
          const data = stats[cfg.estado];
          const active = estadoActivo === cfg.estado;
          return (
            <React.Fragment key={cfg.estado}>
              <button
                type="button"
                onClick={() => onEstadoClick?.(cfg.estado)}
                onDoubleClick={onClear}
                className={cn(
                  'flex-1 rounded-xl p-3 text-left border transition-all duration-200',
                  cfg.bg,
                  cfg.bgHover,
                  cfg.border,
                  'hover:-translate-y-0.5 active:scale-[0.98]',
                  active && 'shadow-sm',
                )}
                style={active ? { boxShadow: `0 0 0 2px ${cfg.ringColor}` } : undefined}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon
                      className={cn(
                        'w-4 h-4 flex-shrink-0',
                        cfg.text.replace('-700', '-600').replace('-600', '-600'),
                      )}
                    />
                    <span className={cn('text-xs font-semibold truncate', cfg.text)}>
                      {cfg.label}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'text-lg font-bold tabular-nums flex-shrink-0',
                      cfg.estado === 'vencido' || cfg.estado === 'por_vencer'
                        ? cfg.text
                        : 'text-slate-900',
                    )}
                  >
                    {data.count}
                  </span>
                </div>
                <div className={cn('text-[11px] font-semibold tabular-nums', cfg.textMonto)}>
                  {fmtPEN(data.monto)}
                </div>
                <div className={cn('text-[10px]', cfg.text)}>{cfg.desc}</div>
              </button>
              {idx < BLOQUES.length - 1 && (
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 hidden lg:block" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// Helper exportado para que el caller pueda filtrar por estado
export { clasificarCC };
