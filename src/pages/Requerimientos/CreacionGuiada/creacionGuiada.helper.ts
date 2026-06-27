/**
 * creacionGuiada.helper · F4+ · Creación guiada por recomendaciones — núcleo PURO.
 *
 * La sección más grande del módulo: el modal "Nuevo requerimiento" pasa de un
 * buscador en blanco a "recomendación primero · 4 modos". Este helper concentra
 * la lógica PURA (sin I/O ni JSX) que cada modo consume:
 *
 *   1. El CANDADO de investigación (apuesta): un producto NUEVO no se puede
 *      apostar sin investigación mínima (≥1 proveedor + ≥1 competidor).
 *   2. La selección de CANDIDATOS investigados para el modo Apuesta.
 *   3. El STRIP banking-grade (Valor · Margen proyectado · Impacto en caja),
 *      derivado de la selección viva del modo activo. Reusa `calcularMargen`
 *      del panelDecision.helper (fuente única del margen).
 *   4. El mapeo MODO → RequerimientoFormData (origen/subtipo correctos) para el
 *      create, reusando el service de creación existente.
 *
 * 100% testeable. Heurística de margen/umbrales = la del panelDecision.helper.
 */
import type { Producto, InvestigacionMercado } from '../../../types/producto.types';
import type {
  Requerimiento,
  RequerimientoFormData,
  DriverDemanda,
} from '../../../types/requerimiento.types';
import { calcularMargen } from '../panelDecision.helper';
import type { SugerenciaStock } from '../requerimientos.types';

/** Los 4 modos del modal (segmented selector · acto 2). */
export type ModoCreacion = 'restock' | 'apuesta' | 'manual' | 'comprometida';

// ── CANDADO DE INVESTIGACIÓN (apuesta · acto 5) ───────────────────────────

export interface EstadoCandado {
  /** true = el producto tiene investigación mínima para poder apostarse. */
  habilitado: boolean;
  numProveedores: number;
  numCompetidores: number;
  /** false = producto ya probado / con historial · el candado no aplica. */
  esNuevo: boolean;
}

const MIN_PROVEEDORES = 1;
const MIN_COMPETIDORES = 1;

/**
 * Evalúa el candado de un producto para el modo Apuesta.
 * Un producto NUEVO (sin compras / sin stock histórico) requiere investigación
 * mínima: ≥1 proveedor USA + ≥1 competidor Perú. Productos ya probados pasan sin
 * candado (el restock de lo conocido no exige investigación de mercado).
 */
export function evaluarCandado(producto: Producto): EstadoCandado {
  const inv = producto.investigacion;
  const numProveedores = inv?.proveedoresUSA?.length ?? 0;
  const numCompetidores = inv?.competidoresPeru?.length ?? 0;

  // "Nuevo" = sin movimiento real (sin CMV promedio ni stock total).
  const stockTotal = (producto.stockPeru ?? 0) + (producto.stockUSA ?? 0) + (producto.stockTransito ?? 0);
  const esNuevo = (producto.ctruPromedio ?? 0) <= 0 && stockTotal <= 0;

  // Productos probados no requieren candado.
  if (!esNuevo) {
    return { habilitado: true, numProveedores, numCompetidores, esNuevo };
  }

  const habilitado = numProveedores >= MIN_PROVEEDORES && numCompetidores >= MIN_COMPETIDORES;
  return { habilitado, numProveedores, numCompetidores, esNuevo };
}

// ── CANDIDATOS DE APUESTA (acto 3) ────────────────────────────────────────

export interface CandidatoApuesta {
  producto: Producto;
  candado: EstadoCandado;
  /** Datos de investigación legibles para la card (rango proveedores/competencia). */
  proveedorMinUSD?: number;
  proveedorMaxUSD?: number;
  competidorMinPEN?: number;
  competidorMaxPEN?: number;
  margenEstimadoPct?: number;
}

/**
 * Selecciona los productos NUEVOS con investigación cumplida (candado abierto)
 * que aún no han sido apostados (no tienen un requerimiento subtipo=apuesta vivo).
 * Estos son los candidatos que la lista del modo Apuesta muestra primero.
 */
export function seleccionarCandidatosApuesta(
  productos: Producto[],
  requerimientos: Requerimiento[],
): CandidatoApuesta[] {
  const yaApostados = new Set(
    requerimientos
      .filter((r) => r.subtipo === 'apuesta' && r.estado !== 'cancelado' && r.estado !== 'rechazado')
      .flatMap((r) => r.productos.map((p) => p.productoId)),
  );

  return productos
    .filter((p) => p.estado === 'activo' && !yaApostados.has(p.id))
    .map((producto): CandidatoApuesta => {
      const candado = evaluarCandado(producto);
      return { producto, candado, ...resumenInvestigacion(producto.investigacion) };
    })
    .filter((c) => c.candado.esNuevo && c.candado.habilitado)
    .sort((a, b) => (b.margenEstimadoPct ?? 0) - (a.margenEstimadoPct ?? 0));
}

