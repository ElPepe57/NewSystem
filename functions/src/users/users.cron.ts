/**
 * functions/src/users/users.cron.ts
 * chk5.F4-USERS (2026-05-25) · Scheduled · auto-rechazo de invitaciones expiradas.
 *
 * Corre cada 6 horas. Detecta:
 *   1. Invitaciones con fechaCaducidad < ahora · marca como 'expirada'
 *   2. Users en estado 'pendiente_aprobacion' con fechaRegistro > N días
 *      (configurable en /configuracion/usuarios.policyRegistro.autoRechazoSinAprobar)
 *      → archiva + envía email "tu solicitud expiró"
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { sendSolicitudExpiradaEmail } from "./users.email";
import { logAudit } from "./users.audit";

const db = admin.firestore();

export const scheduledAutoRejectExpired = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .pubsub.schedule("every 6 hours")
  .timeZone("America/Lima")
  .onRun(async () => {
    const ahora = admin.firestore.Timestamp.now();
    let invitacionesExpiradas = 0;
    let usersArchivados = 0;

    // ─── 1. Invitaciones expiradas (caducidad < ahora) ───────────────────
    const invSnap = await db
      .collection("invitaciones")
      .where("estado", "in", ["enviada", "link_abierto"])
      .where("fechaCaducidad", "<", ahora)
      .get();

    if (!invSnap.empty) {
      const batch = db.batch();
      invSnap.docs.forEach((d) => {
        batch.update(d.ref, { estado: "expirada" });
      });
      await batch.commit();
      invitacionesExpiradas = invSnap.size;
      console.log(`[scheduledAutoReject] ${invitacionesExpiradas} invitaciones marcadas expiradas`);
    }

    // ─── 2. Users pendientes_aprobacion con N días sin aprobar ───────────
    const configSnap = await db.collection("configuracion").doc("usuarios").get();
    const policy = configSnap.exists
      ? (configSnap.data() as { policyRegistro?: { autoRechazoSinAprobar?: { activo: boolean; diasInactividad: number } } }).policyRegistro?.autoRechazoSinAprobar
      : null;

    if (policy?.activo) {
      const diasInactividad = policy.diasInactividad || 7;
      const fechaCorte = admin.firestore.Timestamp.fromMillis(
        ahora.toMillis() - diasInactividad * 24 * 60 * 60 * 1000,
      );

      const usersSnap = await db
        .collection("users")
        .where("estado", "==", "pendiente_aprobacion")
        .where("fechaRegistro", "<", fechaCorte)
        .get();

      const motivo = `Solicitud expirada · sin aprobación por ${diasInactividad} días`;

      for (const userDoc of usersSnap.docs) {
        try {
          await userDoc.ref.update({
            estado: "archivado",
            activo: false,
            fechaArchivado: admin.firestore.FieldValue.serverTimestamp(),
            archivadoPor: "sistema_auto_rechazo",
            motivoSuspension: motivo,
          });

          const userData = userDoc.data() as { email?: string };
          if (userData.email) {
            await sendSolicitudExpiradaEmail({
              to: userData.email,
              motivo: `Tu solicitud no fue aprobada en ${diasInactividad} días`,
            }).catch((err) => console.error("[cron] email expirada error:", err));
          }

          await logAudit({
            modulo: "users.cron",
            accion: "auto_reject_pendiente",
            actorUid: "sistema_auto_rechazo",
            targetUid: userDoc.id,
            targetEmail: userData.email,
            metadata: { motivo, diasInactividad },
          });

          usersArchivados++;
        } catch (err) {
          console.error(`[scheduledAutoReject] error archivando user ${userDoc.id}:`, err);
        }
      }
      console.log(`[scheduledAutoReject] ${usersArchivados} users archivados`);
    }

    return {
      invitacionesExpiradas,
      usersArchivados,
      timestamp: ahora.toMillis(),
    };
  });
