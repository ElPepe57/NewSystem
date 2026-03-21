/**
 * Mercado Libre — Autenticación, estado y webhooks de configuración
 *
 * Funciones:
 * - mlauthcallback: OAuth callback
 * - mlgetauthurl: Genera URL de autorización
 * - mlrefreshtoken: Scheduled token refresh
 * - mlgetstatus: Estado de conexión
 * - mlregisterwebhook: Registrar webhook en ML
 * - mlgetwebhookstatus: Estado del webhook
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  exchangeCodeForToken,
  saveTokens,
  getAuthorizationUrl,
  getUser,
  getValidAccessToken,
  getApplicationConfig,
  registerWebhookUrl,
} from "./ml.api";

const db = admin.firestore();

// SEC-008 FIX: Helper para verificar que el usuario tiene rol admin o gerente
// Usado en funciones de repair/diagnóstico que no deben ser accesibles por vendedores
export async function requireAdminRole(context: functions.https.CallableContext): Promise<void> {
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
// FUNCIONES: Estado de conexión y configuración de webhook
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
