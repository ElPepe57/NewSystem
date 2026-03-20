/**
 * WhatsApp Chatbot - Types
 *
 * Tres modos de operación:
 * - interno: Consultas ERP para el equipo (inventario, ventas, OCs)
 * - ventas: Asistencia comercial (precios, disponibilidad, cotizaciones)
 * - welcome: Bienvenida automática a clientes nuevos
 */

// ============================================================
// META WHATSAPP API TYPES
// ============================================================

export interface WAWebhookPayload {
  object: string;
  entry: WAEntry[];
}

export interface WAEntry {
  id: string;
  changes: WAChange[];
}

export interface WAChange {
  value: WAChangeValue;
  field: string;
}

export interface WAChangeValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WAContact[];
  messages?: WAIncomingMessage[];
  statuses?: WAStatus[];
}

export interface WAContact {
  profile: { name: string };
  wa_id: string;
}

export interface WAIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "document" | "interactive" | "button";
  text?: { body: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
}

export interface WAStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
}

// ============================================================
// CHATBOT INTERNAL TYPES
// ============================================================

export type ChatMode = "interno" | "ventas" | "welcome";

export type UserRole = "admin" | "vendedor" | "viewer";

export interface WASession {
  phoneNumber: string;
  nombre: string;
  mode: ChatMode;
  role: UserRole;
  registeredAt: FirebaseFirestore.Timestamp;
  lastActivity: FirebaseFirestore.Timestamp;
  isInternal: boolean; // true = miembro del equipo, false = cliente
  metadata?: Record<string, unknown>;
}

export interface WAMessage {
  from: string;
  text: string;
  response: string;
  timestamp: FirebaseFirestore.Timestamp;
  mode: ChatMode;
  intent?: string;
  tokensUsed?: number;
  aiModel?: string;
  processingTimeMs?: number;
}

export interface WAWelcomeConfig {
  enabled: boolean;
  message: string;
  followUpMessage?: string;
  followUpDelayMinutes?: number;
}

// ============================================================
// INTENT DETECTION
// ============================================================

export type Intent =
  | "STOCK_CHECK"
  | "STOCK_BAJO"
  | "VENTA_STATUS"
  | "VENTAS_RESUMEN"
  | "VENTAS_HOY"
  | "OC_STATUS"
  | "OC_PENDIENTES"
  | "PRODUCTO_PRECIO"
  | "PRODUCTO_BUSCAR"
  | "COTIZACION_STATUS"
  | "RESUMEN_DIA"
  | "CAJA_SALDO"
  | "GASTOS_RESUMEN"
  | "CLIENTE_INFO"
  | "ENTREGAS_PENDIENTES"
  | "TIPO_CAMBIO"
  | "RENTABILIDAD"
  | "AYUDA"
  | "SALUDO"
  | "UNKNOWN";

export interface IntentResult {
  intent: Intent;
  params: Record<string, string>;
  confidence: number;
}

// ============================================================
// ERP QUERY RESULTS
// ============================================================

export interface ERPQueryResult {
  success: boolean;
  data?: string; // Formatted text response
  rawData?: unknown;
  error?: string;
}

// ============================================================
// AI PROVIDER
// ============================================================

export type AIProvider = "anthropic" | "gemini";

export interface AIResponse {
  text: string;
  tokensUsed: number;
  model: string;
  provider: AIProvider;
}
