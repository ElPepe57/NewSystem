/**
 * autorizacionEgreso.helper · F4 · LÓGICA PURA de autorización de egresos.
 *
 * Fuente ÚNICA de "¿cuándo necesita un egreso la firma de un socio, y quién puede
 * firmarlo?". La consumen TODOS los egresos del ERP (requerimientos, gastos, pagos
 * de OC, adelantos, movimientos de tesorería) para que la regla sea idéntica en todos
 * lados — no copiada por módulo (anti-parche · principio rector 360).
 *
 * Modelo de tramos (decisión del usuario 2026-06-21, uniforme para todo egreso):
 *   - monto USD landed ≤ UMBRAL  → DIRECTO · autoridad del cargo · sin firma de socio.
 *   - monto USD landed >  UMBRAL  → autorización de socios.
 *
 * "Pura autoridad del socio": los cargos (gerente/comprador/admin) crean y operan,
 * pero la firma que libera la plata por encima del umbral es del dueño (socio).
 *
 * MODELO DE AUTORIZACIÓN >UMBRAL · v3 · QUÓRUM PONDERADO POR EQUITY (decisión usuario 2026-06-22):
 *   - NO es "2 firmas": las firmas de socios deben sumar > 50% del EQUITY ELEGIBLE (mayoría simple).
 *   - El CREADOR queda excluido: su % no cuenta · la mayoría se mide sobre el equity de los demás
 *     socios (si no, un socio >50% quedaría en deadlock para sus propios egresos).
 *   - ADMIN = override root (aprueba solo · canon admin=root · excepción declarada).
 *   - DELEGADO carga el % del socio que lo delegó · varios socios pueden delegar en la misma persona
 *     (acumula equity · sin doble-conteo del mismo socio).
 *   → `evaluarAprobacionEgreso` + `sociosRepresentados`. La fn count-based legacy (`evaluarFirmaSocio`)
 *     queda hasta el cableado de F2 (ver docs/DEFENSA_EGRESOS_SERVER_SIDE.md).
 *
 * Sin I/O · 100% testeable.
 */

/** Umbral en USD landed por encima del cual un egreso requiere doble firma de socios. */
export const UMBRAL_AUTORIZACION_SOCIO_USD = 1000;

/** Nº de firmas de socio para el tramo de doble firma. */
const FIRMAS_SOCIO_REQUERIDAS = 2;

export type TramoEgreso = 'directo' | 'doble_socio';

export interface FirmaSocio {
  usuarioId: string;
  nombre?: string;
  /** Timestamp de la firma (Firestore Timestamp · opaco para la lógica pura). */
  fecha?: unknown;
}

/** Tramo de autorización según el monto USD landed. */
export function tramoEgreso(montoUSD: number): TramoEgreso {
  return (montoUSD || 0) > UMBRAL_AUTORIZACION_SOCIO_USD ? 'doble_socio' : 'directo';
}

/** ¿Este egreso requiere autorización (firma) de socios? */
export function requiereAutorizacionSocio(montoUSD: number): boolean {
  return tramoEgreso(montoUSD) === 'doble_socio';
}

/** Nº de firmas de socio requeridas para autorizar este egreso (0 si es directo). */
export function firmasSocioRequeridas(montoUSD: number): number {
  return requiereAutorizacionSocio(montoUSD) ? FIRMAS_SOCIO_REQUERIDAS : 0;
}

export interface EvalFirmaInput {
  /** Monto USD landed del egreso (define el tramo). */
  montoUSD: number;
  /** Firmas de socio ya registradas sobre este egreso. */
  firmas: FirmaSocio[];
  /** Usuario que intenta firmar ahora. */
  userId: string;
  /** ¿El usuario que firma tiene rol socio? */
  esSocio: boolean;
  /** Quién creó/solicitó el egreso (para segregación de funciones). */
  creadorId?: string | null;
}

export interface EvalFirmaResult {
  /** ¿La firma de este usuario es válida y se puede registrar? */
  ok: boolean;
  /** Motivo del rechazo (si ok=false). */
  error?: string;
  /** Tras registrar esta firma, ¿el egreso queda completamente autorizado? */
  completa: boolean;
  /** Firmas de socio que faltan tras registrar la de este usuario. */
  faltanFirmas: number;
}

