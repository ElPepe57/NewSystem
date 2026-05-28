// src/types/solicitudAccesoExterno.types.ts
// chk5.PERSONAS-v5.9 · Self-service de Acceso para Externos (2026-05-28)
//
// Modela la solicitud que un externo (proveedor · cliente · transportista ·
// colaborador) realiza desde la página pública /solicitar-acceso para pedir
// acceso al portal de Vita Skin.
//
// IMPORTANTE · es PRE-STAGE: NO crea UserProfile hasta que admin aprueba.
// Vive en colección propia · admin tiene bandeja con badge "🔔 N pendientes".
//
// Ciclo de vida:
//   1. Externo llena /solicitar-acceso → solicitud creada · estado='pendiente'
//   2. Admin abre solicitud · 3 acciones posibles:
//      ✓ Aprobar       → CF aprobarSolicitudAcceso() crea UserProfile +
//                        RelacionLaboral + Invitacion atómicamente
//                        estado → 'aprobada'
//      ✗ Rechazar      → estado → 'rechazada' · email al solicitante
//      ❓ Pedir info    → estado → 'info_solicitada' · email pidiendo aclaración
//   3. Después de 30 días sin procesar → estado → 'caducada' (cron job)
//
// Reusa infra existente:
//   - Invitacion type (invitacion.types.ts) · token + caducidad + Resend
//   - approveUser CF (extendida con entidadMaestroRef)
//   - SetupPassword.tsx (no cambia)
//
// Seguridad:
//   - Página pública /solicitar-acceso protegida por reCAPTCHA v3 + rate limit
//   - Validación server-side: email no existe en users/ · email no es de staff
//   - IP/UA tracked para anti-fraude
//   - Firestore rules: allow create público (con validaciones) · read/update solo admin

import { Timestamp } from 'firebase/firestore';
import type { TipoEntidadMaestro } from './relacionLaboral.types';

// ═════════════════════════════════════════════════════════════════════════
// ENUMS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Estados del ciclo de vida de una solicitud de acceso.
 *
 * Transiciones válidas:
 *   pendiente        → info_solicitada (admin pidió aclaración)
 *   pendiente        → aprobada        (admin OK)
 *   pendiente        → rechazada       (admin NO)
 *   pendiente        → caducada        (30d sin procesar · cron)
 *   info_solicitada  → pendiente       (solicitante respondió · admin re-revisa)
 *   info_solicitada  → aprobada / rechazada
 */
export type EstadoSolicitudAcceso =
  | 'pendiente'
  | 'info_solicitada'
  | 'aprobada'
  | 'rechazada'
  | 'caducada';

/**
 * Tipo de relación que el solicitante DECLARA tener con el negocio.
 * Es lo que el admin verá para decidir aprobar · NO se crea aún la relación real.
 */
export type TipoRelacionSolicitada =
  | 'proveedor'      // Soy contacto de un proveedor
  | 'cliente'        // Soy cliente (persona o empresa)
  | 'transportista'  // Trabajo en logística
  | 'colaborador'    // Influencer · marca aliada · agencia
  | 'otro';          // No encaja en los anteriores

// ═════════════════════════════════════════════════════════════════════════
// VINCULACIÓN SUGERIDA (snapshot)
// El solicitante puede pre-vincular con un Maestro existente (proveedor ·
// cliente · marca) usando el buscador del form. Es una SUGERENCIA · el admin
// la confirma o cambia al aprobar.
// ═════════════════════════════════════════════════════════════════════════

export interface EntidadMaestroRefSugerida {
  tipo: TipoEntidadMaestro;
  id: string;
  /** Snapshot del nombre al momento de la solicitud · cached read */
  nombreCachedSnapshot: string;
}

// ═════════════════════════════════════════════════════════════════════════
// HISTORIAL DE ESTADOS
// Cada cambio de estado queda registrado · audit trail completo.
// ═════════════════════════════════════════════════════════════════════════

