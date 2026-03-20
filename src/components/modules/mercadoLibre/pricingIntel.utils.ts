/**
 * Utilidades puras para el Panel de Pricing Inteligente de MercadoLibre.
 * Join de datos ML (agrupados) + CTRU, cálculos de margen, color-coding.
 *
 * Trabaja a nivel de MLProductGroup (1 fila = 1 producto agrupado por SKU).
 */

import type { MLProductMap, MLProductGroup } from '../../../types/mercadoLibre.types';
import type { CTRUProductoDetalle } from '../../../store/ctruStore';

// ============================================================
// TIPOS
// ============================================================

export interface PricingIntelRow {
  // Group identity
  groupKey: string;
  listings: MLProductMap[];        // all listings in this group
  listingIds: string[];            // mlProductMapIds for batch price updates

  // Display data (from primary listing)
  mlTitle: string;
  mlPrice: number;                 // shared price across listings
  mlThumbnail: string;
  mlPermalink: string;             // link to primary listing
  mlSku: string | null;
  mlStatus: string;

  // Listing types present
  hasCatalogo: boolean;
  hasClasica: boolean;

  // Vinculación
  vinculado: boolean;
  productoId: string | null;
  productoNombre: string | null;
  productoSku: string | null;

  // Buy Box (from catalog listing only)
  buyBoxStatus: string | null;
  buyBoxPriceToWin: number | null;
  buyBoxWinnerPrice: number | null;
  buyBoxVisitShare: string | null;

  // Costo (from CTRU, null if unlinked or no data)
  costoInventario: number | null;  // capas 1-5
  ctru: number | null;             // capas 1-6
  costoTotal: number | null;       // capas 1-7

  // Márgenes calculados
  margenBruto: number | null;      // (price - costoInventario) / price * 100
  margenNeto: number | null;       // (price - costoTotal) / price * 100
  margenAtBuyBoxPrice: number | null; // margen si igualas buyBoxPriceToWin

  // Precios sugeridos
  precioMinimo10: number | null;
  precioMinimo20: number | null;
  precioMinimo30: number | null;
}

export type MarginFilter = 'todos' | 'critico' | 'bajo' | 'saludable' | 'negativo';
export type BuyBoxFilter = 'todos' | 'winning' | 'competing' | 'sharing_first_place' | 'listed';
export type VinculadoFilter = 'todos' | 'vinculados' | 'sin_vincular';

export type SortField = 'precio' | 'costo' | 'margen' | 'buybox' | 'nombre';
export type SortDir = 'asc' | 'desc';

// ============================================================
// CÁLCULOS PUROS
// ============================================================

/** Calcula margen: (precio - costo) / precio * 100 */
export function calcMargin(price: number, cost: number): number {
  if (price <= 0) return -100;
  return ((price - cost) / price) * 100;
}

/** Calcula precio mínimo para alcanzar un margen objetivo */
export function calcMinPrice(cost: number, targetMarginPct: number): number {
  if (targetMarginPct >= 100) return Infinity;
  return cost / (1 - targetMarginPct / 100);
}

// ============================================================
// BUILDER: Join MLProductGroup[] + CTRU → PricingIntelRow[]
// ============================================================

export function buildPricingIntelRows(
  groups: MLProductGroup[],
  ctruProductos: CTRUProductoDetalle[]
): PricingIntelRow[] {
  // Index CTRU by productoId for O(1) lookup
  const ctruMap = new Map<string, CTRUProductoDetalle>();
  for (const cp of ctruProductos) {
    ctruMap.set(cp.productoId, cp);
  }

  return groups.map((group) => {
    // Primary listing = first one (usually catalog if exists)
    const catalogListing = group.listings.find(l => l.mlListingType === 'catalogo');
    const primary = catalogListing || group.listings[0];

    const hasCatalogo = group.listings.some(l => l.mlListingType === 'catalogo');
    const hasClasica = group.listings.some(l => l.mlListingType !== 'catalogo');

    // CTRU data
    const ctru = group.productoId ? ctruMap.get(group.productoId) : null;
    const hasCost = ctru && ctru.costoTotalRealProm > 0;

    const costoInventario = hasCost ? ctru.costoInventarioProm : null;
    const ctruVal = hasCost ? ctru.ctruPromedio : null;
    const costoTotal = hasCost ? ctru.costoTotalRealProm : null;

    const price = primary.mlPrice;
    const margenBruto = costoInventario != null ? calcMargin(price, costoInventario) : null;
    const margenNeto = costoTotal != null ? calcMargin(price, costoTotal) : null;

    // Buy Box: solo de la publicación catálogo
    const bbListing = catalogListing;
    const bbPrice = bbListing?.buyBoxPriceToWin ?? null;
    const margenAtBuyBoxPrice = bbPrice != null && costoTotal != null
      ? calcMargin(bbPrice, costoTotal)
      : null;

    const precioBase = costoTotal ?? ctruVal ?? costoInventario;

    return {
      groupKey: group.groupKey,
      listings: group.listings,
      listingIds: group.listings.map(l => l.id),

      mlTitle: primary.mlTitle,
      mlPrice: price,
      mlThumbnail: primary.mlThumbnail,
      mlPermalink: primary.mlPermalink,
      mlSku: group.mlSku || primary.mlSku,
      mlStatus: primary.mlStatus,

      hasCatalogo,
      hasClasica,

      vinculado: group.vinculado,
      productoId: group.productoId,
      productoNombre: group.productoNombre,
      productoSku: group.productoSku,

      buyBoxStatus: bbListing?.buyBoxStatus ?? null,
      buyBoxPriceToWin: bbPrice,
      buyBoxWinnerPrice: bbListing?.buyBoxWinnerPrice ?? null,
      buyBoxVisitShare: bbListing?.buyBoxVisitShare ?? null,

      costoInventario,
      ctru: ctruVal,
      costoTotal,

      margenBruto,
      margenNeto,
      margenAtBuyBoxPrice,

      precioMinimo10: precioBase != null ? calcMinPrice(precioBase, 10) : null,
      precioMinimo20: precioBase != null ? calcMinPrice(precioBase, 20) : null,
      precioMinimo30: precioBase != null ? calcMinPrice(precioBase, 30) : null,
    };
  });
}

