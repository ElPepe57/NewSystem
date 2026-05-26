/**
 * functions/src/users/users.sessions.ts
 * chk5.F4-USERS (2026-05-25) · Sistema de sesiones · CFs de revoke.
 *
 * Callable:
 *   - desconectarSesion          · admin o user dueño cierra una sesión específica
 *   - desconectarTodasSesiones   · admin cierra TODAS las sesiones de un user
 *   - desconectarTodasSistema    · admin emergencia · todas las sesiones del sistema
 *
 * En todos los casos · usamos admin.auth().revokeRefreshTokens(uid) para
 * invalidar los refresh tokens del usuario. La próxima vez que el cliente
 * intente refrescar el access token · Firebase Auth devolverá error y el
 * frontend dispara logout automático.
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { logAudit } from "./users.audit";

const db = admin.firestore();
const auth = admin.auth();

interface DesconectarSesionInput {
  sessionId: string;
}

// ─────────────────────────────────────────────────────────────────────────
// desconectarSesion · admin o user dueño
// ─────────────────────────────────────────────────────────────────────────
export const desconectarSesion = functions.https.onCall(async (data: DesconectarSesionInput, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  }
  if (!data.sessionId) {
    throw new functions.https.HttpsError("invalid-argument", "sessionId requerido");
  }

  const sesionRef = db.collection("sessions").doc(data.sessionId);
  const sesionSnap = await sesionRef.get();
  if (!sesionSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Sesión no existe");
  }
  const sesion = sesionSnap.data() as { uid: string; estado: string };

  // Verificar permiso · admin o user dueño
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  const actorData = actorDoc.data() as { role?: string; roles?: string[]; email?: string };
  const actorRoles = actorData?.roles || (actorData?.role ? [actorData.role] : []);
  const esAdmin = actorRoles.includes("admin") || actorRoles.includes("gerente");
  const esDueno = sesion.uid === actorUid;

  if (!esAdmin && !esDueno) {
    throw new functions.https.HttpsError("permission-denied", "Solo admin o dueño de la sesión");
  }

  // Marcar sesión cerrada
  await sesionRef.update({
    estado: "cerrada",
    fechaCierre: admin.firestore.FieldValue.serverTimestamp(),
    motivoCierre: esAdmin && !esDueno ? "desconectada_admin" : "logout_user",
    cerradaPor: actorUid,
  });

  // Si solo queda esta sesión activa · revocar refresh tokens del user
  const otrasActivas = await db
    .collection("sessions")
    .where("uid", "==", sesion.uid)
    .where("estado", "==", "activa")
    .limit(1)
    .get();

  if (otrasActivas.empty) {
    // No quedan sesiones activas · revocar todos los refresh tokens
    await auth.revokeRefreshTokens(sesion.uid);
  }

  await logAudit({
    modulo: "users.sesiones",
    accion: "desconectar_sesion",
    actorUid,
    actorEmail: actorData.email,
    targetUid: sesion.uid,
    metadata: { sessionId: data.sessionId, esAdmin, esDueno },
  });

  return { success: true };
});

// ─────────────────────────────────────────────────────────────────────────
// desconectarTodasSesiones · admin · todas las sesiones de un user específico
// ─────────────────────────────────────────────────────────────────────────
export const desconectarTodasSesiones = functions.https.onCall(async (data: { uid: string }, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  const actorData = actorDoc.data() as { role?: string; roles?: string[]; email?: string };
  const actorRoles = actorData?.roles || (actorData?.role ? [actorData.role] : []);
  if (!actorRoles.includes("admin") && !actorRoles.includes("gerente")) {
    throw new functions.https.HttpsError("permission-denied", "Solo admin o gerente");
  }
  if (!data.uid) {
    throw new functions.https.HttpsError("invalid-argument", "uid requerido");
  }

  // 1. Cerrar todos los docs sessions activos del user
  const activasSnap = await db
    .collection("sessions")
    .where("uid", "==", data.uid)
    .where("estado", "==", "activa")
    .get();

  const batch = db.batch();
  activasSnap.docs.forEach((d) => {
    batch.update(d.ref, {
      estado: "cerrada",
      fechaCierre: admin.firestore.FieldValue.serverTimestamp(),
      motivoCierre: "desconectadas_todas",
      cerradaPor: actorUid,
    });
  });
  await batch.commit();

  // 2. Revocar refresh tokens del user
  await auth.revokeRefreshTokens(data.uid);

  await logAudit({
    modulo: "users.sesiones",
    accion: "desconectar_todas_user",
    actorUid,
    actorEmail: actorData.email,
    targetUid: data.uid,
    metadata: { count: activasSnap.size },
  });

  return { success: true, count: activasSnap.size };
});

// ─────────────────────────────────────────────────────────────────────────
// desconectarTodasSistema · emergencia · todas las sesiones del sistema
// ─────────────────────────────────────────────────────────────────────────
export const desconectarTodasSistema = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onCall(async (data: { forzarResetPassword?: boolean }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "No autenticado");
    }
    const actorUid = context.auth.uid;
    const actorDoc = await db.collection("users").doc(actorUid).get();
    const actorData = actorDoc.data() as { role?: string; roles?: string[]; email?: string };
    const actorRoles = actorData?.roles || (actorData?.role ? [actorData.role] : []);
    if (!actorRoles.includes("admin")) {
      throw new functions.https.HttpsError("permission-denied", "Solo admin");
    }

    // 1. Cerrar todas las sesiones activas
    const activasSnap = await db.collection("sessions").where("estado", "==", "activa").get();
    const uidsAfectados = new Set<string>();

    // Batched updates (max 500 por batch)
    const batches: admin.firestore.WriteBatch[] = [];
    let currentBatch = db.batch();
    let opsInBatch = 0;
    activasSnap.docs.forEach((d) => {
      const sesion = d.data() as { uid: string };
      uidsAfectados.add(sesion.uid);
      currentBatch.update(d.ref, {
        estado: "cerrada",
        fechaCierre: admin.firestore.FieldValue.serverTimestamp(),
        motivoCierre: "desconectadas_todas",
        cerradaPor: actorUid,
      });
      opsInBatch++;
      if (opsInBatch >= 450) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        opsInBatch = 0;
      }
    });
    if (opsInBatch > 0) batches.push(currentBatch);
    await Promise.all(batches.map((b) => b.commit()));

    // 2. Revocar refresh tokens de TODOS los usuarios afectados
    let revokesOk = 0;
    let revokesErr = 0;
    for (const uid of uidsAfectados) {
      try {
        await auth.revokeRefreshTokens(uid);
        revokesOk++;
      } catch (err) {
        console.error("[desconectarTodasSistema] revoke err:", uid, err);
        revokesErr++;
      }
    }

    await logAudit({
      modulo: "users.sesiones",
      accion: "desconectar_todas_sistema",
      actorUid,
      actorEmail: actorData.email,
      metadata: {
        sesionesCerradas: activasSnap.size,
        usuariosAfectados: uidsAfectados.size,
        revokesOk,
        revokesErr,
        forzarResetPassword: data.forzarResetPassword || false,
      },
    });

    return {
      success: true,
      count: activasSnap.size,
      usuariosAfectados: uidsAfectados.size,
    };
  });
