/**
 * useRadarAtrasados · Fase 1 (Llegadas) · ENSAMBLADO del radar de atrasados en vuelo.
 *
 * Une las piezas que el helper PURO `radarAtrasados.helper` necesita y NO sabe leer:
 *   · OCs EN VUELO (estado in-flight) desde las `ordenes` ya filtradas por línea.
 *   · `diasEnVuelo` = hoy − fechaSalida del Envío vinculado (fallback: fechaCreacion de la OC).
 *   · `leadTimeEsperado` = lead-time aprendido (proveedor.metricas.tiempoEntregaPromedioDias si
 *      existe · si no, el `leadTimeGlobal.tiempoPromedioTotal` de productoIntelStore). ANOTADO abajo.
 *   · `capitalUSD` = totalUSD de la OC (el dato de capital · LECTURA · vive en Envíos/Finanzas).
 *   · `diasUltimaSenal` = null SIEMPRE · NO existe campo de "última señal de tracking" (gap C4
 *      diferido) · no se inventa el dato → `esMudo` = false. La UI lo rotula como pendiente.
 *
 * Capital en tránsito (banner): Σ totalUSD de TODAS las OCs en vuelo (no solo atrasadas).
 * En-riesgo (severo+crítico) = `resumirRadar().capitalEnRiesgoUSD`.
 * Unidades por llegar: Σ (cantidad − cantidadRecibida) de las OCs en vuelo (mismo cómputo que el
 * Resumen, pero solo para las en-vuelo).
 *
 * Teaser de excepciones (read-only · cross-link a Envíos): count de incidencias ABIERTAS
 * (incidenciaOCService.listAll · estado ≠ resuelta) acotado a las OCs en vuelo. Reclamos por
 * cobrar: count derivado de las incidencias de envío (IncidenciaEnvio.estadoReclamo) embebidas en
 * los envíos en vuelo · NO se clona el detalle/CRUD (eso vive en Envíos). SOLO el count + el link.
 */

import { useEffect, useMemo, useState } from 'react';
import type { OrdenCompra, Proveedor } from '../../types/ordenCompra.types';
import type { Envio } from '../../types/envio.types';
import type { MetricasLeadTime } from '../../types/productoIntel.types';
import { incidenciaOCService } from '../../services/incidenciaOC.service';
import type { IncidenciaOC } from '../../types/incidenciaOC.types';
import {
  clasificarAtraso,
  ordenarRadar,
  resumirRadar,
  type FilaAtraso,
  type ResumenRadar,
} from './radarAtrasados.helper';

// Estados logísticos de OC "en vuelo" (in-flight): confirmada/en_proceso/despachada + legacy.
// NO borrador/completada/recibida/cancelada. String[] para incluir estados legacy de Firestore.
const ESTADOS_EN_VUELO: string[] = [
  'confirmada',
  'en_proceso',
  'despachada',
  'recibida_parcial',
  // legacy aliases (backward compat)
  'enviada',
  'en_transito',
  'pagada',
];

// Estados de Envío "en vuelo" (para vincular el envío activo a la OC y leer su fechaSalida).
const ESTADOS_ENVIO_EN_VUELO: string[] = [
  'confirmado',
  'en_transito',
  'retenida_aduana',
  'recibida_parcial',
  // logística local
  'programada',
  'en_camino',
];

const MS_DIA = 86_400_000;

const toMs = (f: unknown): number | null => {
  if (f == null) return null;
  if (f instanceof Date) return f.getTime();
  if (typeof f === 'number') return f;
  if (typeof f === 'object') {
    const o = f as { toMillis?: () => number; seconds?: number };
    if (typeof o.toMillis === 'function') return o.toMillis();
    if (typeof o.seconds === 'number') return o.seconds * 1000;
  }
  return null;
};

export interface FilaRadarLlegada extends FilaAtraso {
  /** OC de origen (para cross-link "Ver" → Envíos · y contexto del modal Empujar). */
  orden: OrdenCompra;
  /** Envío vinculado en vuelo (si lo hay · para el deep-link a su detalle). */
  envio: Envio | null;
  /** País de origen (display secundario bajo el proveedor). */
  paisOrigen: string;
}

