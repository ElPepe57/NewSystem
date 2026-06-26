/**
 * panelDecision.helper · F4 · Capa de MEDICIÓN #4 de Requerimientos — núcleo PURO.
 *
 * Computa el modelo de display del Panel Recomendador del modal de aprobación:
 * 2 EJES (DEMANDA por lente × CAJA universal) → un VEREDICTO no-binding.
 * "El sistema recomienda, no manda": el veredicto informa, NUNCA bloquea el botón Aprobar.
 *
 * Es una función PURA (sin I/O): recibe los datos YA ENSAMBLADOS por el wiring
 * (restock desde productoIntel · demanda desde la cotización · caja desde tesorería)
 * y devuelve el modelo que el componente renderiza. 100% testeable.
 *
 * Heurística del veredicto y umbrales de margen = decisión de producto (refinable).
 */
import type { Requerimiento, DriverDemanda } from '../../types/requerimiento.types';
import type { UrgenciaReorden } from '../../services/stockReorden.helper';
import type { ClasificacionRotacion } from '../../types/productoIntel.types';

export type LenteDecision = 'restock' | 'apuesta' | 'manual' | 'demanda_comprometida';
export type NivelVeredicto = 'recomendado' | 'revisar' | 'precaucion';
export type SaludMargen = 'sano' | 'flaco' | 'negativo';

/** Datos de la lente RESTOCK · subconjunto de AlertaReposicion (lo ensambla el wiring desde productoIntel). */
export interface RestockLensInput {
  puntoReorden: number;
  stockNeto: number;
  diasCobertura: number;
  velocidadDiaria: number;
  leadTimeDias: number;
  stockSeguridad: number;
  urgencia: UrgenciaReorden;
  razon: string;
  cantidadSugerida: number;
  necesitaReposicion: boolean;
}

/** Contexto de rotación del producto probado (lente MANUAL · desde productoIntel). */
export interface RotacionContexto {
  velocidadDiaria: number;
  clasificacionRotacion: ClasificacionRotacion;
  diasCobertura: number;
}

/** Datos de la cotización para DEMANDA COMPROMETIDA (lo ensambla el wiring desde la cotización). */
export interface DemandaComprometidaInput {
  clienteNombre?: string;
  cotizacionId?: string;
  cotizacionNumero?: string;
  adelantoMontoPEN?: number;
  adelantoPagado: boolean;
}

export interface PanelDecisionInput {
  req: Requerimiento;
  /** Saldo de caja consolidado (PEN) desde tesorería · null si no se pudo leer. */
  cajaDisponiblePEN: number | null;
  restock?: RestockLensInput;
  rotacion?: RotacionContexto;
  demanda?: DemandaComprometidaInput;
  /** Captura inline (apuesta/manual · producto primario) · pisa lo del req. */
  precioVentaPENOverride?: number;
  /** Captura inline (manual) · pisa lo del req. */
  driverOverride?: DriverDemanda;
}

export interface MargenEstimado {
  tieneVenta: boolean;        // hay precio de venta capturado
  landedUnitPEN: number;      // costo puesto en almacén por unidad
  precioVentaPEN: number;
  utilidadUnitPEN: number;
  margenPct: number;          // % sobre el precio de venta
  breakEvenUds: number;       // uds a vender (a precio) para cubrir el costo total del lote
  cantidadLote: number;       // unidades del lote (para contexto del break-even)
  salud: SaludMargen;
}

export interface CajaContexto {
  disponiblePEN: number | null;
  esteReqPEN: number;
  estado: 'dentro' | 'precaucion' | 'desconocido';
}

export interface Veredicto {
  nivel: NivelVeredicto;
  motivo: string;
}

export interface PanelDecision {
  lente: LenteDecision;
  veredicto: Veredicto;
  caja: CajaContexto;
  restock?: RestockLensInput;
  margen?: MargenEstimado;
  rotacion?: RotacionContexto;
  demanda?: DemandaComprometidaInput;
  driver?: DriverDemanda;
}

// ── Umbrales (heurística · refinable con el usuario) ─────────────────────────
const MARGEN_SANO_PCT = 25;   // ≥25% = sano
const TC_FALLBACK = 3.7;      // si el req no trae TC de investigación (degradado · raro)

/** Resuelve qué lente aplica según el origen/subtipo del requerimiento. */
export function resolverLente(req: Pick<Requerimiento, 'origen' | 'subtipo'>): LenteDecision {
  if (req.origen === 'demanda_comprometida') return 'demanda_comprometida';
  if (req.subtipo === 'restock') return 'restock';
  if (req.subtipo === 'apuesta') return 'apuesta';
  return 'manual'; // administrativo sin subtipo o subtipo='manual'
}

function totalUnidades(req: Requerimiento): number {
  return req.productos.reduce((s, p) => s + (p.cantidadSolicitada || 0), 0);
}

