/**
 * Cloud Functions para Mercado Libre
 *
 * - mlauthcallback: OAuth callback para conectar cuenta ML
 * - mlwebhook: Recibe notificaciones de ML (órdenes, envíos, items, etc.)
 * - mlrefreshtoken: Scheduled function para mantener token fresco
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  exchangeCodeForToken,
  saveTokens,
  getAuthorizationUrl,
  getUser,
  processWebhookNotification,
  getValidAccessToken,
} from "./ml.api";
import { processOrderNotification, processShipmentNotification } from "./ml.sync";
import { MLWebhookNotification, MLOrderSync } from "./ml.types";
import { procesarOrdenCompleta } from "./ml.orderProcessor";

const db = admin.firestore();

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
    res.redirect(`${erpBaseUrl}/mercado-libre?ml_status=error&ml_error=${error}`);
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

    // 5. Redirigir al ERP con éxito
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
    stockMap.set(pid, disponiblesSnap.size);
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

  const orderSyncDoc = await db.collection("mlOrderSync").doc(orderSyncId).get();
  if (!orderSyncDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Orden ML no encontrada");
  }

  const orderSync = orderSyncDoc.data() as MLOrderSync & Record<string, any>;

  // Si ya fue procesada, retornar sin error
  if (orderSync.estado === "procesada") {
    return { already: true, ventaId: orderSync.ventaId, numeroVenta: orderSync.numeroVenta };
  }

  try {
    const result = await procesarOrdenCompleta(
      { id: orderSyncId, ...orderSync } as any,
      orderSyncDoc.ref
    );
    return result;
  } catch (err: any) {
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

  for (const doc of pendientesQuery.docs) {
    const orderSync = doc.data() as MLOrderSync & Record<string, any>;

    try {
      const result = await procesarOrdenCompleta(
        { id: doc.id, ...orderSync } as any,
        doc.ref
      );
      procesadas++;
      detalles.push({
        mlOrderId: orderSync.mlOrderId,
        resultado: "procesada",
        ventaId: result.ventaId,
      });
    } catch (err: any) {
      errores++;
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
