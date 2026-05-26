// src/types/configUsuarios.types.ts
// chk5.F4-USERS (2026-05-25) · Configuración del módulo /usuarios
//
// Document único en Firestore: configuracion/usuarios
// Solo admin puede modificar.

import { Timestamp } from 'firebase/firestore';
import type { UserRole } from './auth.types';

// ═════════════════════════════════════════════════════════════════════════
// Modo de registro · tri-state (canon ACTO 7.1 del mockup)
// ═════════════════════════════════════════════════════════════════════════
export type ModoRegistro =
  | 'solo_invitacion'      // /signup deshabilitado · solo admin invita
  | 'solo_self_signup'     // /signup activo · sin admin invitando
  | 'dual';                // Ambos coexisten (DEFAULT)

// ═════════════════════════════════════════════════════════════════════════
// Política de password
// ═════════════════════════════════════════════════════════════════════════
export interface PolicyPassword {
  longitudMinima: number;        // 8 default
  requiereMayusculas: boolean;   // true default
  requiereNumeros: boolean;      // true default
  requiereEspeciales: boolean;   // false default · opcional
  bloquearComunes: boolean;      // true default · bloquea "password" "12345" etc.
  expiracionDias: number | null; // null = nunca expira (default null)
  bloquearReutilizacion: number; // 0 = sin bloqueo · N = últimas N
}

// ═════════════════════════════════════════════════════════════════════════
// Política de registro · controla self-signup
// ═════════════════════════════════════════════════════════════════════════
export interface PolicyRegistro {
  modo: ModoRegistro;            // 'dual' default
  whitelistDominios: string[];   // [] = cualquier dominio
  rateLimitPorIP: {              // anti-spam de bots
    maxRegistros: number;        // 3 default
    ventanaHoras: number;        // 24 default
  };
  captchaActivo: boolean;        // true default (Cloudflare Turnstile)
  autoRechazoSinAprobar: {       // expira invitaciones / signups sin aprobar
    activo: boolean;             // true default
    diasInactividad: number;     // 7 default
  };
  rolesPermitidosInvitacion: UserRole[];  // excluye admin/gerente/socio por default
}

// ═════════════════════════════════════════════════════════════════════════
// Plantilla de email de invitación
// ═════════════════════════════════════════════════════════════════════════
export interface PlantillaEmailInvitacion {
  asunto: string;
  cuerpoMarkdown: string;        // Variables: {nombre} {invitedBy} {link} {expiraEn}
}

// ═════════════════════════════════════════════════════════════════════════
// Documento principal · /configuracion/usuarios
// ═════════════════════════════════════════════════════════════════════════
export interface ConfigUsuarios {
  policyRegistro: PolicyRegistro;
  policyPassword: PolicyPassword;
  plantillaInvitacion: PlantillaEmailInvitacion;

  // Auditoría
  fechaCreacion: Timestamp;
  fechaUltimaModificacion: Timestamp;
  modificadoPor: string;          // uid del admin
}

// ═════════════════════════════════════════════════════════════════════════
// Defaults · usados en primera ejecución (si /configuracion/usuarios no existe)
// ═════════════════════════════════════════════════════════════════════════
export const POLICY_PASSWORD_DEFAULT: PolicyPassword = {
  longitudMinima: 8,
  requiereMayusculas: true,
  requiereNumeros: true,
  requiereEspeciales: false,
  bloquearComunes: true,
  expiracionDias: null,
  bloquearReutilizacion: 0,
};

export const POLICY_REGISTRO_DEFAULT: PolicyRegistro = {
  modo: 'dual',                  // Confirmado por user 2026-05-25
  whitelistDominios: [],         // Vacío · cualquier dominio
  rateLimitPorIP: {
    maxRegistros: 3,
    ventanaHoras: 24,
  },
  captchaActivo: true,
  autoRechazoSinAprobar: {
    activo: true,
    diasInactividad: 7,
  },
  rolesPermitidosInvitacion: ['vendedor', 'comprador', 'almacenero', 'finanzas', 'supervisor', 'invitado'],
};

export const PLANTILLA_EMAIL_DEFAULT: PlantillaEmailInvitacion = {
  asunto: 'Te invitamos a unirte a BusinessMN',
  cuerpoMarkdown: `Hola {nombre},

{invitedBy} te invitó a unirte a BusinessMN — Vita Skin Peru.

Hacé click para activar tu cuenta:
{link}

Este link expira el {expiraEn} (7 días desde envío).

Si no esperabas esta invitación · ignorala y el link expirará automáticamente.

—
El equipo de BusinessMN`,
};

// Labels para UI
export const MODO_REGISTRO_LABELS: Record<ModoRegistro, string> = {
  solo_invitacion: 'Solo invitación',
  solo_self_signup: 'Solo self-signup',
  dual: 'Dual (recomendado)',
};

export const MODO_REGISTRO_DESCRIPCIONES: Record<ModoRegistro, string> = {
  solo_invitacion: 'Admin invita por email · /signup público deshabilitado · máxima seguridad',
  solo_self_signup: '/signup público activo · todos quedan pendientes · admin solo aprueba',
  dual: 'Ambos coexisten · admin invita selectos + público puede registrarse · flexibilidad',
};
