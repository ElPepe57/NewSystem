/**
 * WhatsApp Chatbot - Message Handler v3 (Function Calling)
 *
 * Flujo AI-First con clasificación inteligente:
 * 1. Identifica al usuario (interno vs cliente)
 * 2. Gemini clasifica qué datos del ERP necesita (Function Calling)
 * 3. Ejecuta las funciones ERP en paralelo
 * 4. Gemini genera la respuesta con datos reales
 * 5. Guarda historial en Firestore
 *
 * Zero regex. Zero keywords. 100% lenguaje natural.
 */

import * as admin from "firebase-admin";
import {
  WAIncomingMessage,
  WASession,
  WAMessage,
  ChatMode,
} from "./whatsapp.types";
import {
  consultarStock,
  consultarStockBajo,
  estadoVenta,
  ocsPendientes,
  ocsRecientes,
  estadoOC,
  resumenDia,
  buscarProductoVenta,
  ventasDetalladas,
  saldosCaja,
  gastosResumen,
  buscarCliente,
  entregasPendientes,
  tipoCambioHoy,
  rentabilidadReciente,
  cobrosPendientes,
  ventasMayores,
  ventasPorProducto,
} from "./whatsapp.erp";
import { generateAIResponse } from "./whatsapp.ai";
import { enviarMensajeTexto, marcarComoLeido } from "./whatsapp.meta";
import { classifyIntent, ERPFunction } from "./whatsapp.classifier";

const db = admin.firestore();

const COL_SESSIONS = "whatsapp_sessions";
const COL_MESSAGES = "whatsapp_messages";

// ============================================================
// ENRIQUECIMIENTO DE CONTEXTO 360° (Visión Proactiva)
// ============================================================

/**
 * Después de que el clasificador decide qué funciones llamar,
 * este paso agrega funciones complementarias automáticamente
 * para dar una visión completa sin que el usuario lo pida.
 *
 * Ejemplo: si pregunta "stock de Nordic Naturals", el clasificador
 * devuelve consultarStock. Nosotros agregamos ventasPorProducto
 * (velocidad de venta) y ocsPendientes (reabastecimiento en camino).
 */
function enrichWithContext360(functions: ERPFunction[]): ERPFunction[] {
  const names = new Set(functions.map((f) => f.name));
  const extras: ERPFunction[] = [];

  for (const fn of functions) {
    const producto = fn.params?.producto || fn.params?.nombre || fn.params?.query || "";

    switch (fn.name) {
      // Stock de producto → agregar ventas recientes (velocidad) + OCs pendientes (reabastecimiento)
      case "consultarStock": {
        if (producto && !names.has("ventasPorProducto")) {
          extras.push({ name: "ventasPorProducto", params: { producto, dias: "30" } });
          names.add("ventasPorProducto");
        }
        if (!names.has("ocsPendientes")) {
          extras.push({ name: "ocsPendientes" });
          names.add("ocsPendientes");
        }
        break;
      }

      // Ventas de producto → agregar stock actual (disponibilidad)
      case "ventasPorProducto": {
        if (producto && !names.has("consultarStock")) {
          extras.push({ name: "consultarStock", params: { producto } });
          names.add("consultarStock");
        }
        break;
      }

      // Stock bajo → agregar OCs pendientes (qué viene en camino)
      case "consultarStockBajo": {
        if (!names.has("ocsPendientes")) {
          extras.push({ name: "ocsPendientes" });
          names.add("ocsPendientes");
        }
        break;
      }

      // Rentabilidad general → agregar saldos de caja para contexto financiero
      case "rentabilidadReciente": {
        if (!names.has("saldosCaja")) {
          extras.push({ name: "saldosCaja" });
          names.add("saldosCaja");
        }
        break;
      }

      // Saldos de caja → agregar cobros pendientes (dinero por cobrar)
      case "saldosCaja": {
        if (!names.has("cobrosPendientes")) {
          extras.push({ name: "cobrosPendientes" });
          names.add("cobrosPendientes");
        }
        break;
      }

      // Resumen del día → agregar saldos para panorama completo
      case "resumenDia": {
        if (!names.has("saldosCaja")) {
          extras.push({ name: "saldosCaja" });
          names.add("saldosCaja");
        }
        break;
      }

      // Entregas pendientes → agregar cobros (ventas sin pagar que se van a entregar)
      case "entregasPendientes": {
        if (!names.has("cobrosPendientes")) {
          extras.push({ name: "cobrosPendientes" });
          names.add("cobrosPendientes");
        }
        break;
      }

      // OCs recientes/pendientes → agregar stock bajo (contexto de qué falta)
      case "ocsRecientes":
      case "ocsPendientes": {
        if (!names.has("consultarStockBajo")) {
          extras.push({ name: "consultarStockBajo" });
          names.add("consultarStockBajo");
        }
        break;
      }

      // Gastos → agregar saldos de caja (impacto en liquidez)
      case "gastosResumen": {
        if (!names.has("saldosCaja")) {
          extras.push({ name: "saldosCaja" });
          names.add("saldosCaja");
        }
        break;
      }
    }
  }

  // Limitar a máximo 5 funciones totales para no exceder latencia
  const enriched = [...functions, ...extras];
  if (enriched.length > 5) {
    console.log(`[WA] Context360: recortando de ${enriched.length} a 5 funciones (priorizando las originales)`);
    return [...functions, ...extras.slice(0, 5 - functions.length)];
  }

  if (extras.length > 0) {
    console.log(`[WA] Context360: +${extras.length} funciones complementarias: ${extras.map((f) => f.name).join(", ")}`);
  }

  return enriched;
}

