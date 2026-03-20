/**
 * ML API Client - Capa de comunicación con la API de Mercado Libre
 *
 * Maneja autenticación, refresh de tokens, y llamadas a la API.
 * Todas las funciones requieren un access_token válido.
 */

import axios, { AxiosError } from "axios";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import {
  MLTokenResponse,
  MLTokenData,
  MLOrder,
  MLUser,
  MLItem,
  MLShipment,
  MLQuestion,
  MLSellerReputation,
  MLWebhookNotification,
  MLBillingInfoInner,
  MLBillingInfoResponse,
  MLPriceToWin,
} from "./ml.types";
import { getSecret } from "../secrets";

const ML_API_BASE = "https://api.mercadolibre.com";
const ML_AUTH_URL = "https://auth.mercadolibre.com.pe/authorization";

// ============================================================
// CONFIGURACIÓN
// ============================================================

function getConfig() {
  return {
    clientId: getSecret("ML_CLIENT_ID"),
    clientSecret: getSecret("ML_CLIENT_SECRET"),
    redirectUri: getSecret("ML_REDIRECT_URI"),
  };
}

// ============================================================
// AUTH / TOKENS
// ============================================================

/**
 * Genera la URL para que el usuario autorice la app en ML
 */
export function getAuthorizationUrl(): string {
  const { clientId, redirectUri } = getConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  return `${ML_AUTH_URL}?${params.toString()}`;
}

/**
 * Intercambia el authorization code por access_token + refresh_token
 */
export async function exchangeCodeForToken(code: string): Promise<MLTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getConfig();

  const response = await axios.post<MLTokenResponse>(
    `${ML_API_BASE}/oauth/token`,
    {
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }
  );

  return response.data;
}

/**
 * Renueva el access_token usando el refresh_token
 */
export async function refreshAccessToken(refreshToken: string): Promise<MLTokenResponse> {
  const { clientId, clientSecret } = getConfig();

  const response = await axios.post<MLTokenResponse>(
    `${ML_API_BASE}/oauth/token`,
    {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }
  );

  return response.data;
}

/**
 * Guarda tokens en Firestore
 */
export async function saveTokens(tokenResponse: MLTokenResponse): Promise<void> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + tokenResponse.expires_in * 1000
  );

  const tokenData: MLTokenData = {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt,
    userId: tokenResponse.user_id,
    lastRefreshed: now,
  };

  await db.collection("mlConfig").doc("tokens").set(tokenData, { merge: true });

  // Actualizar config general
  await db.collection("mlConfig").doc("settings").set(
    {
      connected: true,
      userId: tokenResponse.user_id,
      tokenExpiresAt: expiresAt,
    },
    { merge: true }
  );
}

/**
 * Obtiene un access_token válido (refresca si expiró)
 */
export async function getValidAccessToken(): Promise<string> {
  const db = admin.firestore();
  const tokenDoc = await db.collection("mlConfig").doc("tokens").get();

  if (!tokenDoc.exists) {
    throw new Error("ML no está conectado. Autoriza la app primero.");
  }

  const tokenData = tokenDoc.data() as MLTokenData;
  const now = Date.now();
  const expiresAt = tokenData.expiresAt.toMillis();

  // Si el token expira en menos de 5 minutos, refrescar
  if (now > expiresAt - 5 * 60 * 1000) {
    functions.logger.info("ML token expirado o por expirar, refrescando...");

    try {
      const newTokens = await refreshAccessToken(tokenData.refreshToken);
      await saveTokens(newTokens);
      return newTokens.access_token;
    } catch (error) {
      functions.logger.error("Error refrescando ML token:", error);
      // Marcar como desconectado
      await db.collection("mlConfig").doc("settings").update({
        connected: false,
      });
      throw new Error("No se pudo refrescar el token de ML. Re-autoriza la app.");
    }
  }

  return tokenData.accessToken;
}

// ============================================================
// HELPER para llamadas autenticadas
// ============================================================

