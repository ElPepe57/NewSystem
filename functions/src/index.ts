/**
 * BMN System - Cloud Functions
 *
 * Funciones serverless para automatización:
 * 1. Generar unidades de inventario al recibir OC
 * 2. Obtener tipo de cambio automático diario
 * 3. Recálculo de CTRU cuando se registran gastos
 * 4. Integración Mercado Libre (OAuth, webhooks, sync)
 * 5. WhatsApp Chatbot (consultas internas, ventas, welcome)
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { COLLECTIONS } from "./collections";

// Inicializar Firebase Admin ANTES de cualquier import que use admin
admin.initializeApp();

// ============================================================
// MERCADO LIBRE - Integración completa
// ============================================================
export {
  mlauthcallback,
  mlwebhook,
  mlrefreshtoken,
  mlgetauthurl,
  mlgetstatus,
  mlsyncitems,
  mlgetquestions,
  mlanswerquestion,
  mlvinculateproduct,
  mldesvincularproduct,
  mlsyncstock,
  mlupdateprice,
  mlprocesarorden,
  mlprocesarpendientes,
  mlregisterwebhook,
  mlgetwebhookstatus,
  mlimporthistoricalorders,
  mlreenrichbuyers,
  mlrepararventasurbano,
  mlrepararnamesdni,
  mldiagshipping,
  mlpatchenvio,
  mlfixventashistoricas,
  mlmigratestockpendiente,
  mlsyncbuybox,
  mlconsolidatepackorders,
  mldiagnosticosistema,
  mlrecalcularbalancemp,
  mlreingenieria,
  mlmatchsuggestions,
  mlconfirmmatch,
  mldiaginconsistencias,
  mlresolverinconsistencias,
  mlrepairgastosml,
  mlrepairmetodoenvio,
  mlautocreateventas,
  mldisconnect,
} from "./mercadolibre";

// ============================================================
// WHATSAPP CHATBOT - Consultas internas, ventas, welcome
// ============================================================
export {
  wawebhook,
  wasetconfig,
  wasendmessage,
} from "./whatsapp";

const db = admin.firestore();

// ============================================================
// FUNCIÓN 1: Generar unidades al cambiar OC a "recibida"
// ============================================================

/**
 * FUNCIÓN 1: Generar unidades al recibir OC en origen
 *
 * FLUJO CORRECTO según el modelo de negocio:
 * 1. OC se marca como "recibida" (en almacén/viajero de origen: USA, China, Corea, etc.)
 * 2. Se generan unidades con estado "recibida_origen"
 * 3. Posteriormente se crea una Transferencia Origen → Perú
 * 4. Al recibir en Perú, las unidades pasan a "disponible_peru"
 */
export const onOrdenCompraRecibida = functions.firestore
  .document("ordenesCompra/{ordenId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Solo procesar si cambió a estado "recibida" y no se han generado unidades
    if (
      before.estado !== "recibida" &&
      after.estado === "recibida" &&
      !after.inventarioGenerado
    ) {
      const ordenId = context.params.ordenId;

      functions.logger.info(`Generando unidades para OC ${after.numeroOrden}`, {
        ordenId,
      });

      try {
        const unidadesGeneradas: string[] = [];
        let unidadCount = 1;

        // Obtener TC de pago para calcular costos
        const tcCompra = after.tcCompra || 3.7;
        const tcPago = after.tcPago || tcCompra;

        // Obtener datos del almacén/viajero destino
        const almacenDestinoId = after.almacenDestinoId;
        let almacenNombre = "Almacén Origen";
        let almacenCodigo = "ORIGEN";
        let almacenPais = after.paisOrigen || "USA"; // Leer país de la OC o default USA

        if (almacenDestinoId) {
          const almacenSnap = await db.collection(COLLECTIONS.ALMACENES).doc(almacenDestinoId).get();
          if (almacenSnap.exists) {
            const almacenData = almacenSnap.data();
            almacenNombre = almacenData?.nombre || almacenNombre;
            almacenCodigo = almacenData?.codigo || almacenCodigo;
            almacenPais = almacenData?.pais || almacenPais;
          }
        }

        // ARCH-001 FIX: Preparar todas las operaciones antes de hacer batches
        // ARCH-002 FIX: Chunking de batches (máx 450 ops por batch, margen sobre 500)
        const MAX_OPS_PER_BATCH = 450;

        interface UnidadOp {
          ref: FirebaseFirestore.DocumentReference;
          data: Record<string, unknown>;
        }
        const unidadOps: UnidadOp[] = [];

        // Generar operaciones para cada producto
        for (const producto of after.productos) {
          // Obtener el costo de flete fijo del producto
          let costoFleteUSD = 0;
          const productoSnap = await db.collection(COLLECTIONS.PRODUCTOS).doc(producto.productoId).get();
          if (productoSnap.exists) {
            const productoData = productoSnap.data();
            costoFleteUSD = productoData?.costoFleteInternacional ?? productoData?.costoFleteUSAPeru ?? 0;
          }

          for (let i = 0; i < producto.cantidad; i++) {
            const unidadRef = db.collection(COLLECTIONS.UNIDADES).doc();
            const codigoUnidad = `${after.numeroOrden}-${String(
              unidadCount
            ).padStart(3, "0")}`;

            // Calcular costos
            const costoUnitarioUSD = producto.costoUnitario;
            const costoTotalUSD = costoUnitarioUSD + costoFleteUSD;

            // El CTRU se calculará al llegar a Perú, por ahora solo base
            const ctruInicial = costoTotalUSD * tcPago;

            // ARCH-001 FIX: Campos alineados con unidad.types.ts (Unidad interface)
            const unidadData = {
              // Identificación — nombres según interface Unidad
              productoId: producto.productoId,
              productoSKU: producto.sku,              // FIX: era 'sku'
              productoNombre: producto.nombre || producto.sku,
              numeroUnidad: unidadCount,
              codigoUnidad,
              lote: producto.lote || null,
              fechaVencimiento: producto.fechaVencimiento || null,

              // Trazabilidad — nombres según interface Unidad
              ordenCompraId: ordenId,
              ordenCompraNumero: after.numeroOrden,    // FIX: era 'numeroOrden'
              proveedorId: after.proveedorId,

              // Estado
              estado: "recibida_origen",
              pais: almacenPais,                       // FIX: era 'paisActual'
              paisOrigen: almacenPais,                 // Campo adicional del tipo

              // Ubicación — nombres según interface Unidad
              almacenId: almacenDestinoId || null,     // FIX: era 'almacenActualId'
              almacenNombre: almacenNombre,            // FIX: era 'almacenActualNombre'
              almacenCodigo: almacenCodigo,            // Extra: mantener para referencia

              // Costos
              costoUnitarioUSD,
              costoFleteUSD,
              costoTotalUSD,
              tcCompra,
              tcPago,

              // CTRU v2 — nombres según interface Unidad
              ctruInicial,
              ctruDinamico: ctruInicial,
              ctruContable: ctruInicial,
              ctruGerencial: ctruInicial,
              costoGAGOAsignado: 0,
              costoGAAsignado: 0,
              costoGOAsignado: 0,
              costoRecojoPEN: 0,

              // Fechas — nombres según interface Unidad
              fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
              fechaRecepcion: admin.firestore.FieldValue.serverTimestamp(),  // FIX: era 'fechaRecepcionOrigen'

              // Movimientos — nombre según interface Unidad
              movimientos: [{                          // FIX: era 'historial'
                id: `mov-${Date.now()}-${unidadCount}`,
                tipo: "recepcion",                     // FIX: era 'recepcion_origen', ahora es TipoMovimiento
                fecha: admin.firestore.FieldValue.serverTimestamp(),
                almacenDestino: almacenDestinoId || null,
                usuarioId: after.creadoPor || "system",
                observaciones: `Recepción de OC ${after.numeroOrden} en almacén ${almacenPais}`,
                documentoRelacionado: {
                  tipo: "orden-compra",
                  id: ordenId,
                  numero: after.numeroOrden,
                },
              }],

              // Auditoría
              creadoPor: after.creadoPor || "system",
            };

            unidadOps.push({ ref: unidadRef, data: unidadData });
            unidadesGeneradas.push(unidadRef.id);
            unidadCount++;
          }
        }

        // ARCH-002 FIX: Ejecutar en chunks de 450 operaciones
        // Cada unidad = 1 op (set), + 2 ops extra al final (update OC + update almacén)
        const extraOps = almacenDestinoId ? 2 : 1;
        const chunks: UnidadOp[][] = [];
        for (let i = 0; i < unidadOps.length; i += MAX_OPS_PER_BATCH - extraOps) {
          chunks.push(unidadOps.slice(i, i + MAX_OPS_PER_BATCH - extraOps));
        }

        // Si no hay unidades, aún necesitamos un batch para las operaciones extra
        if (chunks.length === 0) {
          chunks.push([]);
        }

        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
          const batch = db.batch();
          const chunk = chunks[chunkIdx];

          // Agregar unidades de este chunk
          for (const op of chunk) {
            batch.set(op.ref, op.data);
          }

          // Solo en el último batch: actualizar OC y almacén
          if (chunkIdx === chunks.length - 1) {
            const ordenRef = db.collection(COLLECTIONS.ORDENES_COMPRA).doc(ordenId);
            batch.update(ordenRef, {
              inventarioGenerado: true,
              unidadesGeneradas,
              fechaGeneracionInventario:
                admin.firestore.FieldValue.serverTimestamp(),
            });

            if (almacenDestinoId) {
              const almacenRef = db.collection(COLLECTIONS.ALMACENES).doc(almacenDestinoId);
              batch.update(almacenRef, {
                totalUnidadesRecibidas: admin.firestore.FieldValue.increment(unidadesGeneradas.length),
                unidadesActuales: admin.firestore.FieldValue.increment(unidadesGeneradas.length),
              });
            }
          }

          await batch.commit();
          functions.logger.info(
            `Batch ${chunkIdx + 1}/${chunks.length}: ${chunk.length} unidades committed`
          );
        }

        functions.logger.info(
          `✅ Generadas ${unidadesGeneradas.length} unidades en ${almacenPais} para OC ${after.numeroOrden}`
        );

        return { success: true, unidadesGeneradas: unidadesGeneradas.length };
      } catch (error) {
        functions.logger.error("Error generando unidades:", error);
        throw new functions.https.HttpsError(
          "internal",
          "Error generando unidades de inventario"
        );
      }
    }

    return null;
  });