// ============================================================
// EJECUTAR FUNCIONES ERP SEGÚN CLASIFICACIÓN DE GEMINI
// ============================================================

/**
 * Mapa de funciones ERP disponibles.
 * Gemini devuelve nombres de funciones + parámetros,
 * y aquí las ejecutamos dinámicamente.
 */
// Defaults de días por función — cada función tiene su propio default sensible
const DIAS_DEFAULTS: Record<string, string> = {
  ventasDetalladas: "7",
  ocsRecientes: "30",
  gastosResumen: "30",
  rentabilidadReciente: "30",
  ventasPorProducto: "0",  // búsqueda de producto = todo el historial por defecto
  ventasMayores: "0",       // ranking = todo el historial por defecto
};

async function executeERPFunction(fn: ERPFunction): Promise<string | null> {
  try {
    const defaultDias = DIAS_DEFAULTS[fn.name] || "7";
    const dias = parseInt(fn.params?.dias || defaultDias, 10);
    let fechaDesde = fn.params?.fechaDesde || undefined;
    let fechaHasta = fn.params?.fechaHasta || undefined;

    // Validar que las fechas son ISO válidas, sino descartarlas
    if (fechaDesde && isNaN(new Date(fechaDesde).getTime())) {
      console.warn(`[WA] fechaDesde inválida: "${fechaDesde}", descartando`);
      fechaDesde = undefined;
      fechaHasta = undefined;
    }

    console.log(`[WA] executeERPFunction: ${fn.name} | params: ${JSON.stringify(fn.params)} | dias=${dias} fechaDesde=${fechaDesde} fechaHasta=${fechaHasta}`);

    switch (fn.name) {
      case "ventasDetalladas": {
        const result = await ventasDetalladas(dias, fechaDesde, fechaHasta);
        return result.success && result.data ? `VENTAS:\n${result.data}` : null;
      }
      case "consultarStock": {
        const producto = fn.params?.producto || fn.params?.query || "";
        if (!producto) return null;
        const result = await consultarStock(producto);
        return result.success && result.data ? `STOCK DE "${producto}":\n${result.data}` : null;
      }
      case "consultarStockBajo": {
        const result = await consultarStockBajo();
        return result.success && result.data ? `PRODUCTOS CON STOCK BAJO:\n${result.data}` : null;
      }
      case "estadoVenta": {
        const id = fn.params?.id || fn.params?.query || "";
        if (!id) return null;
        const result = await estadoVenta(id);
        return result.success && result.data ? `ESTADO DE VENTA ${id}:\n${result.data}` : null;
      }
      case "ocsPendientes": {
        const result = await ocsPendientes();
        return result.success && result.data ? `ÓRDENES DE COMPRA PENDIENTES:\n${result.data}` : null;
      }
      case "ocsRecientes": {
        const result = await ocsRecientes(dias, fechaDesde, fechaHasta);
        return result.success && result.data ? `COMPRAS A PROVEEDORES:\n${result.data}` : null;
      }
      case "estadoOC": {
        const id = fn.params?.id || fn.params?.query || "";
        if (!id) return null;
        const result = await estadoOC(id);
        return result.success && result.data ? `ESTADO DE OC ${id}:\n${result.data}` : null;
      }
      case "resumenDia": {
        const result = await resumenDia();
        return result.success && result.data ? `RESUMEN DEL DÍA:\n${result.data}` : null;
      }
      case "buscarProductoVenta": {
        const nombre = fn.params?.nombre || fn.params?.query || fn.params?.producto || "";
        if (!nombre) return null;
        const result = await buscarProductoVenta(nombre);
        return result.success && result.data ? `PRODUCTOS ENCONTRADOS:\n${result.data}` : null;
      }
      case "saldosCaja": {
        const result = await saldosCaja();
        return result.success && result.data ? `SALDOS DE CAJA:\n${result.data}` : null;
      }
      case "gastosResumen": {
        const result = await gastosResumen(dias, fechaDesde, fechaHasta);
        return result.success && result.data ? `GASTOS:\n${result.data}` : null;
      }
      case "buscarCliente": {
        const nombre = fn.params?.nombre || fn.params?.query || "";
        if (!nombre) return null;
        const result = await buscarCliente(nombre);
        return result.success && result.data ? `INFO CLIENTE "${nombre}":\n${result.data}` : null;
      }
      case "entregasPendientes": {
        const result = await entregasPendientes();
        return result.success && result.data ? `ENTREGAS PENDIENTES:\n${result.data}` : null;
      }
      case "tipoCambioHoy": {
        const result = await tipoCambioHoy();
        return result.success && result.data ? `TIPO DE CAMBIO:\n${result.data}` : null;
      }
      case "rentabilidadReciente": {
        const result = await rentabilidadReciente(dias, fechaDesde, fechaHasta);
        return result.success && result.data ? `RENTABILIDAD:\n${result.data}` : null;
      }
      case "cobrosPendientes": {
        const result = await cobrosPendientes();
        return result.success && result.data ? `COBROS PENDIENTES:\n${result.data}` : null;
      }
      case "ventasMayores": {
        const limite = parseInt(fn.params?.limite || "10", 10);
        const result = await ventasMayores(dias, limite, fechaDesde, fechaHasta);
        return result.success && result.data ? `TOP VENTAS:\n${result.data}` : null;
      }
      case "ventasPorProducto": {
        const producto = fn.params?.producto || fn.params?.nombre || fn.params?.query || "";
        if (!producto) return null;
        const result = await ventasPorProducto(producto, dias, fechaDesde, fechaHasta);
        return result.success && result.data ? `VENTAS DE "${producto}":\n${result.data}` : null;
      }
      default: {
        console.warn(`[WA] Función ERP desconocida: ${fn.name}`);
        return null;
      }
    }
  } catch (error) {
    console.error(`[WA] Error ejecutando ${fn.name}:`, (error as Error).message);
    return null;
  }
}

