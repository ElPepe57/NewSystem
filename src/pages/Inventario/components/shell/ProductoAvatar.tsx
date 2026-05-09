/**
 * ProductoAvatar · avatar coloreado por línea de negocio (chk4.8)
 *
 * Pixel-perfect mockup stock-canon-s3.6-X.html.
 *
 * Mapeo canónico por código de línea de negocio:
 *   SKC (Skincare)        → amber  + Droplets
 *   SUP (Suplementos)     → indigo + Pill
 *   APPAREL               → emerald + Shirt
 *   ALIM (Alimentos)      → orange + UtensilsCrossed
 *   PCK / esPack=true     → purple + Gift  (con badge contador opcional)
 *   default               → slate + Package
 *
 * NOTA · Tailwind JIT NO admite clases dinámicas string-interpoladas.
 * Por eso este archivo usa un map de clases LITERALES por palette key.
 */

import React from 'react';
import {
  Droplets,
  Pill,
  Shirt,
  UtensilsCrossed,
  Gift,
  Package,
  AlertTriangle,
  Clock,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

// ─── Tipos y mapeos ──────────────────────────────────────────────────────────

type PaletteKey = 'amber' | 'indigo' | 'emerald' | 'orange' | 'purple' | 'slate';

interface PaletteClasses {
  bgGradient: string;
  ring: string;
  iconText: string;
  /** Solo para LineaChipInline */
  chipBg: string;
  chipText: string;
}

const PALETTE_CLASSES: Record<PaletteKey, PaletteClasses> = {
  amber: {
    bgGradient: 'bg-gradient-to-br from-amber-50 to-amber-100',
    ring: 'ring-amber-200/50',
    iconText: 'text-amber-700',
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-700',
  },
  indigo: {
    bgGradient: 'bg-gradient-to-br from-indigo-50 to-indigo-100',
    ring: 'ring-indigo-200/50',
    iconText: 'text-indigo-700',
    chipBg: 'bg-indigo-50',
    chipText: 'text-indigo-700',
  },
  emerald: {
    bgGradient: 'bg-gradient-to-br from-emerald-50 to-emerald-100',
    ring: 'ring-emerald-200/50',
    iconText: 'text-emerald-700',
    chipBg: 'bg-emerald-50',
    chipText: 'text-emerald-700',
  },
  orange: {
    bgGradient: 'bg-gradient-to-br from-orange-50 to-orange-100',
    ring: 'ring-orange-200/50',
    iconText: 'text-orange-700',
    chipBg: 'bg-orange-50',
    chipText: 'text-orange-700',
  },
  purple: {
    bgGradient: 'bg-gradient-to-br from-purple-50 to-purple-100',
    ring: 'ring-purple-200/50',
    iconText: 'text-purple-700',
    chipBg: 'bg-purple-50',
    chipText: 'text-purple-700',
  },
  slate: {
    bgGradient: 'bg-gradient-to-br from-slate-50 to-slate-100',
    ring: 'ring-slate-200/50',
    iconText: 'text-slate-600',
    chipBg: 'bg-slate-50',
    chipText: 'text-slate-700',
  },
};

interface AvatarConfig {
  icon: LucideIcon;
  palette: PaletteKey;
  label: string;
}

const CONFIG_BY_CODIGO: Record<string, AvatarConfig> = {
  SKC:     { icon: Droplets,         palette: 'amber',   label: 'Skincare' },
  SUP:     { icon: Pill,              palette: 'indigo',  label: 'Suplemento' },
  APPAREL: { icon: Shirt,             palette: 'emerald', label: 'Apparel' },
  ALIM:    { icon: UtensilsCrossed,   palette: 'orange',  label: 'Alimento' },
  PCK:     { icon: Gift,              palette: 'purple',  label: 'Pack' },
};

const DEFAULT_CONFIG: AvatarConfig = { icon: Package, palette: 'slate', label: '' };

const resolveConfig = (lineaCodigo?: string, esPack?: boolean): AvatarConfig => {
  if (esPack) return CONFIG_BY_CODIGO.PCK;
  if (!lineaCodigo) return DEFAULT_CONFIG;
  return CONFIG_BY_CODIGO[lineaCodigo.toUpperCase()] ?? DEFAULT_CONFIG;
};

// ─── ProductoAvatar ──────────────────────────────────────────────────────────

interface ProductoAvatarProps {
  lineaCodigo?: string;
  esPack?: boolean;
  /** Cantidad de productos vinculados (solo packs · badge contador) */
  packCount?: number;
  /** Tamaño · 'md' (default · w-10 h-10) o 'sm' (w-7 h-7 para vista Unidades) */
  size?: 'md' | 'sm';
}

export const ProductoAvatar: React.FC<ProductoAvatarProps> = ({
  lineaCodigo,
  esPack = false,
  packCount,
  size = 'md',
}) => {
  const config = resolveConfig(lineaCodigo, esPack);
  const Icon = config.icon;
  const palette = PALETTE_CLASSES[config.palette];

  const sizeClasses = size === 'md' ? 'w-10 h-10' : 'w-7 h-7';
  const iconSize = size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5';

  return (
    <div
      className={`${sizeClasses} rounded-xl flex items-center justify-center flex-shrink-0 ${palette.bgGradient} ring-1 ${palette.ring} relative`}
    >
      <Icon className={`${iconSize} ${palette.iconText}`} />
      {esPack && typeof packCount === 'number' && packCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center tabular-nums">
          {packCount}
        </span>
      )}
    </div>
  );
};

