/**
 * ProductoAvatar · avatar coloreado con `linea.color` real de BD (chk4.9)
 *
 * Solución 360 alineada con el sistema existente:
 *   - Lee `linea.color` (HEX) y `linea.icono` (emoji) directamente de BD
 *   - Patrón canónico vigente: ${color}20 fondo · ${color}30 ring · linea.color icono
 *   - Mismo enfoque que LineaNegocioBadge.tsx, ProductoForm.tsx, LineaDropdown.tsx
 *   - NO hardcodear paletas Tailwind (amber/indigo) que ignoran lo configurado en BD
 *
 * Si el usuario quiere cambiar el color de Skincare, lo hace en el ABM de líneas
 * de negocio · todo el sistema reflejará el cambio (badge, dropdown, avatar, etc.)
 *
 * Mockup canónico stock-canon-s3.6-X.html · estructura:
 *   div w-10 h-10 rounded-xl bg-{linea.color}20 ring-1 ring-{linea.color}30
 *     ← centrado: emoji 1.5x ó lucide icon fallback
 *     [opcional] badge contador esquina sup-derecha (packs)
 */

import React from 'react';
import { Package } from 'lucide-react';
import type { LineaNegocio } from '../../../../types/lineaNegocio.types';

// ─── ProductoAvatar ──────────────────────────────────────────────────────────

interface ProductoAvatarProps {
  /** Línea de negocio del producto · objeto completo del store (NO lineaCodigo) */
  linea?: LineaNegocio | null;
  /** True si el producto es un pack · render con badge contador esquina */
  esPack?: boolean;
  /** Cantidad de productos vinculados al pack (badge contador) */
  packCount?: number;
  /** Tamaño · 'md' (default · w-10 h-10) o 'sm' (w-7 h-7 para vista Unidades) */
  size?: 'md' | 'sm';
}

export const ProductoAvatar: React.FC<ProductoAvatarProps> = ({
  linea,
  esPack = false,
  packCount,
  size = 'md',
}) => {
  const sizeClasses = size === 'md' ? 'w-10 h-10' : 'w-7 h-7';
  const iconSize = size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  const emojiSize = size === 'md' ? 'text-xl' : 'text-sm';

  // Color de fondo y ring derivados del color HEX de la línea (BD)
  // Patrón canónico: alpha 20 (12%) fondo · alpha 30 (~19%) ring
  const baseStyle: React.CSSProperties = linea
    ? {
        backgroundColor: `${linea.color}20`,
        boxShadow: `0 0 0 1px ${linea.color}30`,
      }
    : {
        // Fallback gris cuando no hay línea (productos huérfanos)
      };

  return (
    <div
      style={baseStyle}
      className={`
        ${sizeClasses} rounded-xl flex items-center justify-center flex-shrink-0 relative
        ${linea ? '' : 'bg-slate-100 ring-1 ring-slate-200'}
      `.trim().replace(/\s+/g, ' ')}
    >
      {linea?.icono ? (
        <span className={`${emojiSize} leading-none`} style={{ filter: 'saturate(1.1)' }}>
          {linea.icono}
        </span>
      ) : (
        <Package className={`${iconSize} text-slate-400`} />
      )}
      {esPack && typeof packCount === 'number' && packCount > 0 && (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 text-white text-[8px] font-bold rounded-full flex items-center justify-center tabular-nums"
          style={{ backgroundColor: linea?.color || '#7c3aed' }}
        >
          {packCount}
        </span>
      )}
    </div>
  );
};

// ─── LineaChipInline ─────────────────────────────────────────────────────────

/**
 * Chip rectangular pequeño coloreado con `linea.color` real de BD.
 *
 * Variante visual del LineaNegocioBadge legacy (rounded-full) propuesta por
 * el mockup canon S3.6 X · estilo Linear/Stripe rectangular más moderno.
 *
 * Misma fuente de verdad: usa `linea.color` y `linea.nombre` de la BD.
 * Si el usuario quiere cambiar el color/nombre, lo hace en el ABM y se
 * refleja aquí automáticamente.
 */
interface LineaChipInlineProps {
  linea?: LineaNegocio | null;
  /** Texto custom (override) · default: linea.nombre */
  label?: string;
}

export const LineaChipInline: React.FC<LineaChipInlineProps> = ({ linea, label }) => {
  if (!linea) return null;
  return (
    <span
      className="px-1.5 py-0.5 rounded font-bold text-[10px]"
      style={{ backgroundColor: `${linea.color}20`, color: linea.color }}
    >
      {label || linea.nombre}
    </span>
  );
};

// ─── EstadoChipInline ────────────────────────────────────────────────────────

/**
 * Chip de estado especial inline (Crítico, Vence Nd, Solo origen, etc.)
 *
 * NOTA · estos son estados universales (no por línea de negocio), por eso
 * se mantiene la paleta Tailwind hardcoded · no aplica `linea.color`.
 *
 * Si en el futuro se requiere personalización del color de "Crítico" por
 * cliente/empresa, se agrega un campo `severity.color` configurable.
 */

import { AlertTriangle, Clock, Warehouse, type LucideIcon } from 'lucide-react';

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
