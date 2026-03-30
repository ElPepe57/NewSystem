import { create } from 'zustand';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../config/collections';
import { ctruService } from '../services/ctru.service';
import { transferenciaService } from '../services/transferencia.service';
import { ProductoService } from '../services/producto.service';
import { getCTRU, getCostoBasePEN, getTC, calcularGAGOProporcional } from '../utils/ctru.utils';
import { poolUSDService } from '../services/poolUSD.service';
import { timed } from '../lib/perf';
import type { Unidad } from '../types/unidad.types';
import type { Gasto } from '../types/gasto.types';
import type { OrdenCompra } from '../types/ordenCompra.types';
import type { Venta } from '../types/venta.types';
import type { Producto } from '../types/producto.types';

// ---- In-flight guard: prevents concurrent duplicate fetchAll calls ----
let _fetchAllInProgress = false;
// ---- TTL cache: skip re-fetch if data is fresher than 5 minutes ----
let _lastFetchAt = 0;
const FETCH_TTL_MS = 5 * 60 * 1000;


// ============================================
// INTERFACES - 7 Capas de Costo (CTRU v3)
// ============================================
// 1. Compra (costo puro producto)
// 2. Impuesto (Sales Tax OC prorrateado)
// 3. Envio OC (proveedor→USA courier/envio prorrateado)
// 4. Otros OC (otros gastos OC prorrateado)
// 5. Flete Internacional (USA→Peru, de transferencia)
// 6. GA/GO (gastos admin/operativos prorrateados)
// 7. GV/GD (gastos venta/distribucion por venta)

// --- Sub-types for product detail ---

export interface LoteProducto {
  ordenCompraId: string;
  ordenCompraNumero: string;
  fecha: Date | null;
  cantidad: number;
  costoUnitarioUSD: number;
  costoUnitarioPEN: number;
  tc: number;
}

export interface VentaProductoDetalle {
  ventaId: string;
  ventaNumero: string;
  fecha: Date | null;
  cliente: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  gvgdUnitario: number;
  margenBruto: number;
  margenNeto: number;
}

export interface PricingProducto {
  costoInventario: number;
  ctru: number;
  costoTotal: number;
  precioMinimo10: number;
  precioMinimo20: number;
  precioMinimo30: number;
  precioActual: number;
  margenActual: number;
}

export interface CTRUProductoDetalle {
  productoId: string;
  productoNombre: string;
  productoSKU: string;

  // Info del producto
  marca: string;
  presentacion: string;
  contenido: string;
  dosaje: string;
  sabor?: string;
  lineaNegocioId?: string;

  // Estado y conteos
  estadoProducto: 'activo' | 'vendido' | 'mixto';
  unidadesActivas: number;
  unidadesVendidas: number;
  totalUnidades: number;

  // Capa 1: Compra
  costoCompraUSDProm: number;
  costoCompraPENProm: number;

  // Capa 2: Impuesto
  costoImpuestoUSDProm: number;
  costoImpuestoPENProm: number;

  // Capa 3: Envio OC
  costoEnvioUSDProm: number;
  costoEnvioPENProm: number;

  // Capa 4: Otros OC
  costoOtrosUSDProm: number;
  costoOtrosPENProm: number;

  // Capa 5: Flete Internacional (USA→Peru)
  costoFleteIntlUSDProm: number;
  costoFleteIntlPENProm: number;

  // Capa 6: GA/GO (solo entre vendidas)
  gastoGAGOProm: number;
  gastoGAGOEstimado: number;  // Estimado proyectado para productos sin ventas

  // Capa 7: GV/GD
  gastoGVGDProm: number;

  // Totales
  costoInventarioProm: number;  // capas 1-5
  ctruPromedio: number;         // capas 1-6 (alias de ctruContableProm para backward compat)
  ctruContableProm: number;     // GA/GO solo entre vendidas
  ctruGerencialProm: number;    // GA/GO entre todas las unidades
  costoTotalRealProm: number;   // capas 1-7

  // Venta y margen
  precioVentaProm: number;
  margenBrutoProm: number;
  margenNetoProm: number;
  ventasCount: number;

  // Porcentajes de composicion
  pctCompra: number;
  pctImpuesto: number;
  pctEnvio: number;
  pctOtros: number;
  pctFleteIntl: number;
  pctGAGO: number;
  pctGVGD: number;

  // Rango
  ctruMinimo: number;
  ctruMaximo: number;

  // Historial por lote
  lotes: LoteProducto[];

  // Ventas individuales
  ventasDetalle: VentaProductoDetalle[];

  // Pricing
  pricing: PricingProducto;
}

export interface HistorialCostosMes {
  mes: number;
  anio: number;
  label: string;
  costoCompraProm: number;
  costoImpuestoProm: number;
  costoEnvioProm: number;
  costoOtrosProm: number;
  costoFleteIntlProm: number;
  gastoGAGOProm: number;
  gastoGVGDProm: number;
  ctruPromedio: number;
  costoTotalProm: number;
  precioVentaProm: number;
  margenProm: number;
  unidades: number;
  ventasCount: number;
}

export interface HistorialGastosEntry {
  mes: number;
  anio: number;
  label: string;
  GA: number;
  GO: number;
  GV: number;
  GD: number;
  total: number;
}

export interface CTRUResumenV2 {
  costoCompraPromedioUSD: number;
  ctruPromedioPEN: number;
  margenPromedioPercent: number;
  totalUnidadesActivas: number;
  totalUnidadesVendidas: number;
  totalProductos: number;
  totalProductosActivos: number;
  totalVentasAnalizadas: number;
  tendenciaCostoCompra: number[];
  tendenciaCTRU: number[];
  tendenciaMargen: number[];
}

