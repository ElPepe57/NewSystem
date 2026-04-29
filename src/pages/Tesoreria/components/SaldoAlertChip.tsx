/**
 * SaldoAlertChip — Imp-L1.1.6 · Refactor visual S58e
 *
 * Chip de alerta sutil que se muestra en cards de producto cuando el saldo
 * está en estado distinto a "saludable". 4 estados:
 *   - saludable    → no se muestra chip (limpieza visual)
 *   - atencion     → chip amber
 *   - critico      → chip rojo (con animación softpulse)
 *   - corte_proximo → chip sky (TC con día corte cercano)
 *   - tc_vencida   → chip rosa (TC con saldo y día pago pasado)
 *
 * Q-A2 post-L1: en listados solo chip alerta (no barra de progreso).
 * La barra completa solo se muestra en el modal de detalle.
 */

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarClock,
  AlarmClockOff,
} from 'lucide-react';
import { cn } from '../../../design-system/utils';

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export type SaldoEstado =
  | 'saludable'
  | 'atencion'
  | 'critico'
  | 'corte_proximo'
  | 'tc_vencida';

interface EstadoConfig {
  label: string;
  bg: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  pulse?: boolean;
}

const CONFIG: Record<SaldoEstado, EstadoConfig> = {
  saludable: {
    label: 'Saludable',
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    icon: CheckCircle2,
  },
  atencion: {
    label: 'Atención',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: AlertTriangle,
  },
  critico: {
    label: 'Crítico',
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: XCircle,
    pulse: true,
  },
  corte_proximo: {
    label: 'Corte próximo',
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    icon: CalendarClock,
  },
  tc_vencida: {
    label: 'TC vencida',
    bg: 'bg-rose-100',
    text: 'text-rose-700',
    icon: AlarmClockOff,
    pulse: true,
  },
};

// ═════════════════════════════════════════════════════════════════════════
// HELPER · CALCULAR ESTADO DESDE PRODUCTO
// ═════════════════════════════════════════════════════════════════════════

/**
 * Calcula el estado de salud de un producto a partir de su saldo y mínimo.
 * Las TCs tienen lógica distinta (basada en día corte/pago, no saldo mínimo).
 */
export function calcularEstadoSaldo(opts: {
  saldoActual: number;
  saldoMinimo?: number;
  esTarjetaCredito?: boolean;
  diaCorte?: number;
  diaPago?: number;
}): SaldoEstado {
  // TC: lógica de corte/pago (esto lo refinaremos en F4 con fecha actual real)
  if (opts.esTarjetaCredito) {
    // Stub: por ahora todas las TCs activas se consideran saludables.
    // El cálculo correcto de "corte_proximo" / "tc_vencida" requiere
    // comparar día corte con día actual, lo implementamos en useEstadoTC.
    return 'saludable';
  }

  // Cuentas/cajas/wallets: basado en saldo vs mínimo
  if (!opts.saldoMinimo || opts.saldoMinimo <= 0) return 'saludable';
  const ratio = opts.saldoActual / opts.saldoMinimo;
  if (ratio < 0.5) return 'critico';
  if (ratio < 1.0) return 'atencion';
  return 'saludable';
}

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═════════════════════════════════════════════════════════════════════════

export interface SaldoAlertChipProps {
  estado: SaldoEstado;
  /** Si true, oculta el chip cuando estado='saludable' (default true) */
  hideOnSaludable?: boolean;
  /** Si true, muestra solo el icono sin label */
  iconOnly?: boolean;
  className?: string;
}

export const SaldoAlertChip: React.FC<SaldoAlertChipProps> = ({
  estado,
  hideOnSaludable = true,
  iconOnly = false,
  className,
}) => {
  if (estado === 'saludable' && hideOnSaludable) return null;

  const cfg = CONFIG[estado];
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full',
        cfg.bg,
        cfg.text,
        cfg.pulse && 'animate-pulse',
        className,
      )}
    >
      <Icon className="w-2.5 h-2.5 flex-shrink-0" />
      {!iconOnly && cfg.label}
    </span>
  );
};

/**
 * Variante "saludable" visible · útil cuando se quiere mostrar el chip
 * verde explícitamente (ej: en el detalle del producto).
 */
export const SaldoChipSaludable: React.FC<{ className?: string }> = ({
  className,
}) => <SaldoAlertChip estado="saludable" hideOnSaludable={false} className={className} />;
