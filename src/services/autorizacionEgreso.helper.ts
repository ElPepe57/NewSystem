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
 *   - monto USD landed >  UMBRAL  → DOBLE FIRMA · 2 socios distintos · ninguno el creador.
 *
 * "Pura autoridad del socio": los cargos (gerente/comprador/admin) crean y operan,
 * pero la firma que libera la plata por encima del umbral es del dueño (socio).
 *
 * Sin I/O · 100% testeable.
 */

/** Umbral en USD landed por encima del cual un egreso requiere doble firma de socios. */
export const UMBRAL_AUTORIZACION_SOCIO_USD = 1000;

/** Nº de firmas de socio para el tramo de doble firma. */
export const FIRMAS_SOCIO_REQUERIDAS = 2;

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