export interface LoteOCDetalle {
  ordenCompraId: string;
  ordenCompraNumero: string;
  proveedorNombre: string;
  fechaRecepcion: Date | null;
  tcCompra: number;
  tcPago: number;
  totalUnidades: number;
  costoCompraUSDProm: number;
  costoCompraPENProm: number;
  costoImpuestoUSDProm: number;
  costoImpuestoPENProm: number;
  costoEnvioUSDProm: number;
  costoEnvioPENProm: number;
  costoOtrosUSDProm: number;
  costoOtrosPENProm: number;
  costoFleteIntlUSDProm: number;
  costoFleteIntlPENProm: number;
  gastoGAGOProm: number;
  ctruPromedio: number;
  pctCompra: number;
  pctImpuesto: number;
  pctEnvio: number;
  pctOtros: number;
  pctFleteIntl: number;
  pctGAGO: number;
  productos: Array<{
    productoId: string;
    productoNombre: string;
    productoSKU: string;
    cantidad: number;
    costoUnitarioUSD: number;
    ctruPromedio: number;
  }>;
}

interface CTRUState {
  resumen: CTRUResumenV2 | null;
  productosDetalle: CTRUProductoDetalle[];
  historialMensual: HistorialCostosMes[];
  historialGastos: HistorialGastosEntry[];
  lotesOC: LoteOCDetalle[];
  /** TCPA del Pool USD — para vista gerencial con costo real del dólar */
  tcpa: number;
  loading: boolean;
  error: string | null;

  fetchAll: () => Promise<void>;
  recalcularCTRU: () => Promise<{
    unidadesActualizadas: number;
    gastosAplicados: number;
    impactoPorUnidad: number;
  }>;
}

// ============================================
// INTERNAL TYPES
// ============================================

interface OCCostBreakdown {
  impuestoPerUnit: number;
  envioPerUnit: number;
  otrosPerUnit: number;
}

interface UnitCostLayers {
  compraUSD: number;
  compraPEN: number;
  impuestoUSD: number;
  impuestoPEN: number;
  envioUSD: number;
  envioPEN: number;
  otrosUSD: number;
  otrosPEN: number;
  fleteIntlUSD: number;
  fleteIntlPEN: number;
  gagoPEN: number;
  ctru: number;
}

// ============================================
// HELPERS
// ============================================

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ACTIVE_STATES = ['disponible_peru', 'recibida_usa', 'reservada', 'en_transito_peru'];
const VENTA_STATES = ['asignada', 'en_entrega', 'despachada', 'entrega_parcial', 'entregada'];
// States excluded from all CTRU analysis (historical-only, no cost impact going forward)
const EXCLUDED_STATES = ['vencida', 'danada'];
const RELEVANT_STATES = [...ACTIVE_STATES, 'vendida'];

// ---- Optimized Firestore fetches (scoped to what CTRU actually needs) ----

/**
 * Fetch all units except those in terminal historical states (vencida, danada).
 * Uses a Firestore not-in filter so we avoid downloading units that are
 * irrelevant to any CTRU calculation and only inflate read costs.
 */
async function fetchUnidadesParaCTRU(): Promise<Unidad[]> {
  const q = query(
    collection(db, COLLECTIONS.UNIDADES),
    where('estado', 'not-in', EXCLUDED_STATES)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Unidad));
}

/**
 * Fetch only the expense categories that CTRU processing uses:
 *   GA / GO  → overhead allocation (impacts ctruDinamico)
 *   GV / GD  → per-sale direct costs (impacts margen neto)
 * Excludes unrelated types (fletes en OC, impuestos, etc.) and reduces
 * downloaded documents significantly on mature datasets.
 */
async function fetchGastosParaCTRU(): Promise<Gasto[]> {
  const q = query(
    collection(db, COLLECTIONS.GASTOS),
    where('categoria', 'in', ['GA', 'GO', 'GV', 'GD'])
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Gasto));
}

/**
 * Fetch only the OCs referenced by the already-loaded units.
 * Instead of pulling every OC ever created, we collect unique ordenCompraId
 * values from the relevant units and retrieve those documents directly.
 * On large datasets this can cut OC reads by 70–90 %.
 */
async function fetchOCsParaCTRU(unidades: Unidad[]): Promise<OrdenCompra[]> {
  const ocIds = Array.from(
    new Set(unidades.map(u => u.ordenCompraId).filter(Boolean) as string[])
  );
  if (ocIds.length === 0) return [];

  // getDoc in parallel — Firestore charges 1 read per document regardless;
  // direct doc fetches skip the collection scan overhead.
  const docRefs = ocIds.map(id => doc(db, COLLECTIONS.ORDENES_COMPRA, id));
  const snaps = await Promise.all(docRefs.map(ref => getDoc(ref)));
  return snaps
    .filter(s => s.exists())
    .map(s => ({ id: s.id, ...s.data() } as OrdenCompra));
}

/**
 * Fetch only sales in the states that matter for CTRU margin analysis.
 * Drafts, cancelled, and returned sales are excluded at the database level.
 */
async function fetchVentasParaCTRU(): Promise<Venta[]> {
  const q = query(
    collection(db, COLLECTIONS.VENTAS),
    where('estado', 'in', VENTA_STATES)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Venta));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

function toDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === 'function') return (ts as { toDate: () => Date }).toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  return null;
}

function getUnitCostLayers(
  u: Unidad,
  ocProductCostMap: Map<string, Map<string, number>>,
  ocCostBreakdownMap: Map<string, OCCostBreakdown>,
  fleteByUnitMap: Map<string, number>,
  fleteByProductMap: Map<string, number>,
  totalGAGOPEN: number,
  costoBaseTotalVendidas: number
): UnitCostLayers {
  const tc = getTC(u);
  const ocId = u.ordenCompraId || '';

  const originalCostUSD = ocProductCostMap.get(ocId)?.get(u.productoId) ?? u.costoUnitarioUSD;
  const breakdown = ocCostBreakdownMap.get(ocId);

  const impuestoUSD = breakdown?.impuestoPerUnit ?? 0;
  const envioUSD = breakdown?.envioPerUnit ?? 0;
  const otrosUSD = breakdown?.otrosPerUnit ?? 0;

  // Flete Internacional USA→Peru
  const fleteIntlUSD = fleteByUnitMap.get(u.id!) ?? u.costoFleteUSD ?? fleteByProductMap.get(u.productoId) ?? 0;

  // GA/GO: solo para unidades vendidas, SIEMPRE proporcional al costo base
  // Calculamos siempre en el store (no depender de ctruDinamico de Firestore)
  // para garantizar consistencia. El ctruDinamico puede estar desactualizado.
  const costoBase = getCostoBasePEN(u);
  const isVendida = u.estado === 'vendida';
  let gagoPEN = 0;
  if (isVendida && costoBaseTotalVendidas > 0 && totalGAGOPEN > 0) {
    gagoPEN = calcularGAGOProporcional(costoBase, costoBaseTotalVendidas, totalGAGOPEN);
  }

  // CTRU del store = costo base + GA/GO calculado (no de Firestore)
  const ctruCalc = costoBase + gagoPEN;

  return {
    compraUSD: originalCostUSD,
    compraPEN: originalCostUSD * tc,
    impuestoUSD,
    impuestoPEN: impuestoUSD * tc,
    envioUSD,
    envioPEN: envioUSD * tc,
    otrosUSD,
    otrosPEN: otrosUSD * tc,
    fleteIntlUSD,
    fleteIntlPEN: fleteIntlUSD * tc,
    gagoPEN,
    ctru: ctruCalc
  };
}

