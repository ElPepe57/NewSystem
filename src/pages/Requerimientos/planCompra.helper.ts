/**
 * planCompra.helper · F4 · Plan de compra (tab héroe · convergencia demanda×caja a PORTAFOLIO).
 *
 * Núcleo PURO. Toma la cola de requerimientos (pendiente/aprobado/parcial), la ordena por MÉRITO,
 * y la "gasta" contra un TOPE DE CAJA editable → la WATERLINE: lo que entra este ciclo vs lo que se
 * difiere. Es la materialización de "el sistema recomienda, vos decidís" a nivel cartera: nadie veía
 * que 5 reqs que caben por separado revientan la caja juntos.
 *
 * Reusa esteReqPEN + resolverLente (misma fuente que el panel y los widgets). 100% testeable.
 * La heurística de mérito y los pesos = decisión de producto (refinable · igual que el veredicto).
 */
import { esteReqPEN, resolverLente, type LenteDecision } from './panelDecision.helper';
import { ESTADOS_COLA } from './colaRequerimientos.helper';
import type { Requerimiento, PrioridadRequerimiento } from '../../types/requerimiento.types';

// ── Mérito (heurística refinable) ────────────────────────────────────────────
// Certeza de la demanda primero (demanda comprometida → datos → instinto probado → especulación),
// y dentro de cada nivel, por prioridad declarada.
const PESO_LENTE: Record<LenteDecision, number> = {
  demanda_comprometida: 1000,
  restock: 600,
  manual: 400,
  apuesta: 200,
};
const PESO_PRIORIDAD: Record<PrioridadRequerimiento, number> = {
  urgente: 50,
  alta: 40,
  media: 25,
  normal: 15,
  baja: 5,
};

export function calcularMerito(req: Pick<Requerimiento, 'origen' | 'subtipo' | 'prioridad'>): number {
  return PESO_LENTE[resolverLente(req)] + (PESO_PRIORIDAD[req.prioridad] ?? 0);
}

export interface FilaPlan {
  req: Requerimiento;
  montoPEN: number;
  lente: LenteDecision;
  meritoScore: number;
  acumuladoPEN: number;   // acumulado hasta esta fila inclusive (orden de mérito)
  entra: boolean;         // acumulado ≤ tope → entra este ciclo
}

export interface PlanCompra {
  filas: FilaPlan[];        // ordenadas por mérito desc
  topePEN: number;
  totalColaPEN: number;
  totalEntraPEN: number;    // Σ de las que entran
  countEntra: number;
  countDifiere: number;
}

/** Construye el plan: ranking por mérito + waterline contra el tope. */
export function construirPlanCompra(reqs: Requerimiento[], topePEN: number): PlanCompra {
  const cola = reqs.filter((r) => ESTADOS_COLA.includes(r.estado));
  const ranked = cola
    .map((req) => ({
      req,
      montoPEN: esteReqPEN(req),
      lente: resolverLente(req),
      meritoScore: calcularMerito(req),
    }))
    .sort((a, b) => b.meritoScore - a.meritoScore || b.montoPEN - a.montoPEN);

  let acumulado = 0;
  const filas: FilaPlan[] = ranked.map((row) => {
    acumulado += row.montoPEN;
    return { ...row, acumuladoPEN: round2(acumulado), entra: acumulado <= topePEN };
  });

  const entran = filas.filter((f) => f.entra);
  return {
    filas,
    topePEN: round2(topePEN),
    totalColaPEN: round2(acumulado),
    totalEntraPEN: round2(entran.reduce((s, f) => s + f.montoPEN, 0)),
    countEntra: entran.length,
    countDifiere: filas.length - entran.length,
  };
}

// ── C2 · detección de consolidación ──────────────────────────────────────────
export interface OportunidadConsolidacion {
  productoId: string;
  sku: string;
  nombreComercial: string;
  reqsIds: string[];
  reqsNumeros: string[];
  cantidadTotal: number;       // Σ pendienteCompra del producto en los reqs
  proveedorComun?: string;     // si todos sugieren el mismo proveedor
}

/**
 * Detecta productos pedidos por 2+ reqs de la cola (con compra pendiente) → oportunidad de
 * agrupar en una sola OC (baja flete/unidad → mejora el CTRU · más poder de negociación).
 */
export function detectarConsolidaciones(reqs: Requerimiento[]): OportunidadConsolidacion[] {
  const cola = reqs.filter((r) => ESTADOS_COLA.includes(r.estado));
  const porProducto = new Map<
    string,
    { sku: string; nombre: string; reqs: Set<string>; numeros: Set<string>; cantidad: number; proveedores: Set<string> }
  >();

  for (const r of cola) {
    for (const p of r.productos) {
      if ((p.pendienteCompra ?? 0) <= 0) continue; // solo lo que falta comprar
      const cur = porProducto.get(p.productoId) ?? {
        sku: p.sku, nombre: p.nombreComercial, reqs: new Set<string>(), numeros: new Set<string>(), cantidad: 0, proveedores: new Set<string>(),
      };
      if (r.id) cur.reqs.add(r.id);
      cur.numeros.add(r.numeroRequerimiento);
      cur.cantidad += p.pendienteCompra;
      if (p.proveedorSugerido?.trim()) cur.proveedores.add(p.proveedorSugerido.trim());
      porProducto.set(p.productoId, cur);
    }
  }

  return [...porProducto.entries()]
    .filter(([, v]) => v.reqs.size >= 2)
    .map(([productoId, v]) => ({
      productoId,
      sku: v.sku,
      nombreComercial: v.nombre,
      reqsIds: [...v.reqs],
      reqsNumeros: [...v.numeros],
      cantidadTotal: v.cantidad,
      proveedorComun: v.proveedores.size === 1 ? [...v.proveedores][0] : undefined,
    }))
    .sort((a, b) => b.reqsIds.length - a.reqsIds.length);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
