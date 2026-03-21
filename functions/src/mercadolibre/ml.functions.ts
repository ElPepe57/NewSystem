/**
 * Cloud Functions para Mercado Libre
 *
 * - mlauthcallback: OAuth callback para conectar cuenta ML
 * - mlwebhook: Recibe notificaciones de ML (órdenes, envíos, items, etc.)
 * - mlrefreshtoken: Scheduled function para mantener token fresco
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { resolverTCVenta } from "../tipoCambio.util";
import {
  exchangeCodeForToken,
  saveTokens,
  getAuthorizationUrl,
  getUser,
  processWebhookNotification,
  getValidAccessToken,
  getApplicationConfig,
  registerWebhookUrl,
} from "./ml.api";
import { processOrderNotification, processShipmentNotification } from "./ml.sync";
import { MLWebhookNotification, MLOrderSync } from "./ml.types";
import { procesarOrdenCompleta } from "./ml.orderProcessor";

const db = admin.firestore();

// SEC-008 FIX: Helper para verificar que el usuario tiene rol admin o gerente
// Usado en funciones de repair/diagnóstico que no deben ser accesibles por vendedores
async function requireAdminRole(context: functions.https.CallableContext): Promise<void> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }
  const userDoc = await db.collection("users").doc(context.auth.uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Usuario no encontrado");
  }
  const role = userDoc.data()?.role;
  if (role !== "admin" && role !== "gerente") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Esta función requiere rol admin o gerente"
    );
  }
}

// ============================================================
// FUNCIÓN: OAuth Callback
// ============================================================

/**
 * Recibe el callback de ML después de que el usuario autoriza la app.
 * ML redirige aquí con ?code=XXXX
 *
 * Flujo:
 * 1. Usuario hace click en "Conectar Mercado Libre" en el ERP
 * 2. Se abre la URL de autorización de ML
 * 3. Usuario autoriza → ML redirige a esta función con ?code=
 * 4. Esta función intercambia el code por tokens
 * 5. Guarda tokens en Firestore
 * 6. Redirige al ERP con mensaje de éxito
 */
export const mlauthcallback = functions.https.onRequest(async (req, res) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

  // URL del ERP para redirigir después
  const erpBaseUrl = "https://vitaskinperu.web.app";

  if (error) {
    functions.logger.error("ML OAuth error:", error);
    // SEC-009 FIX: Sanitizar parámetro error para prevenir parameter injection
    const safeError = encodeURIComponent(String(error).substring(0, 100));
    res.redirect(`${erpBaseUrl}/mercado-libre?ml_status=error&ml_error=${safeError}`);
    return;
  }

  if (!code) {
    functions.logger.error("ML OAuth: no code received");
    res.redirect(`${erpBaseUrl}/mercado-libre?ml_status=error&ml_error=no_code`);
    return;
  }

  try {
    // 1. Intercambiar code por tokens
    functions.logger.info("ML OAuth: exchanging code for tokens...");
    const tokenResponse = await exchangeCodeForToken(code);

    // 2. Guardar tokens en Firestore
    await saveTokens(tokenResponse);

    // 3. Obtener info del usuario ML
    const mlUser = await getUser(tokenResponse.user_id);

    // 4. Guardar configuración
    await db.collection("mlConfig").doc("settings").set(
      {
        connected: true,
        userId: tokenResponse.user_id,
        nickname: mlUser.nickname,
        firstName: mlUser.first_name,
        lastName: mlUser.last_name,
        email: mlUser.email,
        autoCreateVentas: false, // Desactivado por defecto, el usuario lo activa
        autoCreateClientes: true,
        defaultComisionPorcentaje: 13,
        lastSync: null,
        tokenExpiresAt: admin.firestore.Timestamp.fromMillis(
          Date.now() + tokenResponse.expires_in * 1000
        ),
        connectedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );

    functions.logger.info(`ML OAuth exitoso: ${mlUser.nickname} (${tokenResponse.user_id})`);

    // 5. Auto-registrar webhook para recibir notificaciones de órdenes en tiempo real
    try {
      const webhookUrl = "https://us-central1-businessmn-269c9.cloudfunctions.net/mlwebhook";
      await registerWebhookUrl(webhookUrl);
      await db.collection("mlConfig").doc("settings").update({
        webhookUrl,
        webhookRegistered: true,
        webhookRegisteredAt: admin.firestore.Timestamp.now(),
      });
      functions.logger.info(`ML Webhook auto-registrado: ${webhookUrl}`);
    } catch (webhookErr) {
      // No fallar el OAuth si el webhook falla — el usuario puede registrarlo manualmente después
      functions.logger.warn("ML Webhook auto-registro falló (se puede registrar manualmente):", webhookErr);
    }

    // 6. Redirigir al ERP con éxito
    res.redirect(`${erpBaseUrl}/mercado-libre?ml_status=success&ml_user=${mlUser.nickname}`);
  } catch (err) {
    functions.logger.error("ML OAuth exchange failed:", err);
    res.redirect(`${erpBaseUrl}/mercado-libre?ml_status=error&ml_error=token_exchange_failed`);
  }
});

// ============================================================
// FUNCIÓN: Generar URL de autorización (callable desde el ERP)
// ============================================================

export const mlgetauthurl = functions.https.onCall(async (_data, context) => {
  // Verificar que el usuario está autenticado en el ERP
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const authUrl = getAuthorizationUrl();
  return { url: authUrl };
});

// ============================================================
// FUNCIÓN: Webhook receiver
// ============================================================

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

// ============================================================
// FUNCIÓN: Refresh token automático (cada 4 horas)
// ============================================================

export const mlrefreshtoken = functions.pubsub
  .schedule("every 4 hours")
  .onRun(async () => {
    try {
      const tokenDoc = await db.collection("mlConfig").doc("tokens").get();

      if (!tokenDoc.exists) {
        functions.logger.info("ML refresh: no hay tokens configurados");
        return null;
      }

      // Forzar refresh para mantener el token fresco
      await getValidAccessToken();
      functions.logger.info("ML token refrescado exitosamente");
      return null;
    } catch (err) {
      functions.logger.error("ML token refresh failed:", err);
      return null;
    }
  });

// ============================================================
// FUNCIONES CALLABLE (desde el frontend del ERP)
// ============================================================

/**
 * Obtiene el estado de conexión de ML
 */
export const mlgetstatus = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const settingsDoc = await db.collection("mlConfig").doc("settings").get();
  if (!settingsDoc.exists) {
    return { connected: false };
  }

  return settingsDoc.data();
});

/**
 * Sincroniza items de ML con el mapeo local
 */
export const mlsyncitems = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const settingsDoc = await db.collection("mlConfig").doc("settings").get();
  if (!settingsDoc.exists || !settingsDoc.data()?.connected) {
    throw new functions.https.HttpsError("failed-precondition", "ML no está conectado");
  }

  const { userId } = settingsDoc.data()!;

  try {
    // Importar dinámicamente para evitar dependencia circular
    const { syncAllItems } = await import("./ml.sync");
    const result = await syncAllItems(userId);
    return result;
  } catch (err: any) {
    functions.logger.error("ML sync items error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

/**
 * Obtiene preguntas sin responder
 */
export const mlgetquestions = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const settingsDoc = await db.collection("mlConfig").doc("settings").get();
  if (!settingsDoc.exists || !settingsDoc.data()?.connected) {
    throw new functions.https.HttpsError("failed-precondition", "ML no está conectado");
  }

  const { userId } = settingsDoc.data()!;

  try {
    const { getSellerQuestions } = await import("./ml.api");
    const result = await getSellerQuestions(userId);
    return result;
  } catch (err: any) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});

/**
 * Responde una pregunta de ML
 */
export const mlanswerquestion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const { questionId, text } = data;
  if (!questionId || !text) {
    throw new functions.https.HttpsError("invalid-argument", "questionId y text son requeridos");
  }

  try {
    const { answerQuestion } = await import("./ml.api");
    await answerQuestion(questionId, text);
    return { success: true };
  } catch (err: any) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});

/**
 * Vincula un producto de ML con un producto del ERP.
 * Cascade: si el item tiene SKU, vincula automaticamente todas las
 * publicaciones hermanas (clasica/catalogo) con el mismo productoId.
 */
export const mlvinculateproduct = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const { mlProductMapId, productoId, productoSku, productoNombre } = data;
  if (!mlProductMapId || !productoId) {
    throw new functions.https.HttpsError("invalid-argument", "mlProductMapId y productoId son requeridos");
  }

  const now = admin.firestore.Timestamp.now();
  const updatePayload = {
    productoId,
    productoSku: productoSku || null,
    productoNombre: productoNombre || null,
    vinculado: true,
    fechaVinculacion: now,
  };

  // Actualizar el doc target
  const targetRef = db.collection("mlProductMap").doc(mlProductMapId);
  await targetRef.update(updatePayload);

  // Cascade: vincular hermanos con mismo skuGroupKey (SKU o catalog_product_id)
  let cascadeCount = 0;
  const targetDoc = await targetRef.get();
  const targetData = targetDoc.data();
  const groupKey = targetData?.skuGroupKey || targetData?.mlSku || targetData?.mlCatalogProductId;

  if (groupKey) {
    const siblingsQuery = await db
      .collection("mlProductMap")
      .where("skuGroupKey", "==", groupKey)
      .get();

    for (const sibDoc of siblingsQuery.docs) {
      if (sibDoc.id === mlProductMapId) continue;
      await sibDoc.ref.update(updatePayload);
      cascadeCount++;
    }

    // Fallback: si skuGroupKey no matchea, buscar por mlSku o mlCatalogProductId
    if (cascadeCount === 0) {
      const fallbackField = targetData?.mlSku ? "mlSku" : "mlCatalogProductId";
      const fallbackValue = targetData?.mlSku || targetData?.mlCatalogProductId;
      if (fallbackValue) {
        const fallbackQuery = await db
          .collection("mlProductMap")
          .where(fallbackField, "==", fallbackValue)
          .get();

        for (const sibDoc of fallbackQuery.docs) {
          if (sibDoc.id === mlProductMapId) continue;
          await sibDoc.ref.update(updatePayload);
          cascadeCount++;
        }
      }
    }

    if (cascadeCount > 0) {
      functions.logger.info(
        `ML Vincular: Cascade ${cascadeCount} publicaciones con groupKey ${groupKey} → ${productoSku}`
      );
    }
  }

  return { success: true, cascadeCount };
});

/**
 * Desvincula un producto ML del ERP.
 * Cascade: desvincula todas las publicaciones hermanas con el mismo SKU.
 */
export const mldesvincularproduct = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const { mlProductMapId } = data;
  if (!mlProductMapId) {
    throw new functions.https.HttpsError("invalid-argument", "mlProductMapId es requerido");
  }

  const unlinkPayload = {
    productoId: null,
    productoSku: null,
    productoNombre: null,
    vinculado: false,
    fechaVinculacion: null,
  };

  const targetRef = db.collection("mlProductMap").doc(mlProductMapId);
  const targetDoc = await targetRef.get();

  if (!targetDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Producto ML no encontrado");
  }

  await targetRef.update(unlinkPayload);

  // Cascade: desvincular hermanos con mismo skuGroupKey (SKU o catalog_product_id)
  let cascadeCount = 0;
  const targetData = targetDoc.data();
  const groupKey = targetData?.skuGroupKey || targetData?.mlSku || targetData?.mlCatalogProductId;

  if (groupKey) {
    const siblingsQuery = await db
      .collection("mlProductMap")
      .where("skuGroupKey", "==", groupKey)
      .get();

    for (const sibDoc of siblingsQuery.docs) {
      if (sibDoc.id === mlProductMapId) continue;
      if (sibDoc.data().vinculado) {
        await sibDoc.ref.update(unlinkPayload);
        cascadeCount++;
      }
    }

    // Fallback para docs pre-backfill
    if (cascadeCount === 0) {
      const fallbackField = targetData?.mlSku ? "mlSku" : "mlCatalogProductId";
      const fallbackValue = targetData?.mlSku || targetData?.mlCatalogProductId;
      if (fallbackValue) {
        const fallbackQuery = await db
          .collection("mlProductMap")
          .where(fallbackField, "==", fallbackValue)
          .get();

        for (const sibDoc of fallbackQuery.docs) {
          if (sibDoc.id === mlProductMapId) continue;
          if (sibDoc.data().vinculado) {
            await sibDoc.ref.update(unlinkPayload);
            cascadeCount++;
          }
        }
      }
    }
  }

  return { success: true, cascadeCount };
});

/**
 * Sincroniza stock del ERP hacia ML.
 * Para cada producto vinculado, pushea stockDisponible a todas sus publicaciones ML.
 */
export const mlsyncstock = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const { productoId } = data || {};

  // Obtener mlProductMap docs vinculados
  let mapQuery;
  if (productoId) {
    mapQuery = await db
      .collection("mlProductMap")
      .where("productoId", "==", productoId)
      .where("vinculado", "==", true)
      .get();
  } else {
    mapQuery = await db
      .collection("mlProductMap")
      .where("vinculado", "==", true)
      .get();
  }

  if (mapQuery.empty) {
    return { synced: 0, errors: 0, details: [] };
  }

  // Calcular stock real para cada productoId (solo disponible_peru — ML vende desde Perú)
  const productoIds = [...new Set(mapQuery.docs.map((d) => d.data().productoId as string))];
  const stockMap = new Map<string, number>();

  for (const pid of productoIds) {
    const disponiblesSnap = await db.collection("unidades")
      .where("productoId", "==", pid)
      .where("estado", "==", "disponible_peru")
      .get();
    const stockDisponiblePeru = disponiblesSnap.size;

    // Leer stockPendienteML para calcular stockEfectivoML
    const productoDoc = await db.collection("productos").doc(pid).get();
    const stockPendienteML = productoDoc.data()?.stockPendienteML || 0;
    const stockEfectivoML = Math.max(0, stockDisponiblePeru - stockPendienteML);

    // Usar stockEfectivoML para el push a ML (evita overselling)
    stockMap.set(pid, stockEfectivoML);

    // Actualizar producto con stockDisponiblePeru y stockEfectivoML
    await db.collection("productos").doc(pid).update({
      stockDisponiblePeru,
      stockEfectivoML,
      ultimaActualizacionStock: admin.firestore.Timestamp.now(),
    });
  }

  const { updateItemStock } = await import("./ml.api");
  let synced = 0;
  let errors = 0;
  const details: Array<{ mlItemId: string; stock: number; success: boolean; error?: string }> = [];

  for (const mapDoc of mapQuery.docs) {
    const map = mapDoc.data();
    const erpStock = stockMap.get(map.productoId) ?? 0;

    try {
      await updateItemStock(map.mlItemId, erpStock);
      await mapDoc.ref.update({
        mlAvailableQuantity: erpStock,
        fechaSync: admin.firestore.Timestamp.now(),
      });
      synced++;
      details.push({ mlItemId: map.mlItemId, stock: erpStock, success: true });
    } catch (err: any) {
      errors++;
      details.push({ mlItemId: map.mlItemId, stock: erpStock, success: false, error: err.message });
      functions.logger.error(`Stock sync failed for ${map.mlItemId}:`, err.message);
    }

    // Rate limit: 200ms entre llamadas
    await new Promise((r) => setTimeout(r, 200));
  }

  return { synced, errors, details };
});

/**
 * Actualiza el precio de una publicacion ML individual.
 * El precio es por publicacion (clasica y catalogo pueden tener precios distintos).
 */
export const mlupdateprice = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const { mlProductMapId, newPrice } = data;
  if (!mlProductMapId || !newPrice || newPrice <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "mlProductMapId y newPrice (>0) son requeridos");
  }

  const mapDoc = await db.collection("mlProductMap").doc(mlProductMapId).get();
  if (!mapDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Producto ML no encontrado");
  }

  const map = mapDoc.data()!;
  const { updateItemPrice } = await import("./ml.api");

  try {
    await updateItemPrice(map.mlItemId, newPrice);
    await mapDoc.ref.update({
      mlPrice: newPrice,
      fechaSync: admin.firestore.Timestamp.now(),
    });
    return { success: true, mlItemId: map.mlItemId, oldPrice: map.mlPrice, newPrice };
  } catch (err: any) {
    functions.logger.error(`Price update failed for ${map.mlItemId}:`, err.message);
    throw new functions.https.HttpsError("internal", `Error actualizando precio en ML: ${err.message}`);
  }
});

// ============================================================
// FUNCIÓN: Registrar webhook URL en Mercado Libre
// ============================================================

/**
 * Registra la URL de notificaciones (webhook) en la aplicación ML.
 * Sin esto, ML no envía notificaciones de órdenes, envíos, etc.
 *
 * Debe ejecutarse una vez después de conectar la cuenta ML.
 * La URL registrada es: https://us-central1-businessmn-269c9.cloudfunctions.net/mlwebhook
 */
export const mlregisterwebhook = functions.https.onCall(async (_data, context) => {
  await requireAdminRole(context); // SEC-008

  const settingsDoc = await db.collection("mlConfig").doc("settings").get();
  if (!settingsDoc.exists || !settingsDoc.data()?.connected) {
    throw new functions.https.HttpsError("failed-precondition", "ML no está conectado");
  }

  const webhookUrl = "https://us-central1-businessmn-269c9.cloudfunctions.net/mlwebhook";

  try {
    // 1. Verificar config actual
    const currentConfig = await getApplicationConfig();
    const currentUrl = currentConfig.notification_callback_url || null;

    functions.logger.info(`ML Webhook: URL actual = ${currentUrl}`);

    // 2. Registrar/actualizar URL
    await registerWebhookUrl(webhookUrl);

    functions.logger.info(`ML Webhook: URL registrada exitosamente → ${webhookUrl}`);

    // 3. Guardar en config local
    await db.collection("mlConfig").doc("settings").update({
      webhookUrl,
      webhookRegistered: true,
      webhookRegisteredAt: admin.firestore.Timestamp.now(),
    });

    return {
      success: true,
      previousUrl: currentUrl,
      registeredUrl: webhookUrl,
      topics: ["orders_v2", "items", "shipments", "questions"],
    };
  } catch (err: any) {
    functions.logger.error("ML Webhook registration failed:", err.response?.data || err.message);
    throw new functions.https.HttpsError(
      "internal",
      `Error registrando webhook: ${err.response?.data?.message || err.message}`
    );
  }
});

/**
 * Obtiene el estado actual del webhook de ML
 */
export const mlgetwebhookstatus = functions.https.onCall(async (_data, context) => {
  await requireAdminRole(context); // SEC-008

  try {
    const appConfig = await getApplicationConfig();
    return {
      notificationUrl: appConfig.notification_callback_url || null,
      topics: appConfig.notification_topics || [],
    };
  } catch (err: any) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});

// ============================================================
// FUNCIÓN: Importar historial de órdenes ML
// ============================================================

/**
 * Importa órdenes históricas desde ML al sistema.
 * Busca las últimas N órdenes del seller en la API de ML y crea
 * registros en mlOrderSync para cada una (omitiendo las que ya existen).
 *
 * NO auto-procesa ventas — el usuario revisa y decide manualmente.
 * Las órdenes importadas se marcan con origen: "importacion_historica"
 * para distinguirlas de las que llegan por webhook en tiempo real.
 */
export const mlimporthistoricalorders = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (data, context) => {
    await requireAdminRole(context); // SEC-008

    const settingsDoc = await db.collection("mlConfig").doc("settings").get();
    if (!settingsDoc.exists || !settingsDoc.data()?.connected) {
      throw new functions.https.HttpsError("failed-precondition", "ML no está conectado");
    }

    const { userId } = settingsDoc.data()!;
    const maxOrders = Math.min(data?.maxOrders || 100, 200); // Límite máximo: 200

    try {
      const { importHistoricalOrders } = await import("./ml.sync");
      const result = await importHistoricalOrders(userId, maxOrders);
      return result;
    } catch (err: any) {
      functions.logger.error("ML import historical orders error:", err);
      throw new functions.https.HttpsError("internal", err.message);
    }
  });

// ============================================================
// FUNCIONES: Procesamiento de órdenes ML → Ventas ERP
// ============================================================

/**
 * Procesa una orden ML individual → crea venta, pago, inventario, gastos
 * Usado para retry manual desde la UI
 */
export const mlprocesarorden = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const { orderSyncId } = data;
  if (!orderSyncId) {
    throw new functions.https.HttpsError("invalid-argument", "orderSyncId es requerido");
  }

  const orderSyncRef = db.collection("mlOrderSync").doc(orderSyncId);

  // Claim transaccional: solo procesar si estado es "pendiente" o "error"
  // Esto previene race conditions si un webhook está procesando simultáneamente
  const claimResult = await db.runTransaction(async (tx) => {
    const doc = await tx.get(orderSyncRef);
    if (!doc.exists) {
      return { success: false as const, reason: "not_found" as const };
    }
    const data = doc.data()!;
    if (data.estado === "procesada") {
      return { success: false as const, reason: "already_done" as const, ventaId: data.ventaId, numeroVenta: data.numeroVenta };
    }
    if (data.estado === "procesando") {
      return { success: false as const, reason: "in_progress" as const };
    }
    // Claim: marcar como "procesando" atómicamente
    tx.update(orderSyncRef, { estado: "procesando" });
    return { success: true as const, orderSync: { id: doc.id, ...data } };
  });

  if (!claimResult.success) {
    if (claimResult.reason === "not_found") {
      throw new functions.https.HttpsError("not-found", "Orden ML no encontrada");
    }
    if (claimResult.reason === "already_done") {
      return { already: true, ventaId: (claimResult as any).ventaId, numeroVenta: (claimResult as any).numeroVenta };
    }
    if (claimResult.reason === "in_progress") {
      throw new functions.https.HttpsError("already-exists", "Esta orden ya está siendo procesada por otro proceso. Espera unos segundos e intenta de nuevo.");
    }
  }

  try {
    const result = await procesarOrdenCompleta(
      (claimResult as any).orderSync as any,
      orderSyncRef
    );
    return result;
  } catch (err: any) {
    // Si falla, revertir a "error" para permitir retry
    await orderSyncRef.update({ estado: "error", errorDetalle: err.message });
    throw new functions.https.HttpsError("internal", `Error procesando orden: ${err.message}`);
  }
});