// ============================================
// PROCESSORS
// ============================================

function processProductosDetalle(
  todasUnidades: Unidad[],
  ventas: Venta[],
  todasOCs: OrdenCompra[],
  ocProductCostMap: Map<string, Map<string, number>>,
  ocCostBreakdownMap: Map<string, OCCostBreakdown>,
  fleteByUnitMap: Map<string, number>,
  fleteByProductMap: Map<string, number>,
  gastosByVentaId: Map<string, Gasto[]>,
  totalGAGOPEN: number,
  costoBaseTotalVendidas: number,
  gagoEstimadoProyectado: number,
  productosInfoMap: Map<string, Producto>
): CTRUProductoDetalle[] {
  // Incluir activas + vendidas (excluir vencida/danada)
  const unidadesRelevantes = todasUnidades.filter(u => RELEVANT_STATES.includes(u.estado));
  // Costo base total de TODAS las unidades relevantes (para vista gerencial)
  const costoBaseTotalTodas = unidadesRelevantes.reduce((sum, u) => sum + getCostoBasePEN(u), 0);

  const ocById = new Map(todasOCs.map(oc => [oc.id, oc]));

  // Agrupar unidades por producto
  const prodMap = new Map<string, {
    id: string; nombre: string; sku: string;
    compraUSD: number[]; compraPEN: number[];
    impuestoUSD: number[]; impuestoPEN: number[];
    envioUSD: number[]; envioPEN: number[];
    otrosUSD: number[]; otrosPEN: number[];
    fleteIntlUSD: number[]; fleteIntlPEN: number[];
    gagoPEN: number[]; gagoPENVendidas: number[]; gagoPENTodas: number[]; ctrus: number[];
    activas: number; vendidas: number;
    // Para lotes por producto
    unidadesPorOC: Map<string, Unidad[]>;
  }>();

  for (const u of unidadesRelevantes) {
    const layers = getUnitCostLayers(u, ocProductCostMap, ocCostBreakdownMap, fleteByUnitMap, fleteByProductMap, totalGAGOPEN, costoBaseTotalVendidas);
    if (!prodMap.has(u.productoId)) {
      prodMap.set(u.productoId, {
        id: u.productoId, nombre: u.productoNombre, sku: u.productoSKU,
        compraUSD: [], compraPEN: [],
        impuestoUSD: [], impuestoPEN: [],
        envioUSD: [], envioPEN: [],
        otrosUSD: [], otrosPEN: [],
        fleteIntlUSD: [], fleteIntlPEN: [],
        gagoPEN: [], gagoPENVendidas: [], gagoPENTodas: [], ctrus: [],
        activas: 0, vendidas: 0,
        unidadesPorOC: new Map()
      });
    }
    const p = prodMap.get(u.productoId)!;
    p.compraUSD.push(layers.compraUSD);
    p.compraPEN.push(layers.compraPEN);
    p.impuestoUSD.push(layers.impuestoUSD);
    p.impuestoPEN.push(layers.impuestoPEN);
    p.envioUSD.push(layers.envioUSD);
    p.envioPEN.push(layers.envioPEN);
    p.otrosUSD.push(layers.otrosUSD);
    p.otrosPEN.push(layers.otrosPEN);
    p.fleteIntlUSD.push(layers.fleteIntlUSD);
    p.fleteIntlPEN.push(layers.fleteIntlPEN);
    p.gagoPEN.push(layers.gagoPEN);
    if (u.estado === 'vendida') {
      p.gagoPENVendidas.push(layers.gagoPEN);
    }
    // GA/GO gerencial: prorrateo entre TODAS las unidades relevantes
    if (costoBaseTotalTodas > 0 && totalGAGOPEN > 0) {
      const costoBase = getCostoBasePEN(u);
      p.gagoPENTodas.push(calcularGAGOProporcional(costoBase, costoBaseTotalTodas, totalGAGOPEN));
    } else {
      p.gagoPENTodas.push(0);
    }
    p.ctrus.push(layers.ctru);

    if (ACTIVE_STATES.includes(u.estado)) {
      p.activas++;
    } else {
      p.vendidas++;
    }

    // Agrupar por OC para lotes
    if (u.ordenCompraId) {
      if (!p.unidadesPorOC.has(u.ordenCompraId)) p.unidadesPorOC.set(u.ordenCompraId, []);
      p.unidadesPorOC.get(u.ordenCompraId)!.push(u);
    }
  }

  const productos: CTRUProductoDetalle[] = [];

  for (const [, data] of prodMap) {
    const compraUSDProm = avg(data.compraUSD);
    const compraPENProm = avg(data.compraPEN);
    const impuestoUSDProm = avg(data.impuestoUSD);
    const impuestoPENProm = avg(data.impuestoPEN);
    const envioUSDProm = avg(data.envioUSD);
    const envioPENProm = avg(data.envioPEN);
    const otrosUSDProm = avg(data.otrosUSD);
    const otrosPENProm = avg(data.otrosPEN);
    const fleteIntlUSDProm = avg(data.fleteIntlUSD);
    const fleteIntlPENProm = avg(data.fleteIntlPEN);
    // GA/GO promedio SOLO de vendidas (sin diluir con ceros de activas)
    const gagoProm = data.gagoPENVendidas.length > 0 ? avg(data.gagoPENVendidas) : 0;

    // Costo inventario = capas 1-5
    const costoInventario = compraPENProm + impuestoPENProm + envioPENProm + otrosPENProm + fleteIntlPENProm;
    // CTRU Contable = capas 1-6 (GA/GO solo vendidas)
    const ctruCalc = costoInventario + gagoProm;
    // CTRU Gerencial = capas 1-6 (GA/GO todas las unidades)
    const gagoGerencialProm = data.gagoPENTodas.length > 0 ? avg(data.gagoPENTodas) : 0;
    const ctruGerencialCalc = costoInventario + gagoGerencialProm;

    // GV/GD y ventas
    const ventaInfo = getGVGDAndVentasForProduct(data.id, ventas, gastosByVentaId);
    const gvgdProm = ventaInfo.gvgdProm;

    // Costo total real = capas 1-7
    const costoTotalReal = ctruCalc + gvgdProm;

    const pctBase = costoTotalReal > 0 ? costoTotalReal : ctruCalc > 0 ? ctruCalc : 1;
    const pctCompra = safeDiv(compraPENProm, pctBase) * 100;
    const pctImpuesto = safeDiv(impuestoPENProm, pctBase) * 100;
    const pctEnvio = safeDiv(envioPENProm, pctBase) * 100;
    const pctOtros = safeDiv(otrosPENProm, pctBase) * 100;
    const pctFleteIntl = safeDiv(fleteIntlPENProm, pctBase) * 100;
    const pctGAGO = safeDiv(gagoProm, pctBase) * 100;
    const pctGVGD = safeDiv(gvgdProm, pctBase) * 100;

    const precioVenta = ventaInfo.precioVentaProm;
    const margenBruto = precioVenta > 0 ? safeDiv(precioVenta - ctruCalc, precioVenta) * 100 : 0;
    const margenNeto = precioVenta > 0 ? safeDiv(precioVenta - costoTotalReal, precioVenta) * 100 : 0;

    // Estado del producto
    const estadoProducto: 'activo' | 'vendido' | 'mixto' =
      data.activas > 0 && data.vendidas > 0 ? 'mixto' :
      data.activas > 0 ? 'activo' : 'vendido';

    // Lotes por OC
    const lotes: LoteProducto[] = [];
    for (const [ocId, units] of data.unidadesPorOC) {
      const oc = ocById.get(ocId);
      let fechaRec: Date | null = null;
      try {
        if (oc?.fechaRecibida) {
          fechaRec = toDate(oc.fechaRecibida);
        }
      } catch { /* skip */ }
      if (!fechaRec && units.length > 0) {
        fechaRec = toDate(units[0].fechaCreacion);
      }

      const tcProm = avg(units.map(u => getTC(u)));
      const costoUSDProm = avg(units.map(u => {
        const raw = ocProductCostMap.get(ocId)?.get(u.productoId) ?? u.costoUnitarioUSD;
        return raw;
      }));

      lotes.push({
        ordenCompraId: ocId,
        ordenCompraNumero: oc?.numeroOrden || units[0]?.ordenCompraNumero || 'N/A',
        fecha: fechaRec,
        cantidad: units.length,
        costoUnitarioUSD: costoUSDProm,
        costoUnitarioPEN: costoUSDProm * tcProm,
        tc: tcProm
      });
    }
    lotes.sort((a, b) => (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0));

    // Pricing
    const costoRefPricing = costoTotalReal > 0 ? costoTotalReal : ctruCalc;
    const pricing: PricingProducto = {
      costoInventario,
      ctru: ctruCalc,
      costoTotal: costoTotalReal,
      precioMinimo10: costoRefPricing / (1 - 0.10),
      precioMinimo20: costoRefPricing / (1 - 0.20),
      precioMinimo30: costoRefPricing / (1 - 0.30),
      precioActual: precioVenta,
      margenActual: margenNeto
    };

    const prodInfo = productosInfoMap.get(data.id);
    productos.push({
      productoId: data.id,
      productoNombre: data.nombre,
      productoSKU: data.sku,
      marca: prodInfo?.marca || '',
      presentacion: prodInfo?.presentacion || '',
      contenido: prodInfo?.contenido || '',
      dosaje: prodInfo?.dosaje || '',
      sabor: prodInfo?.sabor,
      lineaNegocioId: prodInfo?.lineaNegocioId,
      estadoProducto,
      unidadesActivas: data.activas,
      unidadesVendidas: data.vendidas,
      totalUnidades: data.activas + data.vendidas,
      costoCompraUSDProm: compraUSDProm,
      costoCompraPENProm: compraPENProm,
      costoImpuestoUSDProm: impuestoUSDProm,
      costoImpuestoPENProm: impuestoPENProm,
      costoEnvioUSDProm: envioUSDProm,
      costoEnvioPENProm: envioPENProm,
      costoOtrosUSDProm: otrosUSDProm,
      costoOtrosPENProm: otrosPENProm,
      costoFleteIntlUSDProm: fleteIntlUSDProm,
      costoFleteIntlPENProm: fleteIntlPENProm,
      gastoGAGOProm: gagoProm,
      gastoGAGOEstimado: data.vendidas === 0 ? gagoEstimadoProyectado : 0,
      gastoGVGDProm: gvgdProm,
      costoInventarioProm: costoInventario,
      ctruPromedio: ctruCalc,
      ctruContableProm: ctruCalc,
      ctruGerencialProm: ctruGerencialCalc,
      costoTotalRealProm: costoTotalReal,
      precioVentaProm: precioVenta,
      margenBrutoProm: margenBruto,
      margenNetoProm: margenNeto,
      ventasCount: ventaInfo.ventasCount,
      pctCompra, pctImpuesto, pctEnvio, pctOtros, pctFleteIntl, pctGAGO, pctGVGD,
      ctruMinimo: data.ctrus.length > 0 ? Math.min(...data.ctrus) : 0,
      ctruMaximo: data.ctrus.length > 0 ? Math.max(...data.ctrus) : 0,
      lotes,
      ventasDetalle: ventaInfo.ventasDetalle,
      pricing
    });
  }

  productos.sort((a, b) => b.ctruPromedio - a.ctruPromedio);
  return productos;
}

