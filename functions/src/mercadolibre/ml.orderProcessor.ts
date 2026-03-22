/**
 * ML Order Processor - Procesamiento automático de órdenes ML → ERP
 *
 * Pipeline: buscarOCrearCliente → crearVenta → registrarPago → asignarFEFO → registrarGastos → actualizar mlOrderSync
 *
 * Ejecuta con Firebase Admin SDK (backend). Reutilizado por:
 * - Webhook automático (ml.sync.ts → processOrderNotification)
 * - Callable manual retry (ml.functions.ts → mlprocesarorden)
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { MLOrderSync, MLOrderProduct } from "./ml.types";
import { getOrder, getShipment } from "./ml.api";
import { resolverTCVenta } from "../tipoCambio.util";
import { COLLECTIONS } from "../collections";

const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

/**
 * Convierte texto a Title Case: "ROBERTO CLEMENTE" → "Roberto Clemente"
 * Maneja preposiciones comunes en español (de, del, la, etc.)
 */
function toTitleCase(text: string): string {
  if (!text) return text;
  const lower = text.toLowerCase().trim();
  const preps = new Set(["de", "del", "la", "las", "los", "el", "y", "e"]);
  return lower.replace(/\b\w+/g, (word, index) => {
    if (index > 0 && preps.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

// ============================================================
// TIPOS INTERNOS
// ============================================================

interface ProcessResult {
  ventaId: string;
  numeroVenta: string;
  clienteId: string | null;
  estado: "procesada" | "error";
  advertencias: string[];
}

interface OrderSyncData extends MLOrderSync {
  id?: string;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  buyerDni?: string | null;
  buyerDocType?: string | null;
  razonSocial?: string | null;
  direccionEntrega?: string;
  distrito?: string;
  provincia?: string;
  codigoPostal?: string | null;
  referenciaEntrega?: string | null;
  coordenadas?: { lat: number; lng: number } | null;
  trackingNumber?: string | null;
  productos?: MLOrderProduct[];
  todosVinculados?: boolean;
}

// ============================================================
// PIPELINE PRINCIPAL
// ============================================================

export async function procesarOrdenCompleta(
  orderSync: OrderSyncData,
  orderSyncRef: FirebaseFirestore.DocumentReference
): Promise<ProcessResult> {
  const advertencias: string[] = [];
  const mlOrderId = orderSync.mlOrderId;

  functions.logger.info(`ML Order ${mlOrderId}: Iniciando procesamiento automático`);

  try {
    // 0a. Pilar 2: Decrementar stockPendienteML si fue contabilizado por el webhook
    if (orderSync.stockPendienteContabilizado === true) {
      const productos = orderSync.productos || [];
      const productosVinculados = productos.filter(p => p.productoId);
      let allDecrementsOk = true;
      for (const prod of productosVinculados) {
        try {
          const prodRef = db.collection(COLLECTIONS.PRODUCTOS).doc(prod.productoId!);
          const prodDoc = await prodRef.get();
          const pData = prodDoc.data();
          const newPendiente = Math.max(0, (pData?.stockPendienteML || 0) - prod.cantidad);
          await prodRef.update({
            stockPendienteML: newPendiente,
          });
          functions.logger.info(
            `ML Order ${mlOrderId}: stockPendienteML -${prod.cantidad} para ${prod.productoId} → pendiente=${newPendiente}`
          );
        } catch (err: any) {
          allDecrementsOk = false;
          functions.logger.warn(
            `ML Order ${mlOrderId}: error decrementando stockPendienteML para ${prod.productoId}: ${err.message}`
          );
        }
      }
      // Solo marcar como no contabilizado si TODOS los decrementos fueron exitosos
      // Si alguno falló, mantener flag para que un retry pueda intentar de nuevo
      if (allDecrementsOk) {
        await orderSyncRef.update({ stockPendienteContabilizado: false });
      } else {
        functions.logger.warn(
          `ML Order ${mlOrderId}: stockPendienteContabilizado se mantiene true (algunos decrementos fallaron)`
        );
      }
    }

    // 0b. Re-fetch orden de ML API para obtener sale_fee y shipment actualizados
    // El webhook inicial puede llegar antes de que ML calcule las comisiones
    try {
      const freshOrder = await getOrder(mlOrderId);
      const freshComision = freshOrder.order_items.reduce(
        (sum, item) => sum + (item.sale_fee || 0) * (item.quantity || 1), 0
      );

      if (freshComision > 0 && (orderSync.comisionML || 0) === 0) {
        orderSync.comisionML = freshComision;
        await orderSyncRef.update({ comisionML: freshComision });
        functions.logger.info(
          `ML Order ${mlOrderId}: comisionML actualizada por re-fetch: 0 → ${freshComision}`
        );
      } else if (freshComision > 0 && Math.abs(freshComision - (orderSync.comisionML || 0)) > 0.01) {
        orderSync.comisionML = freshComision;
        await orderSyncRef.update({ comisionML: freshComision });
        functions.logger.info(
          `ML Order ${mlOrderId}: comisionML corregida: ${orderSync.comisionML} → ${freshComision}`
        );
      }

      // Re-fetch shipment para metodoEnvio si aún no se determinó
      if (!orderSync.metodoEnvio && freshOrder.shipping?.id) {
        try {
          const freshShipment = await getShipment(freshOrder.shipping.id);
          const method = (freshShipment.tracking_method || "").toLowerCase();
          let metodoEnvio: "flex" | "urbano" | null = null;

          if (method.includes("flex") || method === "self_service") {
            metodoEnvio = "flex";
          } else if (method.includes("urbano") || method === "standard" || method === "normal") {
            metodoEnvio = "urbano";
          }

          if (metodoEnvio) {
            orderSync.metodoEnvio = metodoEnvio;

            // Reclasificar envío si es urbano y no se hizo antes
            if (metodoEnvio === "urbano" && (orderSync.costoEnvioCliente || 0) > 0 && (orderSync.cargoEnvioML || 0) === 0) {
              orderSync.cargoEnvioML = orderSync.costoEnvioCliente;
              orderSync.costoEnvioCliente = 0;
              await orderSyncRef.update({
                metodoEnvio,
                cargoEnvioML: orderSync.cargoEnvioML,
                costoEnvioCliente: 0,
              });
            } else {
              await orderSyncRef.update({ metodoEnvio });
            }
            functions.logger.info(
              `ML Order ${mlOrderId}: metodoEnvio actualizado por re-fetch: ${metodoEnvio}`
            );
          }
        } catch (shipErr: any) {
          functions.logger.warn(
            `ML Order ${mlOrderId}: no se pudo re-fetch shipment: ${shipErr.message}`
          );
        }
      }
    } catch (err: any) {
      // No bloquear el pipeline si falla el re-fetch — usar datos del webhook
      functions.logger.warn(
        `ML Order ${mlOrderId}: re-fetch de orden falló, usando datos del webhook: ${err.message}`
      );
    }

    // 0c. Obtener config ML
    const configDoc = await db.collection(COLLECTIONS.ML_CONFIG).doc("settings").get();
    const config = configDoc.data() || {};

    // 1. Buscar o crear cliente
    let clienteId: string | null = null;
    try {
      clienteId = await buscarOCrearCliente(orderSync, config);
    } catch (err: any) {
      advertencias.push(`Cliente: ${err.message}`);
      functions.logger.warn(`ML Order ${mlOrderId}: error buscando/creando cliente`, err);
    }

    // 2. Safety net: verificar que no exista ya una venta para esta orden ML
    //    Primero buscar por ID determinístico (más rápido y fiable)
    const deterministicVentaId = orderSync.packId
      ? `venta-ml-pack-${orderSync.packId}`
      : `venta-ml-${mlOrderId}`;
    const deterministicCheck = await db.collection(COLLECTIONS.VENTAS).doc(deterministicVentaId).get();

    let existingVentaDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    if (deterministicCheck.exists) {
      existingVentaDoc = deterministicCheck;
    } else {
      // Fallback: buscar por campo mercadoLibreId (para ventas antiguas con ID aleatorio)
      let existingVentaQ = await db.collection(COLLECTIONS.VENTAS)
        .where("mercadoLibreId", "==", String(mlOrderId))
        .limit(1)
        .get();

      if (existingVentaQ.empty && orderSync.packId) {
        existingVentaQ = await db.collection(COLLECTIONS.VENTAS)
          .where("packId", "==", orderSync.packId)
          .limit(1)
          .get();
      }

      if (!existingVentaQ.empty) {
        existingVentaDoc = existingVentaQ.docs[0];
      }
    }

    if (existingVentaDoc) {
      functions.logger.warn(
        `ML Order ${mlOrderId}: SAFETY NET — ya existe venta ${existingVentaDoc.data()!.numeroVenta} (${existingVentaDoc.id}), abortando`
      );
      await orderSyncRef.update({
        estado: "procesada",
        ventaId: existingVentaDoc.id,
        numeroVenta: existingVentaDoc.data()!.numeroVenta,
        errorDetalle: "Safety net: venta ya existía",
        fechaSync: admin.firestore.Timestamp.now(),
      });
      return {
        ventaId: existingVentaDoc.id,
        numeroVenta: existingVentaDoc.data()!.numeroVenta,
        clienteId: existingVentaDoc.data()!.clienteId || null,
        estado: "procesada",
        advertencias: ["Safety net: venta duplicada prevenida"],
      };
    }

    // 3. Obtener canal ML
    const canalMLId = await obtenerCanalML();

    // 4. Crear venta
    const { ventaId, numeroVenta, ventaData, alreadyExisted } = await crearVenta(orderSync, clienteId, canalMLId);

    // Si la venta ya existía (race condition prevenida por .create()), abortar pipeline completo
    // No registrar pago, inventario, ni gastos — el otro proceso ya lo hizo
    if (alreadyExisted) {
      functions.logger.warn(
        `ML Order ${mlOrderId}: venta ${numeroVenta} ya existía (race condition). Abortando pipeline para evitar duplicados en gastos/tesorería.`
      );
      await orderSyncRef.update({
        estado: "procesada",
        ventaId,
        numeroVenta,
        errorDetalle: "Race condition prevenida: venta ya existía, pipeline abortado",
        fechaSync: admin.firestore.Timestamp.now(),
      });
      return {
        ventaId,
        numeroVenta,
        clienteId,
        estado: "procesada",
        advertencias: ["Race condition prevenida: venta duplicada evitada"],
      };
    }

    functions.logger.info(`ML Order ${mlOrderId}: Venta creada ${numeroVenta} (${ventaId})`);

    // 5. Registrar pago completo + tesorería
    let cuentaMPId: string | null = null;
    try {
      cuentaMPId = await registrarPagoCompleto(ventaId, ventaData, orderSync);
    } catch (err: any) {
      advertencias.push(`Pago: ${err.message}`);
      functions.logger.error(`ML Order ${mlOrderId}: error registrando pago`, err);
    }

    // 6. Asignar inventario FEFO
    try {
      await asignarInventarioFEFO(ventaId, ventaData, orderSync);
    } catch (err: any) {
      advertencias.push(`Inventario FEFO: ${err.message}`);
      functions.logger.error(`ML Order ${mlOrderId}: error en FEFO`, err);
    }

    // 7. Registrar gastos ML (comisión + cargo envío si aplica)
    // NOTA: Se crea el gasto GV siempre que haya comisión, aunque cuentaMPId sea null.
    // Si no hay cuenta MP, se crea el gasto sin movimientos de tesorería (para que Rentabilidad lo refleje).
    try {
      if (orderSync.comisionML > 0 || (orderSync.cargoEnvioML || 0) > 0) {
        await registrarGastosML(ventaId, numeroVenta, orderSync, cuentaMPId);
      }
    } catch (err: any) {
      advertencias.push(`Gastos: ${err.message}`);
      functions.logger.error(`ML Order ${mlOrderId}: error registrando gastos`, err);
    }

    // 7. Actualizar mlOrderSync como procesada
    await orderSyncRef.update({
      ventaId,
      numeroVenta,
      clienteId,
      estado: "procesada",
      errorDetalle: advertencias.length > 0 ? advertencias.join(" | ") : null,
      fechaProcesada: Timestamp.now(),
    });

    functions.logger.info(
      `ML Order ${mlOrderId}: Procesada exitosamente → ${numeroVenta}` +
      (advertencias.length > 0 ? ` (${advertencias.length} advertencias)` : "")
    );

    return { ventaId, numeroVenta, clienteId, estado: "procesada", advertencias };
  } catch (err: any) {
    functions.logger.error(`ML Order ${mlOrderId}: Error crítico en procesamiento`, err);

    await orderSyncRef.update({
      estado: "error",
      errorDetalle: err.message,
      fechaSync: Timestamp.now(),
    });

    throw err;
  }
}

// ============================================================
// PASO 1: BUSCAR O CREAR CLIENTE
// ============================================================

async function buscarOCrearCliente(
  orderSync: OrderSyncData,
  config: any
): Promise<string | null> {
  const esEmpresa = orderSync.buyerDocType === "RUC" || (orderSync.buyerDni && orderSync.buyerDni.length === 11);
  const nombreRaw = (esEmpresa && orderSync.razonSocial) ? orderSync.razonSocial : (orderSync.mlBuyerName || "Cliente ML");
  const nombreCompleto = nombreRaw === "Cliente ML" ? nombreRaw : toTitleCase(nombreRaw);

  // Helper: actualizar cliente existente con datos frescos de ML
  const actualizarCliente = async (clienteId: string) => {
    try {
      const updateData: Record<string, any> = {};
      if (nombreCompleto !== "Cliente ML") {
        updateData.nombre = nombreCompleto;
        updateData.nombreLowercase = nombreCompleto.toLowerCase().trim();
      }
      if (orderSync.buyerDni) updateData.dniRuc = orderSync.buyerDni;
      if (orderSync.buyerDocType) updateData.tipoDocumento = orderSync.buyerDocType;
      updateData.tipoCliente = esEmpresa ? "empresa" : "persona";
      if (orderSync.buyerPhone) updateData.telefono = orderSync.buyerPhone.replace(/\D/g, "");
      if (orderSync.buyerEmail) updateData.email = orderSync.buyerEmail;

      if (Object.keys(updateData).length > 0) {
        await db.collection(COLLECTIONS.CLIENTES).doc(clienteId).update(updateData);
        functions.logger.info(`ML: Cliente ${clienteId} actualizado con datos de billing_info → ${nombreCompleto}`);
      }
    } catch (err: any) {
      functions.logger.warn(`ML: Error actualizando cliente ${clienteId}:`, err.message);
    }
  };

  // 1a. Buscar por DNI/RUC
  if (orderSync.buyerDni) {
    const dniQuery = await db.collection(COLLECTIONS.CLIENTES)
      .where("dniRuc", "==", orderSync.buyerDni)
      .limit(1)
      .get();

    if (!dniQuery.empty) {
      const clienteId = dniQuery.docs[0].id;
      functions.logger.info(`ML: Cliente encontrado por DNI ${orderSync.buyerDni}`);
      await actualizarCliente(clienteId);
      return clienteId;
    }
  }

  // 1b. Buscar por teléfono (normalizado)
  if (orderSync.buyerPhone) {
    const phoneNormalized = orderSync.buyerPhone.replace(/\D/g, "");
    if (phoneNormalized.length >= 7) {
      const phoneQuery = await db.collection(COLLECTIONS.CLIENTES)
        .where("telefono", "==", phoneNormalized)
        .limit(1)
        .get();

      if (!phoneQuery.empty) {
        const clienteId = phoneQuery.docs[0].id;
        functions.logger.info(`ML: Cliente encontrado por teléfono ${phoneNormalized}`);
        await actualizarCliente(clienteId);
        return clienteId;
      }
    }
  }

  // 1c. Buscar por nombre exacto (case-insensitive via lowercase)
  if (orderSync.mlBuyerName) {
    const nombreLower = orderSync.mlBuyerName.toLowerCase().trim();
    const nameQuery = await db.collection(COLLECTIONS.CLIENTES)
      .where("nombreLowercase", "==", nombreLower)
      .limit(1)
      .get();

    if (!nameQuery.empty) {
      const clienteId = nameQuery.docs[0].id;
      functions.logger.info(`ML: Cliente encontrado por nombre '${orderSync.mlBuyerName}'`);
      await actualizarCliente(clienteId);
      return clienteId;
    }
  }

  // 1d. No encontrado — crear si autoCreateClientes está activo
  if (!config.autoCreateClientes) {
    functions.logger.info("ML: Cliente no encontrado y autoCreateClientes desactivado");
    return null;
  }

  // Generar código CLI-NNN
  const codigo = await generarCodigoCliente();

  // Buscar canal ML
  const canalMLId = await obtenerCanalML();

  const nuevoCliente: Record<string, any> = {
    codigo,
    nombre: nombreCompleto,
    nombreLowercase: nombreCompleto.toLowerCase().trim(),
    tipoCliente: esEmpresa ? "empresa" : "persona",
    tipoDocumento: orderSync.buyerDocType || null,
    dniRuc: orderSync.buyerDni || null,
    telefono: orderSync.buyerPhone ? orderSync.buyerPhone.replace(/\D/g, "") : null,
    email: orderSync.buyerEmail || null,
    canalOrigen: canalMLId,
    direcciones: [],
    estado: "activo",
    metricas: { totalCompras: 0, montoTotalPEN: 0, ticketPromedio: 0 },
    notas: "Creado automáticamente desde Mercado Libre",
    creadoPor: "ml-auto-processor",
    fechaCreacion: Timestamp.now(),
  };

  // Agregar dirección si existe
  if (orderSync.direccionEntrega) {
    nuevoCliente.direcciones = [{
      id: `dir-${Date.now()}`,
      etiqueta: "Mercado Libre",
      direccion: orderSync.direccionEntrega,
      distrito: orderSync.distrito || "",
      ciudad: orderSync.provincia || "",
      referencia: orderSync.referenciaEntrega || "",
      esPrincipal: true,
    }];
  }

  const clienteRef = await db.collection(COLLECTIONS.CLIENTES).add(nuevoCliente);
  functions.logger.info(`ML: Cliente creado ${codigo} (${clienteRef.id})`);
  return clienteRef.id;
}

// ============================================================
// PASO 2: CREAR VENTA
// ============================================================

async function crearVenta(
  orderSync: OrderSyncData,
  clienteId: string | null,
  canalMLId: string | null
): Promise<{ ventaId: string; numeroVenta: string; ventaData: Record<string, any>; alreadyExisted: boolean }> {
  // Generar número de venta VT-YYYY-NNN
  const numeroVenta = await generarNumeroVenta();

  // Resolver productos con datos completos del ERP
  const productosVenta: Record<string, any>[] = [];
  let subtotalPEN = 0;

  for (const prod of (orderSync.productos || [])) {
    let sku = prod.productoSku || "";
    let nombreComercial = prod.productoNombre || prod.mlTitle;
    let marca = "";
    let presentacion = "";

    // Obtener datos completos del producto ERP
    if (prod.productoId) {
      try {
        const prodDoc = await db.collection(COLLECTIONS.PRODUCTOS).doc(prod.productoId).get();
        if (prodDoc.exists) {
          const prodData = prodDoc.data()!;
          sku = prodData.sku || sku;
          nombreComercial = prodData.nombreComercial || nombreComercial;
          marca = prodData.marca || "";
          presentacion = prodData.presentacion || "";
        }
      } catch {
        // Usar datos del mapeo ML
      }
    }

    const subtotal = prod.cantidad * prod.precioUnitario;
    subtotalPEN += subtotal;

    productosVenta.push({
      productoId: prod.productoId || null,
      sku,
      nombreComercial,
      marca,
      presentacion,
      cantidad: prod.cantidad,
      cantidadAsignada: 0,
      precioUnitario: prod.precioUnitario,
      subtotal,
      unidadesAsignadas: [],
      costoTotalUnidades: 0,
      estadoAsignacion: "pendiente",
      mlItemId: prod.mlItemId,
      mlVariationId: prod.mlVariationId || null,
    });
  }

  // Calcular costos de envío según método:
  // - Urbano (ML envía): costoEnvioCliente ya fue reseteado a 0 en sync, cargoEnvioML tiene la deducción
  // - Flex (vendedor envía): costoEnvioCliente es ingreso (bonificación/cliente paga)
  const costoEnvio = orderSync.costoEnvioCliente || 0;
  const cargoEnvioML = orderSync.cargoEnvioML || 0;
  const totalPEN = subtotalPEN + costoEnvio;

  // Comisión ML como gasto de venta directo (para rentabilidad)
  // Nota: cargoEnvioML (Urbano) NO se registra aquí como gasto — se gestiona
  // al asignar transportista en el módulo de entregas para evitar duplicidad
  const comisionML = orderSync.comisionML || 0;
  const comisionMLPorcentaje = totalPEN > 0 ? (comisionML / totalPEN) * 100 : 0;
  const gastosVentaPEN = comisionML;

  const ventaData: Record<string, any> = {
    numeroVenta,
    nombreCliente: orderSync.mlBuyerName ? toTitleCase(orderSync.mlBuyerName) : "Cliente ML",
    clienteId: clienteId || null,
    emailCliente: orderSync.buyerEmail || null,
    telefonoCliente: orderSync.buyerPhone || null,
    direccionEntrega: orderSync.direccionEntrega || "",
    distrito: orderSync.distrito || "",
    provincia: orderSync.provincia || "",
    codigoPostal: orderSync.codigoPostal || null,
    referencia: orderSync.referenciaEntrega || null,
    coordenadas: orderSync.coordenadas || null,
    dniRuc: orderSync.buyerDni || null,
    canal: canalMLId || "mercado_libre",
    canalNombre: "Mercado Libre",
    productos: productosVenta,
    subtotalPEN,
    costoEnvio,
    incluyeEnvio: false,
    totalPEN,
    moneda: "PEN",
    // Campos de gastos directos en la venta (para rentabilidad)
    comisionML,
    comisionMLPorcentaje,
    cargoEnvioML,
    metodoEnvio: orderSync.metodoEnvio || null,
    gastosVentaPEN,
    // Estado de pago
    estadoPago: "pendiente",
    pagos: [],
    montoPagado: 0,
    montoPendiente: totalPEN,
    // Estado general
    estado: "confirmada",
    mlOrderId: orderSync.mlOrderId,
    mercadoLibreId: String(orderSync.mlOrderId),
    // Pack order fields (compra multi-producto en un solo carrito)
    ...(orderSync.packId ? {
      packId: orderSync.packId,
      subOrderIds: orderSync.subOrderIds || [],
    } : {}),
    observaciones: orderSync.packId
      ? `Pack ML #${orderSync.packId} (sub-órdenes: ${(orderSync.subOrderIds || []).join(", ")}) - Procesada automáticamente`
      : `Orden ML #${orderSync.mlOrderId} - Procesada automáticamente`,
    creadoPor: "ml-auto-processor",
    fechaCreacion: Timestamp.now(),
    fechaConfirmacion: Timestamp.now(),
    // Rentabilidad (se actualiza en FEFO)
    costoTotalPEN: 0,
    utilidadBrutaPEN: 0,
    utilidadNetaPEN: 0,
    margenBruto: 0,
    margenNeto: 0,
  };

  // ID determinístico para prevenir duplicados por race condition
  // Si dos procesos concurrentes llegan aquí, .create() falla atómicamente para el segundo
  const deterministicId = orderSync.packId
    ? `venta-ml-pack-${orderSync.packId}`
    : `venta-ml-${orderSync.mlOrderId}`;
  const ventaRef = db.collection(COLLECTIONS.VENTAS).doc(deterministicId);

  try {
    await ventaRef.create(ventaData);
  } catch (err: any) {
    // Si ya existe (ALREADY_EXISTS), otro proceso ya creó la venta — retornar la existente
    if (err.code === 6 || err.code === "already-exists" || err.message?.includes("ALREADY_EXISTS")) {
      const existing = await ventaRef.get();
      if (existing.exists) {
        functions.logger.warn(
          `ML Order ${orderSync.mlOrderId}: venta ${deterministicId} ya existía (race condition prevenida)`
        );
        return {
          ventaId: existing.id,
          numeroVenta: existing.data()!.numeroVenta,
          ventaData: existing.data()! as Record<string, any>,
          alreadyExisted: true,
        };
      }
    }
    throw err;
  }

  return { ventaId: ventaRef.id, numeroVenta, ventaData, alreadyExisted: false };
}

// ============================================================
// PASO 3: REGISTRAR PAGO COMPLETO + TESORERÍA
// ============================================================

async function registrarPagoCompleto(
  ventaId: string,
  ventaData: Record<string, any>,
  orderSync: OrderSyncData
): Promise<string | null> {
  const totalPEN = ventaData.totalPEN;
  const numeroVenta = ventaData.numeroVenta;

  // Guard: verificar que no exista ya un pago para esta venta
  const ventaActual = await db.collection(COLLECTIONS.VENTAS).doc(ventaId).get();
  if (ventaActual.exists) {
    const vData = ventaActual.data();
    if (vData?.estadoPago === "pagado" || (vData?.montoPagado || 0) >= totalPEN) {
      functions.logger.warn(
        `ML Order ${orderSync.mlOrderId}: Pago ya registrado para ${numeroVenta} (estadoPago=${vData?.estadoPago}, montoPagado=${vData?.montoPagado}), skip`
      );
      return await buscarCuentaMercadoPago();
    }
  }

  // Crear PagoVenta
  const pagoId = `PAG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nuevoPago = {
    id: pagoId,
    monto: totalPEN,
    metodoPago: "mercado_pago",
    tipoPago: "pago",
    referencia: `ML-${orderSync.mlOrderId}`,
    fecha: Timestamp.now(),
    registradoPor: "ml-auto-processor",
    notas: "Pago recibido via Mercado Libre",
  };

  // Actualizar venta con pago
  await db.collection(COLLECTIONS.VENTAS).doc(ventaId).update({
    pagos: admin.firestore.FieldValue.arrayUnion(nuevoPago),
    montoPagado: totalPEN,
    montoPendiente: 0,
    estadoPago: "pagado",
    fechaPagoCompleto: Timestamp.now(),
  });

  // Buscar cuenta MercadoPago en tesorería
  const cuentaMPId = await buscarCuentaMercadoPago();
  if (!cuentaMPId) {
    functions.logger.warn("ML: No se encontró cuenta MercadoPago en tesorería");
    return null;
  }

  // Obtener tipo de cambio actual
  const tc = await obtenerTipoCambio();

  // Crear movimiento de tesorería (ingreso_venta)
  const movimientoIngreso: Record<string, any> = {
    numeroMovimiento: `MOV-ml-${Date.now()}`,
    tipo: "ingreso_venta",
    estado: "ejecutado",
    moneda: "PEN",
    monto: totalPEN,
    tipoCambio: tc,
    metodo: "mercado_pago",
    concepto: `Pago venta ${numeroVenta} - ML #${orderSync.mlOrderId}`,
    ventaId,
    ventaNumero: numeroVenta,
    cuentaDestino: cuentaMPId,
    fecha: Timestamp.now(),
    creadoPor: "ml-auto-processor",
    fechaCreacion: Timestamp.now(),
  };

  await db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA).add(movimientoIngreso);

  // Actualizar saldo de la cuenta MP
  await db.collection(COLLECTIONS.CUENTAS_CAJA).doc(cuentaMPId).update({
    saldoActual: admin.firestore.FieldValue.increment(totalPEN),
  });

  functions.logger.info(`ML: Pago S/ ${totalPEN} registrado → cuenta MP ${cuentaMPId}`);
  return cuentaMPId;
}

// ============================================================
// PASO 4: ASIGNAR INVENTARIO FEFO
// ============================================================

async function asignarInventarioFEFO(
  ventaId: string,
  ventaData: Record<string, any>,
  orderSync: OrderSyncData
): Promise<void> {
  const productos = ventaData.productos || [];
  let costoTotalPEN = 0;
  let todasAsignadas = true;
  const productosActualizados = [...productos];
  const tc = await obtenerTipoCambio();

  for (let i = 0; i < productosActualizados.length; i++) {
    const prod = productosActualizados[i];
    if (!prod.productoId) {
      todasAsignadas = false;
      continue;
    }

    // Query unidades disponibles, ordenadas por fecha de vencimiento (FEFO)
    const unidadesQuery = await db.collection(COLLECTIONS.UNIDADES)
      .where("productoId", "==", prod.productoId)
      .where("estado", "==", "disponible_peru")
      .orderBy("fechaVencimiento", "asc")
      .limit(prod.cantidad * 2) // Margen para filtrar reservadas
      .get();

    // Filtrar las que ya están reservadas para otra venta
    const disponibles = unidadesQuery.docs.filter((doc) => {
      const data = doc.data();
      return !data.reservadaPara || data.reservadaPara === ventaId;
    });

    const unidadesAReservar = disponibles.slice(0, prod.cantidad);
    const cantidadAsignada = unidadesAReservar.length;
    const unidadesIds: string[] = [];
    let costoProducto = 0;

    // Reservar unidades y calcular CTRU
    const batch = db.batch();
    for (const uDoc of unidadesAReservar) {
      const uData = uDoc.data();

      // Calcular CTRU de la unidad
      let ctru = 0;
      if (uData.ctruDinamico) {
        ctru = uData.ctruDinamico;
      } else {
        const costoBase = (uData.costoUnitarioUSD || 0) + (uData.costoFleteUSD || 0);
        const tcUnidad = uData.tcPago || uData.tcCompra || tc;
        ctru = costoBase * tcUnidad;
      }

      costoProducto += ctru;
      unidadesIds.push(uDoc.id);

      batch.update(uDoc.ref, {
        estado: "reservada",
        reservadaPara: ventaId,
        fechaReserva: Timestamp.now(),
      });
    }

    await batch.commit();

    // Actualizar producto en venta
    productosActualizados[i] = {
      ...prod,
      cantidadAsignada,
      unidadesAsignadas: unidadesIds,
      costoTotalUnidades: costoProducto,
      estadoAsignacion: cantidadAsignada >= prod.cantidad ? "completa" : "parcial",
    };

    costoTotalPEN += costoProducto;

    if (cantidadAsignada < prod.cantidad) {
      todasAsignadas = false;
      functions.logger.warn(
        `ML FEFO: Producto ${prod.sku} - asignadas ${cantidadAsignada}/${prod.cantidad}`
      );
    }

    // Sincronizar stock del producto en ERP
    try {
      await sincronizarStockProducto(prod.productoId);
    } catch {
      // No crítico
    }

    // Sincronizar stock hacia ML (push ERP → ML)
    try {
      await sincronizarStockHaciaML(prod.productoId);
    } catch (err: any) {
      functions.logger.warn(`ML Stock sync failed for ${prod.productoId}: ${err.message}`);
    }
  }

  // Calcular rentabilidad
  const totalPEN = ventaData.totalPEN;
  const gastosVentaPEN = ventaData.gastosVentaPEN || 0;
  const utilidadBrutaPEN = totalPEN - costoTotalPEN;
  const utilidadNetaPEN = utilidadBrutaPEN - gastosVentaPEN;
  const margenBruto = totalPEN > 0 ? (utilidadBrutaPEN / totalPEN) * 100 : 0;
  const margenNeto = totalPEN > 0 ? (utilidadNetaPEN / totalPEN) * 100 : 0;

  // Actualizar venta con productos asignados y rentabilidad
  await db.collection(COLLECTIONS.VENTAS).doc(ventaId).update({
    productos: productosActualizados,
    estado: todasAsignadas ? "asignada" : "confirmada",
    costoTotalPEN,
    utilidadBrutaPEN,
    utilidadNetaPEN,
    margenBruto,
    margenNeto,
    ...(todasAsignadas ? { fechaAsignacion: Timestamp.now() } : {}),
  });

  functions.logger.info(
    `ML FEFO: Asignación ${todasAsignadas ? "completa" : "parcial"} - ` +
    `Costo: S/ ${costoTotalPEN.toFixed(2)}, Margen: ${margenNeto.toFixed(1)}%`
  );
}

// ============================================================
// PASO 5: REGISTRAR GASTOS ML
// ============================================================

async function registrarGastosML(
  ventaId: string,
  numeroVenta: string,
  orderSync: OrderSyncData,
  cuentaMPId: string | null
): Promise<void> {
  const comisionML = orderSync.comisionML;

  if (comisionML <= 0 && (orderSync.cargoEnvioML || 0) <= 0) return;

  const tc = await obtenerTipoCambio();
  const now = Timestamp.now();
  const fecha = now.toDate();
  const mes = fecha.getMonth() + 1;
  const anio = fecha.getFullYear();

  // --- Gasto 1: Comisión ML ---
  if (comisionML > 0) {
    // Guard: verificar que no exista ya un gasto GV comision_ml para esta venta
    const existingGV = await db.collection(COLLECTIONS.GASTOS)
      .where("ventaId", "==", ventaId)
      .where("tipo", "==", "comision_ml")
      .limit(1)
      .get();
    if (!existingGV.empty) {
      functions.logger.info(
        `ML Gasto: Comisión ML ya registrada para ${numeroVenta} (${existingGV.docs[0].id}), skip`
      );
    } else {
    const numeroGasto = await generarNumeroGasto();
    const hasCuenta = !!cuentaMPId;

    const gastoData: Record<string, any> = {
      numeroGasto,
      tipo: "comision_ml",
      categoria: "GV",
      claseGasto: "GVD",
      descripcion: `Comisión ML - Orden #${orderSync.mlOrderId} - ${numeroVenta}`,
      moneda: "PEN",
      montoOriginal: comisionML,
      montoPEN: comisionML,
      tipoCambio: tc,
      esProrrateable: false,
      ventaId,
      ventaNumero: numeroVenta,
      mes,
      anio,
      fecha: now,
      esRecurrente: false,
      frecuencia: "unico",
      estado: hasCuenta ? "pagado" : "pendiente",
      impactaCTRU: false,
      ctruRecalculado: true,
      montoPagado: hasCuenta ? comisionML : 0,
      montoPendiente: hasCuenta ? 0 : comisionML,
      creadoPor: "ml-auto-processor",
      fechaCreacion: now,
    };

    // Solo agregar pago y movimiento de tesorería si hay cuenta MP
    if (hasCuenta) {
      const pagoGastoId = `PAG-GAS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      gastoData.pagos = [{
        id: pagoGastoId,
        fecha: now,
        monedaPago: "PEN",
        montoOriginal: comisionML,
        montoPEN: comisionML,
        tipoCambio: tc,
        metodoPago: "mercado_pago",
        cuentaOrigenId: cuentaMPId,
        registradoPor: "ml-auto-processor",
      }];
    }

    const gastoRef = await db.collection(COLLECTIONS.GASTOS).add(gastoData);

    if (hasCuenta) {
      await db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA).add({
        numeroMovimiento: `MOV-mlgas-${Date.now()}`,
        tipo: "gasto_operativo",
        estado: "ejecutado",
        moneda: "PEN",
        monto: comisionML,
        tipoCambio: tc,
        metodo: "mercado_pago",
        concepto: `Comisión ML - ${numeroVenta} - Orden #${orderSync.mlOrderId}`,
        gastoId: gastoRef.id,
        gastoNumero: numeroGasto,
        ventaId,
        ventaNumero: numeroVenta,
        cuentaOrigen: cuentaMPId,
        fecha: now,
        creadoPor: "ml-auto-processor",
        fechaCreacion: now,
      });

      await db.collection(COLLECTIONS.CUENTAS_CAJA).doc(cuentaMPId!).update({
        saldoActual: admin.firestore.FieldValue.increment(-comisionML),
      });
    }

    functions.logger.info(
      `ML Gasto: Comisión S/ ${comisionML.toFixed(2)} → ${numeroGasto}` +
      (hasCuenta ? " | Egreso de cuenta MP" : " | SIN cuenta MP (gasto pendiente)")
    );
    } // cierre del else (gasto no existía)
  }

  // --- Gasto 2: Cargo envío ML (Urbano) ---
  // ML retiene el cargoEnvioML del pago al vendedor para órdenes Urbano.
  // Registrar como gasto para que el saldo de MP refleje la retención real.
  const cargoEnvioML = orderSync.cargoEnvioML || 0;
  if (cargoEnvioML > 0) {
    // Guard: verificar que no exista ya un gasto cargo_envio_ml para esta venta
    const existingEnvioGV = await db.collection(COLLECTIONS.GASTOS)
      .where("ventaId", "==", ventaId)
      .where("tipo", "==", "cargo_envio_ml")
      .limit(1)
      .get();
    if (!existingEnvioGV.empty) {
      functions.logger.info(
        `ML Gasto: Cargo envío ML ya registrado para ${numeroVenta} (${existingEnvioGV.docs[0].id}), skip`
      );
    } else {
    const tc2 = await obtenerTipoCambio();
    const now2 = Timestamp.now();
    const fecha2 = now2.toDate();
    const numGastoEnvio = await generarNumeroGasto();
    const hasCuenta = !!cuentaMPId;

    const gastoEnvioData: Record<string, any> = {
      numeroGasto: numGastoEnvio,
      tipo: "cargo_envio_ml",
      categoria: "GV",
      claseGasto: "GVD",
      descripcion: `Cargo envío ML (Urbano) - Orden #${orderSync.mlOrderId} - ${numeroVenta}`,
      moneda: "PEN",
      montoOriginal: cargoEnvioML,
      montoPEN: cargoEnvioML,
      tipoCambio: tc2,
      esProrrateable: false,
      ventaId,
      ventaNumero: numeroVenta,
      mes: fecha2.getMonth() + 1,
      anio: fecha2.getFullYear(),
      fecha: now2,
      esRecurrente: false,
      frecuencia: "unico",
      estado: hasCuenta ? "pagado" : "pendiente",
      impactaCTRU: false,
      ctruRecalculado: true,
      montoPagado: hasCuenta ? cargoEnvioML : 0,
      montoPendiente: hasCuenta ? 0 : cargoEnvioML,
      creadoPor: "ml-auto-processor",
      fechaCreacion: now2,
    };

    if (hasCuenta) {
      const pagoGastoEnvioId = `PAG-GAS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      gastoEnvioData.pagos = [{
        id: pagoGastoEnvioId,
        fecha: now2,
        monedaPago: "PEN",
        montoOriginal: cargoEnvioML,
        montoPEN: cargoEnvioML,
        tipoCambio: tc2,
        metodoPago: "mercado_pago",
        cuentaOrigenId: cuentaMPId,
        registradoPor: "ml-auto-processor",
      }];
    }

    const gastoEnvioRef = await db.collection(COLLECTIONS.GASTOS).add(gastoEnvioData);

    if (hasCuenta) {
      await db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA).add({
        numeroMovimiento: `MOV-mlenv-${Date.now()}`,
        tipo: "gasto_operativo",
        estado: "ejecutado",
        moneda: "PEN",
        monto: cargoEnvioML,
        tipoCambio: tc2,
        metodo: "mercado_pago",
        concepto: `Cargo envío ML (Urbano) - ${numeroVenta} - Orden #${orderSync.mlOrderId}`,
        gastoId: gastoEnvioRef.id,
        gastoNumero: numGastoEnvio,
        ventaId,
        ventaNumero: numeroVenta,
        cuentaOrigen: cuentaMPId,
        fecha: now2,
        creadoPor: "ml-auto-processor",
        fechaCreacion: now2,
      });

      await db.collection(COLLECTIONS.CUENTAS_CAJA).doc(cuentaMPId!).update({
        saldoActual: admin.firestore.FieldValue.increment(-cargoEnvioML),
      });
    }

    // Actualizar gastosVentaPEN en la venta para incluir envío
    await db.collection(COLLECTIONS.VENTAS).doc(ventaId).update({
      cargoEnvioMLRegistrado: true,
      gastosVentaPEN: admin.firestore.FieldValue.increment(cargoEnvioML),
    });

    functions.logger.info(
      `ML Gasto: Cargo envío Urbano S/ ${cargoEnvioML.toFixed(2)} → ${numGastoEnvio}` +
      (hasCuenta ? " | Egreso de cuenta MP" : " | SIN cuenta MP (gasto pendiente)")
    );
    } // cierre del else (gasto envío no existía)
  }
}