/**
 * Procesa todas las órdenes pendientes que tienen todos los productos vinculados
 */
export const mlprocesarpendientes = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const pendientesQuery = await db.collection("mlOrderSync")
    .where("estado", "in", ["pendiente", "error"])
    .where("todosVinculados", "==", true)
    .get();

  if (pendientesQuery.empty) {
    return { procesadas: 0, errores: 0, detalles: [] };
  }

  let procesadas = 0;
  let errores = 0;
  const detalles: Array<{ mlOrderId: number; resultado: string; ventaId?: string; error?: string }> = [];

  for (const docSnap of pendientesQuery.docs) {
    const orderSync = docSnap.data() as MLOrderSync & Record<string, any>;

    // Claim transaccional antes de procesar
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(docSnap.ref);
      if (!fresh.exists) return false;
      const estado = fresh.data()!.estado;
      if (estado !== "pendiente" && estado !== "error") return false;
      tx.update(docSnap.ref, { estado: "procesando" });
      return true;
    });

    if (!claimed) {
      detalles.push({
        mlOrderId: orderSync.mlOrderId,
        resultado: "skipped",
        error: "Ya siendo procesada o estado cambió",
      });
      continue;
    }

    try {
      const result = await procesarOrdenCompleta(
        { id: docSnap.id, ...orderSync } as any,
        docSnap.ref
      );
      procesadas++;
      detalles.push({
        mlOrderId: orderSync.mlOrderId,
        resultado: "procesada",
        ventaId: result.ventaId,
      });
    } catch (err: any) {
      errores++;
      await docSnap.ref.update({ estado: "error", errorDetalle: err.message });
      detalles.push({
        mlOrderId: orderSync.mlOrderId,
        resultado: "error",
        error: err.message,
      });
    }
  }

  functions.logger.info(
    `ML Batch: ${procesadas} procesadas, ${errores} errores de ${pendientesQuery.size} pendientes`
  );

  return { procesadas, errores, detalles };
});

// ============================================================
// FUNCIÓN: Auto-crear ventas ML cuando datos están completos (scheduled cada 2 min)
// ============================================================

const ML_AUTOCREATE_MIN_DELAY_MS = 3 * 60 * 1000; // 3 min mínimo para dar tiempo a webhooks
const ML_AUTOCREATE_MAX_WAIT_MS = 30 * 60 * 1000;  // 30 min máximo — después crear con re-fetch

/**
 * Procesa órdenes ML que tienen datos completos (comisión + método de envío).
 * Requiere:
 *  1. Timer mínimo expirado (3 min desde webhook)
 *  2. comisionML > 0 Y metodoEnvio definido (datos completos)
 *  OR timeout máximo de 30 min (safety net — crea con re-fetch de ML API)
 */
export const mlautocreateventas = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .pubsub.schedule("every 2 minutes")
  .onRun(async () => {
    const ahora = admin.firestore.Timestamp.now();
    const ahoraMs = ahora.toMillis();

    // Query por estado solamente — filtrar en memoria
    const queryPendientes = await db.collection("mlOrderSync")
      .where("estado", "==", "pendiente")
      .get();

    const queryError = await db.collection("mlOrderSync")
      .where("estado", "==", "error")
      .get();

    // Filtrar en memoria: timer expirado + productos vinculados + datos completos (o timeout)
    const allDocs = [...queryPendientes.docs, ...queryError.docs]
      .filter(doc => {
        const data = doc.data();
        if (data.todosVinculados !== true) return false;
        if (!data.crearVentaDespuesDe) return false;

        // Delay mínimo de 3 min siempre debe cumplirse
        const delayExpirado = data.crearVentaDespuesDe.toMillis() <= ahoraMs;
        if (!delayExpirado) return false;

        const datosCompletos = (data.comisionML || 0) > 0 && !!data.metodoEnvio;

        // Si datos completos → listo para procesar
        if (datosCompletos) return true;

        // Si datos incompletos pero timeout máximo alcanzado → procesar con re-fetch
        const tiempoEspera = ahoraMs - data.crearVentaDespuesDe.toMillis() + ML_AUTOCREATE_MIN_DELAY_MS;
        if (tiempoEspera >= ML_AUTOCREATE_MAX_WAIT_MS) {
          functions.logger.warn(
            `ML AutoCreate: orden ${data.mlOrderId} esperó ${Math.round(tiempoEspera / 60000)}min sin datos completos ` +
            `(comision=${data.comisionML || 0}, metodo=${data.metodoEnvio || "null"}). Procesando con re-fetch.`
          );
          return true;
        }

        return false;
      });

    if (allDocs.length === 0) return null;

    functions.logger.info(
      `ML AutoCreate: ${allDocs.length} órdenes listas para crear venta`
    );

    let procesadas = 0;
    let errores = 0;

    for (const docSnap of allDocs) {
      const orderSync = docSnap.data();

      // Claim transaccional — mismo patrón que mlprocesarpendientes
      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(docSnap.ref);
        if (!fresh.exists) return false;
        const estado = fresh.data()!.estado;
        if (estado !== "pendiente" && estado !== "error") return false;
        tx.update(docSnap.ref, { estado: "procesando" });
        return true;
      });

      if (!claimed) continue;

      try {
        const result = await procesarOrdenCompleta(
          { id: docSnap.id, ...orderSync } as any,
          docSnap.ref
        );
        procesadas++;
        functions.logger.info(
          `ML AutoCreate: ${orderSync.mlOrderId || docSnap.id} → venta ${result.ventaId} creada`
        );
      } catch (err: any) {
        errores++;
        await docSnap.ref.update({
          estado: "error",
          errorDetalle: `AutoCreate error: ${err.message}`,
        });
        functions.logger.error(
          `ML AutoCreate: error procesando ${orderSync.mlOrderId || docSnap.id}`,
          err
        );
      }
    }

    functions.logger.info(
      `ML AutoCreate: ${procesadas} procesadas, ${errores} errores de ${allDocs.length} listas`
    );
    return null;
  });

// ============================================================
// FUNCIÓN: Consolidar pack orders duplicados + fix data
// ============================================================

/**
 * Detecta y corrige pack orders duplicados:
 * 1. Detecta mlOrderSync docs que comparten shipmentId (= pack orders pre-fix)
 * 2. Merge las ventas duplicadas en una sola (combina productos, corrige totales)
 * 3. Elimina la venta duplicada y sus gastos/movimientos de tesorería duplicados
 * 4. Corrige el saldo de la cuenta MercadoPago
 * 5. Consolida los mlOrderSync docs en un solo pack doc
 */
export const mlconsolidatepackorders = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (data, context) => {
    await requireAdminRole(context); // SEC-008

    const dryRun = data?.dryRun !== false; // Default: solo diagnosticar
    const log: string[] = [];

    // 1. Detectar duplicados por shipmentId
    const allSyncs = await db.collection("mlOrderSync").get();
    const byShipment = new Map<number, FirebaseFirestore.QueryDocumentSnapshot[]>();

    for (const doc of allSyncs.docs) {
      const d = doc.data();
      if (d.shipmentId && typeof d.shipmentId === "number") {
        if (!byShipment.has(d.shipmentId)) byShipment.set(d.shipmentId, []);
        byShipment.get(d.shipmentId)!.push(doc);
      }
    }

    const duplicateGroups: Array<{
      shipmentId: number;
      syncDocs: FirebaseFirestore.QueryDocumentSnapshot[];
      ventaIds: string[];
    }> = [];

    for (const [shipId, docs] of byShipment.entries()) {
      const nonPack = docs.filter(d => !d.id.startsWith("ml-pack-"));
      if (nonPack.length < 2) continue;
      const ventaIds = nonPack.map(d => d.data().ventaId).filter(Boolean) as string[];
      duplicateGroups.push({ shipmentId: shipId, syncDocs: nonPack, ventaIds });
    }

    if (duplicateGroups.length === 0) {
      return { fixed: 0, log: ["No se encontraron pack orders duplicados."] };
    }

    log.push(`Encontrados ${duplicateGroups.length} grupo(s) de pack orders duplicados`);
    let fixed = 0;

    for (const group of duplicateGroups) {
      const { shipmentId, syncDocs, ventaIds } = group;
      const orderIds = syncDocs.map(d => d.data().mlOrderId);
      log.push(`--- Shipment ${shipmentId}: órdenes ${orderIds.join(", ")} ---`);

      if (ventaIds.length < 2) {
        log.push(`  Solo ${ventaIds.length} venta(s) vinculada(s), skip merge`);
        continue;
      }

      // Leer las ventas
      const ventaDocs = await Promise.all(
        ventaIds.map(id => db.collection("ventas").doc(id).get())
      );
      const ventasExistentes = ventaDocs.filter(d => d.exists);
      if (ventasExistentes.length < 2) {
        log.push(`  Solo ${ventasExistentes.length} venta(s) existen en Firestore, skip`);
        continue;
      }

      // Elegir la venta principal (la primera) y la(s) duplicada(s)
      const ventaPrincipal = ventasExistentes[0];
      const ventasDuplicadas = ventasExistentes.slice(1);
      const vpData = ventaPrincipal.data()!;

      log.push(`  Venta principal: ${vpData.numeroVenta} (${ventaPrincipal.id})`);
      for (const vd of ventasDuplicadas) {
        log.push(`  Venta duplicada: ${vd.data()!.numeroVenta} (${vd.id})`);
      }

      if (dryRun) {
        log.push(`  [DRY RUN] Se haría merge y limpieza`);
        // Calcular qué se eliminaría
        for (const vd of ventasDuplicadas) {
          const vdData = vd.data()!;
          // Gastos vinculados a la venta duplicada
          const gastosQ = await db.collection("gastos").where("ventaId", "==", vd.id).get();
          log.push(`  [DRY RUN] Eliminar ${gastosQ.size} gasto(s) de venta ${vdData.numeroVenta}`);
          // Movimientos de tesorería
          const movsQ = await db.collection("movimientosTesoreria").where("ventaId", "==", vd.id).get();
          log.push(`  [DRY RUN] Eliminar ${movsQ.size} movimiento(s) de tesorería`);
          // Envío duplicado
          log.push(`  [DRY RUN] Envío duplicado: costoEnvio=${vdData.costoEnvio || 0}, cargoEnvioML=${vdData.cargoEnvioML || 0}`);
        }
        continue;
      }

      // === EJECUTAR FIX ===
      try {
        // 2a. Merge productos de ventas duplicadas en la venta principal
        const productosMain = vpData.productos || [];
        let mergedProductos = [...productosMain];
        let subtotalMerge = vpData.subtotalPEN || 0;
        let comisionMerge = vpData.comisionML || 0;

        for (const vd of ventasDuplicadas) {
          const vdData = vd.data()!;
          const prodsDup = vdData.productos || [];
          mergedProductos = [...mergedProductos, ...prodsDup];
          subtotalMerge += vdData.subtotalPEN || 0;
          comisionMerge += vdData.comisionML || 0;
        }

        // Recalcular totales (envío solo de la venta principal)
        const costoEnvio = vpData.costoEnvio || 0;
        const cargoEnvioML = vpData.cargoEnvioML || 0;
        const totalMerge = subtotalMerge + costoEnvio;
        const comisionPct = totalMerge > 0 ? (comisionMerge / totalMerge) * 100 : 0;

        // Recalcular costos de unidades asignadas
        let costoTotalPEN = 0;
        for (const prod of mergedProductos) {
          costoTotalPEN += prod.costoTotalUnidades || 0;
        }
        const gastosVentaPEN = comisionMerge + (cargoEnvioML > 0 ? cargoEnvioML : 0);
        const utilidadBruta = totalMerge - costoTotalPEN;
        const utilidadNeta = utilidadBruta - gastosVentaPEN;
        const margenBruto = totalMerge > 0 ? (utilidadBruta / totalMerge) * 100 : 0;
        const margenNeto = totalMerge > 0 ? (utilidadNeta / totalMerge) * 100 : 0;

        // 2b. Actualizar venta principal con datos mergeados
        const subOrderIds = orderIds;
        const packId = shipmentId; // Usar shipmentId como packId de referencia
        await db.collection("ventas").doc(ventaPrincipal.id).update({
          productos: mergedProductos,
          subtotalPEN: subtotalMerge,
          totalPEN: totalMerge,
          comisionML: comisionMerge,
          comisionMLPorcentaje: comisionPct,
          gastosVentaPEN,
          costoTotalPEN,
          utilidadBrutaPEN: utilidadBruta,
          utilidadNetaPEN: utilidadNeta,
          margenBruto,
          margenNeto,
          montoPagado: totalMerge,
          montoPendiente: 0,
          packId,
          subOrderIds,
          observaciones: `Pack ML (shipment ${shipmentId}, sub-órdenes: ${orderIds.join(", ")}) - Consolidado automáticamente`,
        });
        log.push(`  Venta ${vpData.numeroVenta} actualizada con ${mergedProductos.length} productos, total S/ ${totalMerge.toFixed(2)}`);

        // 2c. Actualizar pago de la venta principal (monto correcto)
        const pagosMain = vpData.pagos || [];
        if (pagosMain.length > 0) {
          pagosMain[0].monto = totalMerge;
          await db.collection("ventas").doc(ventaPrincipal.id).update({
            pagos: pagosMain,
          });
        }

        // 3. Eliminar datos de ventas duplicadas
        let saldoCorrection = 0; // Monto a devolver al saldo MP

        for (const vd of ventasDuplicadas) {
          const vdData = vd.data()!;
          const vdId = vd.id;

          // 3a. Liberar unidades reservadas por la venta duplicada
          const unitsQ = await db.collection("unidades")
            .where("reservadaPara", "==", vdId)
            .get();
          for (const unitDoc of unitsQ.docs) {
            // Reasignar a la venta principal
            await unitDoc.ref.update({
              reservadaPara: ventaPrincipal.id,
            });
          }
          log.push(`  ${unitsQ.size} unidad(es) reasignadas de ${vdData.numeroVenta} → ${vpData.numeroVenta}`);

          // 3b. Eliminar gastos vinculados a la venta duplicada
          const gastosQ = await db.collection("gastos").where("ventaId", "==", vdId).get();
          for (const gastoDoc of gastosQ.docs) {
            const gData = gastoDoc.data();
            saldoCorrection += gData.montoPEN || 0; // Estos egresos se eliminan → devolver al saldo
            await gastoDoc.ref.delete();
          }
          log.push(`  ${gastosQ.size} gasto(s) eliminados (S/ ${saldoCorrection.toFixed(2)} a devolver al saldo MP)`);

          // 3c. Eliminar movimientos de tesorería de la venta duplicada
          const movsQ = await db.collection("movimientosTesoreria").where("ventaId", "==", vdId).get();
          let ingresosDup = 0;
          let egresosDup = 0;
          for (const movDoc of movsQ.docs) {
            const mData = movDoc.data();
            if (mData.tipo === "ingreso_venta") {
              ingresosDup += mData.monto || 0;
            } else {
              egresosDup += mData.monto || 0;
            }
            await movDoc.ref.delete();
          }
          log.push(`  ${movsQ.size} movimiento(s) tesorería eliminados (ingresos: S/ ${ingresosDup.toFixed(2)}, egresos: S/ ${egresosDup.toFixed(2)})`);

          // 3d. Corregir saldo cuenta MP:
          //     - Se eliminó un ingreso_venta duplicado → restar del saldo
          //     - Se eliminaron egresos duplicados (gastos) → sumar al saldo
          //     Neto = -ingresos + egresos (porque el saldo original se incrementó/decrementó por ambos)
          const netBalanceAdjust = -ingresosDup + egresosDup;

          // 3e. Eliminar la venta duplicada
          await db.collection("ventas").doc(vdId).delete();
          log.push(`  Venta duplicada ${vdData.numeroVenta} (${vdId}) eliminada`);

          // Aplicar corrección de saldo
          if (netBalanceAdjust !== 0) {
            const cuentaMP = await buscarCuentaMPDirecta();
            if (cuentaMP) {
              await db.collection("cuentasCaja").doc(cuentaMP).update({
                saldoActual: admin.firestore.FieldValue.increment(netBalanceAdjust),
              });
              log.push(`  Saldo MP ajustado: ${netBalanceAdjust > 0 ? "+" : ""}S/ ${netBalanceAdjust.toFixed(2)}`);
            }
          }
        }

        // 4. Actualizar movimiento de tesorería de la venta principal (monto correcto)
        const movsMainQ = await db.collection("movimientosTesoreria")
          .where("ventaId", "==", ventaPrincipal.id)
          .where("tipo", "==", "ingreso_venta")
          .limit(1)
          .get();
        if (!movsMainQ.empty) {
          const oldMonto = movsMainQ.docs[0].data().monto || 0;
          if (Math.abs(oldMonto - totalMerge) > 0.01) {
            const diff = totalMerge - oldMonto;
            await movsMainQ.docs[0].ref.update({
              monto: totalMerge,
              concepto: `Pago venta ${vpData.numeroVenta} - Pack ML (shipment ${shipmentId})`,
            });
            // Corregir saldo MP por la diferencia del ingreso
            const cuentaMP = await buscarCuentaMPDirecta();
            if (cuentaMP) {
              await db.collection("cuentasCaja").doc(cuentaMP).update({
                saldoActual: admin.firestore.FieldValue.increment(diff),
              });
              log.push(`  Ingreso principal ajustado: S/ ${oldMonto.toFixed(2)} → S/ ${totalMerge.toFixed(2)} (diff: ${diff > 0 ? "+" : ""}${diff.toFixed(2)})`);
            }
          }
        }

        // 5. Actualizar gastos de comisión de la venta principal (monto consolidado)
        const gastosMainQ = await db.collection("gastos")
          .where("ventaId", "==", ventaPrincipal.id)
          .where("tipo", "==", "comision_ml")
          .limit(1)
          .get();
        if (!gastosMainQ.empty) {
          const oldComision = gastosMainQ.docs[0].data().montoPEN || 0;
          if (Math.abs(oldComision - comisionMerge) > 0.01) {
            const diff = comisionMerge - oldComision;
            await gastosMainQ.docs[0].ref.update({
              montoOriginal: comisionMerge,
              montoPEN: comisionMerge,
              montoPagado: comisionMerge,
              descripcion: `Comisión ML - Pack (shipment ${shipmentId}) - ${vpData.numeroVenta}`,
              pagos: [{
                ...gastosMainQ.docs[0].data().pagos?.[0],
                montoOriginal: comisionMerge,
                montoPEN: comisionMerge,
              }],
            });
            // Ajustar saldo MP y movimiento de tesorería por la diferencia
            const movGastoQ = await db.collection("movimientosTesoreria")
              .where("gastoId", "==", gastosMainQ.docs[0].id)
              .limit(1)
              .get();
            if (!movGastoQ.empty) {
              await movGastoQ.docs[0].ref.update({
                monto: comisionMerge,
              });
            }
            const cuentaMP = await buscarCuentaMPDirecta();
            if (cuentaMP) {
              await db.collection("cuentasCaja").doc(cuentaMP).update({
                saldoActual: admin.firestore.FieldValue.increment(-diff),
              });
              log.push(`  Comisión principal ajustada: S/ ${oldComision.toFixed(2)} → S/ ${comisionMerge.toFixed(2)}`);
            }
          }
        }

        // 6. Consolidar mlOrderSync docs
        const primarySync = syncDocs[0];
        // Merge productos de todos los sync docs
        let allProductos: any[] = [];
        let totalMLMerge = 0;
        let comisionMLMerge = 0;
        for (const sd of syncDocs) {
          const sdData = sd.data();
          allProductos = [...allProductos, ...(sdData.productos || [])];
          totalMLMerge += sdData.totalML || 0;
          comisionMLMerge += sdData.comisionML || 0;
        }

        // Actualizar el sync doc principal
        await primarySync.ref.update({
          packId,
          subOrderIds: orderIds,
          subOrdersRecibidas: orderIds.length,
          productos: allProductos,
          totalML: totalMLMerge,
          comisionML: comisionMLMerge,
          ventaId: ventaPrincipal.id,
          numeroVenta: vpData.numeroVenta,
        });

        // Marcar los otros sync docs como "ignorada" con referencia al pack
        for (let i = 1; i < syncDocs.length; i++) {
          await syncDocs[i].ref.update({
            estado: "ignorada",
            errorDetalle: `Consolidado en pack (shipment ${shipmentId}) → ${primarySync.id}`,
            ventaId: ventaPrincipal.id,
            numeroVenta: vpData.numeroVenta,
          });
        }
        log.push(`  mlOrderSync consolidados: ${primarySync.id} es principal, ${syncDocs.length - 1} marcados como ignorada`);

        fixed++;
        log.push(`  === PACK CORREGIDO EXITOSAMENTE ===`);
      } catch (err: any) {
        log.push(`  ERROR: ${err.message}`);
        functions.logger.error(`Error consolidando pack shipment ${shipmentId}`, err);
      }
    }

    return {
      dryRun,
      found: duplicateGroups.length,
      fixed,
      log,
    };
  });

/**
 * Helper: buscar cuenta MercadoPago directamente
 */
async function buscarCuentaMPDirecta(): Promise<string | null> {
  const q = await db.collection("cuentasCaja")
    .where("nombre", ">=", "Mercado")
    .where("nombre", "<=", "Mercado\uf8ff")
    .limit(1)
    .get();
  if (!q.empty) return q.docs[0].id;
  const q2 = await db.collection("cuentasCaja")
    .where("tipo", "==", "mercado_pago")
    .limit(1)
    .get();
  return q2.empty ? null : q2.docs[0].id;
}

// ============================================================
// FUNCIÓN: Re-enriquecer datos de buyers desde ML API
// ============================================================

/**
 * Re-obtiene datos reales del buyer (nombre, DNI, teléfono, email) desde la API de ML
 * para todas las órdenes existentes en mlOrderSync.
 * También actualiza los clientes ERP ya creados.
 * Timeout extendido: puede tardar con muchas órdenes.
 */