function getGVGDAndVentasForProduct(
  productoId: string,
  ventas: Venta[],
  gastosByVentaId: Map<string, Gasto[]>
): {
  gvgdProm: number;
  precioVentaProm: number;
  ventasCount: number;
  ventasDetalle: VentaProductoDetalle[];
} {
  const gvgdValues: number[] = [];
  const precioValues: number[] = [];
  const ventasDetalle: VentaProductoDetalle[] = [];

  for (const v of ventas) {
    const prod = v.productos?.find(p => p.productoId === productoId);
    if (!prod) continue;

    let gvgdTotal = v.gastosVentaPEN ?? (
      (v.costoEnvioNegocio || 0) +
      (v.comisionML || 0) +
      (v.costoEnvioML || 0) +
      (v.otrosGastosVenta || 0)
    );

    if (gvgdTotal === 0 && v.id) {
      const gastosVenta = gastosByVentaId.get(v.id) || [];
      gvgdTotal = gastosVenta.reduce((sum, g) => sum + g.montoPEN, 0);
    }

    const totalCantidad = v.productos.reduce((sum, p) => sum + p.cantidad, 0);
    const gvgdPorUnidad = safeDiv(gvgdTotal, totalCantidad);

    gvgdValues.push(gvgdPorUnidad);
    precioValues.push(prod.precioUnitario);

    // Costo unitario de las unidades asignadas
    const costoUnitario = prod.costoTotalUnidades && prod.cantidad > 0
      ? prod.costoTotalUnidades / prod.cantidad
      : 0;

    const margenBruto = prod.precioUnitario > 0 && costoUnitario > 0
      ? safeDiv(prod.precioUnitario - costoUnitario, prod.precioUnitario) * 100
      : 0;
    const margenNeto = prod.precioUnitario > 0 && costoUnitario > 0
      ? safeDiv(prod.precioUnitario - costoUnitario - gvgdPorUnidad, prod.precioUnitario) * 100
      : 0;

    ventasDetalle.push({
      ventaId: v.id,
      ventaNumero: v.numeroVenta,
      fecha: toDate(v.fechaCreacion),
      cliente: v.nombreCliente,
      cantidad: prod.cantidad,
      precioUnitario: prod.precioUnitario,
      costoUnitario,
      gvgdUnitario: gvgdPorUnidad,
      margenBruto,
      margenNeto
    });
  }

  ventasDetalle.sort((a, b) => (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0));

  return {
    gvgdProm: avg(gvgdValues),
    precioVentaProm: avg(precioValues),
    ventasCount: gvgdValues.length,
    ventasDetalle
  };
}

