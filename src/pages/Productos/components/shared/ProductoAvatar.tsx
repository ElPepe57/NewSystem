/**
 * ProductoAvatar · átomo compartido del módulo Productos V2
 *
 * Avatar cuadrado redondeado con icono de Lucide y color según LÍNEA del producto:
 *   - Skincare → amber
 *   - Suplementos / Wellness → indigo
 *   - Pack / Kit → purple (con badge "Pack" opcional)
 *   - Otros → slate
 *
 * Tamaños: xs (28px) · sm (32px) · md (40px) · lg (48px) · xl (56px)
 *
 * Mockup canónico: ver patrón en docs/mockups/productos/01-page-listado.html (filas)
 * y 30-tool-dashboard-catalogo.html (Productos Intel rows).
 */

import React from 'react';
import { Droplets, Pill, Package, Gift, Leaf, Sun, Sparkles, Flower, type LucideIcon } from 'lucide-react';

export type ProductoLinea = 'skincare' | 'suplemento' | 'wellness' | 'pack' | 'otros';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ProductoAvatarProps {
  linea: ProductoLinea;
  /** Override manual del icono (si la línea no captura el matiz: ej. "Aloe Vera Gel" usa Leaf en lugar del default Droplets) */
  icon?: LucideIcon;
  size?: AvatarSize;
  /** Si true, agrega un mini-badge "PACK" en la esquina (combinable con linea='pack') */
  showPackBadge?: boolean;
  /** Si true, aplica grayscale + opacidad reducida (estado archivado) */
  disabled?: boolean;
  className?: string;
}

const LINEA_STYLES: Record<ProductoLinea, { bg: string; ring: string; text: string; defaultIcon: LucideIcon }> = {
  skincare: {
    bg: 'bg-gradient-to-br from-amber-50 to-amber-100',
    ring: 'ring-amber-200/60',
    text: 'text-amber-700',
    defaultIcon: Droplets,
  },
  suplemento: {
    bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100',
    ring: 'ring-indigo-200/60',
    text: 'text-indigo-700',
    defaultIcon: Pill,
  },
  wellness: {
    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100',
    ring: 'ring-emerald-200/60',
    text: 'text-emerald-700',
    defaultIcon: Leaf,
  },
  pack: {
    bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
    ring: 'ring-purple-200/60',
    text: 'text-purple-700',
    defaultIcon: Gift,
  },
  otros: {
    bg: 'bg-gradient-to-br from-slate-50 to-slate-100',
    ring: 'ring-slate-200/60',
    text: 'text-slate-600',
    defaultIcon: Package,
  },
};

const SIZE_STYLES: Record<AvatarSize, { box: string; iconSize: string; rounded: string; badge: string }> = {
  xs: { box: 'w-7 h-7', iconSize: 'w-3.5 h-3.5', rounded: 'rounded-lg', badge: 'text-[7px] px-1' },
  sm: { box: 'w-8 h-8', iconSize: 'w-4 h-4', rounded: 'rounded-lg', badge: 'text-[8px] px-1' },
  md: { box: 'w-10 h-10', iconSize: 'w-5 h-5', rounded: 'rounded-xl', badge: 'text-[8px] px-1' },
  lg: { box: 'w-12 h-12', iconSize: 'w-6 h-6', rounded: 'rounded-xl', badge: 'text-[9px] px-1.5' },
  xl: { box: 'w-14 h-14', iconSize: 'w-7 h-7', rounded: 'rounded-2xl', badge: 'text-[10px] px-1.5' },
};

export const ProductoAvatar: React.FC<ProductoAvatarProps> = ({
  linea,
  icon,
  size = 'md',
  showPackBadge = false,
  disabled = false,
  className = '',
}) => {
  const styles = LINEA_STYLES[linea];
  const sizeStyle = SIZE_STYLES[size];
  const IconComponent = icon ?? styles.defaultIcon;

  return (
    <div
      className={`relative ${sizeStyle.box} ${sizeStyle.rounded} ${styles.bg} ring-1 ${styles.ring} flex items-center justify-center flex-shrink-0 ${
        disabled ? 'grayscale opacity-60' : ''
      } ${className}`}
    >
      <IconComponent className={`${sizeStyle.iconSize} ${styles.text}`} />
      {showPackBadge && (
        <span
          className={`absolute -top-1 -right-1 bg-purple-600 text-white font-bold rounded-full leading-none ${sizeStyle.badge} py-0.5 ring-1 ring-white`}
        >
          PACK
        </span>
      )}
    </div>
  );
};

/**
 * Helper: determina la `linea` desde un Producto de la BD (campo `linea` o `lineaNegocioId`).
 * Por defecto agrupa Skincare, Suplemento, Wellness, Pack y otros.
 */
export function inferLineaFromProducto(producto: { linea?: string; tipo?: string; esPack?: boolean }): ProductoLinea {
  if (producto.esPack) return 'pack';
  const code = (producto.linea ?? producto.tipo ?? '').toLowerCase();
  if (code.includes('skin')) return 'skincare';
  if (code.includes('sup') || code.includes('vita') || code.includes('cap')) return 'suplemento';
  if (code.includes('well') || code.includes('aloe') || code.includes('herbal')) return 'wellness';
  return 'otros';
}

/** Re-export de íconos comunes para uso directo (atajo) */
export { Droplets, Pill, Package, Gift, Leaf, Sun, Sparkles, Flower };