export interface CapitalTransito {
  totalUSD: number;
  enRiesgoUSD: number;
  normalUSD: number;
  enRiesgoPct: number;
  normalPct: number;
  enviosCount: number;
}

export interface TeaserExcepciones {
  /** Incidencias de OC abiertas en las OCs en vuelo (estado ≠ resuelta). */
  incidenciasAbiertas: number;
  /** Reclamos por cobrar (IncidenciaEnvio.estadoReclamo ≠ cobrado/rechazado) en envíos en vuelo. */
  reclamosPorCobrar: number;
  /** Monto reclamado pendiente (PEN · el dato de envío solo trackea PEN). */
  reclamosMontoPEN: number;
  /** OCs cuyas incidencias se referencian (para el deep-link contextualizado a Envíos). */
  ocIds: string[];
  loading: boolean;
  error: boolean;
}

export interface UnidadesPorLlegar {
  total: number;
  /** Top proveedores por unidades en vuelo (para el desglose del aside). */
  porProveedor: { nombre: string; unidades: number }[];
}

export interface RadarAtrasadosResult {
  filas: FilaRadarLlegada[];
  resumen: ResumenRadar;
  capital: CapitalTransito;
  unidades: UnidadesPorLlegar;
  teaser: TeaserExcepciones;
  /** Fuente del lead-time usado por fila (para honestidad/debug). */
  leadTimeFuente: 'proveedor' | 'global' | 'mixto' | 'sin-baseline';
  loading: boolean;
  error: boolean;
  /** Re-dispara la carga del teaser async (incidencias). El radar se recalcula con los props. */
  reintentar: () => void;
}

interface UseRadarParams {
  /** OCs ya filtradas por línea de negocio (ordenesLN del padre). */
  ordenes: OrdenCompra[];
  /** Todos los envíos (del envioStore · ya cargados en la página). */
  envios: Envio[];
  /** Proveedores activos (para leer el lead-time aprendido por proveedor). */
  proveedores: Proveedor[];
  /** Lead-time global aprendido (productoIntelStore · baseline). Puede ser null. */
  leadTimeGlobal: MetricasLeadTime | null;
}