async function mlGet<T>(path: string): Promise<T> {
  const accessToken = await getValidAccessToken();
  const response = await axios.get<T>(`${ML_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

async function mlPut<T>(path: string, data: Record<string, unknown>): Promise<T> {
  const accessToken = await getValidAccessToken();
  const response = await axios.put<T>(`${ML_API_BASE}${path}`, data, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

// ============================================================
// WEBHOOK REGISTRATION
// ============================================================

/**
 * Obtiene la configuración actual de la aplicación ML (incluye notification_url)
 */
export async function getApplicationConfig(): Promise<Record<string, any>> {
  const { clientId } = getConfig();
  return mlGet(`/applications/${clientId}`);
}

/**
 * Obtiene un token de aplicación (client_credentials).
 * Este token representa a la APLICACIÓN, no a un usuario.
 * Necesario para modificar configuración de la app (ej: webhook URL).
 */
async function getAppAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getConfig();
  const response = await axios.post<{ access_token: string; token_type: string; expires_in: number }>(
    `${ML_API_BASE}/oauth/token`,
    {
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }
  );
  return response.data.access_token;
}

/**
 * Registra la URL de notificaciones (webhook) en la aplicación ML.
 * ML enviará POST a esta URL cuando ocurran eventos (orders, shipments, items, questions).
 *
 * Usa token de aplicación (client_credentials) porque PUT /applications/{id}
 * requiere permisos de app owner, no del vendedor.
 */
export async function registerWebhookUrl(webhookUrl: string): Promise<Record<string, any>> {
  const { clientId } = getConfig();
  // Intentar primero con user token, fallback a app token
  let token: string;
  try {
    token = await getValidAccessToken();
  } catch {
    token = await getAppAccessToken();
  }
  const response = await axios.put<Record<string, any>>(
    `${ML_API_BASE}/applications/${clientId}`,
    {
      notification_callback_url: webhookUrl,
      notification_topics: ["orders_v2", "items", "shipments", "questions"],
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.data;
}

// ============================================================
// ORDERS
// ============================================================

/**
 * Obtiene una orden por ID
 */
export async function getOrder(orderId: number): Promise<MLOrder> {
  return mlGet<MLOrder>(`/orders/${orderId}`);
}

/**
 * Obtiene billing info extendida de una orden (razón social para RUC).
 * Retorna null si el endpoint no está disponible o falla.
 */
export async function getOrderBillingInfo(orderId: number): Promise<MLBillingInfoInner | null> {
  try {
    const response = await mlGet<MLBillingInfoResponse>(`/orders/${orderId}/billing_info`);
    return response.billing_info || null;
  } catch {
    return null;
  }
}

/**
 * Obtiene las órdenes de un pack (compra multi-producto en un solo carrito).
 * Retorna los order IDs que componen el pack, o null si falla.
 */
export async function getPackOrders(packId: number): Promise<{ orders: Array<{ id: number }> } | null> {
  try {
    return await mlGet<{ orders: Array<{ id: number }> }>(`/packs/${packId}`);
  } catch {
    return null;
  }
}

/**
 * Obtiene órdenes recientes del seller
 */
export async function getRecentOrders(sellerId: number, limit = 20): Promise<{
  results: MLOrder[];
  paging: { total: number; offset: number; limit: number };
}> {
  return mlGet(`/orders/search?seller=${sellerId}&sort=date_desc&limit=${limit}`);
}

/**
 * Busca órdenes del seller con paginación y filtros opcionales.
 * Usado para importar historial de órdenes.
 */
export async function searchOrders(
  sellerId: number,
  options: {
    offset?: number;
    limit?: number;
    sort?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}
): Promise<{
  results: MLOrder[];
  paging: { total: number; offset: number; limit: number };
}> {
  const params = new URLSearchParams();
  params.set("seller", String(sellerId));
  params.set("sort", options.sort || "date_desc");
  params.set("limit", String(Math.min(options.limit || 50, 50)));
  params.set("offset", String(options.offset || 0));

  if (options.dateFrom) params.set("order.date_created.from", options.dateFrom);
  if (options.dateTo) params.set("order.date_created.to", options.dateTo);

  return mlGet(`/orders/search?${params.toString()}`);
}

// ============================================================
// USERS / BUYERS
// ============================================================

/**
 * Obtiene información de un usuario (buyer o seller)
 */
export async function getUser(userId: number): Promise<MLUser> {
  return mlGet<MLUser>(`/users/${userId}`);
}

/**
 * Obtiene info del seller autenticado (incluye reputación)
 */
export async function getAuthenticatedUser(): Promise<MLUser & { seller_reputation: MLSellerReputation }> {
  return mlGet(`/users/me`);
}

// ============================================================
// ITEMS / PRODUCTS
// ============================================================

/**
 * Obtiene un item por ID
 */
export async function getItem(itemId: string): Promise<MLItem> {
  return mlGet<MLItem>(`/items/${itemId}`);
}

/**
 * Obtiene múltiples items (max 20)
 */
export async function getItems(itemIds: string[]): Promise<Array<{ code: number; body: MLItem }>> {
  const ids = itemIds.slice(0, 20).join(",");
  return mlGet(`/items?ids=${ids}`);
}

/**
 * Lista todos los items del seller
 */
export async function getSellerItems(sellerId: number, offset = 0, limit = 50): Promise<{
  seller_id: string;
  results: string[]; // Array de item IDs
  paging: { total: number; offset: number; limit: number };
}> {
  return mlGet(`/users/${sellerId}/items/search?offset=${offset}&limit=${limit}`);
}

/**
 * Busca items del seller por SKU
 */
export async function getItemBySku(sellerId: number, sku: string): Promise<{
  results: string[];
  paging: { total: number };
}> {
  return mlGet(`/users/${sellerId}/items/search?seller_sku=${encodeURIComponent(sku)}`);
}

/**
 * Actualiza el stock disponible de un item en ML
 */
export async function updateItemStock(itemId: string, quantity: number): Promise<void> {
  await mlPut(`/items/${itemId}`, { available_quantity: quantity });
}

/**
 * Actualiza el precio de un item en ML
 */
export async function updateItemPrice(itemId: string, price: number): Promise<void> {
  await mlPut(`/items/${itemId}`, { price });
}

// ============================================================
// BUY BOX / COMPETITION
// ============================================================

/**
 * Obtiene el estado de competencia (Buy Box) de un item de catálogo.
 * Solo aplica a publicaciones de catálogo (catalog_listing: true).
 * Retorna null si el item no es de catálogo o hay un error.
 */
export async function getItemPriceToWin(itemId: string): Promise<MLPriceToWin | null> {
  try {
    return await mlGet<MLPriceToWin>(`/items/${itemId}/price_to_win?siteId=MPE&version=v2`);
  } catch {
    return null;
  }
}

// ============================================================
// SHIPPING
// ============================================================

/**
 * Obtiene detalles de un envío
 */
export async function getShipment(shipmentId: number): Promise<MLShipment> {
  return mlGet<MLShipment>(`/shipments/${shipmentId}`);
}

// ============================================================
// QUESTIONS
// ============================================================

/**
 * Obtiene preguntas del seller (sin responder primero)
 */
export async function getSellerQuestions(
  sellerId: number,
  status: "UNANSWERED" | "ANSWERED" = "UNANSWERED",
  limit = 20
): Promise<{
  total: number;
  questions: MLQuestion[];
}> {
  return mlGet(
    `/questions/search?seller_id=${sellerId}&status=${status}&sort_fields=date_created&sort_types=DESC&limit=${limit}&api_version=4`
  );
}

/**
 * Responde una pregunta
 */
export async function answerQuestion(questionId: number, text: string): Promise<void> {
  const accessToken = await getValidAccessToken();
  await axios.post(
    `${ML_API_BASE}/answers`,
    { question_id: questionId, text },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

// ============================================================
// SELLER REPUTATION / METRICS
// ============================================================

/**
 * Obtiene la reputación del seller
 */
export async function getSellerReputation(sellerId: number): Promise<MLSellerReputation> {
  const user = await mlGet<{ seller_reputation: MLSellerReputation }>(`/users/${sellerId}`);
  return user.seller_reputation;
}

// ============================================================
// WEBHOOK VERIFICATION
// ============================================================

/**
 * Procesa una notificación de webhook de ML
 * ML envía el tópico y resource, nosotros obtenemos los detalles
 */
export async function processWebhookNotification(notification: MLWebhookNotification): Promise<{
  topic: string;
  resourceId: string;
  data: MLOrder | MLShipment | MLItem | MLQuestion | null;
}> {
  const { topic, resource } = notification;

  // Extraer el ID del resource path (e.g., "/orders/123456" → "123456")
  const resourceId = resource.split("/").pop() || "";

  try {
    let data: MLOrder | MLShipment | MLItem | MLQuestion | null = null;

    switch (topic) {
    case "orders_v2":
      data = await getOrder(parseInt(resourceId));
      break;
    case "shipments":
      data = await getShipment(parseInt(resourceId));
      break;
    case "items":
      data = await getItem(resourceId);
      break;
    case "questions":
      data = await mlGet<MLQuestion>(`/questions/${resourceId}?api_version=4`);
      break;
    case "payments":
      // Los pagos se procesan a través de la orden
      data = null;
      break;
    default:
      functions.logger.warn(`Tópico ML no manejado: ${topic}`);
      data = null;
    }

    return { topic, resourceId, data };
  } catch (error) {
    const axiosError = error as AxiosError;
    functions.logger.error(`Error procesando webhook ML [${topic}]:`, {
      resourceId,
      status: axiosError.response?.status,
      message: axiosError.message,
    });
    throw error;
  }
}
