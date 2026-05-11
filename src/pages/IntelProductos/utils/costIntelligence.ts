/**
 * costIntelligence · lógica propia del módulo Cost Intelligence
 *
 * chk5.B8 (S3.6 M1.bis · Cost Intelligence) · NO depende del módulo Productos
 *   - 0 imports de `calcularInvestigacion()` ni `producto.investigacion`
 *   - Toda la información proviene de transacciones reales:
 *       · OCs (estado=completada) → Capital invertido
 *       · Unidades (estado=pedida/transito/aduana) → Capital atrapado
 *       · Unidades.lotes (≥2 por SKU) → Variance attribution
 *       · Pool USD · TCPA → comparativa TC operacional vs mercado
 *
 * Mockup canónico: docs/mockups/cost-intelligence-canon-productos.html · Secs 1, 3, 4
 *
 * Distinción canónica vs. Productos:
 *   - Productos.investigacion → pre-compra · qué SE PUEDE comprar
 *   - Cost Intelligence       → post-compra · qué SE COMPRÓ realmente
 */

import type { Producto } from '../../../types/producto.types';
import type { OrdenCompra } from '../../../types/ordenCompra.types';
import type { Unidad, EstadoUnidad } from '../../../types/unidad.types';
import type { Gasto } from '../../../types/gasto.types';
import type { CategoriaCosto, BloqueCosto } from '../../../types/categoriaCosto.types';
import type { PoolUSDSnapshot } from '../../../types/rendimientoCambiario.types';
import { getBloqueDelGasto } from '../../../utils/gasto.bloque';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS PÚBLICOS
// ─────────────────────────────────────────────────────────────────────────────

/** Etapa pipeline derivada del estado de la unidad · usada en filtros */
export type EtapaPipeline = 'pedido' | 'transito' | 'aduana' | 'almacen';

/** Clasificación de estabilidad de costo · derivada de variance */
export type EstadoCosto = 'estable' | 'volatil' | 'anomalo';

/** Lote individual de un SKU (resultado de OC cerrada) */
export interface LoteCosto {
  loteId: string;                  // unidad.lote
  ordenCompraId: string;
  ordenCompraNumero: string;
  fechaRecepcion: Date;
  costoUnitarioUSD: number;
  costoUnitarioPEN: number;
  tc: number;                      // tcPago o tcCompra del lote
  cantidad: number;                // unidades en este lote
  proveedorId?: string;
  proveedorNombre?: string;
}

/** Proveedor agregado por SKU · derivado de OCs (NO de investigación) */
export interface ProveedorReal {
  proveedorId: string;
  proveedorNombre: string;
  pais?: string;
  ocs: number;                     // cantidad de OCs con este proveedor
  ultimoCostoUSD: number;
  costoPromedioUSD: number;
  ultimaOC: Date;
}

/** SKU enriquecido con sus costos operacionales reales */
export interface SkuConCostos {
  productoId: string;
  sku: string;
  nombreComercial: string;
  marca?: string;
  lineaNegocioNombre?: string;
  esPack?: boolean;
  tipoProductoNombre?: string;
  estado: string;                  // estado del producto (activo/inactivo)

  // Último costo (lote más reciente)
  ultimoCostoPEN: number;
  ultimoCostoUSD: number;
  tcUltimoLote: number;

  // Variance vs lote anterior
  varianceVsLoteAntPct: number | null;       // null si solo hay 1 lote
  estadoCosto: EstadoCosto | null;           // estable/volatil/anomalo o null si <2 lotes

  // Capital atrapado de este SKU (unidades activas no vendidas)
  capitalActivoPEN: number;
  unidadesActivas: number;

  // Etapa pipeline · DOMINANTE (la más representativa de unidades activas)
  etapaPipeline: EtapaPipeline | null;

  // Histórico para sparkline (costos por lote · orden ascendente por fecha)
  trendCostosPEN: number[];

  // Stability score 0-100 (100 = perfectamente estable · 0 = altísima volatilidad)
  stabilityScore: number;

  // Detalle de lotes (para tab Lotes en drill-down)
  lotes: LoteCosto[];

  // Proveedores reales que vendieron este SKU
  proveedores: ProveedorReal[];

  // Última recepción
  ultimaFechaRecepcion: Date | null;
}

/** KPIs ejecutivos · 4 columnas canon Cost Intelligence */
export interface KpiCostIntelligence {
  /** Suma de pagos en PEN de OCs cerradas */
  capitalInvertidoPEN: number;
  capitalInvertidoUds: number;
  capitalInvertidoSkus: number;

  /** Capital en unidades aún no vendidas (pipeline + almacén) */
  capitalAtrapadoPEN: number;
  capitalAtrapadoPct: number;            // 0-100
  capitalAtrapadoUds: number;

  /** Variance promedio 30d · null si no hay lotes consecutivos */
  variancePromedio30dPct: number | null;
  /** Δ vs mes anterior · positivo = variance subió */
  varianceDeltaVsMesAnteriorPct: number | null;

  /** Anomalías últimos 7 días · count de SKUs con |variance|>5% */
  anomaliasCount: number;
  /** Anomalías críticas (|variance|>10%) */
  anomaliasCriticasCount: number;
}

/** Estado de prerequisitos para activar Cost Intelligence */
export interface PrerequisitosCI {
  ocsCerradas: boolean;            // ≥1 OC completada/recibida
  skusConDosLotes: boolean;        // ≥1 SKU con ≥2 lotes (activa variance)
  poolTcpa: boolean;               // Pool USD con TCPA > 0
  unidadesPipeline: boolean;       // ≥1 unidad en transito/aduana
}