export const mlreenrichbuyers = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    try {
      const { reenrichBuyerData } = await import("./ml.sync");
      const result = await reenrichBuyerData();
      return result;
    } catch (err: any) {
      functions.logger.error("ML re-enrich buyers error:", err);
      throw new functions.https.HttpsError("internal", err.message);
    }
  });

/**
 * Repara ventas Urbano que se procesaron con costoEnvioCliente inflado.
 * Corrige: mlOrderSync, venta (total, costoEnvio, márgenes), pago, tesorería y saldo cuenta.
 */
export const mlrepararventasurbano = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    try {
      const { repararVentasUrbano } = await import("./ml.sync");
      const result = await repararVentasUrbano();
      return result;
    } catch (err: any) {
      functions.logger.error("ML repair Urbano ventas error:", err);
      throw new functions.https.HttpsError("internal", err.message);
    }
  });

/**
 * Repara nombres (Title Case) y DNI faltante en ventas ML existentes.
 */
export const mlrepararnamesdni = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    try {
      const { repararNombresDniVentas } = await import("./ml.sync");
      const result = await repararNombresDniVentas();
      return result;
    } catch (err: any) {
      functions.logger.error("ML repair nombres/DNI error:", err);
      throw new functions.https.HttpsError("internal", err.message);
    }
  });

/**
 * Diagnóstico: inspecciona los datos crudos de envío de una orden ML
 */
export const mldiagshipping = functions.https.onCall(async (data, context) => {
  await requireAdminRole(context); // SEC-008

  const { orderId } = data;
  if (!orderId) {
    throw new functions.https.HttpsError("invalid-argument", "orderId requerido");
  }

  try {
    const { getOrder, getShipment } = await import("./ml.api");
    const order = await getOrder(orderId);

    const result: Record<string, any> = {
      orderId: order.id,
      total_amount: order.total_amount,
      currency: order.currency_id,
      payments: order.payments?.map((p: any) => ({
        id: p.id,
        transaction_amount: p.transaction_amount,
        shipping_cost: p.shipping_cost,
        total_paid_amount: p.total_paid_amount,
        status: p.status,
      })),
      shipping_id: order.shipping?.id,
      shipment: null as any,
    };

    if (order.shipping?.id) {
      try {
        const shipment = await getShipment(order.shipping.id);
        result.shipment = {
          id: shipment.id,
          status: shipment.status,
          shipping_mode: shipment.shipping_mode,
          lead_time: shipment.lead_time,
          shipping_option: (shipment as any).shipping_option || null,
          cost: (shipment as any).cost ?? null,
          base_cost: (shipment as any).base_cost ?? null,
        };
      } catch (err: any) {
        result.shipment_error = err.message;
      }
    }

    functions.logger.info(`ML Diag Shipping for order ${orderId}:`, JSON.stringify(result));
    return result;
  } catch (err: any) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});

/**
 * Migración: Parchea órdenes existentes con metodoEnvio y cargoEnvioML.
 * Re-fetches shipment data from ML API for reliable method detection
 * (trackingMethod alone is often null in imported orders).
 */
export const mlpatchenvio = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    const { getShipment } = await import("./ml.api");
    const db = admin.firestore();
    const snapshot = await db.collection("mlOrderSync").get();

    let parchadas = 0;
    let sinCambio = 0;
    let sinMetodo = 0;
    let refetched = 0;
    const detalles: Array<{ orderId: number; metodo: string; rawMethod: string; costoEnvioCliente: number; cargoEnvioML: number }> = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Skip si ya tiene metodoEnvio asignado correctamente
      if (data.metodoEnvio) {
        sinCambio++;
        continue;
      }

      // Intentar detectar desde trackingMethod guardado
      let rawMethod = (data.trackingMethod || "").toLowerCase();
      let metodoEnvio: "flex" | "urbano" | null = null;

      if (rawMethod) {
        if (rawMethod.includes("flex") || rawMethod === "self_service") {
          metodoEnvio = "flex";
        } else if (rawMethod.includes("urbano") || rawMethod === "standard" || rawMethod === "normal") {
          metodoEnvio = "urbano";
        }
      }

      // Si no se detectó y tenemos shipmentId, re-fetch desde ML API
      if (!metodoEnvio && data.shipmentId) {
        try {
          const shipment = await getShipment(data.shipmentId);
          rawMethod = (shipment.tracking_method || "").toLowerCase();

          // Actualizar trackingMethod en Firestore de paso
          if (shipment.tracking_method) {
            await doc.ref.update({ trackingMethod: shipment.tracking_method });
          }

          if (rawMethod.includes("flex") || rawMethod === "self_service") {
            metodoEnvio = "flex";
          } else if (rawMethod.includes("urbano") || rawMethod === "standard" || rawMethod === "normal") {
            metodoEnvio = "urbano";
          }

          // Fallback: usar logistic_type del shipment
          if (!metodoEnvio) {
            const logType = ((shipment as any).logistic_type || "").toLowerCase();
            const shippingMode = (shipment.shipping_mode || "").toLowerCase();
            if (logType === "self_service" || logType.includes("flex")) {
              metodoEnvio = "flex";
            } else if (logType === "xd_drop_off" || logType === "cross_docking" || logType === "drop_off" || logType === "fulfillment") {
              metodoEnvio = "urbano";
            } else if (shippingMode === "me1" || shippingMode === "me2") {
              // me2 con logistic_type no-flex = urbano/colectivo
              // me1 = normalmente ML envía
              metodoEnvio = shippingMode === "me1" ? "urbano" : "flex";
            }
            rawMethod = rawMethod || logType || shippingMode || "unknown";
          }

          refetched++;
          // Rate limit
          await new Promise((r) => setTimeout(r, 200));
        } catch (err: any) {
          functions.logger.warn(`Patch: no se pudo re-fetch shipment ${data.shipmentId}: ${err.message}`);
        }
      }

      if (!metodoEnvio) {
        sinMetodo++;
        functions.logger.info(`Patch skip: order ${data.mlOrderId}, trackingMethod="${data.trackingMethod}", shipmentId=${data.shipmentId || "null"}`);
        continue;
      }

      const update: Record<string, any> = { metodoEnvio };

      // Para Urbano: mover costoEnvioCliente → cargoEnvioML
      if (metodoEnvio === "urbano" && (data.costoEnvioCliente || 0) > 0) {
        update.cargoEnvioML = data.costoEnvioCliente;
        update.costoEnvioCliente = 0;
      } else {
        update.cargoEnvioML = 0;
      }

      await doc.ref.update(update);
      parchadas++;

      detalles.push({
        orderId: data.mlOrderId,
        metodo: metodoEnvio,
        rawMethod,
        costoEnvioCliente: update.costoEnvioCliente ?? data.costoEnvioCliente ?? 0,
        cargoEnvioML: update.cargoEnvioML ?? 0,
      });
    }

    functions.logger.info(
      `ML Patch Envío: ${parchadas} parchadas, ${sinCambio} ya tenían método, ${sinMetodo} sin método, ${refetched} re-fetched desde API`
    );

    return { parchadas, sinCambio, sinMetodo, refetched, total: snapshot.size, detalles };
  });

/**
 * Migración: Corrige ventas históricas ML ya procesadas.
 *
 * - Sincroniza metodoEnvio y cargoEnvioML desde mlOrderSync parchado
 * - Recalcula gastosVentaPEN = solo comisionML (sin cargoEnvioML)
 * - Recalcula utilidadNetaPEN / margenNeto
 * - Para Urbano: ajusta costoEnvio a 0 en la venta (no es ingreso)
 * - Elimina gastos duplicados tipo "cargo_envio_ml" si existen
 * - Revierte movimientos tesorería y ajusta saldo cuenta MP
 */
export const mlfixventashistoricas = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    const db = admin.firestore();

    // 1. Obtener todas las ventas ML
    const ventasSnap = await db.collection("ventas")
      .where("creadoPor", "==", "ml-auto-processor")
      .get();

    if (ventasSnap.empty) {
      return { corregidas: 0, sinCambio: 0, gastosEliminados: 0, total: 0, detalles: [] };
    }

    // 2. Indexar mlOrderSync por mlOrderId para lookup rápido
    const orderSyncSnap = await db.collection("mlOrderSync").get();
    const orderSyncByMLId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of orderSyncSnap.docs) {
      const data = doc.data();
      if (data.mlOrderId) {
        orderSyncByMLId.set(String(data.mlOrderId), doc);
      }
    }

    let corregidas = 0;
    let sinCambio = 0;
    let gastosEliminados = 0;
    const detalles: Array<{
      numeroVenta: string;
      mlOrderId: string;
      metodoEnvio: string | null;
      cargoEnvioML: number;
      gastosVentaPENAntes: number;
      gastosVentaPENDespues: number;
      utilidadNetaAntes: number;
      utilidadNetaDespues: number;
      gastoCargoEliminado: boolean;
      costoEnvioAjustado: boolean;
    }> = [];

    for (const ventaDoc of ventasSnap.docs) {
      const venta = ventaDoc.data();
      const mlOrderId = venta.mercadoLibreId;

      if (!mlOrderId) continue;

      // Buscar mlOrderSync correspondiente
      const orderSyncDoc = orderSyncByMLId.get(mlOrderId);
      if (!orderSyncDoc) {
        functions.logger.warn(`Fix: Venta ${venta.numeroVenta} sin mlOrderSync para order ${mlOrderId}`);
        sinCambio++;
        continue;
      }

      const orderSync = orderSyncDoc.data();
      const metodoEnvio = orderSync.metodoEnvio || null;
      const cargoEnvioML = orderSync.cargoEnvioML || 0;
      const comisionML = venta.comisionML || orderSync.comisionML || 0;

      // Calcular valores correctos
      const gastosVentaPENAntes = venta.gastosVentaPEN || 0;
      const gastosVentaPENCorrect = comisionML; // Solo comisión, sin cargoEnvioML

      // Para Urbano: costoEnvio debe ser 0 (no es ingreso)
      const costoEnvioAntes = venta.costoEnvio || 0;
      const costoEnvioCorrect = metodoEnvio === "urbano" ? 0 : costoEnvioAntes;
      const totalPENCorrect = (venta.subtotalPEN || 0) + costoEnvioCorrect;

      // Recalcular rentabilidad
      const costoTotalPEN = venta.costoTotalPEN || 0;
      const utilidadBrutaPEN = totalPENCorrect - costoTotalPEN;
      const utilidadNetaPEN = utilidadBrutaPEN - gastosVentaPENCorrect;
      const margenBruto = totalPENCorrect > 0 ? (utilidadBrutaPEN / totalPENCorrect) * 100 : 0;
      const margenNeto = totalPENCorrect > 0 ? (utilidadNetaPEN / totalPENCorrect) * 100 : 0;

      // Comprobar si hay cambios reales
      const cambios =
        venta.metodoEnvio !== metodoEnvio ||
        (venta.cargoEnvioML || 0) !== cargoEnvioML ||
        gastosVentaPENAntes !== gastosVentaPENCorrect ||
        costoEnvioAntes !== costoEnvioCorrect;

      if (!cambios) {
        sinCambio++;
        continue;
      }

      // 3. Actualizar la venta
      const ventaUpdate: Record<string, any> = {
        metodoEnvio,
        cargoEnvioML,
        costoEnvio: costoEnvioCorrect,
        totalPEN: totalPENCorrect,
        gastosVentaPEN: gastosVentaPENCorrect,
        comisionML,
        comisionMLPorcentaje: totalPENCorrect > 0 ? (comisionML / totalPENCorrect) * 100 : 0,
        utilidadBrutaPEN,
        utilidadNetaPEN,
        margenBruto,
        margenNeto,
        // Actualizar también montoPagado/montoPendiente si totalPEN cambió
        montoPagado: totalPENCorrect,
        montoPendiente: 0,
      };

      await ventaDoc.ref.update(ventaUpdate);

      // 4. Buscar y eliminar gastos duplicados de cargo envío
      let gastoCargoEliminado = false;
      const gastosCargoSnap = await db.collection("gastos")
        .where("ventaId", "==", ventaDoc.id)
        .where("tipo", "==", "cargo_envio_ml")
        .get();

      for (const gastoDoc of gastosCargoSnap.docs) {
        const gasto = gastoDoc.data();

        // Eliminar movimientos tesorería asociados
        const movSnap = await db.collection("movimientosTesoreria")
          .where("gastoId", "==", gastoDoc.id)
          .get();

        for (const movDoc of movSnap.docs) {
          await movDoc.ref.delete();
        }

        // Restaurar saldo de cuenta MP
        if (gasto.pagos && gasto.pagos.length > 0) {
          const cuentaId = gasto.pagos[0].cuentaOrigenId;
          if (cuentaId) {
            await db.collection("cuentasCaja").doc(cuentaId).update({
              saldoActual: admin.firestore.FieldValue.increment(gasto.montoPEN || 0),
            });
          }
        }

        await gastoDoc.ref.delete();
        gastosEliminados++;
        gastoCargoEliminado = true;
      }

      // 5. Si totalPEN cambió (Urbano: removimos costoEnvio del ingreso),
      //    ajustar el movimiento tesorería de ingreso y el saldo de cuenta MP
      if (costoEnvioAntes !== costoEnvioCorrect) {
        const diferencia = costoEnvioAntes - costoEnvioCorrect; // Positivo = reducimos ingreso

        // Actualizar movimiento de ingreso
        const ingresoSnap = await db.collection("movimientosTesoreria")
          .where("ventaId", "==", ventaDoc.id)
          .where("tipo", "==", "ingreso_venta")
          .limit(1)
          .get();

        if (!ingresoSnap.empty) {
          await ingresoSnap.docs[0].ref.update({
            monto: totalPENCorrect,
            concepto: `Pago venta ${venta.numeroVenta} - ML #${mlOrderId} (corregido)`,
          });
        }

        // Ajustar saldo de cuenta MP (descontar lo que no era ingreso real)
        if (diferencia > 0) {
          const cuentaMPId = await buscarCuentaMercadoPago(db);
          if (cuentaMPId) {
            await db.collection("cuentasCaja").doc(cuentaMPId).update({
              saldoActual: admin.firestore.FieldValue.increment(-diferencia),
            });
          }
        }
      }

      corregidas++;
      detalles.push({
        numeroVenta: venta.numeroVenta,
        mlOrderId,
        metodoEnvio,
        cargoEnvioML,
        gastosVentaPENAntes,
        gastosVentaPENDespues: gastosVentaPENCorrect,
        utilidadNetaAntes: venta.utilidadNetaPEN || 0,
        utilidadNetaDespues: utilidadNetaPEN,
        gastoCargoEliminado,
        costoEnvioAjustado: costoEnvioAntes !== costoEnvioCorrect,
      });

      functions.logger.info(
        `Fix venta ${venta.numeroVenta}: método=${metodoEnvio}, ` +
        `gastosVenta ${gastosVentaPENAntes.toFixed(2)} → ${gastosVentaPENCorrect.toFixed(2)}, ` +
        `utilidadNeta ${(venta.utilidadNetaPEN || 0).toFixed(2)} → ${utilidadNetaPEN.toFixed(2)}`
      );
    }

    functions.logger.info(
      `ML Fix Ventas: ${corregidas} corregidas, ${sinCambio} sin cambio, ` +
      `${gastosEliminados} gastos cargo eliminados, total ${ventasSnap.size}`
    );

    return { corregidas, sinCambio, gastosEliminados, total: ventasSnap.size, detalles };
  });

/** Helper: buscar cuenta MercadoPago */
async function buscarCuentaMercadoPago(db: FirebaseFirestore.Firestore): Promise<string | null> {
  const defaultQuery = await db.collection("cuentasCaja")
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("esCuentaPorDefecto", "==", true)
    .where("activa", "==", true)
    .limit(1)
    .get();

  if (!defaultQuery.empty) return defaultQuery.docs[0].id;

  const mpQuery = await db.collection("cuentasCaja")
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("activa", "==", true)
    .limit(1)
    .get();

  return mpQuery.empty ? null : mpQuery.docs[0].id;
}

// ============================================================
// FUNCIÓN: Migración / Reconciliación de stockPendienteML
// ============================================================

/**
 * Recalcula stockPendienteML desde cero para todos los productos,
 * contando las órdenes mlOrderSync en estado "pendiente".
 * También recalcula stockEfectivoML.
 * Sirve como migración inicial y como herramienta de reconciliación.
 */
export const mlmigratestockpendiente = functions.https.onCall(async (_data, context) => {
  await requireAdminRole(context); // SEC-008

  // 1. Leer todas las órdenes pendientes
  const pendientesSnap = await db.collection("mlOrderSync")
    .where("estado", "==", "pendiente")
    .get();

  // 2. Acumular cantidades por productoId
  const pendienteMap = new Map<string, number>();
  let ordenesMigradas = 0;

  for (const doc of pendientesSnap.docs) {
    const order = doc.data();

    // Excluir importaciones históricas sin venta vinculada:
    // ya fueron despachadas físicamente, no deben reservar stock
    if (order.origen === "importacion_historica" && !order.ventaId) {
      continue;
    }

    const productos = order.productos || [];
    let tieneProductosVinculados = false;

    for (const prod of productos) {
      if (prod.productoId && prod.cantidad > 0) {
        const current = pendienteMap.get(prod.productoId) || 0;
        pendienteMap.set(prod.productoId, current + prod.cantidad);
        tieneProductosVinculados = true;
      }
    }

    // Marcar como contabilizado si tiene productos vinculados
    if (tieneProductosVinculados && order.stockPendienteContabilizado !== true) {
      await doc.ref.update({ stockPendienteContabilizado: true });
      ordenesMigradas++;
    }
  }

  // 3. Recalcular stockPendienteML y stockEfectivoML para TODOS los productos vinculados a ML
  // Esto cubre tanto productos con stockPendienteML > 0 como aquellos con stockEfectivoML desactualizado
  const allVinculados = await db.collection("mlProductMap")
    .where("vinculado", "==", true)
    .get();
  const allProductoIds = [...new Set(allVinculados.docs.map((d) => d.data().productoId as string))];

  let productosActualizados = 0;
  let productosReseteados = 0;

  for (const productoId of allProductoIds) {
    try {
      const prodDoc = await db.collection("productos").doc(productoId).get();
      if (!prodDoc.exists) continue;

      const pData = prodDoc.data()!;
      const pendienteCorrecto = pendienteMap.get(productoId) || 0;
      const currentPendiente = pData.stockPendienteML || 0;

      // Contar unidades disponible_peru reales (fuente de verdad)
      const unidadesSnap = await db.collection("unidades")
        .where("productoId", "==", productoId)
        .where("estado", "==", "disponible_peru")
        .get();
      const disponiblePeru = unidadesSnap.size;
      const stockEfectivoML = Math.max(0, disponiblePeru - pendienteCorrecto);

      // Solo actualizar si algo cambió
      if (currentPendiente !== pendienteCorrecto || pData.stockEfectivoML !== stockEfectivoML || pData.stockDisponiblePeru !== disponiblePeru) {
        await prodDoc.ref.update({
          stockPendienteML: pendienteCorrecto,
          stockDisponiblePeru: disponiblePeru,
          stockEfectivoML,
        });

        if (pendienteCorrecto > 0) {
          productosActualizados++;
        } else {
          productosReseteados++;
        }

        functions.logger.info(
          `Migration: ${productoId} → pendiente=${pendienteCorrecto}, disponiblePeru=${disponiblePeru}, efectivo=${stockEfectivoML}`
        );
      }
    } catch (err: any) {
      functions.logger.warn(`Migration error for ${productoId}: ${err.message}`);
    }
  }

  functions.logger.info(
    `Migration complete: ${ordenesMigradas} órdenes migradas, ${productosActualizados} productos actualizados, ${productosReseteados} reseteados`
  );

  return {
    ordenesPendientes: pendientesSnap.size,
    ordenesMigradas,
    productosActualizados,
    productosReseteados,
  };
});

// ============================================================
// FUNCIÓN: Sync Buy Box Status (Competencia de catálogo)
// ============================================================

/**
 * Consulta el estado de competencia (GANANDO/PERDIENDO) para
 * todas las publicaciones de catálogo en ML.
 */
export const mlsyncbuybox = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  try {
    const { syncBuyBoxStatus } = await import("./ml.sync");
    const result = await syncBuyBoxStatus();
    return result;
  } catch (error: any) {
    functions.logger.error("Error syncing buy box status:", error);
    throw new functions.https.HttpsError("internal", error.message || "Error al sincronizar competencia");
  }
});

// ============================================================
// FUNCIÓN: Diagnóstico integral del sistema ML
// Escanea ventas, gastos, tesorería, mlOrderSync buscando
// registros fantasma, duplicados, inconsistencias y huérfanos
// ============================================================