/** Margen estimado del producto PRIMARIO del req (apuesta/manual suelen ser 1 producto). */
export function calcularMargen(
  req: Requerimiento,
  precioVentaOverride?: number,
): MargenEstimado | undefined {
  const prod = req.productos[0];
  if (!prod) return undefined;

  const tc = req.expectativa?.tcInvestigacion && req.expectativa.tcInvestigacion > 0
    ? req.expectativa.tcInvestigacion
    : TC_FALLBACK;

  const precioVentaPEN = precioVentaOverride ?? prod.precioVentaPEN ?? 0;
  const costoUSDUnit = prod.precioEstimadoUSD ?? 0;

  // Prorrateo del impuesto+flete del req por unidad (la expectativa es a nivel req).
  const totalU = totalUnidades(req) || 1;
  const extrasUSD = (req.expectativa?.impuestoEstimadoUSD ?? 0) + (req.expectativa?.fleteEstimadoUSD ?? 0);
  const landedUnitUSD = costoUSDUnit + extrasUSD / totalU;
  const landedUnitPEN = landedUnitUSD * tc;

  const tieneVenta = precioVentaPEN > 0;
  const utilidadUnitPEN = tieneVenta ? precioVentaPEN - landedUnitPEN : 0;
  const margenPct = tieneVenta && precioVentaPEN > 0 ? (utilidadUnitPEN / precioVentaPEN) * 100 : 0;
  const cantidadLote = prod.cantidadSolicitada || 0;
  const breakEvenUds = tieneVenta && precioVentaPEN > 0
    ? Math.ceil((landedUnitPEN * cantidadLote) / precioVentaPEN)
    : 0;

  const salud: SaludMargen = !tieneVenta
    ? 'flaco'
    : utilidadUnitPEN < 0
      ? 'negativo'
      : margenPct >= MARGEN_SANO_PCT
        ? 'sano'
        : 'flaco';

  return {
    tieneVenta,
    landedUnitPEN: round2(landedUnitPEN),
    precioVentaPEN: round2(precioVentaPEN),
    utilidadUnitPEN: round2(utilidadUnitPEN),
    margenPct: round2(margenPct),
    breakEvenUds,
    cantidadLote,
    salud,
  };
}

/** Costo total estimado del req en PEN (para el eje caja). */
export function esteReqPEN(req: Requerimiento): number {
  if (req.expectativa?.costoTotalEstimadoPEN && req.expectativa.costoTotalEstimadoPEN > 0) {
    return round2(req.expectativa.costoTotalEstimadoPEN);
  }
  const tc = req.expectativa?.tcInvestigacion && req.expectativa.tcInvestigacion > 0
    ? req.expectativa.tcInvestigacion
    : TC_FALLBACK;
  const usd = req.productos.reduce((s, p) => s + (p.precioEstimadoUSD ?? 0) * (p.cantidadSolicitada || 0), 0);
  return round2(usd * tc);
}

function calcularCaja(req: Requerimiento, disponible: number | null): CajaContexto {
  const este = esteReqPEN(req);
  if (disponible == null) return { disponiblePEN: null, esteReqPEN: este, estado: 'desconocido' };
  return { disponiblePEN: round2(disponible), esteReqPEN: este, estado: este > disponible ? 'precaucion' : 'dentro' };
}

function calcularVeredicto(
  lente: LenteDecision,
  input: PanelDecisionInput,
  margen: MargenEstimado | undefined,
  caja: CajaContexto,
): Veredicto {
  let base: NivelVeredicto;
  let motivo: string;

  switch (lente) {
    case 'demanda_comprometida':
      base = 'recomendado';
      motivo = input.demanda?.adelantoPagado
        ? 'Demanda real · adelanto pagado'
        : 'Demanda comprometida del cliente';
      break;
    case 'restock':
      if (input.restock?.necesitaReposicion) {
        base = 'recomendado';
        motivo = 'Bajo el punto de reorden · señal de stock real';
      } else {
        base = 'revisar';
        motivo = 'Sin señal de reorden activa · validar la necesidad';
      }
      break;
    case 'apuesta':
      if (margen?.tieneVenta && margen.salud === 'negativo') {
        base = 'precaucion';
        motivo = 'Margen estimado negativo · revisar la apuesta';
      } else {
        base = 'revisar';
        motivo = 'Apuesta · demanda incierta · la tesis define el riesgo';
      }
      break;
    case 'manual':
    default:
      if (margen?.salud === 'negativo') {
        base = 'precaucion';
        motivo = 'Margen negativo';
      } else if (input.rotacion && (input.rotacion.clasificacionRotacion === 'muy_alta' || input.rotacion.clasificacionRotacion === 'alta')) {
        base = 'recomendado';
        motivo = 'Producto probado · alta rotación';
      } else {
        base = 'revisar';
        motivo = 'Decisión manual · validar la tesis';
      }
      break;
  }

  // El eje CAJA hace override a la baja: si excede la caja, es precaución (pero nunca bloquea).
  if (caja.estado === 'precaucion') {
    return { nivel: 'precaucion', motivo: `Excede la caja disponible · ${motivo}` };
  }
  return { nivel: base, motivo };
}

/** Cómputo principal · ensambla el modelo de display del panel a partir de los inputs. */
export function computePanelDecision(input: PanelDecisionInput): PanelDecision {
  const lente = resolverLente(input.req);
  const caja = calcularCaja(input.req, input.cajaDisponiblePEN);
  const necesitaMargen = lente === 'apuesta' || lente === 'manual';
  const margen = necesitaMargen ? calcularMargen(input.req, input.precioVentaPENOverride) : undefined;
  const veredicto = calcularVeredicto(lente, input, margen, caja);

  return {
    lente,
    veredicto,
    caja,
    restock: lente === 'restock' ? input.restock : undefined,
    margen,
    rotacion: lente === 'manual' ? input.rotacion : undefined,
    demanda: lente === 'demanda_comprometida' ? input.demanda : undefined,
    driver: input.driverOverride ?? input.req.driverDemanda,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