// ============================================================
// FUNCIÓN 2: Obtener Tipo de Cambio Automático (Dual: Paralelo + SUNAT)
// Decisión 11: TC Paralelo (cuantoestaeldolar.pe) como fuente principal,
//              TC SUNAT como fuente contable. Scraping + backup ExchangeRate-API.
// ============================================================

import axios from "axios";
import { invalidarCache } from "./tipoCambio.util";

// Constantes de validación para USD/PEN
const TC_MIN = 2.50;
const TC_MAX = 5.50;
const MAX_SPREAD = 0.02; // 2% máximo entre compra y venta
const SCRAPER_TIMEOUT_MS = 15000;
const API_TIMEOUT_MS = 10000;
const EXCHANGE_RATE_SPREAD_FACTOR = 0.002; // 0.2% en cada lado = ~0.4% total
const TC_DECIMAL_PRECISION = 1000; // 3 decimales

interface TCDual {
  paralelo: { compra: number; venta: number } | null;
  sunat: { compra: number; venta: number } | null;
}

/**
 * Extrae un par compra/venta de TC del HTML scrapeado.
 * Busca la etiqueta seguida de dos números decimales, con límite de distancia
 * para no cruzar secciones del HTML y capturar valores de otra fuente.
 */
function extraerParTC(
  html: string,
  etiqueta: string
): { compra: number; venta: number } | null {
  const pattern = new RegExp(
    `${etiqueta}[\\s\\S]{0,500}?(\\d+\\.\\d{2,3})[\\s\\S]{0,100}?(\\d+\\.\\d{2,3})`,
    "i" // case-insensitive: match tanto "Sunat" como "SUNAT"
  );
  const match = html.match(pattern);
  if (!match) return null;

  const val1 = parseFloat(match[1]);
  const val2 = parseFloat(match[2]);

  // Validar rango realista USD/PEN
  if (val1 < TC_MIN || val1 > TC_MAX || val2 < TC_MIN || val2 > TC_MAX) {
    functions.logger.warn(`[TC-Scraper] ${etiqueta}: valores fuera de rango (${val1}, ${val2})`);
    return null;
  }

  const compra = Math.min(val1, val2);
  const venta = Math.max(val1, val2);

  // Validar spread razonable
  const spread = (venta - compra) / compra;
  if (spread > MAX_SPREAD) {
    functions.logger.warn(
      `[TC-Scraper] ${etiqueta}: spread inusual ${(spread * 100).toFixed(2)}% — posible captura cruzada`
    );
    return null;
  }

  return { compra, venta };
}

/**
 * Scrapea cuantoestaeldolar.pe para obtener TC Paralelo y SUNAT.
 * La página es Next.js SSR — los datos vienen embebidos en el HTML.
 */
async function scrapearCuantoEstaElDolar(): Promise<TCDual> {
  const result: TCDual = { paralelo: null, sunat: null };

  try {
    const response = await axios.get("https://cuantoestaeldolar.pe/", {
      timeout: SCRAPER_TIMEOUT_MS,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html",
      },
    });

    const html: string = response.data;
    result.paralelo = extraerParTC(html, "Paralelo");
    result.sunat = extraerParTC(html, "Sunat");

    functions.logger.debug("[TC-Scraper] Resultado:", JSON.stringify(result));
  } catch (error) {
    functions.logger.warn("[TC-Scraper] Error scrapeando cuantoestaeldolar.pe:", error);
  }

  return result;
}

/**
 * Backup: ExchangeRate-API (mid-market rate gratuito)
 */
async function obtenerTCBackup(): Promise<{ compra: number; venta: number } | null> {
  try {
    const response = await axios.get(
      "https://api.exchangerate-api.com/v4/latest/USD",
      { timeout: API_TIMEOUT_MS }
    );

    if (response.data?.rates?.PEN) {
      const midRate = response.data.rates.PEN;

      // Validar rango realista
      if (midRate < TC_MIN || midRate > TC_MAX) {
        functions.logger.warn(`[TC-Backup] Valor fuera de rango: ${midRate}`);
        return null;
      }

      return {
        compra: Math.round(midRate * (1 - EXCHANGE_RATE_SPREAD_FACTOR) * TC_DECIMAL_PRECISION) / TC_DECIMAL_PRECISION,
        venta: Math.round(midRate * (1 + EXCHANGE_RATE_SPREAD_FACTOR) * TC_DECIMAL_PRECISION) / TC_DECIMAL_PRECISION,
      };
    }
    return null;
  } catch (error) {
    functions.logger.warn("[TC-Backup] Error en ExchangeRate-API:", error);
    return null;
  }
}

/**
 * Convierte Date a string YYYY-MM-DD en zona horaria Lima.
 * Cloud Functions corren en UTC — sin esto, llamadas nocturnas (>7PM Lima)
 * guardarían el TC bajo la fecha del día siguiente.
 */
function fechaLimaStr(date: Date): string {
  const lima = new Date(date.toLocaleString("en-US", { timeZone: "America/Lima" }));
  return lima.getFullYear() + "-" +
    String(lima.getMonth() + 1).padStart(2, "0") + "-" +
    String(lima.getDate()).padStart(2, "0");
}

/**
 * Lógica central: obtener TC dual y guardar en Firestore.
 * Flujo: scraping cuantoestaeldolar.pe → backup ExchangeRate-API → falla
 *
 * Protección: si ya existe un TC manual para el día, no sobreescribe la raíz
 * (pero sí actualiza el campo sunat anidado si lo obtiene).
 */
