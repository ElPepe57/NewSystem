/**
 * colaRequerimientos.helper · F4 · análisis de la COLA (lente ejecutiva del Resumen).
 *
 * Núcleo PURO que mira TODA la cola de requerimientos (los que comprometen caja futura:
 * pendiente/aprobado/parcial) y deriva:
 *   - PRESIÓN DE CAJA (widget A2): Σ costo pendiente vs caja disponible → exceso.
 *   - MIX DE RIESGO + HIGIENE (widget D1): composición del gasto por origen + inputs sucios.
 *
 * Reusa `esteReqPEN` + `resolverLente` de panelDecision.helper (misma fuente que el panel y A1).
 * 100% testeable. La anticipación de quiebres (C1) NO vive acá — corre sobre productoIntel.
 */
import { esteReqPEN, resolverLente, type LenteDecision } from './panelDecision.helper';
import type { Requerimiento, EstadoRequerimiento } from '../../types/requerimiento.types';

/** La cola = reqs que comprometen caja futura (demanda aún no comprada). */
export const ESTADOS_COLA: EstadoRequerimiento[] = ['pendiente', 'aprobado', 'parcial'];

export interface MixOrigen {
  lente: LenteDecision;
  montoPEN: number;
  pct: number;   // % del total pendiente
  count: number;
}

export interface HigieneCola {
  apuestasSinTesis: number;   // apuesta sin tesis (obligatoria)
  manualesSinDriver: number;  // manual sin driver de demanda
  sinPrecioVenta: number;     // apuesta/manual con producto(s) sin precioVentaPEN → margen no medible
}

export interface AnalisisCola {
  enCola: number;                  // cantidad de reqs en la cola
  totalPendientePEN: number;       // Σ esteReqPEN de la cola
  cajaDisponiblePEN: number | null;
  excesoPEN: number;               // max(0, total − caja) · 0 si dentro o caja desconocida
  enPresion: boolean;              // total > caja
  ratioColaCaja: number | null;    // total / caja (cuántas veces la cola excede la caja)
  mix: MixOrigen[];                // ordenado por monto desc
  higiene: HigieneCola;
}

const apuestaSinTesis = (r: Requerimiento) =>
  r.origen === 'administrativo' && r.subtipo === 'apuesta' && !r.tesis?.trim();
const manualSinDriver = (r: Requerimiento) =>
  r.origen === 'administrativo' && r.subtipo === 'manual' && !r.driverDemanda;
const sinPrecioVenta = (r: Requerimiento) =>
  (r.subtipo === 'apuesta' || r.subtipo === 'manual') &&
  r.productos.some((p) => !p.precioVentaPEN || p.precioVentaPEN <= 0);

export function analizarCola(
  reqs: Requerimiento[],
  cajaDisponiblePEN: number | null,
): AnalisisCola {
  const cola = reqs.filter((r) => ESTADOS_COLA.includes(r.estado));
  const totalPendientePEN = round2(cola.reduce((s, r) => s + esteReqPEN(r), 0));

  // Mix por origen (ponderado por gasto).
  const porLente = new Map<LenteDecision, { monto: number; count: number }>();
  for (const r of cola) {
    const lente = resolverLente(r);
    const cur = porLente.get(lente) ?? { monto: 0, count: 0 };
    porLente.set(lente, { monto: cur.monto + esteReqPEN(r), count: cur.count + 1 });
  }
  const mix: MixOrigen[] = [...porLente.entries()]
    .map(([lente, v]) => ({
      lente,
      montoPEN: round2(v.monto),
      pct: totalPendientePEN > 0 ? round2((v.monto / totalPendientePEN) * 100) : 0,
      count: v.count,
    }))
    .sort((a, b) => b.montoPEN - a.montoPEN);

  const higiene: HigieneCola = {
    apuestasSinTesis: cola.filter(apuestaSinTesis).length,
    manualesSinDriver: cola.filter(manualSinDriver).length,
    sinPrecioVenta: cola.filter(sinPrecioVenta).length,
  };

  const excesoPEN = cajaDisponiblePEN != null ? round2(Math.max(0, totalPendientePEN - cajaDisponiblePEN)) : 0;
  const enPresion = cajaDisponiblePEN != null && totalPendientePEN > cajaDisponiblePEN;
  const ratioColaCaja = cajaDisponiblePEN != null && cajaDisponiblePEN > 0
    ? round2(totalPendientePEN / cajaDisponiblePEN)
    : null;

  return {
    enCola: cola.length,
    totalPendientePEN,
    cajaDisponiblePEN: cajaDisponiblePEN != null ? round2(cajaDisponiblePEN) : null,
    excesoPEN,
    enPresion,
    ratioColaCaja,
    mix,
    higiene,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