export const mldiagnosticosistema = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (_data, context) => {
  await requireAdminRole(context); // SEC-008

  const log: string[] = [];
  const issues: Array<{
    tipo: string;
    severidad: "critica" | "alta" | "media" | "baja";
    descripcion: string;
    ids: string[];
  }> = [];

  try {
    // ── 1. VENTAS DUPLICADAS por mercadoLibreId ──
    log.push("=== 1. Escaneando ventas ML duplicadas por mercadoLibreId ===");
    const ventasMLSnap = await db.collection("ventas")
      .where("canalNombre", "==", "Mercado Libre")
      .get();

    const ventasByMLId = new Map<string, Array<{ id: string; numero: string; total: number }>>();
    const ventasByNumero = new Map<string, string[]>();
    const allMLVentaIds = new Set<string>();

    for (const doc of ventasMLSnap.docs) {
      const data = doc.data();
      allMLVentaIds.add(doc.id);

      // Agrupar por mercadoLibreId
      const mlId = data.mercadoLibreId;
      if (mlId) {
        if (!ventasByMLId.has(mlId)) ventasByMLId.set(mlId, []);
        ventasByMLId.get(mlId)!.push({
          id: doc.id,
          numero: data.numeroVenta || "SIN-NUMERO",
          total: data.totalPEN || 0,
        });
      }

      // Agrupar por numeroVenta
      const num = data.numeroVenta;
      if (num) {
        if (!ventasByNumero.has(num)) ventasByNumero.set(num, []);
        ventasByNumero.get(num)!.push(doc.id);
      }
    }

    // Detectar duplicados por mercadoLibreId
    let dupVentaCount = 0;
    for (const [mlId, ventas] of ventasByMLId.entries()) {
      if (ventas.length > 1) {
        dupVentaCount++;
        const desc = ventas.map(v => `${v.numero} (${v.id}) S/${v.total.toFixed(2)}`).join(" | ");
        issues.push({
          tipo: "venta_duplicada_mlId",
          severidad: "critica",
          descripcion: `ML Order ${mlId}: ${ventas.length} ventas → ${desc}`,
          ids: ventas.map(v => v.id),
        });
        log.push(`❌ ML Order ${mlId}: ${ventas.length} ventas duplicadas`);
      }
    }
    log.push(`  Ventas ML: ${ventasMLSnap.size}. Duplicados por mlId: ${dupVentaCount}`);

    // Detectar números de venta duplicados
    let dupNumCount = 0;
    for (const [num, ids] of ventasByNumero.entries()) {
      if (ids.length > 1) {
        dupNumCount++;
        issues.push({
          tipo: "numero_venta_duplicado",
          severidad: "alta",
          descripcion: `${num} usado ${ids.length} veces: ${ids.join(", ")}`,
          ids,
        });
        log.push(`⚠️ Número ${num} duplicado en ${ids.length} ventas`);
      }
    }
    log.push(`  Números duplicados: ${dupNumCount}`);

    // ── 2. GASTOS HUÉRFANOS (ventaId que no existe) ──
    log.push("\n=== 2. Escaneando gastos ML huérfanos ===");
    const gastosMLSnap = await db.collection("gastos")
      .where("tipo", "in", ["comision_ml", "cargo_envio_ml"])
      .get();

    let gastosHuerfanos = 0;
    let gastosDupVenta = 0;
    const gastosByVentaId = new Map<string, Array<{ id: string; tipo: string; monto: number; numero: string }>>();

    for (const doc of gastosMLSnap.docs) {
      const data = doc.data();
      const ventaId = data.ventaId;

      // Verificar si la venta existe
      if (ventaId) {
        const ventaDoc = await db.collection("ventas").doc(ventaId).get();
        if (!ventaDoc.exists) {
          gastosHuerfanos++;
          issues.push({
            tipo: "gasto_huerfano",
            severidad: "critica",
            descripcion: `Gasto ${data.numeroGasto || doc.id} (${data.tipo}, S/${(data.montoPEN || 0).toFixed(2)}) → ventaId ${ventaId} NO EXISTE`,
            ids: [doc.id],
          });
          log.push(`❌ Gasto ${data.numeroGasto} apunta a venta inexistente ${ventaId}`);
        }

        // Agrupar gastos por ventaId para detectar duplicados
        if (!gastosByVentaId.has(ventaId)) gastosByVentaId.set(ventaId, []);
        gastosByVentaId.get(ventaId)!.push({
          id: doc.id,
          tipo: data.tipo,
          monto: data.montoPEN || 0,
          numero: data.numeroGasto || doc.id,
        });
      } else {
        issues.push({
          tipo: "gasto_sin_venta",
          severidad: "media",
          descripcion: `Gasto ${data.numeroGasto || doc.id} (${data.tipo}) no tiene ventaId`,
          ids: [doc.id],
        });
      }
    }

    // Detectar ventas con gastos duplicados del mismo tipo
    for (const [ventaId, gastos] of gastosByVentaId.entries()) {
      const comisiones = gastos.filter(g => g.tipo === "comision_ml");
      const envios = gastos.filter(g => g.tipo === "cargo_envio_ml");
      if (comisiones.length > 1) {
        gastosDupVenta++;
        issues.push({
          tipo: "gasto_comision_duplicado",
          severidad: "critica",
          descripcion: `Venta ${ventaId}: ${comisiones.length} gastos comision_ml → ${comisiones.map(g => `${g.numero} S/${g.monto.toFixed(2)}`).join(" | ")}`,
          ids: comisiones.map(g => g.id),
        });
        log.push(`❌ Venta ${ventaId}: ${comisiones.length} comisiones ML duplicadas`);
      }
      if (envios.length > 1) {
        gastosDupVenta++;
        issues.push({
          tipo: "gasto_envio_duplicado",
          severidad: "critica",
          descripcion: `Venta ${ventaId}: ${envios.length} gastos cargo_envio_ml → ${envios.map(g => `${g.numero} S/${g.monto.toFixed(2)}`).join(" | ")}`,
          ids: envios.map(g => g.id),
        });
        log.push(`❌ Venta ${ventaId}: ${envios.length} cargos envío ML duplicados`);
      }
    }
    log.push(`  Gastos ML: ${gastosMLSnap.size}. Huérfanos: ${gastosHuerfanos}. Duplicados: ${gastosDupVenta}`);

    // ── 3. MOVIMIENTOS TESORERÍA HUÉRFANOS ──
    log.push("\n=== 3. Escaneando movimientos tesorería ML huérfanos ===");
    const movsMLSnap = await db.collection("movimientosTesoreria")
      .where("creadoPor", "==", "ml-auto-processor")
      .get();

    let movsHuerfanosVenta = 0;
    let movsHuerfanosGasto = 0;
    const movsByVentaId = new Map<string, Array<{ id: string; tipo: string; monto: number; concepto: string }>>();

    for (const doc of movsMLSnap.docs) {
      const data = doc.data();

      // Verificar si la venta asociada existe
      if (data.ventaId) {
        const ventaDoc = await db.collection("ventas").doc(data.ventaId).get();
        if (!ventaDoc.exists) {
          movsHuerfanosVenta++;
          issues.push({
            tipo: "mov_tesoreria_venta_inexistente",
            severidad: "critica",
            descripcion: `Mov ${data.numeroMovimiento || doc.id} (${data.tipo}, S/${(data.monto || 0).toFixed(2)}) → ventaId ${data.ventaId} NO EXISTE`,
            ids: [doc.id],
          });
          log.push(`❌ Mov ${data.numeroMovimiento}: venta ${data.ventaId} no existe`);
        }

        // Agrupar para detectar duplicados
        if (!movsByVentaId.has(data.ventaId)) movsByVentaId.set(data.ventaId, []);
        movsByVentaId.get(data.ventaId)!.push({
          id: doc.id,
          tipo: data.tipo,
          monto: data.monto || 0,
          concepto: data.concepto || "",
        });
      }

      // Verificar si el gasto asociado existe
      if (data.gastoId) {
        const gastoDoc = await db.collection("gastos").doc(data.gastoId).get();
        if (!gastoDoc.exists) {
          movsHuerfanosGasto++;
          issues.push({
            tipo: "mov_tesoreria_gasto_inexistente",
            severidad: "alta",
            descripcion: `Mov ${data.numeroMovimiento || doc.id} (${data.tipo}) → gastoId ${data.gastoId} NO EXISTE`,
            ids: [doc.id],
          });
          log.push(`⚠️ Mov ${data.numeroMovimiento}: gasto ${data.gastoId} no existe`);
        }
      }
    }

    // Detectar movimientos de ingreso duplicados por venta
    let dupIngresosCount = 0;
    for (const [ventaId, movs] of movsByVentaId.entries()) {
      const ingresos = movs.filter(m => m.tipo === "ingreso_venta");
      if (ingresos.length > 1) {
        dupIngresosCount++;
        const totalIngresos = ingresos.reduce((s, m) => s + m.monto, 0);
        issues.push({
          tipo: "ingreso_venta_duplicado",
          severidad: "critica",
          descripcion: `Venta ${ventaId}: ${ingresos.length} ingresos (total S/${totalIngresos.toFixed(2)}) → ${ingresos.map(m => `${m.id} S/${m.monto.toFixed(2)}`).join(" | ")}`,
          ids: ingresos.map(m => m.id),
        });
        log.push(`❌ Venta ${ventaId}: ${ingresos.length} ingresos duplicados (S/${totalIngresos.toFixed(2)})`);
      }
    }
    log.push(`  Movimientos ML: ${movsMLSnap.size}. Venta inexistente: ${movsHuerfanosVenta}. Gasto inexistente: ${movsHuerfanosGasto}. Ingresos duplicados: ${dupIngresosCount}`);

    // ── 4. mlOrderSync INCONSISTENCIAS ──
    log.push("\n=== 4. Escaneando mlOrderSync inconsistencias ===");
    const syncSnap = await db.collection("mlOrderSync").get();

    let stuckProcesando = 0;
    let ventaIdInvalido = 0;

    for (const doc of syncSnap.docs) {
      const data = doc.data();

      // Docs pegados en "procesando" (posible crash)
      if (data.estado === "procesando") {
        const fechaSync = data.fechaSync?.toDate?.() || null;
        const minAgo = fechaSync ? (Date.now() - fechaSync.getTime()) / 60000 : 999;
        if (minAgo > 5) {
          stuckProcesando++;
          issues.push({
            tipo: "sync_stuck_procesando",
            severidad: "alta",
            descripcion: `${doc.id} (ML #${data.mlOrderId}) stuck en "procesando" hace ${Math.round(minAgo)} min`,
            ids: [doc.id],
          });
          log.push(`⚠️ ${doc.id}: stuck en "procesando" hace ${Math.round(minAgo)} min`);
        }
      }

      // Procesada pero ventaId no existe
      if (data.estado === "procesada" && data.ventaId) {
        const ventaDoc = await db.collection("ventas").doc(data.ventaId).get();
        if (!ventaDoc.exists) {
          ventaIdInvalido++;
          issues.push({
            tipo: "sync_venta_inexistente",
            severidad: "alta",
            descripcion: `${doc.id} marcada como procesada → ventaId ${data.ventaId} NO EXISTE`,
            ids: [doc.id],
          });
          log.push(`⚠️ ${doc.id}: procesada pero venta ${data.ventaId} no existe`);
        }
      }
    }
    log.push(`  mlOrderSync: ${syncSnap.size}. Stuck procesando: ${stuckProcesando}. VentaId inválido: ${ventaIdInvalido}`);

    // ── 5. BALANCE CUENTA MP ──
    log.push("\n=== 5. Verificando balance cuenta MercadoPago ===");
    const cuentasSnap = await db.collection("cuentasCaja")
      .where("nombre", ">=", "MercadoPago")
      .where("nombre", "<=", "MercadoPago\uf8ff")
      .limit(1)
      .get();

    if (!cuentasSnap.empty) {
      const cuentaMP = cuentasSnap.docs[0];
      const saldoRegistrado = cuentaMP.data().saldoActual || 0;

      // Calcular saldo esperado desde movimientos
      const allMovsMP = await db.collection("movimientosTesoreria")
        .where("estado", "==", "ejecutado")
        .get();

      let saldoCalculado = 0;
      for (const mov of allMovsMP.docs) {
        const data = mov.data();
        if (data.cuentaDestino === cuentaMP.id) saldoCalculado += data.monto || 0;
        if (data.cuentaOrigen === cuentaMP.id) saldoCalculado -= data.monto || 0;
      }

      const diff = Math.abs(saldoRegistrado - saldoCalculado);
      if (diff > 0.01) {
        issues.push({
          tipo: "balance_mp_descuadrado",
          severidad: "alta",
          descripcion: `Saldo registrado: S/${saldoRegistrado.toFixed(2)} vs Calculado: S/${saldoCalculado.toFixed(2)} (diff: S/${diff.toFixed(2)})`,
          ids: [cuentaMP.id],
        });
        log.push(`⚠️ Balance MP descuadrado: registrado S/${saldoRegistrado.toFixed(2)} vs calculado S/${saldoCalculado.toFixed(2)} (diff S/${diff.toFixed(2)})`);
      } else {
        log.push(`  ✅ Balance MP cuadrado: S/${saldoRegistrado.toFixed(2)}`);
      }
    } else {
      log.push("  ℹ️ No se encontró cuenta MercadoPago");
    }

    // ── RESUMEN ──
    const criticas = issues.filter(i => i.severidad === "critica").length;
    const altas = issues.filter(i => i.severidad === "alta").length;
    const medias = issues.filter(i => i.severidad === "media").length;

    log.push("\n=== RESUMEN ===");
    log.push(`Total issues: ${issues.length} (${criticas} críticas, ${altas} altas, ${medias} medias)`);
    if (issues.length === 0) {
      log.push("✅ Sistema limpio — no se encontraron registros fantasma ni inconsistencias");
    }

    return {
      totalIssues: issues.length,
      criticas,
      altas,
      medias,
      issues,
      log,
    };

  } catch (err: any) {
    functions.logger.error("Error en diagnóstico del sistema ML:", err);
    throw new functions.https.HttpsError("internal", `Error en diagnóstico: ${err.message}`);
  }
});

// ============================================================
// FUNCIÓN: Recalcular balance de cuenta MercadoPago
// Recalcula el saldo desde los movimientos de tesorería ejecutados
// ============================================================