// ============================================================
// HELPERS
// ============================================================

async function generarNumeroVenta(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VT-${year}-`;
  const counterRef = db.collection(COLLECTIONS.COUNTERS).doc(`ventas-${year}`);

  // Transacción atómica para prevenir números duplicados bajo concurrencia
  const nextNum = await db.runTransaction(async (tx) => {
    const counterDoc = await tx.get(counterRef);
    let current = 0;

    if (counterDoc.exists) {
      current = counterDoc.data()!.lastNumber || 0;
    } else {
      // Inicializar: buscar el último número de venta existente
      const lastVenta = await db.collection(COLLECTIONS.VENTAS)
        .where("numeroVenta", ">=", prefix)
        .where("numeroVenta", "<=", prefix + "\uf8ff")
        .orderBy("numeroVenta", "desc")
        .limit(1)
        .get();

      if (!lastVenta.empty) {
        const lastNumero = lastVenta.docs[0].data().numeroVenta as string;
        const numPart = parseInt(lastNumero.replace(prefix, ""), 10);
        if (!isNaN(numPart)) current = numPart;
      }
    }

    const next = current + 1;
    tx.set(counterRef, { lastNumber: next, year, updatedAt: admin.firestore.Timestamp.now() });
    return next;
  });

  return `${prefix}${String(nextNum).padStart(3, "0")}`;
}

async function generarCodigoCliente(): Promise<string> {
  const prefix = "CLI-";

  const lastCliente = await db.collection(COLLECTIONS.CLIENTES)
    .where("codigo", ">=", prefix)
    .where("codigo", "<=", prefix + "\uf8ff")
    .orderBy("codigo", "desc")
    .limit(1)
    .get();

  let nextNum = 1;
  if (!lastCliente.empty) {
    const lastCodigo = lastCliente.docs[0].data().codigo as string;
    const numPart = parseInt(lastCodigo.replace(prefix, ""), 10);
    if (!isNaN(numPart)) nextNum = numPart + 1;
  }

  return `${prefix}${String(nextNum).padStart(3, "0")}`;
}

async function generarNumeroGasto(): Promise<string> {
  const prefix = "GAS-";

  const lastGasto = await db.collection(COLLECTIONS.GASTOS)
    .where("numeroGasto", ">=", prefix)
    .where("numeroGasto", "<=", prefix + "\uf8ff")
    .orderBy("numeroGasto", "desc")
    .limit(1)
    .get();

  let nextNum = 1;
  if (!lastGasto.empty) {
    const lastNumero = lastGasto.docs[0].data().numeroGasto as string;
    const numPart = parseInt(lastNumero.replace(prefix, ""), 10);
    if (!isNaN(numPart)) nextNum = numPart + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

async function obtenerCanalML(): Promise<string | null> {
  const canalQuery = await db.collection(COLLECTIONS.CANALES_VENTA)
    .where("nombre", "==", "Mercado Libre")
    .limit(1)
    .get();

  if (!canalQuery.empty) return canalQuery.docs[0].id;

  // Fallback: buscar por código
  const canalCodeQuery = await db.collection(COLLECTIONS.CANALES_VENTA)
    .where("codigo", "==", "CV-002")
    .limit(1)
    .get();

  return canalCodeQuery.empty ? null : canalCodeQuery.docs[0].id;
}

// ============================================================
// CORRECCIÓN DE COMISIÓN ML (POST-PROCESAMIENTO)
// ============================================================

/**
 * Corrige la comisión ML de una venta ya procesada.
 * Crea el gasto si no existía, o lo actualiza si la comisión cambió.
 * Llamado por:
 *  - processOrderNotification (re-notificación con fee actualizado)
 *  - reenrichBuyerData (corrección manual)
 */
export async function corregirComisionML(
  ventaId: string,
  numeroVenta: string,
  mlOrderId: number,
  nuevaComision: number,
  orderSyncRef: FirebaseFirestore.DocumentReference
): Promise<void> {
  if (nuevaComision <= 0) return;

  const ventaRef = db.collection(COLLECTIONS.VENTAS).doc(ventaId);
  const ventaDoc = await ventaRef.get();
  if (!ventaDoc.exists) return;

  const ventaData = ventaDoc.data()!;
  const ventaComision = ventaData.comisionML || 0;
  const diff = nuevaComision - ventaComision;

  // Verificar si el gasto GV existe antes de decidir si saltamos
  const gastosCheckQuery = await db.collection(COLLECTIONS.GASTOS)
    .where("ventaId", "==", ventaId)
    .where("tipo", "==", "comision_ml")
    .limit(1)
    .get();
  const gastoExiste = !gastosCheckQuery.empty;

  // Si la comisión no cambió Y el gasto ya existe, no hacer nada
  if (Math.abs(diff) < 0.01 && gastoExiste) return;

  // Si la comisión no cambió pero el gasto NO existe, necesitamos crearlo
  if (Math.abs(diff) < 0.01 && !gastoExiste) {
    functions.logger.info(
      `ML Comisión: Gasto GV faltante para ${numeroVenta} (comision=${nuevaComision}), creando...`
    );
  }

  const tc = await obtenerTipoCambio();
  const now = Timestamp.now();

  // 1. Actualizar la venta
  const totalPEN = ventaData.totalPEN || 0;
  const newComisionPct = totalPEN > 0 ? (nuevaComision / totalPEN) * 100 : 0;
  await ventaRef.update({
    comisionML: nuevaComision,
    comisionMLPorcentaje: newComisionPct,
    gastosVentaPEN: nuevaComision + (ventaData.costoEnvioNegocio || 0) + (ventaData.otrosGastosVenta || 0),
  });

  // 2. Reusar la query de verificación de arriba
  const gastosQuery = gastosCheckQuery;

  const cuentaMPId = await buscarCuentaMercadoPago();

  if (!gastosQuery.empty) {
    // Gasto existe → actualizar montos
    const gastoDoc = gastosQuery.docs[0];
    const gastoData = gastoDoc.data();
    await gastoDoc.ref.update({
      montoOriginal: nuevaComision,
      montoPEN: nuevaComision,
      montoPagado: nuevaComision,
      montoPendiente: 0,
      "pagos.0.montoOriginal": nuevaComision,
      "pagos.0.montoPEN": nuevaComision,
    });

    // Actualizar movimiento de tesorería
    const movQuery = await db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA)
      .where("gastoId", "==", gastoDoc.id)
      .limit(1)
      .get();
    if (!movQuery.empty) {
      await movQuery.docs[0].ref.update({ monto: nuevaComision });
    }

    // Ajustar saldo de la cuenta (diff negativo = más gasto)
    const cuentaId = gastoData.pagos?.[0]?.cuentaOrigenId || cuentaMPId;
    if (cuentaId) {
      await db.collection(COLLECTIONS.CUENTAS_CAJA).doc(cuentaId).update({
        saldoActual: admin.firestore.FieldValue.increment(-diff),
      });
    }

    functions.logger.info(
      `ML Comisión Corregida: ${ventaComision} → ${nuevaComision} (diff ${diff > 0 ? "+" : ""}${diff.toFixed(2)}) | ${numeroVenta}`
    );
  } else {
    // Gasto NO existe → crearlo (fee llegó después de la venta, o se perdió en procesamiento original)
    const fecha = now.toDate();
    const mes = fecha.getMonth() + 1;
    const anio = fecha.getFullYear();
    const numeroGasto = await generarNumeroGasto();
    const hasCuenta = !!cuentaMPId;

    const gastoData: Record<string, any> = {
      numeroGasto,
      tipo: "comision_ml",
      categoria: "GV",
      claseGasto: "GVD",
      descripcion: `Comisión ML - Orden #${mlOrderId} - ${numeroVenta}`,
      moneda: "PEN",
      montoOriginal: nuevaComision,
      montoPEN: nuevaComision,
      tipoCambio: tc,
      esProrrateable: false,
      ventaId,
      ventaNumero: numeroVenta,
      mes,
      anio,
      fecha: now,
      esRecurrente: false,
      frecuencia: "unico",
      estado: hasCuenta ? "pagado" : "pendiente",
      impactaCTRU: false,
      ctruRecalculado: true,
      montoPagado: hasCuenta ? nuevaComision : 0,
      montoPendiente: hasCuenta ? 0 : nuevaComision,
      creadoPor: "ml-auto-processor",
      fechaCreacion: now,
    };

    if (hasCuenta) {
      const pagoGastoId = `PAG-GAS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      gastoData.pagos = [{
        id: pagoGastoId,
        fecha: now,
        monedaPago: "PEN",
        montoOriginal: nuevaComision,
        montoPEN: nuevaComision,
        tipoCambio: tc,
        metodoPago: "mercado_pago",
        cuentaOrigenId: cuentaMPId,
        registradoPor: "ml-auto-processor",
      }];
    }

    const gastoRef = await db.collection(COLLECTIONS.GASTOS).add(gastoData);

    if (hasCuenta) {
      await db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA).add({
        numeroMovimiento: `MOV-mlgas-${Date.now()}`,
        tipo: "gasto_operativo",
        estado: "ejecutado",
        moneda: "PEN",
        monto: nuevaComision,
        tipoCambio: tc,
        metodo: "mercado_pago",
        concepto: `Comisión ML - ${numeroVenta} - Orden #${mlOrderId}`,
        gastoId: gastoRef.id,
        gastoNumero: numeroGasto,
        ventaId,
        ventaNumero: numeroVenta,
        cuentaOrigen: cuentaMPId,
        fecha: now,
        creadoPor: "ml-auto-processor",
        fechaCreacion: now,
      });

      await db.collection(COLLECTIONS.CUENTAS_CAJA).doc(cuentaMPId!).update({
        saldoActual: admin.firestore.FieldValue.increment(-nuevaComision),
      });
    }

    functions.logger.info(
      `ML Comisión Retroactiva: S/ ${nuevaComision.toFixed(2)} → ${numeroGasto} | ${numeroVenta}` +
      (hasCuenta ? " | Egreso cuenta MP" : " | SIN cuenta MP (gasto pendiente)")
    );
  }

  // Actualizar mlOrderSync con la comisión correcta
  await orderSyncRef.update({ comisionML: nuevaComision });
}