async function obtenerYGuardarTC(esAutomatico: boolean): Promise<{
  success: boolean;
  paralelo?: { compra: number; venta: number };
  sunat?: { compra: number; venta: number };
  error?: string;
}> {
  const hoy = new Date();
  const fechaStr = fechaLimaStr(hoy);

  // [1] Scraping cuantoestaeldolar.pe
  const tcDual = await scrapearCuantoEstaElDolar();

  // [2] Si no tenemos paralelo, intentar backup
  let paraleloFinal = tcDual.paralelo;
  if (!paraleloFinal) {
    functions.logger.info("[TC] Paralelo no disponible, intentando backup...");
    paraleloFinal = await obtenerTCBackup();
  }

  // [3] Si no tenemos nada, fallar
  if (!paraleloFinal) {
    functions.logger.error("[TC] Ninguna fuente de TC disponible");
    return { success: false, error: "Ninguna fuente de TC disponible" };
  }

  // [4] Verificar si existe un TC manual que no debemos sobreescribir
  const tcRef = db.collection(COLLECTIONS.TIPOS_CAMBIO).doc(fechaStr);
  const existente = await tcRef.get();

  if (existente.exists && existente.data()?.fuente === "manual") {
    // TC manual del admin: NO tocar la raíz, solo actualizar sunat si lo tenemos
    functions.logger.info(`[TC] TC manual existe para ${fechaStr} — protegiendo raíz`);

    const updateData: Record<string, unknown> = {};
    if (tcDual.sunat) {
      updateData.sunat = tcDual.sunat;
      updateData.sunatDisponible = true;
    }
    if (Object.keys(updateData).length > 0) {
      await tcRef.update(updateData);
      functions.logger.info(`[TC] Campo sunat actualizado en TC manual de ${fechaStr}`);
    }

    invalidarCache();
    return {
      success: true,
      paralelo: paraleloFinal,
      sunat: tcDual.sunat ?? undefined,
    };
  }

  // [5] Guardar en Firestore con estructura dual
  // compra/venta raíz = paralelo (fuente principal para operaciones)
  const tcData: Record<string, unknown> = {
    fecha: admin.firestore.Timestamp.fromDate(hoy),
    compra: paraleloFinal.compra,
    venta: paraleloFinal.venta,
    promedio: (paraleloFinal.compra + paraleloFinal.venta) / 2,
    fuente: tcDual.paralelo ? "paralelo" : "exchangerate-api",
    paralelo: paraleloFinal,
    fechaObtencion: admin.firestore.FieldValue.serverTimestamp(),
    esAutomatico,
  };

  if (tcDual.sunat) {
    tcData.sunat = tcDual.sunat;
    tcData.sunatDisponible = true;
  } else {
    tcData.sunatDisponible = false;
    functions.logger.warn(
      "[TC] SUNAT no disponible — contabilidad usará TC paralelo como fallback"
    );
  }

  await tcRef.set(tcData, { merge: true });

  // Invalidar cache del resolver para que use el nuevo TC
  invalidarCache();

  functions.logger.info(
    `✅ TC guardado [${fechaStr}]: Paralelo ${paraleloFinal.compra}/${paraleloFinal.venta}` +
    (tcDual.sunat ? ` | SUNAT ${tcDual.sunat.compra}/${tcDual.sunat.venta}` : " | SUNAT no disponible")
  );

  return {
    success: true,
    paralelo: paraleloFinal,
    sunat: tcDual.sunat ?? undefined,
  };
}

/**
 * Función programada: Obtiene TC a las 9:00 AM (hora Perú), todos los días
 */
export const obtenerTipoCambioDiario = functions.pubsub
  .schedule("0 9 * * *")
  .timeZone("America/Lima")
  .onRun(async () => {
    functions.logger.info("[TC-Cron] Ejecución 9:00 AM");
    return obtenerYGuardarTC(true);
  });

/**
 * Función programada: Actualización de TC a las 2:00 PM (hora Perú), todos los días
 */
export const actualizarTipoCambioTarde = functions.pubsub
  .schedule("0 14 * * *")
  .timeZone("America/Lima")
  .onRun(async () => {
    functions.logger.info("[TC-Cron] Ejecución 2:00 PM");
    return obtenerYGuardarTC(true);
  });

/**
 * Función HTTP para obtener TC manualmente (callable desde frontend)
 * Requiere autenticación y rol admin/gerente.
 */
export const obtenerTipoCambioManual = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Debe estar autenticado para actualizar el tipo de cambio"
    );
  }

  // Verificar rol
  const userDoc = await db.collection(COLLECTIONS.USERS).doc(context.auth.uid).get();
  const role = userDoc.data()?.role;
  if (!["admin", "gerente"].includes(role)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo admin o gerente pueden actualizar el tipo de cambio"
    );
  }

  try {
    const resultado = await obtenerYGuardarTC(false);
    if (resultado.success) {
      return resultado;
    }
    throw new functions.https.HttpsError(
      "unavailable",
      resultado.error || "No se pudo obtener el tipo de cambio"
    );
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    functions.logger.error("[TC-Manual] Error:", error);
    throw new functions.https.HttpsError("internal", "Error obteniendo TC");
  }
});

// ============================================================
// FUNCIÓN 3: Recalcular CTRU al registrar gasto prorrateable
// ============================================================

/**
 * onGastoCreado — CTRU v2
 *
 * Ya NO hace recálculo incremental de CTRU en unidades.
 * Solo marca el gasto como pendiente de recálculo.
 * El recálculo completo (full-recalc con dual-view contable/gerencial)
 * se ejecuta desde el frontend via ctruService.recalcularCTRUDinamicoSafe().
 *
 * Razón del cambio:
 * - El recálculo incremental de la CF usaba modelo diferente al frontend
 * - La CF distribuía por partes iguales; el frontend proporcional al costo base
 * - Ambos escribían ctruDinamico con valores diferentes → datos corruptos
 * - El modelo CTRU v2 requiere dual-view (contable + gerencial) que solo el frontend calcula
 */
export const onGastoCreado = functions.firestore
  .document("gastos/{gastoId}")
  .onCreate(async (snapshot, context) => {
    const gasto = snapshot.data();

    // Solo procesar gastos prorrateables que impactan CTRU
    if (!gasto.esProrrateable || !gasto.impactaCTRU) {
      return null;
    }

    const gastoId = context.params.gastoId;
    functions.logger.info(`Gasto prorrateable registrado: ${gasto.numeroGasto || gastoId}`, {
      gastoId,
      categoria: gasto.categoria,
      montoPEN: gasto.montoPEN,
    });

    try {
      // Marcar el gasto como pendiente de recálculo (el frontend lo procesará)
      await snapshot.ref.update({
        ctruRecalculado: false,
        ctruPendienteRecalculo: true,
        fechaRegistro: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Registrar en historial que hay un gasto pendiente
      await db.collection(COLLECTIONS.HISTORIAL_CTRU).add({
        gastoId,
        numeroGasto: gasto.numeroGasto || '',
        montoGasto: gasto.montoPEN,
        tipo: 'gasto_pendiente_recalculo',
        categoria: gasto.categoria,
        fechaRegistro: admin.firestore.FieldValue.serverTimestamp(),
        ejecutadoPor: "system",
        nota: "CTRU v2: recálculo delegado al frontend (dual-view contable/gerencial)",
      });

      functions.logger.info(
        `✅ Gasto ${gasto.numeroGasto || gastoId} marcado como pendiente de recálculo CTRU`
      );

      return { success: true, pendienteRecalculo: true };
    } catch (error) {
      functions.logger.error("Error procesando gasto para CTRU:", error);
      return null; // No lanzar error — el gasto ya se creó correctamente
    }
  });

// ============================================================
// FUNCIÓN 4: Limpiar caché y estadísticas diarias (opcional)
// ============================================================

// limpiezaDiaria: deshabilitada (era un no-op que generaba invocaciones diarias sin hacer nada)
// Reactivar cuando se implementen tareas reales de mantenimiento.

// ============================================================
// FUNCIÓN 5: Gestión de Usuarios (Admin Only)
// ============================================================

/**
 * Permisos disponibles en el sistema (30 permisos granulares)
 * MIRROR de src/types/auth.types.ts - mantener sincronizado
 */
const PERMISOS = {
  // General
  VER_DASHBOARD: "ver_dashboard",
  // Ventas
  VER_VENTAS: "ver_ventas",
  CREAR_VENTA: "crear_venta",
  EDITAR_VENTA: "editar_venta",
  CONFIRMAR_VENTA: "confirmar_venta",
  CANCELAR_VENTA: "cancelar_venta",
  // Cotizaciones
  VER_COTIZACIONES: "ver_cotizaciones",
  CREAR_COTIZACION: "crear_cotizacion",
  VALIDAR_COTIZACION: "validar_cotizacion",
  // Entregas
  VER_ENTREGAS: "ver_entregas",
  PROGRAMAR_ENTREGA: "programar_entrega",
  REGISTRAR_ENTREGA: "registrar_entrega",
  // Compras
  VER_REQUERIMIENTOS: "ver_requerimientos",
  CREAR_REQUERIMIENTO: "crear_requerimiento",
  APROBAR_REQUERIMIENTO: "aprobar_requerimiento",
  VER_ORDENES_COMPRA: "ver_ordenes_compra",
  CREAR_OC: "crear_oc",
  RECIBIR_OC: "recibir_oc",
  // Inventario
  VER_INVENTARIO: "ver_inventario",
  GESTIONAR_INVENTARIO: "gestionar_inventario",
  TRANSFERIR_UNIDADES: "transferir_unidades",
  // Finanzas
  VER_GASTOS: "ver_gastos",
  CREAR_GASTO: "crear_gasto",
  VER_TESORERIA: "ver_tesoreria",
  GESTIONAR_TESORERIA: "gestionar_tesoreria",
  VER_REPORTES: "ver_reportes",
  VER_CTRU: "ver_ctru",
  // Administración
  GESTIONAR_USUARIOS: "gestionar_usuarios",
  GESTIONAR_CONFIGURACION: "gestionar_configuracion",
  VER_AUDITORIA: "ver_auditoria",
  ADMIN_TOTAL: "admin_total",
};

/**
 * Roles predefinidos con sus permisos (8 roles)
 * MIRROR de src/types/auth.types.ts - mantener sincronizado
 */
const ROLES_PERMISOS: Record<string, string[]> = {
  admin: Object.values(PERMISOS),
  gerente: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS, PERMISOS.CREAR_VENTA, PERMISOS.EDITAR_VENTA,
    PERMISOS.CONFIRMAR_VENTA, PERMISOS.CANCELAR_VENTA,
    PERMISOS.VER_COTIZACIONES, PERMISOS.CREAR_COTIZACION, PERMISOS.VALIDAR_COTIZACION,
    PERMISOS.VER_ENTREGAS, PERMISOS.PROGRAMAR_ENTREGA, PERMISOS.REGISTRAR_ENTREGA,
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO, PERMISOS.APROBAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA, PERMISOS.CREAR_OC, PERMISOS.RECIBIR_OC,
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    PERMISOS.VER_GASTOS, PERMISOS.CREAR_GASTO,
    PERMISOS.VER_TESORERIA, PERMISOS.GESTIONAR_TESORERIA,
    PERMISOS.VER_REPORTES, PERMISOS.VER_CTRU,
    PERMISOS.VER_AUDITORIA,
  ],
  vendedor: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS, PERMISOS.CREAR_VENTA, PERMISOS.EDITAR_VENTA,
    PERMISOS.CONFIRMAR_VENTA, PERMISOS.CANCELAR_VENTA,
    PERMISOS.VER_COTIZACIONES, PERMISOS.CREAR_COTIZACION, PERMISOS.VALIDAR_COTIZACION,
    PERMISOS.VER_ENTREGAS, PERMISOS.PROGRAMAR_ENTREGA, PERMISOS.REGISTRAR_ENTREGA,
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_INVENTARIO,
    PERMISOS.VER_GASTOS,
    PERMISOS.VER_REPORTES,
  ],
  comprador: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_REQUERIMIENTOS, PERMISOS.CREAR_REQUERIMIENTO, PERMISOS.APROBAR_REQUERIMIENTO,
    PERMISOS.VER_ORDENES_COMPRA, PERMISOS.CREAR_OC, PERMISOS.RECIBIR_OC,
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    PERMISOS.VER_GASTOS,
  ],
  almacenero: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_INVENTARIO, PERMISOS.GESTIONAR_INVENTARIO, PERMISOS.TRANSFERIR_UNIDADES,
    PERMISOS.RECIBIR_OC,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_ENTREGAS,
  ],
  finanzas: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_GASTOS, PERMISOS.CREAR_GASTO,
    PERMISOS.VER_TESORERIA, PERMISOS.GESTIONAR_TESORERIA,
    PERMISOS.VER_REPORTES, PERMISOS.VER_CTRU,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_AUDITORIA,
  ],
  supervisor: [
    PERMISOS.VER_DASHBOARD,
    PERMISOS.VER_VENTAS,
    PERMISOS.VER_COTIZACIONES,
    PERMISOS.VER_ENTREGAS,
    PERMISOS.VER_REQUERIMIENTOS,
    PERMISOS.VER_ORDENES_COMPRA,
    PERMISOS.VER_INVENTARIO,
    PERMISOS.VER_GASTOS,
    PERMISOS.VER_TESORERIA,
    PERMISOS.VER_REPORTES,
    PERMISOS.VER_CTRU,
    PERMISOS.VER_AUDITORIA,
  ],
  invitado: [],
};