function resumenInvestigacion(inv?: InvestigacionMercado): Partial<CandidatoApuesta> {
  if (!inv) return {};
  const proveedorMinUSD = inv.precioUSAMin || undefined;
  const proveedorMaxUSD = inv.precioUSAMax || undefined;
  const competidorMinPEN = inv.precioPERUMin || undefined;
  const competidorMaxPEN = inv.precioPERUMax || undefined;
  // Margen estimado: contra el precio de competencia promedio vs costo proveedor promedio.
  let margenEstimadoPct: number | undefined;
  if (inv.precioPERUPromedio > 0 && inv.precioUSAPromedio > 0) {
    // Costo proveedor en PEN aproximado (TC fallback). El margen real lo recalcula el strip con TC.
    const costoAprox = inv.precioUSAPromedio * 3.7;
    margenEstimadoPct = Math.round(((inv.precioPERUPromedio - costoAprox) / inv.precioPERUPromedio) * 100);
  }
  return { proveedorMinUSD, proveedorMaxUSD, competidorMinPEN, competidorMaxPEN, margenEstimadoPct };
}

// ── STRIP BANKING-GRADE (header del modal · acto 2 líneas ~178-201) ───────

export interface StripBancario {
  /** Costo de PRODUCTO (no landed) en USD del/los ítem(s) seleccionado(s). */
  valorUSD: number;
  valorPEN: number;
  /** Margen proyectado (%) si hay precio de venta · undefined = sin dato. */
  margenPct?: number;
  /** Impacto en caja: % del costo PEN vs caja disponible · undefined = caja desconocida. */
  impactoCajaPct?: number;
  entra: boolean;
  cajaDisponiblePEN: number | null;
}

/**
 * Computa el strip de 3 KPIs de decisión a partir de un req EFÍMERO (lo que se
 * está armando en el modo activo) + el TC + la caja. El req efímero se construye
 * con `buildReqEfimero` para reusar `calcularMargen`/`esteReqPEN` (fuente única).
 */
export function computeStrip(
  reqEfimero: Requerimiento,
  tcVenta: number,
  cajaDisponiblePEN: number | null,
  precioVentaOverride?: number,
): StripBancario {
  const valorUSD = reqEfimero.productos.reduce(
    (s, p) => s + (p.precioEstimadoUSD ?? 0) * (p.cantidadSolicitada || 0),
    0,
  );
  const valorPEN = round2(valorUSD * tcVenta);

  const margen = calcularMargen(reqEfimero, precioVentaOverride);
  const margenPct = margen?.tieneVenta ? margen.margenPct : undefined;

  let impactoCajaPct: number | undefined;
  let entra = true;
  if (cajaDisponiblePEN != null && cajaDisponiblePEN > 0) {
    impactoCajaPct = round1((valorPEN / cajaDisponiblePEN) * 100);
    entra = valorPEN <= cajaDisponiblePEN;
  } else if (cajaDisponiblePEN != null && cajaDisponiblePEN <= 0) {
    entra = valorPEN === 0;
  }

  return { valorUSD: round2(valorUSD), valorPEN, margenPct, impactoCajaPct, entra, cajaDisponiblePEN };
}

/**
 * Arma un Requerimiento EFÍMERO (en memoria · no persistido) a partir de unas
 * líneas de producto + un TC. Sirve para alimentar `computeStrip`/`calcularMargen`
 * sin tener que persistir nada · NO se escribe en Firestore.
 */
export function buildReqEfimero(
  lineas: { precioEstimadoUSD?: number; precioVentaPEN?: number; cantidadSolicitada: number }[],
  tcVenta: number,
): Requerimiento {
  const costoUSD = lineas.reduce((s, l) => s + (l.precioEstimadoUSD ?? 0) * (l.cantidadSolicitada || 0), 0);
  return {
    id: '__efimero__',
    numeroRequerimiento: '',
    origen: 'administrativo',
    estado: 'pendiente',
    prioridad: 'media',
    productos: lineas.map((l) => ({
      productoId: '',
      sku: '',
      marca: '',
      nombreComercial: '',
      cantidadSolicitada: l.cantidadSolicitada,
      cantidadAsignada: 0,
      cantidadRecibida: 0,
      cantidadPendiente: l.cantidadSolicitada,
      cantidadEnOC: 0,
      pendienteCompra: l.cantidadSolicitada,
      precioEstimadoUSD: l.precioEstimadoUSD,
      precioVentaPEN: l.precioVentaPEN,
      completado: false,
    })),
    asignaciones: [],
    expectativa: {
      tcInvestigacion: tcVenta,
      costoEstimadoUSD: costoUSD,
      costoEstimadoPEN: costoUSD * tcVenta,
      costoTotalEstimadoUSD: costoUSD,
      costoTotalEstimadoPEN: costoUSD * tcVenta,
    },
    solicitadoPor: '',
    creadoPor: '',
    fechaSolicitud: nowTimestampStub(),
    fechaCreacion: nowTimestampStub(),
  } as unknown as Requerimiento;
}

