// src/types/invitacion.types.ts
// chk5.F4-USERS (2026-05-25) · Invitaciones por email
//
// Modelo de invitación enviada por admin a un email externo. La invitación
// genera un token único firmado (JWT) que el invitado usa para acceder a
// /setup-password/:token y completar su registro.
//
// Ciclo de vida:
//   1. Admin crea invitación → estado: 'enviada'
//   2. Email enviado vía Resend → tracking inicial
//   3. User clickea link → estado: 'link_abierto' (visto)
//   4. User completa setup-password → user creado en /users con estado 'activo'
//                                   → invitación: 'aceptada'
//   5. Si pasa caducidad (7d default) sin aceptar → 'expirada'
//   6. Admin cancela manualmente → 'cancelada'

import { Timestamp } from 'firebase/firestore';
import type { UserRole } from './auth.types';

export type InvitacionEstado =
  | 'enviada'         // Email enviado · esperando que user clickee
  | 'link_abierto'    // User abrió el link (signal de que vio el email)
  | 'aceptada'        // User completó setup-password · cuenta activa
  | 'expirada'        // Pasaron 7d sin aceptar (auto-rechazo)
  | 'cancelada';      // Admin canceló manualmente

export interface Invitacion {
  /** ID del documento (auto-generado) · también es el "token corto" del link */
  id: string;

  // ── Destinatario ────────────────────────────────────────────────────────
  email: string;
  nombreSugerido?: string;     // Opcional · admin pre-cargó nombre

  // ── Rol pre-asignado · admin decide ─────────────────────────────────────
  /**
   * Roles que el usuario tendrá al activar la cuenta. Por seguridad · roles
   * sensibles (admin · gerente · socio) NO se permiten en invitaciones
   * automáticas · admin tiene que configurarlos manualmente post-aprobación.
   *
   * Validación server-side en CF `inviteUser`.
   */
  rolesPreAsignados: UserRole[];

  // ── Quien envió ─────────────────────────────────────────────────────────
  invitadoPor: string;          // uid del admin
  invitadoPorNombre: string;    // displayName cached del admin (para email)

  // ── Mensaje personalizado del admin · va en el email ────────────────────
  mensajePersonalizado?: string;

  // ── Estado y tracking ──────────────────────────────────────────────────
  estado: InvitacionEstado;
  fechaEnvio: Timestamp;
  fechaCaducidad: Timestamp;    // fechaEnvio + 7 días (configurable)
  fechaLinkAbierto?: Timestamp; // Cuándo user clickeó por primera vez
  fechaAceptacion?: Timestamp;  // Cuándo user completó setup-password
  fechaCancelacion?: Timestamp; // Cuándo admin canceló
  canceladaPor?: string;        // uid del admin que canceló

  // ── Resultado · una vez aceptada ────────────────────────────────────────
  /** uid del UserProfile creado al aceptar · cross-reference */
  uidUsuarioCreado?: string;

  // ── Re-envíos · admin puede re-enviar el email ─────────────────────────
  reEnviosCount: number;
  ultimoReEnvio?: Timestamp;

  // ── Token firmado (JWT) almacenado en HMAC para validación ──────────────
  /**
   * Hash del token completo (NO el token plain). El token plain se manda
   * solo por email y el frontend lo pasa a CF para validar. Server compara
   * hash. Esto previene leaks aún si Firestore es comprometido.
   */
  tokenHash: string;
}

// ═════════════════════════════════════════════════════════════════════════
// Input para crear invitación (admin) · lo que se manda a CF inviteUser
// ═════════════════════════════════════════════════════════════════════════
export interface CrearInvitacionInput {
  email: string;
  nombreSugerido?: string;
  rolesPreAsignados: UserRole[];
  mensajePersonalizado?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// Labels y colors canon por estado (UI)
// ═════════════════════════════════════════════════════════════════════════
export const INVITACION_ESTADO_LABELS: Record<InvitacionEstado, string> = {
  enviada: 'Enviada',
  link_abierto: 'Link abierto',
  aceptada: 'Aceptada',
  expirada: 'Expirada',
  cancelada: 'Cancelada',
};

export const INVITACION_ESTADO_COLORS: Record<InvitacionEstado, { bg: string; text: string }> = {
  enviada: { bg: 'bg-amber-100', text: 'text-amber-700' },
  link_abierto: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  aceptada: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  expirada: { bg: 'bg-slate-100', text: 'text-slate-600' },
  cancelada: { bg: 'bg-rose-100', text: 'text-rose-700' },
};

/**
 * Roles permitidos para pre-asignar en una invitación.
 * SENSIBLES (admin · gerente · socio) se EXCLUYEN por seguridad.
 * Admin debe asignarlos manualmente después de aprobar.
 */
export const ROLES_PERMITIDOS_INVITACION: UserRole[] = [
  'vendedor',
  'comprador',
  'almacenero',
  'finanzas',
  'supervisor',
  'invitado',
];

/**
 * Días default de caducidad de una invitación.
 * Configurable en ConfigUsuarios → policyInvitacion.
 */
export const INVITACION_CADUCIDAD_DEFAULT_DIAS = 7;