function processHistorialMensual(
  todasUnidades: Unidad[],
  todosGastos: Gasto[],
  ventas: Venta[],
  ocProductCostMap: Map<string, Map<string, number>>,
  ocCostBreakdownMap: Map<string, OCCostBreakdown>,
  fleteByUnitMap: Map<string, number>,
  fleteByProductMap: Map<string, number>,
  gastosByVentaId: Map<string, Gasto[]>
): HistorialCostosMes[] {
  const ahora = new Date();
  const entries: HistorialCostosMes[] = [];

  // Historial real: agrupar unidades por mes de recepcion (fechaCreacion)
  // y ventas por mes de venta
  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const mes = fecha.getMonth() + 1;
    const anio = fecha.getFullYear();
    const inicioMes = new Date(anio, mes - 1, 1);
    const finMes = new Date(anio, mes, 0, 23, 59, 59);

    // Unidades RECIBIDAS en este mes (por fecha de creacion/recepcion)
    const unidadesRecibidasMes = todasUnidades.filter(u => {
      if (u.estado === 'vencida' || u.estado === 'danada') return false;
      const fc = toDate(u.fechaCreacion);
      if (!fc) return false;
      return fc >= inicioMes && fc <= finMes;
    });

    // GA/GO para este mes — solo entre vendidas del mes, proporcional al costo base
    const gastosGAGOMes = todosGastos.filter(g =>
      g.mes === mes && g.anio === anio &&
      (g.categoria === 'GA' || g.categoria === 'GO')
    );
    const totalGAGOMes = gastosGAGOMes.reduce((sum, g) => sum + g.montoPEN, 0);
    // Costo base total de vendidas del mes (para prorrateo proporcional)
    const unidadesVendidasMes = todasUnidades.filter(u => {
      if (u.estado !== 'vendida') return false;
      const fv = toDate((u as any).fechaVenta || u.fechaCreacion);
      if (!fv) return false;
      return fv >= inicioMes && fv <= finMes;
    });
    const costoBaseTotalVendidasMes = unidadesVendidasMes.reduce((sum, u) => sum + getCostoBasePEN(u), 0);

    const compras: number[] = [];
    const impuestos: number[] = [];
    const envios: number[] = [];
    const otrosArr: number[] = [];
    const fletesIntl: number[] = [];
    const gagos: number[] = [];

    for (const u of unidadesRecibidasMes) {
      const layers = getUnitCostLayers(u, ocProductCostMap, ocCostBreakdownMap, fleteByUnitMap, fleteByProductMap, totalGAGOMes, costoBaseTotalVendidasMes);
      compras.push(layers.compraPEN);
      impuestos.push(layers.impuestoPEN);
      envios.push(layers.envioPEN);
      otrosArr.push(layers.otrosPEN);
      fletesIntl.push(layers.fleteIntlPEN);
      gagos.push(layers.gagoPEN);
    }

    // Ventas de este mes
    const ventasMes = ventas.filter(v => {
      const fv = toDate(v.fechaCreacion);
      if (!fv) return false;
      return fv >= inicioMes && fv <= finMes;
    });

    const gvgdValues: number[] = [];
    const precioValues: number[] = [];
    for (const v of ventasMes) {
      let gvgdTotal = v.gastosVentaPEN ?? (
        (v.costoEnvioNegocio || 0) + (v.comisionML || 0) +
        (v.costoEnvioML || 0) + (v.otrosGastosVenta || 0)
      );
      if (gvgdTotal === 0 && v.id) {
        const gastosVenta = gastosByVentaId.get(v.id) || [];
        gvgdTotal = gastosVenta.reduce((sum, g) => sum + g.montoPEN, 0);
      }
      const totalCant = v.productos.reduce((sum, p) => sum + p.cantidad, 0);
      const gvgdPU = safeDiv(gvgdTotal, totalCant);
      for (const p of v.productos) {
        gvgdValues.push(gvgdPU);
        precioValues.push(p.precioUnitario);
      }
    }

    const compraProm = avg(compras);
    const impuestoProm = avg(impuestos);
    const envioProm = avg(envios);
    const otrosProm = avg(otrosArr);
    const fleteIntlProm = avg(fletesIntl);
    const gagoProm = avg(gagos);
    const gvgdProm = avg(gvgdValues);
    const ctruProm = compraProm + impuestoProm + envioProm + otrosProm + fleteIntlProm + gagoProm;
    const costoTotalProm = ctruProm + gvgdProm;
    const ventaProm = avg(precioValues);
    const margenProm = ventaProm > 0 ? safeDiv(ventaProm - costoTotalProm, ventaProm) * 100 : 0;

    entries.push({
      mes, anio,
      label: MONTH_LABELS[mes - 1],
      costoCompraProm: compraProm,
      costoImpuestoProm: impuestoProm,
      costoEnvioProm: envioProm,
      costoOtrosProm: otrosProm,
      costoFleteIntlProm: fleteIntlProm,
      gastoGAGOProm: gagoProm,
      gastoGVGDProm: gvgdProm,
      ctruPromedio: ctruProm,
      costoTotalProm,
      precioVentaProm: ventaProm,
      margenProm,
      unidades: unidadesRecibidasMes.length,
      ventasCount: ventasMes.length
    });
  }

  return entries;
}