// ============================================================
// KPI AGGREGATES
// ============================================================

export interface PricingKPIs {
  margenPromedio: number | null;
  buyBoxGanando: number;
  buyBoxTotal: number;
  precioMenorCosto: number;
  vinculados: number;
  total: number;
}

export function computeKPIs(rows: PricingIntelRow[]): PricingKPIs {
  let sumMargen = 0;
  let countMargen = 0;
  let buyBoxGanando = 0;
  let buyBoxTotal = 0;
  let precioMenorCosto = 0;
  let vinculados = 0;

  for (const r of rows) {
    if (r.vinculado) vinculados++;
    if (r.margenNeto != null) {
      sumMargen += r.margenNeto;
      countMargen++;
    }
    if (r.costoTotal != null && r.mlPrice < r.costoTotal) {
      precioMenorCosto++;
    }
    if (r.hasCatalogo && r.buyBoxStatus) {
      buyBoxTotal++;
      if (r.buyBoxStatus === 'winning') buyBoxGanando++;
    }
  }

  return {
    margenPromedio: countMargen > 0 ? sumMargen / countMargen : null,
    buyBoxGanando,
    buyBoxTotal,
    precioMenorCosto,
    vinculados,
    total: rows.length,
  };
}

// ============================================================
// FILTRADO Y ORDENAMIENTO
// ============================================================

export function filterRows(
  rows: PricingIntelRow[],
  search: string,
  marginFilter: MarginFilter,
  buyBoxFilter: BuyBoxFilter,
  vinculadoFilter: VinculadoFilter
): PricingIntelRow[] {
  return rows.filter((r) => {
    // Search
    if (search) {
      const s = search.toLowerCase();
      const match =
        r.mlTitle.toLowerCase().includes(s) ||
        r.mlSku?.toLowerCase().includes(s) ||
        r.productoNombre?.toLowerCase().includes(s) ||
        r.productoSku?.toLowerCase().includes(s);
      if (!match) return false;
    }

    // Vinculado
    if (vinculadoFilter === 'vinculados' && !r.vinculado) return false;
    if (vinculadoFilter === 'sin_vincular' && r.vinculado) return false;

    // Margin
    if (marginFilter !== 'todos') {
      if (r.margenNeto == null) return false;
      if (marginFilter === 'negativo' && r.margenNeto >= 0) return false;
      if (marginFilter === 'critico' && (r.margenNeto < 0 || r.margenNeto >= 10)) return false;
      if (marginFilter === 'bajo' && (r.margenNeto < 10 || r.margenNeto >= 20)) return false;
      if (marginFilter === 'saludable' && r.margenNeto < 20) return false;
    }

    // Buy Box
    if (buyBoxFilter !== 'todos') {
      if (r.buyBoxStatus !== buyBoxFilter) return false;
    }

    return true;
  });
}

export function sortRows(rows: PricingIntelRow[], field: SortField, dir: SortDir): PricingIntelRow[] {
  const sorted = [...rows];
  const mul = dir === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (field) {
      case 'nombre':
        return mul * a.mlTitle.localeCompare(b.mlTitle);
      case 'precio':
        return mul * (a.mlPrice - b.mlPrice);
      case 'costo':
        return mul * ((a.costoTotal ?? 999999) - (b.costoTotal ?? 999999));
      case 'margen':
        return mul * ((a.margenNeto ?? -999) - (b.margenNeto ?? -999));
      case 'buybox': {
        const order: Record<string, number> = { winning: 0, sharing_first_place: 1, competing: 2, listed: 3 };
        const va = a.buyBoxStatus ? (order[a.buyBoxStatus] ?? 4) : 5;
        const vb = b.buyBoxStatus ? (order[b.buyBoxStatus] ?? 4) : 5;
        return mul * (va - vb);
      }
      default:
        return 0;
    }
  });

  return sorted;
}

// ============================================================
// COLOR CODING
// ============================================================

export function getMarginColor(margin: number | null): string {
  if (margin == null) return 'text-gray-400';
  if (margin < 0) return 'text-red-700';
  if (margin < 10) return 'text-red-600';
  if (margin < 20) return 'text-yellow-700';
  return 'text-green-700';
}

export function getMarginBg(margin: number | null): string {
  if (margin == null) return '';
  if (margin < 0) return 'bg-red-50';
  if (margin < 10) return 'bg-red-50';
  if (margin < 20) return 'bg-yellow-50';
  return 'bg-green-50';
}

/** Format currency S/ */
export function fmtPEN(value: number | null): string {
  if (value == null) return '—';
  return `S/ ${value.toFixed(2)}`;
}

/** Format percentage */
export function fmtPct(value: number | null): string {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}
