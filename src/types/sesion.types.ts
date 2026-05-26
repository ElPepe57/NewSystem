// src/types/sesion.types.ts
// chk5.F4-USERS (2026-05-25) · Sistema de sesiones activas
//
// Firebase Auth no tiene listado nativo de sesiones activas. Para que
// funcione la pestaña "Sesiones" en Ficha 360 + el modal "Desconectar
// todas" implementamos tracking custom en Firestore.
//
// Lifecycle:
//   1. User hace login (email/pass o Google) → crear doc en sessions
//   2. En cada request relevante → actualizar lastActive
//   3. User hace logout → marcar doc como cerrada (o eliminar)
//   4. Admin "Desconectar" → CF revoca refresh token (admin.auth().revokeRefreshTokens)
//      + elimina doc · próxima request del user dispara auth/internal-error
//   5. Refresh token TTL (Firebase default 30d) → doc se considera expirado

import { Timestamp } from 'firebase/firestore';

export interface SesionActiva {
  /** ID del documento · usa el sessionId interno (uuid generado al login) */
  id: string;
  uid: string;                  // user dueño de la sesión

  // ── Tracking de dispositivo ────────────────────────────────────────────
  device: string;               // "Chrome · Windows 10" · derivado del UA
  browser: string;              // "Chrome 121"
  os: string;                   // "Windows 10"
  userAgent: string;            // UA completo · raw
  ip?: string;                  // IP geo-localizable (opcional)
  pais?: string;                // País resuelto desde IP (Lima, Perú)
  ciudad?: string;

  // ── Timestamps ──────────────────────────────────────────────────────────
  fechaInicio: Timestamp;       // Cuándo se creó (login)
  lastActive: Timestamp;        // Última request activa
  fechaCierre?: Timestamp;      // Cuándo se cerró (logout o forzado)

  // ── Estado ──────────────────────────────────────────────────────────────
  estado: SesionEstado;
  esActual?: boolean;           // Computed en lectura · sesión que está mirando ahora mismo

  // ── Origen del cierre · si aplica ───────────────────────────────────────
  motivoCierre?: SesionMotivoCierre;
  cerradaPor?: string;          // uid del admin · si fue forzada
}

export type SesionEstado = 'activa' | 'cerrada';

export type SesionMotivoCierre =
  | 'logout_user'           // User hizo logout normalmente
  | 'desconectada_admin'    // Admin desconectó esta sesión específica
  | 'desconectadas_todas'   // Admin desconectó todas (bulk)
  | 'expirada'              // Refresh token expiró (30d Firebase default)
  | 'reset_password'        // Reset password forzó cierre de sesiones
  | 'cuenta_suspendida';    // Admin suspendió la cuenta

// Labels canon
export const SESION_MOTIVO_LABELS: Record<SesionMotivoCierre, string> = {
  logout_user: 'Cerrada por el usuario',
  desconectada_admin: 'Desconectada por admin',
  desconectadas_todas: 'Desconectada masiva',
  expirada: 'Sesión expirada',
  reset_password: 'Reset de password',
  cuenta_suspendida: 'Cuenta suspendida',
};

/**
 * Parsea un User-Agent para extraer browser + OS legible.
 * Implementación liviana sin dependencias.
 */
export function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  let browser = 'Desconocido';
  let os = 'Desconocido';

  // Browser
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = 'Opera';

  // OS
  if (/Windows NT 10/.test(ua)) os = 'Windows 10';
  else if (/Windows NT 11/.test(ua)) os = 'Windows 11';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua) || /Macintosh/.test(ua)) os = 'macOS';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Linux/.test(ua)) os = 'Linux';

  const device = `${browser} · ${os}`;
  return { browser, os, device };
}
