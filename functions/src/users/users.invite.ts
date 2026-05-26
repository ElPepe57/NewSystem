/**
 * functions/src/users/users.invite.ts
 * chk5.F4-USERS (2026-05-25) · Cloud Functions de invitaciones.
 *
 * Callable Functions:
 *   - inviteUser          · admin envía invitación por email
 *   - cancelInvitation    · admin cancela una invitación enviada
 *   - resendInvitation    · admin re-envía email de invitación existente
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  Invitacion,
  UserRole,
  ROLES_EXCLUIDOS_INVITACION,
} from "./users.types";
import { signInvitacionToken } from "./users.jwt";
import { sendInvitacionEmail } from "./users.email";
import { logAudit } from "./users.audit";

const db = admin.firestore();

const INVITACION_CADUCIDAD_DIAS = 7;

interface InviteUserInput {
  email: string;
  nombreSugerido?: string;
  rolesPreAsignados?: UserRole[];
  mensajePersonalizado?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// inviteUser · admin envía invitación
// ─────────────────────────────────────────────────────────────────────────
export const inviteUser = functions
  .runWith({ secrets: [] })
  .https.onCall(async (data: InviteUserInput, context) => {
    // 1. Auth + permisos
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuario no autenticado");
    }
    const actorUid = context.auth.uid;
    const actorDoc = await db.collection("users").doc(actorUid).get();
    if (!actorDoc.exists) {
      throw new functions.https.HttpsError("permission-denied", "Perfil de admin no existe");
    }
    const actorData = actorDoc.data() as { role?: string; roles?: string[]; activo?: boolean; displayName?: string; email?: string };
    const actorRoles = actorData.roles || (actorData.role ? [actorData.role] : []);
    if (!actorRoles.includes("admin") && !actorRoles.includes("gerente")) {
      throw new functions.https.HttpsError("permission-denied", "Solo admin o gerente pueden invitar");
    }
    if (actorData.activo !== true) {
      throw new functions.https.HttpsError("permission-denied", "Cuenta no activa");
    }

    // 2. Validar input
    const email = (data.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new functions.https.HttpsError("invalid-argument", "Email inválido");
    }

    const rolesPreAsignados = (data.rolesPreAsignados || []).filter(
      (r): r is UserRole => typeof r === "string",
    );
    // Seguridad: bloquear roles excluidos
    const rolesProhibidos = rolesPreAsignados.filter((r) =>
      ROLES_EXCLUIDOS_INVITACION.includes(r),
    );
    if (rolesProhibidos.length > 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Roles no permitidos en invitación: ${rolesProhibidos.join(", ")}. ` +
          "admin/gerente/socio se asignan manualmente post-aprobación.",
      );
    }

    // 3. Chequear si ya existe user con ese email · evitar duplicados
    const existingUserSnap = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!existingUserSnap.empty) {
      throw new functions.https.HttpsError(
        "already-exists",
        "Ya existe un usuario con ese email",
      );
    }

    // 4. Chequear si ya hay invitación activa para ese email
    const existingInvSnap = await db
      .collection("invitaciones")
      .where("email", "==", email)
      .where("estado", "in", ["enviada", "link_abierto"])
      .limit(1)
      .get();
    if (!existingInvSnap.empty) {
      throw new functions.https.HttpsError(
        "already-exists",
        "Ya hay una invitación activa para ese email. Cancelá la anterior o re-enviala.",
      );
    }

    // 5. Crear invitación
    const invRef = db.collection("invitaciones").doc(); // ID auto
    const fechaEnvio = admin.firestore.Timestamp.now();
    const fechaCaducidad = admin.firestore.Timestamp.fromMillis(
      fechaEnvio.toMillis() + INVITACION_CADUCIDAD_DIAS * 24 * 60 * 60 * 1000,
    );
    const expiraEnDate = fechaCaducidad.toDate();

    // 6. Firmar token JWT
    const { token, tokenHash } = signInvitacionToken(
      { invitacionId: invRef.id, email },
      INVITACION_CADUCIDAD_DIAS,
    );

    // 7. Guardar invitación
    const invitacion: Omit<Invitacion, "id"> = {
      email,
      nombreSugerido: data.nombreSugerido || undefined,
      rolesPreAsignados,
      invitadoPor: actorUid,
      invitadoPorNombre: actorData.displayName || actorData.email || "Admin",
      mensajePersonalizado: data.mensajePersonalizado || undefined,
      estado: "enviada",
      fechaEnvio,
      fechaCaducidad,
      reEnviosCount: 0,
      tokenHash,
    };
    await invRef.set(invitacion);

    // 8. Enviar email
    const emailResult = await sendInvitacionEmail({
      to: email,
      nombreSugerido: data.nombreSugerido,
      invitedByNombre: invitacion.invitadoPorNombre,
      rolesPreAsignados,
      invitacionId: invRef.id,
      tokenPlain: token,
      expiraEn: expiraEnDate,
      mensajePersonalizado: data.mensajePersonalizado,
    });

    // 9. Audit log
    await logAudit({
      modulo: "users.invitaciones",
      accion: "invite_user",
      actorUid,
      actorEmail: actorData.email,
      targetEmail: email,
      metadata: {
        invitacionId: invRef.id,
        rolesPreAsignados,
        emailEnviado: emailResult.ok,
        emailError: emailResult.error,
      },
    });

    return {
      success: true,
      invitacionId: invRef.id,
      emailEnviado: emailResult.ok,
      emailError: emailResult.error,
    };
  });

// ─────────────────────────────────────────────────────────────────────────
// cancelInvitation · admin cancela una invitación
// ─────────────────────────────────────────────────────────────────────────
export const cancelInvitation = functions.https.onCall(async (data: { invitacionId: string }, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuario no autenticado");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  const actorData = actorDoc.data() as { role?: string; roles?: string[]; activo?: boolean; email?: string };
  const actorRoles = actorData?.roles || (actorData?.role ? [actorData.role] : []);
  if (!actorRoles.includes("admin") && !actorRoles.includes("gerente")) {
    throw new functions.https.HttpsError("permission-denied", "Solo admin o gerente");
  }

  if (!data.invitacionId) {
    throw new functions.https.HttpsError("invalid-argument", "invitacionId requerido");
  }

  const invRef = db.collection("invitaciones").doc(data.invitacionId);
  const invSnap = await invRef.get();
  if (!invSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Invitación no existe");
  }
  const inv = invSnap.data() as Invitacion;
  if (inv.estado !== "enviada" && inv.estado !== "link_abierto") {
    throw new functions.https.HttpsError("failed-precondition", `Invitación está en estado ${inv.estado} · no se puede cancelar`);
  }

  await invRef.update({
    estado: "cancelada",
    fechaCancelacion: admin.firestore.FieldValue.serverTimestamp(),
    canceladaPor: actorUid,
  });

  await logAudit({
    modulo: "users.invitaciones",
    accion: "cancel_invitation",
    actorUid,
    actorEmail: actorData.email,
    targetEmail: inv.email,
    metadata: { invitacionId: data.invitacionId },
  });

  return { success: true };
});

// ─────────────────────────────────────────────────────────────────────────
// resendInvitation · re-envía email · no cambia estado · genera token nuevo
// ─────────────────────────────────────────────────────────────────────────
export const resendInvitation = functions.https.onCall(async (data: { invitacionId: string }, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuario no autenticado");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  const actorData = actorDoc.data() as { role?: string; roles?: string[]; activo?: boolean; email?: string };
  const actorRoles = actorData?.roles || (actorData?.role ? [actorData.role] : []);
  if (!actorRoles.includes("admin") && !actorRoles.includes("gerente")) {
    throw new functions.https.HttpsError("permission-denied", "Solo admin o gerente");
  }

  const invRef = db.collection("invitaciones").doc(data.invitacionId);
  const invSnap = await invRef.get();
  if (!invSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Invitación no existe");
  }
  const inv = invSnap.data() as Invitacion;
  if (inv.estado !== "enviada" && inv.estado !== "link_abierto") {
    throw new functions.https.HttpsError("failed-precondition", "Solo se pueden re-enviar invitaciones activas");
  }

  // Renovar token (recalcular caducidad desde ahora)
  const fechaCaducidad = admin.firestore.Timestamp.fromMillis(
    Date.now() + INVITACION_CADUCIDAD_DIAS * 24 * 60 * 60 * 1000,
  );
  const { token, tokenHash } = signInvitacionToken(
    { invitacionId: data.invitacionId, email: inv.email },
    INVITACION_CADUCIDAD_DIAS,
  );

  await invRef.update({
    tokenHash,
    fechaCaducidad,
    reEnviosCount: (inv.reEnviosCount || 0) + 1,
    ultimoReEnvio: admin.firestore.FieldValue.serverTimestamp(),
  });

  const emailResult = await sendInvitacionEmail({
    to: inv.email,
    nombreSugerido: inv.nombreSugerido,
    invitedByNombre: inv.invitadoPorNombre,
    rolesPreAsignados: inv.rolesPreAsignados,
    invitacionId: data.invitacionId,
    tokenPlain: token,
    expiraEn: fechaCaducidad.toDate(),
    mensajePersonalizado: inv.mensajePersonalizado,
    asuntoOverride: "[Re-envío] Te invitamos a unirte a BusinessMN",
  });

  await logAudit({
    modulo: "users.invitaciones",
    accion: "resend_invitation",
    actorUid,
    actorEmail: actorData.email,
    targetEmail: inv.email,
    metadata: {
      invitacionId: data.invitacionId,
      reEnviosCount: (inv.reEnviosCount || 0) + 1,
      emailEnviado: emailResult.ok,
    },
  });

  return { success: true, emailEnviado: emailResult.ok };
});