/**
 * @deprecated v3 · reemplazada por `evaluarAprobacionEgreso` (quórum por equity). Se mantiene
 * hasta el cableado de F2 (servicios cliente la usan todavía). Ver docs/DEFENSA_EGRESOS_SERVER_SIDE.md.
 *
 * Evalúa si un usuario puede registrar su firma de socio sobre un egreso del tramo
 * de doble firma, validando:
 *   - el egreso efectivamente requiere socio (tramo > umbral),
 *   - el firmante es socio,
 *   - segregación: el creador no firma lo suyo,
 *   - no firma dos veces.
 * Y si, con su firma, el egreso queda autorizado (2 firmas distintas).
 */
export function evaluarFirmaSocio(input: EvalFirmaInput): EvalFirmaResult {
  const { montoUSD, firmas, userId, esSocio, creadorId } = input;
  const requeridas = firmasSocioRequeridas(montoUSD);

  // Tramo directo (≤ umbral): no se firma como socio · lo resuelve la autoridad del cargo.
  if (requeridas === 0) {
    return {
      ok: false,
      error: 'Este egreso no requiere autorización de socio (≤ umbral · directo por cargo).',
      completa: true,
      faltanFirmas: 0,
    };
  }

  const faltanAntes = Math.max(0, requeridas - firmas.length);

  if (!esSocio) {
    return { ok: false, error: 'Solo los socios (dueños) pueden autorizar egresos sobre el umbral.', completa: false, faltanFirmas: faltanAntes };
  }
  if (creadorId && creadorId === userId) {
    return { ok: false, error: 'No podés autorizar tu propio egreso · debe firmarlo otro socio.', completa: false, faltanFirmas: faltanAntes };
  }
  if (firmas.some((f) => f.usuarioId === userId)) {
    return { ok: false, error: 'Ya firmaste este egreso.', completa: false, faltanFirmas: faltanAntes };
  }

  const totalTrasFirma = firmas.length + 1;
  return {
    ok: true,
    completa: totalTrasFirma >= requeridas,
    faltanFirmas: Math.max(0, requeridas - totalTrasFirma),
  };
}

/**
 * ¿Este usuario puede aprobar/autorizar este egreso AHORA? (para gating de UI · botón Firmar).
 * Combina el tramo con la autoridad: ≤ umbral → autoridad de cargo · > umbral → socio.
 */
export function puedeAutorizarEgreso(params: {
  montoUSD: number;
  esSocio: boolean;
  tieneAutoridadCargo: boolean;
}): boolean {
  const { montoUSD, esSocio, tieneAutoridadCargo } = params;
  return requiereAutorizacionSocio(montoUSD) ? esSocio : tieneAutoridadCargo;
}

// ════════════════════════════════════════════════════════════════════════════════
// MODELO v3 · QUÓRUM PONDERADO POR EQUITY (decisión usuario 2026-06-22)
// La autorización >umbral no es "2 firmas" · es una MAYORÍA del equity societario.
// ════════════════════════════════════════════════════════════════════════════════

/** Umbral de mayoría sobre el equity elegible · mayoría simple (estrictamente > 50%). */
export const UMBRAL_MAYORIA_EQUITY = 0.5;

/** Resultado que devuelve la Cloud Function `autorizarEgreso` al cliente (F2). */
export interface ResultadoAutorizacionCF {
  completa: boolean;
  equityFirmado: number;
  equityElegible: number;
  equityFaltante: number;
}

export interface SocioEquity {
  uid: string;
  /** % de participación societaria. La lógica usa RATIOS → es unit-agnóstica (0-100 o 0-1 dan igual). */
  participacion: number;
}

export interface FirmaEgreso {
  /** Quién firmó (socio o delegado). */
  usuarioId: string;
  /**
   * uids de los socios cuyo equity REPRESENTA esta firma: él mismo si es socio · los socios que lo
   * delegaron si es delegado. Pre-resuelto por `sociosRepresentados` (que necesita las delegaciones).
   */
  representaSocios: string[];
}

export interface EvalAprobacionInput {
  /** Monto USD landed del egreso (define si requiere socios). */
  montoUSD: number;
  /** TODOS los socios del negocio con su % (base del quórum). */
  socios: SocioEquity[];
  /** Quién creó el egreso · su equity NO cuenta (segregación · decisión usuario). */
  creadorId?: string | null;
  /** Firmas acumuladas (cada una con los socios que representa). */
  firmas: FirmaEgreso[];
  /** El actor actual es admin → override root (aprueba solo · canon admin=root). */
  esAdminActor?: boolean;
  /** Umbral de mayoría (default 0.5 · estrictamente > 50%). */
  umbralMayoria?: number;
}