export const mlrecalcularbalancemp = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (data, context) => {
  await requireAdminRole(context); // SEC-008

  const dryRun = data?.dryRun !== false; // default true

  try {
    // Buscar cuenta MercadoPago
    const cuentasSnap = await db.collection("cuentasCaja").get();
    let cuentaMP: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    for (const doc of cuentasSnap.docs) {
      const nombre = (doc.data().nombre || "").toLowerCase();
      if (nombre.includes("mercadopago") || nombre.includes("mercado pago")) {
        cuentaMP = doc;
        break;
      }
    }

    if (!cuentaMP) {
      return { success: false, message: "No se encontró cuenta MercadoPago", log: [] };
    }

    const cuentaId = cuentaMP.id;
    const saldoAnterior = cuentaMP.data().saldoActual || 0;
    const log: string[] = [];

    log.push(`Cuenta: ${cuentaMP.data().nombre} (${cuentaId})`);
    log.push(`Saldo registrado: S/ ${saldoAnterior.toFixed(2)}`);

    // Recalcular saldo desde movimientos ejecutados + análisis forense
    const allMovs = await db.collection("movimientosTesoreria")
      .where("estado", "==", "ejecutado")
      .get();

    let saldoCalculado = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;
    let countIngresos = 0;
    let countEgresos = 0;

    // Detalle por tipo de movimiento
    const porTipo = new Map<string, { count: number; ingreso: number; egreso: number }>();

    // Rastrear cada movimiento que toca la cuenta MP
    const movimientosMP: Array<{
      id: string;
      tipo: string;
      concepto: string;
      monto: number;
      direccion: "ingreso" | "egreso";
      ventaId: string | null;
      ventaNumero: string | null;
      cotizacionId: string | null;
      gastoId: string | null;
      fecha: string;
    }> = [];

    for (const mov of allMovs.docs) {
      const d = mov.data();
      const isIngreso = d.cuentaDestino === cuentaId;
      const isEgreso = d.cuentaOrigen === cuentaId;

      if (!isIngreso && !isEgreso) continue;

      const monto = d.monto || 0;
      const tipo = d.tipo || "desconocido";
      const fecha = d.fecha?.toDate?.()?.toISOString?.()?.slice(0, 10) || "sin-fecha";

      if (isIngreso) {
        saldoCalculado += monto;
        totalIngresos += monto;
        countIngresos++;
      }
      if (isEgreso) {
        saldoCalculado -= monto;
        totalEgresos += monto;
        countEgresos++;
      }

      // Agrupar por tipo
      if (!porTipo.has(tipo)) porTipo.set(tipo, { count: 0, ingreso: 0, egreso: 0 });
      const t = porTipo.get(tipo)!;
      t.count++;
      if (isIngreso) t.ingreso += monto;
      if (isEgreso) t.egreso += monto;

      movimientosMP.push({
        id: mov.id,
        tipo,
        concepto: d.concepto || "",
        monto,
        direccion: isIngreso ? "ingreso" : "egreso",
        ventaId: d.ventaId || null,
        ventaNumero: d.ventaNumero || null,
        cotizacionId: d.cotizacionId || null,
        gastoId: d.gastoId || null,
        fecha,
      });
    }

    const diferencia = saldoAnterior - saldoCalculado;

    log.push(`\nSaldo calculado: S/ ${saldoCalculado.toFixed(2)}`);
    log.push(`Diferencia: S/ ${diferencia.toFixed(2)} (${diferencia > 0 ? "exceso" : "faltante"} en saldo registrado)`);
    log.push(`\n--- Resumen movimientos cuenta MP ---`);
    log.push(`Ingresos: ${countIngresos} movimientos → S/ ${totalIngresos.toFixed(2)}`);
    log.push(`Egresos: ${countEgresos} movimientos → S/ ${totalEgresos.toFixed(2)}`);
    log.push(`Neto: S/ ${(totalIngresos - totalEgresos).toFixed(2)}`);

    log.push(`\n--- Desglose por tipo ---`);
    for (const [tipo, stats] of [...porTipo.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const parts = [];
      if (stats.ingreso > 0) parts.push(`+S/ ${stats.ingreso.toFixed(2)}`);
      if (stats.egreso > 0) parts.push(`-S/ ${stats.egreso.toFixed(2)}`);
      log.push(`  ${tipo} (${stats.count}): ${parts.join(", ")}`);
    }

    // Análisis forense: buscar posibles causas de la diferencia
    log.push(`\n--- Análisis forense ---`);

    // 1. Verificar si hay gastos pagados con cuenta MP que NO tienen movimiento de tesorería
    const gastosMLSnap = await db.collection("gastos")
      .where("tipo", "in", ["comision_ml", "cargo_envio_ml"])
      .get();

    let gastosConPagoSinMov = 0;
    let montoGastosSinMov = 0;
    for (const gDoc of gastosMLSnap.docs) {
      const gData = gDoc.data();
      const pagos = Array.isArray(gData.pagos) ? gData.pagos : [];
      for (const pago of pagos) {
        if (pago.cuentaOrigenId === cuentaId) {
          // Este pago descuenta de la cuenta MP - verificar si existe movimiento de tesorería
          const movParaGasto = movimientosMP.find(m => m.gastoId === gDoc.id && m.direccion === "egreso");
          if (!movParaGasto) {
            gastosConPagoSinMov++;
            montoGastosSinMov += pago.montoPEN || pago.montoOriginal || 0;
            log.push(`  ⚠️ Gasto ${gData.numeroGasto} (${gData.tipo}, S/ ${(pago.montoPEN || pago.montoOriginal || 0).toFixed(2)}) descuenta de MP pero NO tiene movimiento de tesorería`);
          }
        }
      }
    }
    if (gastosConPagoSinMov > 0) {
      log.push(`  → ${gastosConPagoSinMov} gasto(s) descuentan S/ ${montoGastosSinMov.toFixed(2)} de MP sin movimiento de tesorería`);
    }

    // 2. Verificar ventas ML pagadas: busca ingresos por ventaId, cotizacionOrigenId, o en CUALQUIER cuenta
    const ventasMLSnap = await db.collection("ventas")
      .where("canalNombre", "==", "Mercado Libre")
      .where("estadoPago", "==", "pagado")
      .get();

    // También necesitamos TODOS los movimientos de ingreso (no solo los de MP)
    const allIngresosSnap = await db.collection("movimientosTesoreria")
      .where("estado", "==", "ejecutado")
      .get();

    const todosLosIngresos = allIngresosSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((m: any) => m.tipo === "ingreso_venta" || m.tipo === "ingreso_anticipo");

    let ventasSinIngreso = 0;
    let montoVentasSinIngreso = 0;
    let ventasConAdelanto = 0;
    let ventasCanalIncorrecto = 0;
    const ventasCanalIncorrectoIds: string[] = [];

    for (const vDoc of ventasMLSnap.docs) {
      const vData = vDoc.data();
      const cotOrigenId = vData.cotizacionOrigenId || null;

      // Buscar movimiento de ingreso en cuenta MP
      const movIngresoMP = movimientosMP.find(m => {
        if (m.direccion !== "ingreso") return false;
        if (m.ventaId === vDoc.id) return true;
        if (cotOrigenId && m.ventaId === cotOrigenId) return true;
        if (cotOrigenId && m.cotizacionId === cotOrigenId) return true;
        return false;
      });

      if (movIngresoMP) {
        if (movIngresoMP.tipo === "ingreso_anticipo") ventasConAdelanto++;
        continue; // OK — tiene ingreso en MP
      }

      // No tiene ingreso en MP — ¿tiene ingreso en OTRA cuenta?
      const movIngresoOtraCuenta = todosLosIngresos.find((m: any) => {
        if (m.ventaId === vDoc.id) return true;
        if (cotOrigenId && m.ventaId === cotOrigenId) return true;
        if (cotOrigenId && m.cotizacionId === cotOrigenId) return true;
        return false;
      });

      if (movIngresoOtraCuenta) {
        // Tiene ingreso pero en OTRA cuenta → canal mal etiquetado como ML
        ventasCanalIncorrecto++;
        ventasCanalIncorrectoIds.push(vDoc.id);
        log.push(`  🏷️ Venta ${vData.numeroVenta} (S/ ${(vData.totalPEN || 0).toFixed(2)}) etiquetada como ML pero pagada a otra cuenta → canal incorrecto`);
      } else {
        // No tiene ingreso en ninguna cuenta
        ventasSinIngreso++;
        montoVentasSinIngreso += vData.totalPEN || 0;
        log.push(`  ⚠️ Venta ${vData.numeroVenta} (S/ ${(vData.totalPEN || 0).toFixed(2)}) pagada pero NO tiene movimiento ingreso en ninguna cuenta`);
      }
    }

    if (ventasSinIngreso > 0) {
      log.push(`  → ${ventasSinIngreso} venta(s) pagadas (S/ ${montoVentasSinIngreso.toFixed(2)}) sin ingreso en tesorería`);
    }
    if (ventasCanalIncorrecto > 0) {
      log.push(`  → ${ventasCanalIncorrecto} venta(s) con canal "Mercado Libre" incorrecto (pago fue a otra cuenta, no a MP)`);
    }
    if (ventasConAdelanto > 0) {
      log.push(`  ℹ️ ${ventasConAdelanto} venta(s) con ingreso via adelanto de cotización (OK)`);
    }
    if (ventasSinIngreso === 0 && ventasCanalIncorrecto === 0 && ventasConAdelanto === 0) {
      log.push(`  ✅ Todas las ventas ML pagadas tienen su movimiento de ingreso`);
    }

    // Corregir canal incorrecto en modo fix
    if (!dryRun && ventasCanalIncorrectoIds.length > 0) {
      log.push(`\n--- Corrigiendo canales incorrectos ---`);
      for (const ventaId of ventasCanalIncorrectoIds) {
        try {
          await db.collection("ventas").doc(ventaId).update({
            canalNombre: "Venta Directa",
            canal: "directo",
          });
          const vSnap = await db.collection("ventas").doc(ventaId).get();
          const numVenta = vSnap.data()?.numeroVenta || ventaId;
          log.push(`  ✅ ${numVenta}: canal corregido "Mercado Libre" → "Venta Directa"`);
        } catch (err: any) {
          log.push(`  ❌ Error corrigiendo ${ventaId}: ${err.message}`);
        }
      }
    } else if (dryRun && ventasCanalIncorrectoIds.length > 0) {
      log.push(`  [DRY RUN] Corregería ${ventasCanalIncorrectoIds.length} venta(s) de "Mercado Libre" → "Venta Directa"`);
    }

    // 3. Verificar movimientos que NO corresponden a ninguna venta/gasto existente
    let movsOrfanos = 0;
    let montoOrfanos = 0;
    for (const m of movimientosMP) {
      if (m.ventaId) {
        const vDoc = await db.collection("ventas").doc(m.ventaId).get();
        if (!vDoc.exists) {
          movsOrfanos++;
          montoOrfanos += m.monto;
          log.push(`  ⚠️ Mov ${m.id} (${m.direccion} S/ ${m.monto.toFixed(2)}) → ventaId ${m.ventaId} NO EXISTE`);
        }
      }
    }
    if (movsOrfanos > 0) {
      log.push(`  → ${movsOrfanos} movimiento(s) huérfano(s) (S/ ${montoOrfanos.toFixed(2)})`);
    }

    // 4. Detectar movimientos artificiales/ajustes manuales
    log.push(`\n--- Ajustes manuales/artificiales ---`);
    const ajustesManuales: Array<{ id: string; concepto: string; monto: number; direccion: string; fecha: string }> = [];
    for (const m of movimientosMP) {
      const conceptoLower = m.concepto.toLowerCase();
      if (conceptoLower.includes("ajuste") || conceptoLower.includes("correc") || conceptoLower.includes("manual")) {
        ajustesManuales.push(m);
        log.push(`  🔧 ${m.fecha} | ${m.direccion === "ingreso" ? "+" : "-"}S/ ${m.monto.toFixed(2)} | ${m.concepto}`);
      }
    }
    if (ajustesManuales.length > 0) {
      const totalAjustesIngreso = ajustesManuales.filter(a => a.direccion === "ingreso").reduce((s, a) => s + a.monto, 0);
      const totalAjustesEgreso = ajustesManuales.filter(a => a.direccion === "egreso").reduce((s, a) => s + a.monto, 0);
      log.push(`  → ${ajustesManuales.length} ajuste(s): +S/ ${totalAjustesIngreso.toFixed(2)} / -S/ ${totalAjustesEgreso.toFixed(2)} (neto: ${(totalAjustesIngreso - totalAjustesEgreso) > 0 ? "+" : ""}S/ ${(totalAjustesIngreso - totalAjustesEgreso).toFixed(2)})`);
      log.push(`  → Sin ajustes, saldo sería: S/ ${(saldoCalculado - totalAjustesIngreso + totalAjustesEgreso).toFixed(2)}`);
    } else {
      log.push(`  ✅ No se encontraron ajustes manuales`);
    }

    // 5. Comisiones ML pagadas pero no registradas como egreso de MP
    log.push(`\n--- Comisiones/envíos ML pendientes ---`);
    const ventasMLProcesadas = await db.collection("ventas")
      .where("canalNombre", "==", "Mercado Libre")
      .where("estadoPago", "==", "pagado")
      .get();

    let comisionesSinEgreso = 0;
    let montoComisionesPendientes = 0;
    for (const vDoc of ventasMLProcesadas.docs) {
      const vData = vDoc.data();
      const numVenta = vData.numeroVenta || vDoc.id;

      // Buscar gastos de comisión/envío asociados a esta venta
      const gastosVenta = await db.collection("gastos")
        .where("ventaId", "==", vDoc.id)
        .get();

      for (const gDoc of gastosVenta.docs) {
        const gData = gDoc.data();
        if (gData.tipo !== "comision_ml" && gData.tipo !== "cargo_envio_ml") continue;

        // Verificar si este gasto tiene egreso de MP en tesorería
        const tieneEgreso = movimientosMP.find(m =>
          m.gastoId === gDoc.id && m.direccion === "egreso"
        );

        if (!tieneEgreso) {
          const montoPago = Array.isArray(gData.pagos) && gData.pagos.length > 0
            ? gData.pagos.reduce((s: number, p: any) => s + (p.montoPEN || p.montoOriginal || 0), 0)
            : gData.montoPEN || gData.monto || 0;

          if (montoPago > 0) {
            comisionesSinEgreso++;
            montoComisionesPendientes += montoPago;
            log.push(`  ⚠️ ${numVenta} → ${gData.tipo} (S/ ${montoPago.toFixed(2)}) sin egreso registrado en MP`);
          }
        }
      }
    }
    if (comisionesSinEgreso > 0) {
      log.push(`  → ${comisionesSinEgreso} comisión/envío(s) ML (S/ ${montoComisionesPendientes.toFixed(2)}) sin egreso en tesorería MP`);
    } else {
      log.push(`  ✅ Todas las comisiones/envíos ML tienen su egreso registrado`);
    }

    // 6. Resumen final de conciliación
    log.push(`\n--- Conciliación final ---`);
    const saldoSinAjustes = ajustesManuales.length > 0
      ? saldoCalculado - ajustesManuales.filter(a => a.direccion === "ingreso").reduce((s, a) => s + a.monto, 0)
                        + ajustesManuales.filter(a => a.direccion === "egreso").reduce((s, a) => s + a.monto, 0)
      : saldoCalculado;
    log.push(`  Saldo calculado (movimientos): S/ ${saldoCalculado.toFixed(2)}`);
    if (ajustesManuales.length > 0) {
      log.push(`  Saldo sin ajustes artificiales: S/ ${saldoSinAjustes.toFixed(2)}`);
    }
    if (comisionesSinEgreso > 0) {
      log.push(`  Saldo ajustado (- comisiones pendientes): S/ ${(saldoSinAjustes - montoComisionesPendientes).toFixed(2)}`);
    }
    log.push(`  Saldo registrado en sistema: S/ ${saldoAnterior.toFixed(2)}`);

    // 7. Verificar incrementos directos al saldo (sin movimiento)
    if (gastosConPagoSinMov === 0 && ventasSinIngreso === 0 && movsOrfanos === 0 && Math.abs(diferencia) > 0.01) {
      log.push(`\n  ℹ️ Diferencia residual de S/ ${diferencia.toFixed(2)} entre saldo registrado y calculado`);
      log.push(`     probablemente por ajustes directos al campo saldoActual.`);
    }

    // Resumen del fix
    if (Math.abs(diferencia) < 0.01) {
      log.push(`\n✅ Balance ya está correcto.`);
      return { success: true, message: "Balance ya está correcto", saldo: saldoAnterior, diferencia: 0, log };
    }

    if (!dryRun) {
      await db.collection("cuentasCaja").doc(cuentaId).update({
        saldoActual: Math.round(saldoCalculado * 100) / 100,
      });
      log.push(`\n✅ Balance corregido: S/ ${saldoAnterior.toFixed(2)} → S/ ${saldoCalculado.toFixed(2)}`);
      functions.logger.info(
        `Balance MP recalculado: S/${saldoAnterior.toFixed(2)} → S/${saldoCalculado.toFixed(2)} (diff: S/${diferencia.toFixed(2)})`
      );
    } else {
      log.push(`\n[DRY RUN] Ajustaría balance de S/ ${saldoAnterior.toFixed(2)} → S/ ${saldoCalculado.toFixed(2)}`);
    }

    return {
      success: true,
      dryRun,
      message: dryRun
        ? `[DRY RUN] Ajustaría balance de S/${saldoAnterior.toFixed(2)} → S/${saldoCalculado.toFixed(2)} (diff: S/${diferencia.toFixed(2)})`
        : `Balance corregido: S/${saldoAnterior.toFixed(2)} → S/${saldoCalculado.toFixed(2)} (diff: S/${diferencia.toFixed(2)})`,
      saldoAnterior,
      saldoNuevo: Math.round(saldoCalculado * 100) / 100,
      diferencia: Math.round(diferencia * 100) / 100,
      movimientos: { ingresos: countIngresos, egresos: countEgresos, total: allMovs.size },
      log,
    };

  } catch (err: any) {
    functions.logger.error("Error recalculando balance MP:", err);
    throw new functions.https.HttpsError("internal", `Error: ${err.message}`);
  }
});

