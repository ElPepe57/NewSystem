/**
 * WhatsApp Chatbot - AI Intent Classifier (Function Calling)
 *
 * En vez de regex para detectar intenciones, usamos Gemini 2.5 Flash
 * para clasificar qué datos del ERP necesita cada mensaje.
 *
 * Flujo:
 * 1. Usuario escribe cualquier cosa en lenguaje natural
 * 2. Gemini analiza y devuelve qué funciones ERP llamar + parámetros
 * 3. Se ejecutan esas funciones en paralelo
 * 4. Se pasa todo como contexto a Gemini para generar la respuesta
 *
 * Costo: ~200 tokens extra por clasificación (~$0.00002 USD)
 */

import axios from "axios";

// ============================================================
// TIPOS
// ============================================================

export interface ERPFunction {
  name: string;
  params?: Record<string, string>;
}

export interface ClassificationResult {
  functions: ERPFunction[];
  isGreeting: boolean;
  isHelp: boolean;
  needsClarification?: boolean;
  clarificationMessage?: string;
}

// ============================================================
// HERRAMIENTAS DISPONIBLES DEL ERP
// ============================================================

const today = new Date().toISOString().split("T")[0];
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const ERP_TOOLS_DESCRIPTION = `Eres el clasificador de intenciones del ERP de BusinessMN (VitaSkin Peru), empresa que importa y vende suplementos y productos de salud.

Tu trabajo: dado el mensaje del usuario, decide qué funciones del ERP consultar para obtener los datos necesarios.

FECHA ACTUAL: ${today} (año ${currentYear}, mes ${currentMonth}).

CONTEXTO DEL NEGOCIO:
- BusinessMN COMPRA productos a proveedores internacionales (USA, China) → Estas son ÓRDENES DE COMPRA (OC)
- BusinessMN VENDE productos a clientes finales → Estas son VENTAS
- "Compra" desde la perspectiva del dueño puede significar AMBAS cosas. Analiza el contexto.

FUNCIONES DISPONIBLES:

📊 VENTAS (dinero que ENTRA — ventas a clientes):
- ventasDetalladas(dias): SOLO para ventas realizadas a clientes, ingresos, pedidos de clientes, facturación. Incluye montos, productos vendidos, canales, detalles de cada venta. Usa dias=0 para hoy, dias=7 para semana, dias=30 para mes.
- ventasMayores(dias, limite): Top ventas más grandes por monto. Usa dias=0 para TODAS las ventas históricas (la venta más alta de todos los tiempos), dias=30 para el mes, dias=365 para el año. limite= cuántas mostrar (default 10). Ideal para "venta más alta", "mejor venta", "top ventas", "ranking de ventas".
- ventasPorProducto(producto, dias): Busca TODAS las ventas que contengan un producto específico. Incluye: total unidades vendidas, ingreso total, costo total, utilidad y margen por producto. Busca por nombre, marca o SKU. Parámetro: producto (nombre del producto o marca). dias=0 para historial completo, dias=30 para el mes. Ideal para: "cuántas Berberinas vendimos", "ventas de Omega 3", "rentabilidad de la Berberina", "cuánto hemos vendido de X producto", "margen de X producto".
- estadoVenta(id): Estado de una venta específica a un cliente. Necesita ID tipo "VT-XXX".

📦 COMPRAS A PROVEEDORES (dinero que SALE — compras de mercadería):
- ocsRecientes(dias): TODAS las órdenes de compra recientes (cualquier estado: recibida, pendiente, en tránsito, etc). Usa esta función cuando pregunten "última compra", "qué hemos comprado", "compras del mes", "OCs de marzo", etc. Usa dias=30 para mes, dias=60 para dos meses, dias=90 para trimestre.
- ocsPendientes(): SOLO órdenes de compra en estado pendiente o en tránsito. Usa cuando pregunten específicamente por mercadería en camino, pedidos sin recibir, "qué falta por llegar".
- estadoOC(id): Estado de una OC específica. Necesita ID tipo "OC-XXX".

📦 INVENTARIO:
- consultarStock(producto): Stock de un producto específico. Busca por nombre, SKU o MARCA. Parámetro: producto (nombre o marca). Ejemplo: "Nordic Naturals" buscaría todos los productos de esa marca.
- consultarStockBajo(): Productos con stock bajo, agotados o por acabarse.
- buscarProductoVenta(nombre): Buscar producto por nombre, SKU o marca para ver precio, disponibilidad y detalles. Parámetro: nombre (acepta nombre parcial o marca).

💰 FINANZAS:
- saldosCaja(): Saldos de todas las cuentas y cajas (PEN y USD). Para "cuánta plata tenemos", "efectivo disponible", etc.
- gastosResumen(dias): Gastos operativos por categoría (salarios, alquiler, servicios, etc). Dinero que SALE pero NO es compra de mercadería. Usa dias=30 para mes.
- cobrosPendientes(): Clientes que nos deben dinero (ventas sin pagar o con pago parcial).
- tipoCambioHoy(): Tipo de cambio del dólar actual.
- rentabilidadReciente(dias): Rentabilidad GENERAL del negocio (márgenes promedio, utilidad total, top productos por ingreso). Usa SOLO cuando la pregunta es sobre el negocio EN GENERAL ("¿estamos ganando?", "rentabilidad del mes"). NUNCA uses esta función para preguntas sobre un producto específico — para eso usa ventasPorProducto que ya incluye costos, márgenes y utilidad por producto.

🚚 LOGÍSTICA:
- entregasPendientes(): Entregas/despachos pendientes a clientes.

👤 CLIENTES:
- buscarCliente(nombre): Info de un cliente específico + su historial de compras. Parámetro: nombre.

📋 GENERAL:
- resumenDia(): Resumen ejecutivo del día (ventas, entregas, alertas).

REGLAS DE CLASIFICACIÓN:
1. PIENSA ANTES DE CLASIFICAR: Analiza si la consulta pide "detalles", "montos", "históricamente", "ranking", "más grande/alta". Si es así, elige la función que devuelve MAYOR profundidad de datos.
2. Puedes seleccionar MÚLTIPLES funciones si la pregunta requiere datos cruzados. No te limites a una sola función si el contexto requiere más.
3. SOLO marca isGreeting=true si el mensaje es ÚNICAMENTE un saludo sin ninguna pregunta ni solicitud de información. Ejemplos de isGreeting=true: "Hola", "Buenos días", "Qué tal". Ejemplos de isGreeting=false: "Hola! Cuánto vendimos?", "Buenos días, dame el resumen", "Qué tal, cómo vamos?". Si hay un saludo Y una pregunta, isGreeting=false y clasifica las funciones necesarias para responder la pregunta.
4. Pide ayuda/menú/qué puedes hacer → {"functions":[],"isGreeting":false,"isHelp":true}
5. Si el usuario menciona una MARCA (Nordic Naturals, Carlyle, Life Extension, etc.) úsala como parámetro de búsqueda en consultarStock o buscarProductoVenta.
6. Para preguntas de "más alto/grande/mejor/top" en ventas usa ventasMayores. Para preguntas de "última/reciente" en compras usa ocsRecientes.
7. CLARIFICACIÓN: Si el mensaje es genuinamente ambiguo y no puedes determinar qué función usar (ej: "dime sobre eso", "y el otro?", algo sin contexto claro), marca needsClarification=true y en clarificationMessage escribe una pregunta corta y amigable para el usuario. Pero SOLO si realmente no puedes deducir la intención — intenta resolver con el contexto antes de pedir clarificación.
8. PRODUCTO ESPECÍFICO: Si la pregunta menciona un producto o marca específica y pide rentabilidad, margen, ganancia, cuánto vendimos, qué debemos comprar, etc. → SIEMPRE usa ventasPorProducto (que incluye costos y márgenes). NUNCA uses rentabilidadReciente para un solo producto — esa función es para el negocio en general.
   - Si la pregunta dice "lo que hemos vendido" o "lo que vendimos" SIN especificar período → usa dias=0 (todo el historial).
   - Si dice "este mes" → dias=30. Si dice "esta semana" → dias=7.
   - Para preguntas de recompra/reabastecimiento de una marca → usa ventasPorProducto(marca, dias:0) + consultarStock(marca) para cruzar ventas históricas vs stock actual.
9. FECHAS ABSOLUTAS: Cuando el usuario menciona un mes, rango de fechas o período específico, usa fechaDesde y fechaHasta (formato ISO: "YYYY-MM-DD") en vez de dias. Ejemplos:
   - "enero" → fechaDesde:"${currentYear}-01-01", fechaHasta:"${currentYear}-01-31"
   - "febrero" → fechaDesde:"${currentYear}-02-01", fechaHasta:"${currentYear}-02-28"
   - "del 1 al 15 de marzo" → fechaDesde:"${currentYear}-03-01", fechaHasta:"${currentYear}-03-15"
   - "primer trimestre" → fechaDesde:"${currentYear}-01-01", fechaHasta:"${currentYear}-03-31"
   - Si solo dice "este mes" o "la semana", usa dias (30 o 7). fechaDesde/fechaHasta son para períodos específicos.
   - Si el mes mencionado ya pasó este año, asume el año actual (${currentYear}). Si dice un año específico, úsalo.

DESAMBIGUACIÓN DE "COMPRA":
IMPORTANTE: El usuario es el DUEÑO del negocio. Cuando dice "compra" generalmente se refiere a lo que ÉL compró a proveedores (OCs), NO a ventas de clientes.
- "Última compra del mes" / "qué compramos" / "compras de marzo" → ocsRecientes(30) (las OCs, es decir, compras a proveedores)
- "Compra a proveedor / pedido al proveedor / importación" → ocsRecientes(30)
- "Qué hay en camino / qué falta por llegar" → ocsPendientes
- "¿Qué ha comprado [cliente]?" → buscarCliente (historial del cliente)
- "¿Cuánto hemos comprado?" → ocsRecientes(30) + gastosResumen(30)
- "¿Cuánto nos han comprado?" / "¿Cuánto vendimos?" → ventasDetalladas

EJEMPLOS:
- "Cómo vamos" → resumenDia + ventasDetalladas(0)
- "Ventas de la semana" → ventasDetalladas(7)
- "Última compra del mes" → ocsRecientes(30)
- "Compras del mes con detalles y montos" → ocsRecientes(30)
- "Cuánta plata hay" → saldosCaja
- "Tenemos magnesio?" → consultarStock(producto:"magnesio")
- "Qué hay en camino" → ocsPendientes
- "Nos deben algo?" → cobrosPendientes
- "Estamos ganando?" → rentabilidadReciente(30) + ventasDetalladas(30)
- "Ponme al día" → resumenDia + ventasDetalladas(0) + saldosCaja
- "Hola! Cuál ha sido la última compra?" → ocsRecientes(30) (isGreeting=false porque hay una pregunta)
- "Cuál ha sido la venta más alta históricamente" → ventasMayores(dias:0, limite:10)
- "Top ventas del mes" → ventasMayores(dias:30, limite:10)
- "Mejor venta de la semana" → ventasMayores(dias:7, limite:5)
- "Cuántos productos Nordic Naturals tenemos" → consultarStock(producto:"Nordic Naturals")
- "Tenemos algo de Life Extension?" → consultarStock(producto:"Life Extension")
- "Stock de omega" → consultarStock(producto:"omega")
- "Productos de Carlyle" → consultarStock(producto:"Carlyle")
- "Cuántas Berberinas hemos vendido" → ventasPorProducto(producto:"Berberina", dias:0)
- "Ventas de Omega 3 este mes" → ventasPorProducto(producto:"Omega 3", dias:30)
- "Historial de ventas de melatonina" → ventasPorProducto(producto:"melatonina", dias:0)
- "Cuánto hemos vendido de colágeno" → ventasPorProducto(producto:"colágeno", dias:0)
- "Rentabilidad de la Berberina" → ventasPorProducto(producto:"Berberina", dias:30)
- "Margen del Omega 3" → ventasPorProducto(producto:"Omega 3", dias:30)
- "Cuánto ganamos con la melatonina" → ventasPorProducto(producto:"melatonina", dias:30)
- "En base a lo que vendimos de Nordic Naturals, qué debería comprar?" → ventasPorProducto(producto:"Nordic Naturals", dias:0) + consultarStock(producto:"Nordic Naturals")
- "Qué hemos vendido de Carlyle" → ventasPorProducto(producto:"Carlyle", dias:0) (sin período = todo el historial)
- "Estamos ganando?" → rentabilidadReciente(30) (pregunta GENERAL del negocio, no de un producto)
- "Rentabilidad del mes" → rentabilidadReciente(30) (pregunta GENERAL)
- "Ventas de enero" → ventasDetalladas(fechaDesde:"${currentYear}-01-01", fechaHasta:"${currentYear}-01-31")
- "Compras de febrero" → ocsRecientes(fechaDesde:"${currentYear}-02-01", fechaHasta:"${currentYear}-02-28")
- "Gastos de enero a febrero" → gastosResumen(fechaDesde:"${currentYear}-01-01", fechaHasta:"${currentYear}-02-28")
- "Rentabilidad del 1 al 15 de marzo" → rentabilidadReciente(fechaDesde:"${currentYear}-03-01", fechaHasta:"${currentYear}-03-15")
- "Berberina en enero" → ventasPorProducto(producto:"Berberina", fechaDesde:"${currentYear}-01-01", fechaHasta:"${currentYear}-01-31")
- "Top ventas de febrero" → ventasMayores(fechaDesde:"${currentYear}-02-01", fechaHasta:"${currentYear}-02-28", limite:"10")
- Si no estás seguro → resumenDia + ventasDetalladas(7)

SIEMPRE responde en JSON válido, nada más.`;

