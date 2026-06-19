/**
 * Motor de cobertura DERIVADA de un requerimiento (F4 · Fase B).
 *
 * Función PURA (sin I/O) — fuente única de la cobertura, testeable directamente.
 * Reemplaza la lógica duplicada (e inconsistente) que vivía en `vincularConOCParcial`
 * y `_revertirOCEnReq` de requerimiento.service.ts.
 *
 * Invariante (por tupla req × producto):
 *   cantidadSolicitada = cantidadEnOC + cancelado + pendienteCompra
 *   cantidadEnOC = Σ ref.cantidad  WHERE esFirme(ref.estadoOC) Y ref.estado != 'cancelada'
 *   cancelado    = Σ ref.cantidad  WHERE ref.estado == 'cancelada'
 *   pendienteCompra = max(0, solicitada - cantidadEnOC)     // nunca negativo
 *   sobrecompra     = max(0, cantidadEnOC - solicitada)     // exceso VISIBLE (no clampeado a silencio)
 *
 * Spec: docs/REQUERIMIENTOS_OC_MODELO_F4.md §4.
 */
import type { EstadoOrden } from '../types/ordenCompra.types';

/**
 * Estados de OC que cuentan como cobertura FIRME (de 'enviada'/'confirmada' en adelante).
 * 'borrador' y 'cancelada' NO cuentan. Incluye los legacy (enviada/en_transito/recibida).
 */
const ESTADOS_OC_FIRMES: ReadonlySet<string> = new Set<string>([
  'confirmada', 'en_proceso', 'despachada', 'completada', // canónicos
  'enviada', 'en_transito', 'recibida_parcial', 'recibida', // legacy (= confirmada/en_proceso/completada)
]);

/**
 * ¿La OC ya es firme (su cobertura cuenta)? Una ref legacy sin `estadoOC` se trata como
 * firme — preserva el comportamiento previo hasta que la sincronización (B3) + backfill
 * poblen el campo. `EstadoOrden` NO es ordenable con `>=`: por eso un set explícito.
 */
export function esFirme(estadoOC?: EstadoOrden | string | null): boolean {
  if (estadoOC == null) return true;
  return ESTADOS_OC_FIRMES.has(estadoOC);
}

interface RefLike { ordenCompraId?: string; cantidad?: number; estadoOC?: string | null; estado?: 'vigente' | 'cancelada' | null; }
interface ProductoLike { productoId?: string; cantidadSolicitada?: number; ordenCompraRefs?: RefLike[]; [k: string]: unknown; }

export interface CoberturaAgregada {
  totalProductos: number;
  productosEnOC: number;
  productosPendientes: number;
  porcentaje: number;          // 0-100 (capeado · cubierto al 100% + exceso, no >100)
  tieneSobrecompra: boolean;
}

/** Campos de cobertura que el recompute garantiza en cada producto de salida. */
export type ProductoCobertura = { cantidadEnOC: number; pendienteCompra: number; sobrecompra: number };

export interface CoberturaRecompute<P> {
  productos: Array<P & ProductoCobertura>;               // copia con cantidadEnOC/pendienteCompra/sobrecompra recomputados
  ocCoverage: CoberturaAgregada;
  estadoSugerido: 'aprobado' | 'parcial' | 'en_proceso'; // derivado del % (el caller decide si aplicarlo)
}

/**
 * Recomputa la cobertura derivada de cada producto desde su `ordenCompraRefs` (fuente de verdad).
 * No muta los productos de entrada (devuelve copias). Pura.
 */
export function recomputarCoberturaProductos<P extends ProductoLike>(productos: P[]): CoberturaRecompute<P> {
  const actualizados = productos.map((p) => {
    const refs = (p.ordenCompraRefs || []) as RefLike[];
    const cantidadEnOC = refs.reduce(
      (sum, r) => sum + (esFirme(r.estadoOC) && r.estado !== 'cancelada' ? (r.cantidad || 0) : 0),
      0
    );
    const solicitada = p.cantidadSolicitada || 0;
    return {
      ...p,
      cantidadEnOC,
      pendienteCompra: Math.max(0, solicitada - cantidadEnOC),
      sobrecompra: Math.max(0, cantidadEnOC - solicitada),
    };
  });

  let totalCantidad = 0;
  let cantidadCubierta = 0;
  let productosEnOC = 0;
  let productosPendientes = 0;
  let tieneSobrecompra = false;
  for (const p of actualizados) {
    const solicitada = (p.cantidadSolicitada as number) || 0;
    const enOC = (p.cantidadEnOC as number) || 0;
    totalCantidad += solicitada;
    cantidadCubierta += Math.min(enOC, solicitada);
    if (enOC > 0) productosEnOC++;
    if (((p.pendienteCompra as number) ?? solicitada) > 0) productosPendientes++;
    if (((p.sobrecompra as number) ?? 0) > 0) tieneSobrecompra = true;
  }
  const porcentaje = totalCantidad > 0 ? Math.round((cantidadCubierta / totalCantidad) * 100) : 0;
  const estadoSugerido = porcentaje >= 100 ? 'en_proceso' : porcentaje > 0 ? 'parcial' : 'aprobado';

  return {
    productos: actualizados,
    ocCoverage: { totalProductos: actualizados.length, productosEnOC, productosPendientes, porcentaje, tieneSobrecompra },
    estadoSugerido,
  };
}

/** Modo de cancelación de una ref de OC (Fase B · §6). */
export type ModoCancelacionRef = 'delete' | 'soft' | 'porcion';

/**
 * Aplica una mutación a la(s) ref(s) de `ordenCompraId` en los productos. PURA (devuelve copias).
 *  - 'delete'  : quita la ref (retracción / borrado físico de OC borrador · sin rastro).
 *  - 'soft'    : marca la ref `estado='cancelada'` (deja rastro · OC firme · la compra procede).
 *  - 'porcion' : reduce `cantidad` de la ref del producto `opts.productoId` en `opts.cantidadCancelar`.
 * La cobertura se recomputa aparte con `recomputarCoberturaProductos`.
 */
export function aplicarCancelacionRef<P extends ProductoLike>(
  productos: P[],
  ordenCompraId: string,
  modo: ModoCancelacionRef,
  opts?: { productoId?: string; cantidadCancelar?: number }
): P[] {
  return productos.map((p) => {
    const refs = (p.ordenCompraRefs || []) as RefLike[];
    const idx = refs.findIndex((r) => r.ordenCompraId === ordenCompraId);
    if (idx === -1) return p;

    if (modo === 'porcion') {
      if (opts?.productoId && p.productoId !== opts.productoId) return p;
      const nuevasRefs = refs.map((r, i) =>
        i === idx ? { ...r, cantidad: Math.max(0, (r.cantidad || 0) - (opts?.cantidadCancelar || 0)) } : r
      );
      return { ...p, ordenCompraRefs: nuevasRefs };
    }
    if (modo === 'soft') {
      const nuevasRefs = refs.map((r, i) => (i === idx ? { ...r, estado: 'cancelada' as const } : r));
      return { ...p, ordenCompraRefs: nuevasRefs };
    }
    // delete
    return { ...p, ordenCompraRefs: refs.filter((_, i) => i !== idx) };
  });
}