interface CreateUserData {
  email: string;
  password: string;
  displayName: string;
  role: string;
  permisos?: string[];
}

interface UpdateUserRoleData {
  uid: string;
  role: string;
  permisos: string[];
}

interface DeleteUserData {
  uid: string;
}

/**
 * Verifica si el usuario que llama es admin
 */
async function verificarAdmin(context: functions.https.CallableContext): Promise<void> {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Debes estar autenticado"
    );
  }

  const adminDoc = await db.collection(COLLECTIONS.USERS).doc(context.auth.uid).get();

  if (!adminDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Usuario no encontrado"
    );
  }

  const adminData = adminDoc.data();
  const esAdmin = adminData?.role === "admin" ||
    adminData?.permisos?.includes(PERMISOS.ADMIN_TOTAL) ||
    adminData?.permisos?.includes(PERMISOS.GESTIONAR_USUARIOS);

  if (!esAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "No tienes permisos de administrador"
    );
  }
}

/**
 * Crear un nuevo usuario (solo admin)
 * Esta función usa Firebase Admin SDK para crear usuarios sin cerrar la sesión del admin
 */
export const createUser = functions.https.onCall(
  async (data: CreateUserData, context) => {
    // Verificar que quien llama es admin
    await verificarAdmin(context);

    const { email, password, displayName, role, permisos } = data;

    // Validaciones
    if (!email || !password || !displayName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Email, contraseña y nombre son requeridos"
      );
    }

    if (password.length < 6) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "La contraseña debe tener al menos 6 caracteres"
      );
    }

    const validRole = role || "invitado";
    if (!ROLES_PERMISOS[validRole]) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Rol no válido"
      );
    }

    try {
      // Crear usuario en Firebase Auth usando Admin SDK
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
        emailVerified: false,
      });

      functions.logger.info(`Usuario creado en Auth: ${userRecord.uid}`);

      // Determinar permisos (usar los del rol si no se especifican)
      const permisosFinales = permisos && permisos.length > 0
        ? permisos
        : ROLES_PERMISOS[validRole];

      // Crear perfil en Firestore
      const userProfile = {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName,
        role: validRole,
        permisos: permisosFinales,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        creadoPor: context.auth!.uid,
        activo: true,
      };

      await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set(userProfile);

      functions.logger.info(`Perfil creado en Firestore para: ${userRecord.uid}`);

      return {
        success: true,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName,
          role: validRole,
          permisos: permisosFinales,
        },
      };
    } catch (error: unknown) {
      functions.logger.error("Error creando usuario:", error);

      const firebaseError = error as { code?: string; message?: string };

      if (firebaseError.code === "auth/email-already-exists") {
        throw new functions.https.HttpsError(
          "already-exists",
          "Ya existe un usuario con este email"
        );
      }

      if (firebaseError.code === "auth/invalid-email") {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "El email no es válido"
        );
      }

      if (firebaseError.code === "auth/weak-password") {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "La contraseña es muy débil"
        );
      }

      throw new functions.https.HttpsError(
        "internal",
        firebaseError.message || "Error creando usuario"
      );
    }
  }
);

/**
 * Actualizar rol y permisos de un usuario (solo admin)
 */
export const updateUserRole = functions.https.onCall(
  async (data: UpdateUserRoleData, context) => {
    await verificarAdmin(context);

    const { uid, role, permisos } = data;

    if (!uid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "UID del usuario es requerido"
      );
    }

    // Verificar que el usuario existe
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Usuario no encontrado"
      );
    }

    // No permitir que un admin se quite sus propios permisos de admin
    if (uid === context.auth!.uid && role !== "admin") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No puedes quitarte tus propios permisos de administrador"
      );
    }

    try {
      await db.collection(COLLECTIONS.USERS).doc(uid).update({
        role,
        permisos,
        ultimaEdicion: admin.firestore.FieldValue.serverTimestamp(),
        editadoPor: context.auth!.uid,
      });

      functions.logger.info(`Rol actualizado para usuario ${uid}: ${role}`);

      return { success: true };
    } catch (error) {
      functions.logger.error("Error actualizando rol:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error actualizando rol de usuario"
      );
    }
  }
);

/**
 * Eliminar usuario (solo admin)
 */
export const deleteUser = functions.https.onCall(
  async (data: DeleteUserData, context) => {
    await verificarAdmin(context);

    const { uid } = data;

    if (!uid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "UID del usuario es requerido"
      );
    }

    // No permitir auto-eliminación
    if (uid === context.auth!.uid) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No puedes eliminarte a ti mismo"
      );
    }

    try {
      // Eliminar de Firebase Auth
      await admin.auth().deleteUser(uid);

      // Eliminar perfil de Firestore
      await db.collection(COLLECTIONS.USERS).doc(uid).delete();

      functions.logger.info(`Usuario eliminado: ${uid}`);

      return { success: true };
    } catch (error) {
      functions.logger.error("Error eliminando usuario:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error eliminando usuario"
      );
    }
  }
);

/**
 * Resetear contraseña de usuario (solo admin)
 */
