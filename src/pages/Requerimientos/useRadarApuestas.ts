/**
 * useRadarApuestas · F4+ · ENSAMBLA las filas del Radar de Apuestas (100% DERIVADO · cero schema).
 *
 * Cierra el bucle de la apuesta: la creación guiada CREA (subtipo='apuesta' + tesis + ROI pre-compra)
 * y esta tab TRACKEA — ¿la tesis se cumplió? Cruza tres fuentes que YA existen:
 *   1. apuestas   → requerimientos subtipo='apuesta' (estado ≠ cancelado/rechazado).
 *   2. recuperación → calcularCurvaRecuperacion sobre el CTRUProductoDetalle del producto
 *                     (mismo cálculo que ProductoCTRUDossier/CTRUDashboard · base = ctru × unidades).
 *   3. rotación   → useProductoIntelStore → rotacion.clasificacionRotacion.
 *
 * El veredicto + el resumen + el orden salen del núcleo PURO `radarApuestas.helper` (testeado).
 * El componente solo presenta. `ahoraMs` se inyecta una vez por carga (no es workflow · es "hoy").
 */
import { useEffect, useMemo } from 'react';
import { calcularCurvaRecuperacion } from '../../utils/recuperacion.utils';
import { useCTRUStore, type CTRUProductoDetalle } from '../../store/ctruStore';
import { useProductoIntelStore } from '../../store/productoIntelStore';
import {
  evaluarVeredicto, resumirRadar, ordenarRadar,
  type FilaApuesta, type ResumenRadar,
} from './radarApuestas.helper';
import type { Requerimiento } from '../../types/requerimiento.types';
import type { ClasificacionRotacion } from '../../types/productoIntel.types';

const MS_POR_DIA = 1000 * 60 * 60 * 24;

/** Extrae millis de un Timestamp de Firestore, un número, o null (mismo patrón que sla.helper). */
function toMillis(ts: unknown): number | null {
  if (ts == null) return null;
  const t = ts as { toMillis?: () => number };
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof ts === 'number') return ts;
  return null;
}

/** Mapa rotación → etiqueta legible + tono semántico para el chip del radar. */
const ROTACION_LABEL: Record<ClasificacionRotacion, string> = {
  muy_alta: 'muy alta',
  alta: 'alta',
  media: 'media',
  baja: 'baja',
  muy_baja: 'muy baja',
  sin_movimiento: 'sin movimiento',
};
function tonoRotacion(c: ClasificacionRotacion): FilaApuesta['rotacionTono'] {
  if (c === 'muy_alta' || c === 'alta') return 'emerald';
  if (c === 'sin_movimiento') return 'rose';
  return 'slate';
}

/** % del CTRU recuperado vía ventas para UN producto (mismo cálculo que el dossier). */
function recuperacionPctDe(detalle: CTRUProductoDetalle | undefined): number {
  if (!detalle) return 0;
  const base = (detalle.ctruContableProm || 0) * (detalle.totalUnidades || 0);
  const curva = calcularCurvaRecuperacion(
    detalle.ventasDetalle.map((v) => ({
      fecha: v.fecha, cantidad: v.cantidad,
      contribucionUnitaria: v.contribucionUnitaria, costoUnitario: v.costoUnitario, canal: v.canal,
    })),
    base,
  );
  return curva.pctRecuperado;
}

/** CTRU invertido en la apuesta (USD): preferí el estimado del req, fallback a CTRU×unidades del lote. */
function ctruInvertidoDe(req: Requerimiento, detalle: CTRUProductoDetalle | undefined): number {
  const estimado = req.expectativa?.costoTotalEstimadoUSD;
  if (estimado && estimado > 0) return estimado;
  if (detalle) return (detalle.ctruContableProm || 0) * (detalle.totalUnidades || 0);
  return 0;
}

export interface RadarApuestasData {
  filas: FilaApuesta[];
  resumen: ResumenRadar;
  loading: boolean;
  /** Mapa productoId → CTRUProductoDetalle · para abrir el dossier read-only desde una fila. */
  detallePorProducto: Map<string, CTRUProductoDetalle>;
}

/**
 * Hook de ensamblado. Recibe los requerimientos (ya filtrados por línea) desde el hub y arma las
 * filas cruzándolos con el CTRU (productosDetalle) y la rotación (productosIntel). Dispara la carga
 * de ambos stores si aún no tienen data (el hub no los carga por su cuenta).
 */
export function useRadarApuestas(requerimientos: Requerimiento[]): RadarApuestasData {
  const ctruDetalle = useCTRUStore((s) => s.productosDetalle);
  const ctruLoading = useCTRUStore((s) => s.loading);
  const fetchCTRU = useCTRUStore((s) => s.fetchAll);

  const productosIntel = useProductoIntelStore((s) => s.productosIntel);
  const intelLoading = useProductoIntelStore((s) => s.loading);
  const cargarIntel = useProductoIntelStore((s) => s.cargarDatos);

  // Carga perezosa de las dos fuentes derivadas (idempotente · los stores tienen guard interno).
  useEffect(() => {
    if (ctruDetalle.length === 0 && !ctruLoading) void fetchCTRU();
  }, [ctruDetalle.length, ctruLoading, fetchCTRU]);
  useEffect(() => {
    if (productosIntel.length === 0 && !intelLoading) void cargarIntel();
  }, [productosIntel.length, intelLoading, cargarIntel]);

  return useMemo(() => {
    const detallePorProducto = new Map(ctruDetalle.map((d) => [d.productoId, d]));
    const intelPorProducto = new Map(productosIntel.map((p) => [p.productoId, p]));
    const ahoraMs = Date.now();

    const apuestas = requerimientos.filter(
      (r) => r.subtipo === 'apuesta' && r.estado !== 'cancelado' && r.estado !== 'rechazado',
    );

    const filas: FilaApuesta[] = apuestas.map((req) => {
      const prod = req.productos?.[0];
      const productoId = prod?.productoId ?? '';
      const detalle = detallePorProducto.get(productoId);
      const intel = intelPorProducto.get(productoId);

      const recuperacionPct = recuperacionPctDe(detalle);
      const creadaMs = toMillis(req.fechaCreacion) ?? toMillis(req.fechaSolicitud) ?? ahoraMs;
      const diasDesdeCreacion = Math.max(0, Math.floor((ahoraMs - creadaMs) / MS_POR_DIA));
      const clasif = intel?.rotacion.clasificacionRotacion;

      return {
        requerimientoId: req.id,
        productoId,
        nombre: prod?.nombreComercial ?? 'Sin producto',
        tesis: req.tesis ?? '',
        ctruInvertidoUSD: ctruInvertidoDe(req, detalle),
        recuperacionPct,
        rotacionLabel: clasif ? ROTACION_LABEL[clasif] : 'sin datos',
        rotacionTono: clasif ? tonoRotacion(clasif) : 'slate',
        diasDesdeCreacion,
        veredicto: evaluarVeredicto(recuperacionPct, diasDesdeCreacion),
      };
    });

    return {
      filas: ordenarRadar(filas),
      resumen: resumirRadar(filas),
      loading: (ctruLoading && ctruDetalle.length === 0) || (intelLoading && productosIntel.length === 0),
      detallePorProducto,
    };
  }, [requerimientos, ctruDetalle, productosIntel, ctruLoading, intelLoading]);
}