/**
 * Ejecuta TODAS las funciones ERP en paralelo y combina resultados.
 */
async function executeERPFunctions(functions: ERPFunction[]): Promise<string> {
  if (functions.length === 0) return "";

  console.log(`[WA] Ejecutando ${functions.length} funciones ERP: ${functions.map((f) => f.name).join(", ")}`);

  const results = await Promise.all(functions.map((fn) => executeERPFunction(fn)));
  const validResults = results.filter((r): r is string => r !== null);

  return validResults.join("\n\n---\n\n");
}

// ============================================================
// MANEJO DE SESIÓN
// ============================================================

async function getOrCreateSession(
  phoneNumber: string,
  contactName?: string
): Promise<WASession> {
  const docRef = db.collection(COL_SESSIONS).doc(phoneNumber);
  const doc = await docRef.get();

  if (doc.exists) {
    await docRef.update({
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
    });
    return doc.data() as WASession;
  }

  const isInternal = await checkIfInternal(phoneNumber);

  const session: WASession = {
    phoneNumber,
    nombre: contactName || phoneNumber,
    mode: isInternal ? "interno" : "welcome",
    role: isInternal ? "vendedor" : "viewer",
    registeredAt: admin.firestore.Timestamp.now(),
    lastActivity: admin.firestore.Timestamp.now(),
    isInternal,
  };

  await docRef.set(session);
  return session;
}

