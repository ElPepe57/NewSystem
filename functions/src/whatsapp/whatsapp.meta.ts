/**
 * WhatsApp Meta Cloud API Client
 *
 * Envía mensajes via Meta Business API.
 * Requiere: WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en .env
 */

import axios from "axios";

const GRAPH_API = "https://graph.facebook.com/v22.0";

function getConfig() {
  const { getSecret } = require("../secrets");
  return {
    token: getSecret("WHATSAPP_TOKEN"),
    phoneNumberId: getSecret("WHATSAPP_PHONE_NUMBER_ID"),
    verifyToken: getSecret("WHATSAPP_VERIFY_TOKEN") || "bmn-whatsapp-verify-2026",
  };
}

// ============================================================
// ENVIAR MENSAJE DE TEXTO
// ============================================================

export async function enviarMensajeTexto(
  to: string,
  text: string
): Promise<boolean> {
  const { token, phoneNumberId } = getConfig();
  if (!token || !phoneNumberId) {
    console.error("[WA] Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    return false;
  }

  try {
    // Dividir en partes si excede el límite de WhatsApp
    const parts = splitMessage(text);
    if (parts.length > 1) {
      console.log(`[WA] Mensaje dividido en ${parts.length} partes (${text.length} chars total)`);
    }

    for (const part of parts) {
      await axios.post(
        `${GRAPH_API}/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: part },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    }
    return true;
  } catch (error: unknown) {
    const axiosErr = error as { response?: { data?: unknown } };
    console.error("[WA] Error enviando mensaje:", axiosErr.response?.data || error);
    return false;
  }
}

// ============================================================
// ENVIAR LISTA INTERACTIVA
// ============================================================

export async function enviarListaInteractiva(
  to: string,
  headerText: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>
): Promise<boolean> {
  const { token, phoneNumberId } = getConfig();
  if (!token || !phoneNumberId) return false;

  try {
    await axios.post(
      `${GRAPH_API}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: headerText },
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    return true;
  } catch (error: unknown) {
    const axiosErr = error as { response?: { data?: unknown } };
    console.error("[WA] Error enviando lista:", axiosErr.response?.data || error);
    return false;
  }
}

// ============================================================
// MARCAR COMO LEÍDO
// ============================================================

export async function marcarComoLeido(messageId: string): Promise<void> {
  const { token, phoneNumberId } = getConfig();
  if (!token || !phoneNumberId) return;

  try {
    await axios.post(
      `${GRAPH_API}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch {
    // No-op: marcar como leído no es crítico
  }
}

// ============================================================
// VERIFICAR WEBHOOK (GET request de Meta)
// ============================================================

export function verificarWebhook(
  queryParams: Record<string, string>
): { status: number; body: string } {
  const { verifyToken } = getConfig();
  const mode = queryParams["hub.mode"];
  const token = queryParams["hub.verify_token"];
  const challenge = queryParams["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WA] Webhook verificado correctamente");
    // Meta espera que devolvamos el challenge como texto plano
    return { status: 200, body: challenge };
  }

  console.warn("[WA] Verificación de webhook fallida");
  return { status: 403, body: "Forbidden" };
}

// ============================================================
// UTILIDADES
// ============================================================

/**
 * WhatsApp tiene límite de ~4096 chars por mensaje.
 * Divide en partes si es necesario, cortando en saltos de línea.
 */
function splitMessage(text: string, maxLen = 3800): string[] {
  if (text.length <= maxLen) return [text];

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      parts.push(remaining);
      break;
    }

    // Buscar el último salto de línea dentro del límite
    let cutAt = remaining.lastIndexOf("\n", maxLen);
    if (cutAt < maxLen * 0.5) {
      // Si el corte es muy temprano, buscar un espacio
      cutAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (cutAt < maxLen * 0.3) {
      // Último recurso: cortar en el límite
      cutAt = maxLen;
    }

    parts.push(remaining.substring(0, cutAt));
    remaining = remaining.substring(cutAt).trimStart();
  }

  return parts;
}