export interface EvalAprobacionResult {
  /** ¿El egreso queda autorizado con las firmas actuales? */
  completa: boolean;
  /** ¿Requiere autorización de socios? (false si ≤ umbral USD · directo por cargo). */
  requiereSocios: boolean;
  /** Equity firmado · socios elegibles distintos representados (sin el creador · sin doble-conteo). */
  equityFirmado: number;
  /** Equity elegible total (todos los socios menos el creador). */
  equityElegible: number;
  /** Equity que falta para superar la mayoría (0 si ya está). */
  equityFaltante: number;
  /** Nota contextual (override admin · sin electorado · etc.). */
  nota?: string;
}

/**
 * Resuelve qué socios REPRESENTA una firma (puro · sin I/O · recibe las delegaciones ya cargadas):
 *   - si el firmante es socio → se representa a sí mismo (su equity),
 *   - si es delegado (por usuario o por su rol) de uno o más socios → representa el equity de cada
 *     socio que lo delegó (acumula · "completa potestad de los socios autorizar a una misma persona").
 * Devuelve uids de socios DISTINTOS (un Set colapsado a array).
 */
export function sociosRepresentados(params: {
  firmanteUid: string;
  firmanteRoles: string[];
  socios: SocioEquity[];
  delegacionesVigentes: { delegadoPor: string; delegadoAUsuario?: string; delegadoARol?: string }[];
}): string[] {
  const { firmanteUid, firmanteRoles, socios, delegacionesVigentes } = params;
  const sociosUids = new Set(socios.map((s) => s.uid));
  const result = new Set<string>();
  // Socio firmando por sí mismo.
  if (sociosUids.has(firmanteUid)) result.add(firmanteUid);
  // Delegado: representa a cada socio que lo delegó (por usuario o por rol).
  for (const d of delegacionesVigentes) {
    const leDelegaron =
      (!!d.delegadoAUsuario && d.delegadoAUsuario === firmanteUid) ||
      (!!d.delegadoARol && firmanteRoles.includes(d.delegadoARol));
    if (leDelegaron && sociosUids.has(d.delegadoPor)) result.add(d.delegadoPor);
  }
  return [...result];
}

/**
 * Evalúa si un egreso >umbral queda autorizado bajo el modelo de QUÓRUM PONDERADO POR EQUITY:
 *   - ≤ umbral → directo (no requiere socios).
 *   - admin actor → override root (aprueba solo · canon admin=root).
 *   - si no → las firmas de socios DISTINTOS (excluido el creador) deben sumar > 50% del equity
 *     ELEGIBLE (= equity de todos los socios menos el creador).
 *   - sin electorado (el único socio es el creador) → no se puede por la vía socio · requiere admin.
 * Puro · sin I/O. El servicio/CF carga `socios` + resuelve `representaSocios` (vía `sociosRepresentados`).
 */
export function evaluarAprobacionEgreso(input: EvalAprobacionInput): EvalAprobacionResult {
  const { montoUSD, socios, creadorId, firmas, esAdminActor, umbralMayoria = UMBRAL_MAYORIA_EQUITY } = input;

  // Tramo directo (≤ umbral): no requiere socios.
  if (!requiereAutorizacionSocio(montoUSD)) {
    return { completa: true, requiereSocios: false, equityFirmado: 0, equityElegible: 0, equityFaltante: 0 };
  }

  // Override root: admin aprueba solo (decisión usuario · canon admin=root).
  if (esAdminActor) {
    return {
      completa: true,
      requiereSocios: true,
      equityFirmado: 0,
      equityElegible: 0,
      equityFaltante: 0,
      nota: 'Aprobado por admin (override root · canon admin=root).',
    };
  }

  // Electorado: todos los socios MENOS el creador (su equity no cuenta en su propio egreso).
  const elegibles = socios.filter((s) => s.uid !== creadorId);
  const equityElegible = elegibles.reduce((sum, s) => sum + (s.participacion || 0), 0);

  // Sin electorado (ej. el único socio es el creador) → solo admin puede.
  if (equityElegible <= 0) {
    return {
      completa: false,
      requiereSocios: true,
      equityFirmado: 0,
      equityElegible: 0,
      equityFaltante: 0,
      nota: 'Sin socios elegibles (el creador es el único socio) · requiere aprobación de admin.',
    };
  }

  // Socios DISTINTOS cuya firma está representada (sin doble-conteo · sin el creador).
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
  const completa = equityFirmado > requerido; // mayoría SIMPLE · estrictamente > 50%
  return {
    completa,
    requiereSocios: true,
    equityFirmado,
    equityElegible,
    equityFaltante: completa ? 0 : Math.max(0, requerido - equityFirmado),
  };
}
