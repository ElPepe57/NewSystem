/**
 * functions/src/users/users.audit.ts
 * chk5.F4-USERS (2026-05-25) · Helper de auditoría · escribe en /audit_logs.
 */
import * as admin from "firebase-admin";

const db = admin.firestore();

export async function logAudit(params: {
  modulo: string;
  accion: string;
  actorUid: string;
  actorEmail?: string;
  targetUid?: string;
  targetEmail?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.collection("audit_logs").add({
      ...params,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // No bloquear la operación principal si el audit falla
    console.error("[users.audit] logAudit error:", err);
  }
}