// ============================================================
// REINGENIERÍA DE DATOS ML
// Reconstruye registros financieros desde mlOrderSync (fuente de verdad)
// ============================================================
export const mlreingenieria = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data, context) => {
  await requireAdminRole(context); // SEC-008

  const dryRun = data?.dryRun !== false;
  const saldoRealMP: number | null = data?.saldoRealMP ?? null; // Balance real de MercadoPago (para reconciliación)
  const log: string[] = [];
  const stats = {
    ordenesLeidas: 0, ventasEncontradas: 0, ventasSkipped: 0,
    movsAnulados: 0, movsCreados: 0,
    gastosEliminados: 0, gastosCreados: 0,
    gdUrbanoCorregidos: 0, gdUrbanoCreados: 0,
    ventasActualizadas: 0, adelantosRespetados: 0,
    canalCorregido: 0,
  };

  try {
    log.push(`=== REINGENIERÍA ML ${dryRun ? "(DRY RUN)" : "(APLICANDO)"} ===`);
    log.push("");

    // ---- FASE 1: CARGA MASIVA ----
    log.push("--- Fase 1: Carga masiva ---");

    // Cuenta MercadoPago
    const mpQuery = await db.collection("cuentasCaja")
      .where("metodoPagoAsociado", "==", "mercado_pago")
      .where("activa", "==", true)
      .limit(1)
      .get();
    if (mpQuery.empty) {
      return { success: false, message: "No se encontró cuenta MercadoPago activa", log };
    }
    const cuentaMPId = mpQuery.docs[0].id;
    const saldoAnterior = mpQuery.docs[0].data().saldoActual || 0;
    log.push(`Cuenta MP: ${mpQuery.docs[0].data().nombre} (${cuentaMPId}) — Saldo: S/ ${saldoAnterior.toFixed(2)}`);

    // mlOrderSync: cargar procesadas + pendientes con ventaId (vinculadas manualmente)
    const syncProcesadasSnap = await db.collection("mlOrderSync").where("estado", "==", "procesada").get();
    const syncPendientesSnap = await db.collection("mlOrderSync").where("estado", "==", "pendiente").get();
    const syncByVentaId = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    const syncByMlOrderId = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    const allSyncDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

    for (const doc of syncProcesadasSnap.docs) {
      const d = doc.data();
      if (d.ventaId) syncByVentaId.set(d.ventaId, doc);
      if (d.mlOrderId) syncByMlOrderId.set(String(d.mlOrderId), doc);
      allSyncDocs.push(doc);
    }
    // Pendientes con ventaId = vinculadas manualmente por el usuario
    let pendientesVinculadas = 0;
    for (const doc of syncPendientesSnap.docs) {
      const d = doc.data();
      if (d.mlOrderId) syncByMlOrderId.set(String(d.mlOrderId), doc);
      if (d.ventaId) {
        syncByVentaId.set(d.ventaId, doc);
        allSyncDocs.push(doc);
        pendientesVinculadas++;
      }
    }
    stats.ordenesLeidas = allSyncDocs.length;
    log.push(`mlOrderSync procesadas: ${syncProcesadasSnap.size}, pendientes: ${syncPendientesSnap.size} (${pendientesVinculadas} vinculadas)`);
    log.push(`Total órdenes a procesar: ${allSyncDocs.length}`);

    // Ventas ML
    const ventasSnap = await db.collection("ventas").where("canalNombre", "==", "Mercado Libre").get();
    const ventasMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of ventasSnap.docs) ventasMap.set(doc.id, doc);
    log.push(`Ventas ML: ${ventasSnap.size}`);

    // Gastos comision_ml y cargo_envio_ml
    const gastosGVSnap = await db.collection("gastos")
      .where("tipo", "in", ["comision_ml", "cargo_envio_ml"])
      .get();
    const gastosGVByVenta = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    for (const doc of gastosGVSnap.docs) {
      const vid = doc.data().ventaId;
      if (vid) {
        if (!gastosGVByVenta.has(vid)) gastosGVByVenta.set(vid, []);
        gastosGVByVenta.get(vid)!.push(doc);
      }
    }

    // Gastos delivery (para proteger Flex)
    const gastosGDSnap = await db.collection("gastos").where("tipo", "==", "delivery").get();
    const gastosGDByVenta = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    const gastoDeliveryIds = new Set<string>();
    for (const doc of gastosGDSnap.docs) {
      gastoDeliveryIds.add(doc.id);
      const vid = doc.data().ventaId;
      if (vid) {
        if (!gastosGDByVenta.has(vid)) gastosGDByVenta.set(vid, []);
        gastosGDByVenta.get(vid)!.push(doc);
      }
    }

    // Movimientos de tesorería ejecutados
    const movsSnap = await db.collection("movimientosTesoreria")
      .where("estado", "==", "ejecutado")
      .get();
    const movsByVenta = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    const movsByGastoId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    for (const doc of movsSnap.docs) {
      const d = doc.data();
      const vid = d.ventaId;
      if (vid) {
        if (!movsByVenta.has(vid)) movsByVenta.set(vid, []);
        movsByVenta.get(vid)!.push(doc);
      }
      const gid = d.gastoId;
      if (gid) {
        if (!movsByGastoId.has(gid)) movsByGastoId.set(gid, []);
        movsByGastoId.get(gid)!.push(doc);
      }
    }

    // Buscar transportista Urbano para GD
    const transportistaUrbanoQ = await db.collection("transportistas")
      .where("nombre", ">=", "Urbano")
      .where("nombre", "<=", "Urbano\uf8ff")
      .limit(1)
      .get();
    const transportistaUrbanoId = transportistaUrbanoQ.empty ? null : transportistaUrbanoQ.docs[0].id;
    const transportistaUrbanoNombre = transportistaUrbanoQ.empty ? "Urbano" : transportistaUrbanoQ.docs[0].data().nombre;

    log.push(`Gastos GV (comision/envio): ${gastosGVSnap.size}`);
    log.push(`Gastos GD (delivery): ${gastosGDSnap.size}`);
    log.push(`Movimientos tesorería: ${movsSnap.size}`);
    log.push(`Transportista Urbano: ${transportistaUrbanoId ? transportistaUrbanoNombre : "NO ENCONTRADO"}`);
    log.push("");

    // Obtener TC centralizado
    const tc = await resolverTCVenta();

    // Contador para números de gasto
    let gastoCounter = 0;
    const lastGasto = await db.collection("gastos")
      .where("numeroGasto", ">=", "GAS-").where("numeroGasto", "<=", "GAS-\uf8ff")
      .orderBy("numeroGasto", "desc").limit(1).get();
    if (!lastGasto.empty) {
      const num = parseInt(lastGasto.docs[0].data().numeroGasto.replace("GAS-", ""), 10);
      if (!isNaN(num)) gastoCounter = num;
    }
    const nextGastoNum = () => `GAS-${String(++gastoCounter).padStart(4, "0")}`;

    // Simulación dry run: rastrear movimientos anulados y virtuales
    const simAnulados = new Set<string>();
    const simNuevos: Array<{ monto: number; cuentaDestino?: string; cuentaOrigen?: string; concepto: string }> = [];
    // Rastrear adelantos ya reclamados para evitar que el mismo movimiento sea usado por múltiples ventas
    const adelantosReclamados = new Set<string>();
    // Los ajustes de monto en adelantos se simulan agregando la diferencia a simNuevos

    // ---- FASE 2-PRE: ANULAR AJUSTES MANUALES EN CUENTA MP ----
    // LÓGICA POSITIVA: solo anula movimientos cuyo concepto contenga "ajuste"
    log.push("--- Fase 2-pre: Anular ajustes manuales MP ---");
    let ajustesAnulados = 0;
    for (const m of movsSnap.docs) {
      const md = m.data();
      if (md.estado === "anulado") continue;

      // Solo movimientos que tocan la cuenta MP
      const touchesMP = md.cuentaDestino === cuentaMPId || md.cuentaOrigen === cuentaMPId;
      if (!touchesMP) continue;

      // LÓGICA POSITIVA: solo anular si el concepto contiene "ajuste"
      const concepto = (md.concepto || md.descripcion || "").toLowerCase();
      if (!concepto.includes("ajuste")) continue;

      // Anular este ajuste manual
      if (!dryRun) {
        await m.ref.update({
          estado: "anulado",
          anuladoPor: "ml-reingenieria",
          fechaAnulacion: admin.firestore.Timestamp.now(),
        });
      }
      simAnulados.add(m.id);
      stats.movsAnulados++;
      ajustesAnulados++;
      const monto = md.monto || 0;
      const dir = md.cuentaDestino === cuentaMPId ? "+" : "-";
      log.push(`  Ajuste anulado: "${md.concepto || md.descripcion || "sin concepto"}" ${dir}S/ ${monto.toFixed(2)} (${m.id.slice(0, 8)}...)`);
    }
    if (ajustesAnulados === 0) {
      log.push("  (ningún ajuste manual encontrado)");
    }
    log.push("");

    // ---- FASE 2 & 3: LIMPIEZA + RECONSTRUCCIÓN POR ORDEN ----
    log.push("--- Fase 2-3: Limpieza y reconstrucción ---");

    for (const syncDoc of allSyncDocs) {
      const sync = syncDoc.data();
      const ventaId = sync.ventaId;
      if (!ventaId) { stats.ventasSkipped++; continue; }

      const ventaDoc = ventasMap.get(ventaId);
      if (!ventaDoc) { stats.ventasSkipped++; continue; }

      const venta = ventaDoc.data();
      const numVenta = venta.numeroVenta || ventaId;
      const metodoEnvio = sync.metodoEnvio || venta.metodoEnvio || null;
      const comisionML = sync.comisionML || 0;
      const costoEnvioCliente = sync.costoEnvioCliente || 0;
      const cargoEnvioML = sync.cargoEnvioML || 0;
      const subtotalPEN = sync.totalML || venta.subtotalPEN || 0;
      const fechaOrden = sync.fechaOrdenML || venta.fechaCreacion || admin.firestore.Timestamp.now();
      stats.ventasEncontradas++;

      // Calcular totalPEN correcto
      let totalPENCorrecto: number;
      let costoEnvioCorrecto: number;
      if (metodoEnvio === "flex") {
        costoEnvioCorrecto = costoEnvioCliente;
        totalPENCorrecto = subtotalPEN + costoEnvioCorrecto;
      } else {
        // Urbano o desconocido: envío no es ingreso
        costoEnvioCorrecto = 0;
        totalPENCorrecto = subtotalPEN;
      }

      // Verificar si tiene adelanto de cotización
      const cotOrigenId = venta.cotizacionOrigenId || null;
      // Solo buscar movimientos por ventaId (confiable, sin fallbacks)
      const ventaMovs = movsByVenta.get(ventaId) || [];

      // Log detallado por orden — netMP será recalculado con montoIngresoMP después de detectar pagos divididos
      const netMPBruto = totalPENCorrecto - comisionML - (metodoEnvio === "urbano" ? cargoEnvioML : 0);

      // Diagnóstico: analizar movimientos VIEJOS de esta venta
      let oldNetMP = 0;
      let oldMovsCount = 0;
      const oldMovsDetail: string[] = [];
      for (const m of ventaMovs) {
        const md = m.data();
        if (md.estado === "anulado") continue;
        oldMovsCount++;
        const isIngMP = md.cuentaDestino === cuentaMPId;
        const isEgrMP = md.cuentaOrigen === cuentaMPId;
        if (isIngMP) oldNetMP += md.monto || 0;
        if (isEgrMP) oldNetMP -= md.monto || 0;
        oldMovsDetail.push(`${md.tipo}:${isIngMP ? "+" : isEgrMP ? "-" : "~"}${(md.monto || 0).toFixed(2)}${isIngMP || isEgrMP ? "" : "[noMP]"}`);
      }
      const diffNetMP = netMPBruto - oldNetMP;
      log.push(`[${numVenta}] ML#${sync.mlOrderId} | ${metodoEnvio || "?"} | subtotal:${subtotalPEN.toFixed(2)} envío:${costoEnvioCorrecto.toFixed(2)} total:${totalPENCorrecto.toFixed(2)} | com:${comisionML.toFixed(2)} cargoML:${cargoEnvioML.toFixed(2)} | neto MP: ${netMPBruto.toFixed(2)}`);
      log.push(`  ↳ Movs viejos: ${oldMovsCount} (net MP: S/${oldNetMP.toFixed(2)}) → diff: ${diffNetMP > 0 ? "+" : ""}${diffNetMP.toFixed(2)} | ${oldMovsDetail.join(", ") || "NINGUNO"}`);
      let tieneAdelanto = false;
      let adelantoMonto = 0;
      let adelantoMovId: string | null = null;
      let adelantoFoundBy: "ventaId" | "cotizacionId" | null = null;

      for (const m of ventaMovs) {
        const md = m.data();
        if (md.tipo === "ingreso_anticipo" && md.estado === "ejecutado" && !adelantosReclamados.has(m.id)) {
          tieneAdelanto = true;
          adelantoMonto = md.monto || 0;
          adelantoMovId = m.id;
          adelantoFoundBy = "ventaId";
          break;
        }
      }
      // También buscar por cotizacionId:
      // El código de adelantos guarda ventaId = cotizacionId (no el ID de la venta).
      // Buscamos en movsByVenta con cotOrigenId como clave, y también en todos los movimientos
      // por cotizacionId o ventaId === cotOrigenId.
      if (!tieneAdelanto && cotOrigenId) {
        // Primero buscar en el índice rápido: movimientos con ventaId = cotOrigenId
        const movsCot = movsByVenta.get(cotOrigenId) || [];
        for (const m of movsCot) {
          const md = m.data();
          if (md.tipo === "ingreso_anticipo" && md.estado === "ejecutado" && !adelantosReclamados.has(m.id)) {
            tieneAdelanto = true;
            adelantoMonto = md.monto || 0;
            adelantoMovId = m.id;
            adelantoFoundBy = "cotizacionId";
            break;
          }
        }
        // Fallback: buscar por campo cotizacionId (por si alguien lo seteó correctamente)
        if (!tieneAdelanto) {
          for (const m of movsSnap.docs) {
            const md = m.data();
            if (md.cotizacionId === cotOrigenId && md.tipo === "ingreso_anticipo" && md.estado === "ejecutado" && !adelantosReclamados.has(m.id)) {
              tieneAdelanto = true;
              adelantoMonto = md.monto || 0;
              adelantoMovId = m.id;
              adelantoFoundBy = "cotizacionId";
              break;
            }
          }
        }
      }

      // Fallback 3: buscar adelantos a MP por concepto ("adelanto" + nombre cliente)
      // NOTA: Los adelantos pueden ser tipo "ingreso_anticipo" O "ingreso_venta" con concepto de adelanto
      if (!tieneAdelanto) {
        const clienteNombre = (venta.nombreCliente || "").toLowerCase().trim();
        const clienteApellido = clienteNombre.split(" ").pop() || "";
        if (clienteApellido.length >= 3) {
          for (const m of movsSnap.docs) {
            const md = m.data();
            if (md.estado !== "ejecutado") continue;
            if (adelantosReclamados.has(m.id)) continue; // Ya reclamado por otra venta
            if (md.cuentaDestino !== cuentaMPId) continue;
            // Aceptar ingreso_anticipo O ingreso_venta con concepto de adelanto/cotización
            const concepto = (md.concepto || md.descripcion || "").toLowerCase();
            const esAdelantoPorTipo = md.tipo === "ingreso_anticipo";
            const esAdelantoPorConcepto = (md.tipo === "ingreso_venta") &&
              (concepto.includes("adelanto") || concepto.includes("cotizaci"));
            if (!esAdelantoPorTipo && !esAdelantoPorConcepto) continue;
            if (!concepto.includes(clienteApellido)) continue;
            // Verificar que el monto sea razonable (±30% del total o exacto)
            const montoMov = md.monto || 0;
            const ratio = totalPENCorrecto > 0 ? Math.abs(montoMov - totalPENCorrecto) / totalPENCorrecto : 1;
            if (ratio < 0.3 || Math.abs(montoMov - totalPENCorrecto) < 1) {
              tieneAdelanto = true;
              adelantoMonto = montoMov;
              adelantoMovId = m.id;
              adelantoFoundBy = "cotizacionId"; // usar mismo tipo para el update
              log.push(`  ${numVenta}: 🔍 Adelanto encontrado por nombre "${clienteApellido}" en concepto: S/ ${montoMov.toFixed(2)} [${m.id}]`);
              break;
            }
          }
        }
      }

      if (tieneAdelanto && adelantoMovId) {
        adelantosReclamados.add(adelantoMovId); // Marcar como reclamado para evitar doble-uso
        stats.adelantosRespetados++;
        log.push(`  ${numVenta}: 🔖 Adelanto detectado (por ${adelantoFoundBy}): S/ ${adelantoMonto.toFixed(2)} [${adelantoMovId}]`);
      }

      // --- FASE 2: LIMPIEZA ---

      // 2a. Anular movimientos de tesorería (excepto adelantos, GD Flex, y pagos a cuentas NO-MP)
      for (const m of ventaMovs) {
        const md = m.data();
        if (md.estado === "anulado") continue;

        // Proteger adelantos
        if (md.tipo === "ingreso_anticipo") continue;
        if (m.id === adelantoMovId) continue;

        // Proteger pagos a cuentas NO-MP (pagos divididos: parte por transferencia bancaria, etc.)
        if ((md.tipo === "ingreso_venta") && md.cuentaDestino && md.cuentaDestino !== cuentaMPId) continue;

        // Proteger GD Flex (gastoId apunta a delivery y NO es Urbano)
        if (md.gastoId && gastoDeliveryIds.has(md.gastoId)) {
          const gdDoc = gastosGDByVenta.get(ventaId)?.find(g => g.id === md.gastoId);
          if (gdDoc) {
            const gdData = gdDoc.data();
            const transportista = (gdData.transportistaNombre || "").toLowerCase();
            // Si NO es Urbano → es Flex (GK Express/Jose Pinto) → proteger
            if (!transportista.includes("urbano")) continue;
          }
        }

        // Anular el movimiento
        if (!dryRun) {
          await m.ref.update({ estado: "anulado", anuladoPor: "ml-reingenieria", fechaAnulacion: admin.firestore.Timestamp.now() });
        }
        simAnulados.add(m.id);
        stats.movsAnulados++;
      }

      // 2b. Eliminar gastos comision_ml y cargo_envio_ml + anular movimientos asociados
      const gastosVenta = gastosGVByVenta.get(ventaId) || [];
      for (const g of gastosVenta) {
        // Anular movimientos asociados a este gasto (pueden NO tener ventaId)
        const gastoMovs = movsByGastoId.get(g.id) || [];
        for (const gm of gastoMovs) {
          if (gm.data().estado === "anulado" || simAnulados.has(gm.id)) continue;
          simAnulados.add(gm.id);
          if (!dryRun) {
            await gm.ref.update({
              estado: "anulado",
              anuladoPor: "ml-reingenieria",
              motivoAnulacion: "Gasto eliminado por reingeniería",
              fechaAnulacion: admin.firestore.Timestamp.now(),
            });
          }
          stats.movsAnulados++;
          log.push(`  ${numVenta}: Mov. huérfano de gasto anulado (gastoId: ${g.id.slice(0, 8)}…, monto: S/${(gm.data().monto || 0).toFixed(2)})`);
        }
        if (!dryRun) {
          await g.ref.delete();
        }
        stats.gastosEliminados++;
      }

      // 2c. Revisar GD Urbano
      if (metodoEnvio === "urbano" && cargoEnvioML > 0) {
        const gdsVenta = gastosGDByVenta.get(ventaId) || [];
        const gdUrbano = gdsVenta.find(g => {
          const tn = (g.data().transportistaNombre || "").toLowerCase();
          return tn.includes("urbano");
        });

        if (gdUrbano) {
          const gdData = gdUrbano.data();
          const montoActual = gdData.montoPEN || gdData.montoOriginal || 0;

          // Anular movimientos del GD Urbano por gastoId (pueden NO tener ventaId)
          const gdMovs = movsByGastoId.get(gdUrbano.id) || [];
          for (const gm of gdMovs) {
            if (gm.data().estado === "anulado" || simAnulados.has(gm.id)) continue;
            simAnulados.add(gm.id);
            if (!dryRun) {
              await gm.ref.update({
                estado: "anulado",
                anuladoPor: "ml-reingenieria",
                motivoAnulacion: "GD Urbano reconstruido por reingeniería",
                fechaAnulacion: admin.firestore.Timestamp.now(),
              });
            }
            stats.movsAnulados++;
            log.push(`  ${numVenta}: Mov. GD Urbano viejo anulado (S/${(gm.data().monto || 0).toFixed(2)}, gastoId: ${gdUrbano.id.slice(0, 8)}…)`);
          }

          if (Math.abs(montoActual - cargoEnvioML) > 0.01) {
            // Monto no coincide: actualizar gasto + pagos embebidos
            if (!dryRun) {
              const pagosUpdated = (gdData.pagos || []).map((p: any, i: number) =>
                i === 0 ? { ...p, montoOriginal: cargoEnvioML, montoPEN: cargoEnvioML } : p
              );
              await gdUrbano.ref.update({
                montoOriginal: cargoEnvioML,
                montoPEN: cargoEnvioML,
                montoPagado: cargoEnvioML,
                montoPendiente: 0,
                pagos: pagosUpdated,
              });
            }
            stats.gdUrbanoCorregidos++;
            log.push(`  ${numVenta}: GD Urbano corregido S/ ${montoActual.toFixed(2)} → S/ ${cargoEnvioML.toFixed(2)}`);
          }
        } else if (transportistaUrbanoId) {
          // No existe GD Urbano: crear
          if (!dryRun) {
            const gdNumero = nextGastoNum();
            const gdPagoId = `PAG-GAS-reeng-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            await db.collection("gastos").add({
              numeroGasto: gdNumero,
              tipo: "delivery",
              categoria: "GD",
              claseGasto: "GVD",
              descripcion: `Distribución ML Urbano - ${numVenta} - Orden #${sync.mlOrderId}`,
              moneda: "PEN",
              montoOriginal: cargoEnvioML,
              montoPEN: cargoEnvioML,
              tipoCambio: tc,
              esProrrateable: false,
              ventaId,
              ventaNumero: numVenta,
              transportistaId: transportistaUrbanoId,
              transportistaNombre: transportistaUrbanoNombre,
              mes: fechaOrden.toDate().getMonth() + 1,
              anio: fechaOrden.toDate().getFullYear(),
              fecha: fechaOrden,
              esRecurrente: false,
              frecuencia: "unico",
              estado: "pagado",
              impactaCTRU: false,
              ctruRecalculado: true,
              pagos: [{ id: gdPagoId, fecha: fechaOrden, monedaPago: "PEN", montoOriginal: cargoEnvioML, montoPEN: cargoEnvioML, tipoCambio: tc, metodoPago: "mercado_pago", cuentaOrigenId: cuentaMPId, registradoPor: "ml-reingenieria" }],
              montoPagado: cargoEnvioML,
              montoPendiente: 0,
              creadoPor: "ml-reingenieria",
              fechaCreacion: admin.firestore.Timestamp.now(),
            });
          }
          stats.gdUrbanoCreados++;
          log.push(`  ${numVenta}: GD Urbano creado S/ ${cargoEnvioML.toFixed(2)}`);
        }
      }

      // --- FASE 3: RECONSTRUCCIÓN ---

      // 3a. Actualizar venta
      const costoTotalPEN = venta.costoTotalPEN || 0;
      const gastosVentaPEN = comisionML + (metodoEnvio === "urbano" ? cargoEnvioML : 0);
      const costoEnvioNegocio = venta.costoEnvioNegocio || 0;
      const totalGastosVenta = gastosVentaPEN + costoEnvioNegocio;
      const utilidadBrutaPEN = totalPENCorrecto - costoTotalPEN;
      const utilidadNetaPEN = utilidadBrutaPEN - totalGastosVenta;

      if (!dryRun) {
        await ventaDoc.ref.update({
          costoEnvio: costoEnvioCorrecto,
          totalPEN: totalPENCorrecto,
          comisionML,
          comisionMLPorcentaje: totalPENCorrecto > 0 ? (comisionML / totalPENCorrecto) * 100 : 0,
          cargoEnvioML: metodoEnvio === "urbano" ? cargoEnvioML : 0,
          metodoEnvio: metodoEnvio || null,
          gastosVentaPEN: totalGastosVenta,
          utilidadBrutaPEN,
          utilidadNetaPEN,
          margenBruto: totalPENCorrecto > 0 ? (utilidadBrutaPEN / totalPENCorrecto) * 100 : 0,
          margenNeto: totalPENCorrecto > 0 ? (utilidadNetaPEN / totalPENCorrecto) * 100 : 0,
          montoPagado: totalPENCorrecto,
          montoPendiente: 0,
          estadoPago: "pagado",
        });
      }
      stats.ventasActualizadas++;

      // 3b. Crear ingreso_venta (o respetar adelanto)
      // Detectar pago dividido: si hay ingresos a cuentas NO-MP que fueron protegidos
      let montoNoMP = 0;
      for (const m of ventaMovs) {
        const md = m.data();
        if (md.estado === "anulado" || simAnulados.has(m.id)) continue;
        if (md.tipo === "ingreso_venta" && md.cuentaDestino && md.cuentaDestino !== cuentaMPId) {
          montoNoMP += md.monto || 0;
        }
      }
      const montoIngresoMP = Math.max(0, Math.round((totalPENCorrecto - montoNoMP) * 100) / 100);
      const esPagoDividido = montoNoMP > 0.01;
      if (esPagoDividido) {
        log.push(`  ${numVenta}: ⚡ PAGO DIVIDIDO — S/ ${montoNoMP.toFixed(2)} a otra cuenta (protegido), S/ ${montoIngresoMP.toFixed(2)} a MP`);
      }

      if (tieneAdelanto) {
        // Verificar monto del adelanto vs monto correcto para MP
        const montoAdelantoCorrecto = esPagoDividido ? montoIngresoMP : totalPENCorrecto;
        const necesitaAjusteMonto = Math.abs(adelantoMonto - montoAdelantoCorrecto) > 0.01;
        const necesitaVincular = adelantoFoundBy === "cotizacionId"; // fue encontrado por cotización, no tiene ventaId correcto

        if ((necesitaAjusteMonto || necesitaVincular) && adelantoMovId) {
          const updateData: Record<string, any> = {};

          if (necesitaAjusteMonto) {
            updateData.monto = montoAdelantoCorrecto;
            updateData.montoEquivalentePEN = montoAdelantoCorrecto;
            updateData.montoEquivalenteUSD = montoAdelantoCorrecto / tc;
            const diff = montoAdelantoCorrecto - adelantoMonto;
            log.push(`  ${numVenta}: Adelanto ajustado S/ ${adelantoMonto.toFixed(2)} → S/ ${montoAdelantoCorrecto.toFixed(2)} (diff: ${diff > 0 ? "+" : ""}${diff.toFixed(2)})`);
            // Simular el ajuste en dry run para que Fase 4 calcule correctamente
            if (diff > 0) {
              simNuevos.push({ monto: diff, cuentaDestino: cuentaMPId, concepto: `ajuste_adelanto ${numVenta} (+${diff.toFixed(2)})` });
            } else if (diff < 0) {
              simNuevos.push({ monto: Math.abs(diff), cuentaOrigen: cuentaMPId, concepto: `ajuste_adelanto ${numVenta} (${diff.toFixed(2)})` });
            }
          }

          if (necesitaVincular) {
            updateData.ventaId = ventaId;
            updateData.ventaNumero = numVenta;
            log.push(`  ${numVenta}: Adelanto vinculado a venta (antes solo por cotizacionId)`);
          }

          if (!dryRun && Object.keys(updateData).length > 0) {
            await db.collection("movimientosTesoreria").doc(adelantoMovId).update(updateData);
          }
        }
      } else {
        // Crear nuevo ingreso_venta a MP (solo por la porción que realmente llega a MP)
        if (montoIngresoMP > 0.01) {
          if (!dryRun) {
            await db.collection("movimientosTesoreria").add({
              numeroMovimiento: `MOV-reeng-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
              tipo: "ingreso_venta",
              estado: "ejecutado",
              moneda: "PEN",
              monto: montoIngresoMP,
              tipoCambio: tc,
              montoEquivalentePEN: montoIngresoMP,
              montoEquivalenteUSD: montoIngresoMP / tc,
              metodo: "mercado_pago",
              concepto: `Pago venta ${numVenta} - ML #${sync.mlOrderId}${esPagoDividido ? " (porción MP)" : ""}`,
              ventaId,
              ventaNumero: numVenta,
              cuentaDestino: cuentaMPId,
              fecha: fechaOrden,
              creadoPor: "ml-reingenieria",
              fechaCreacion: admin.firestore.Timestamp.now(),
            });
          }
          simNuevos.push({ monto: montoIngresoMP, cuentaDestino: cuentaMPId, concepto: `ingreso ${numVenta}` });
          stats.movsCreados++;
        } else {
          log.push(`  ${numVenta}: Sin ingreso a MP (todo pagado por otra vía)`);
        }
      }

      // 3c. Crear gasto comision_ml + egreso
      if (comisionML > 0) {
        const numGasto = nextGastoNum();
        const pagoId = `PAG-GAS-reeng-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        if (!dryRun) {
          const gastoRef = await db.collection("gastos").add({
            numeroGasto: numGasto,
            tipo: "comision_ml",
            categoria: "GV",
            claseGasto: "GVD",
            descripcion: `Comisión ML - Orden #${sync.mlOrderId} - ${numVenta}`,
            moneda: "PEN",
            montoOriginal: comisionML,
            montoPEN: comisionML,
            tipoCambio: tc,
            esProrrateable: false,
            ventaId,
            ventaNumero: numVenta,
            mes: fechaOrden.toDate().getMonth() + 1,
            anio: fechaOrden.toDate().getFullYear(),
            fecha: fechaOrden,
            esRecurrente: false,
            frecuencia: "unico",
            estado: "pagado",
            impactaCTRU: false,
            ctruRecalculado: true,
            pagos: [{ id: pagoId, fecha: fechaOrden, monedaPago: "PEN", montoOriginal: comisionML, montoPEN: comisionML, tipoCambio: tc, metodoPago: "mercado_pago", cuentaOrigenId: cuentaMPId, registradoPor: "ml-reingenieria" }],
            montoPagado: comisionML,
            montoPendiente: 0,
            creadoPor: "ml-reingenieria",
            fechaCreacion: admin.firestore.Timestamp.now(),
          });

          await db.collection("movimientosTesoreria").add({
            numeroMovimiento: `MOV-reeng-com-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
            tipo: "gasto_operativo",
            estado: "ejecutado",
            moneda: "PEN",
            monto: comisionML,
            tipoCambio: tc,
            montoEquivalentePEN: comisionML,
            montoEquivalenteUSD: comisionML / tc,
            metodo: "mercado_pago",
            concepto: `Comisión ML - ${numVenta} - Orden #${sync.mlOrderId}`,
            gastoId: gastoRef.id,
            gastoNumero: numGasto,
            ventaId,
            ventaNumero: numVenta,
            cuentaOrigen: cuentaMPId,
            fecha: fechaOrden,
            creadoPor: "ml-reingenieria",
            fechaCreacion: admin.firestore.Timestamp.now(),
          });
        }
        simNuevos.push({ monto: comisionML, cuentaOrigen: cuentaMPId, concepto: `comision ${numVenta}` });
        stats.gastosCreados++;
        stats.movsCreados++;
      }

      // 3d. Crear gasto cargo_envio_ml + egreso (solo Urbano)
      if (metodoEnvio === "urbano" && cargoEnvioML > 0) {
        const numGastoEnvio = nextGastoNum();
        const pagoEnvioId = `PAG-GAS-reeng-env-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        if (!dryRun) {
          const gastoEnvioRef = await db.collection("gastos").add({
            numeroGasto: numGastoEnvio,
            tipo: "cargo_envio_ml",
            categoria: "GV",
            claseGasto: "GVD",
            descripcion: `Cargo envío ML (Urbano) - Orden #${sync.mlOrderId} - ${numVenta}`,
            moneda: "PEN",
            montoOriginal: cargoEnvioML,
            montoPEN: cargoEnvioML,
            tipoCambio: tc,
            esProrrateable: false,
            ventaId,
            ventaNumero: numVenta,
            mes: fechaOrden.toDate().getMonth() + 1,
            anio: fechaOrden.toDate().getFullYear(),
            fecha: fechaOrden,
            esRecurrente: false,
            frecuencia: "unico",
            estado: "pagado",
            impactaCTRU: false,
            ctruRecalculado: true,
            pagos: [{ id: pagoEnvioId, fecha: fechaOrden, monedaPago: "PEN", montoOriginal: cargoEnvioML, montoPEN: cargoEnvioML, tipoCambio: tc, metodoPago: "mercado_pago", cuentaOrigenId: cuentaMPId, registradoPor: "ml-reingenieria" }],
            montoPagado: cargoEnvioML,
            montoPendiente: 0,
            creadoPor: "ml-reingenieria",
            fechaCreacion: admin.firestore.Timestamp.now(),
          });

          await db.collection("movimientosTesoreria").add({
            numeroMovimiento: `MOV-reeng-env-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
            tipo: "gasto_operativo",
            estado: "ejecutado",
            moneda: "PEN",
            monto: cargoEnvioML,
            tipoCambio: tc,
            montoEquivalentePEN: cargoEnvioML,
            montoEquivalenteUSD: cargoEnvioML / tc,
            metodo: "mercado_pago",
            concepto: `Cargo envío ML (Urbano) - ${numVenta} - Orden #${sync.mlOrderId}`,
            gastoId: gastoEnvioRef.id,
            gastoNumero: numGastoEnvio,
            ventaId,
            ventaNumero: numVenta,
            cuentaOrigen: cuentaMPId,
            fecha: fechaOrden,
            creadoPor: "ml-reingenieria",
            fechaCreacion: admin.firestore.Timestamp.now(),
          });
        }
        simNuevos.push({ monto: cargoEnvioML, cuentaOrigen: cuentaMPId, concepto: `cargo_envio ${numVenta}` });
        stats.gastosCreados++;
        stats.movsCreados++;
      }

      // NOTA: El movimiento de egreso para GD Urbano NO se crea aquí
      // porque el cargo_envio_ml (3d arriba) ya tiene su movimiento de tesorería
      // que representa el mismo dinero saliendo de MP. Crear ambos sería doble-contar.
    }

    // Reporte: ventas ML sin mlOrderSync vinculado (para vincular manualmente)
    log.push("");
    log.push("--- Ventas ML sin mlOrderSync vinculado ---");
    let ventasSinSync = 0;
    for (const [vid, vDoc] of ventasMap) {
      if (syncByVentaId.has(vid)) continue;
      const vData = vDoc.data();
      const mlId = vData.mercadoLibreId || vData.mlOrderId;
      if (mlId && syncByMlOrderId.has(String(mlId))) continue;
      ventasSinSync++;
      log.push(`  ${vData.numeroVenta || vid}: "${vData.nombreCliente || "?"}" DNI:${vData.dniRuc || "?"} S/${(vData.totalPEN || 0).toFixed(2)} — sin mlOrderSync`);
    }
    if (ventasSinSync === 0) {
      log.push("  (todas las ventas ML tienen mlOrderSync vinculado)");
    } else {
      log.push(`  → ${ventasSinSync} ventas sin vincular. Use la herramienta "Vincular Órdenes ML" para asociarlas.`);
    }

    // ---- FASE 4: RECÁLCULO BALANCE MP + RECONCILIACIÓN ----
    log.push("");
    log.push("--- Fase 4: Recálculo balance MP ---");

    // Re-leer TODOS los movimientos ejecutados (incluye los recién creados en modo fix)
    const allMovsFinal = await db.collection("movimientosTesoreria")
      .where("estado", "==", "ejecutado")
      .get();

    // Calcular balance desde movimientos: excluir anulados en dry run, incluir virtuales
    let saldoCalculado = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;
    for (const m of allMovsFinal.docs) {
      if (simAnulados.has(m.id)) continue;
      const d = m.data();
      const isIngreso = d.cuentaDestino === cuentaMPId;
      const isEgreso = d.cuentaOrigen === cuentaMPId;
      if (isIngreso) { saldoCalculado += d.monto || 0; totalIngresos += d.monto || 0; }
      if (isEgreso) { saldoCalculado -= d.monto || 0; totalEgresos += d.monto || 0; }
    }
    // Agregar movimientos virtuales (los que se crearían en dry run)
    for (const vm of simNuevos) {
      if (vm.cuentaDestino === cuentaMPId) { saldoCalculado += vm.monto; totalIngresos += vm.monto; }
      if (vm.cuentaOrigen === cuentaMPId) { saldoCalculado -= vm.monto; totalEgresos += vm.monto; }
    }
    saldoCalculado = Math.round(saldoCalculado * 100) / 100;

    // Desglose: movimientos no-ML que contribuyen al balance (para diagnosticar gap)
    const processedVentaIds = new Set<string>();
    for (const sd of allSyncDocs) { if (sd.data().ventaId) processedVentaIds.add(sd.data().ventaId); }
    let noMLIngresos = 0, noMLEgresos = 0;
    const noMLMovsDetalle: string[] = [];
    const adelantosEnSistema: string[] = [];
    for (const m of allMovsFinal.docs) {
      if (simAnulados.has(m.id)) continue;
      const d = m.data();
      const isIngreso = d.cuentaDestino === cuentaMPId;
      const isEgreso = d.cuentaOrigen === cuentaMPId;
      if (!isIngreso && !isEgreso) continue;

      // Log todos los ingreso_anticipo a MP
      if (d.tipo === "ingreso_anticipo" && isIngreso) {
        adelantosEnSistema.push(`  💰 ${m.id.slice(0,10)}… | S/ ${(d.monto || 0).toFixed(2)} | ventaId: ${d.ventaId || "N/A"} | concepto: "${(d.concepto || "").slice(0, 60)}"`);
      }

      // Identificar si es ML (procesado) o no-ML
      const vid = d.ventaId;
      const esML = vid && processedVentaIds.has(vid);
      if (!esML) {
        if (isIngreso) noMLIngresos += d.monto || 0;
        if (isEgreso) noMLEgresos += d.monto || 0;
        if ((d.monto || 0) > 5) { // solo movimientos significativos
          const signo = isIngreso ? "+" : "-";
          noMLMovsDetalle.push(`  ${signo}S/ ${(d.monto || 0).toFixed(2)} | ${d.tipo} | ventaId: ${vid || "N/A"} | "${(d.concepto || "").slice(0, 50)}"`);
        }
      }
    }
    // También contar simNuevos como ML
    let simNuevosIngresos = 0, simNuevosEgresos = 0;
    for (const vm of simNuevos) {
      if (vm.cuentaDestino === cuentaMPId) simNuevosIngresos += vm.monto;
      if (vm.cuentaOrigen === cuentaMPId) simNuevosEgresos += vm.monto;
    }

    log.push(`Saldo registrado ERP: S/ ${saldoAnterior.toFixed(2)}`);
    log.push(`Saldo calculado (movimientos): S/ ${saldoCalculado.toFixed(2)}`);
    log.push(`Total ingresos MP: S/ ${totalIngresos.toFixed(2)}`);
    log.push(`Total egresos MP: S/ ${totalEgresos.toFixed(2)}`);
    log.push(`Movs: ${simAnulados.size} anulados, ${simNuevos.length} nuevos`);
    log.push("");
    log.push("--- Desglose balance ---");
    log.push(`ML procesado (ingresos): S/ ${(totalIngresos - noMLIngresos).toFixed(2)} (incl. ${simNuevosIngresos.toFixed(2)} nuevos)`);
    log.push(`ML procesado (egresos): S/ ${(totalEgresos - noMLEgresos).toFixed(2)} (incl. ${simNuevosEgresos.toFixed(2)} nuevos)`);
    log.push(`No-ML (ingresos): S/ ${noMLIngresos.toFixed(2)}`);
    log.push(`No-ML (egresos): S/ ${noMLEgresos.toFixed(2)}`);
    log.push(`No-ML neto: S/ ${(noMLIngresos - noMLEgresos).toFixed(2)}`);
    if (adelantosEnSistema.length > 0) {
      log.push("");
      log.push(`--- Adelantos (ingreso_anticipo) a MP: ${adelantosEnSistema.length} ---`);
      adelantosEnSistema.forEach(a => log.push(a));
    }
    if (noMLMovsDetalle.length > 0) {
      log.push("");
      log.push(`--- Movimientos no-ML significativos (>S/5): ${noMLMovsDetalle.length} ---`);
      noMLMovsDetalle.slice(0, 20).forEach(d => log.push(d));
      if (noMLMovsDetalle.length > 20) log.push(`  ... y ${noMLMovsDetalle.length - 20} más`);
    }

    // ---- RECONCILIACIÓN: Ajuste único contra saldo real ----
    let saldoFinal = saldoCalculado;
    let ajusteReconciliacion = 0;
    if (saldoRealMP !== null && saldoRealMP !== undefined) {
      ajusteReconciliacion = Math.round((saldoRealMP - saldoCalculado) * 100) / 100;
      log.push("");
      log.push("--- Reconciliación con saldo real ---");
      log.push(`Saldo real MercadoPago: S/ ${saldoRealMP.toFixed(2)}`);
      log.push(`Saldo calculado: S/ ${saldoCalculado.toFixed(2)}`);
      log.push(`Ajuste necesario: S/ ${ajusteReconciliacion > 0 ? "+" : ""}${ajusteReconciliacion.toFixed(2)}`);

      if (Math.abs(ajusteReconciliacion) > 0.01) {
        // Crear UN solo movimiento de ajuste para cuadrar
        if (!dryRun) {
          const ajusteData: any = {
            numeroMovimiento: `MOV-reeng-ajuste-${Date.now()}`,
            tipo: ajusteReconciliacion > 0 ? "ingreso_venta" : "gasto_operativo",
            estado: "ejecutado",
            moneda: "PEN",
            monto: Math.abs(ajusteReconciliacion),
            tipoCambio: tc,
            montoEquivalentePEN: Math.abs(ajusteReconciliacion),
            montoEquivalenteUSD: Math.abs(ajusteReconciliacion) / tc,
            metodo: "mercado_pago",
            concepto: `Ajuste reconciliación reingeniería ML (${ajusteReconciliacion > 0 ? "+" : ""}${ajusteReconciliacion.toFixed(2)}) — cuadre vs saldo real MP`,
            creadoPor: "ml-reingenieria",
            fechaCreacion: admin.firestore.Timestamp.now(),
            fecha: admin.firestore.Timestamp.now(),
          };
          if (ajusteReconciliacion > 0) {
            ajusteData.cuentaDestino = cuentaMPId;
          } else {
            ajusteData.cuentaOrigen = cuentaMPId;
          }
          await db.collection("movimientosTesoreria").add(ajusteData);
          stats.movsCreados++;
        }
        log.push(`→ ${dryRun ? "[DRY RUN] Se crearía" : "✅ Creado"} movimiento de ajuste: ${ajusteReconciliacion > 0 ? "ingreso" : "egreso"} S/ ${Math.abs(ajusteReconciliacion).toFixed(2)}`);
        saldoFinal = saldoRealMP;
      } else {
        log.push(`→ ¡Balance ya cuadra! No se necesita ajuste.`);
        saldoFinal = saldoCalculado;
      }
    } else {
      log.push(`(No se proporcionó saldoRealMP — sin reconciliación. Pase saldoRealMP para cuadrar automáticamente)`);
    }

    // Actualizar saldo de la cuenta
    if (!dryRun) {
      await db.collection("cuentasCaja").doc(cuentaMPId).update({
        saldoActual: saldoFinal,
      });
      log.push(`✅ Saldo MP actualizado a S/ ${saldoFinal.toFixed(2)}`);
    } else {
      log.push(`[DRY RUN] Saldo pasaría de S/ ${saldoAnterior.toFixed(2)} → S/ ${saldoFinal.toFixed(2)}`);
    }

    // Resumen
    log.push("");
    log.push("--- Resumen ---");
    log.push(`Órdenes leídas: ${stats.ordenesLeidas}`);
    log.push(`Ventas encontradas: ${stats.ventasEncontradas} (${stats.ventasSkipped} skipped)`);
    log.push(`Adelantos respetados: ${stats.adelantosRespetados}`);
    log.push(`Movimientos anulados: ${stats.movsAnulados} (incl. ${ajustesAnulados} ajustes manuales MP)`);
    log.push(`Movimientos creados: ${stats.movsCreados}`);
    log.push(`Gastos GV eliminados: ${stats.gastosEliminados}`);
    log.push(`Gastos GV creados: ${stats.gastosCreados}`);
    log.push(`GD Urbano corregidos: ${stats.gdUrbanoCorregidos}`);
    log.push(`GD Urbano creados: ${stats.gdUrbanoCreados}`);
    log.push(`Ventas actualizadas: ${stats.ventasActualizadas}`);
    log.push(`Ventas ML sin vincular: ${ventasSinSync}`);
    if (saldoRealMP !== null) {
      log.push(`Ajuste reconciliación: S/ ${ajusteReconciliacion > 0 ? "+" : ""}${ajusteReconciliacion.toFixed(2)}`);
    }

    functions.logger.info(`ML Reingeniería ${dryRun ? "(DRY RUN)" : "(APLICADO)"}: ${stats.ventasEncontradas} ventas, ${stats.movsAnulados} anulados, ${stats.movsCreados} creados, saldo S/${saldoAnterior.toFixed(2)} → S/${saldoFinal.toFixed(2)}${saldoRealMP !== null ? ` (real: ${saldoRealMP.toFixed(2)}, ajuste: ${ajusteReconciliacion.toFixed(2)})` : ""}`);

    return {
      success: true,
      dryRun,
      ordenesAnalizadas: stats.ordenesLeidas,
      ventasActualizadas: stats.ventasActualizadas,
      movimientosAnulados: stats.movsAnulados,
      movimientosCreados: stats.movsCreados,
      gastosEliminados: stats.gastosEliminados,
      gastosCreados: stats.gastosCreados,
      gdUrbanoCreadosCorregidos: stats.gdUrbanoCorregidos + stats.gdUrbanoCreados,
      adelantosRespetados: stats.adelantosRespetados,
      ventasSinVincular: ventasSinSync,
      balanceMP: {
        anterior: saldoAnterior,
        calculado: saldoCalculado,
        ajusteReconciliacion,
        final: saldoFinal,
        saldoRealMP: saldoRealMP,
      },
      log,
    };

  } catch (err: any) {
    functions.logger.error("Error en reingeniería ML:", err);
    throw new functions.https.HttpsError("internal", `Error: ${err.message}`);
  }
});

