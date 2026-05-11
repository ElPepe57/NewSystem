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
