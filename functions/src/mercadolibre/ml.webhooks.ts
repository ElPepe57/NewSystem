/**
 * Mercado Libre — Webhook receiver
 *
 * Recibe y procesa notificaciones push de ML:
 * - orders_v2: órdenes nuevas/actualizadas
 * - shipments: actualizaciones de envío
 * - items: cambios en publicaciones
 * - questions: preguntas nuevas
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { processWebhookNotification } from "./ml.api";
import { processOrderNotification, processShipmentNotification } from "./ml.sync";
import { MLWebhookNotification } from "./ml.types";

const db = admin.firestore();

/**
 * Recibe notificaciones de Mercado Libre
 *
 * ML envía POST con:
 * {
 *   "_id": "unique-id",
 *   "resource": "/orders/12345",
 *   "user_id": 123456,
 *   "topic": "orders_v2",
 *   "application_id": 6805464699623168,
 *   "attempts": 1,
 *   "sent": "2024-01-15T10:30:00.000-03:00",
 *   "received": "2024-01-15T10:30:00.000-03:00"
 * }
 */
export const mlwebhook = functions.https.onRequest(async (req, res) => {
  // ML solo envía POST
  if (req.method !== "POST") {
    res.status(200).send("OK");
    return;
  }

  const notification = req.body as MLWebhookNotification;

  // SEC-003 FIX: Validar que la notificación viene de nuestra app ML (fail-closed)
  const { getSecret } = await import("../secrets");
  const expectedAppId = getSecret("ML_CLIENT_ID");
  if (!expectedAppId) {
    functions.logger.error("ML Webhook REJECTED: ML_CLIENT_ID secret not configured");
    res.status(503).send("Service unavailable");
    return;
  }
  if (notification.application_id !== undefined) {
    if (String(notification.application_id) !== String(expectedAppId)) {
      functions.logger.warn("ML Webhook REJECTED: application_id mismatch", {
        received: notification.application_id,
        expected: expectedAppId,
      });
      res.status(403).send("Forbidden");
      return;
    }
  }

  // SEC-003 FIX: Validar que el user_id corresponde a una cuenta ML registrada
  if (notification.user_id) {
    const settingsDoc = await db.collection("mlConfig").doc("settings").get();
    const registeredUserId = settingsDoc.exists ? settingsDoc.data()?.userId : null;
    if (registeredUserId && Number(notification.user_id) !== Number(registeredUserId)) {
      functions.logger.warn("ML Webhook REJECTED: user_id mismatch", {
        received: notification.user_id,
        expected: registeredUserId,
      });
      res.status(403).send("Forbidden");
      return;
    }
  }

  functions.logger.info(`ML Webhook: ${notification.topic} → ${notification.resource}`, {
    notificationId: notification._id,
    userId: notification.user_id,
    attempts: notification.attempts,
  });

  try {
    // Guardar notificación raw para auditoría
    await db.collection("mlWebhookLog").add({
      ...notification,
      processedAt: admin.firestore.Timestamp.now(),
      status: "processing",
    });

    // Procesar según el tópico
    const { topic, data } = await processWebhookNotification(notification);

    switch (topic) {
    case "orders_v2":
      if (data) {
        await processOrderNotification(data as any);
      }
      break;

    case "shipments":
      if (data) {
        await processShipmentNotification(data as any);
      }
      break;

    case "items":
      // Actualizar mapeo de producto si existe
      if (data) {
        const item = data as any;
        const mapQuery = await db
          .collection("mlProductMap")
          .where("mlItemId", "==", item.id)
          .limit(1)
          .get();

        if (!mapQuery.empty) {
          await mapQuery.docs[0].ref.update({
            mlTitle: item.title,
            mlPrice: item.price,
            mlAvailableQuantity: item.available_quantity,
            mlStatus: item.status,
            fechaSync: admin.firestore.Timestamp.now(),
          });
        }
      }
      break;

    case "questions":
      // Guardar pregunta para mostrar en el sidebar
      if (data) {
        const question = data as any;
        await db.collection("mlQuestions").doc(String(question.id)).set({
          ...question,
          syncedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });
      }
      break;

    default:
      functions.logger.info(`ML Webhook: tópico ${topic} recibido pero no procesado`);
    }

    // ML espera 200 OK para confirmar recepción
    res.status(200).send("OK");
  } catch (err) {
    functions.logger.error("ML Webhook processing error:", err);
    // Aún respondemos 200 para que ML no reintente innecesariamente
    // El error queda logueado para revisión
    res.status(200).send("OK");
  }
});