async function checkIfInternal(phoneNumber: string): Promise<boolean> {
  const usersSnap = await db.collection("users").get();

  for (const doc of usersSnap.docs) {
    const user = doc.data();
    const userPhone = (user.telefono || user.phone || "").replace(/\D/g, "");
    const cleanInput = phoneNumber.replace(/\D/g, "");

    if (
      userPhone &&
      cleanInput &&
      userPhone.slice(-9) === cleanInput.slice(-9)
    ) {
      return true;
    }
  }

  return false;
}

// ============================================================
// HISTORIAL DE CONVERSACIÓN
// ============================================================

async function getConversationHistory(
  phoneNumber: string,
  limit = 10
): Promise<WAMessage[]> {
  try {
    const snap = await db
      .collection(COL_MESSAGES)
      .where("from", "==", phoneNumber)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const messages = snap.docs.map((doc) => doc.data() as WAMessage);
    return messages.reverse();
  } catch (error) {
    console.warn("[WA] Error obteniendo historial:", (error as Error).message);
    return [];
  }
}

async function saveMessage(
  phoneNumber: string,
  text: string,
  response: string,
  mode: ChatMode,
  extras: Partial<WAMessage> = {}
): Promise<void> {
  await db.collection(COL_MESSAGES).add({
    from: phoneNumber,
    text,
    response,
    timestamp: admin.firestore.Timestamp.now(),
    mode,
    ...extras,
  });
}

// ============================================================
// RESPUESTAS ESTÁTICAS (sin AI — solo saludo/ayuda)
// ============================================================

function getHelpMessage(): string {
  return [
    "*Soy el asistente de BusinessMN* 🤖\n",
    "Pregúntame lo que necesites en *lenguaje natural*. Ejemplos:\n",
    "📦 *Inventario*",
    '  "¿Cuántas unidades hay de sérum?"',
    '  "¿Qué productos se están acabando?"',
    "",
    "💰 *Ventas*",
    '  "¿Cuánto vendimos esta semana?"',
    '  "¿Cuál fue la última venta?"',
    '  "Dame detalles de las compras del mes"',
    "",
    "💵 *Finanzas*",
    '  "¿Cuánta plata tenemos?"',
    '  "¿En qué hemos gastado?"',
    '  "¿Nos deben algo?"',
    '  "¿A cuánto está el dólar?"',
    "",
    "📊 *Negocio*",
    '  "¿Cómo vamos?" / "Ponme al día"',
    '  "¿Estamos ganando o perdiendo?"',
    "",
    "🚚 *Logística*",
    '  "¿Qué hay en camino?"',
    '  "¿Qué falta entregar?"',
    "",
    "👤 *Clientes*",
    '  "¿Qué ha comprado el cliente Juan?"',
    "",
    "_No necesitas comandos exactos, habla como si fuera una conversación normal._",
  ].join("\n");
}

function getGreeting(session: WASession): string {
  const hora = new Date().getHours();
  let saludo = "Hola";
  if (hora < 12) saludo = "Buenos días";
  else if (hora < 18) saludo = "Buenas tardes";
  else saludo = "Buenas noches";

  if (session.isInternal) {
    return `${saludo}, ${session.nombre}! 👋 ¿Qué necesitas consultar? Escribe *ayuda* para ver ejemplos.`;
  }

  return `${saludo}! Bienvenido a BusinessMN. ¿En qué podemos ayudarte?`;
}

// ============================================================
// HANDLER PRINCIPAL (AI-First + Function Calling)
// ============================================================