export interface HistorialEstadoSolicitud {
  estado: EstadoSolicitudAcceso;
  fecha: Timestamp;
  porUid?: string; // null si es transición automática (caducada)
  nota?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// ENTIDAD PRINCIPAL · SolicitudAccesoExterno
// ═════════════════════════════════════════════════════════════════════════

export interface SolicitudAccesoExterno {
  /** Doc id auto-generado · sirve como referencia en emails */
  id: string;

  /** Cuándo se creó · pre-stage · todavía no es User */
  fechaCreacion: Timestamp;

  /** Estado del ciclo de vida */
  estado: EstadoSolicitudAcceso;

  // ── Datos del solicitante · captados en el form ────────────────────────
  nombreCompleto: string;
  email: string;
  telefono?: string;

  // ── Tipo de relación declarada ─────────────────────────────────────────
  tipoRelacion: TipoRelacionSolicitada;

  // ── Pre-vinculación con Maestro (opcional) ─────────────────────────────
  /**
   * El solicitante usó el buscador y pre-vinculó con una entidad de Maestros.
   * Si null · el admin tendrá que decidir/crear al aprobar.
   */
  entidadMaestroRefSugerida?: EntidadMaestroRefSugerida;

  /** Cargo declarado en la entidad · ej. "Sales Representative" */
  cargoEnEntidad?: string;

  // ── Motivo y referencia ────────────────────────────────────────────────
  /** Texto libre · por qué necesita acceso (min 20 chars) */
  motivo: string;

  /** Opcional · nombre del contacto interno que lo refirió */
  recomendadoPor?: string;

  // ── Tracking anti-fraude ───────────────────────────────────────────────
  ipAddress: string;
  userAgent: string;
  /** Score de reCAPTCHA v3 (0.0 a 1.0 · más alto = más humano) */
  reCaptchaScore: number;

  // ── Resolución (cuando admin actúa) ────────────────────────────────────
  /** uid del admin que procesó (aprobó · rechazó · pidió info) */
  procesadaPor?: string;
  fechaProcesamiento?: Timestamp;

  /** Texto libre · motivo de la decisión · visible al solicitante en email */
  motivoDecision?: string;

  /** Si aprobada · uid del UserProfile creado · cross-reference */
  uidUsuarioCreado?: string;

  /** Si aprobada · id de la Invitacion enviada · cross-reference */
  invitacionId?: string;

  // ── Audit trail completo ───────────────────────────────────────────────
  historialEstados: HistorialEstadoSolicitud[];

