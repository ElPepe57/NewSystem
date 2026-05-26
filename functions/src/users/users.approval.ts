/**
 * functions/src/users/users.approval.ts
 * chk5.F4-USERS (2026-05-25) · Aprobar / rechazar usuarios pendientes.
 *
 * Callable:
 *   - approveUser · admin aprueba un user pendiente · asigna roles + activa
 *   - rejectUser  · admin rechaza · soft-delete con motivo + email al user
 *   - acceptInvitation · user usa el token de invitación para activar cuenta
 *                       (al completar setup-password en /setup-password/:id)
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  UserRole,
  UserEstado,
  Invitacion,
} from "./users.types";
import { verifyInvitacionToken, hashToken } from "./users.jwt";
import { sendCuentaAprobadaEmail, sendSolicitudExpiradaEmail } from "./users.email";
import { logAudit } from "./users.audit";

const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────
// HELPER · calcular permisos por rol (espejo de src/types/auth.types.ts)
// ─────────────────────────────────────────────────────────────────────────
const DEFAULT_PERMISOS: Record<string, string[]> = {
  admin: ["admin_total"],  // placeholder · servicio frontend re-calcula con union
  gerente: [],
  vendedor: [],
  comprador: [],
  almacenero: [],
  finanzas: [],
  supervisor: [],
  invitado: [],
  socio: [],
};

function calcularPermisosDeRoles(roles: UserRole[]): string[] {
  // Para CF · el frontend recalcula permisos con la fuente única en
  // src/types/auth.types.ts cuando lee el user · acá solo dejamos un set base.
  // El permiso "admin_total" para admin garantiza acceso por el helper isAdmin().
  const set = new Set<string>();
  for (const r of roles) {
    (DEFAULT_PERMISOS[r] || []).forEach((p) => set.add(p));
  }
  return Array.from(set);
}

// ─────────────────────────────────────────────────────────────────────────
// approveUser · admin aprueba un user pendiente
// ─────────────────────────────────────────────────────────────────────────
interface ApproveUserInput {
  uid: string;
  rolesAsignados: UserRole[];
}

export const approveUser = functions.https.onCall(async (data: ApproveUserInput, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  const actorData = actorDoc.data() as { role?: string; roles?: string[]; activo?: boolean; email?: string; displayName?: string };
  const actorRoles = actorData?.roles || (actorData?.role ? [actorData.role] : []);
  if (!actorRoles.includes("admin") && !actorRoles.includes("gerente")) {
    throw new functions.https.HttpsError("permission-denied", "Solo admin o gerente");
  }

  if (!data.uid || !Array.isArray(data.rolesAsignados) || data.rolesAsignados.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "uid y rolesAsignados requeridos");
  }

  const targetRef = db.collection("users").doc(data.uid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Usuario no existe");
  }
  const target = targetSnap.data() as { email?: string; displayName?: string; estado?: string; activo?: boolean };
  const estadoActual: UserEstado = (target.estado as UserEstado) || (target.activo ? "activo" : "pendiente_aprobacion");

  if (estadoActual === "activo") {
    throw new functions.https.HttpsError("failed-precondition", "Usuario ya está activo");
  }

  const permisos = calcularPermisosDeRoles(data.rolesAsignados);
  const rolPrincipal = data.rolesAsignados[0];  // primero del array · usado para legacy `role`

  await targetRef.update({
    roles: data.rolesAsignados,
    role: rolPrincipal,  // legacy backward compat
    permisos,
    estado: "activo",
    activo: true,
    fechaAprobacion: admin.firestore.FieldValue.serverTimestamp(),
    aprobadoPor: actorUid,
  });

  await logAudit({
    modulo: "users.aprobacion",
    accion: "approve_user",
    actorUid,
    actorEmail: actorData.email,
    targetUid: data.uid,
    targetEmail: target.email,
    metadata: {
      estadoPrevio: estadoActual,
      rolesAsignados: data.rolesAsignados,
    },
  });

  // Email "tu cuenta fue aprobada"
  if (target.email) {
    await sendCuentaAprobadaEmail({
      to: target.email,
      nombre: target.displayName || target.email.split("@")[0],
      aprobadoPorNombre: actorData.displayName || actorData.email || "Admin",
      rolesAsignados: data.rolesAsignados,
    }).catch((err) => console.error("[approveUser] email error:", err));
  }

  return { success: true };
});

// ─────────────────────────────────────────────────────────────────────────
// rejectUser · admin rechaza · marca archivado con motivo
// ─────────────────────────────────────────────────────────────────────────
interface RejectUserInput {
  uid: string;
  motivo: string;
}

export const rejectUser = functions.https.onCall(async (data: RejectUserInput, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  const actorData = actorDoc.data() as { role?: string; roles?: string[]; activo?: boolean; email?: string };
  const actorRoles = actorData?.roles || (actorData?.role ? [actorData.role] : []);
  if (!actorRoles.includes("admin") && !actorRoles.includes("gerente")) {
    throw new functions.https.HttpsError("permission-denied", "Solo admin o gerente");
  }

  if (!data.uid || !data.motivo) {
    throw new functions.https.HttpsError("invalid-argument", "uid y motivo requeridos");
  }

  const targetRef = db.collection("users").doc(data.uid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Usuario no existe");
  }
  const target = targetSnap.data() as { email?: string };

  await targetRef.update({
    estado: "archivado",
    activo: false,
    fechaArchivado: admin.firestore.FieldValue.serverTimestamp(),
    archivadoPor: actorUid,
    motivoSuspension: data.motivo,
  });

  await logAudit({
    modulo: "users.aprobacion",
    accion: "reject_user",
    actorUid,
    actorEmail: actorData.email,
    targetUid: data.uid,
    targetEmail: target.email,
    metadata: { motivo: data.motivo },
  });

  if (target.email) {
    await sendSolicitudExpiradaEmail({
      to: target.email,
      motivo: data.motivo,
    }).catch((err) => console.error("[rejectUser] email error:", err));
  }

  return { success: true };
});

// ─────────────────────────────────────────────────────────────────────────
// acceptInvitation · user usa token de invitación para activar cuenta
// Llamado desde /setup-password/:invitacionId al submitear el form.
// ─────────────────────────────────────────────────────────────────────────
interface AcceptInvitationInput {
  invitacionId: string;
  token: string;
  /** UID del Firebase Auth user · el cliente ya hizo createUserWithEmailAndPassword */
  uid: string;
  email: string;
  displayName: string;
}