export function useRadarAtrasados({
  ordenes,
  envios,
  proveedores,
  leadTimeGlobal,
}: UseRadarParams): RadarAtrasadosResult {
  // ─── Teaser async · incidencias cross-OC (listAll) ───────────────────────
  // `loading: true` arranca en el initial state · NO se setea sincrónicamente dentro del effect
  // (evita el cascading-render que marca el linter). El retry (`reintentar`) re-pone loading=true
  // antes de bumpear el token · el effect solo apaga loading/marca error al resolver.
  const [incidencias, setIncidencias] = useState<IncidenciaOC[] | null>(null);
  const [teaserLoading, setTeaserLoading] = useState(true);
  const [teaserError, setTeaserError] = useState(false);
  const [recargaToken, setRecargaToken] = useState(0);

  useEffect(() => {
    let cancelado = false;
    incidenciaOCService
      .listAll()
      .then((items) => {
        if (cancelado) return;
        setIncidencias(items);
        setTeaserError(false);
        setTeaserLoading(false);
      })
      .catch(() => {
        if (cancelado) return;
        setIncidencias([]);
        setTeaserError(true);
        setTeaserLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [recargaToken]);

  // ─── Índice proveedor por id (lead-time aprendido por proveedor) ─────────
  const proveedorIndex = useMemo(() => {
    const m = new Map<string, Proveedor>();
    for (const p of proveedores) m.set(p.id, p);
    return m;
  }, [proveedores]);

  // ─── Índice del envío EN VUELO más reciente por ordenCompraId ────────────
  const envioEnVueloPorOC = useMemo(() => {
    const m = new Map<string, Envio>();
    for (const e of envios) {
      if (!e.ordenCompraId) continue;
      if (!ESTADOS_ENVIO_EN_VUELO.includes(e.estado)) continue;
      const prev = m.get(e.ordenCompraId);
      if (!prev) {
        m.set(e.ordenCompraId, e);
      } else {
        // Quedarse con el que tenga fechaSalida más reciente (o creación como proxy).
        const a = toMs(e.fechaSalida) ?? toMs(e.fechaCreacion) ?? 0;
        const b = toMs(prev.fechaSalida) ?? toMs(prev.fechaCreacion) ?? 0;
        if (a > b) m.set(e.ordenCompraId, e);
      }
    }
    return m;
  }, [envios]);

  // ─── OCs en vuelo ────────────────────────────────────────────────────────
  const ordenesEnVuelo = useMemo(
    () => ordenes.filter((o) => o.estado !== 'cancelada' && ESTADOS_EN_VUELO.includes(o.estado)),
    [ordenes],
  );

  // ─── Filas del radar (clasificadas por gravedad) ─────────────────────────
  const leadGlobal = leadTimeGlobal?.tiempoPromedioTotal ?? 0;
  // "hoy" estable por el ciclo de vida del componente (lazy initializer · impureza permitida en
  // useState · evita re-cálculo por re-render y la advertencia de pureza en useMemo).
  const [hoy] = useState(() => Date.now());

  const { filas, leadTimeFuente } = useMemo(() => {
    const out: FilaRadarLlegada[] = [];
    const fuentes = new Set<'proveedor' | 'global' | 'sin-baseline'>();

    for (const orden of ordenesEnVuelo) {
      const envio = envioEnVueloPorOC.get(orden.id) ?? null;
      // diasEnVuelo: desde la salida del envío · fallback a la creación de la OC.
      const salidaMs =
        toMs(envio?.fechaSalida) ?? toMs(orden.fechaCreacion);
      if (salidaMs == null) continue;
      const diasEnVuelo = Math.floor((hoy - salidaMs) / MS_DIA);

      // leadTimeEsperado: por proveedor (aprendido) si está · si no, el global.
      const prov = proveedorIndex.get(orden.proveedorId);
      const leadProv = prov?.metricas?.tiempoEntregaPromedioDias ?? 0;
      let leadTimeEsperado = 0;
      if (leadProv > 0) {
        leadTimeEsperado = leadProv;
        fuentes.add('proveedor');
      } else if (leadGlobal > 0) {
        leadTimeEsperado = leadGlobal;
        fuentes.add('global');
      } else {
        fuentes.add('sin-baseline');
        continue; // sin baseline NO se puede afirmar "va tarde" · helper devolvería null igual.
      }

      const clas = clasificarAtraso(diasEnVuelo, leadTimeEsperado);
      if (!clas) continue; // no atrasado (ratio ≤ 1)

      out.push({
        id: orden.id,
        numero: envio?.numeroEnvio || orden.numeroOrden,
        proveedor: orden.nombreProveedor,
        diasEnVuelo,
        leadTimeEsperado,
        ratio: clas.ratio,
        gravedad: clas.gravedad,
        capitalUSD: orden.totalUSD || 0,
        // HONESTIDAD: no existe campo de última señal de tracking (gap C4) → null → no-mudo.
        diasUltimaSenal: null,
        mudo: false,
        orden,
        envio,
        paisOrigen: orden.paisOrigen || envio?.origenProveedorPais || '—',
      });
    }

    const fuente: RadarAtrasadosResult['leadTimeFuente'] =
      fuentes.size === 0
        ? 'sin-baseline'
        : fuentes.has('proveedor') && fuentes.has('global')
          ? 'mixto'
          : fuentes.has('proveedor')
            ? 'proveedor'
            : fuentes.has('global')
              ? 'global'
              : 'sin-baseline';

    return { filas: ordenarRadar(out) as FilaRadarLlegada[], leadTimeFuente: fuente };
  }, [ordenesEnVuelo, envioEnVueloPorOC, proveedorIndex, leadGlobal, hoy]);

  const resumen = useMemo(() => resumirRadar(filas), [filas]);

  // ─── Capital en tránsito (Σ TODAS las OCs en vuelo · no solo atrasadas) ──
  const capital = useMemo<CapitalTransito>(() => {
    const totalUSD = ordenesEnVuelo.reduce((s, o) => s + (o.totalUSD || 0), 0);
    const enRiesgoUSD = resumen.capitalEnRiesgoUSD;
    const normalUSD = Math.max(0, totalUSD - enRiesgoUSD);
    const enRiesgoPct = totalUSD > 0 ? Math.round((enRiesgoUSD / totalUSD) * 100) : 0;
    const normalPct = totalUSD > 0 ? 100 - enRiesgoPct : 0;
    return {
      totalUSD,
      enRiesgoUSD,
      normalUSD,
      enRiesgoPct,
      normalPct,
      enviosCount: envioEnVueloPorOC.size,
    };
  }, [ordenesEnVuelo, resumen.capitalEnRiesgoUSD, envioEnVueloPorOC.size]);

  // ─── Unidades por llegar (OCs en vuelo · cantidad − recibida) ────────────
  const unidades = useMemo<UnidadesPorLlegar>(() => {
    const porProveedorMap = new Map<string, number>();
    let total = 0;
    for (const o of ordenesEnVuelo) {
      let uds = 0;
      for (const p of o.productos || []) {
        uds += Math.max(0, (p.cantidad || 0) - (p.cantidadRecibida || 0));
      }
      if (uds <= 0) continue;
      total += uds;
      const nombre = o.nombreProveedor || 'Sin proveedor';
      porProveedorMap.set(nombre, (porProveedorMap.get(nombre) || 0) + uds);
    }
    const porProveedor = [...porProveedorMap.entries()]
      .map(([nombre, unidades]) => ({ nombre, unidades }))
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 3);
    return { total, porProveedor };
  }, [ordenesEnVuelo]);

  // ─── Teaser de excepciones (read-only · count + monto · NO el detalle) ───
  const teaser = useMemo<TeaserExcepciones>(() => {
    const ocIdsEnVuelo = new Set(ordenesEnVuelo.map((o) => o.id));

    // Incidencias de OC abiertas, acotadas a las OCs en vuelo.
    const incidenciasAbiertas = (incidencias ?? []).filter(
      (i) => i.estado !== 'resuelta' && i.ocId && ocIdsEnVuelo.has(i.ocId),
    );

    // Reclamos por cobrar: viven en las incidencias de envío (IncidenciaEnvio) embebidas en los
    // envíos en vuelo. Solo COUNT + monto agregado (PEN · es lo único que el envío trackea).
    let reclamosPorCobrar = 0;
    let reclamosMontoPEN = 0;
    for (const e of envios) {
      if (!e.ordenCompraId || !ocIdsEnVuelo.has(e.ordenCompraId)) continue;
      for (const inc of e.incidencias ?? []) {
        const estadoRec = inc.estadoReclamo;
        // "por cobrar" = tiene reclamo y NO está cobrado ni rechazado.
        if (estadoRec && estadoRec !== 'cobrado' && estadoRec !== 'rechazado') {
          reclamosPorCobrar++;
          reclamosMontoPEN += inc.montoReclamoPEN || 0;
        }
      }
    }

    return {
      incidenciasAbiertas: incidenciasAbiertas.length,
      reclamosPorCobrar,
      reclamosMontoPEN,
      ocIds: [...new Set(incidenciasAbiertas.map((i) => i.ocId).filter(Boolean) as string[])],
      loading: teaserLoading,
      error: teaserError,
    };
  }, [incidencias, envios, ordenesEnVuelo, teaserLoading, teaserError]);

  return {
    filas,
    resumen,
    capital,
    unidades,
    teaser,
    leadTimeFuente,
    // El radar (cómputo síncrono) nunca está "loading"; el async es el teaser.
    loading: false,
    error: false,
    reintentar: () => {
      setTeaserLoading(true);
      setTeaserError(false);
      setRecargaToken((t) => t + 1);
    },
  };
}