// ─── LineaChipInline ─────────────────────────────────────────────────────────

/**
 * Chip rectangular pequeño con paleta por línea de negocio.
 * Mockup canónico: `bg-{color}-50 text-{color}-700 font-bold` (rounded plano).
 * NO confundir con el `rounded-full` del LineaNegocioBadge legacy.
 */
interface LineaChipInlineProps {
  lineaCodigo?: string;
  /** Texto custom · default: label derivado del código */
  label?: string;
}

export const LineaChipInline: React.FC<LineaChipInlineProps> = ({ lineaCodigo, label }) => {
  if (!lineaCodigo) return null;
  const config = CONFIG_BY_CODIGO[lineaCodigo.toUpperCase()];
  if (!config) return null;
  const palette = PALETTE_CLASSES[config.palette];
  const text = label || config.label;
  return (
    <span className={`px-1.5 py-0.5 rounded ${palette.chipBg} ${palette.chipText} font-bold text-[10px]`}>
      {text}
    </span>
  );
};

// ─── EstadoChipInline ────────────────────────────────────────────────────────

/**
 * Chip de estado especial inline cerca del SKU/marca.
 * Variantes canónicas del mockup X.
 */
export type EstadoChipVariant = 'critico' | 'vencen' | 'solo_origen' | 'activo' | 'pack';

interface EstadoChipInlineProps {
  variant: EstadoChipVariant;
  label?: string;
}

interface EstadoConfig {
  classes: string;
  icon: LucideIcon | null;
  defaultLabel: string;
}

const ESTADO_CONFIG: Record<EstadoChipVariant, EstadoConfig> = {
  critico:     { classes: 'bg-rose-100 text-rose-700',       icon: AlertTriangle, defaultLabel: 'Crítico' },
  vencen:      { classes: 'bg-amber-100 text-amber-800',     icon: Clock,         defaultLabel: 'Vence pronto' },
  solo_origen: { classes: 'bg-sky-50 text-sky-700',          icon: Warehouse,     defaultLabel: 'Solo origen' },
  activo:      { classes: 'bg-emerald-50 text-emerald-700',  icon: null,          defaultLabel: 'Activo' },
  pack:        { classes: 'bg-purple-100 text-purple-700',   icon: null,          defaultLabel: 'Pack' },
};

export const EstadoChipInline: React.FC<EstadoChipInlineProps> = ({ variant, label }) => {
  const cfg = ESTADO_CONFIG[variant];
  const Icon = cfg.icon;
  const text = label || cfg.defaultLabel;
  const isPackVariant = variant === 'pack';
  return (
    <span
      className={`px-1.5 py-0.5 rounded ${cfg.classes} font-bold inline-flex items-center gap-0.5 ${
        isPackVariant ? 'text-[9px] uppercase' : 'text-[10px]'
      }`}
    >
      {Icon && <Icon className="w-2.5 h-2.5" />}
      {text}
    </span>
  );
};