function processHistorialGastos(todosGastos: Gasto[]): HistorialGastosEntry[] {
  const ahora = new Date();
  const entries: HistorialGastosEntry[] = [];

  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const mes = fecha.getMonth() + 1;
    const anio = fecha.getFullYear();

    const gastosMes = todosGastos.filter(g => g.mes === mes && g.anio === anio);
    const GA = gastosMes.filter(g => g.categoria === 'GA').reduce((sum, g) => sum + g.montoPEN, 0);
    const GO = gastosMes.filter(g => g.categoria === 'GO').reduce((sum, g) => sum + g.montoPEN, 0);
    const GV = gastosMes.filter(g => g.categoria === 'GV').reduce((sum, g) => sum + g.montoPEN, 0);
    const GD = gastosMes.filter(g => g.categoria === 'GD').reduce((sum, g) => sum + g.montoPEN, 0);

    entries.push({
      mes, anio, label: MONTH_LABELS[mes - 1],
      GA, GO, GV, GD, total: GA + GO + GV + GD
    });
  }

  return entries;
}

function processLotesOC(
  todasUnidades: Unidad[],
  todasOCs: OrdenCompra[],
  ocProductCostMap: Map<string, Map<string, number>>,
  ocCostBreakdownMap: Map<string, OCCostBreakdown>,
  fleteByUnitMap: Map<string, number>,
  fleteByProductMap: Map<string, number>,
  totalGAGOPEN: number,
  costoBaseTotalVendidas: number
): LoteOCDetalle[] {
  // Incluir activas + vendidas
  const relevantUnits = todasUnidades.filter(u => RELEVANT_STATES.includes(u.estado));
  const ocMap = new Map<string, Unidad[]>();

  for (const u of relevantUnits) {
    if (!u.ordenCompraId) continue;
    if (!ocMap.has(u.ordenCompraId)) ocMap.set(u.ordenCompraId, []);
    ocMap.get(u.ordenCompraId)!.push(u);
  }

  const ocById = new Map(todasOCs.map(oc => [oc.id, oc]));
  const lotes: LoteOCDetalle[] = [];

  for (const [ocId, units] of ocMap) {
    const oc = ocById.get(ocId);
    const compraUSDs: number[] = [];
    const compraPENs: number[] = [];
    const impuestoUSDs: number[] = [];
    const impuestoPENs: number[] = [];
    const envioUSDs: number[] = [];
    const envioPENs: number[] = [];
    const otrosUSDs: number[] = [];
    const otrosPENs: number[] = [];
    const fleteIntlUSDs: number[] = [];
    const fleteIntlPENs: number[] = [];
    const gagos: number[] = [];
    const ctrus: number[] = [];

    const prodMap = new Map<string, {
      nombre: string; sku: string; ctrus: number[];
      costoUSD: number[];
    }>();

    for (const u of units) {
      const layers = getUnitCostLayers(u, ocProductCostMap, ocCostBreakdownMap, fleteByUnitMap, fleteByProductMap, totalGAGOPEN, costoBaseTotalVendidas);
      compraUSDs.push(layers.compraUSD);
      compraPENs.push(layers.compraPEN);
      impuestoUSDs.push(layers.impuestoUSD);
      impuestoPENs.push(layers.impuestoPEN);
      envioUSDs.push(layers.envioUSD);
      envioPENs.push(layers.envioPEN);
      otrosUSDs.push(layers.otrosUSD);
      otrosPENs.push(layers.otrosPEN);
      fleteIntlUSDs.push(layers.fleteIntlUSD);
      fleteIntlPENs.push(layers.fleteIntlPEN);
      gagos.push(layers.gagoPEN);
      ctrus.push(layers.ctru);

      if (!prodMap.has(u.productoId)) {
        prodMap.set(u.productoId, {
          nombre: u.productoNombre, sku: u.productoSKU,
          ctrus: [], costoUSD: []
        });
      }
      const p = prodMap.get(u.productoId)!;
      p.ctrus.push(layers.ctru);
      p.costoUSD.push(layers.compraUSD);
    }

    const compraPENProm = avg(compraPENs);
    const impuestoPENProm = avg(impuestoPENs);
    const envioPENProm = avg(envioPENs);
    const otrosPENProm = avg(otrosPENs);
    const fleteIntlPENProm = avg(fleteIntlPENs);
    const gagoProm = avg(gagos);
    const total = compraPENProm + impuestoPENProm + envioPENProm + otrosPENProm + fleteIntlPENProm + gagoProm;

    let fechaRec: Date | null = null;
    try {
      if (oc?.fechaRecibida) {
        fechaRec = toDate(oc.fechaRecibida);
      }
    } catch { /* skip */ }

    lotes.push({
      ordenCompraId: ocId,
      ordenCompraNumero: oc?.numeroOrden || units[0]?.ordenCompraNumero || 'N/A',
      proveedorNombre: oc?.nombreProveedor || 'Desconocido',
      fechaRecepcion: fechaRec,
      tcCompra: oc?.tcCompra || units[0]?.tcCompra || 0,
      tcPago: oc?.tcPago || units[0]?.tcPago || 0,
      totalUnidades: units.length,
      costoCompraUSDProm: avg(compraUSDs),
      costoCompraPENProm: compraPENProm,
      costoImpuestoUSDProm: avg(impuestoUSDs),
      costoImpuestoPENProm: impuestoPENProm,
      costoEnvioUSDProm: avg(envioUSDs),
      costoEnvioPENProm: envioPENProm,
      costoOtrosUSDProm: avg(otrosUSDs),
      costoOtrosPENProm: otrosPENProm,
      costoFleteIntlUSDProm: avg(fleteIntlUSDs),
      costoFleteIntlPENProm: fleteIntlPENProm,
      gastoGAGOProm: gagoProm,
      ctruPromedio: avg(ctrus),
      pctCompra: safeDiv(compraPENProm, total) * 100,
      pctImpuesto: safeDiv(impuestoPENProm, total) * 100,
      pctEnvio: safeDiv(envioPENProm, total) * 100,
      pctOtros: safeDiv(otrosPENProm, total) * 100,
      pctFleteIntl: safeDiv(fleteIntlPENProm, total) * 100,
      pctGAGO: safeDiv(gagoProm, total) * 100,
      productos: Array.from(prodMap.entries()).map(([pid, data]) => ({
        productoId: pid,
        productoNombre: data.nombre,
        productoSKU: data.sku,
        cantidad: data.ctrus.length,
        costoUnitarioUSD: avg(data.costoUSD),
        ctruPromedio: avg(data.ctrus)
      }))
    });
  }

  lotes.sort((a, b) => (b.fechaRecepcion?.getTime() || 0) - (a.fechaRecepcion?.getTime() || 0));
  return lotes;
}

