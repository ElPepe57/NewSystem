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

/**
 * Construye el snapshot base de un producto para persistir en Firestore.
 * Fuente única de verdad: todos los servicios que guardan datos de producto
 * (OC, ventas, cotizaciones) deben usar este helper.
 *
 * - Nunca incluye campos undefined (Firestore los rechaza)
 * - Acepta tanto producto del catálogo (id) como snapshot existente (productoId)
 *
 * Uso: const snap = buildProductoSnapshot(producto);
 *      const prodOrden = { ...snap, cantidad, costoUnitario, subtotal };
 */
export function buildProductoSnapshot(producto: {
  productoId?: string;
  id?: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion?: string;
  contenido?: string;
  dosaje?: string;
  sabor?: string;
  pesoLibras?: number;
  atributosSkincare?: AtributosSkincare;
}): {
  productoId: string;
  sku: string;
  marca: string;
  nombreComercial: string;
  presentacion: string;
  contenido?: string;
  dosaje?: string;
  sabor?: string;
  pesoLibras?: number;
  atributosSkincare?: AtributosSkincare;
} {
  const snap: Record<string, unknown> = {
    productoId: producto.productoId || producto.id || '',
    sku: producto.sku,
    marca: producto.marca,
    nombreComercial: producto.nombreComercial,
    presentacion: producto.presentacion || '',
  };
  if (producto.contenido) snap.contenido = producto.contenido;
  if (producto.dosaje) snap.dosaje = producto.dosaje;
  if (producto.sabor) snap.sabor = producto.sabor;
  if (producto.pesoLibras && producto.pesoLibras > 0) snap.pesoLibras = producto.pesoLibras;
  if (producto.atributosSkincare) snap.atributosSkincare = producto.atributosSkincare;
  return snap as any;
}
