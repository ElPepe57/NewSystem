/**
 * autorizacionEgreso.helper · F2 · LÓGICA PURA de autorización de egresos (lado Cloud Functions).
 *
 * ⚠️ MIRROR de src/services/autorizacionEgreso.helper.ts — mantener sincronizado (mismo patrón que
 * el MIRROR de PERMISOS en functions/index.ts). La app es la fuente de los 18 tests de esta lógica
 * (src/services/autorizacionEgreso.helper.test.ts); functions/ no tiene runner de tests · por eso se
 * porta IDÉNTICA, sin variar la regla. La consume la callable autorizarEgreso (admin SDK · enforcement
 * REAL · el cliente no puede saltarla). Ver docs/DEFENSA_EGRESOS_SERVER_SIDE.md.
 *
 * Modelo v3 · QUÓRUM PONDERADO POR EQUITY (decisión usuario 2026-06-22):
 *   - ≤ umbral USD → directo (autoridad de cargo · sin socios).
 *   - > umbral → las firmas de socios deben sumar > 50% del EQUITY ELEGIBLE (mayoría simple).
 *   - creador EXCLUIDO (su % no cuenta) · admin = override root · delegado carga el % del socio
 *     que lo delegó (varios socios → una persona acumula · sin doble-conteo).
 *
 * Sin I/O · puro.
 */

/** Umbral en USD landed por encima del cual un egreso requiere autorización de socios. */
export const UMBRAL_AUTORIZACION_SOCIO_USD = 1000;

/** Umbral de mayoría sobre el equity elegible · mayoría simple (estrictamente > 50%). */
export const UMBRAL_MAYORIA_EQUITY = 0.5;

/** ¿Este egreso (monto USD landed) requiere autorización de socios? */
export function requiereAutorizacionSocio(montoUSD: number): boolean {
  return (montoUSD || 0) > UMBRAL_AUTORIZACION_SOCIO_USD;
}

/**
 * Monto USD landed de un gasto (recomputado · NO se confía en un campo client-escrito).
 * USD → montoOriginal · otra moneda → montoPEN / tipoCambio (con fallback de TC).
 */
export function montoUSDDeGasto(
  g: { moneda: string; montoOriginal: number; montoPEN: number; tipoCambio?: number },
  tcFallback?: number,
): number {
  if (g.moneda === "USD") return g.montoOriginal;
  const tc = g.tipoCambio || tcFallback;
  return tc && tc > 0 ? g.montoPEN / tc : 0;
}

export interface SocioEquity {
  uid: string;
  /** % de participación societaria. La lógica usa RATIOS → unit-agnóstica (0-100 o 0-1 dan igual). */
  participacion: number;
}

export interface FirmaEgreso {
  /** Quién firmó (socio o delegado). */
  usuarioId: string;
  /** uids de socios cuyo equity REPRESENTA esta firma (él mismo si socio · los que lo delegaron si delegado). */
  representaSocios: string[];
  /** Timestamp opaco (no participa en la lógica pura). */
  fecha?: unknown;
}

/** Delegación reducida para el chequeo de vigencia + resolución de representación. */
export interface DelegacionLite {
  delegadoPor: string;
  delegadoAUsuario?: string;
  delegadoARol?: string;
  activa: boolean;
  desde?: unknown;
  hasta?: unknown;
}

export interface EvalAprobacionInput {
  montoUSD: number;
  socios: SocioEquity[];
  creadorId?: string | null;
  firmas: FirmaEgreso[];
  esAdminActor?: boolean;
  umbralMayoria?: number;
}

export interface EvalAprobacionResult {
  completa: boolean;
  requiereSocios: boolean;
  equityFirmado: number;
  equityElegible: number;
  equityFaltante: number;
  nota?: string;
}

/** Convierte un Firestore Timestamp opaco a ms (o null). */
function tsToMs(ts: unknown): number | null {
  if (!ts || typeof ts !== "object") return null;
  const t = ts as { toMillis?: () => number; seconds?: number };
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  return null;
}