/** Resultado completo de la utilidad */
export interface CostIntelligenceResult {
  kpis: KpiCostIntelligence;
  skus: SkuConCostos[];
  hasOperationalData: boolean;
  prerequisitos: PrerequisitosCI;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────────────────────

export interface CostIntelligenceInput {
  productos: Producto[];
  ordenes: OrdenCompra[];
  unidades: Unidad[];
  /** TCPA del Pool USD (opcional · prerequisito para comparativas precisas) */
  tcpa?: number;
  /** TC SBS del día · usado como fallback si no hay tcpa */
  tcSpotFallback?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES INTERNAS
// ─────────────────────────────────────────────────────────────────────────────

const ANOMALIA_THRESHOLD_PCT = 5;         // |variance| > 5% = anomalía
const ANOMALIA_CRITICA_PCT = 10;          // |variance| > 10% = crítica
const VARIANCE_ESTABLE_MAX = 2;           // |variance| ≤ 2% = estable
const VARIANCE_VOLATIL_MAX = 5;           // 2% < |variance| ≤ 5% = volátil · >5% anómalo

const ESTADOS_PIPELINE_PRE_ALMACEN: EstadoUnidad[] = ['pedida', 'en_transito', 'retenida_aduana'];
const ESTADOS_EN_ALMACEN: EstadoUnidad[] = ['disponible', 'reservada', 'asignada_venta'];
const ESTADOS_OC_CERRADA = new Set([
  'completada', 'recibida', 'despachada', 'en_proceso', 'recibida_parcial', 'en_transito', 'enviada',
]);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'object' && typeof ts.toDate === 'function') {
    try { return ts.toDate(); } catch { return null; }
  }
  if (typeof ts === 'number') return new Date(ts);
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function daysAgo(date: Date | null, fromDate = new Date()): number {
  if (!date) return Infinity;
  return Math.floor((fromDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function estadoCostoFromVariance(variancePct: number | null): EstadoCosto | null {
  if (variancePct === null) return null;
  const abs = Math.abs(variancePct);
  if (abs <= VARIANCE_ESTABLE_MAX) return 'estable';
  if (abs <= VARIANCE_VOLATIL_MAX) return 'volatil';
  return 'anomalo';
}

function etapaFromEstadoUnidad(estado: EstadoUnidad): EtapaPipeline | null {
  switch (estado) {
    case 'pedida':              return 'pedido';
    case 'en_transito':         return 'transito';
    case 'retenida_aduana':     return 'aduana';
    case 'disponible':
    case 'reservada':
    case 'asignada_venta':      return 'almacen';
    default:                    return null;
  }
}

function stabilityFromSerie(serie: number[]): number {
  if (serie.length < 2) return 100;
  const mean = serie.reduce((s, v) => s + v, 0) / serie.length;
  if (mean === 0) return 0;
  const variance = serie.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / serie.length;
  const stddev = Math.sqrt(variance);
  // Coef. de variación → penaliza mayor dispersión relativa al promedio
  const cv = (stddev / mean) * 100;
  // Score: 100 cuando CV=0 · 0 cuando CV>=20%
  const score = 100 - Math.min(cv * 5, 100);
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function calcularCostIntelligence(input: CostIntelligenceInput): CostIntelligenceResult {
  const { productos, ordenes, unidades, tcpa, tcSpotFallback } = input;

  // ─── 1. Prerequisitos ────────────────────────────────────────────────────
  const ocsCerradas = ordenes.filter((o) => ESTADOS_OC_CERRADA.has(o.estado));
  const unidadesEnPipeline = unidades.filter((u) =>
    ESTADOS_PIPELINE_PRE_ALMACEN.includes(u.estado as EstadoUnidad)
  );

  // Agrupar unidades por productoId para detectar SKUs con ≥2 lotes
  const unidadesPorSku = new Map<string, Unidad[]>();
  for (const u of unidades) {
    if (!u.productoId) continue;
    const arr = unidadesPorSku.get(u.productoId) ?? [];
    arr.push(u);
    unidadesPorSku.set(u.productoId, arr);
  }

  // Un SKU tiene "≥2 lotes" si tiene unidades de ≥2 OCs distintas
  let skusConDosLotes = false;
  for (const [, arr] of unidadesPorSku) {
    const ocsDistintas = new Set(arr.map((u) => u.ordenCompraId).filter(Boolean));
    if (ocsDistintas.size >= 2) {
      skusConDosLotes = true;
      break;
    }
  }

  const prerequisitos: PrerequisitosCI = {
    ocsCerradas: ocsCerradas.length > 0,
    skusConDosLotes,
    poolTcpa: !!tcpa && tcpa > 0,
    unidadesPipeline: unidadesEnPipeline.length > 0,
  };

  // Determinación canónica de "hay data operacional":
  // mínimo prerequisito 1 (≥1 OC cerrada) OR prerequisito 4 (≥1 unidad pipeline)
  const hasOperationalData = prerequisitos.ocsCerradas || prerequisitos.unidadesPipeline;

  // ─── 2. Early return si NO hay data operacional ──────────────────────────
  if (!hasOperationalData) {
    return {
      kpis: {
        capitalInvertidoPEN: 0,
        capitalInvertidoUds: 0,
        capitalInvertidoSkus: 0,
        capitalAtrapadoPEN: 0,
        capitalAtrapadoPct: 0,
        capitalAtrapadoUds: 0,
        variancePromedio30dPct: null,
        varianceDeltaVsMesAnteriorPct: null,
        anomaliasCount: 0,
        anomaliasCriticasCount: 0,
      },
      skus: [],
      hasOperationalData: false,
      prerequisitos,
    };
  }

  // ─── 3. Map de productos para join rápido ────────────────────────────────
  const productoIndex = new Map<string, Producto>();
  for (const p of productos) productoIndex.set(p.id, p);

  // ─── 4. Construir lotes por SKU desde unidades ───────────────────────────
  /**
   * Cada (productoId, ordenCompraId, lote) → un LoteCosto.
   * Sumamos cantidades + tomamos el costo unitario representativo (todas las
   * unidades del mismo lote tienen el mismo costoUnitario).
   */
  type LoteKey = string; // `${productoId}|${ocId}|${lote}`
  const lotesIndex = new Map<LoteKey, LoteCosto & { productoId: string }>();

  for (const u of unidades) {
    if (!u.productoId || !u.ordenCompraId) continue;
    const fecha = tsToDate(u.fechaRecepcion) ?? tsToDate(u.fechaCreacion);
    if (!fecha) continue;

    const loteId = u.lote || u.ordenCompraNumero || u.ordenCompraId;
    const key: LoteKey = `${u.productoId}|${u.ordenCompraId}|${loteId}`;
    const tc = u.tcPago || u.tcCompra || tcpa || tcSpotFallback || 3.75;
    const costoUSD = u.costoUnitarioUSD || 0;
    const costoPEN = u.costoUnitarioPEN || (costoUSD * tc);

    const existing = lotesIndex.get(key);
    if (existing) {
      existing.cantidad += 1;
    } else {
      lotesIndex.set(key, {
        productoId: u.productoId,
        loteId,
        ordenCompraId: u.ordenCompraId,
        ordenCompraNumero: u.ordenCompraNumero || '',
        fechaRecepcion: fecha,
        costoUnitarioUSD: costoUSD,
        costoUnitarioPEN: costoPEN,
        tc,
        cantidad: 1,
        proveedorId: u.proveedorId,
        proveedorNombre: u.proveedorNombre,
      });
    }
  }

  // Agrupar lotes por SKU
  const lotesPorSku = new Map<string, LoteCosto[]>();
  for (const lote of lotesIndex.values()) {
    const arr = lotesPorSku.get(lote.productoId) ?? [];
    arr.push(lote);
    lotesPorSku.set(lote.productoId, arr);
  }

  // Ordenar cada serie por fecha ascendente
  for (const arr of lotesPorSku.values()) {
    arr.sort((a, b) => a.fechaRecepcion.getTime() - b.fechaRecepcion.getTime());
  }

  // ─── 5. Construir SkuConCostos por cada SKU con unidades ─────────────────
  const skus: SkuConCostos[] = [];

  for (const [productoId, lotes] of lotesPorSku) {
    const producto = productoIndex.get(productoId);
    if (!producto) continue;

    const unidadesSku = unidadesPorSku.get(productoId) ?? [];

    // Lote más reciente
    const ultimoLote = lotes[lotes.length - 1];
    const loteAnterior = lotes.length >= 2 ? lotes[lotes.length - 2] : null;

    // Variance vs lote anterior
    let varianceVsLoteAntPct: number | null = null;
    if (loteAnterior && loteAnterior.costoUnitarioPEN > 0) {
      varianceVsLoteAntPct =
        ((ultimoLote.costoUnitarioPEN - loteAnterior.costoUnitarioPEN) / loteAnterior.costoUnitarioPEN) * 100;
    }

    // Trend serie (costos PEN por lote · orden cronológico)
    const trendCostosPEN = lotes.map((l) => l.costoUnitarioPEN);
    const stabilityScore = stabilityFromSerie(trendCostosPEN);

    // Capital activo + etapa dominante
    let capitalActivoPEN = 0;
    let unidadesActivas = 0;
    const etapaCount: Record<EtapaPipeline, number> = { pedido: 0, transito: 0, aduana: 0, almacen: 0 };

    for (const u of unidadesSku) {
      const estado = u.estado as EstadoUnidad;
      if (estado === 'vendida' || estado === 'danada' || estado === 'perdida') continue;
      const etapa = etapaFromEstadoUnidad(estado);
      if (!etapa) continue;
      unidadesActivas++;
      const tc = u.tcPago || u.tcCompra || tcpa || tcSpotFallback || 3.75;
      const costoPEN = u.costoUnitarioPEN || (u.costoUnitarioUSD * tc);
      capitalActivoPEN += costoPEN;
      etapaCount[etapa]++;
    }

    // Etapa dominante (más unidades)
    let etapaPipeline: EtapaPipeline | null = null;
    let maxCount = 0;
    (Object.keys(etapaCount) as EtapaPipeline[]).forEach((k) => {
      if (etapaCount[k] > maxCount) {
        maxCount = etapaCount[k];
        etapaPipeline = k;
      }
    });

    // Proveedores reales agregados desde OCs
    const provMap = new Map<string, { id: string; nombre: string; pais?: string; ocs: Set<string>; costos: number[]; ultima: Date }>();
    for (const lote of lotes) {
      if (!lote.proveedorId) continue;
      const prev = provMap.get(lote.proveedorId);
      if (prev) {
        prev.ocs.add(lote.ordenCompraId);
        prev.costos.push(lote.costoUnitarioUSD);
        if (lote.fechaRecepcion.getTime() > prev.ultima.getTime()) {
          prev.ultima = lote.fechaRecepcion;
        }
      } else {
        provMap.set(lote.proveedorId, {
          id: lote.proveedorId,
          nombre: lote.proveedorNombre || '—',
          ocs: new Set([lote.ordenCompraId]),
          costos: [lote.costoUnitarioUSD],
          ultima: lote.fechaRecepcion,
        });
      }
    }

    const proveedores: ProveedorReal[] = Array.from(provMap.values()).map((p) => ({
      proveedorId: p.id,
      proveedorNombre: p.nombre,
      pais: p.pais,
      ocs: p.ocs.size,
      ultimoCostoUSD: p.costos[p.costos.length - 1] ?? 0,
      costoPromedioUSD: p.costos.reduce((s, c) => s + c, 0) / p.costos.length,
      ultimaOC: p.ultima,
    }));

    skus.push({
      productoId,
      sku: producto.sku ?? '',
      nombreComercial: producto.nombreComercial ?? '',
      marca: producto.marca,
      lineaNegocioNombre: producto.lineaNegocioNombre,
      esPack: producto.esPack,
      tipoProductoNombre: producto.tipoProducto?.nombre,
      estado: producto.estado as string,
      ultimoCostoPEN: ultimoLote.costoUnitarioPEN,
      ultimoCostoUSD: ultimoLote.costoUnitarioUSD,
      tcUltimoLote: ultimoLote.tc,
      varianceVsLoteAntPct,
      estadoCosto: estadoCostoFromVariance(varianceVsLoteAntPct),
      capitalActivoPEN,
      unidadesActivas,
      etapaPipeline,
      trendCostosPEN,
      stabilityScore,
      lotes,
      proveedores,
      ultimaFechaRecepcion: ultimoLote.fechaRecepcion,
    });
  }

  // ─── 6. KPIs agregados ───────────────────────────────────────────────────

  // Capital invertido: Σ totalPEN de OCs cerradas (proxy: si totalPEN no está, total USD × tc representativo)
  let capitalInvertidoPEN = 0;
  let capitalInvertidoUds = 0;
  for (const oc of ocsCerradas) {
    const tc = oc.tcPago || oc.tcCompra || oc.tcReferencial || tcpa || tcSpotFallback || 3.75;
    const pen = oc.totalPEN ?? (oc.totalUSD * tc);
    capitalInvertidoPEN += pen;
    capitalInvertidoUds += oc.productos?.reduce((s, p) => s + (p.cantidad || 0), 0) ?? 0;
  }
  const capitalInvertidoSkus = skus.length;

  // Capital atrapado: SOLO unidades pre-almacén (pedida/transito/aduana)
  let capitalAtrapadoPEN = 0;
  let capitalAtrapadoUds = 0;
  let capitalEnAlmacenPEN = 0;
  for (const u of unidades) {
    const estado = u.estado as EstadoUnidad;
    const tc = u.tcPago || u.tcCompra || tcpa || tcSpotFallback || 3.75;
    const costoPEN = u.costoUnitarioPEN || (u.costoUnitarioUSD * tc);
    if (ESTADOS_PIPELINE_PRE_ALMACEN.includes(estado)) {
      capitalAtrapadoPEN += costoPEN;
      capitalAtrapadoUds++;
    } else if (ESTADOS_EN_ALMACEN.includes(estado)) {
      capitalEnAlmacenPEN += costoPEN;
    }
  }
  const totalCapitalActivoPEN = capitalAtrapadoPEN + capitalEnAlmacenPEN;
  const capitalAtrapadoPct = totalCapitalActivoPEN > 0
    ? (capitalAtrapadoPEN / totalCapitalActivoPEN) * 100
    : 0;

  // Variance promedio 30d
  const variancesUltimos30d: number[] = [];
  const variancesPrev30d: number[] = [];     // 30-60d para comparar
  const now = new Date();
  let anomaliasCount = 0;
  let anomaliasCriticasCount = 0;

  for (const sku of skus) {
    if (sku.varianceVsLoteAntPct === null) continue;
    const dias = daysAgo(sku.ultimaFechaRecepcion, now);
    if (dias <= 30) {
      variancesUltimos30d.push(sku.varianceVsLoteAntPct);
      if (dias <= 7) {
        const absVar = Math.abs(sku.varianceVsLoteAntPct);
        if (absVar > ANOMALIA_THRESHOLD_PCT) anomaliasCount++;
        if (absVar > ANOMALIA_CRITICA_PCT) anomaliasCriticasCount++;
      }
    } else if (dias <= 60) {
      variancesPrev30d.push(sku.varianceVsLoteAntPct);
    }
  }

  const variancePromedio30dPct = variancesUltimos30d.length > 0
    ? variancesUltimos30d.reduce((s, v) => s + v, 0) / variancesUltimos30d.length
    : null;
  const variancePrev30dPct = variancesPrev30d.length > 0
    ? variancesPrev30d.reduce((s, v) => s + v, 0) / variancesPrev30d.length
    : null;
  const varianceDeltaVsMesAnteriorPct = (variancePromedio30dPct !== null && variancePrev30dPct !== null)
    ? variancePromedio30dPct - variancePrev30dPct
    : null;

  return {
    kpis: {
      capitalInvertidoPEN,
      capitalInvertidoUds,
      capitalInvertidoSkus,
      capitalAtrapadoPEN,
      capitalAtrapadoPct,
      capitalAtrapadoUds,
      variancePromedio30dPct,
      varianceDeltaVsMesAnteriorPct,
      anomaliasCount,
      anomaliasCriticasCount,
    },
    skus,
    hasOperationalData: true,
    prerequisitos,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS PÚBLICOS · usados por componentes UI
// ─────────────────────────────────────────────────────────────────────────────

/** Convierte etapa pipeline a label legible (UI) */
export const ETAPA_LABELS: Record<EtapaPipeline, string> = {
  pedido: 'Pedido',
  transito: 'Tránsito',
  aduana: 'Aduana',
  almacen: 'Almacén',
};

/** Convierte estado de costo a clases tailwind (chip) */
export const ESTADO_COSTO_CLASSES: Record<EstadoCosto, { bg: string; text: string; border: string }> = {
  estable: { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  volatil: { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200'   },
  anomalo: { bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200'    },
};

export const ESTADO_COSTO_LABELS: Record<EstadoCosto, string> = {
  estable: 'Estable',
  volatil: 'Volátil',
  anomalo: 'Anómalo',
};

/**
 * Variance attribution waterfall (drill-down · tab Variance).
 *
 * MVP: cuando hay sólo dos lotes para un SKU, atribuímos toda la variance al
 * driver "precio proveedor" porque no tenemos data desglosada de flete/landed/TC
 * en costo unitario (vive en costosLanded del envío, fuera de este MVP).
 *
 * En iteración B9 se integran costosLanded del envío y se obtiene desglose real.
 */
export interface VarianceAttribution {
  precioProveedorPp: number;     // puntos porcentuales
  fleteIntlPp: number;
  tcPp: number;
  costosLandedPp: number;
  totalPp: number;
}

export function calcularVarianceAttribution(sku: SkuConCostos): VarianceAttribution | null {
  if (sku.varianceVsLoteAntPct === null || sku.lotes.length < 2) return null;

  const ultimo = sku.lotes[sku.lotes.length - 1];
  const anterior = sku.lotes[sku.lotes.length - 2];

  // % variance USD (precio proveedor en USD)
  const varianceUSDPct = anterior.costoUnitarioUSD > 0
    ? ((ultimo.costoUnitarioUSD - anterior.costoUnitarioUSD) / anterior.costoUnitarioUSD) * 100
    : 0;

  // % variance TC
  const varianceTCPct = anterior.tc > 0
    ? ((ultimo.tc - anterior.tc) / anterior.tc) * 100
    : 0;

  const totalPp = sku.varianceVsLoteAntPct;

  // Atribuimos USD a "precio proveedor" y TC a "TC"
  // El resto (flete + landed) lo dejamos en 0 hasta integrar costosLanded del envío
  const precioProveedorPp = (varianceUSDPct / 100) * Math.abs(totalPp) * Math.sign(varianceUSDPct);
  const tcPp = (varianceTCPct / 100) * Math.abs(totalPp) * Math.sign(varianceTCPct);

  return {
    precioProveedorPp: Number(precioProveedorPp.toFixed(2)),
    fleteIntlPp: 0,
    tcPp: Number(tcPp.toFixed(2)),
    costosLandedPp: 0,
    totalPp: Number(totalPp.toFixed(2)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// chk5.B9 · WORKSPACE COSTOS · evolución temporal + TCPA vs SBS + lotes foco
// ─────────────────────────────────────────────────────────────────────────────

/** Punto de la serie de evolución mensual por bloque · 1 punto = 1 mes */
export interface PuntoEvolucionBloques {
  anio: number;
  mes: number;                     // 1-12
  label: string;                   // 'May' · 'Abr ▲' si anomalía
  producto: number;                // Σ montoPEN bloque 'producto' del mes
  venta: number;                   // Σ montoPEN bloque 'venta' del mes
  periodo: number;                 // Σ montoPEN bloque 'periodo' del mes
  total: number;                   // producto + venta + periodo
  esActual: boolean;               // mes en curso (resalta visualmente)
  esAnomalia: boolean;             // total >= 120% del promedio de meses previos
}

/** Resultado de la función de evolución · serie + agregados */
export interface EvolucionPorBloque {
  serie: PuntoEvolucionBloques[];
  totalSerie: number;
  /** Total del mes actual */
  totalMesActual: number;
  /** Delta % del mes actual vs promedio de los meses previos */
  deltaPctVsPromedio: number | null;
  /** Máximo total mensual · usado para escala Y del chart */
  maxTotalMensual: number;
  /** true si hay al menos 1 punto con datos · false si todos los meses en 0 */
  hasData: boolean;
}

/**
 * Construye la serie de evolución de gastos por bloque (producto/venta/periodo)
 * en los últimos N meses. Si un mes no tiene gastos, va en 0.
 *
 * @param gastos lista completa de gastos del sistema
 * @param arbolCategorias árbol de categoriasCosto (para resolver el bloque vía categoriaCostoId)
 * @param monthsBack cantidad de meses históricos incluyendo el mes actual (default 6)
 * @param anchorDate fecha de referencia (default: hoy) · útil para tests deterministicos
 */
export function calcularEvolucionPorBloque(
  gastos: Gasto[],
  arbolCategorias: CategoriaCosto[],
  monthsBack = 6,
  anchorDate: Date = new Date(),
): EvolucionPorBloque {
  // Generar los últimos N meses (cronológicamente ascendente)
  const mesesObjetivo: Array<{ anio: number; mes: number }> = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i, 1);
    mesesObjetivo.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }

  const mesActual = { anio: anchorDate.getFullYear(), mes: anchorDate.getMonth() + 1 };

  // Acumular gastos por (anio, mes, bloque)
  type Bucket = Record<BloqueCosto, number>;
  const acumulado = new Map<string, Bucket>();
  const keyFn = (anio: number, mes: number) => `${anio}-${mes}`;

  for (const m of mesesObjetivo) {
    acumulado.set(keyFn(m.anio, m.mes), { producto: 0, venta: 0, periodo: 0 });
  }

  for (const g of gastos) {
    if (typeof g.mes !== 'number' || typeof g.anio !== 'number') continue;
    const k = keyFn(g.anio, g.mes);
    const bucket = acumulado.get(k);
    if (!bucket) continue;                    // gasto fuera del rango de N meses
    const bloque = getBloqueDelGasto(g, arbolCategorias);
    if (!bloque) continue;                    // gasto sin categoría canon · ignorar
    bucket[bloque] += g.montoPEN || 0;
  }

  // Construir serie ordenada con flag de anomalía
  // Anomalía: total mensual >= 120% del promedio de los meses previos no-vacíos
  let runningSumPrev = 0;
  let runningCountPrev = 0;

  const serie: PuntoEvolucionBloques[] = mesesObjetivo.map((m, idx) => {
    const bucket = acumulado.get(keyFn(m.anio, m.mes))!;
    const total = bucket.producto + bucket.venta + bucket.periodo;

    // Para detectar anomalía necesitamos promedio de meses PREVIOS al actual
    let esAnomalia = false;
    if (idx > 0 && runningCountPrev > 0) {
      const promedioPrev = runningSumPrev / runningCountPrev;
      if (promedioPrev > 0 && total >= promedioPrev * 1.2) {
        esAnomalia = true;
      }
    }
    // Después de evaluar el mes actual, lo acumulamos para los próximos
    if (total > 0) {
      runningSumPrev += total;
      runningCountPrev += 1;
    }

    const esActual = m.anio === mesActual.anio && m.mes === mesActual.mes;
    const labelBase = nombreMesCorto(m.mes);
    const label = esAnomalia ? `${labelBase} ▲` : esActual ? `${labelBase} (act)` : labelBase;

    return {
      anio: m.anio,
      mes: m.mes,
      label,
      producto: bucket.producto,
      venta: bucket.venta,
      periodo: bucket.periodo,
      total,
      esActual,
      esAnomalia,
    };
  });

  const totalSerie = serie.reduce((s, p) => s + p.total, 0);
  const totalMesActual = serie[serie.length - 1]?.total ?? 0;
  const totalesPrevios = serie.slice(0, -1).map((p) => p.total).filter((t) => t > 0);
  const promedioPrevios = totalesPrevios.length > 0
    ? totalesPrevios.reduce((s, t) => s + t, 0) / totalesPrevios.length
    : 0;
  const deltaPctVsPromedio = promedioPrevios > 0
    ? ((totalMesActual - promedioPrevios) / promedioPrevios) * 100
    : null;
  const maxTotalMensual = Math.max(0, ...serie.map((p) => p.total));
  const hasData = totalSerie > 0;

  return {
    serie,
    totalSerie,
    totalMesActual,
    deltaPctVsPromedio,
    maxTotalMensual,
    hasData,
  };
}

/** Punto de la serie comparativa TCPA vs SBS · 1 punto = 1 mes con snapshot */
export interface PuntoTCPAvsSBS {
  anio: number;
  mes: number;
  label: string;
  tcpa: number;                    // del snapshot Pool USD
  sbs: number;                     // del snapshot · tcCierreSunat
  diffPct: number;                 // (sbs - tcpa) / sbs × 100 · positivo = TCPA menor (ahorro)
  esActual: boolean;
}

/** Resultado comparativa TCPA vs SBS + indicadores ahorro/sobrecosto */
export interface TCPAvsSBS {
  serie: PuntoTCPAvsSBS[];
  /** TCPA del mes más reciente con snapshot */
  tcpaActual: number | null;
  /** TC SBS del mes más reciente con snapshot */
  sbsActual: number | null;
  /** Δ absoluto del mes actual · positivo = ahorro (TCPA < SBS) */
  diffAbsoluteActual: number | null;
  /** Δ % del mes actual · positivo = ahorro */
  diffPctActual: number | null;
  /** Min/max de la serie para escala Y */
  minSerie: number;
  maxSerie: number;
  hasData: boolean;
}

/**
 * Construye serie comparativa TCPA vs TC SBS para los últimos N meses con snapshot.
 *
 * Toma los snapshots tal cual los entrega el Pool USD (ya tienen tcpa + tcCierreSunat
 * sincronizados al cierre del mes · no requiere cargar TC histórico por separado).
 *
 * @param poolSnapshots snapshots del Pool USD (ordenados o no · la función ordena)
 * @param monthsBack cantidad de meses a incluir (default 6)
 * @param anchorDate fecha de referencia (default: hoy)
 */
export function calcularTCPAvsSBS(
  poolSnapshots: PoolUSDSnapshot[],
  monthsBack = 6,
  anchorDate: Date = new Date(),
): TCPAvsSBS {
  // Filtrar snapshots dentro del rango de monthsBack meses
  const cutoff = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - monthsBack + 1, 1);
  const cutoffKey = cutoff.getFullYear() * 100 + (cutoff.getMonth() + 1);
  const mesActualKey = anchorDate.getFullYear() * 100 + (anchorDate.getMonth() + 1);

  const filtrados = poolSnapshots
    .filter((s) => {
      const k = s.anio * 100 + s.mes;
      return k >= cutoffKey && k <= mesActualKey;
    })
    .sort((a, b) => (a.anio * 100 + a.mes) - (b.anio * 100 + b.mes));

  const serie: PuntoTCPAvsSBS[] = filtrados.map((s) => {
    const diffPct = s.tcCierreSunat > 0
      ? ((s.tcCierreSunat - s.tcpa) / s.tcCierreSunat) * 100
      : 0;
    const esActual = s.anio === anchorDate.getFullYear() && s.mes === (anchorDate.getMonth() + 1);
    return {
      anio: s.anio,
      mes: s.mes,
      label: nombreMesCorto(s.mes),
      tcpa: s.tcpa,
      sbs: s.tcCierreSunat,
      diffPct,
      esActual,
    };
  });

  const ultimo = serie[serie.length - 1] ?? null;
  const valores = serie.flatMap((p) => [p.tcpa, p.sbs]).filter((v) => v > 0);
  const minSerie = valores.length > 0 ? Math.min(...valores) : 0;
  const maxSerie = valores.length > 0 ? Math.max(...valores) : 0;

  return {
    serie,
    tcpaActual: ultimo?.tcpa ?? null,
    sbsActual: ultimo?.sbs ?? null,
    diffAbsoluteActual: ultimo ? ultimo.sbs - ultimo.tcpa : null,
    diffPctActual: ultimo?.diffPct ?? null,
    minSerie,
    maxSerie,
    hasData: serie.length > 0,
  };
}

/**
 * Selecciona el SKU con mayor variance absoluto como "foco" del panel de
 * comparativa de lotes cuando no hay selección explícita del usuario.
 *
 * Prioridad:
 *   1. SKU anómalo con variance más alto en absoluto
 *   2. Si no hay anómalos → cualquier SKU con ≥2 lotes ordenado por |variance|
 *   3. null si ningún SKU tiene ≥2 lotes
 */
export function seleccionarSkuFocoCostos(skus: SkuConCostos[]): SkuConCostos | null {
  const conLotesMultiples = skus.filter((s) => s.lotes.length >= 2 && s.varianceVsLoteAntPct !== null);
  if (conLotesMultiples.length === 0) return null;

  // Prioridad: anómalos primero
  const anomalos = conLotesMultiples.filter((s) => s.estadoCosto === 'anomalo');
  const pool = anomalos.length > 0 ? anomalos : conLotesMultiples;

  return [...pool].sort(
    (a, b) => Math.abs(b.varianceVsLoteAntPct ?? 0) - Math.abs(a.varianceVsLoteAntPct ?? 0)
  )[0] ?? null;
}

/**
 * Calcula el promedio ponderado FIFO de costos para un SKU (todos sus lotes).
 * Usado en la fila resumen de la tabla "Comparativa de lotes".
 */
export interface PromedioFIFO {
  totalUds: number;
  costoPromedioUSD: number;       // Σ(costoUSD × cantidad) / Σ cantidad
  costoPromedioPEN: number;       // Σ(costoPEN × cantidad) / Σ cantidad
  tcpaPromedio: number;            // Σ(tc × cantidad) / Σ cantidad
  varianceTotalPct: number | null; // % entre lote más viejo y más reciente
  tendencia: 'alcista' | 'estable' | 'bajista' | null;
}

export function calcularPromedioFIFO(sku: SkuConCostos): PromedioFIFO {
  const lotes = sku.lotes;
  if (lotes.length === 0) {
    return {
      totalUds: 0,
      costoPromedioUSD: 0,
      costoPromedioPEN: 0,
      tcpaPromedio: 0,
      varianceTotalPct: null,
      tendencia: null,
    };
  }

  const totalUds = lotes.reduce((s, l) => s + l.cantidad, 0);
  if (totalUds === 0) {
    return {
      totalUds: 0,
      costoPromedioUSD: 0,
      costoPromedioPEN: 0,
      tcpaPromedio: 0,
      varianceTotalPct: null,
      tendencia: null,
    };
  }

  const sumaUSD = lotes.reduce((s, l) => s + l.costoUnitarioUSD * l.cantidad, 0);
  const sumaPEN = lotes.reduce((s, l) => s + l.costoUnitarioPEN * l.cantidad, 0);
  const sumaTC = lotes.reduce((s, l) => s + l.tc * l.cantidad, 0);

  const primero = lotes[0];
  const ultimo = lotes[lotes.length - 1];
  const varianceTotalPct = primero.costoUnitarioPEN > 0
    ? ((ultimo.costoUnitarioPEN - primero.costoUnitarioPEN) / primero.costoUnitarioPEN) * 100
    : null;

  let tendencia: PromedioFIFO['tendencia'] = null;
  if (varianceTotalPct !== null) {
    if (varianceTotalPct >= 2) tendencia = 'alcista';
    else if (varianceTotalPct <= -2) tendencia = 'bajista';
    else tendencia = 'estable';
  }

  return {
    totalUds,
    costoPromedioUSD: sumaUSD / totalUds,
    costoPromedioPEN: sumaPEN / totalUds,
    tcpaPromedio: sumaTC / totalUds,
    varianceTotalPct,
    tendencia,
  };
}

/** Helper · nombre corto mes 1-12 → 'Ene', 'Feb', etc. */
function nombreMesCorto(mes: number): string {
  const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return nombres[mes - 1] ?? '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// chk5.B10a · WORKSPACE PIPELINE · capital atrapado por etapa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thresholds canónicos de antigüedad por etapa · una unidad en su etapa más
 * tiempo que esto se considera "estancada" y aparece en el banner de alertas.
 * Valores iniciales · ajustables vía settings en el futuro.
 */
export const PIPELINE_THRESHOLDS_DIAS: Record<EtapaPipeline, number> = {
  pedido: 14,
  transito: 45,
  aduana: 7,
  almacen: 180,
};

/** Etapa pipeline valorizada · 1 etapa = 1 stage card */
export interface EtapaPipelineValorizada {
  etapa: EtapaPipeline;
  label: string;                    // 'Pedido' · 'Tránsito' · 'Aduana' · 'Almacén'
  uds: number;                      // count de unidades en esta etapa
  skus: number;                     // count de productoIds distintos
  capitalPEN: number;               // Σ costoUnitarioPEN · de unidades en esta etapa
  /** Porcentaje del capital atrapado · 0-100 · sólo para pre-almacén */
  pctAtrapado: number;
  antiguedadPromedioDias: number;
  thresholdDias: number;
  /** true si antigüedadPromedio > threshold · banner alertas */
  superaThreshold: boolean;
  /** Count de unidades individuales con dias > threshold */
  cantidadEstancadas: number;
}

/** Unidad estancada · referenciada en el banner + drill-down */
export interface UnidadEstancada {
  unidadId: string;
  productoId: string;
  productoSKU: string;
  productoNombre: string;
  etapa: EtapaPipeline;
  diasEnEtapa: number;
  capitalPEN: number;
  lote: string;
  ordenCompraNumero: string;
  /** Date de referencia desde la que se cuenta antigüedad */
  fechaReferencia: Date;
}

/** Detalle de drill-down · 1 fila = 1 unidad en la etapa seleccionada */
export interface UnidadEnEtapa {
  unidadId: string;
  productoId: string;
  productoSKU: string;
  productoNombre: string;
  marca?: string;
  lineaNegocioNombre?: string;
  lote: string;
  ordenCompraNumero: string;
  fechaReferencia: Date;
  diasEnEtapa: number;
  capitalPEN: number;
  superaThreshold: boolean;
}

export interface PipelineValorizado {
  etapas: EtapaPipelineValorizada[];
  /** Total atrapado pre-almacén = pedido + transito + aduana */
  totalAtrapadoPEN: number;
  totalAtrapadoUds: number;
  /** Capital en almacén (disponible) */
  capitalAlmacenPEN: number;
  unidadesAlmacen: number;
  /** Etapa con mayor capital pre-almacén · default selection · null si todas en cero */
  etapaConMayorCapital: EtapaPipeline | null;
  /** Lista de unidades estancadas en CUALQUIER etapa */
  unidadesEstancadas: UnidadEstancada[];
  /** true si hay al menos 1 unidad en pipeline */
  hasData: boolean;
}

/**
 * Construye la vista valorizada del pipeline a partir de todas las unidades.
 *
 * Para cada etapa (Pedido, Tránsito, Aduana, Almacén):
 *   - cuenta unidades + SKUs distintos
 *   - suma capital en PEN
 *   - calcula antigüedad promedio (días desde fechaActualizacion || fechaCreacion)
 *   - identifica unidades estancadas (> threshold)
 *
 * @param unidades lista completa de unidades del sistema
 * @param tcpa TCPA del pool USD · fallback para convertir USD→PEN si la unidad no tiene costoPEN
 * @param tcSpotFallback TC SUNAT del día · fallback de último recurso
 * @param anchorDate fecha de referencia (default hoy) · útil para tests
 */
export function calcularPipelineValorizado(
  unidades: Unidad[],
  tcpa?: number,
  tcSpotFallback?: number,
  anchorDate: Date = new Date(),
): PipelineValorizado {
  // Buckets por etapa
  type Bucket = {
    uds: Unidad[];
    capital: number;
    productosIds: Set<string>;
    sumDias: number;
    estancadas: number;
  };
  const buckets: Record<EtapaPipeline, Bucket> = {
    pedido:   { uds: [], capital: 0, productosIds: new Set(), sumDias: 0, estancadas: 0 },
    transito: { uds: [], capital: 0, productosIds: new Set(), sumDias: 0, estancadas: 0 },
    aduana:   { uds: [], capital: 0, productosIds: new Set(), sumDias: 0, estancadas: 0 },
    almacen:  { uds: [], capital: 0, productosIds: new Set(), sumDias: 0, estancadas: 0 },
  };

  const unidadesEstancadas: UnidadEstancada[] = [];

  for (const u of unidades) {
    const etapa = etapaFromEstadoUnidad(u.estado as EstadoUnidad);
    if (!etapa) continue; // estados vendida/dañada/perdida no entran al pipeline

    const tc = u.tcPago || u.tcCompra || tcpa || tcSpotFallback || 3.75;
    const costoPEN = u.costoUnitarioPEN || (u.costoUnitarioUSD * tc);

    // Fecha de referencia: priorizar fechaActualizacion (último cambio) sobre fechaCreacion
    // Para almacén, fechaRecepcion es mejor proxy de "cuándo entré al almacén"
    const fechaRefRaw = etapa === 'almacen'
      ? (u.fechaRecepcion || u.fechaActualizacion || u.fechaCreacion)
      : (u.fechaActualizacion || u.fechaCreacion);
    const fechaRef = tsToDate(fechaRefRaw) ?? anchorDate;
    const dias = Math.max(0, Math.floor(
      (anchorDate.getTime() - fechaRef.getTime()) / (1000 * 60 * 60 * 24)
    ));

    const bucket = buckets[etapa];
    bucket.uds.push(u);
    bucket.capital += costoPEN;
    if (u.productoId) bucket.productosIds.add(u.productoId);
    bucket.sumDias += dias;

    const threshold = PIPELINE_THRESHOLDS_DIAS[etapa];
    if (dias > threshold) {
      bucket.estancadas++;
      unidadesEstancadas.push({
        unidadId: u.id,
        productoId: u.productoId,
        productoSKU: u.productoSKU || '',
        productoNombre: u.productoNombre || '',
        etapa,
        diasEnEtapa: dias,
        capitalPEN: costoPEN,
        lote: u.lote || '',
        ordenCompraNumero: u.ordenCompraNumero || '',
        fechaReferencia: fechaRef,
      });
    }
  }

  // Total atrapado = pedido + transito + aduana (NO incluye almacén)
  const totalAtrapadoPEN = buckets.pedido.capital + buckets.transito.capital + buckets.aduana.capital;
  const totalAtrapadoUds = buckets.pedido.uds.length + buckets.transito.uds.length + buckets.aduana.uds.length;

  const labels: Record<EtapaPipeline, string> = ETAPA_LABELS;

  const etapas: EtapaPipelineValorizada[] = (['pedido', 'transito', 'aduana', 'almacen'] as EtapaPipeline[]).map((e) => {
    const b = buckets[e];
    const ud = b.uds.length;
    const antiguedad = ud > 0 ? b.sumDias / ud : 0;
    const isPreAlmacen = e !== 'almacen';
    const pctAtrapado = isPreAlmacen && totalAtrapadoPEN > 0
      ? (b.capital / totalAtrapadoPEN) * 100
      : 0;
    const threshold = PIPELINE_THRESHOLDS_DIAS[e];

    return {
      etapa: e,
      label: labels[e],
      uds: ud,
      skus: b.productosIds.size,
      capitalPEN: b.capital,
      pctAtrapado,
      antiguedadPromedioDias: Math.round(antiguedad),
      thresholdDias: threshold,
      superaThreshold: antiguedad > threshold,
      cantidadEstancadas: b.estancadas,
    };
  });

  // Etapa con mayor capital pre-almacén · null si todas en cero
  let etapaConMayorCapital: EtapaPipeline | null = null;
  let maxCapital = 0;
  for (const e of etapas) {
    if (e.etapa === 'almacen') continue;
    if (e.capitalPEN > maxCapital) {
      maxCapital = e.capitalPEN;
      etapaConMayorCapital = e.etapa;
    }
  }
  // Fallback: si todo pre-almacén está en cero pero hay almacén con data → almacén
  if (etapaConMayorCapital === null && buckets.almacen.capital > 0) {
    etapaConMayorCapital = 'almacen';
  }

  // Ordenar estancadas: más días primero, luego mayor capital
  unidadesEstancadas.sort((a, b) => {
    if (b.diasEnEtapa !== a.diasEnEtapa) return b.diasEnEtapa - a.diasEnEtapa;
    return b.capitalPEN - a.capitalPEN;
  });

  return {
    etapas,
    totalAtrapadoPEN,
    totalAtrapadoUds,
    capitalAlmacenPEN: buckets.almacen.capital,
    unidadesAlmacen: buckets.almacen.uds.length,
    etapaConMayorCapital,
    unidadesEstancadas,
    hasData: totalAtrapadoUds + buckets.almacen.uds.length > 0,
  };
}

/**
 * Detalle de unidades en una etapa específica · usado por el drill-down.
 *
 * @param unidades lista completa de unidades
 * @param etapa etapa filtro
 * @param productoIndex índice productoId → Producto (para enriquecer marca/línea)
 * @param tcpa fallback de conversión
 * @param anchorDate referencia temporal
 */
export function calcularUnidadesEnEtapa(
  unidades: Unidad[],
  etapa: EtapaPipeline,
  productoIndex: Map<string, Producto>,
  tcpa?: number,
  tcSpotFallback?: number,
  anchorDate: Date = new Date(),
): UnidadEnEtapa[] {
  const threshold = PIPELINE_THRESHOLDS_DIAS[etapa];

  const filtered = unidades.filter((u) =>
    etapaFromEstadoUnidad(u.estado as EstadoUnidad) === etapa
  );

  const detalle: UnidadEnEtapa[] = filtered.map((u) => {
    const tc = u.tcPago || u.tcCompra || tcpa || tcSpotFallback || 3.75;
    const costoPEN = u.costoUnitarioPEN || (u.costoUnitarioUSD * tc);

    const fechaRefRaw = etapa === 'almacen'
      ? (u.fechaRecepcion || u.fechaActualizacion || u.fechaCreacion)
      : (u.fechaActualizacion || u.fechaCreacion);
    const fechaRef = tsToDate(fechaRefRaw) ?? anchorDate;
    const dias = Math.max(0, Math.floor(
      (anchorDate.getTime() - fechaRef.getTime()) / (1000 * 60 * 60 * 24)
    ));

    const producto = productoIndex.get(u.productoId);

    return {
      unidadId: u.id,
      productoId: u.productoId,
      productoSKU: u.productoSKU || producto?.sku || '',
      productoNombre: u.productoNombre || producto?.nombreComercial || '',
      marca: producto?.marca,
      lineaNegocioNombre: producto?.lineaNegocioNombre || u.lineaNegocioNombre,
      lote: u.lote || '',
      ordenCompraNumero: u.ordenCompraNumero || '',
      fechaReferencia: fechaRef,
      diasEnEtapa: dias,
      capitalPEN: costoPEN,
      superaThreshold: dias > threshold,
    };
  });

  // Ordenar: estancadas primero (más días), luego mayor capital
  detalle.sort((a, b) => {
    if (a.superaThreshold !== b.superaThreshold) return a.superaThreshold ? -1 : 1;
    if (b.diasEnEtapa !== a.diasEnEtapa) return b.diasEnEtapa - a.diasEnEtapa;
    return b.capitalPEN - a.capitalPEN;
  });

  return detalle;
}

// ─────────────────────────────────────────────────────────────────────────────
// chk5.B10c · WORKSPACE FORECAST · proyecciones WMA + confidence + what-if
// ─────────────────────────────────────────────────────────────────────────────

/** Nivel de confianza para una proyección */
export type ConfidenceLevel = 'alta' | 'media' | 'baja';

/** Tipos de horizonte temporal del forecast */
export type ForecastHorizon = '30d' | '60d' | '90d';

/** Margen baseline asumido para what-if MVP · DEUDA-FORECAST-MARGEN-REAL */
export const ASSUMED_MARGEN_BASELINE_PCT = 30;

/** Forecast proyectado para un SKU específico */
export interface ForecastCostoSku {
  productoId: string;
  sku: string;
  nombreComercial: string;
  marca?: string;
  lineaNegocioNombre?: string;
  tipoProductoNombre?: string;
  esPack?: boolean;
  /** Costo PEN del lote más reciente */
  costoActualPEN: number;
  /** Proyección por horizonte */
  proyeccion30d: number;
  proyeccion60d: number;
  proyeccion90d: number;
  /** % esperado vs costo actual · cada horizonte */
  deltaPct30d: number;
  deltaPct60d: number;
  deltaPct90d: number;
  /** Capital actualmente activo (capital atrapado del SKU · uds en pipeline) */
  capitalAfectadoPEN: number;
  /** Confidence canon basado en cantidad de lotes históricos */
  confidence: ConfidenceLevel;
  confidenceScore: number;          // 0-100
  /** Cantidad de lotes que sustentaron el cálculo · transparencia */
  lotesHistoricos: number;
}

/** Punto proyectado para evolución gastos · 1 punto = 1 mes futuro */
export interface ForecastPuntoEvolucion {
  anio: number;
  mes: number;
  label: string;                    // 'Jun*' · '*' indica proyectado
  producto: number;
  venta: number;
  periodo: number;
  total: number;
  proyectado: true;                 // discriminator vs PuntoEvolucionBloques
}

/** Resultado del forecast de gastos por bloque */
export interface ForecastGastos {
  /** Serie histórica + futura · combinada para chart único */
  serieHistorica: PuntoEvolucionBloques[];
  serieFutura: ForecastPuntoEvolucion[];
  /** Total proyectado del trimestre próximo */
  totalProximoTrimestrePEN: number;
  /** % esperado vs trimestre anterior */
  deltaPctVsTrimestreAnt: number | null;
  confidence: ConfidenceLevel;
  hasData: boolean;
}

/** Input del what-if · 3 sliders MVP */
export interface WhatIfInputs {
  /** % variación TC · -15 a +15 */
  deltaTcPct: number;
  /** % variación precio proveedor USD · -20 a +20 */
  deltaProveedorPct: number;
  /** % variación volumen ventas · -30 a +30 */
  deltaVolumenPct: number;
}

/** Output del what-if · impacto agregado en KPIs clave */
export interface WhatIfOutput {
  /** Δ margen en puntos porcentuales (pp) · -2.4 = bajó 2.4pp */
  deltaMargenPp: number;
  margenBaselinePct: number;
  margenProyectadoPct: number;
  /** Δ capital atrapado en PEN · positivo = más atrapado */
  deltaCapitalAtrapadoPEN: number;
  deltaCapitalAtrapadoPct: number;
  /** Δ ingreso esperado en PEN · positivo = más ingresos */
  deltaIngresoPEN: number;
  /** Δ utilidad neta proyectada en PEN */
  deltaUtilidadNetaPEN: number;
  deltaUtilidadNetaPct: number;
}

/** Resultado completo del forecast · 3 paneles */
export interface ForecastResult {
  /** Forecast por SKU · top N ordenados por riesgo (mayor proyectada de subida) */
  skusForecast: ForecastCostoSku[];
  /** Forecast gastos por bloque · serie hist + futura */
  gastos: ForecastGastos;
  /** true si data suficiente para activar workspace */
  hasData: boolean;
  /** Confidence general · derivado de máximo entre fuentes */
  confidenceGeneral: ConfidenceLevel;
  /** true si confidence permite habilitar what-if + horizontes 60/90 */
  whatIfHabilitado: boolean;
  /** Prerequisitos para empty state · diagnóstico de qué falta */
  prerequisitos: {
    mesesOperacion: number;          // estimado · max(lotes-1, gastos-meses)
    skusConSeisLotes: number;
    skusConTresLotes: number;
    mesesGastosClasificados: number;
    snapshotsPool: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos · forecast
// ─────────────────────────────────────────────────────────────────────────────

function confidenceFromCount(count: number): { level: ConfidenceLevel; score: number } {
  if (count >= 6) return { level: 'alta', score: Math.min(100, 60 + count * 4) };
  if (count >= 3) return { level: 'media', score: 30 + count * 8 };
  return { level: 'baja', score: count * 12 };
}

/**
 * WMA sobre serie · proyecta N períodos hacia adelante.
 *
 * Calcula el % de cambio promedio ponderado entre puntos consecutivos
 * (ponderación creciente: el cambio más reciente pesa más) y proyecta
 * el último valor N períodos hacia adelante aplicando ese % geométrico.
 */
function wmaForecast(values: number[], periodsAhead: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1 || periodsAhead === 0) return values[values.length - 1];

  // % de cambio entre puntos consecutivos
  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] === 0) continue;
    changes.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  if (changes.length === 0) return values[values.length - 1];

  // Pesos crecientes · el cambio más reciente pesa más
  const weights = changes.map((_, i) => i + 1);
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const wmaChangeRate = changes.reduce((acc, c, i) => acc + c * weights[i], 0) / sumWeights;

  // Proyectar geométricamente
  const current = values[values.length - 1];
  return current * Math.pow(1 + wmaChangeRate, periodsAhead);
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal · calcularForecast
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula el forecast completo del workspace · 3 paneles consolidados.
 *
 * Combina:
 *   - Proyección de costos por SKU usando WMA sobre lotes
 *   - Proyección de gastos mensuales por bloque usando WMA sobre series
 *   - Prerequisitos diagnóstico para empty state
 *
 * Filosofía: NO inventa data. SKUs con <3 lotes muestran proyección con
 * confidence baja (visualmente italic). Si confidence general es baja,
 * el what-if y horizontes 60/90d se deshabilitan en el UI.
 */
export function calcularForecast(
  skus: SkuConCostos[],
  evolucionGastos: EvolucionPorBloque,
  poolSnapshotsCount: number,
  topN: number = 10,
): ForecastResult {
  // ─── 1. Forecast por SKU ────────────────────────────────────────────────
  const forecasts: ForecastCostoSku[] = [];

  for (const sku of skus) {
    const lotes = sku.lotes;
    if (lotes.length === 0) continue;

    // Asumimos ~1 nuevo lote cada 30d para horizonte de proyección
    // (proxy razonable · cada SKU varía pero MVP simplifica)
    const values = sku.trendCostosPEN; // serie cronológica ascendente
    const proyeccion30d = wmaForecast(values, 1);
    const proyeccion60d = wmaForecast(values, 2);
    const proyeccion90d = wmaForecast(values, 3);

    const costoActual = sku.ultimoCostoPEN;
    const safeDelta = (proj: number) =>
      costoActual > 0 ? ((proj - costoActual) / costoActual) * 100 : 0;

    const conf = confidenceFromCount(lotes.length);

    forecasts.push({
      productoId: sku.productoId,
      sku: sku.sku,
      nombreComercial: sku.nombreComercial,
      marca: sku.marca,
      lineaNegocioNombre: sku.lineaNegocioNombre,
      tipoProductoNombre: sku.tipoProductoNombre,
      esPack: sku.esPack,
      costoActualPEN: costoActual,
      proyeccion30d,
      proyeccion60d,
      proyeccion90d,
      deltaPct30d: safeDelta(proyeccion30d),
      deltaPct60d: safeDelta(proyeccion60d),
      deltaPct90d: safeDelta(proyeccion90d),
      capitalAfectadoPEN: sku.capitalActivoPEN,
      confidence: conf.level,
      confidenceScore: conf.score,
      lotesHistoricos: lotes.length,
    });
  }

  // Ordenar por mayor delta esperado (riesgo de subida) en 30d
  forecasts.sort((a, b) => b.deltaPct30d - a.deltaPct30d);
  const skusForecast = forecasts.slice(0, topN);

  // ─── 2. Forecast gastos por bloque ──────────────────────────────────────
  const serieHist = evolucionGastos.serie;
  const serieFutura: ForecastPuntoEvolucion[] = [];
  let totalProximoTrimestre = 0;

  if (serieHist.length >= 2) {
    const valsProd = serieHist.map((p) => p.producto);
    const valsVenta = serieHist.map((p) => p.venta);
    const valsPeriodo = serieHist.map((p) => p.periodo);

    const ultimoPunto = serieHist[serieHist.length - 1];
    for (let i = 1; i <= 3; i++) {
      const nextDate = new Date(ultimoPunto.anio, ultimoPunto.mes - 1 + i, 1);
      const projProd = wmaForecast(valsProd, i);
      const projVenta = wmaForecast(valsVenta, i);
      const projPeriodo = wmaForecast(valsPeriodo, i);
      const projTotal = projProd + projVenta + projPeriodo;
      totalProximoTrimestre += projTotal;

      serieFutura.push({
        anio: nextDate.getFullYear(),
        mes: nextDate.getMonth() + 1,
        label: `${nombreMesCorto(nextDate.getMonth() + 1)}*`,
        producto: projProd,
        venta: projVenta,
        periodo: projPeriodo,
        total: projTotal,
        proyectado: true,
      });
    }
  }

  // Trimestre anterior real (últimos 3 puntos hist)
  const ultimos3Hist = serieHist.slice(-3);
  const totalTrimestreAnt = ultimos3Hist.reduce((s, p) => s + p.total, 0);
  const deltaPctVsTrimestreAnt = totalTrimestreAnt > 0
    ? ((totalProximoTrimestre - totalTrimestreAnt) / totalTrimestreAnt) * 100
    : null;

  const confGastos = confidenceFromCount(serieHist.filter((p) => p.total > 0).length);

  const gastosForecast: ForecastGastos = {
    serieHistorica: serieHist,
    serieFutura,
    totalProximoTrimestrePEN: totalProximoTrimestre,
    deltaPctVsTrimestreAnt,
    confidence: confGastos.level,
    hasData: serieFutura.length > 0,
  };

  // ─── 3. Prerequisitos y confidence general ──────────────────────────────
  const skusConSeisLotes = skus.filter((s) => s.lotes.length >= 6).length;
  const skusConTresLotes = skus.filter((s) => s.lotes.length >= 3).length;
  const mesesGastosClasificados = serieHist.filter((p) => p.total > 0).length;
  const maxLotes = skus.reduce((m, s) => Math.max(m, s.lotes.length), 0);
  const mesesOperacion = Math.max(maxLotes, mesesGastosClasificados);

  // Confidence general · max entre fuentes
  const skuMaxConfidence = skusForecast.reduce<ConfidenceLevel>(
    (best, sf) => {
      const order: Record<ConfidenceLevel, number> = { baja: 0, media: 1, alta: 2 };
      return order[sf.confidence] > order[best] ? sf.confidence : best;
    },
    'baja' as ConfidenceLevel
  );
  const order: Record<ConfidenceLevel, number> = { baja: 0, media: 1, alta: 2 };
  const confidenceGeneral: ConfidenceLevel =
    order[skuMaxConfidence] >= order[gastosForecast.confidence]
      ? skuMaxConfidence
      : gastosForecast.confidence;

  const whatIfHabilitado = confidenceGeneral !== 'baja';

  const hasData = skusForecast.length > 0 || gastosForecast.hasData;

  return {
    skusForecast,
    gastos: gastosForecast,
    hasData,
    confidenceGeneral,
    whatIfHabilitado,
    prerequisitos: {
      mesesOperacion,
      skusConSeisLotes,
      skusConTresLotes,
      mesesGastosClasificados,
      snapshotsPool: poolSnapshotsCount,
    },
  };
}

/**
 * Calcula el output del what-if sobre la baseline del módulo.
 *
 * Cálculo lineal · NO modela elasticidad de demanda ni efectos no-lineales.
 * Margen baseline asumido = ASSUMED_MARGEN_BASELINE_PCT (configurable
 * en deuda · DEUDA-FORECAST-MARGEN-REAL).
 */
export function calcularWhatIf(
  inputs: WhatIfInputs,
  baseline: {
    capitalInvertidoPEN: number;
    capitalAtrapadoPEN: number;
    margenBaselinePct?: number;
  },
): WhatIfOutput {
  const margenBaseline = baseline.margenBaselinePct ?? ASSUMED_MARGEN_BASELINE_PCT;
  const factorTc = 1 + inputs.deltaTcPct / 100;
  const factorProv = 1 + inputs.deltaProveedorPct / 100;
  const factorVol = 1 + inputs.deltaVolumenPct / 100;

  // Factor combinado de costo unitario (TC × Proveedor)
  const factorCostoCombinado = factorTc * factorProv;

  // Δ margen pp · si costos suben pero precio se mantiene, margen baja
  // Aproximación: margen nuevo = margen baseline - (costoFactor - 1) × (1 - margen baseline)
  // Si costo sube 8% sobre 70% del precio (costo es 100-30=70%), margen baja 5.6pp
  const ratioCostoSobrePrecio = (100 - margenBaseline) / 100;
  const deltaMargenPp = -((factorCostoCombinado - 1) * ratioCostoSobrePrecio * 100);
  const margenProyectadoPct = margenBaseline + deltaMargenPp;

  // Δ capital atrapado · subida de costos = mismo volumen × más capital
  const capitalAtrapadoProyectado = baseline.capitalAtrapadoPEN * factorCostoCombinado;
  const deltaCapitalAtrapadoPEN = capitalAtrapadoProyectado - baseline.capitalAtrapadoPEN;
  const deltaCapitalAtrapadoPct = baseline.capitalAtrapadoPEN > 0
    ? (deltaCapitalAtrapadoPEN / baseline.capitalAtrapadoPEN) * 100
    : 0;

  // Δ ingreso esperado · proxy baseline · capital invertido × asumido turnover trimestral
  // Asumimos 1 vuelta trimestral · ingreso mensual ≈ capital × (1+margen) / 3
  const ingresoBaselineMensual = baseline.capitalInvertidoPEN > 0
    ? (baseline.capitalInvertidoPEN * (1 + margenBaseline / 100)) / 3
    : 0;
  const deltaIngresoPEN = ingresoBaselineMensual * (factorVol - 1);

  // Δ utilidad neta = Δ ingreso × margen NUEVO + (margen actual × ingreso baseline × cambio margen)
  // Simplificación: utilidad nueva = ingreso × factorVol × margen proyectado
  // utilidad baseline = ingreso × margen baseline
  const utilidadBaseline = ingresoBaselineMensual * (margenBaseline / 100);
  const utilidadProyectada = ingresoBaselineMensual * factorVol * (margenProyectadoPct / 100);
  const deltaUtilidadNetaPEN = utilidadProyectada - utilidadBaseline;
  const deltaUtilidadNetaPct = utilidadBaseline !== 0
    ? (deltaUtilidadNetaPEN / utilidadBaseline) * 100
    : 0;

  return {
    deltaMargenPp,
    margenBaselinePct: margenBaseline,
    margenProyectadoPct,
    deltaCapitalAtrapadoPEN,
    deltaCapitalAtrapadoPct,
    deltaIngresoPEN,
    deltaUtilidadNetaPEN,
    deltaUtilidadNetaPct,
  };
}

/** Labels canon */
export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

export const CONFIDENCE_CLASSES: Record<ConfidenceLevel, { bar: string; text: string }> = {
  alta: { bar: 'bg-emerald-500', text: 'text-emerald-600' },
  media: { bar: 'bg-amber-500', text: 'text-amber-600' },
  baja: { bar: 'bg-rose-500', text: 'text-rose-600' },
};

// ─────────────────────────────────────────────────────────────────────────────
// chk5.B10b · WORKSPACE ALERTAS · consolidación de anomalías cross-categoría
// ─────────────────────────────────────────────────────────────────────────────

/** Severidad canónica de una alerta */
export type AlertaSeverity = 'critica' | 'alta' | 'media';

/** Categoría canónica de una alerta · MVP 3 + stock como placeholder */
export type AlertaCategoria = 'variance' | 'pipeline' | 'fx' | 'stock';

/** Thresholds canónicos · ajustables vía settings en deuda DEUDA-CONFIG-THRESHOLDS */
export const ALERTA_THRESHOLDS = {
  variance: { critica: 10, alta: 5, media: 2 },     // % absoluto
  fx:       { critica: 10, alta: 5 },               // % absoluto
  // pipeline severity = factor × threshold-de-la-etapa (PIPELINE_THRESHOLDS_DIAS)
  pipelineFactor: { critica: 2, alta: 1 },
};

export interface AlertaContexto {
  skuId?: string;
  sku?: string;
  productoNombre?: string;
  marca?: string;
  lineaNegocioNombre?: string;
  etapa?: EtapaPipeline;
  valorComprometidoPEN?: number;
  /** Métrica visible en la card (ej "+12.0%" · "21d") */
  metrica?: string;
  /** Texto secundario (ej "S/ 44.16 → S/ 49.55") */
  detalleAdicional?: string;
}

/** Acción primaria sugerida · placeholder MVP (handler real va a deuda) */
export interface AlertaAccionPrimaria {
  label: string;
  iconName: 'phone' | 'dollar-sign' | 'plus' | 'refresh-cw';
}

/** Link interno para navegación contextual desde la alerta */
export interface AlertaLink {
  workspace: 'catalogo' | 'pipeline' | 'costos';
  skuId?: string;
  etapa?: EtapaPipeline;
}

export interface Alerta {
  id: string;                       // determinístico · {categoria}-{contexto}-{periodo}
  severity: AlertaSeverity;
  category: AlertaCategoria;
  titulo: string;
  descripcion: string;
  contexto: AlertaContexto;
  fechaDeteccion: Date;
  accionPrimaria?: AlertaAccionPrimaria;
  linkInternal?: AlertaLink;
}

export interface AlertasConsolidadas {
  alertas: Alerta[];
  /** Resumen counts por categoría */
  countByCategoria: Record<AlertaCategoria, number>;
  /** Resumen counts por severidad */
  countBySeverity: Record<AlertaSeverity, number>;
  totalActivas: number;
  /** true si hay data operacional Y al menos 1 alerta */
  hayAnomalias: boolean;
  /** true si hay data operacional pero 0 alertas · empty positivo */
  todoBajoControl: boolean;
}

/** Convierte categoría a iconName lucide · usado en cards y feed */
export const ALERTA_CATEGORIA_ICONS: Record<AlertaCategoria, string> = {
  variance: 'trending-up',
  pipeline: 'clock',
  fx: 'dollar-sign',
  stock: 'package',
};

export const ALERTA_CATEGORIA_LABELS: Record<AlertaCategoria, string> = {
  variance: 'Variance costos',
  pipeline: 'Pipeline',
  fx: 'FX · TCPA',
  stock: 'Stock',
};

const SEVERITY_RANK: Record<AlertaSeverity, number> = {
  critica: 0,
  alta: 1,
  media: 2,
};

/**
 * Genera el ID determinístico de una alerta basado en categoría + contexto +
 * período. Esto permite que la persistencia "marcar visto" en localStorage
 * funcione consistentemente entre recálculos (la misma anomalía mantiene su id).
 */
function generarAlertaId(categoria: AlertaCategoria, contexto: string, periodo: string): string {
  return `${categoria}-${contexto}-${periodo}`;
}

/** Periodo "YYYY-MM" para alertas mensuales (variance, fx) */
function periodoMensual(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Periodo "YYYY-W##" para alertas semanales (pipeline · puede cambiar rápido) */
function periodoSemanal(d: Date): string {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor((diff + start.getDay()) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Consolidación de alertas cross-categoría desde el engine.
 *
 * Genera alertas de 3 fuentes (Stock queda placeholder hasta integrar Inventario):
 *   - Variance: SKUs con |variance| > threshold (rose · ordenadas por severidad)
 *   - Pipeline: unidades estancadas agrupadas por SKU+etapa
 *   - FX: desviación TCPA vs SBS > threshold (1 sola alerta del mes)
 *
 * Ordenadas por severidad descendente, luego fecha descendente.
 *
 * @param skus catalog enriquecido con costos (del engine principal)
 * @param pipeline resultado de calcularPipelineValorizado()
 * @param tcpaVsSBS resultado de calcularTCPAvsSBS()
 * @param anchorDate fecha de referencia (default hoy)
 */
export function calcularAlertasConsolidadas(
  skus: SkuConCostos[],
  pipeline: PipelineValorizado,
  tcpaVsSBS: TCPAvsSBS,
  anchorDate: Date = new Date(),
): AlertasConsolidadas {
  const alertas: Alerta[] = [];
  const periodoMes = periodoMensual(anchorDate);

  // ─── 1. Variance alerts · uno por SKU con |variance| > umbral ───────────
  for (const sku of skus) {
    if (sku.varianceVsLoteAntPct === null || sku.estadoCosto === 'estable') continue;
    if (sku.estadoCosto !== 'volatil' && sku.estadoCosto !== 'anomalo') continue;

    const abs = Math.abs(sku.varianceVsLoteAntPct);
    let severity: AlertaSeverity;
    if (abs > ALERTA_THRESHOLDS.variance.critica) severity = 'critica';
    else if (abs > ALERTA_THRESHOLDS.variance.alta) severity = 'alta';
    else if (abs > ALERTA_THRESHOLDS.variance.media) severity = 'media';
    else continue;

    const direccion = sku.varianceVsLoteAntPct > 0 ? 'subió' : 'bajó';
    const sign = sku.varianceVsLoteAntPct > 0 ? '+' : '';
    const titulo = `${sku.nombreComercial} · costo ${direccion} ${sign}${sku.varianceVsLoteAntPct.toFixed(1)}% en último lote`;

    // Construir descripción con drivers si están disponibles
    const attribution = calcularVarianceAttribution(sku);
    let descripcion = `Variance detectada al recibir lote más reciente vs anterior.`;
    if (attribution) {
      const totalAbs = Math.abs(attribution.totalPp) || 1;
      const pctProveedor = Math.round((Math.abs(attribution.precioProveedorPp) / totalAbs) * 100);
      const pctTC = Math.round((Math.abs(attribution.tcPp) / totalAbs) * 100);
      descripcion = `Drivers principales: precio proveedor ${attribution.precioProveedorPp >= 0 ? '+' : ''}${attribution.precioProveedorPp.toFixed(1)}pp (${pctProveedor}%) + TC ${attribution.tcPp >= 0 ? '+' : ''}${attribution.tcPp.toFixed(1)}pp (${pctTC}%).`;
    }

    // Acción primaria según severity
    let accionPrimaria: AlertaAccionPrimaria | undefined;
    if (severity === 'critica') {
      accionPrimaria = sku.varianceVsLoteAntPct > 0
        ? { label: 'Renegociar proveedor', iconName: 'phone' }
        : { label: 'Confirmar baseline', iconName: 'refresh-cw' };
    }

    const ultimoLote = sku.lotes[sku.lotes.length - 1];
    const loteAnterior = sku.lotes.length >= 2 ? sku.lotes[sku.lotes.length - 2] : null;
    const detalleAdicional = loteAnterior
      ? `S/ ${loteAnterior.costoUnitarioPEN.toFixed(2)} → S/ ${ultimoLote.costoUnitarioPEN.toFixed(2)}`
      : undefined;

    alertas.push({
      id: generarAlertaId('variance', sku.productoId, periodoMes),
      severity,
      category: 'variance',
      titulo,
      descripcion,
      contexto: {
        skuId: sku.productoId,
        sku: sku.sku,
        productoNombre: sku.nombreComercial,
        marca: sku.marca,
        lineaNegocioNombre: sku.lineaNegocioNombre,
        metrica: `${sign}${sku.varianceVsLoteAntPct.toFixed(1)}%`,
        detalleAdicional,
      },
      fechaDeteccion: ultimoLote?.fechaRecepcion ?? anchorDate,
      accionPrimaria,
      linkInternal: { workspace: 'catalogo', skuId: sku.productoId },
    });
  }

  // ─── 2. Pipeline alerts · agrupado por SKU+etapa para no inundar feed ────
  // Agrupamos las unidades estancadas por (productoId, etapa) y generamos 1 alerta
  // por grupo. La severidad se deriva de los días MÁXIMOS del grupo.
  type GroupKey = string;
  const grupoPipeline = new Map<GroupKey, {
    productoId: string;
    productoSKU: string;
    productoNombre: string;
    etapa: EtapaPipeline;
    unidades: number;
    capitalTotal: number;
    diasMax: number;
    fechaMasAntigua: Date;
  }>();

  for (const u of pipeline.unidadesEstancadas) {
    const key = `${u.productoId}|${u.etapa}`;
    const existing = grupoPipeline.get(key);
    if (existing) {
      existing.unidades += 1;
      existing.capitalTotal += u.capitalPEN;
      if (u.diasEnEtapa > existing.diasMax) existing.diasMax = u.diasEnEtapa;
      if (u.fechaReferencia.getTime() < existing.fechaMasAntigua.getTime()) {
        existing.fechaMasAntigua = u.fechaReferencia;
      }
    } else {
      grupoPipeline.set(key, {
        productoId: u.productoId,
        productoSKU: u.productoSKU,
        productoNombre: u.productoNombre,
        etapa: u.etapa,
        unidades: 1,
        capitalTotal: u.capitalPEN,
        diasMax: u.diasEnEtapa,
        fechaMasAntigua: u.fechaReferencia,
      });
    }
  }

  for (const grupo of grupoPipeline.values()) {
    const threshold = PIPELINE_THRESHOLDS_DIAS[grupo.etapa];
    const factor = threshold > 0 ? grupo.diasMax / threshold : 1;
    let severity: AlertaSeverity;
    if (factor >= ALERTA_THRESHOLDS.pipelineFactor.critica) severity = 'critica';
    else if (factor >= ALERTA_THRESHOLDS.pipelineFactor.alta) severity = 'alta';
    else severity = 'media';

    const etapaLabel = ETAPA_LABELS[grupo.etapa];
    const titulo = `${grupo.unidades} ${grupo.unidades === 1 ? 'unidad estancada' : 'unidades estancadas'} en ${etapaLabel} · ${grupo.diasMax} días`;
    const descripcion = `Threshold canónico para etapa ${etapaLabel}: ${threshold} días. Las unidades están ${factor.toFixed(1)}× sobre lo esperado.`;

    let accionPrimaria: AlertaAccionPrimaria | undefined;
    if (severity === 'critica' && grupo.etapa === 'aduana') {
      accionPrimaria = { label: 'Contactar agencia aduanal', iconName: 'phone' };
    }

    alertas.push({
      id: generarAlertaId('pipeline', `${grupo.productoId}-${grupo.etapa}`, periodoSemanal(anchorDate)),
      severity,
      category: 'pipeline',
      titulo,
      descripcion,
      contexto: {
        skuId: grupo.productoId,
        sku: grupo.productoSKU,
        productoNombre: grupo.productoNombre,
        etapa: grupo.etapa,
        valorComprometidoPEN: grupo.capitalTotal,
        metrica: `${grupo.diasMax}d`,
        detalleAdicional: `${grupo.unidades} ${grupo.unidades === 1 ? 'unidad' : 'unidades'} · S/ ${Math.round(grupo.capitalTotal).toLocaleString('es-PE')} comprometidos`,
      },
      fechaDeteccion: grupo.fechaMasAntigua,
      accionPrimaria,
      linkInternal: { workspace: 'pipeline', etapa: grupo.etapa, skuId: grupo.productoId },
    });
  }

  // ─── 3. FX alert · una sola alerta del mes si desviación supera threshold ─
  if (tcpaVsSBS.hasData && tcpaVsSBS.diffPctActual !== null) {
    const absDiff = Math.abs(tcpaVsSBS.diffPctActual);
    let severity: AlertaSeverity | null = null;
    if (absDiff > ALERTA_THRESHOLDS.fx.critica) severity = 'critica';
    else if (absDiff > ALERTA_THRESHOLDS.fx.alta) severity = 'alta';

    if (severity) {
      const esAhorro = (tcpaVsSBS.diffAbsoluteActual ?? 0) > 0;
      const titulo = esAhorro
        ? `TCPA ${(tcpaVsSBS.diffAbsoluteActual ?? 0).toFixed(2)} menor que SBS · oportunidad de hedging`
        : `TCPA ${Math.abs(tcpaVsSBS.diffAbsoluteActual ?? 0).toFixed(2)} mayor que SBS · sobrecosto cambiario`;

      const descripcion = `TCPA actual: ${tcpaVsSBS.tcpaActual?.toFixed(2)} · SBS: ${tcpaVsSBS.sbsActual?.toFixed(2)} · ${esAhorro ? 'costo' : 'sobrecosto'} ${absDiff.toFixed(1)}% ${esAhorro ? 'inferior' : 'sobre'} el oficial.`;

      alertas.push({
        id: generarAlertaId('fx', 'tcpa-sbs', periodoMes),
        severity,
        category: 'fx',
        titulo,
        descripcion,
        contexto: {
          metrica: `${tcpaVsSBS.diffPctActual >= 0 ? '+' : ''}${tcpaVsSBS.diffPctActual.toFixed(1)}%`,
        },
        fechaDeteccion: anchorDate,
        // FX no tiene acción primaria · informativa para hedging
        linkInternal: { workspace: 'costos' },
      });
    }
  }

  // ─── 4. Ordenar: severidad descendente, luego fecha descendente ──────────
  alertas.sort((a, b) => {
    const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return b.fechaDeteccion.getTime() - a.fechaDeteccion.getTime();
  });

  // ─── 5. Agregados ────────────────────────────────────────────────────────
  const countByCategoria: Record<AlertaCategoria, number> = {
    variance: 0,
    pipeline: 0,
    fx: 0,
    stock: 0,
  };
  const countBySeverity: Record<AlertaSeverity, number> = {
    critica: 0,
    alta: 0,
    media: 0,
  };
  for (const a of alertas) {
    countByCategoria[a.category]++;
    countBySeverity[a.severity]++;
  }

  // hayAnomalias = al menos 1 alerta · todoBajoControl = hay data Y 0 alertas
  const tieneData = skus.length > 0 || pipeline.hasData;
  const hayAnomalias = alertas.length > 0;
  const todoBajoControl = tieneData && !hayAnomalias;

  return {
    alertas,
    countByCategoria,
    countBySeverity,
    totalActivas: alertas.length,
    hayAnomalias,
    todoBajoControl,
  };
}

/**
 * Persistencia "marcar visto" en localStorage · key prefix por userId.
 * Devuelve true si la alerta está marcada como vista.
 */
const ALERTAS_VISTAS_KEY = (userId: string) => `ci_alertas_vistas_${userId}`;

export function leerAlertasVistas(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(ALERTAS_VISTAS_KEY(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function marcarAlertaVista(userId: string, alertaId: string): void {
  const vistas = leerAlertasVistas(userId);
  vistas.add(alertaId);
  try {
    localStorage.setItem(ALERTAS_VISTAS_KEY(userId), JSON.stringify(Array.from(vistas)));
  } catch {
    // ignorar errores · localStorage puede estar deshabilitado
  }
}

export function desmarcarAlertaVista(userId: string, alertaId: string): void {
  const vistas = leerAlertasVistas(userId);
  vistas.delete(alertaId);
  try {
    localStorage.setItem(ALERTAS_VISTAS_KEY(userId), JSON.stringify(Array.from(vistas)));
  } catch {
    // ignorar
  }
}

export function marcarTodasComoVistas(userId: string, alertasIds: string[]): void {
  const vistas = leerAlertasVistas(userId);
  for (const id of alertasIds) vistas.add(id);
  try {
    localStorage.setItem(ALERTAS_VISTAS_KEY(userId), JSON.stringify(Array.from(vistas)));
  } catch {
    // ignorar
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// chk5.B9 · helpers reusables (mantienen su sección original)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Driver inferido para un lote · usado en la columna "Driver principal" de la
 * tabla de comparativa de lotes. Compara el lote actual con el anterior y
 * decide cuál fue la causa dominante del cambio de costo (USD vs TC).
 */
export function driverPrincipalLote(
  loteActual: LoteCosto,
  loteAnterior: LoteCosto | null,
): string {
  if (!loteAnterior) return 'Primer lote · baseline';

  const dUSD = loteAnterior.costoUnitarioUSD > 0
    ? ((loteActual.costoUnitarioUSD - loteAnterior.costoUnitarioUSD) / loteAnterior.costoUnitarioUSD) * 100
    : 0;
  const dTC = loteAnterior.tc > 0
    ? ((loteActual.tc - loteAnterior.tc) / loteAnterior.tc) * 100
    : 0;

  const fmtDriver = (label: string, pct: number) =>
    `${label} ${pct >= 0 ? 'subió' : 'bajó'} ${Math.abs(pct).toFixed(1)}%`;

  // Si ambos drivers son <0.5%, lote estable
  if (Math.abs(dUSD) < 0.5 && Math.abs(dTC) < 0.5) {
    return 'Sin cambios significativos · lote estable';
  }

  // Driver dominante (mayor magnitud absoluta)
  if (Math.abs(dUSD) >= Math.abs(dTC)) {
    const otro = Math.abs(dTC) >= 0.5 ? ` · TC ${dTC >= 0 ? 'compensó parte' : 'agravó'}` : ' · TC estable';
    return `${fmtDriver('Proveedor', dUSD)}${otro}`;
  } else {
    const otro = Math.abs(dUSD) >= 0.5 ? ` · proveedor ${dUSD >= 0 ? 'también subió' : 'compensó parte'}` : ' · proveedor estable';
    return `${fmtDriver('TC', dTC)}${otro}`;
  }
}