export const resetUserPassword = functions.https.onCall(
  async (data: { uid: string; newPassword: string }, context) => {
    await verificarAdmin(context);

    const { uid, newPassword } = data;

    if (!uid || !newPassword) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "UID y nueva contraseña son requeridos"
      );
    }

    if (newPassword.length < 6) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "La contraseña debe tener al menos 6 caracteres"
      );
    }

    try {
      await admin.auth().updateUser(uid, { password: newPassword });

      functions.logger.info(`Contraseña reseteada para usuario: ${uid}`);

      return { success: true };
    } catch (error) {
      functions.logger.error("Error reseteando contraseña:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error reseteando contraseña"
      );
    }
  }
);

// ============================================================
// FUNCIÓN 7: Cambiar Contraseña Propia (Self-Service)
// ============================================================

/**
 * Permite a un usuario autenticado cambiar su propia contraseña.
 * Usa context.auth.uid (NO data.uid) para seguridad contra IDOR.
 */
export const changeOwnPassword = functions.https.onCall(
  async (data: { newPassword: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Debes estar autenticado"
      );
    }

    const { newPassword } = data;

    if (!newPassword || newPassword.length < 6) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "La contraseña debe tener al menos 6 caracteres"
      );
    }

    try {
      // Usar context.auth.uid (seguro, no manipulable por el cliente)
      await admin.auth().updateUser(context.auth.uid, { password: newPassword });

      functions.logger.info(`Usuario ${context.auth.uid} cambió su contraseña`);

      return { success: true };
    } catch (error) {
      functions.logger.error("Error cambiando contraseña propia:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al cambiar la contraseña"
      );
    }
  }
);

// ============================================================
// FUNCIÓN 8: Forzar Desconexión de Usuarios (Admin Only)
// ============================================================

/**
 * Desconectar un usuario específico: revoca tokens + marca en Firestore.
 * El cliente detecta el campo `forceLogoutAt` y cierra sesión automáticamente.
 */
export const forceDisconnectUser = functions.https.onCall(
  async (data: { uid: string }, context) => {
    await verificarAdmin(context);

    const { uid } = data;

    if (!uid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "UID del usuario es requerido"
      );
    }

    // No permitir auto-desconexión
    if (uid === context.auth!.uid) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No puedes desconectarte a ti mismo desde aquí"
      );
    }

    try {
      // 1. Revocar refresh tokens en Firebase Auth
      await admin.auth().revokeRefreshTokens(uid);

      // 2. Marcar en Firestore para que el cliente detecte y cierre sesión
      await db.collection(COLLECTIONS.USERS).doc(uid).update({
        forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Usuario ${uid} desconectado forzosamente por ${context.auth!.uid}`);

      return { success: true };
    } catch (error) {
      functions.logger.error("Error desconectando usuario:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al desconectar usuario"
      );
    }
  }
);

// ============================================================
// FUNCIÓN 9: Crear sala Daily.co para videollamadas
// ============================================================

interface CreateDailyRoomData {
  roomName: string;
  isTeamCall: boolean;
}

/**
 * Crea una sala en Daily.co via REST API.
 * Si la sala ya existe (409), retorna la URL existente.
 */
export const createDailyRoom = functions.https.onCall(
  async (data: CreateDailyRoomData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Debes estar autenticado"
      );
    }
    // Verify active user role
    const userDoc = await admin.firestore().collection("users").doc(context.auth.uid).get();
    const userData = userDoc.data();
    if (!userData?.activo) {
      throw new functions.https.HttpsError("permission-denied", "Usuario no activo");
    }

    const { roomName } = data;
    if (!roomName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "roomName es requerido"
      );
    }

    const { getSecret } = require("./secrets");
    const apiKey = getSecret("DAILY_API_KEY");
    if (!apiKey) {
      functions.logger.error("DAILY_API_KEY not configured");
      throw new functions.https.HttpsError(
        "internal",
        "Video service not configured"
      );
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // Helper: create a new room
    const createRoom = async () => {
      const response = await axios.post(
        "https://api.daily.co/v1/rooms",
        {
          name: roomName,
          privacy: "public",
          properties: {
            exp: Math.floor(Date.now() / 1000) + 3600,
            enable_chat: true,
            enable_screenshare: true,
            enable_prejoin_ui: false,
            lang: "es",
            start_audio_off: false,
            start_video_off: true,
          },
        },
        { headers }
      );
      return response.data;
    };

    // Helper: get existing room
    const getRoom = async () => {
      const response = await axios.get(
        `https://api.daily.co/v1/rooms/${roomName}`,
        { headers }
      );
      return response.data;
    };

    // Helper: delete a room
    const deleteRoom = async () => {
      await axios.delete(
        `https://api.daily.co/v1/rooms/${roomName}`,
        { headers }
      );
    };

    try {
      const room = await createRoom();
      functions.logger.info(`Daily room created: ${room.url}`, {
        roomName,
        userId: context.auth.uid,
      });
      return { success: true, roomUrl: room.url, roomName: room.name };
    } catch (error: unknown) {
      const axErr = error as { response?: { status?: number; data?: unknown }; message?: string };
      const status = axErr.response?.status;
      const detail = JSON.stringify(axErr.response?.data || axErr.message || error);

      functions.logger.warn(`Daily create failed (${status}): ${detail}`, {
        roomName,
        userId: context.auth.uid,
      });

      // Room already exists (400 "already exists" or 409) — reuse or recreate
      const dataStr = JSON.stringify(axErr.response?.data || "");
      const alreadyExists = status === 409
        || (status === 400 && dataStr.includes("already exists"));

      if (alreadyExists) {
        try {
          const existing = await getRoom();
          const now = Math.floor(Date.now() / 1000);

          // If room expired, delete and recreate
          if (existing.config?.exp && existing.config.exp < now) {
            functions.logger.info(`Room ${roomName} expired, recreating...`);
            await deleteRoom();
            const fresh = await createRoom();
            return { success: true, roomUrl: fresh.url, roomName: fresh.name };
          }

          // Room still valid — reuse it
          functions.logger.info(`Reusing existing room: ${existing.url}`);
          return { success: true, roomUrl: existing.url, roomName: existing.name };
        } catch (getErr: unknown) {
          const gErr = getErr as { response?: { status?: number; data?: unknown }; message?: string };
          const gDetail = JSON.stringify(gErr.response?.data || gErr.message || getErr);
          functions.logger.error(`409 recovery failed: ${gDetail}`);
          throw new functions.https.HttpsError(
            "internal",
            `Room exists but recovery failed: ${gDetail}`
          );
        }
      }

      throw new functions.https.HttpsError(
        "internal",
        `Daily API error (${status}): ${detail}`
      );
    }
  }
);

/**
 * Desconectar TODOS los usuarios excepto el admin que ejecuta la acción.
 */
