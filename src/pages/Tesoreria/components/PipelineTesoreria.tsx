/**
 * PipelineTesoreria — Imp-L1.1.2 · Refactor visual S58e
 *
 * Pipeline horizontal de 5 estados de salud financiera. Replica el patrón
 * de PipelineCompras (S54.x referencia canónica): bloques flex con hover
 * translate-Y, ring-2 cuando activo, monto agregado debajo del count.
 *
 * 5 estados:
 *   - Saludable (emerald) · saldo > mínimo
 *   - Atención (amber) · saldo entre 50%-100% del mínimo
 *   - Crítico (red) · saldo < 50% del mínimo (con saldo-critico softpulse)
 *   - TC corte próximo (sky) · TC con día corte en próximos 7 días
 *   - TC vencida (rose) · TC con saldo > 0 y día pago pasado
 *
 * Click en bloque → filtra el listado abajo. Doble click → limpia filtro.
 */

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarClock,
  AlarmClockOff,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export type EstadoPipeline =
  | 'saludable'
  | 'atencion'
  | 'critico'
  | 'corte_proximo'
  | 'tc_vencida';

export interface BloquePipelineData {
  estado: EstadoPipeline;
  count: number;
  /** Monto agregado del grupo (en moneda mostrada). Vacío para "—" */
  montoTexto: string;
  /** Sublabel descriptivo */
  descripcion: string;
}

interface BloqueConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bgClass: string;        // Tailwind bg/border/text del bloque normal
  bgHover: string;
  borderClass: string;
  textClass: string;      // Color del label
  textMonto: string;      // Color del monto agregado
  textDesc: string;       // Color de la descripción
  ringColor: string;      // Color del ring cuando activo
}

const BLOQUE_CONFIG: Record<EstadoPipeline, BloqueConfig> = {
  saludable: {
    label: 'Saludable',
    icon: CheckCircle2,
    bgClass: 'bg-emerald-50',
    bgHover: 'hover:bg-emerald-100',
    borderClass: 'border-emerald-200',
    textClass: 'text-emerald-700',
    textMonto: 'text-emerald-800',
    textDesc: 'text-emerald-700',
    ringColor: '#059669',
  },
  atencion: {
    label: 'Atención',
    icon: AlertTriangle,
    bgClass: 'bg-amber-50',
    bgHover: 'hover:bg-amber-100',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-700',
    textMonto: 'text-amber-800',
    textDesc: 'text-amber-700',
    ringColor: '#d97706',
  },
  critico: {
    label: 'Crítico',
    icon: XCircle,
    bgClass: 'bg-red-50',
    bgHover: 'hover:bg-red-100',
    borderClass: 'border-red-200',
    textClass: 'text-red-700',
    textMonto: 'text-red-800',
    textDesc: 'text-red-700',
    ringColor: '#dc2626',
  },
  corte_proximo: {
    label: 'TC · Corte próximo',
    icon: CalendarClock,
    bgClass: 'bg-sky-50',
    bgHover: 'hover:bg-sky-100',
    borderClass: 'border-sky-200',
    textClass: 'text-sky-700',
    textMonto: 'text-sky-800',
    textDesc: 'text-sky-700',
    ringColor: '#0284c7',
  },
  tc_vencida: {
    label: 'TC Vencida',
    icon: AlarmClockOff,
    bgClass: 'bg-rose-50',
    bgHover: 'hover:bg-rose-100',
    borderClass: 'border-rose-200',
    textClass: 'text-rose-700',
    textMonto: 'text-rose-800',
    textDesc: 'text-rose-700',
    ringColor: '#e11d48',
  },
};

const ORDEN: EstadoPipeline[] = [
  'saludable',
  'atencion',
  'critico',
  'corte_proximo',
  'tc_vencida',
];

// ═════════════════════════════════════════════════════════════════════════
// BLOQUE INDIVIDUAL
// ═════════════════════════════════════════════════════════════════════════

const BloqueStage: React.FC<{
  data: BloquePipelineData;
  active: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
}> = ({ data, active, onClick, onDoubleClick }) => {
  const cfg = BLOQUE_CONFIG[data.estado];
  const Icon = cfg.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        'flex-1 rounded-xl p-3 text-left transition-all duration-200 ease-out',
        'border cursor-pointer',
        cfg.bgClass,
        cfg.bgHover,
        cfg.borderClass,
        'hover:-translate-y-0.5 active:scale-[0.98]',
        active && 'ring-2 shadow-sm',
      )}
      style={active ? { boxShadow: `0 0 0 2px ${cfg.ringColor}` } : undefined}
    >
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn('w-4 h-4 flex-shrink-0', cfg.textClass.replace('text-', 'text-').replace('-700', '-600'))} />
          <span className={cn('text-xs font-semibold truncate', cfg.textClass)}>
            {cfg.label}
          </span>
        </div>
        <span
          className={cn(
            'text-lg font-bold tabular-nums flex-shrink-0',
            data.estado === 'critico' || data.estado === 'tc_vencida'
              ? cfg.textClass
              : 'text-slate-900',
          )}
        >
          {data.count}
        </span>
      </div>
      <div className={cn('text-[11px] font-semibold tabular-nums', cfg.textMonto)}>
        {data.montoTexto || '—'}
      </div>
      <div className={cn('text-[10px]', cfg.textDesc)}>{data.descripcion}</div>
    </button>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export interface PipelineTesoreriaProps {
  bloques: Record<EstadoPipeline, BloquePipelineData>;
  /** Estado(s) actualmente activos como filtro. Null = ninguno activo */
  estadoActivo?: EstadoPipeline | null;
  /** Click en un bloque → toggle filtro */
  onEstadoClick?: (estado: EstadoPipeline) => void;
  /** Doble click en un bloque → limpia filtro */
  onClear?: () => void;
  /** Mostrar header con título y hint */
  showHeader?: boolean;
  className?: string;
}

