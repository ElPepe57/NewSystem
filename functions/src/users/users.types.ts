/**
 * functions/src/users/users.types.ts
 * chk5.F4-USERS (2026-05-25) · Types compartidos para CFs de usuarios.
 *
 * Espejo (subset) de los types de src/types/ para evitar dependencia cross-package.
 * Si se modifica en src/types/ · sincronizar acá.
 */
import { firestore } from "firebase-admin";

export type UserRole =
  | "admin"
  | "gerente"
  | "vendedor"
  | "comprador"
  | "almacenero"
  | "finanzas"
  | "supervisor"
  | "invitado"
  | "socio";

export type UserEstado =
  | "invitado_no_registrado"
  | "pendiente_aprobacion"
  | "activo"
  | "suspendido"
  | "archivado";

export type UserOrigen =
  | "invitacion_admin"
  | "self_signup"
  | "creacion_directa";

export type InvitacionEstado =
  | "enviada"
  | "link_abierto"
  | "aceptada"
  | "expirada"
  | "cancelada";

export interface Invitacion {
  id: string;
  email: string;
  nombreSugerido?: string;
  rolesPreAsignados: UserRole[];
  invitadoPor: string;
  invitadoPorNombre: string;
  mensajePersonalizado?: string;
  estado: InvitacionEstado;
  fechaEnvio: firestore.Timestamp;
  fechaCaducidad: firestore.Timestamp;
  fechaLinkAbierto?: firestore.Timestamp;
  fechaAceptacion?: firestore.Timestamp;
  fechaCancelacion?: firestore.Timestamp;
  canceladaPor?: string;
  uidUsuarioCreado?: string;
  reEnviosCount: number;
  ultimoReEnvio?: firestore.Timestamp;
  tokenHash: string;
}

/**
 * Roles excluidos de invitación (seguridad).
 * admin/gerente/socio NUNCA por invitación · solo asignación directa por admin.
 */
export const ROLES_EXCLUIDOS_INVITACION: UserRole[] = ["admin", "gerente", "socio"];

/**
 * Audit log entry (espejo simplificado del modelo audit_logs).
 */
export interface AuditLogEntry {
  modulo: string;
  accion: string;
  actorUid: string;
  actorEmail?: string;
  targetUid?: string;
  targetEmail?: string;
  metadata?: Record<string, unknown>;
  timestamp: firestore.Timestamp;
}