function processResumen(
  productos: CTRUProductoDetalle[],
  historial: HistorialCostosMes[],
  todasUnidades: Unidad[]
): CTRUResumenV2 {
  const relevantes = todasUnidades.filter(u => RELEVANT_STATES.includes(u.estado));
  const activas = todasUnidades.filter(u => ACTIVE_STATES.includes(u.estado));
  const vendidas = todasUnidades.filter(u => u.estado === 'vendida');

  let totalCompraUSD = 0;
  let totalUnidades = 0;
  for (const p of productos) {
    totalCompraUSD += p.costoCompraUSDProm * p.totalUnidades;
    totalUnidades += p.totalUnidades;
  }

  let totalCTRU = 0;
  for (const u of relevantes) {
    totalCTRU += getCTRU(u);
  }

  const conVentas = productos.filter(p => p.ventasCount > 0);
  const margenProm = conVentas.length > 0 ? avg(conVentas.map(p => p.margenNetoProm)) : 0;

  const productosActivos = productos.filter(p => p.estadoProducto !== 'vendido');

  return {
    costoCompraPromedioUSD: safeDiv(totalCompraUSD, totalUnidades),
    ctruPromedioPEN: safeDiv(totalCTRU, relevantes.length),
    margenPromedioPercent: margenProm,
    totalUnidadesActivas: activas.length,
    totalUnidadesVendidas: vendidas.length,
    totalProductos: productos.length,
    totalProductosActivos: productosActivos.length,
    totalVentasAnalizadas: productos.reduce((sum, p) => sum + p.ventasCount, 0),
    tendenciaCostoCompra: historial.map(h => h.costoCompraProm),
    tendenciaCTRU: historial.map(h => h.ctruPromedio),
    tendenciaMargen: historial.map(h => h.margenProm)
  };
}

// ============================================
// STORE
// ============================================