export const PipelineTesoreria: React.FC<PipelineTesoreriaProps> = ({
  bloques,
  estadoActivo = null,
  onEstadoClick,
  onClear,
  showHeader = true,
  className,
}) => {
  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-xl p-4',
        className,
      )}
    >
      {showHeader && (
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-slate-800">
            Estado de la tesorería
          </h3>
          <span className="text-xs text-slate-500 hidden sm:block">
            Click en bloque para filtrar · doble click para limpiar
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 lg:flex lg:items-center gap-2">
        {ORDEN.map((estado, idx) => (
          <React.Fragment key={estado}>
            <BloqueStage
              data={bloques[estado]}
              active={estadoActivo === estado}
              onClick={() => onEstadoClick?.(estado)}
              onDoubleClick={onClear}
            />
            {idx < ORDEN.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 hidden lg:block" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════
// HELPER · CALCULAR DATOS DEL PIPELINE DESDE LISTA DE PRODUCTOS
// ═════════════════════════════════════════════════════════════════════════

import type { CuentaCaja } from '../../../types/tesoreria.types';
import type { TarjetaCredito } from '../../../types/tarjetaCredito.types';

/**
 * Calcula los conteos y montos agregados de cada bloque del pipeline a
 * partir de la lista actual de productos (cuentas + tarjetas).
 *
 * Para tarjetas, el saldo lo lee del shape legacy (TarjetaCredito no tiene
 * saldoActual directo, vive en CC espejo). En F5 cuando se elimine TC
 * legacy, esto se simplifica leyendo solo CuentaCaja con tipo='credito'.
 */
export function calcularBloquesPipeline(opts: {
  cuentas: CuentaCaja[];
  tarjetas?: TarjetaCredito[];
  /** Función que devuelve el saldo PEN equivalente de una cuenta */
  saldoPENDeCuenta?: (c: CuentaCaja) => number;
}): Record<EstadoPipeline, BloquePipelineData> {
  const saldoPENDeCuenta =
    opts.saldoPENDeCuenta ??
    ((c) => {
      if (c.esBiMoneda) return (c.saldoPEN ?? 0) + (c.saldoUSD ?? 0) * 3.85;
      return c.moneda === 'PEN' ? c.saldoActual : c.saldoActual * 3.85;
    });

  let saludable = { count: 0, monto: 0 };
  let atencion = { count: 0, monto: 0 };
  let critico = { count: 0, monto: 0 };

  for (const c of opts.cuentas) {
    if (!c.activa) continue;
    if (c.tipo === 'credito') continue; // TCs van aparte
    const saldo = saldoPENDeCuenta(c);
    const minimo = c.saldoMinimo ?? 0;
    if (minimo > 0) {
      const ratio = saldo / minimo;
      if (ratio < 0.5) {
        critico.count++;
        critico.monto += saldo;
      } else if (ratio < 1.0) {
        atencion.count++;
        atencion.monto += saldo;
      } else {
        saludable.count++;
        saludable.monto += saldo;
      }
    } else {
      saludable.count++;
      saludable.monto += saldo;
    }
  }

  // TCs: corte_proximo y tc_vencida (stub por ahora — F4 refina con fecha real)
  let cortePromixo = { count: 0, monto: 0 };
  let tcVencida = { count: 0, monto: 0 };

  if (opts.tarjetas) {
    const hoy = new Date().getDate();
    for (const tc of opts.tarjetas) {
      if (tc.activa === false) continue;
      const dc = tc.diaCorte;
      const dp = tc.diaPago;
      if (!dc || !dp) continue;

      // Corte próximo: día corte está dentro de los próximos 7 días
      const diasACorte = (dc - hoy + 31) % 31;
      if (diasACorte <= 7 && diasACorte > 0) {
        cortePromixo.count++;
        // Monto: lo leemos del CC espejo cuando esté disponible. Stub 0.
      }

      // TC vencida: día pago ya pasó este mes
      if (hoy > dp) {
        // Stub — necesita conocer si hay saldo > 0. F4 lo refina.
      }
    }
  }

  const fmtPEN = (n: number) =>
    n > 0
      ? `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`
      : '—';

  return {
    saludable: {
      estado: 'saludable',
      count: saludable.count,
      montoTexto: fmtPEN(saludable.monto),
      descripcion: 'Sobre el mínimo',
    },
    atencion: {
      estado: 'atencion',
      count: atencion.count,
      montoTexto: fmtPEN(atencion.monto),
      descripcion: '50%–100% del mínimo',
    },
    critico: {
      estado: 'critico',
      count: critico.count,
      montoTexto: fmtPEN(critico.monto),
      descripcion: '< 50% del mínimo',
    },
    corte_proximo: {
      estado: 'corte_proximo',
      count: cortePromixo.count,
      montoTexto: '—',
      descripcion: 'Corte en próximos 7 días',
    },
    tc_vencida: {
      estado: 'tc_vencida',
      count: tcVencida.count,
      montoTexto: '—',
      descripcion: 'Día pago pasado con saldo',
    },
  };
}
