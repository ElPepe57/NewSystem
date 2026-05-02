/**
 * ChipPill · átomo compartido del módulo Productos V2
 *
 * Pill chico tipo "tag/badge" reutilizado en filtros, banners de producto, scores,
 * acciones (Reponer/Vigilar/Liquidar), atributos (Skincare/Suplemento), etc.
 *
 * Variantes: variant determina el color semántico (slate/emerald/amber/rose/sky/indigo/purple/teal)
 * Modos: solid (fondo lleno) · soft (fondo tenue + borde) · outline (sin fondo)
 *
 * Mockup canónico: ver atomos en docs/mockups/productos/01-page-listado.html y derivados.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type ChipVariant =
  | 'slate'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'indigo'
  | 'purple'
  | 'teal'
  | 'dark'; // solid slate-900 (chip "Todos" activo)

export type ChipMode = 'solid' | 'soft' | 'outline';

export type ChipSize = 'sm' | 'md';

interface ChipPillProps {
  children: React.ReactNode;
  variant?: ChipVariant;
  mode?: ChipMode;
  size?: ChipSize;
  icon?: LucideIcon;
  count?: number | string;
  onClick?: () => void;
  className?: string;
  active?: boolean;
}

const VARIANT_CLASSES: Record<ChipVariant, { soft: string; solid: string; outline: string }> = {
  slate: {
    soft: 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100',
    solid: 'bg-slate-900 text-white shadow-sm',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
  },
  emerald: {
    soft: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
    solid: 'bg-emerald-600 text-white shadow-sm',
    outline: 'border border-emerald-300 text-emerald-700 hover:bg-emerald-50',
  },
  amber: {
    soft: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100',
    solid: 'bg-amber-600 text-white shadow-sm',
    outline: 'border border-amber-300 text-amber-700 hover:bg-amber-50',
  },
  rose: {
    soft: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100',
    solid: 'bg-rose-600 text-white shadow-sm',
    outline: 'border border-rose-300 text-rose-700 hover:bg-rose-50',
  },
  sky: {
    soft: 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100',
    solid: 'bg-sky-600 text-white shadow-sm',
    outline: 'border border-sky-300 text-sky-700 hover:bg-sky-50',
  },
  indigo: {
    soft: 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100',
    solid: 'bg-indigo-600 text-white shadow-sm',
    outline: 'border border-indigo-300 text-indigo-700 hover:bg-indigo-50',
  },
  purple: {
    soft: 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100',
    solid: 'bg-purple-600 text-white shadow-sm',
    outline: 'border border-purple-300 text-purple-700 hover:bg-purple-50',
  },
  teal: {
    soft: 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100',
    solid: 'bg-teal-600 text-white shadow-sm',
    outline: 'border border-teal-300 text-teal-700 hover:bg-teal-50',
  },
  dark: {
    soft: 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200',
    solid: 'bg-slate-900 text-white shadow-sm',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
  },
};

const SIZE_CLASSES: Record<ChipSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px] gap-1',
  md: 'px-3 py-1.5 text-xs gap-1.5',
};

/**
 * Muestra el conteo dentro de la pill: visualmente atenuado dentro del color.
 */
function CountBadge({ count, mode, variant }: { count: number | string; mode: ChipMode; variant: ChipVariant }) {
  const baseTextClass = mode === 'solid' || variant === 'dark' ? 'text-white/70' : 'opacity-60';
  return <span className={`tabular-nums font-bold ${baseTextClass}`}>{count}</span>;
}

export const ChipPill: React.FC<ChipPillProps> = ({
  children,
  variant = 'slate',
  mode = 'soft',
  size = 'md',
  icon: Icon,
  count,
  onClick,
  className = '',
  active = false,
}) => {
  const effectiveMode = active ? 'solid' : mode;
  const effectiveVariant = active && variant === 'slate' ? 'dark' : variant;
  const variantClasses = VARIANT_CLASSES[effectiveVariant][effectiveMode];
  const sizeClasses = SIZE_CLASSES[size];
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      onClick={onClick}
      className={`inline-flex items-center font-semibold rounded-full transition-all ${variantClasses} ${sizeClasses} ${className}`}
      type={onClick ? 'button' : undefined}
    >
      {Icon && <Icon className={iconSize} />}
      <span>{children}</span>
      {count !== undefined && <CountBadge count={count} mode={effectiveMode} variant={effectiveVariant} />}
    </Component>
  );
};