// ============================================================
// FUNCIÓN: Sugerencias de matching ML histórico ↔ ventas manuales
// ============================================================
export const mlmatchsuggestions = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  }

  // Helper: normalizar texto para comparación
  const normalize = (s: string | null | undefined): string =>
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Helper: similitud de strings (Dice coefficient)
  const similarity = (a: string, b: string): number => {
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 1;
    if (na.length < 2 || nb.length < 2) return 0;
    const bigrams = (str: string) => {
      const set = new Map<string, number>();
      for (let i = 0; i < str.length - 1; i++) {
        const bi = str.slice(i, i + 2);
        set.set(bi, (set.get(bi) || 0) + 1);
      }
      return set;
    };
    const aBi = bigrams(na);
    const bBi = bigrams(nb);
    let intersection = 0;
    for (const [bi, count] of aBi) {
      intersection += Math.min(count, bBi.get(bi) || 0);
    }
    return (2 * intersection) / (na.length - 1 + nb.length - 1);
  };

  try {
    // Cargar mlOrderSync pendientes sin ventaId
    const pendientesSnap = await db.collection("mlOrderSync")
      .where("estado", "==", "pendiente")
      .get();
    const pendientesSinVenta = pendientesSnap.docs.filter(d => !d.data().ventaId);

    // Cargar ventas ML
    const ventasSnap = await db.collection("ventas")
      .where("canalNombre", "==", "Mercado Libre")
      .get();

    // Cargar procesadas para saber qué ventas ya están vinculadas
    const procesadasSnap = await db.collection("mlOrderSync")
      .where("estado", "==", "procesada")
      .get();
    const ventaIdsVinculadas = new Set<string>();
    for (const d of procesadasSnap.docs) {
      const vid = d.data().ventaId;
      if (vid) ventaIdsVinculadas.add(vid);
    }
    // También pendientes con ventaId
    for (const d of pendientesSnap.docs) {
      const vid = d.data().ventaId;
      if (vid) ventaIdsVinculadas.add(vid);
    }

    // Ventas sin vincular
    const ventasSinVincular = ventasSnap.docs.filter(d => {
      if (ventaIdsVinculadas.has(d.id)) return false;
      // También verificar por mercadoLibreId
      const vData = d.data();
      const mlId = vData.mercadoLibreId || vData.mlOrderId;
      if (mlId) {
        // Verificar si ya hay un sync procesado con este mlOrderId
        for (const s of procesadasSnap.docs) {
          if (String(s.data().mlOrderId) === String(mlId)) return false;
        }
      }
      return true;
    });

    // Para cada pendiente sin venta, buscar coincidencias con ventas sin vincular
    const suggestions: Array<{
      syncId: string;
      mlOrderId: number;
      syncBuyerName: string;
      syncBuyerDni: string;
      syncTotal: number;
      syncFecha: string;
      syncProductos: string;
      syncMetodoEnvio: string;
      matches: Array<{
        ventaId: string;
        numeroVenta: string;
        nombreCliente: string;
        dniRuc: string;
        totalPEN: number;
        fechaCreacion: string;
        productos: string;
        score: number;
        matchDetails: string[];
      }>;
    }> = [];

    for (const syncDoc of pendientesSinVenta) {
      const sync = syncDoc.data();
      const syncName = sync.mlBuyerName || sync.buyerName || "";
      const syncDni = (sync.buyerDni || "").replace(/\D/g, "");
      const syncTotal = sync.totalML || 0;
      const syncFecha = sync.fechaOrdenML ? sync.fechaOrdenML.toDate() : null;
      const syncProds = (sync.productos || []).map((p: any) => p.mlTitle || p.productoNombre || "").join(", ");
      const syncMetodo = sync.metodoEnvio || "?";
      const syncCostoEnvio = sync.costoEnvioCliente || 0;

      const matchCandidates: Array<{
        ventaId: string;
        numeroVenta: string;
        nombreCliente: string;
        dniRuc: string;
        totalPEN: number;
        fechaCreacion: string;
        productos: string;
        score: number;
        matchDetails: string[];
      }> = [];

      for (const ventaDoc of ventasSinVincular) {
        const v = ventaDoc.data();
        let score = 0;
        const details: string[] = [];

        // 1. DNI match (strongest signal)
        const ventaDni = (v.dniRuc || "").replace(/\D/g, "");
        if (syncDni && ventaDni && syncDni === ventaDni) {
          score += 50;
          details.push(`DNI exacto (${syncDni})`);
        }

        // 2. Name match
        const nameSim = similarity(syncName, v.nombreCliente || "");
        if (nameSim >= 0.8) {
          score += 30;
          details.push(`Nombre ${Math.round(nameSim * 100)}%`);
        } else if (nameSim >= 0.5) {
          score += 15;
          details.push(`Nombre parcial ${Math.round(nameSim * 100)}%`);
        }

        // 3. Amount match
        const ventaTotal = v.totalPEN || 0;
        const ventaSubtotal = v.subtotalPEN || ventaTotal;
        if (syncTotal > 0) {
          if (Math.abs(syncTotal - ventaSubtotal) < 0.50) {
            score += 25;
            details.push(`Monto exacto S/${syncTotal.toFixed(2)}`);
          } else if (Math.abs(syncTotal + syncCostoEnvio - ventaTotal) < 0.50) {
            score += 20;
            details.push(`Monto+envío ≈ total (${syncTotal.toFixed(2)}+${syncCostoEnvio.toFixed(2)}≈${ventaTotal.toFixed(2)})`);
          } else if (Math.abs(syncTotal - ventaTotal) < 0.50) {
            score += 20;
            details.push(`Total ≈ ${ventaTotal.toFixed(2)}`);
          } else if (Math.abs(syncTotal - ventaTotal) < 5) {
            score += 10;
            details.push(`Monto cercano (diff ${Math.abs(syncTotal - ventaTotal).toFixed(2)})`);
          }
        }

        // 4. Date proximity
        if (syncFecha) {
          const ventaFecha = v.fechaCreacion ? v.fechaCreacion.toDate() : null;
          if (ventaFecha) {
            const diffDays = Math.abs(syncFecha.getTime() - ventaFecha.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays <= 1) {
              score += 10;
              details.push("Fecha ≤1 día");
            } else if (diffDays <= 3) {
              score += 5;
              details.push(`Fecha ≤3 días`);
            } else if (diffDays <= 7) {
              score += 2;
              details.push(`Fecha ≤7 días`);
            }
          }
        }

        // Minimum threshold: at least one meaningful match
        if (score >= 15) {
          const ventaProds = (v.productos || []).map((p: any) => p.nombreComercial || p.sku || "").join(", ");
          const ventaFechaStr = v.fechaCreacion ? v.fechaCreacion.toDate().toISOString().slice(0, 10) : "?";
          matchCandidates.push({
            ventaId: ventaDoc.id,
            numeroVenta: v.numeroVenta || ventaDoc.id,
            nombreCliente: v.nombreCliente || "",
            dniRuc: v.dniRuc || "",
            totalPEN: ventaTotal,
            fechaCreacion: ventaFechaStr,
            productos: ventaProds,
            score,
            matchDetails: details,
          });
        }
      }

      // Sort by score descending
      matchCandidates.sort((a, b) => b.score - a.score);

      suggestions.push({
        syncId: syncDoc.id,
        mlOrderId: sync.mlOrderId || 0,
        syncBuyerName: syncName,
        syncBuyerDni: syncDni,
        syncTotal: syncTotal,
        syncFecha: syncFecha ? syncFecha.toISOString().slice(0, 10) : "?",
        syncProductos: syncProds,
        syncMetodoEnvio: syncMetodo,
        matches: matchCandidates.slice(0, 3), // Top 3 matches
      });
    }

    // Sort: those with matches first, then by best score
    suggestions.sort((a, b) => {
      const aScore = a.matches[0]?.score || 0;
      const bScore = b.matches[0]?.score || 0;
      return bScore - aScore;
    });

    return {
      success: true,
      totalSyncPendientes: pendientesSinVenta.length,
      totalVentasSinVincular: ventasSinVincular.length,
      suggestions,
    };
  } catch (err: any) {
    functions.logger.error("Error en mlmatchsuggestions:", err);
    throw new functions.https.HttpsError("internal", `Error: ${err.message}`);
  }
});

// ============================================================
// FUNCIÓN: Confirmar vinculación manual ML ↔ Venta
// ============================================================
export const mlconfirmmatch = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  }

  const { matches } = data as { matches: Array<{ syncId: string; ventaId: string }> };
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere un array de matches [{syncId, ventaId}]");
  }

  const results: Array<{ syncId: string; ventaId: string; status: string }> = [];

  for (const { syncId, ventaId } of matches) {
    try {
      const syncRef = db.collection("mlOrderSync").doc(syncId);
      const ventaRef = db.collection("ventas").doc(ventaId);

      const [syncDoc, ventaDoc] = await Promise.all([syncRef.get(), ventaRef.get()]);
      if (!syncDoc.exists) {
        results.push({ syncId, ventaId, status: "error: mlOrderSync no encontrado" });
        continue;
      }
      if (!ventaDoc.exists) {
        results.push({ syncId, ventaId, status: "error: venta no encontrada" });
        continue;
      }

      const syncData = syncDoc.data()!;
      const mlOrderId = syncData.mlOrderId;

      // Actualizar mlOrderSync: vincular ventaId (mantener estado pendiente → se procesará en reingeniería)
      await syncRef.update({
        ventaId,
        vinculadoManualmente: true,
        fechaVinculacion: admin.firestore.Timestamp.now(),
        vinculadoPor: context.auth.uid,
      });

      // Actualizar venta: agregar mercadoLibreId si no tiene
      const ventaData = ventaDoc.data()!;
      if (!ventaData.mercadoLibreId && mlOrderId) {
        await ventaRef.update({
          mercadoLibreId: String(mlOrderId),
        });
      }

      results.push({ syncId, ventaId, status: "vinculado" });
      functions.logger.info(`ML Match: mlOrderSync ${syncId} (ML#${mlOrderId}) → venta ${ventaId}`);
    } catch (err: any) {
      results.push({ syncId, ventaId, status: `error: ${err.message}` });
    }
  }

  const exitosos = results.filter(r => r.status === "vinculado").length;
  return {
    success: true,
    total: matches.length,
    vinculados: exitosos,
    errores: matches.length - exitosos,
    results,
  };
});

