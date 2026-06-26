/**
 * sla.helper · F4 · B1 (Bandeja del aprobador) · envejecimiento/SLA de la cola de aprobación.
 *
 * Núcleo PURO. Un req pendiente "envejece": cuanto más tiempo lleva sin decidirse, más urgente
 * es resolverlo — sobre todo la DEMANDA COMPROMETIDA (un cliente que pagó y está esperando escala
 * más rápido que un restock administrativo). `fechaRequerida` existe en el tipo pero no se usaba;
 * acá el dato cobra vida. `ahoraMs` se inyecta para testabilidad (el componente pasa Date.now()).
 */
import type { Requerimiento } from '../../types/requerimiento.types';

export type NivelSLA = 'fresco' | 'envejeciendo' | 'critico';

export interface SLARequerimiento {
  diasPendiente: number;
  nivel: NivelSLA;
  esComprometida: boolean;   // la demanda comprometida escala más rápido
}

// Umbrales (heurística refinable). La demanda comprometida (cliente pagó esperando) escala antes.
const UMBRAL_AMBER_NORMAL = 2;
const UMBRAL_ROSE_NORMAL = 5;
const UMBRAL_AMBER_COMPROMETIDA = 1;
const UMBRAL_ROSE_COMPROMETIDA = 3;

const MS_POR_DIA = 1000 * 60 * 60 * 24;

/** Extrae millis de un Timestamp de Firestore, un número, o null. */
function toMillis(ts: unknown): number | null {
  if (ts == null) return null;
  const t = ts as { toMillis?: () => number };
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof ts === 'number') return ts;
  return null;
}

export function calcularSLA(req: Requerimiento, ahoraMs: number): SLARequerimiento {
  const creadaMs = toMillis(req.fechaCreacion) ?? toMillis(req.fechaSolicitud) ?? ahoraMs;
  const diasPendiente = Math.max(0, Math.floor((ahoraMs - creadaMs) / MS_POR_DIA));
  const esComprometida = req.origen === 'demanda_comprometida';
  const umbralAmber = esComprometida ? UMBRAL_AMBER_COMPROMETIDA : UMBRAL_AMBER_NORMAL;
  const umbralRose = esComprometida ? UMBRAL_ROSE_COMPROMETIDA : UMBRAL_ROSE_NORMAL;
  const nivel: NivelSLA =
    diasPendiente >= umbralRose ? 'critico' : diasPendiente >= umbralAmber ? 'envejeciendo' : 'fresco';
  return { diasPendiente, nivel, esComprometida };
}