  /** Veces que el solicitante respondió a "info_solicitada" · contra spam */
  ciclosInfoSolicitada: number;
}

// ═════════════════════════════════════════════════════════════════════════
// INPUTS · creación desde página pública · aprobación admin
// ═════════════════════════════════════════════════════════════════════════

/**
 * Datos que envía la página pública /solicitar-acceso.
 * NO contiene IP/UA/score · esos los agrega el server al persistir.
 */
export interface CrearSolicitudAccesoInput {
  nombreCompleto: string;
  email: string;
  telefono?: string;
  tipoRelacion: TipoRelacionSolicitada;
  entidadMaestroRefSugerida?: EntidadMaestroRefSugerida;
  cargoEnEntidad?: string;
  motivo: string;
  recomendadoPor?: string;
  /** Token reCAPTCHA v3 · validado server-side */
  recaptchaToken: string;
}

/**
 * Input para aprobar una solicitud · usado por CF aprobarSolicitudAcceso.
 * El admin confirma/edita la vinculación con Maestro antes de aprobar.
 */
export interface AprobarSolicitudInput {
  solicitudId: string;
  rolesAsignados: string[]; // UserRole[] · típicamente ['invitado']
  /** Vinculación FINAL (puede diferir de la sugerida) */
  entidadMaestroRef?: {
    tipo: TipoEntidadMaestro;
    id: string;
    rolEnEntidad?: string;
  };
  /** Mensaje personalizado del admin al solicitante · va en email */
  mensajePersonalizado?: string;
}

export interface RechazarSolicitudInput {
  solicitudId: string;
  motivoDecision: string;
}

export interface PedirInfoSolicitudInput {
  solicitudId: string;
  preguntaAlSolicitante: string;
}

// ═════════════════════════════════════════════════════════════════════════
// LABELS Y COLORS CANON · UI
// ═════════════════════════════════════════════════════════════════════════

export const ESTADO_SOLICITUD_LABELS: Record<EstadoSolicitudAcceso, string> = {
  pendiente:        'Pendiente',
  info_solicitada:  'Info solicitada',
  aprobada:         'Aprobada',
  rechazada:        'Rechazada',
  caducada:         'Caducada',
};

export const ESTADO_SOLICITUD_ICONS: Record<EstadoSolicitudAcceso, string> = {
  pendiente:        '📥',
  info_solicitada:  '❓',
  aprobada:         '✅',
  rechazada:        '❌',
  caducada:         '⏱️',
};

export const ESTADO_SOLICITUD_COLORS: Record<EstadoSolicitudAcceso, { bg: string; text: string }> = {
  pendiente:        { bg: 'bg-amber-100',   text: 'text-amber-700' },
  info_solicitada:  { bg: 'bg-blue-100',    text: 'text-blue-700' },
  aprobada:         { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  rechazada:        { bg: 'bg-rose-100',    text: 'text-rose-700' },
  caducada:         { bg: 'bg-slate-100',   text: 'text-slate-600' },
};

export const TIPO_RELACION_SOLICITADA_LABELS: Record<TipoRelacionSolicitada, string> = {
  proveedor:     'Soy proveedor',
  cliente:       'Soy cliente',
  transportista: 'Soy transportista',
  colaborador:   'Soy colaborador · influencer · agencia',
  otro:          'Otra relación',
};

export const TIPO_RELACION_SOLICITADA_ICONS: Record<TipoRelacionSolicitada, string> = {
  proveedor:     '🛒',
  cliente:       '💼',
  transportista: '🚚',
  colaborador:   '🤝',
  otro:          '👤',
};

// ═════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═════════════════════════════════════════════════════════════════════════

/** Días tras los que una solicitud pendiente se marca caducada (cron job) */
export const SOLICITUD_CADUCIDAD_DEFAULT_DIAS = 30;

/** Máximo de ciclos info_solicitada antes de auto-rechazar · anti-spam */
export const MAX_CICLOS_INFO_SOLICITADA = 2;

/** Score mínimo de reCAPTCHA para aceptar sin revisión humana adicional */
export const RECAPTCHA_SCORE_MIN_ACEPTABLE = 0.5;

/** Largo mínimo del motivo · evita spam de solicitudes vacías */
export const MOTIVO_MIN_CHARS = 20;

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

/**
 * Chequea si una solicitud está en estado "esperando admin" (procesable).
 * Excluye estados finales (aprobada · rechazada · caducada).
 */
export function esSolicitudProcesable(solicitud: SolicitudAccesoExterno): boolean {
  return solicitud.estado === 'pendiente' || solicitud.estado === 'info_solicitada';
}

/**
 * Chequea si una solicitud quedó en estado final · no se puede tocar más.
 */
export function esEstadoFinal(estado: EstadoSolicitudAcceso): boolean {
  return estado === 'aprobada' || estado === 'rechazada' || estado === 'caducada';
}

/**
 * Calcula si la solicitud está cerca de caducar (queda <7 días).
 * Útil para destacarla en la bandeja del admin.
 */
export function estaCercaDeCaducar(
  solicitud: SolicitudAccesoExterno,
  diasMaximos: number = SOLICITUD_CADUCIDAD_DEFAULT_DIAS,
): boolean {
  if (esEstadoFinal(solicitud.estado)) return false;
  const ahora = Date.now();
  const creacion = solicitud.fechaCreacion.toMillis();
  const diasTranscurridos = (ahora - creacion) / (1000 * 60 * 60 * 24);
  return diasTranscurridos > diasMaximos - 7;
}