export async function handleIncomingMessage(
  message: WAIncomingMessage,
  contactName?: string
): Promise<void> {
  const startTime = Date.now();
  const phoneNumber = message.from;

  console.log(`[WA] Mensaje recibido de ${phoneNumber} (${contactName || "sin nombre"})`);

  const text = message.text?.body?.trim();
  if (!text) {
    await enviarMensajeTexto(
      phoneNumber,
      "Por ahora solo puedo procesar mensajes de texto. 📝"
    );
    return;
  }

  await marcarComoLeido(message.id);

  // 1. Obtener o crear sesión del usuario
  const session = await getOrCreateSession(phoneNumber, contactName);

  // 2. Clasificar intención con Gemini (Function Calling)
  const classification = await classifyIntent(text);
  console.log(`[WA] Clasificación: greeting=${classification.isGreeting}, help=${classification.isHelp}, functions=${JSON.stringify(classification.functions)}`);

  let responseText: string;
  let aiModel = "";
  let tokensUsed = 0;

  // ============================================================
  // SALUDO Y AYUDA → respuesta directa (ahorro de tokens)
  // ============================================================

  // Safety net: si el clasificador dice greeting pero el mensaje tiene más de 20 chars,
  // probablemente hay una pregunta real después del saludo. Reclasificar como consulta.
  const isReallyJustGreeting = classification.isGreeting && text.length <= 20;

  if (isReallyJustGreeting) {
    responseText = getGreeting(session);
  } else if (classification.needsClarification && classification.clarificationMessage) {
    // El clasificador no pudo determinar la intención — pedir clarificación
    responseText = classification.clarificationMessage;
  } else if (classification.isHelp) {
    responseText = getHelpMessage();
  }
  // Comandos de modo (solo internos)
  else if (session.isInternal && /^modo\s+(interno|ventas)$/i.test(text)) {
    const newMode = text.toLowerCase().includes("ventas") ? "ventas" : "interno";
    await db.collection(COL_SESSIONS).doc(phoneNumber).update({ mode: newMode });
    responseText = `Modo cambiado a *${newMode}*.`;
  }
  // ============================================================
  // TODO LO DEMÁS → FUNCTION CALLING + AI
  // (también entra aquí si isGreeting=true pero el mensaje es largo)
  // ============================================================
  else {
    // Si el clasificador dijo greeting pero el mensaje es largo, usar funciones de fallback
    const functionsToExecute = classification.isGreeting && classification.functions.length === 0
      ? [{ name: "resumenDia" }, { name: "ventasDetalladas", params: { dias: "7" } }]
      : classification.functions;

    // Si no hay funciones clasificadas, usar fallback general
    const baseFunctions = functionsToExecute.length === 0
      ? [{ name: "resumenDia" }, { name: "ventasDetalladas", params: { dias: "7" } }]
      : functionsToExecute;

    // 3. Enriquecer con contexto 360° (agrega funciones complementarias automáticamente)
    const finalFunctions = enrichWithContext360(baseFunctions);

    // 4. Ejecutar funciones ERP en paralelo
    const erpData = await executeERPFunctions(finalFunctions);

    // 5. Obtener historial de conversación
    const history = await getConversationHistory(phoneNumber, 8);

    // 6. Determinar modo efectivo
    const effectiveMode: ChatMode =
      session.mode === "welcome" ? "interno" : session.mode;

    // 7. Gemini genera la respuesta con datos del ERP
    const aiResponse = await generateAIResponse(
      text,
      effectiveMode,
      history,
      erpData || undefined
    );

    responseText = aiResponse.text;
    aiModel = aiResponse.model;
    tokensUsed = aiResponse.tokensUsed;
  }

  // 7. Enviar respuesta por WhatsApp
  await enviarMensajeTexto(phoneNumber, responseText);

  // 8. Guardar en historial
  const processingTimeMs = Date.now() - startTime;
  const extras: Partial<WAMessage> = { processingTimeMs };
  if (tokensUsed) extras.tokensUsed = tokensUsed;
  if (aiModel) extras.aiModel = aiModel;

  await saveMessage(phoneNumber, text, responseText, session.mode, extras);
}