async function buscarCuentaMercadoPago(): Promise<string | null> {
  // 1. Buscar cuenta por defecto con método mercado_pago
  const defaultQuery = await db.collection(COLLECTIONS.CUENTAS_CAJA)
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("esCuentaPorDefecto", "==", true)
    .where("activa", "==", true)
    .limit(1)
    .get();

  if (!defaultQuery.empty) return defaultQuery.docs[0].id;

  // 2. Cualquier cuenta mercado_pago activa
  const mpQuery = await db.collection(COLLECTIONS.CUENTAS_CAJA)
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("activa", "==", true)
    .limit(1)
    .get();

  if (!mpQuery.empty) return mpQuery.docs[0].id;

  // 3. Fallback: cualquier cuenta activa que acepte PEN
  const fallbackQuery = await db.collection(COLLECTIONS.CUENTAS_CAJA)
    .where("activa", "==", true)
    .limit(1)
    .get();

  return fallbackQuery.empty ? null : fallbackQuery.docs[0].id;
}

// obtenerTipoCambio eliminada — usa resolverTCVenta de tipoCambio.util.ts
const obtenerTipoCambio = resolverTCVenta;

async function sincronizarStockProducto(productoId: string): Promise<void> {
  // Recálculo COMPLETO de stock — misma lógica que inventario.service.ts
  const allUnitsQuery = await db.collection(COLLECTIONS.UNIDADES)
    .where("productoId", "==", productoId)
    .get();

  let stockUSA = 0;
  let stockPeru = 0;
  let stockTransito = 0;
  let stockReservado = 0;
  let stockDisponible = 0;
  let stockDisponiblePeru = 0;

  for (const doc of allUnitsQuery.docs) {
    const unidad = doc.data();
    switch (unidad.estado) {
      case "recibida_origen":
      case "recibida_usa":
        stockUSA++;
        stockDisponible++;
        break;
      case "disponible_peru":
        stockPeru++;
        stockDisponible++;
        stockDisponiblePeru++;
        break;
      case "en_transito_origen":
      case "en_transito_usa":
      case "en_transito_peru":
        stockTransito++;
        break;
      case "reservada":
      case "asignada_pedido":
        stockReservado++;
        if (unidad.pais === "USA") {
          stockUSA++;
        } else {
          stockPeru++;
        }
        break;
      // Estados terminales no cuentan
      case "vendida":
      case "vencida":
      case "danada":
        break;
    }
  }

  // Leer stockPendienteML actual para calcular stockEfectivoML
  const productoDocSnap = await db.collection(COLLECTIONS.PRODUCTOS).doc(productoId).get();
  const stockPendienteML = productoDocSnap.data()?.stockPendienteML || 0;
  const stockEfectivoML = Math.max(0, stockDisponiblePeru - stockPendienteML);

  await db.collection(COLLECTIONS.PRODUCTOS).doc(productoId).update({
    stockUSA,
    stockPeru,
    stockTransito,
    stockReservado,
    stockDisponible,
    stockDisponiblePeru,
    stockEfectivoML,
    ultimaActualizacionStock: Timestamp.now(),
  });
}