/** ¿la delegación está VIGENTE en `ahoraMs`? (activa + dentro del rango desde/hasta). */
export function delegacionVigente(d: DelegacionLite, ahoraMs: number): boolean {
  if (!d.activa) return false;
  const hasta = tsToMs(d.hasta);
  if (hasta != null && hasta < ahoraMs) return false;
  const desde = tsToMs(d.desde);
  if (desde != null && desde > ahoraMs) return false;
  return true;
}

/**
 * Resuelve qué socios REPRESENTA un firmante (puro):
 *   - socio → se representa a sí mismo,
 *   - delegado (por usuario o por rol) de uno o más socios → representa el equity de cada socio que
 *     lo delegó (acumula · "potestad plena de los socios de delegar en una misma persona").
 * Solo cuenta delegaciones VIGENTES. Devuelve uids de socios DISTINTOS.
 */
export function sociosRepresentados(params: {
  firmanteUid: string;
  firmanteRoles: string[];
  socios: SocioEquity[];
  delegaciones: DelegacionLite[];
  ahoraMs: number;
}): string[] {
  const { firmanteUid, firmanteRoles, socios, delegaciones, ahoraMs } = params;
  const sociosUids = new Set(socios.map((s) => s.uid));
  const result = new Set<string>();
  if (sociosUids.has(firmanteUid)) result.add(firmanteUid);
  for (const d of delegaciones) {
    if (!delegacionVigente(d, ahoraMs)) continue;
    const leDelegaron =
      (!!d.delegadoAUsuario && d.delegadoAUsuario === firmanteUid) ||
      (!!d.delegadoARol && firmanteRoles.includes(d.delegadoARol));
    if (leDelegaron && sociosUids.has(d.delegadoPor)) result.add(d.delegadoPor);
  }
  return [...result];
}

/**
 * Evalúa si un egreso >umbral queda autorizado bajo el QUÓRUM PONDERADO POR EQUITY.
 * Ver el JSDoc del header. Puro · sin I/O.
 */
export function evaluarAprobacionEgreso(input: EvalAprobacionInput): EvalAprobacionResult {
  const { montoUSD, socios, creadorId, firmas, esAdminActor, umbralMayoria = UMBRAL_MAYORIA_EQUITY } = input;

  if (!requiereAutorizacionSocio(montoUSD)) {
    return { completa: true, requiereSocios: false, equityFirmado: 0, equityElegible: 0, equityFaltante: 0 };
  }

  if (esAdminActor) {
    return {
      completa: true,
      requiereSocios: true,
      equityFirmado: 0,
      equityElegible: 0,
      equityFaltante: 0,
      nota: "Aprobado por admin (override root · canon admin=root).",
    };
  }

  const elegibles = socios.filter((s) => s.uid !== creadorId);
  const equityElegible = elegibles.reduce((sum, s) => sum + (s.participacion || 0), 0);

  if (equityElegible <= 0) {
    return {
      completa: false,
      requiereSocios: true,
      equityFirmado: 0,
      equityElegible: 0,
      equityFaltante: 0,
      nota: "Sin socios elegibles (el creador es el único socio) · requiere aprobación de admin.",
    };
  }

  const sociosFirmantes = new Set<string>();
  for (const f of firmas) {
    for (const uid of f.representaSocios || []) {
      if (uid !== creadorId && elegibles.some((s) => s.uid === uid)) sociosFirmantes.add(uid);
    }
  }
  const equityFirmado = elegibles
    .filter((s) => sociosFirmantes.has(s.uid))
    .reduce((sum, s) => sum + (s.participacion || 0), 0);

  const requerido = umbralMayoria * equityElegible;
  const completa = equityFirmado > requerido;
  return {
    completa,
    requiereSocios: true,
    equityFirmado,
    equityElegible,
    equityFaltante: completa ? 0 : Math.max(0, requerido - equityFirmado),
  };
}