export const useCTRUStore = create<CTRUState>((set, get) => ({
  resumen: null,
  productosDetalle: [],
  historialMensual: [],
  historialGastos: [],
  lotesOC: [],
  tcpa: 0,
  loading: false,
  error: null,

  fetchAll: async () => {
    // Prevent concurrent duplicate fetches (e.g., two components mounting simultaneously)
    if (_fetchAllInProgress) return;
    // Skip re-fetch if data was loaded less than 5 minutes ago
    if (Date.now() - _lastFetchAt < FETCH_TTL_MS && get().resumen !== null) return;
    _fetchAllInProgress = true;

    set({ loading: true, error: null });
    try {
      await timed('ctruStore.fetchAll', async () => {
      // Phase 1: units + transferencias + products — run in parallel.
      // Units use a not-in filter to exclude 'vencida' and 'danada' at the DB level
      // (typical savings: 20-40 % of unit documents on mature datasets).
      const [todasUnidades, todasTransferencias, todosProductos, poolResumen] = await Promise.all([
        fetchUnidadesParaCTRU(),
        transferenciaService.getByFiltros({ tipo: 'usa_peru' }),
        ProductoService.getAll(true, Infinity),
        poolUSDService.getResumen().catch(() => ({ tcpa: 0 }))
      ]);
      const tcpaActual = poolResumen.tcpa || 0;

      // Phase 2: gastos, OCs, and ventas — scoped to what is actually needed.
      // Gastos: only GA/GO/GV/GD categories (other types have no CTRU impact).
      // OCs: only the subset referenced by the loaded units — avoids full collection scan.
      // Ventas: only the 5 active delivery states — skips cancelled/draft records.
      const [todosGastos, todasOCs, ventasValidas] = await Promise.all([
        fetchGastosParaCTRU(),
        fetchOCsParaCTRU(todasUnidades),
        fetchVentasParaCTRU()
      ]);

      // Units arriving here already exclude vencida/danada — no client-side filter needed.
      // Ventas arriving here already match VENTA_STATES — no client-side filter needed.

      // ---- Lookup Maps ----

      const ocProductCostMap = new Map<string, Map<string, number>>();
      const ocCostBreakdownMap = new Map<string, OCCostBreakdown>();
      for (const oc of todasOCs) {
        const prodMap = new Map<string, number>();
        for (const p of oc.productos) {
          prodMap.set(p.productoId, p.costoUnitario);
        }
        ocProductCostMap.set(oc.id!, prodMap);

        const totalUnidades = oc.productos.reduce((sum, p) => sum + p.cantidad, 0);
        if (totalUnidades > 0) {
          ocCostBreakdownMap.set(oc.id!, {
            impuestoPerUnit: (oc.impuestoCompraUSD ?? oc.impuestoUSD ?? 0) / totalUnidades,
            envioPerUnit: (oc.costoEnvioProveedorUSD ?? oc.gastosEnvioUSD ?? 0) / totalUnidades,
            otrosPerUnit: (oc.otrosGastosCompraUSD ?? oc.otrosGastosUSD ?? 0) / totalUnidades
          });
        }
      }

      // Flete maps
      const fleteByUnitMap = new Map<string, number>();
      const fleteByProductAccum = new Map<string, { sum: number; count: number }>();
      for (const t of todasTransferencias) {
        if (t.estado !== 'recibida_completa' && t.estado !== 'recibida_parcial') continue;
        for (const ut of t.unidades) {
          if (ut.costoFleteUSD > 0 && ut.estadoTransferencia === 'recibida') {
            fleteByUnitMap.set(ut.unidadId, ut.costoFleteUSD);
            const acc = fleteByProductAccum.get(ut.productoId) || { sum: 0, count: 0 };
            acc.sum += ut.costoFleteUSD;
            acc.count += 1;
            fleteByProductAccum.set(ut.productoId, acc);
          }
        }
      }
      const fleteByProductMap = new Map<string, number>();
      for (const [prodId, acc] of fleteByProductAccum) {
        fleteByProductMap.set(prodId, acc.sum / acc.count);
      }

      // GV/GD por venta
      const gastosByVentaId = new Map<string, Gasto[]>();
      for (const g of todosGastos) {
        if (g.ventaId && (g.categoria === 'GV' || g.categoria === 'GD')) {
          if (!gastosByVentaId.has(g.ventaId)) gastosByVentaId.set(g.ventaId, []);
          gastosByVentaId.get(g.ventaId)!.push(g);
        }
      }

      // GA/GO — total y costo base de vendidas para prorrateo proporcional
      const gastosGAGO = todosGastos.filter(g =>
        g.categoria === 'GA' || g.categoria === 'GO'
      );
      const totalGAGOPEN = gastosGAGO.reduce((sum, g) => sum + g.montoPEN, 0);
      const unidadesVendidasAll = todasUnidades.filter(u => u.estado === 'vendida');
      // Costo base total de TODAS las unidades vendidas (para prorrateo proporcional)
      const costoBaseTotalVendidas = unidadesVendidasAll.reduce((sum, u) => sum + getCostoBasePEN(u), 0);
      // Costo base total de TODAS las unidades relevantes (para vista gerencial)
      const unidadesRelevantesAll = todasUnidades.filter(u => RELEVANT_STATES.includes(u.estado));
      const costoBaseTotalTodas = unidadesRelevantesAll.reduce((sum, u) => sum + getCostoBasePEN(u), 0);
      // Estimado proyectado para productos sin ventas (uniforme como referencia)
      const relevantesCount = todasUnidades.filter(u => RELEVANT_STATES.includes(u.estado)).length;
      const gagoEstimadoProyectado = unidadesVendidasAll.length > 0
        ? totalGAGOPEN / unidadesVendidasAll.length
        : relevantesCount > 0 ? totalGAGOPEN / relevantesCount : 0;

      // ---- Productos info map ----
      const productosInfoMap = new Map<string, Producto>(todosProductos.map(p => [p.id, p]));

      // ---- Process ----

      const productosDetalle = processProductosDetalle(
        todasUnidades, ventasValidas, todasOCs, ocProductCostMap, ocCostBreakdownMap,
        fleteByUnitMap, fleteByProductMap, gastosByVentaId, totalGAGOPEN, costoBaseTotalVendidas, gagoEstimadoProyectado,
        productosInfoMap
      );
      const historialMensual = processHistorialMensual(
        todasUnidades, todosGastos, ventasValidas, ocProductCostMap, ocCostBreakdownMap,
        fleteByUnitMap, fleteByProductMap, gastosByVentaId
      );
      const historialGastos = processHistorialGastos(todosGastos);
      const lotesOC = processLotesOC(
        todasUnidades, todasOCs, ocProductCostMap, ocCostBreakdownMap,
        fleteByUnitMap, fleteByProductMap, totalGAGOPEN, costoBaseTotalVendidas
      );
      const resumen = processResumen(productosDetalle, historialMensual, todasUnidades);

      _lastFetchAt = Date.now();
      set({
        resumen, productosDetalle, historialMensual, historialGastos, lotesOC,
        tcpa: tcpaActual,
        loading: false
      });
      }); // fin timed('ctruStore.fetchAll')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, loading: false });
    } finally {
      _fetchAllInProgress = false;
    }
  },

  recalcularCTRU: async () => {
    _lastFetchAt = 0; // Force re-fetch after recalculation
    try {
      const resultado = await ctruService.recalcularCTRUDinamicoSafe();
      await get().fetchAll();
      if (!resultado) {
        return { unidadesActualizadas: 0, gastosAplicados: 0, impactoPorUnidad: 0 };
      }
      return resultado;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message });
      throw error;
    }
  }
}));