export const acceptInvitation = functions.https.onCall(
  async (data: AcceptInvitationInput, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Auth required");
    }
    if (context.auth.uid !== data.uid) {
      throw new functions.https.HttpsError("permission-denied", "UID mismatch");
    }

    // 1. Verificar JWT
    const payload = verifyInvitacionToken(data.token);
    if (!payload) {
      throw new functions.https.HttpsError("permission-denied", "Token inválido o expirado");
    }
    if (payload.invitacionId !== data.invitacionId) {
      throw new functions.https.HttpsError("permission-denied", "Token no corresponde a esta invitación");
    }
    if (payload.email.toLowerCase() !== data.email.toLowerCase()) {
      throw new functions.https.HttpsError("permission-denied", "Email no coincide con la invitación");
    }

    // 2. Cargar invitación
    const invRef = db.collection("invitaciones").doc(data.invitacionId);
    const invSnap = await invRef.get();
    if (!invSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Invitación no existe");
    }
    const inv = invSnap.data() as Invitacion;

    // 3. Validar token hash
    if (inv.tokenHash !== hashToken(data.token)) {
      throw new functions.https.HttpsError("permission-denied", "Token revocado o reemplazado");
    }

    // 4. Validar estado
    if (inv.estado === "aceptada") {
      throw new functions.https.HttpsError("failed-precondition", "Invitación ya aceptada");
    }
    if (inv.estado === "cancelada" || inv.estado === "expirada") {
      throw new functions.https.HttpsError("failed-precondition", `Invitación está ${inv.estado}`);
    }
    if (inv.fechaCaducidad.toMillis() < Date.now()) {
      await invRef.update({ estado: "expirada" });
      throw new functions.https.HttpsError("failed-precondition", "Invitación expirada");
    }

    // 5. Crear UserProfile · estado: 'activo' directamente (la invitación es trust)
    const permisos = calcularPermisosDeRoles(inv.rolesPreAsignados);
    const rolPrincipal = inv.rolesPreAsignados[0] || "invitado";

    await db.collection("users").doc(data.uid).set({
      uid: data.uid,
      email: data.email,
      displayName: data.displayName,
      roles: inv.rolesPreAsignados,
      role: rolPrincipal,
      permisos,
      estado: "activo",
      activo: true,
      origen: "invitacion_admin",
      invitadoPor: inv.invitadoPor,
      fechaInvitacion: inv.fechaEnvio,
      fechaRegistro: admin.firestore.FieldValue.serverTimestamp(),
      fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 6. Marcar invitación como aceptada
    await invRef.update({
      estado: "aceptada",
      fechaAceptacion: admin.firestore.FieldValue.serverTimestamp(),
      uidUsuarioCreado: data.uid,
    });

    await logAudit({
      modulo: "users.invitaciones",
      accion: "accept_invitation",
      actorUid: data.uid,
      actorEmail: data.email,
      targetEmail: data.email,
      metadata: {
        invitacionId: data.invitacionId,
        rolesAsignados: inv.rolesPreAsignados,
      },
    });

    return { success: true };
  },
);