/**
 * Pushea el stock actualizado del ERP hacia todas las publicaciones ML vinculadas.
 * Usa stockEfectivoML (disponible - pendientes ML) para evitar overselling.
 */
async function sincronizarStockHaciaML(productoId: string): Promise<void> {
  // Buscar publicaciones ML vinculadas a este producto
  const mapQuery = await db.collection(COLLECTIONS.ML_PRODUCT_MAP)
    .where("productoId", "==", productoId)
    .where("vinculado", "==", true)
    .get();

  if (mapQuery.empty) return;

  // Leer stockEfectivoML del doc producto (ya calculado por sincronizarStockProducto)
  const productoDoc = await db.collection(COLLECTIONS.PRODUCTOS).doc(productoId).get();
  const pData = productoDoc.data();
  const erpStock = pData?.stockEfectivoML ?? pData?.stockDisponiblePeru ?? 0;

  // Push a ML via API
  const { updateItemStock } = await import("./ml.api");

  for (const mapDoc of mapQuery.docs) {
    const map = mapDoc.data();
    try {
      await updateItemStock(map.mlItemId, erpStock);
      await mapDoc.ref.update({
        mlAvailableQuantity: erpStock,
        fechaSync: Timestamp.now(),
      });
      functions.logger.info(
        `ML Stock Push: ${map.mlItemId} → ${erpStock} unidades (producto ${productoId})`
      );
    } catch (err: any) {
      functions.logger.warn(`ML Stock Push failed ${map.mlItemId}: ${err.message}`);
    }
    // Rate limit
    await new Promise((r) => setTimeout(r, 200));
  }
}
