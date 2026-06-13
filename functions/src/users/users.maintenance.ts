/**
 * functions/src/users/users.maintenance.ts
 * 2026-06-13 · Mantenimiento · limpieza de cuentas Auth HUÉRFANAS.
 *
 * Huérfano = existe en Firebase Authentication pero NO tiene perfil en la
 * colección `users` de Firestore. Origen típico: tests/intentos donde se creó
 * el login pero no se completó el perfil (createUser y acceptInvitation no son
 * atómicos · o registros de prueba viejos). Bloquea el reintento de activación
 * con "email ya registrado" aunque el usuario no aparezca en el directorio.
 *
 * Seguridad:
 *   - Solo `admin` puede ejecutar.
 *   - DRY-RUN por default (solo lista) · borra únicamente con ejecutar=true.
 *   - Borra SOLO cuentas sin perfil en Firestore (huérfanas confirmadas).
 *   - NUNCA borra al actor que ejecuta ni cuentas con perfil.
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { logAudit } from "./users.audit";

const db = admin.firestore();

interface LimpiarHuerfanosInput {
  /** false (default) = solo listar · true = borrar los huérfanos. */
  ejecutar?: boolean;
}

export const limpiarAuthHuerfanos = functions.https.onCall(
  async (data: LimpiarHuerfanosInput, context) => {
    // 1. Solo admin
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Auth required");
    }
    const actorSnap = await db.collection("users").doc(context.auth.uid).get();
    const actor = actorSnap.data() as
      | { roles?: string[]; role?: string; email?: string }
      | undefined;
    const roles = actor?.roles || (actor?.role ? [actor.role] : []);
    if (!roles.includes("admin")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Solo admin puede ejecutar mantenimiento",
      );
    }

    // 2. Recorrer TODAS las cuentas de Auth · detectar las que no tienen perfil
    const huerfanos: Array<{ uid: string; email: string | null; creationTime: string }> = [];
    let pageToken: string | undefined;
    do {
      const res = await admin.auth().listUsers(1000, pageToken);
      for (const u of res.users) {
        const profile = await db.collection("users").doc(u.uid).get();
        if (!profile.exists) {
          huerfanos.push({
            uid: u.uid,
            email: u.email ?? null,
            creationTime: u.metadata.creationTime,
          });
        }
      }
      pageToken = res.pageToken;
    } while (pageToken);

    // 3. Borrar (solo con ejecutar=true) · jamás al actor
    let borrados = 0;
    const borradosEmails: Array<string | null> = [];
    if (data?.ejecutar) {
      for (const h of huerfanos) {
        if (h.uid === context.auth.uid) continue;
        await admin.auth().deleteUser(h.uid);
        borrados++;
        borradosEmails.push(h.email);
      }
      await logAudit({
        modulo: "users.maintenance",
        accion: "limpiar_auth_huerfanos",
        actorUid: context.auth.uid,
        actorEmail: actor?.email,
        metadata: {
          totalHuerfanos: huerfanos.length,
          borrados,
          emails: borradosEmails,
        },
      });
    }

    return {
      modo: data?.ejecutar ? "ejecutado" : "dry-run",
      totalHuerfanos: huerfanos.length,
      huerfanos,
      borrados,
    };
  },
);