export const forceDisconnectAll = functions.https.onCall(
  async (_data: unknown, context) => {
    await verificarAdmin(context);

    try {
      // Obtener todos los usuarios activos excepto el admin actual
      const usersSnapshot = await db
        .collection(COLLECTIONS.USERS)
        .where("activo", "==", true)
        .get();

      let disconnected = 0;
      const batch = db.batch();
      const revokePromises: Promise<void>[] = [];

      usersSnapshot.docs.forEach((doc) => {
        if (doc.id !== context.auth!.uid) {
          // Revocar tokens
          revokePromises.push(admin.auth().revokeRefreshTokens(doc.id));

          // Marcar en Firestore
          batch.update(doc.ref, {
            forceLogoutAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          disconnected++;
        }
      });

      // Ejecutar todo en paralelo
      await Promise.all([
        ...revokePromises,
        batch.commit(),
      ]);

      functions.logger.info(
        `${disconnected} usuarios desconectados forzosamente por ${context.auth!.uid}`
      );

      return { success: true, disconnected };
    } catch (error) {
      functions.logger.error("Error desconectando todos los usuarios:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error al desconectar usuarios"
      );
    }
  }
);

// ============================================================
// FUNCIÓN 11: Recalcular Métricas de Clientes y Marcas
// ============================================================

/**
 * Recalcula las métricas desnormalizadas de clientes y marcas
 * basándose en las ventas reales existentes en Firestore.
 * Solo admin puede ejecutarla.
 */
// ============================================================
// FUNCIÓN: Procesar Llamada con IA (Transcripción + Análisis)
// ============================================================

/**
 * Recibe un intelId + audioUrl, descarga el audio,
 * lo envía a Gemini para transcripción y luego a Claude para análisis.
 * Actualiza el documento en llamadasIntel con los resultados.
 */
export const procesarLlamadaIntel = functions
  .runWith({ memory: "1GB", timeoutSeconds: 300 })
  .https.onCall(
    async (data: { intelId: string; audioUrl: string }, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "Debes estar autenticado"
        );
      }
      // Verify admin/gerente role for AI processing (consumes API credits)
      await verificarAdmin(context);

      const { intelId, audioUrl } = data;
      if (!intelId || !audioUrl) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "intelId y audioUrl son requeridos"
        );
      }

      const { getSecret } = require("./secrets");
      const GEMINI_API_KEY = getSecret("GEMINI_API_KEY");
      const ANTHROPIC_API_KEY = getSecret("ANTHROPIC_API_KEY");

      if (!GEMINI_API_KEY || !ANTHROPIC_API_KEY) {
        functions.logger.error("GEMINI_API_KEY o ANTHROPIC_API_KEY no configuradas");
        await db.collection(COLLECTIONS.LLAMADAS_INTEL).doc(intelId).update({
          estado: "error",
          error: "API keys no configuradas en el servidor",
        });
        throw new functions.https.HttpsError(
          "internal",
          "AI API keys not configured"
        );
      }

      try {
        // 1. Descargar audio desde Firebase Storage
        functions.logger.info(`[LlamadaIntel] Descargando audio: ${audioUrl}`);
        const audioResponse = await axios.get(audioUrl, {
          responseType: "arraybuffer",
        });
        const audioBuffer = Buffer.from(audioResponse.data);
        const audioBase64 = audioBuffer.toString("base64");
        functions.logger.info(
          `[LlamadaIntel] Audio descargado: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`
        );

        // 2. Transcribir con Gemini (audio nativo)
        functions.logger.info("[LlamadaIntel] Enviando a Gemini para transcripción...");
        const geminiResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            contents: [
              {
                parts: [
                  {
                    inline_data: {
                      mime_type: "audio/webm",
                      data: audioBase64,
                    },
                  },
                  {
                    text: `Transcribe esta grabación de audio de una llamada de trabajo interna.

INSTRUCCIONES:
- Transcribe TODO el contenido hablado fielmente
- Identifica a los diferentes hablantes como "Participante 1", "Participante 2", etc.
- Incluye timestamps aproximados cada 30 segundos
- Si hay partes inaudibles, marca con [inaudible]
- Mantén el idioma original (español)

FORMATO DE SALIDA (JSON):
{
  "segmentos": [
    {"timestamp": "00:00:00", "hablante": "Participante 1", "texto": "..."},
    {"timestamp": "00:00:15", "hablante": "Participante 2", "texto": "..."}
  ],
  "textoCompleto": "Transcripción completa en texto plano sin timestamps"
}

Responde SOLO con el JSON, sin markdown ni texto adicional.`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
            },
          },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 120000,
          }
        );

        const geminiText =
          geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        functions.logger.info(
          `[LlamadaIntel] Gemini respondió: ${geminiText.substring(0, 200)}...`
        );

        // Parsear transcripción
        let transcripcionData: {
          segmentos: Array<{
            timestamp: string;
            hablante: string;
            texto: string;
          }>;
          textoCompleto: string;
        };
        try {
          // Limpiar posible markdown wrapping
          const cleanJson = geminiText
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .trim();
          transcripcionData = JSON.parse(cleanJson);
        } catch {
          functions.logger.warn(
            "[LlamadaIntel] No se pudo parsear JSON de Gemini, usando texto plano"
          );
          transcripcionData = {
            segmentos: [
              {
                timestamp: "00:00:00",
                hablante: "Transcripción",
                texto: geminiText,
              },
            ],
            textoCompleto: geminiText,
          };
        }

        // 3. Analizar con Claude
        functions.logger.info(
          "[LlamadaIntel] Enviando a Claude para análisis..."
        );
        const claudeResponse = await axios.post(
          "https://api.anthropic.com/v1/messages",
          {
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            messages: [
              {
                role: "user",
                content: `Analiza esta transcripción de una llamada interna de trabajo de una empresa (ERP de importación/comercialización).

TRANSCRIPCIÓN:
${transcripcionData.textoCompleto}

GENERA un análisis estructurado en JSON con este formato:
{
  "resumenEjecutivo": ["punto 1", "punto 2", "punto 3"],
  "tareas": [
    {
      "descripcion": "Qué hay que hacer",
      "responsable": "Nombre del participante",
      "deadline": "Fecha si se mencionó o null",
      "prioridad": "alta|media|baja"
    }
  ],
  "decisiones": [
    {
      "decision": "Qué se decidió",
      "contexto": "Por qué",
      "involucrados": ["Participante 1"]
    }
  ],
  "seguimientos": [
    {
      "accion": "Qué seguimiento hacer",
      "responsable": "Quién",
      "plazo": "Cuándo"
    }
  ],
  "temasDiscutidos": ["tema 1", "tema 2"],
  "sentimiento": "positivo|neutral|tenso|urgente",
  "alertas": ["riesgo o problema mencionado"]
}

Responde SOLO con el JSON válido, sin markdown.`,
              },
            ],
          },
          {
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            timeout: 60000,
          }
        );

        const claudeText =
          claudeResponse.data?.content?.[0]?.text || "";
        functions.logger.info(
          `[LlamadaIntel] Claude respondió: ${claudeText.substring(0, 200)}...`
        );

        let analisis: Record<string, unknown>;
        try {
          const cleanJson = claudeText
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .trim();
          analisis = JSON.parse(cleanJson);
        } catch {
          functions.logger.warn(
            "[LlamadaIntel] No se pudo parsear JSON de Claude"
          );
          analisis = {
            resumenEjecutivo: ["No se pudo analizar la llamada automáticamente"],
            tareas: [],
            decisiones: [],
            seguimientos: [],
            temasDiscutidos: [],
            sentimiento: "neutral",
            alertas: ["Error al parsear análisis de IA"],
          };
        }

        // 4. Auto-vincular tareas/seguimientos a usuarios del equipo
        const usersSnap = await db.collection(COLLECTIONS.USERS)
          .where("activo", "==", true).get();
        const teamUsers = usersSnap.docs.map(d => ({
          uid: d.id,
          displayName: (d.data().displayName || "").toLowerCase(),
        }));

        // Obtener participantes de la llamada para mapear
        const intelDoc = await db.collection(COLLECTIONS.LLAMADAS_INTEL).doc(intelId).get();
        const participantesUids: string[] = intelDoc.data()?.participantesUids || [];
        const participantesNombres: string[] = intelDoc.data()?.participantes || [];

        const matchUserByName = (nombre: string): { uid: string; displayName: string } | null => {
          if (!nombre) return null;
          const nombreLower = nombre.toLowerCase().trim();

          // 1. Coincidencia exacta con participantes de la llamada
          const idxParticipante = participantesNombres.findIndex(
            p => p.toLowerCase() === nombreLower
          );
          if (idxParticipante >= 0 && participantesUids[idxParticipante]) {
            return {
              uid: participantesUids[idxParticipante],
              displayName: participantesNombres[idxParticipante],
            };
          }

          // 2. Coincidencia parcial con usuarios del equipo (nombre o apellido)
          const match = teamUsers.find(u =>
            u.displayName === nombreLower ||
            u.displayName.includes(nombreLower) ||
            nombreLower.includes(u.displayName.split(" ")[0])
          );
          if (match) return { uid: match.uid, displayName: match.displayName };

          // 3. Match por "Participante N" → mapear al N-ésimo participante
          const participanteMatch = nombre.match(/Participante\s*(\d+)/i);
          if (participanteMatch) {
            const idx = parseInt(participanteMatch[1]) - 1;
            if (idx >= 0 && idx < participantesUids.length) {
              return {
                uid: participantesUids[idx],
                displayName: participantesNombres[idx] || nombre,
              };
            }
          }

          return null;
        };

        // Enriquecer tareas con UIDs y estado inicial
        if (Array.isArray((analisis as any).tareas)) {
          (analisis as any).tareas = (analisis as any).tareas.map((t: any) => {
            const matched = matchUserByName(t.responsable);
            return {
              ...t,
              responsableUid: matched?.uid || null,
              responsable: matched?.displayName || t.responsable,
              estado: "pendiente",
              completada: false,
            };
          });
        }

        // Enriquecer seguimientos con UIDs
        if (Array.isArray((analisis as any).seguimientos)) {
          (analisis as any).seguimientos = (analisis as any).seguimientos.map((s: any) => {
            const matched = matchUserByName(s.responsable);
            return {
              ...s,
              responsableUid: matched?.uid || null,
              responsable: matched?.displayName || s.responsable,
              completado: false,
            };
          });
        }

        // 5. Guardar resultados en Firestore
        await db.collection(COLLECTIONS.LLAMADAS_INTEL).doc(intelId).update({
          transcripcion: transcripcionData.segmentos,
          transcripcionTexto: transcripcionData.textoCompleto,
          analisis,
          estado: "completado",
          procesadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.info(
          `[LlamadaIntel] Procesamiento completado para ${intelId}`
        );

        return {
          success: true,
          intelId,
          segmentos: transcripcionData.segmentos.length,
        };
      } catch (error: unknown) {
        const errMsg =
          error instanceof Error ? error.message : JSON.stringify(error);
        functions.logger.error(
          `[LlamadaIntel] Error procesando: ${errMsg}`
        );

        // Marcar como error en Firestore
        try {
          await db.collection(COLLECTIONS.LLAMADAS_INTEL).doc(intelId).update({
            estado: "error",
            error: errMsg.substring(0, 500),
          });
        } catch {
          // Ignore update error
        }

        throw new functions.https.HttpsError(
          "internal",
          `Error procesando llamada: ${errMsg}`
        );
      }
    }
  );