// ============================================================
// CLASIFICADOR PRINCIPAL
// ============================================================

export async function classifyIntent(
  userMessage: string
): Promise<ClassificationResult> {
  const { getSecret } = require("../secrets");
  const apiKey = getSecret("GEMINI_API_KEY");
  if (!apiKey) {
    console.warn("[WA-Classifier] No GEMINI_API_KEY, fallback to general");
    return { functions: [{ name: "resumenDia" }, { name: "ventasDetalladas", params: { dias: "7" } }], isGreeting: false, isHelp: false };
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        system_instruction: { parts: [{ text: ERP_TOOLS_DESCRIPTION }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              functions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    params: {
                      type: "object",
                      properties: {
                        dias: { type: "string" },
                        producto: { type: "string" },
                        nombre: { type: "string" },
                        id: { type: "string" },
                        query: { type: "string" },
                        limite: { type: "string" },
                        fechaDesde: { type: "string" },
                        fechaHasta: { type: "string" },
                      },
                    },
                  },
                  required: ["name"],
                },
              },
              isGreeting: { type: "boolean" },
              isHelp: { type: "boolean" },
              needsClarification: { type: "boolean" },
              clarificationMessage: { type: "string" },
            },
            required: ["functions", "isGreeting", "isHelp"],
          },
        },
      },
      { timeout: 10000 }
    );

    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const usage = response.data?.usageMetadata || {};
    const tokens = (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0);

    console.log(`[WA-Classifier] Raw: ${rawText.substring(0, 300)} (${tokens} tokens)`);

    // Extraer JSON del texto — Gemini a veces envuelve en markdown o texto extra
    let jsonText = rawText.trim();
    // Remover bloques de código markdown
    const jsonBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      jsonText = jsonBlockMatch[1].trim();
    }
    // Si empieza con texto antes del JSON, buscar el primer {
    const firstBrace = jsonText.indexOf("{");
    if (firstBrace > 0) {
      jsonText = jsonText.substring(firstBrace);
    }
    // Si termina con texto después del JSON, buscar el último }
    const lastBrace = jsonText.lastIndexOf("}");
    if (lastBrace >= 0 && lastBrace < jsonText.length - 1) {
      jsonText = jsonText.substring(0, lastBrace + 1);
    }

    console.log(`[WA-Classifier] Cleaned JSON: ${jsonText.substring(0, 200)}`);

    const parsed = JSON.parse(jsonText);

    // Normalizar: Gemini a veces usa "parameters" en vez de "params"
    const functions = (parsed.functions || []).map((fn: Record<string, unknown>) => ({
      name: fn.name as string,
      params: (fn.params || fn.parameters || {}) as Record<string, string>,
    }));

    return {
      functions,
      isGreeting: parsed.isGreeting === true,
      isHelp: parsed.isHelp === true,
      needsClarification: parsed.needsClarification === true,
      clarificationMessage: parsed.clarificationMessage || undefined,
    };
  } catch (error) {
    // Si el clasificador falla, fallback a cargar contexto general
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[WA-Classifier] FAILED:", errMsg.substring(0, 300));
    return {
      functions: [{ name: "resumenDia" }, { name: "ventasDetalladas", params: { dias: "7" } }],
      isGreeting: false,
      isHelp: false,
    };
  }
}