// `Requerimiento.fechaSolicitud` es Timestamp · para el req efímero (que jamás se
// persiste ni se lee fecha) basta un stub mínimo compatible.
function nowTimestampStub() {
  return { toDate: () => new Date(), seconds: 0, nanoseconds: 0 } as unknown;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── MODO → RequerimientoFormData (el create por modo) ─────────────────────

/** Una línea de producto seleccionada, lista para el create. */
export interface LineaSeleccionada {
  productoId: string;
  cantidadSolicitada: number;
  precioEstimadoUSD?: number;
  precioVentaPEN?: number;
  proveedorSugerido?: string;
}

/**
 * Construye el RequerimientoFormData de una RESTOCK desde sugerencias seleccionadas.
 * Mismo patrón que `handleCrearDesdeSugerencia` (subtipo='restock' · justificación
 * con la razón del motor). Devuelve UN form por sugerencia (la restock crea 1 req
 * por producto · trazabilidad limpia del motor).
 */
export function buildFormsRestock(
  sugerencias: SugerenciaStock[],
  cantidades: Record<string, number>,
): RequerimientoFormData[] {
  return sugerencias.map((sug) => {
    const cantidad = cantidades[sug.producto.id] ??
      sug.cantidadSugerida ??
      Math.max(sug.stockMinimo - sug.stockActual, 10);
    const prioridad = sug.urgencia === 'critica' || sug.urgencia === 'alta' ? 'alta' : 'media';
    return {
      origen: 'administrativo',
      subtipo: 'restock',
      prioridad,
      productos: [
        {
          productoId: sug.producto.id,
          cantidadSolicitada: cantidad,
          precioEstimadoUSD: sug.precioEstimadoUSD,
          proveedorSugerido: sug.proveedorSugerido,
        },
      ],
      justificacion: `${sug.razon ?? 'Reposición'}: ${sug.stockActual} disponibles · punto de reorden ${sug.stockMinimo}`,
    };
  });
}

/** Construye el form de una APUESTA (subtipo='apuesta' · tesis obligatoria). */
export function buildFormApuesta(
  candidato: CandidatoApuesta,
  cantidad: number,
  tesis: string,
  precioVentaPEN: number | undefined,
  prioridad: RequerimientoFormData['prioridad'],
): RequerimientoFormData {
  return {
    origen: 'administrativo',
    subtipo: 'apuesta',
    tesis: tesis.trim(),
    prioridad,
    productos: [
      {
        productoId: candidato.producto.id,
        cantidadSolicitada: cantidad,
        precioEstimadoUSD: candidato.proveedorMinUSD ?? candidato.producto.investigacion?.precioUSAPromedio,
        precioVentaPEN: precioVentaPEN || undefined,
      },
    ],
  };
}

/** Construye el form de una COMPROMETIDA desde una cotización con adelanto. */
export function buildFormComprometida(venta: {
  id: string;
  numeroVenta: string;
  clienteId?: string;
  nombreCliente: string;
  productos: { productoId: string; cantidad: number; precioUnitario: number }[];
}): RequerimientoFormData {
  return {
    origen: 'demanda_comprometida',
    prioridad: 'alta',
    cotizacionId: venta.id,
    cotizacionNumero: venta.numeroVenta,
    ventaRelacionadaId: venta.id,
    clienteId: venta.clienteId,
    clienteNombre: venta.nombreCliente,
    nombreClienteSolicitante: venta.nombreCliente,
    productos: venta.productos.map((p) => ({
      productoId: p.productoId,
      cantidadSolicitada: p.cantidad,
      precioVentaPEN: p.precioUnitario || undefined,
    })),
    justificacion: `Demanda comprometida · cotización ${venta.numeroVenta} (${venta.nombreCliente})`,
  };
}

/** Re-export para que el modo Manual reúse el driver sin importar 2 sitios. */
export type { DriverDemanda };
