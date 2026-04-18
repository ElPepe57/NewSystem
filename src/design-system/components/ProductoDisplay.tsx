import React from 'react';
import { Pill, Sparkles, Package } from 'lucide-react';
import { cn } from '../utils';
import { getDescripcionProducto } from '../../utils/producto.helpers';
import type { AtributosSkincare } from '../../types/producto.types';

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

/**
 * Shape mínimo de producto que el componente consume.
 * Compatible con `Producto` del catálogo y con snapshots de producto guardados
 * en OCs, ventas, envíos, etc.
 */
export interface ProductoDisplayData {
  sku?: string;
  marca?: string;
  nombreComercial?: string;
  presentacion?: string;
  dosaje?: string;
  contenido?: string | number;
  sabor?: string;
  pesoLibras?: number;
  atributosSkincare?: AtributosSkincare;
  /** Flag de línea de negocio — útil para icono tematizado si no hay atributosSkincare */
  lineaNegocio?: 'SUP' | 'SKC' | string;
}

interface ProductoDisplayProps {
  /** Datos del producto */
  producto: ProductoDisplayData;
  /** Variante visual */
  variant?: 'card' | 'row' | 'inline' | 'compact';
  /** Mostrar metadata extra (peso, SKU, marca badge) */
  showMetadata?: boolean;
  /** Ocultar SKU */
  hideSku?: boolean;
  /** Ocultar marca */
  hideMarca?: boolean;
  /** Ocultar descripción rica (presentación / dosaje / etc.) */
  hideDescripcion?: boolean;
  /** Slot trailing — contenido adicional al final (precio, cantidad, etc.) */
  trailing?: React.ReactNode;
  /** Callback al hacer click en todo el bloque */
  onClick?: () => void;
  /** ClassName adicional */
  className?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Helper: ícono según línea
// ════════════════════════════════════════════════════════════════════════════

function getLineIcon(producto: ProductoDisplayData): React.ReactNode {
  // Si tiene atributos SKC, es skincare
  if (producto.atributosSkincare) {
    return <Sparkles className="w-4 h-4 text-pink-600" />;
  }
  // Si tiene presentacion o dosaje, es suplemento
  if (producto.presentacion || producto.dosaje || producto.lineaNegocio === 'SUP') {
    return <Pill className="w-4 h-4 text-teal-600" />;
  }
  // Fallback
  return <Package className="w-4 h-4 text-slate-500" />;
}

function getLineBg(producto: ProductoDisplayData): string {
  if (producto.atributosSkincare) return 'bg-pink-50';
  if (producto.presentacion || producto.dosaje || producto.lineaNegocio === 'SUP') {
    return 'bg-teal-50';
  }
  return 'bg-slate-50';
}

// ════════════════════════════════════════════════════════════════════════════
// ProductoDisplay — Main export
// ════════════════════════════════════════════════════════════════════════════

/**
 * ProductoDisplay — Visualización consistente de un producto.
 *
 * Usa `getDescripcionProducto()` internamente para mantener descripciones
 * ricas consistentes en toda la app (Wizard OC, Envíos, Detalle, Cards, etc.).
 *
 * Variantes:
 *   - `card`: tarjeta con icono grande, nombre, marca, descripción. Ideal para listas.
 *   - `row`: fila horizontal compacta. Ideal para tablas o listas densas.
 *   - `inline`: texto mínimo (SKU + nombre + desc). Ideal para líneas de resumen.
 *   - `compact`: solo nombre + desc corta, sin meta. Ideal para previews.
 *
 * Ejemplo:
 *   <ProductoDisplay producto={producto} variant="row" trailing={<Cantidad />} />
 */
export const ProductoDisplay: React.FC<ProductoDisplayProps> = ({
  producto,
  variant = 'row',
  showMetadata = true,
  hideSku = false,
  hideMarca = false,
  hideDescripcion = false,
  trailing,
  onClick,
  className,
}) => {
  const descripcion = hideDescripcion ? '' : getDescripcionProducto(producto);
  const icon = getLineIcon(producto);
  const iconBg = getLineBg(producto);

  const nombre = producto.nombreComercial ?? 'Producto sin nombre';

  // ─── Variant: inline (una línea de texto) ────────────────────────────────
  if (variant === 'inline') {
    return (
      <span
        className={cn('text-sm text-slate-700', onClick && 'cursor-pointer hover:underline', className)}
        onClick={onClick}
      >
        {!hideSku && producto.sku && (
          <span className="font-mono text-xs text-teal-600 mr-2">{producto.sku}</span>
        )}
        <span className="font-medium">{nombre}</span>
        {descripcion && <span className="text-slate-500 ml-2">· {descripcion}</span>}
      </span>
    );
  }

  // ─── Variant: compact (nombre + desc corta) ──────────────────────────────
  if (variant === 'compact') {
    return (
      <div
        className={cn('min-w-0', onClick && 'cursor-pointer', className)}
        onClick={onClick}
      >
        <div className="text-sm font-medium text-slate-900 truncate">{nombre}</div>
        {descripcion && (
          <div className="text-xs text-slate-500 truncate">{descripcion}</div>
        )}
      </div>
    );
  }

  // ─── Variant: row (horizontal con icono) ─────────────────────────────────
  if (variant === 'row') {
    return (
      <div
        className={cn(
          'flex items-start gap-3',
          onClick && 'cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-1 rounded',
          className
        )}
        onClick={onClick}
      >
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
            iconBg
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {!hideSku && producto.sku && (
              <span className="font-mono text-xs text-teal-600 flex-shrink-0">
                {producto.sku}
              </span>
            )}
            <span className="text-sm font-semibold text-slate-900 truncate">
              {nombre}
            </span>
            {!hideMarca && producto.marca && showMetadata && (
              <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                {producto.marca}
              </span>
            )}
          </div>
          {descripcion && (
            <div className="text-xs text-slate-500 mt-0.5 truncate">{descripcion}</div>
          )}
          {showMetadata && producto.pesoLibras && producto.pesoLibras > 0 && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              Peso: {producto.pesoLibras.toFixed(2)} lb
            </div>
          )}
        </div>
        {trailing && <div className="flex-shrink-0">{trailing}</div>}
      </div>
    );
  }

  // ─── Variant: card (tarjeta completa) ────────────────────────────────────
  return (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3',
        onClick && 'cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all',
        className
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
          iconBg
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {!hideSku && producto.sku && (
            <span className="font-mono text-xs text-teal-600">{producto.sku}</span>
          )}
          {!hideMarca && producto.marca && showMetadata && (
            <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
              {producto.marca}
            </span>
          )}
        </div>
        <div className="text-sm font-semibold text-slate-900 truncate">{nombre}</div>
        {descripcion && (
          <div className="text-xs text-slate-500 mt-1">{descripcion}</div>
        )}
        {showMetadata && producto.pesoLibras && producto.pesoLibras > 0 && (
          <div className="text-[10px] text-slate-400 mt-1">
            Peso: {producto.pesoLibras.toFixed(2)} lb
          </div>
        )}
      </div>
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
    </div>
  );
};
