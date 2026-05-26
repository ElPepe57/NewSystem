/**
 * functions/src/users/users.signup.ts
 * chk5.F4-USERS (2026-05-25) · Self-signup público con captcha.
 *
 * Callable:
 *   - validateSelfSignup · valida captcha + whitelist + rate-limit ANTES del
 *                           createUserWithEmailAndPassword del frontend.
 *                           Retorna OK/NOK · el frontend procede solo si OK.
 *   - completarSelfSignup · después del createUser exitoso · crea el UserProfile
 *                           en Firestore con estado='pendiente_aprobacion' + envía
 *                           alerta a los admins.
 *
 * NOTA: El flujo se hace en 2 pasos porque Firebase Auth crea el user
 * client-side. Si validateSelfSignup falla · el cliente NO llama a Auth.
 */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { validateTurnstile } from "./users.captcha";
import { sendAlertaAdminSelfSignupEmail } from "./users.email";
import { logAudit } from "./users.audit";

const db = admin.firestore();

interface ValidateInput {
  email: string;
  captchaToken: string;
}

interface CompletarInput {
  uid: string;
  email: string;
  displayName: string;
  userAgent?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// validateSelfSignup · pre-validación
// ─────────────────────────────────────────────────────────────────────────
export const validateSelfSignup = functions.https.onCall(async (data: ValidateInput, context) => {
  const email = (data.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new functions.https.HttpsError("invalid-argument", "Email inválido");
  }

  // 1. Validar captcha (server-side · Turnstile)
  const remoteIp = context.rawRequest?.ip;
  const captcha = await validateTurnstile(data.captchaToken, remoteIp);
  if (!captcha.valid) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      captcha.reason || "Captcha inválido",
    );
  }

  // 2. Validar whitelist de dominios (config)
  const configSnap = await db.collection("configuracion").doc("usuarios").get();
  if (configSnap.exists) {
    const config = configSnap.data() as { policyRegistro?: { whitelistDominios?: string[]; modo?: string } };
    const modo = config.policyRegistro?.modo || "dual";
    if (modo === "solo_invitacion") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "El registro público está deshabilitado. Solicitá una invitación.",
      );
    }
    const whitelist = config.policyRegistro?.whitelistDominios || [];
    if (whitelist.length > 0) {
      const dominio = "@" + email.split("@")[1];
      if (!whitelist.some((d) => d.toLowerCase() === dominio.toLowerCase())) {
        throw new functions.https.HttpsError(
          "permission-denied",
          `Dominio ${dominio} no está permitido para registro público`,
        );
      }
    }
  }

  // 3. Chequear si ya existe user con ese email
  const existingSnap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (!existingSnap.empty) {
    throw new functions.https.HttpsError("already-exists", "Ya existe un usuario con ese email");
  }

  // 4. Rate-limit por IP (lectura de últimos registros recientes desde la misma IP)
  if (remoteIp) {
    const config = configSnap.data() as { policyRegistro?: { rateLimitPorIP?: { maxRegistros: number; ventanaHoras: number } } } | undefined;
    const maxRegistros = config?.policyRegistro?.rateLimitPorIP?.maxRegistros || 3;
    const ventanaHoras = config?.policyRegistro?.rateLimitPorIP?.ventanaHoras || 24;
    const desde = admin.firestore.Timestamp.fromMillis(
      Date.now() - ventanaHoras * 60 * 60 * 1000,
    );
    const recentSnap = await db
      .collection("users")
      .where("ipRegistro", "==", remoteIp)
      .where("fechaRegistro", ">=", desde)
      .get();
    if (recentSnap.size >= maxRegistros) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Límite de registros alcanzado desde tu IP (${maxRegistros}/${ventanaHoras}h). Intentá más tarde.`,
      );
    }
  }

  return { success: true, message: "Validación OK · podés proceder con createUser" };
});

// ─────────────────────────────────────────────────────────────────────────
// completarSelfSignup · post-createUserWithEmailAndPassword
// ─────────────────────────────────────────────────────────────────────────
export const completarSelfSignup = functions.https.onCall(async (data: CompletarInput, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth required");
  }
  if (context.auth.uid !== data.uid) {
    throw new functions.https.HttpsError("permission-denied", "UID mismatch");
  }

  const email = (data.email || "").trim().toLowerCase();
  const displayName = (data.displayName || "").trim();
  if (!email || !displayName) {
    throw new functions.https.HttpsError("invalid-argument", "email y displayName requeridos");
  }

  const remoteIp = context.rawRequest?.ip || "";
  const userAgent = data.userAgent || context.rawRequest?.headers?.["user-agent"] || "";

  // Crear UserProfile · pendiente de aprobación
  await db.collection("users").doc(data.uid).set({
    uid: data.uid,
    email,
    displayName,
    roles: [],
    role: "invitado",  // legacy
    permisos: [],
    estado: "pendiente_aprobacion",
    activo: false,
    origen: "self_signup",
    fechaRegistro: admin.firestore.FieldValue.serverTimestamp(),
    fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
    ipRegistro: remoteIp,
    userAgentRegistro: userAgent,
    emailVerificado: false,
  });

  // Audit log
  await logAudit({
    modulo: "users.signup",
    accion: "self_signup",
    actorUid: data.uid,
    actorEmail: email,
    targetUid: data.uid,
    targetEmail: email,
    metadata: { ip: remoteIp, userAgent },
  });

  // Notificar a admins · email
  try {
    const adminsSnap = await db
      .collection("users")
      .where("role", "==", "admin")
      .where("activo", "==", true)
      .get();
    const adminEmails = adminsSnap.docs
      .map((d) => d.data().email as string | undefined)
      .filter((e): e is string => !!e);

    for (const adminEmail of adminEmails) {
      await sendAlertaAdminSelfSignupEmail({
        toAdmin: adminEmail,
        userEmail: email,
        userNombre: displayName,
        ip: remoteIp,
        userAgent,
      }).catch((err) => console.error("[completarSelfSignup] admin notif error:", err));
    }
  } catch (err) {
    console.error("[completarSelfSignup] error notificando admins:", err);
  }

  return { success: true };
});