export const recalcularMetricas = functions.https.onCall(
  async (_data: unknown, context) => {
    await verificarAdmin(context);

    try {
      // 1. Leer todas las ventas (no anuladas)
      const ventasSnap = await db.collection(COLLECTIONS.VENTAS).get();
      const ventas = ventasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((v: any) => v.estado !== "anulada" && v.estado !== "cancelada");

      // 2. Agregar métricas por clienteId
      const clienteMetricas: Record<string, {
        totalCompras: number;
        montoTotalPEN: number;
        ultimaCompra: any;
      }> = {};

      for (const venta of ventas as any[]) {
        const cid = venta.clienteId;
        if (!cid) continue;

        if (!clienteMetricas[cid]) {
          clienteMetricas[cid] = { totalCompras: 0, montoTotalPEN: 0, ultimaCompra: null };
        }
        clienteMetricas[cid].totalCompras += 1;
        clienteMetricas[cid].montoTotalPEN += (venta.totalPEN || 0);

        const fechaVenta = venta.fechaVenta || venta.fechaCreacion;
        if (fechaVenta && (!clienteMetricas[cid].ultimaCompra ||
          fechaVenta.toMillis?.() > clienteMetricas[cid].ultimaCompra.toMillis?.())) {
          clienteMetricas[cid].ultimaCompra = fechaVenta;
        }
      }

      // 3. Agregar métricas por marca (via productos en ventas)
      const marcaVentas: Record<string, {
        unidadesVendidas: number;
        ventasTotalPEN: number;
        ultimaVenta: any;
      }> = {};

      for (const venta of ventas as any[]) {
        if (!venta.productos) continue;
        for (const prod of venta.productos) {
          const mid = prod.marcaId;
          if (!mid) continue;

          if (!marcaVentas[mid]) {
            marcaVentas[mid] = { unidadesVendidas: 0, ventasTotalPEN: 0, ultimaVenta: null };
          }
          marcaVentas[mid].unidadesVendidas += (prod.cantidad || 1);
          marcaVentas[mid].ventasTotalPEN += (prod.subtotal || 0);

          const fechaVenta = venta.fechaVenta || venta.fechaCreacion;
          if (fechaVenta && (!marcaVentas[mid].ultimaVenta ||
            fechaVenta.toMillis?.() > marcaVentas[mid].ultimaVenta.toMillis?.())) {
            marcaVentas[mid].ultimaVenta = fechaVenta;
          }
        }
      }

      // 4. Actualizar clientes en batches de 500
      const clientesSnap = await db.collection(COLLECTIONS.CLIENTES).get();
      let clientesActualizados = 0;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of clientesSnap.docs) {
        const metricas = clienteMetricas[doc.id] || {
          totalCompras: 0, montoTotalPEN: 0, ultimaCompra: null
        };
        const ticketPromedio = metricas.totalCompras > 0
          ? metricas.montoTotalPEN / metricas.totalCompras : 0;

        const updateData: any = {
          "metricas.totalCompras": metricas.totalCompras,
          "metricas.montoTotalPEN": Math.round(metricas.montoTotalPEN * 100) / 100,
          "metricas.ticketPromedio": Math.round(ticketPromedio * 100) / 100,
        };
        if (metricas.ultimaCompra) {
          updateData["metricas.ultimaCompra"] = metricas.ultimaCompra;
        }

        batch.update(doc.ref, updateData);
        batchCount++;
        clientesActualizados++;

        if (batchCount >= 450) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
      if (batchCount > 0) await batch.commit();

      // 5. Actualizar marcas en batches de 500
      // Primero contar productos activos por marca
      const productosSnap = await db.collection(COLLECTIONS.PRODUCTOS).get();
      const productosActivosPorMarca: Record<string, number> = {};
      for (const doc of productosSnap.docs) {
        const p = doc.data();
        const mid = p.marcaId;
        if (mid && p.estado === "activo") {
          productosActivosPorMarca[mid] = (productosActivosPorMarca[mid] || 0) + 1;
        }
      }

      const marcasSnap = await db.collection(COLLECTIONS.MARCAS).get();
      let marcasActualizadas = 0;
      batch = db.batch();
      batchCount = 0;

      for (const doc of marcasSnap.docs) {
        const mv = marcaVentas[doc.id] || {
          unidadesVendidas: 0, ventasTotalPEN: 0, ultimaVenta: null
        };
        const productosActivos = productosActivosPorMarca[doc.id] || 0;

        const updateData: any = {
          "metricas.productosActivos": productosActivos,
          "metricas.unidadesVendidas": mv.unidadesVendidas,
          "metricas.ventasTotalPEN": Math.round(mv.ventasTotalPEN * 100) / 100,
          "metricas.margenPromedio": 0,
        };
        if (mv.ultimaVenta) {
          updateData["metricas.ultimaVenta"] = mv.ultimaVenta;
        }

        batch.update(doc.ref, updateData);
        batchCount++;
        marcasActualizadas++;

        if (batchCount >= 450) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
      if (batchCount > 0) await batch.commit();

      functions.logger.info(
        `✅ Métricas recalculadas: ${clientesActualizados} clientes, ${marcasActualizadas} marcas, desde ${ventas.length} ventas`
      );

      return {
        success: true,
        ventasProcesadas: ventas.length,
        clientesActualizados,
        marcasActualizadas,
      };
    } catch (error) {
      functions.logger.error("Error recalculando métricas:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Error recalculando métricas"
      );
    }
  }
);

// ============================================================
// POOL USD — SNAPSHOT MENSUAL AUTOMÁTICO (TAREA-072)
// ============================================================

/**
 * Genera un snapshot mensual del Pool USD el 1ro de cada mes a las 6:00 AM.
 * Registra saldo, TCPA, TC SUNAT al cierre, e impacto cambiario acumulado.
 */
export const poolUSDSnapshotMensual = functions.pubsub
  .schedule("0 6 1 * *")
  .timeZone("America/Lima")
  .onRun(async () => {
    const db = admin.firestore();
    const MOV_COLLECTION = COLLECTIONS.POOL_USD_MOVIMIENTOS;
    const SNAP_COLLECTION = COLLECTIONS.POOL_USD_SNAPSHOTS;

    try {
      // Obtener estado actual del pool desde _estado doc
      const estadoDoc = await db.collection(SNAP_COLLECTION).doc("_estado").get();
      if (!estadoDoc.exists) {
        functions.logger.info("[Pool USD Snapshot] No hay estado de pool — omitiendo");
        return null;
      }

      const estado = estadoDoc.data()!;
      const saldoUSD = estado.saldoUSD ?? 0;
      const tcpa = estado.tcpa ?? 0;

      if (saldoUSD === 0) {
        functions.logger.info("[Pool USD Snapshot] Pool vacío — omitiendo snapshot");
        return null;
      }

      // Calcular período: mes anterior
      const ahora = new Date();
      const mesAnterior = ahora.getMonth() === 0 ? 12 : ahora.getMonth(); // enero→12
      const anioSnapshot = ahora.getMonth() === 0 ? ahora.getFullYear() - 1 : ahora.getFullYear();

      // Obtener movimientos del mes anterior para calcular totales
      const inicioMes = new Date(anioSnapshot, mesAnterior - 1, 1);
      const finMes = new Date(anioSnapshot, mesAnterior, 0, 23, 59, 59);

      const movsSnap = await db.collection(MOV_COLLECTION)
        .where("fecha", ">=", admin.firestore.Timestamp.fromDate(inicioMes))
        .where("fecha", "<=", admin.firestore.Timestamp.fromDate(finMes))
        .get();

      let entradasUSD = 0;
      let salidasUSD = 0;
      let impactoCambiarioMes = 0;

      movsSnap.docs.forEach((d) => {
        const mov = d.data();
        if (mov.direccion === "entrada") {
          entradasUSD += mov.montoUSD || 0;
        } else {
          salidasUSD += mov.montoUSD || 0;
        }
        impactoCambiarioMes += mov.impactoCambiario || 0;
      });

      // Obtener TC SUNAT actual para valorización
      let tcSunatActual = tcpa;
      try {
        const tcDocs = await db.collection(COLLECTIONS.TIPOS_CAMBIO)
          .orderBy("fecha", "desc")
          .limit(1)
          .get();
        if (!tcDocs.empty) {
          const tcData = tcDocs.docs[0].data();
          tcSunatActual = tcData.venta || tcData.compra || tcpa;
        }
      } catch {
        functions.logger.warn("[Pool USD Snapshot] No se pudo obtener TC SUNAT, usando TCPA");
      }

      const snapshotId = `${anioSnapshot}-${String(mesAnterior).padStart(2, "0")}`;
      const snapshot = {
        periodo: snapshotId,
        mes: mesAnterior,
        anio: anioSnapshot,
        saldoUSD,
        tcpa,
        tcSunatAlCierre: tcSunatActual,
        valorPENaTCPA: saldoUSD * tcpa,
        valorPENaTCSunat: saldoUSD * tcSunatActual,
        diferenciaValorizacion: saldoUSD * (tcSunatActual - tcpa),
        entradasUSD,
        salidasUSD,
        movimientoNeto: entradasUSD - salidasUSD,
        impactoCambiarioMes,
        cantidadMovimientos: movsSnap.size,
        fechaGeneracion: admin.firestore.Timestamp.now(),
        generadoPor: "sistema_cron",
      };

      await db.collection(SNAP_COLLECTION).doc(snapshotId).set(snapshot);

      functions.logger.info(
        `✅ Pool USD Snapshot ${snapshotId}: $${saldoUSD.toFixed(2)} @ TCPA ${tcpa.toFixed(4)}, ` +
        `${movsSnap.size} movimientos, impacto cambiario S/ ${impactoCambiarioMes.toFixed(2)}`
      );

      return snapshot;
    } catch (error) {
      functions.logger.error("[Pool USD Snapshot] Error:", error);
      return null;
    }
  });

// Auto-purge eliminado: los productos archivados se conservan permanentemente para trazabilidad

// ============================================================
// BN-006: Liberar reservas de stock vencidas automáticamente
// ============================================================

/**
 * Cada hora, busca unidades con estado 'reservada' cuya vigencia de reserva expiró
 * y las devuelve a estado 'disponible_peru' o su estado previo.
 */
export const liberarReservasVencidas = functions.pubsub
  .schedule("0 * * * *")
  .timeZone("America/Lima")
  .onRun(async () => {
    const db = admin.firestore();
    const ahora = admin.firestore.Timestamp.now();

    try {
      // Buscar unidades reservadas con vigencia expirada
      const snapshot = await db.collection(COLLECTIONS.UNIDADES)
        .where("estado", "==", "reservada")
        .where("reserva.vigenciaHasta", "<=", ahora)
        .get();

      if (snapshot.empty) {
        functions.logger.info("[Reservas] Sin reservas vencidas");
        return null;
      }

      const batch = db.batch();
      let liberadas = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const estadoPrevio = data.reserva?.estadoPrevio || "disponible_peru";

        batch.update(doc.ref, {
          estado: estadoPrevio,
          reserva: admin.firestore.FieldValue.delete(),
          ultimaEdicion: admin.firestore.FieldValue.serverTimestamp(),
        });
        liberadas++;
      }

      await batch.commit();

      // Actualizar stock de los productos afectados
      const productosAfectados = new Set(
        snapshot.docs.map((d) => d.data().productoId).filter(Boolean)
      );

      for (const productoId of productosAfectados) {
        try {
          const unidadesSnap = await db.collection(COLLECTIONS.UNIDADES)
            .where("productoId", "==", productoId)
            .where("estado", "==", "disponible_peru")
            .get();
          const stockPeru = unidadesSnap.size;

          const reservadasSnap = await db.collection(COLLECTIONS.UNIDADES)
            .where("productoId", "==", productoId)
            .where("estado", "==", "reservada")
            .get();
          const stockReservado = reservadasSnap.size;

          await db.collection(COLLECTIONS.PRODUCTOS).doc(productoId).update({
            stockPeru,
            stockReservado,
            stockDisponible: stockPeru,
            stockDisponiblePeru: stockPeru,
          });
        } catch (e) {
          functions.logger.warn(`[Reservas] Error actualizando stock de ${productoId}:`, e);
        }
      }

      functions.logger.info(
        `[Reservas] ${liberadas} unidad(es) liberada(s) de ${productosAfectados.size} producto(s)`
      );
      return null;
    } catch (error) {
      functions.logger.error("[Reservas] Error en auto-release:", error);
      return null;
    }
  });

