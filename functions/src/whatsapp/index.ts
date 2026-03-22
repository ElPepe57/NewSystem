/**
 * WhatsApp Chatbot - Cloud Functions
 *
 * Exports:
 * - wawebhook: HTTP endpoint para Meta WhatsApp Cloud API
 * - wasetconfig: Callable para configurar sesiones y welcome messages
 * - wasendmessage: Callable para enviar mensajes proactivos
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { WAWebhookPayload, WAWelcomeConfig } from "./whatsapp.types";
import { handleIncomingMessage } from "./whatsapp.handler";
import { verificarWebhook, enviarMensajeTexto } from "./whatsapp.meta";
import { getSecret } from "../secrets";
import { COLLECTIONS } from "../collections";

const db = admin.firestore();

// ============================================================
// SEC-004 FIX: Validar firma HMAC de Meta WhatsApp webhook
// ============================================================

function validateWhatsAppSignature(req: functions.https.Request): boolean {
  const signature = req.headers["x-hub-signature-256"] as string;
  if (!signature) {
    console.warn("[WA] Webhook sin X-Hub-Signature-256 header");
    return false;
  }

  const appSecret = getSecret("WHATSAPP_APP_SECRET");
  if (!appSecret) {
    // Fail-closed: sin secret configurado, rechazar webhook
    console.error("[WA] WHATSAPP_APP_SECRET not configured — rejecting webhook");
    return false;
  }

  const expectedSignature = "sha256=" +
    crypto.createHmac("sha256", appSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// ============================================================
// WEBHOOK - Recibe mensajes de Meta WhatsApp Cloud API
// ============================================================

export const wawebhook = functions.https.onRequest(async (req, res) => {
  // GET = verificación del webhook por Meta
  if (req.method === "GET") {
    const result = verificarWebhook(req.query as Record<string, string>);
    res.status(result.status).send(result.body);
    return;
  }

  // POST = mensaje entrante
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  // SEC-004 FIX: Validar firma HMAC de Meta
  if (!validateWhatsAppSignature(req)) {
    console.warn("[WA] Webhook REJECTED: invalid signature");
    res.status(403).send("Invalid signature");
    return;
  }

  try {
    const payload = req.body as WAWebhookPayload;

    console.log("[WA] Webhook POST recibido:", JSON.stringify(payload).substring(0, 500));

    // Validar estructura
    if (payload.object !== "whatsapp_business_account") {
      console.log("[WA] Payload ignorado: object =", payload.object);
      res.sendStatus(200);
      return;
    }

    // Recopilar todos los mensajes a procesar
    const tasks: Promise<void>[] = [];

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") {
          console.log("[WA] Campo ignorado:", change.field);
          continue;
        }

        const value = change.value;
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        // Ignorar status updates (delivered, read, etc.)
        if (messages.length === 0) {
          console.log("[WA] No hay mensajes en el payload (posible status update)");
          continue;
        }

        for (const message of messages) {
          const contact = contacts.find((c) => c.wa_id === message.from);
          const contactName = contact?.profile?.name;

          console.log(`[WA] Mensaje recibido de ${message.from} (${contactName}): ${message.text?.body || message.type}`);

          // Procesar ANTES de responder para que Cloud Functions no mate el proceso
          tasks.push(
            handleIncomingMessage(message, contactName).catch((error) => {
              console.error("[WA] Error procesando mensaje:", error);
            })
          );
        }
      }
    }

    // Esperar a que se procesen todos los mensajes
    await Promise.all(tasks);

    console.log("[WA] Procesamiento completado, respondiendo 200");
    res.sendStatus(200);
  } catch (error) {
    console.error("[WA] Error en webhook:", error);
    res.sendStatus(200);
  }
});

// ============================================================
// CONFIGURAR SESIÓN / WELCOME MESSAGE
// ============================================================

export const wasetconfig = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Requiere autenticación");
  }

  const { action } = data;

  // --- Registrar número interno ---
  if (action === "register_internal") {
    const { phoneNumber, nombre, role } = data;
    if (!phoneNumber) {
      throw new functions.https.HttpsError("invalid-argument", "phoneNumber requerido");
    }

    await db.collection(COLLECTIONS.WHATSAPP_SESSIONS).doc(phoneNumber.replace(/\D/g, "")).set(
      {
        phoneNumber: phoneNumber.replace(/\D/g, ""),
        nombre: nombre || "Equipo",
        mode: "interno",
        role: role || "vendedor",
        isInternal: true,
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true, message: `Número ${phoneNumber} registrado como interno` };
  }

  // --- Configurar mensaje de bienvenida ---
  if (action === "set_welcome") {
    const config: WAWelcomeConfig = {
      enabled: data.enabled ?? true,
      message: data.message || "¡Hola! Bienvenido a BusinessMN. ¿En qué podemos ayudarte?",
      followUpMessage: data.followUpMessage,
      followUpDelayMinutes: data.followUpDelayMinutes,
    };

    await db.collection(COLLECTIONS.WHATSAPP_CONFIG).doc("welcome").set(config);
    return { success: true, config };
  }

  // --- Cambiar modo de un número ---
  if (action === "set_mode") {
    const { phoneNumber, mode } = data;
    if (!phoneNumber || !["interno", "ventas", "welcome"].includes(mode)) {
      throw new functions.https.HttpsError("invalid-argument", "phoneNumber y mode válido requeridos");
    }

    await db.collection(COLLECTIONS.WHATSAPP_SESSIONS).doc(phoneNumber.replace(/\D/g, "")).update({
      mode,
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: `Modo de ${phoneNumber} cambiado a ${mode}` };
  }

  throw new functions.https.HttpsError("invalid-argument", "Acción no válida");
});

// ============================================================
// ENVIAR MENSAJE PROACTIVO (alertas, notificaciones)
// ============================================================

export const wasendmessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Requiere autenticación");
  }

  const { phoneNumber, message } = data;
  if (!phoneNumber || !message) {
    throw new functions.https.HttpsError("invalid-argument", "phoneNumber y message requeridos");
  }

  const success = await enviarMensajeTexto(phoneNumber.replace(/\D/g, ""), message);

  if (!success) {
    throw new functions.https.HttpsError("internal", "Error enviando mensaje");
  }

  return { success: true };
});
