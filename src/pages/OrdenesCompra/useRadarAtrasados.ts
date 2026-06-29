/**
 * useRadarAtrasados · Fase 1 (Llegadas) · ENSAMBLADO del radar de atrasados en vuelo.
 *
 * Une las piezas que el helper PURO `radarAtrasados.helper` necesita y NO sabe leer:
 *   · OCs EN VUELO (estado in-flight) desde las `ordenes` ya filtradas por línea.
 *   · LEG-AWARE (doble baseline por pierna · decisión user 2026-06-29): la OC en vuelo está en UNA
 *      pierna a la vez. Si el envío YA salió (tiene fechaSalida) → pierna VIAJERO en curso
 *      (diasEnVuelo desde fechaSalida · baseline = viajero · culpable='viajero'). Si AÚN no salió
 *      (sin fechaSalida) → pierna PROVEEDOR en curso (diasEnVuelo desde fechaEnviada/fechaCreacion
 *      de la OC · baseline = proveedor · culpable='proveedor'). Se compara contra el baseline DE ESA
 *      pierna · ya no contra `prov.metricas.tiempoEntregaPromedioDias` (baseline de cadena entera,
 *      denormalizado y ROTO · misma familia OC-level deprecada).
 *   · BASELINES POR PIERNA, computados IN-MEMORY desde los `envios` (que el hook YA recibe = TODOS
 *      los envíos · `envioCrudService.getAll()`). Sin queries extra:
 *        - VIAJERO por colaboradorId: `resumirLeadTime` de `leadTimePiernaB` sobre envíos COMPLETADOS
 *          del viajero → promedio.
 *        - PROVEEDOR por origenProveedorId: `resumirLeadTime` de `leadTimePiernaA(envio.subEnvios)`
 *          sobre envíos COMPLETADOS del proveedor → promedio.
 *      Fallback por pierna (promedio global de esa pierna) si la entidad no tiene histórico · y el
 *      `leadTimeGlobal` (cadena entera · productoIntelStore) si NADA. Se ANOTA la fuente por fila.
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
  type CulpableAtraso,
  type LeadTimeFuenteFila,
} from './radarAtrasados.helper';
import {
  leadTimePiernaA,
  leadTimePiernaB,
  resumirLeadTime,
} from '../../utils/leadTimePiernas.helper';

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

// Estados de Envío "completado" — los que ya tienen lead-time real de cierre, base de los baselines
// por pierna aprendidos (la mercadería llegó · hay fechaLlegadaReal / tandas entregadas).
const ESTADOS_ENVIO_COMPLETADO: string[] = [
  'recibida_completa',
  'recibida_parcial', // parcial ya tiene primera entrega real → su lead-time de pierna es medible
  'entregada',
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
  /**
   * Fuente AGREGADA del lead-time usado por las filas (para honestidad/debug).
   *   · 'entidad'       → todas las filas usaron el baseline histórico de su propia entidad (pierna).
   *   · 'global-pierna' → al menos una cayó al promedio global de su pierna (sin histórico propio).
   *   · 'global'        → al menos una cayó al leadTimeGlobal de cadena entera (sin histórico de pierna).
   *   · 'mixto'         → mezcla de las anteriores.
   *   · 'sin-baseline'  → no había baseline computable (radar vacío de filas).
   */
  leadTimeFuente: LeadTimeFuenteFila | 'mixto' | 'sin-baseline';
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

  // ─── BASELINES POR PIERNA · aprendidos IN-MEMORY desde los envíos COMPLETADOS ─────────────
  // Se computa una sola pasada sobre TODOS los envíos (ya cargados · sin queries extra):
  //   · Pierna VIAJERO (B) por colaboradorId · leadTimePiernaB (días en tránsito real).
  //   · Pierna PROVEEDOR (A) por origenProveedorId · leadTimePiernaA(subEnvios) (despacho→entrega).
  // Promedio por entidad + promedio GLOBAL de cada pierna como fallback honesto.
  const baselines = useMemo(() => {
    const viajeroVals = new Map<string, number[]>();
    const proveedorVals = new Map<string, number[]>();
    const viajeroGlobal: number[] = [];
    const proveedorGlobal: number[] = [];

    for (const e of envios) {
      if (!ESTADOS_ENVIO_COMPLETADO.includes(e.estado)) continue;

      // Pierna VIAJERO (B): días en tránsito reales del envío completado.
      const b = leadTimePiernaB(e);
      if (b != null && e.colaboradorId) {
        const arr = viajeroVals.get(e.colaboradorId) ?? [];
        arr.push(b);
        viajeroVals.set(e.colaboradorId, arr);
        viajeroGlobal.push(b);
      }

      // Pierna PROVEEDOR (A): despacho→entrega de las tandas del proveedor.
      const a = leadTimePiernaA(e.subEnvios);
      if (a != null && e.origenProveedorId) {
        const arr = proveedorVals.get(e.origenProveedorId) ?? [];
        arr.push(a);
        proveedorVals.set(e.origenProveedorId, arr);
        proveedorGlobal.push(a);
      }
    }

    const promedioPor = (m: Map<string, number[]>) => {
      const out = new Map<string, number>();
      for (const [k, v] of m) {
        const stat = resumirLeadTime(v);
        if (stat) out.set(k, stat.promedio);
      }
      return out;
    };

    return {
      viajeroPorId: promedioPor(viajeroVals),
      proveedorPorId: promedioPor(proveedorVals),
      viajeroGlobal: resumirLeadTime(viajeroGlobal)?.promedio ?? 0,
      proveedorGlobal: resumirLeadTime(proveedorGlobal)?.promedio ?? 0,
    };
  }, [envios]);

  // ─── Filas del radar (clasificadas por gravedad) ─────────────────────────
  const leadGlobal = leadTimeGlobal?.tiempoPromedioTotal ?? 0;
  // "hoy" estable por el ciclo de vida del componente (lazy initializer · impureza permitida en
  // useState · evita re-cálculo por re-render y la advertencia de pureza en useMemo).
  const [hoy] = useState(() => Date.now());

  const { filas, leadTimeFuente } = useMemo(() => {
    const out: FilaRadarLlegada[] = [];
    const fuentes = new Set<LeadTimeFuenteFila>();

    for (const orden of ordenesEnVuelo) {
      const envio = envioEnVueloPorOC.get(orden.id) ?? null;
      const prov = proveedorIndex.get(orden.proveedorId);

      // LEG-AWARE: ¿en qué pierna está la OC en vuelo? El envío YA salió ⇒ pierna VIAJERO en curso;
      // si NO salió aún ⇒ pierna PROVEEDOR en curso (esperando que despache a origen).
      const salidaMs = toMs(envio?.fechaSalida);
      const enViajero = salidaMs != null;

      // diasEnVuelo: cuenta desde el inicio de la PIERNA en curso.
      //   · viajero  → desde fechaSalida del envío.
      //   · proveedor → desde que la OC se confirmó/envió al proveedor (fechaEnviada · fallback creación).
      const inicioMs = enViajero
        ? salidaMs
        : (toMs(orden.fechaEnviada) ?? toMs(orden.fechaCreacion));
      if (inicioMs == null) continue;
      const diasEnVuelo = Math.floor((hoy - inicioMs) / MS_DIA);

      // Baseline de ESA pierna (entidad → global de pierna → leadTimeGlobal de cadena).
      const culpable: CulpableAtraso = enViajero ? 'viajero' : 'proveedor';
      const entidadId = enViajero ? envio?.colaboradorId : orden.proveedorId;
      const baseEntidad = enViajero
        ? (entidadId ? baselines.viajeroPorId.get(entidadId) : undefined)
        : (entidadId ? baselines.proveedorPorId.get(entidadId) : undefined);
      const baseGlobalPierna = enViajero ? baselines.viajeroGlobal : baselines.proveedorGlobal;

      let leadTimeEsperado = 0;
      let leadTimeFuenteFila: LeadTimeFuenteFila;
      if (baseEntidad != null && baseEntidad > 0) {
        leadTimeEsperado = baseEntidad;
        leadTimeFuenteFila = 'entidad';
      } else if (baseGlobalPierna > 0) {
        leadTimeEsperado = baseGlobalPierna;
        leadTimeFuenteFila = 'global-pierna';
      } else if (leadGlobal > 0) {
        // Último recurso HONESTO: no hay histórico de pierna → baseline de cadena entera.
        leadTimeEsperado = leadGlobal;
        leadTimeFuenteFila = 'global';
      } else {
        continue; // sin baseline NO se puede afirmar "va tarde" (no se inventa un número).
      }
      fuentes.add(leadTimeFuenteFila);

      const clas = clasificarAtraso(diasEnVuelo, leadTimeEsperado);
      if (!clas) continue; // no atrasado (ratio ≤ 1)

      const responsableNombre = enViajero
        ? (envio?.colaboradorNombre || 'Viajero')
        : (orden.nombreProveedor || prov?.nombre || 'Proveedor');

      out.push({
        id: orden.id,
        numero: envio?.numeroEnvio || orden.numeroOrden,
        proveedor: orden.nombreProveedor,
        diasEnVuelo,
        leadTimeEsperado: Math.round(leadTimeEsperado),
        ratio: clas.ratio,
        gravedad: clas.gravedad,
        capitalUSD: orden.totalUSD || 0,
        // HONESTIDAD: no existe campo de última señal de tracking (gap C4) → null → no-mudo.
        diasUltimaSenal: null,
        mudo: false,
        culpable,
        responsableNombre,
        leadTimeFuente: leadTimeFuenteFila,
        orden,
        envio,
        paisOrigen: orden.paisOrigen || envio?.origenProveedorPais || '—',
      });
    }

    const fuente: RadarAtrasadosResult['leadTimeFuente'] =
      fuentes.size === 0
        ? 'sin-baseline'
        : fuentes.size > 1
          ? 'mixto'
          : ([...fuentes][0] as LeadTimeFuenteFila);

    return { filas: ordenarRadar(out) as FilaRadarLlegada[], leadTimeFuente: fuente };
  }, [ordenesEnVuelo, envioEnVueloPorOC, proveedorIndex, baselines, leadGlobal, hoy]);

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
