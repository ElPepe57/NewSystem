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
