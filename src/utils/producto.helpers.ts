import type { AtributosSkincare, TexturaSKC } from '../types/producto.types';
import { TEXTURA_LABELS } from '../types/producto.types';

/**
 * Genera la descripción inline de un producto según su línea de negocio.
 *
 * SUP → "Cápsulas · 500 mg · 60 · Neutral"
 * SKC → "50 ml · Centella Asiática · Gel · SPF50 ++++"
 *
 * Uso: getDescripcionProducto(producto) en cualquier componente
 * que muestre info descriptiva de producto (cards, tablas, buscadores, etc.)
 */
export function getDescripcionProducto(p: {
  presentacion?: string;
  dosaje?: string;
  contenido?: string | number;
  sabor?: string;
  atributosSkincare?: AtributosSkincare;
}): string {
  if (p.atributosSkincare) {
    const skc = p.atributosSkincare;
    const textura = skc.textura
      ? TEXTURA_LABELS[skc.textura as TexturaSKC] || skc.textura
      : undefined;
    const spf = skc.spf
      ? `SPF${skc.spf} ${skc.pa || ''}`.trim()
      : undefined;
    return [
      skc.volumen,
      skc.ingredienteClave,
      textura,
      spf,
    ].filter(Boolean).join(' · ');
  }

  return [
    p.presentacion,
    p.dosaje,
    p.contenido,
    p.sabor,
  ].filter(Boolean).join(' · ');
}

/**
 * Genera texto buscable para indexación full-text de un producto.
 * Incluye campos SUP y SKC según corresponda.
 */
export function getSearchableProductText(p: {
  sku?: string;
  marca?: string;
  nombreComercial?: string;
  presentacion?: string;
  dosaje?: string;
  contenido?: string | number;
  sabor?: string;
  atributosSkincare?: AtributosSkincare;
}): string {
  const base = `${p.sku ?? ''} ${p.marca ?? ''} ${p.nombreComercial ?? ''}`;

  if (p.atributosSkincare) {
    const skc = p.atributosSkincare;
    return `${base} ${skc.volumen ?? ''} ${skc.ingredienteClave ?? ''} ${skc.lineaProducto ?? ''} ${skc.textura ?? ''}`.toLowerCase();
  }

  return `${base} ${p.presentacion ?? ''} ${p.dosaje ?? ''} ${p.contenido ?? ''} ${p.sabor ?? ''}`.toLowerCase();
}