/**
 * Diariamente a las 2am Lima, marca unidades con fechaVencimiento pasada como 'vencida'.
 * Previene que FEFO seleccione productos vencidos para venta.
 */
export const marcarUnidadesVencidas = functions.pubsub
  .schedule("0 2 * * *")
  .timeZone("America/Lima")
  .onRun(async () => {
    const db = admin.firestore();
    const ahora = admin.firestore.Timestamp.now();

    const estadosActivos = [
      "disponible_peru",
      "recibida_origen",
      "recibida_usa",
      "en_transito_peru",
    ];

    try {
      let totalVencidas = 0;
      const productosAfectados = new Set<string>();

      for (const estado of estadosActivos) {
        const snapshot = await db
          .collection(COLLECTIONS.UNIDADES)
          .where("estado", "==", estado)
          .where("fechaVencimiento", "<=", ahora)
          .get();

        if (snapshot.empty) continue;

        // Process in batches of 400
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = db.batch();
          const chunk = docs.slice(i, i + 400);

          for (const doc of chunk) {
            const data = doc.data();
            batch.update(doc.ref, {
              estado: "vencida",
              movimientos: admin.firestore.FieldValue.arrayUnion({
                tipo: "vencimiento",
                fecha: ahora,
                estadoAnterior: estado,
                estadoNuevo: "vencida",
                descripcion: "Marcada como vencida automáticamente por fecha de vencimiento",
                automatico: true,
              }),
              ultimaEdicion: admin.firestore.FieldValue.serverTimestamp(),
            });
            if (data.productoId) productosAfectados.add(data.productoId);
            totalVencidas++;
          }

          await batch.commit();
        }
      }

      // Also handle reserved units that expired
      const reservadasSnap = await db
        .collection(COLLECTIONS.UNIDADES)
        .where("estado", "==", "reservada")
        .where("fechaVencimiento", "<=", ahora)
        .get();

      if (!reservadasSnap.empty) {
        const batch = db.batch();
        for (const doc of reservadasSnap.docs) {
          const data = doc.data();
          batch.update(doc.ref, {
            estado: "vencida",
            reserva: admin.firestore.FieldValue.delete(),
            movimientos: admin.firestore.FieldValue.arrayUnion({
              tipo: "vencimiento",
              fecha: ahora,
              estadoAnterior: "reservada",
              estadoNuevo: "vencida",
              descripcion: "Producto vencido — reserva liberada automáticamente",
              automatico: true,
            }),
            ultimaEdicion: admin.firestore.FieldValue.serverTimestamp(),
          });
          if (data.productoId) productosAfectados.add(data.productoId);
          totalVencidas++;
        }
        await batch.commit();
      }

      // Update stock counts for affected products
      for (const productoId of productosAfectados) {
        try {
          const dispSnap = await db
            .collection(COLLECTIONS.UNIDADES)
            .where("productoId", "==", productoId)
            .where("estado", "==", "disponible_peru")
            .get();
          await db.collection(COLLECTIONS.PRODUCTOS).doc(productoId).update({
            stockPeru: dispSnap.size,
            stockDisponible: dispSnap.size,
            stockDisponiblePeru: dispSnap.size,
          });
        } catch (e) {
          functions.logger.warn(`[Vencimiento] Error actualizando stock de ${productoId}:`, e);
        }
      }

      if (totalVencidas > 0) {
        functions.logger.info(
          `[Vencimiento] ${totalVencidas} unidad(es) marcada(s) como vencida(s) de ${productosAfectados.size} producto(s)`
        );
      } else {
        functions.logger.info("[Vencimiento] Sin unidades vencidas");
      }

      return null;
    } catch (error) {
      functions.logger.error("[Vencimiento] Error en marcado automático:", error);
      return null;
    }
  });