// ============================================================
// FUNCIÓN: Diagnóstico de inconsistencias financieras ML
// Identifica ventas sin movimientos, montos incorrectos,
// y sugiere movimientos huérfanos candidatos para vincular.
// ============================================================
export const mldiaginconsistencias = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (_data, context) => {
  await requireAdminRole(context); // SEC-008

  // ---- Carga de datos ----
  const cuentaMPQ = await db.collection("cuentasCaja")
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("activa", "==", true).limit(1).get();
  if (cuentaMPQ.empty) {
    return { success: false, message: "No se encontró cuenta MercadoPago activa" };
  }
  const cuentaMPId = cuentaMPQ.docs[0].id;

  // mlOrderSync (procesadas + pendientes vinculadas)
  const syncProc = await db.collection("mlOrderSync").where("estado", "==", "procesada").get();
  const syncPend = await db.collection("mlOrderSync").where("estado", "==", "pendiente").get();
  const syncByVentaId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const allSyncDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  for (const doc of syncProc.docs) {
    if (doc.data().ventaId) syncByVentaId.set(doc.data().ventaId, doc);
    allSyncDocs.push(doc);
  }
  for (const doc of syncPend.docs) {
    if (doc.data().ventaId) {
      syncByVentaId.set(doc.data().ventaId, doc);
      allSyncDocs.push(doc);
    }
  }

  // Ventas ML
  const ventasSnap = await db.collection("ventas").where("canalNombre", "==", "Mercado Libre").get();
  const ventasMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const doc of ventasSnap.docs) ventasMap.set(doc.id, doc);

  // Movimientos ejecutados
  const movsSnap = await db.collection("movimientosTesoreria")
    .where("estado", "==", "ejecutado").get();
  const movsByVenta = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  for (const doc of movsSnap.docs) {
    const vid = doc.data().ventaId;
    if (vid) {
      if (!movsByVenta.has(vid)) movsByVenta.set(vid, []);
      movsByVenta.get(vid)!.push(doc);
    }
  }

  // ---- Pool de huérfanos: ingreso a MP sin ventaId ----
  const huerfanos: Array<{
    movId: string; monto: number; tipo: string;
    concepto: string; fecha: string; metodo: string;
  }> = [];
  for (const doc of movsSnap.docs) {
    const d = doc.data();
    if (d.ventaId) continue;
    if (d.cuentaDestino !== cuentaMPId) continue;
    if (d.tipo !== "ingreso_venta" && d.tipo !== "ingreso_anticipo") continue;
    huerfanos.push({
      movId: doc.id,
      monto: d.monto || 0,
      tipo: d.tipo,
      concepto: d.concepto || d.descripcion || "",
      fecha: d.fecha?.toDate?.()?.toISOString?.() || "",
      metodo: d.metodo || "",
    });
  }

  // ---- Encontrar inconsistencias ----
  const inconsistencias: any[] = [];

  for (const syncDoc of allSyncDocs) {
    const sync = syncDoc.data() as MLOrderSync;
    const ventaId = sync.ventaId;
    if (!ventaId) continue;
    const ventaDoc = ventasMap.get(ventaId);
    if (!ventaDoc) continue;
    const venta = ventaDoc.data();
    const numVenta = venta.numeroVenta || ventaId;

    const metodoEnvio = sync.metodoEnvio || venta.metodoEnvio || null;
    const comisionML = sync.comisionML || 0;
    const costoEnvioCliente = sync.costoEnvioCliente || 0;
    const cargoEnvioML = sync.cargoEnvioML || 0;
    const subtotalPEN = sync.totalML || venta.subtotalPEN || 0;

    const totalPENCorrecto = metodoEnvio === "flex"
      ? subtotalPEN + costoEnvioCliente
      : subtotalPEN;

    const ventaMovs = movsByVenta.get(ventaId) || [];
    const activeMovs = ventaMovs.filter(m => m.data().estado !== "anulado");
    const ingresoMovs = activeMovs.filter(m => m.data().cuentaDestino === cuentaMPId);
    const ventaFechaMs = (sync.fechaOrdenML || venta.fechaCreacion)?.toDate?.()?.getTime?.() || 0;

    if (ingresoMovs.length === 0) {
      // Sin movimientos — buscar candidatos en huérfanos
      const candidatos = huerfanos.map(orph => {
        let score = 0;
        const detail: string[] = [];

        // Monto exacto
        if (Math.abs(orph.monto - totalPENCorrecto) < 0.02) {
          score += 50; detail.push("monto exacto");
        } else if (Math.abs(orph.monto - subtotalPEN) < 0.02) {
          score += 40; detail.push("monto=subtotal");
        } else if (totalPENCorrecto > 0 && Math.abs(orph.monto - totalPENCorrecto) / totalPENCorrecto < 0.1) {
          score += 15; detail.push("monto ±10%");
        }

        // Fecha
        const movFechaMs = new Date(orph.fecha).getTime() || 0;
        const daysDiff = Math.abs(ventaFechaMs - movFechaMs) / (86400000);
        if (daysDiff < 2) { score += 30; detail.push("fecha ±2d"); }
        else if (daysDiff < 7) { score += 20; detail.push("fecha ±7d"); }
        else if (daysDiff < 30) { score += 10; detail.push("fecha ±30d"); }

        // Concepto contiene número de venta
        const cLower = orph.concepto.toLowerCase();
        const nLower = numVenta.toLowerCase();
        if (nLower && cLower.includes(nLower)) {
          score += 40; detail.push("concepto=numVenta");
        } else if (cLower.includes("ml") || cLower.includes("mercado")) {
          score += 5; detail.push("concepto~ML");
        }

        return { ...orph, score, matchDetail: detail.join(", ") };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

      inconsistencias.push({
        tipo: "sin_movimientos",
        ventaId,
        ventaNumero: numVenta,
        clienteNombre: venta.nombreCliente || "?",
        totalPENCorrecto,
        subtotalPEN,
        metodoEnvio: metodoEnvio || "?",
        comisionML,
        cargoEnvioML,
        fechaVenta: ventaFechaMs ? new Date(ventaFechaMs).toISOString() : "",
        candidatos,
      });
    } else {
      // Tiene movimientos — verificar monto
      const ingresoTotal = ingresoMovs.reduce((s, m) => s + (m.data().monto || 0), 0);
      if (Math.abs(ingresoTotal - totalPENCorrecto) > 1) {
        inconsistencias.push({
          tipo: "monto_incorrecto",
          ventaId,
          ventaNumero: numVenta,
          clienteNombre: venta.nombreCliente || "?",
          totalPENCorrecto,
          subtotalPEN,
          metodoEnvio: metodoEnvio || "?",
          comisionML,
          cargoEnvioML,
          fechaVenta: ventaFechaMs ? new Date(ventaFechaMs).toISOString() : "",
          movimientoActual: {
            movId: ingresoMovs[0].id,
            monto: ingresoTotal,
            tipo: ingresoMovs[0].data().tipo,
            concepto: ingresoMovs[0].data().concepto || "",
          },
          diferencia: totalPENCorrecto - ingresoTotal,
          candidatos: [],
        });
      }
    }
  }

  // Ordenar: sin_movimientos primero, luego monto_incorrecto
  inconsistencias.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === "sin_movimientos" ? -1 : 1;
    return (a.ventaNumero || "").localeCompare(b.ventaNumero || "");
  });

  return {
    success: true,
    totalInconsistencias: inconsistencias.length,
    totalHuerfanos: huerfanos.length,
    inconsistencias,
    huerfanos: huerfanos.sort((a, b) => b.monto - a.monto),
  };
});

// ============================================================
// FUNCIÓN: Resolver inconsistencias (vincular o anular movimientos)
// El usuario decide qué hacer con cada movimiento huérfano:
// - vincular: asigna ventaId al movimiento
// - anular: marca el movimiento como anulado
// ============================================================
export const mlresolverinconsistencias = functions.https.onCall(async (data, context) => {
  await requireAdminRole(context); // SEC-008

  const acciones: Array<{
    movimientoId?: string;
    ventaId?: string;
    ventaNumero?: string;
    accion: "vincular" | "anular" | "patch_sync";
    // Para patch_sync:
    syncId?: string;
    patchData?: Record<string, any>;
  }> = data?.acciones || [];

  if (acciones.length === 0) {
    return { success: false, message: "No se proporcionaron acciones" };
  }

  const results: Array<{ id: string; ok: boolean; accion?: string; error?: string }> = [];

  for (const acc of acciones) {
    try {
      if (acc.accion === "patch_sync" && acc.syncId && acc.patchData) {
        // Parchear campos específicos de un mlOrderSync
        const syncRef = db.collection("mlOrderSync").doc(acc.syncId);
        const syncDoc = await syncRef.get();
        if (!syncDoc.exists) {
          results.push({ id: acc.syncId, ok: false, error: "mlOrderSync no existe" });
          continue;
        }
        // Solo permitir campos seguros
        const allowed = ["metodoEnvio", "costoEnvioCliente", "cargoEnvioML", "comisionML", "totalML"];
        const safePatch: Record<string, any> = {};
        for (const [k, v] of Object.entries(acc.patchData)) {
          if (allowed.includes(k)) safePatch[k] = v;
        }
        if (Object.keys(safePatch).length === 0) {
          results.push({ id: acc.syncId, ok: false, error: "No hay campos válidos para parchar" });
          continue;
        }
        safePatch.parchadoPor = "ml-resolver-manual";
        safePatch.fechaParche = admin.firestore.Timestamp.now();
        await syncRef.update(safePatch);
        results.push({ id: acc.syncId, ok: true, accion: `patch_sync: ${Object.keys(safePatch).join(",")}` });
        continue;
      }

      if (!acc.movimientoId) {
        results.push({ id: "?", ok: false, error: "Falta movimientoId" });
        continue;
      }

      const movRef = db.collection("movimientosTesoreria").doc(acc.movimientoId);
      const movDoc = await movRef.get();
      if (!movDoc.exists) {
        results.push({ id: acc.movimientoId, ok: false, error: "Movimiento no existe" });
        continue;
      }

      if (acc.accion === "vincular" && acc.ventaId) {
        await movRef.update({
          ventaId: acc.ventaId,
          ventaNumero: acc.ventaNumero || null,
          vinculadoPor: "ml-resolver-manual",
          fechaVinculacion: admin.firestore.Timestamp.now(),
        });
        results.push({ id: acc.movimientoId, ok: true, accion: "vinculado" });
      } else if (acc.accion === "anular") {
        await movRef.update({
          estado: "anulado",
          anuladoPor: "ml-resolver-manual",
          fechaAnulacion: admin.firestore.Timestamp.now(),
        });
        results.push({ id: acc.movimientoId, ok: true, accion: "anulado" });
      } else {
        results.push({ id: acc.movimientoId, ok: false, error: "Acción inválida o falta ventaId" });
      }
    } catch (err: any) {
      results.push({ id: acc.movimientoId || acc.syncId || "?", ok: false, error: err.message });
    }
  }

  return {
    success: true,
    total: acciones.length,
    exitosos: results.filter(r => r.ok).length,
    errores: results.filter(r => !r.ok).length,
    results,
  };
});

// ============================================================
// REPARAR GASTOS GV FALTANTES EN VENTAS ML
// ============================================================

/**
 * Busca ventas ML procesadas que tienen comisionML > 0 pero no tienen
 * un gasto GV tipo "comision_ml" en la colección gastos.
 * Crea el gasto faltante para cada una.
 *
 * Idempotente: verifica existencia antes de crear.
 */
export const mlrepairgastosml = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    const Timestamp = admin.firestore.Timestamp;

    // 1. Buscar todas las ventas ML con comisionML > 0
    const ventasSnap = await db.collection("ventas")
      .where("comisionML", ">", 0)
      .get();

    let reparadas = 0;
    let yaExistentes = 0;
    let sinComision = 0;
    let errores = 0;
    const detalles: Array<{ venta: string; comision: number; accion: string }> = [];

    // 2. Buscar cuenta MercadoPago
    let cuentaMPId: string | null = null;
    const mpQuery = await db.collection("cuentasCaja")
      .where("metodoPagoAsociado", "==", "mercado_pago")
      .where("activa", "==", true)
      .limit(1)
      .get();
    if (!mpQuery.empty) {
      cuentaMPId = mpQuery.docs[0].id;
    } else {
      // Fallback: cualquier cuenta activa
      const anyQuery = await db.collection("cuentasCaja")
        .where("activa", "==", true)
        .limit(1)
        .get();
      if (!anyQuery.empty) cuentaMPId = anyQuery.docs[0].id;
    }

    // 3. Obtener tipo de cambio centralizado
    const tc = await resolverTCVenta();

    for (const ventaDoc of ventasSnap.docs) {
      const venta = ventaDoc.data();
      const comisionML = venta.comisionML || 0;
      const numeroVenta = venta.numeroVenta || ventaDoc.id;

      if (comisionML <= 0) {
        sinComision++;
        continue;
      }

      try {
        // Verificar si ya existe gasto GV
        const existingGV = await db.collection("gastos")
          .where("ventaId", "==", ventaDoc.id)
          .where("tipo", "==", "comision_ml")
          .limit(1)
          .get();

        if (!existingGV.empty) {
          yaExistentes++;
          continue;
        }

        // Crear gasto GV faltante
        const now = Timestamp.now();
        const fecha = venta.fechaCreacion || now;
        const fechaDate = fecha.toDate ? fecha.toDate() : new Date();
        const hasCuenta = !!cuentaMPId;

        // Generar número de gasto
        const prefix = `GAS-${fechaDate.getFullYear()}-`;
        const lastGasto = await db.collection("gastos")
          .where("numeroGasto", ">=", prefix)
          .where("numeroGasto", "<", prefix + "\uf8ff")
          .orderBy("numeroGasto", "desc")
          .limit(1)
          .get();
        let nextNum = 1;
        if (!lastGasto.empty) {
          const lastNumero = lastGasto.docs[0].data().numeroGasto as string;
          const numPart = parseInt(lastNumero.replace(prefix, ""), 10);
          if (!isNaN(numPart)) nextNum = numPart + 1;
        }
        const numeroGasto = `${prefix}${String(nextNum).padStart(4, "0")}`;

        const gastoData: Record<string, any> = {
          numeroGasto,
          tipo: "comision_ml",
          categoria: "GV",
          claseGasto: "GVD",
          descripcion: `Comisión ML - ${numeroVenta} (reparación)`,
          moneda: "PEN",
          montoOriginal: comisionML,
          montoPEN: comisionML,
          tipoCambio: tc,
          esProrrateable: false,
          ventaId: ventaDoc.id,
          ventaNumero: numeroVenta,
          mes: fechaDate.getMonth() + 1,
          anio: fechaDate.getFullYear(),
          fecha,
          esRecurrente: false,
          frecuencia: "unico",
          estado: hasCuenta ? "pagado" : "pendiente",
          impactaCTRU: false,
          ctruRecalculado: true,
          montoPagado: hasCuenta ? comisionML : 0,
          montoPendiente: hasCuenta ? 0 : comisionML,
          creadoPor: "ml-repair-gastos",
          fechaCreacion: now,
        };

        if (hasCuenta) {
          const pagoId = `PAG-GAS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          gastoData.pagos = [{
            id: pagoId,
            fecha: now,
            monedaPago: "PEN",
            montoOriginal: comisionML,
            montoPEN: comisionML,
            tipoCambio: tc,
            metodoPago: "mercado_pago",
            cuentaOrigenId: cuentaMPId,
            registradoPor: "ml-repair-gastos",
          }];
        }

        const gastoRef = await db.collection("gastos").add(gastoData);

        if (hasCuenta) {
          await db.collection("movimientosTesoreria").add({
            numeroMovimiento: `MOV-repair-${Date.now()}`,
            tipo: "gasto_operativo",
            estado: "ejecutado",
            moneda: "PEN",
            monto: comisionML,
            tipoCambio: tc,
            metodo: "mercado_pago",
            concepto: `Comisión ML - ${numeroVenta} (reparación GV faltante)`,
            gastoId: gastoRef.id,
            gastoNumero: numeroGasto,
            ventaId: ventaDoc.id,
            ventaNumero: numeroVenta,
            cuentaOrigen: cuentaMPId,
            fecha: now,
            creadoPor: "ml-repair-gastos",
            fechaCreacion: now,
          });

          await db.collection("cuentasCaja").doc(cuentaMPId!).update({
            saldoActual: admin.firestore.FieldValue.increment(-comisionML),
          });
        }

        reparadas++;
        detalles.push({ venta: numeroVenta, comision: comisionML, accion: "gasto_creado" });
        functions.logger.info(`ML Repair: GV creado para ${numeroVenta} - S/${comisionML.toFixed(2)}`);
      } catch (err: any) {
        errores++;
        detalles.push({ venta: numeroVenta, comision: comisionML, accion: `error: ${err.message}` });
        functions.logger.error(`ML Repair: Error en ${numeroVenta}:`, err);
      }
    }

    return {
      success: true,
      totalVentasML: ventasSnap.size,
      sinComision,
      yaExistentes,
      reparadas,
      errores,
      cuentaMPId: cuentaMPId || "NO ENCONTRADA",
      detalles,
    };
  });

/**
 * Repara metodoEnvio faltante en ventas ML.
 * Busca ventas con mercadoLibreId que no tienen metodoEnvio,
 * consulta su mlOrderSync para obtener trackingMethod y calcula metodoEnvio.
 */
export const mlrepairmetodoenvio = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    // SEC-002 + SEC-008 FIX: Verificar autenticación y rol admin
    await requireAdminRole(context);
    const ventasSnap = await db.collection("ventas")
      .where("mercadoLibreId", "!=", null)
      .get();

    let sinMetodo = 0;
    let reparadas = 0;
    let noSync = 0;
    let sinTrackingMethod = 0;
    const detalles: any[] = [];

    for (const ventaDoc of ventasSnap.docs) {
      const venta = ventaDoc.data();
      // Solo procesar ventas sin metodoEnvio
      if (venta.metodoEnvio) continue;
      sinMetodo++;

      const mlId = venta.mercadoLibreId;
      // Buscar mlOrderSync
      const syncQuery = await db.collection("mlOrderSync")
        .where("mercadoLibreId", "==", Number(mlId))
        .limit(1)
        .get();

      if (syncQuery.empty) {
        // Intentar buscar por string
        const syncQuery2 = await db.collection("mlOrderSync")
          .where("mercadoLibreId", "==", String(mlId))
          .limit(1)
          .get();

        if (syncQuery2.empty) {
          // Para pack orders, buscar por packId -> ml-pack-{packId}
          if (venta.packId) {
            const packSyncDoc = await db.collection("mlOrderSync").doc(`ml-pack-${venta.packId}`).get();
            if (packSyncDoc.exists) {
              const syncData = packSyncDoc.data()!;
              const result = await repairMetodoEnvioFromSync(
                ventaDoc, venta,
                packSyncDoc as unknown as admin.firestore.QueryDocumentSnapshot,
                syncData
              );
              if (result === "reparada") reparadas++;
              else if (result === "sin_tracking") sinTrackingMethod++;
              detalles.push({ venta: venta.numeroVenta, mlId, packId: venta.packId, trackingMethod: syncData.trackingMethod || null, accion: result });
              continue;
            }
          }
          noSync++;
          detalles.push({ venta: venta.numeroVenta, mlId, accion: "sin_sync" });
          continue;
        }

        // Usar la segunda query
        const syncData = syncQuery2.docs[0].data();
        const result = await repairMetodoEnvioFromSync(ventaDoc, venta, syncQuery2.docs[0], syncData);
        if (result === "reparada") reparadas++;
        else if (result === "sin_tracking") sinTrackingMethod++;
        detalles.push({ venta: venta.numeroVenta, mlId, trackingMethod: syncData.trackingMethod || null, accion: result });
        continue;
      }

      const syncDoc = syncQuery.docs[0];
      const syncData = syncDoc.data();
      const result = await repairMetodoEnvioFromSync(ventaDoc, venta, syncDoc, syncData);
      if (result === "reparada") reparadas++;
      else if (result === "sin_tracking") sinTrackingMethod++;
      detalles.push({ venta: venta.numeroVenta, mlId, trackingMethod: syncData.trackingMethod || null, accion: result });
    }

    return {
      success: true,
      totalVentasML: ventasSnap.size,
      sinMetodo,
      reparadas,
      noSync,
      sinTrackingMethod,
      detalles,
    };
  });

async function repairMetodoEnvioFromSync(
  ventaDoc: admin.firestore.QueryDocumentSnapshot,
  _venta: admin.firestore.DocumentData,
  syncDoc: admin.firestore.QueryDocumentSnapshot,
  syncData: admin.firestore.DocumentData
): Promise<string> {
  const trackingMethod = syncData.trackingMethod || null;
  if (!trackingMethod) return "sin_tracking";

  const methodStr = (trackingMethod as string).toLowerCase();
  let metodoEnvio: string | null = null;
  if (methodStr.includes("flex") || methodStr === "self_service") {
    metodoEnvio = "flex";
  } else if (methodStr.includes("urbano") || methodStr === "standard" || methodStr === "normal") {
    metodoEnvio = "urbano";
  }

  if (!metodoEnvio) return "no_match";

  // Actualizar venta y sync
  await ventaDoc.ref.update({ metodoEnvio });
  if (!syncData.metodoEnvio) {
    await syncDoc.ref.update({ metodoEnvio });
  }

  functions.logger.info(
    `ML Repair metodoEnvio: ${_venta.numeroVenta} → ${metodoEnvio} (trackingMethod: ${trackingMethod})`
  );
  return "reparada";
}
