/**
 * ML Sync Service - Traductor de datos ML → ERP
 *
 * Este módulo traduce la información de Mercado Libre
 * al formato que el sistema ERP (BusinessMN) ya espera.
 * El ERP es el sistema maestro — ML solo alimenta datos.
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { resolverTCVenta } from "../tipoCambio.util";
import {
  getSellerItems,
  getItems,
  getUser,
  getOrder,
  getOrderBillingInfo,
  getShipment,
  getPackOrders,
  searchOrders,
  getItemPriceToWin,
} from "./ml.api";
import {
  MLOrder,
  MLShipment,
  MLOrderSync,
  MLProductMap,
} from "./ml.types";
import { corregirComisionML } from "./ml.orderProcessor";
import { COLLECTIONS } from "../collections";

const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

// ============================================================
// SYNC DE ITEMS (Productos ML → Mapeo local)
// ============================================================

/**
 * Sincroniza TODOS los items publicados del seller en ML
 * con la colección mlProductMap en Firestore.
 *
 * NO crea productos en el ERP — solo crea el registro de mapeo
 * para que el usuario vincule manualmente cada item ML con su productoId.
 */
export async function syncAllItems(sellerId: number): Promise<{
  total: number;
  nuevos: number;
  actualizados: number;
}> {
  let offset = 0;
  const limit = 50;
  let total = 0;
  let nuevos = 0;
  let actualizados = 0;
  const allItemIds: string[] = [];

  // 1. Obtener todos los item IDs del seller (paginado)
  while (true) {
    const searchResult = await getSellerItems(sellerId, offset, limit);
    allItemIds.push(...searchResult.results);
    total = searchResult.paging.total;

    if (offset + limit >= total) break;
    offset += limit;
  }

  functions.logger.info(`ML Sync: ${allItemIds.length} items encontrados para seller ${sellerId}`);

  // 2. Obtener detalles de items en lotes de 20 (límite de multiget)
  for (let i = 0; i < allItemIds.length; i += 20) {
    const batch = allItemIds.slice(i, i + 20);
    const itemsResponse = await getItems(batch);

    for (const itemResult of itemsResponse) {
      if (itemResult.code !== 200) continue;

      const item = itemResult.body;

      // Buscar SKU en attributes
      const skuAttr = item.attributes?.find(
        (a) => a.id === "SELLER_SKU" || a.id === "SELLER_CUSTOM_FIELD"
      );
      const sku = item.seller_custom_field || skuAttr?.value_name || null;

      // Buscar si ya existe en el mapeo
      const existingQuery = await db
        .collection(COLLECTIONS.ML_PRODUCT_MAP)
        .where("mlItemId", "==", item.id)
        .limit(1)
        .get();

      const mapData: Partial<MLProductMap> = {
        mlItemId: item.id,
        mlTitle: item.title,
        mlPrice: item.price,
        mlThumbnail: item.thumbnail,
        mlPermalink: item.permalink,
        mlSku: sku,
        mlAvailableQuantity: item.available_quantity,
        mlStatus: item.status,
        mlCatalogProductId: item.catalog_product_id || null,
        mlListingTypeId: item.listing_type_id || null,
        mlListingType: item.catalog_listing === true ? "catalogo" : "clasica",
        skuGroupKey: sku || item.catalog_product_id || null,
        fechaSync: admin.firestore.Timestamp.now(),
      };

      if (existingQuery.empty) {
        // Nuevo item — intentar auto-vincular por SKU
        let autoVinculado = false;
        let productoId: string | null = null;
        let productoSku: string | null = null;
        let productoNombre: string | null = null;

        if (sku) {
          // Buscar producto en ERP por SKU
          const productoQuery = await db
            .collection(COLLECTIONS.PRODUCTOS)
            .where("sku", "==", sku)
            .limit(1)
            .get();

          if (!productoQuery.empty) {
            const producto = productoQuery.docs[0];
            productoId = producto.id;
            productoSku = producto.data().sku;
            productoNombre = producto.data().nombreComercial || producto.data().sku;
            autoVinculado = true;
            functions.logger.info(`ML Sync: Auto-vinculado ${item.id} → ${productoSku} por SKU`);
          }
        }

        await db.collection(COLLECTIONS.ML_PRODUCT_MAP).add({
          ...mapData,
          productoId,
          productoSku,
          productoNombre,
          vinculado: autoVinculado,
          fechaVinculacion: autoVinculado
            ? admin.firestore.Timestamp.now()
            : null,
        });
        nuevos++;

        // Cascade: vincular hermanos con mismo SKU o catalog_product_id
        if (autoVinculado) {
          const groupKey = sku || item.catalog_product_id;
          if (groupKey) {
            // Buscar por skuGroupKey (que ya tiene el fallback SKU → catalog_product_id)
            const siblingQuery = await db
              .collection(COLLECTIONS.ML_PRODUCT_MAP)
              .where("skuGroupKey", "==", groupKey)
              .where("vinculado", "==", false)
              .get();

            for (const sibDoc of siblingQuery.docs) {
              await sibDoc.ref.update({
                productoId,
                productoSku,
                productoNombre,
                vinculado: true,
                fechaVinculacion: admin.firestore.Timestamp.now(),
              });
              functions.logger.info(
                `ML Sync: Cascade-linked ${sibDoc.data().mlItemId} → ${productoSku} (groupKey: ${groupKey})`
              );
            }
          }
        }
      } else {
        // Actualizar datos de ML sin tocar el vínculo con ERP
        await existingQuery.docs[0].ref.update(mapData);
        actualizados++;
      }
    }
  }

  // 3. Actualizar última sync
  await db.collection(COLLECTIONS.ML_CONFIG).doc("settings").update({
    lastSync: admin.firestore.Timestamp.now(),
  });

  functions.logger.info(
    `ML Sync completado: ${total} items, ${nuevos} nuevos, ${actualizados} actualizados`
  );

  return { total, nuevos, actualizados };
}

// ============================================================
// PROCESAR ORDEN ML → VENTA ERP
// ============================================================

/**
 * Procesa una sub-orden de un pack (compra multi-producto en un carrito).
 * Consolida todas las sub-órdenes en un solo mlOrderSync doc (ID: ml-pack-{packId}).
 * Solo cuando todas las sub-órdenes llegan y todos los productos están vinculados,
 * se auto-crea la venta consolidada.
 */
async function processPackSubOrder(order: MLOrder, packId: number): Promise<void> {
  const orderId = order.id;
  const packDocId = `ml-pack-${packId}`;
  const packDocRef = db.collection(COLLECTIONS.ML_ORDER_SYNC).doc(packDocId);

  functions.logger.info(`ML Order ${orderId}: es parte de pack ${packId}, consolidando...`);

  // Solo procesar sub-órdenes pagadas
  if (order.status !== "paid") {
    functions.logger.info(`ML Pack ${packId} sub-order ${orderId}: estado ${order.status}, esperando pago...`);
    return;
  }

  // Resolver productos de esta sub-orden
  const productosSubOrden = await resolverProductosOrden(order);
  const comisionSubOrden = calcularComisionTotal(order);

  // Intentar obtener info del pack para saber cuántas sub-órdenes esperar
  let packOrderIds: number[] | null = null;
  try {
    const packInfo = await getPackOrders(packId);
    if (packInfo?.orders) {
      packOrderIds = packInfo.orders.map(o => o.id);
      functions.logger.info(`ML Pack ${packId}: contiene ${packOrderIds.length} sub-órdenes: ${packOrderIds.join(", ")}`);
    }
  } catch {
    functions.logger.warn(`ML Pack ${packId}: no se pudo obtener info del pack`);
  }

  // Transacción atómica para merge de sub-orden en doc del pack
  const result = await db.runTransaction(async (tx) => {
    const packDoc = await tx.get(packDocRef);
    const now = admin.firestore.Timestamp.now();

    if (packDoc.exists) {
      const existing = packDoc.data()!;

      // Si ya fue procesada, skip (re-notificación)
      if (existing.estado === "procesada") {
        return { action: "already_processed" as const };
      }

      // Verificar que esta sub-orden no fue ya agregada
      const existingSubOrderIds: number[] = existing.subOrderIds || [];
      if (existingSubOrderIds.includes(orderId)) {
        return { action: "already_merged" as const };
      }

      // MERGE: agregar productos de esta sub-orden
      const existingProductos = existing.productos || [];
      const mergedProductos = [...existingProductos, ...productosSubOrden];
      const mergedSubOrderIds = [...existingSubOrderIds, orderId];
      const mergedComision = (existing.comisionML || 0) + comisionSubOrden;
      const mergedTotal = (existing.totalML || 0) + order.total_amount;
      const todosVinculados = mergedProductos.every((p: any) => p.productoId !== null);

      tx.update(packDocRef, {
        productos: mergedProductos,
        subOrderIds: mergedSubOrderIds,
        subOrdersRecibidas: mergedSubOrderIds.length,
        comisionML: mergedComision,
        totalML: mergedTotal,
        todosVinculados,
        errorDetalle: todosVinculados
          ? null
          : `Productos sin vincular: ${mergedProductos.filter((p: any) => !p.productoId).map((p: any) => p.mlTitle).join(", ")}`,
        fechaSync: now,
      });

      functions.logger.info(
        `ML Pack ${packId}: sub-orden ${orderId} mergeada. ` +
        `Total sub-órdenes: ${mergedSubOrderIds.length}. Productos: ${mergedProductos.length}. Vinculados: ${todosVinculados}`
      );

      return {
        action: "merged" as const,
        todosVinculados,
        subOrdersRecibidas: mergedSubOrderIds.length,
      };
    } else {
      // PRIMER sub-orden del pack — crear doc nuevo
      return { action: "create_new" as const };
    }
  });

  // Manejar resultado de la transacción
  if (result.action === "already_processed" || result.action === "already_merged") {
    functions.logger.info(`ML Pack ${packId} sub-order ${orderId}: ${result.action}, skip`);
    return;
  }

  if (result.action === "create_new") {
    // Crear doc del pack con datos completos de la primera sub-orden
    // (buyer, shipping, etc. son iguales para todas las sub-órdenes del pack)
    try {
      await createPackSyncDoc(order, packId, packDocRef, productosSubOrden, comisionSubOrden);
    } catch (err: any) {
      // Si otro sub-orden ya creó el doc (race condition), reintentar como merge
      if (err.code === 6 || err.code === "already-exists" || err.message?.includes("ALREADY_EXISTS")) {
        functions.logger.warn(`ML Pack ${packId}: doc ya existe (race condition), reintentando como merge...`);
        // Re-ejecutar para que entre por la rama de merge
        await processPackSubOrder(order, packId);
        return;
      }
      throw err;
    }
  }

  // stockPendienteML: incrementar para los productos de ESTA sub-orden
  const productosVinculados = productosSubOrden.filter(p => p.productoId);
  for (const prod of productosVinculados) {
    try {
      const prodRef = db.collection(COLLECTIONS.PRODUCTOS).doc(prod.productoId!);
      const prodDoc = await prodRef.get();
      const pData = prodDoc.data();
      const newPendiente = (pData?.stockPendienteML || 0) + prod.cantidad;
      const disponiblePeru = pData?.stockDisponiblePeru || 0;
      const newEfectivo = Math.max(0, disponiblePeru - newPendiente);
      await prodRef.update({
        stockPendienteML: newPendiente,
        stockEfectivoML: newEfectivo,
      });
      functions.logger.info(
        `ML Pack ${packId} sub-order ${orderId}: stockPendienteML +${prod.cantidad} para ${prod.productoId}`
      );
    } catch (err: any) {
      functions.logger.warn(
        `ML Pack ${packId}: error actualizando stockPendienteML para ${prod.productoId}: ${err.message}`
      );
    }
  }

  // Marcar que stockPendiente fue contabilizado (para el pack completo)
  await packDocRef.update({ stockPendienteContabilizado: true });

  // Auto-procesar si todos los productos están vinculados
  const settingsDoc = await db.collection(COLLECTIONS.ML_CONFIG).doc("settings").get();
  const settings = settingsDoc.data();

  // Releer el doc del pack para obtener estado actualizado
  const freshPackDoc = await packDocRef.get();
  const freshPackData = freshPackDoc.data();
  const todosVinculados = freshPackData?.todosVinculados === true;

  if (settings?.autoCreateVentas && todosVinculados) {
    // Programar creación de venta con delay de 3 minutos
    // Cada sub-orden que llega resetea el timer para esperar data completa
    const DELAY_MS = 3 * 60 * 1000; // 3 minutos
    const crearDespuesDe = admin.firestore.Timestamp.fromMillis(Date.now() + DELAY_MS);
    await packDocRef.update({ crearVentaDespuesDe: crearDespuesDe });
    functions.logger.info(
      `ML Pack ${packId}: venta programada para ${new Date(Date.now() + DELAY_MS).toISOString()} (delay 3min)`
    );
  }

  functions.logger.info(`ML Pack ${packId} sub-order ${orderId}: sync completado`);
}

/**
 * Crea el documento mlOrderSync para el primer sub-orden de un pack.
 * Extrae buyer info, shipping info, etc. que son compartidos entre sub-órdenes.
 */
async function createPackSyncDoc(
  order: MLOrder,
  packId: number,
  packDocRef: FirebaseFirestore.DocumentReference,
  productosResueltos: any[],
  comisionML: number
): Promise<void> {
  const orderId = order.id;
  const todosVinculados = productosResueltos.every((p) => p.productoId !== null);

  // Buyer info (reusar lógica existente)
  let buyerName = "Cliente ML";
  let buyerNickname: string | null = order.buyer.nickname || null;
  let buyerEmail: string | null = null;
  let buyerPhone: string | null = null;
  let buyerDni: string | null = null;
  let buyerDocType: string | null = null;
  let razonSocial: string | null = null;

  if (order.buyer.first_name) {
    buyerName = `${order.buyer.first_name} ${order.buyer.last_name || ""}`.trim();
  }
  if (order.buyer.billing_info?.doc_number) {
    buyerDni = order.buyer.billing_info.doc_number;
    buyerDocType = order.buyer.billing_info.doc_type || null;
  }
  if (order.buyer.phone?.number) {
    buyerPhone = `${order.buyer.phone.area_code || ""}${order.buyer.phone.number}`.trim();
  }
  if (order.buyer.email) {
    buyerEmail = order.buyer.email;
  }

  try {
    const buyer = await getUser(order.buyer.id);
    if (!buyerEmail && buyer.email) buyerEmail = buyer.email;
    if (!buyerPhone && buyer.phone?.number) {
      buyerPhone = `${buyer.phone.area_code || ""}${buyer.phone.number}`.trim();
    }
    if (!buyerDni && buyer.identification?.number) {
      buyerDni = buyer.identification.number;
      if (!buyerDocType && buyer.identification.type) buyerDocType = buyer.identification.type;
    }
    if (!buyerNickname && buyer.nickname) buyerNickname = buyer.nickname;
  } catch {
    functions.logger.warn(`Pack ${packId}: no se pudo obtener info extendida del buyer ${order.buyer.id}`);
  }

  try {
    const billingInfo = await getOrderBillingInfo(orderId);
    if (billingInfo) {
      if (billingInfo.doc_number) buyerDni = billingInfo.doc_number;
      if (billingInfo.doc_type) buyerDocType = billingInfo.doc_type;
      if (billingInfo.additional_info) {
        const firstName = billingInfo.additional_info.find((i) => i.type === "FIRST_NAME")?.value?.trim();
        const lastName = billingInfo.additional_info.find((i) => i.type === "LAST_NAME")?.value?.trim();
        if (firstName || lastName) buyerName = `${firstName || ""} ${lastName || ""}`.trim();
        const businessName = billingInfo.additional_info.find(
          (i) => i.type === "TAXPAYER_NAME" || i.type === "BUSINESS_NAME"
        );
        if (businessName?.value) razonSocial = businessName.value;
      }
    }
  } catch { /* Non-critical */ }

  // Shipping info (una sola vez — compartida entre sub-órdenes del pack)
  let direccionEntrega = "";
  let distrito = "";
  let provincia = "";
  let codigoPostal: string | null = null;
  let referenciaEntrega: string | null = null;
  let costoEnvioML = 0;
  let costoEnvioCliente = 0;
  let trackingNumber: string | null = null;
  let trackingMethod: string | null = null;
  let metodoEnvio: "flex" | "urbano" | null = null;
  let coordenadas: { lat: number; lng: number } | null = null;
  let shipmentId: number | null = null;

  if (order.shipping?.id) {
    shipmentId = order.shipping.id;
    try {
      const shipment = await getShipment(order.shipping.id);
      const addr = shipment.receiver_address;
      direccionEntrega = addr.address_line || `${addr.street_name} ${addr.street_number}`.trim();
      distrito = addr.city?.name || "";
      provincia = addr.state?.name || "";
      codigoPostal = addr.zip_code || null;
      referenciaEntrega = addr.comment || null;
      costoEnvioML = shipment.lead_time?.cost || 0;
      trackingNumber = shipment.tracking_number;
      trackingMethod = shipment.tracking_method;
      const shippingOpt = (shipment as any).shipping_option;
      if (shippingOpt?.cost > 0) costoEnvioCliente = shippingOpt.cost;
      else if (shippingOpt?.list_cost > 0) costoEnvioCliente = shippingOpt.list_cost;
      const methodStr = (trackingMethod || "").toLowerCase();
      if (methodStr.includes("flex") || methodStr === "self_service") metodoEnvio = "flex";
      else if (methodStr.includes("urbano") || methodStr === "standard" || methodStr === "normal") metodoEnvio = "urbano";
      if (addr.latitude && addr.longitude) coordenadas = { lat: addr.latitude, lng: addr.longitude };
    } catch {
      functions.logger.warn(`Pack ${packId}: no se pudo obtener shipment ${order.shipping.id}`);
    }
  }

  if (costoEnvioCliente === 0 && order.payments?.length > 0) {
    costoEnvioCliente = order.payments[0].shipping_cost || 0;
    if (costoEnvioCliente === 0) {
      const totalPaid = order.payments[0].total_paid_amount || 0;
      const txAmount = order.payments[0].transaction_amount || 0;
      if (totalPaid > txAmount) costoEnvioCliente = totalPaid - txAmount;
    }
  }
  if (costoEnvioCliente === 0 && costoEnvioML > 0) costoEnvioCliente = costoEnvioML;

  let cargoEnvioML = 0;
  if (metodoEnvio === "urbano" && costoEnvioCliente > 0) {
    cargoEnvioML = costoEnvioCliente;
    costoEnvioCliente = 0;
  }

  // .create() falla atómicamente si el doc ya existe (previene race condition entre sub-órdenes)
  await packDocRef.create({
    mlOrderId: orderId, // ID de la primera sub-orden (referencia principal)
    mlStatus: order.status,
    mlBuyerId: order.buyer.id,
    mlBuyerName: buyerName,
    mlBuyerNickname: buyerNickname,
    ventaId: null,
    numeroVenta: null,
    clienteId: null,
    estado: "pendiente",
    errorDetalle: todosVinculados
      ? null
      : `Productos sin vincular: ${productosResueltos.filter((p) => !p.productoId).map((p) => p.mlTitle).join(", ")}`,
    totalML: order.total_amount,
    comisionML,
    costoEnvioML,
    costoEnvioCliente,
    metodoEnvio,
    cargoEnvioML,
    origen: "webhook",
    fechaOrdenML: admin.firestore.Timestamp.fromDate(new Date(order.date_created)),
    fechaProcesada: null,
    fechaSync: admin.firestore.Timestamp.now(),
    buyerEmail,
    buyerPhone,
    buyerDni,
    buyerDocType,
    razonSocial,
    direccionEntrega,
    distrito,
    provincia,
    codigoPostal,
    referenciaEntrega,
    coordenadas,
    trackingNumber,
    trackingMethod,
    shipmentId,
    shipmentStatus: "pending",
    productos: productosResueltos,
    todosVinculados,
    // Pack-specific fields
    packId,
    subOrderIds: [orderId],
    subOrdersRecibidas: 1,
    rawOrder: {
      id: order.id,
      status: order.status,
      total_amount: order.total_amount,
      currency_id: order.currency_id,
      date_created: order.date_created,
      date_closed: order.date_closed,
      items_count: order.order_items.length,
      pack_id: packId,
    },
  });

  functions.logger.info(
    `ML Pack ${packId}: doc creado con sub-orden ${orderId}. ` +
    `Envío: ${metodoEnvio || "desconocido"}, costoEnvioCliente=${costoEnvioCliente}, cargoEnvioML=${cargoEnvioML}`
  );
}

/**
 * Procesa una notificación de orden de ML.
 * Traduce la orden al formato de tu ERP y la guarda como registro
 * en mlOrderSync. Opcionalmente crea la Venta automáticamente.
 */
export async function processOrderNotification(order: MLOrder): Promise<void> {
  const orderId = order.id;
  const packId = order.pack_id;

  // === PACK ORDER HANDLING ===
  // Cuando un comprador compra 2+ productos en un solo carrito, ML crea sub-órdenes separadas
  // con el mismo pack_id. Las consolidamos en un solo mlOrderSync y una sola venta.
  if (packId) {
    await processPackSubOrder(order, packId);
    return;
  }

  // === SINGLE ORDER FLOW (sin pack_id) ===

  // --- Deduplicación atómica ---
  // 1. Buscar doc existente (doc ID determinístico o legacy con ID aleatorio)
  let syncDocRef: FirebaseFirestore.DocumentReference | null = null;
  let existingData: (MLOrderSync & Record<string, any>) | null = null;

  const deterministicRef = db.collection(COLLECTIONS.ML_ORDER_SYNC).doc(`ml-${orderId}`);
  const deterministicDoc = await deterministicRef.get();

  if (deterministicDoc.exists) {
    syncDocRef = deterministicRef;
    existingData = deterministicDoc.data() as MLOrderSync;
  } else {
    // Fallback: buscar docs legacy con ID aleatorio
    const legacyQuery = await db
      .collection(COLLECTIONS.ML_ORDER_SYNC)
      .where("mlOrderId", "==", orderId)
      .limit(1)
      .get();
    if (!legacyQuery.empty) {
      syncDocRef = legacyQuery.docs[0].ref;
      existingData = legacyQuery.docs[0].data() as MLOrderSync;
    }
  }

  // 2. Si ya existe, manejar según estado
  if (syncDocRef && existingData) {
    // Si está siendo procesada por otra invocación concurrent, skip
    if (existingData.estado === ("procesando" as any)) {
      functions.logger.info(`ML Order ${orderId}: ya siendo procesada por otra invocación, skip`);
      return;
    }

    // Si ya fue procesada exitosamente, verificar si la comisión cambió
    if (existingData.estado === "procesada") {
      const comisionActualizada = calcularComisionTotal(order);
      const comisionAnterior = existingData.comisionML || 0;

      await syncDocRef.update({
        mlStatus: order.status,
        fechaSync: admin.firestore.Timestamp.now(),
      });

      // Si la comisión cambió (ej: sale_fee llegó después), corregir gasto
      if (comisionActualizada > 0 && Math.abs(comisionActualizada - comisionAnterior) > 0.01 && existingData.ventaId && existingData.numeroVenta) {
        try {
          await corregirComisionML(
            existingData.ventaId,
            existingData.numeroVenta,
            orderId,
            comisionActualizada,
            syncDocRef
          );
          functions.logger.info(
            `ML Order ${orderId}: Comisión corregida por re-notificación: ${comisionAnterior} → ${comisionActualizada}`
          );
        } catch (err: any) {
          functions.logger.warn(
            `ML Order ${orderId}: Error corrigiendo comisión: ${err.message}`
          );
        }
      }

      return;
    }

    // V2: Orden cancelada — revertir stockPendienteML si fue contabilizado
    if (order.status === "cancelled" && existingData.stockPendienteContabilizado === true) {
      const productos = (existingData as any).productos || [];
      for (const prod of productos) {
        if (prod.productoId && prod.cantidad > 0) {
          try {
            const prodRef = db.collection(COLLECTIONS.PRODUCTOS).doc(prod.productoId);
            const prodDoc = await prodRef.get();
            const pData = prodDoc.data();
            const newPendiente = Math.max(0, (pData?.stockPendienteML || 0) - prod.cantidad);
            const disponiblePeru = pData?.stockDisponiblePeru || 0;
            const newEfectivo = Math.max(0, disponiblePeru - newPendiente);
            await prodRef.update({
              stockPendienteML: newPendiente,
              stockEfectivoML: newEfectivo,
            });
            functions.logger.info(
              `ML Order ${orderId} CANCELADA: stockPendienteML -${prod.cantidad} para producto ${prod.productoId}`
            );
          } catch (err: any) {
            functions.logger.warn(
              `ML Order ${orderId}: error revirtiendo stockPendienteML para ${prod.productoId}: ${err.message}`
            );
          }
        }
      }
      await syncDocRef.update({
        mlStatus: order.status,
        estado: "ignorada",
        errorDetalle: "Orden cancelada en ML",
        stockPendienteContabilizado: false,
        fechaSync: admin.firestore.Timestamp.now(),
      });
      functions.logger.info(`ML Order ${orderId}: cancelada, stockPendienteML revertido`);
      return;
    }
  }

  // Solo procesar órdenes pagadas
  if (order.status !== "paid") {
    functions.logger.info(`ML Order ${orderId}: estado ${order.status}, esperando pago...`);

    if (!syncDocRef) {
      await deterministicRef.set({
        mlOrderId: orderId,
        mlStatus: order.status,
        mlBuyerId: order.buyer.id,
        mlBuyerName: null,
        ventaId: null,
        numeroVenta: null,
        clienteId: null,
        estado: "pendiente",
        errorDetalle: `Esperando pago (estado actual: ${order.status})`,
        totalML: order.total_amount,
        comisionML: calcularComisionTotal(order),
        costoEnvioML: 0,
        origen: "webhook",
        fechaOrdenML: admin.firestore.Timestamp.fromDate(new Date(order.date_created)),
        fechaProcesada: null,
        fechaSync: admin.firestore.Timestamp.now(),
      } as MLOrderSync);
    }
    return;
  }

  // 3. Reclamar orden atómicamente para prevenir procesamiento duplicado
  if (syncDocRef) {
    // Doc existente (legacy o determinístico) en estado pendiente/error — reclamar con transacción
    const claimed = await db.runTransaction(async (tx) => {
      const doc = await tx.get(syncDocRef!);
      const data = doc.data();
      if (!data || data.estado === "procesando" || data.estado === "procesada") {
        return false; // Ya reclamada o procesada por otra invocación
      }
      tx.update(syncDocRef!, {
        estado: "procesando",
        fechaSync: admin.firestore.Timestamp.now(),
      });
      return true;
    });
    if (!claimed) {
      functions.logger.info(`ML Order ${orderId}: ya reclamada/procesada por otra invocación, skip`);
      return;
    }
  } else {
    // Doc nuevo — crear con ID determinístico (create() falla si ya existe)
    try {
      await deterministicRef.create({
        mlOrderId: orderId,
        estado: "procesando",
        fechaSync: admin.firestore.Timestamp.now(),
      });
      syncDocRef = deterministicRef;
    } catch (err: any) {
      functions.logger.info(`ML Order ${orderId}: reclamada por otra invocación concurrente, skip`);
      return;
    }
  }

  functions.logger.info(`ML Order ${orderId}: PAGADA, procesando...`);

  try {
    // 1. Obtener info del buyer
    let buyerName = "Cliente ML";
    let buyerNickname: string | null = order.buyer.nickname || null;
    let buyerEmail: string | null = null;
    let buyerPhone: string | null = null;
    let buyerDni: string | null = null;
    let buyerDocType: string | null = null;
    let razonSocial: string | null = null;

    // 1a. Datos directos del objeto order (fallback)
    if (order.buyer.first_name) {
      buyerName = `${order.buyer.first_name} ${order.buyer.last_name || ""}`.trim();
    }
    if (order.buyer.billing_info?.doc_number) {
      buyerDni = order.buyer.billing_info.doc_number;
      buyerDocType = order.buyer.billing_info.doc_type || null;
    }
    if (order.buyer.phone?.number) {
      buyerPhone = `${order.buyer.phone.area_code || ""}${order.buyer.phone.number}`.trim();
    }
    if (order.buyer.email) {
      buyerEmail = order.buyer.email;
    }

    // 1b. Enriquecer con /users/{id} si faltan datos
    try {
      const buyer = await getUser(order.buyer.id);
      if (!buyerEmail && buyer.email) buyerEmail = buyer.email;
      if (!buyerPhone && buyer.phone?.number) {
        buyerPhone = `${buyer.phone.area_code || ""}${buyer.phone.number}`.trim();
      }
      if (!buyerDni && buyer.identification?.number) {
        buyerDni = buyer.identification.number;
        if (!buyerDocType && buyer.identification.type) {
          buyerDocType = buyer.identification.type;
        }
      }
      if (!buyerNickname && buyer.nickname) {
        buyerNickname = buyer.nickname;
      }
    } catch {
      functions.logger.warn(`No se pudo obtener info extendida del buyer ${order.buyer.id}`);
    }

    // 1c. billing_info = FUENTE PRIMARIA de nombre, DNI y razón social
    try {
      const billingInfo = await getOrderBillingInfo(orderId);
      if (billingInfo) {
        if (billingInfo.doc_number) buyerDni = billingInfo.doc_number;
        if (billingInfo.doc_type) buyerDocType = billingInfo.doc_type;

        if (billingInfo.additional_info) {
          const firstName = billingInfo.additional_info.find((i) => i.type === "FIRST_NAME")?.value?.trim();
          const lastName = billingInfo.additional_info.find((i) => i.type === "LAST_NAME")?.value?.trim();
          if (firstName || lastName) {
            buyerName = `${firstName || ""} ${lastName || ""}`.trim();
          }

          const businessName = billingInfo.additional_info.find(
            (i) => i.type === "TAXPAYER_NAME" || i.type === "BUSINESS_NAME"
          );
          if (businessName?.value) {
            razonSocial = businessName.value;
          }
        }
      }
    } catch {
      // Non-critical
    }

    functions.logger.info(`ML Order ${orderId}: Buyer → name=${buyerName}, nickname=${buyerNickname}, dni=${buyerDocType || "DOC"}:${buyerDni || "N/A"}, phone=${buyerPhone || "N/A"}${razonSocial ? `, razónSocial=${razonSocial}` : ""}`);

    // 2. Obtener info de envío
    let direccionEntrega = "";
    let distrito = "";
    let provincia = "";
    let codigoPostal: string | null = null;
    let referenciaEntrega: string | null = null;
    let costoEnvioML = 0;
    let costoEnvioCliente = 0;
    let trackingNumber: string | null = null;
    let trackingMethod: string | null = null;
    let metodoEnvio: "flex" | "urbano" | null = null;
    let coordenadas: { lat: number; lng: number } | null = null;
    let shipmentId: number | null = null;

    if (order.shipping?.id) {
      shipmentId = order.shipping.id;
      try {
        const shipment = await getShipment(order.shipping.id);
        const addr = shipment.receiver_address;
        direccionEntrega = addr.address_line || `${addr.street_name} ${addr.street_number}`.trim();
        distrito = addr.city?.name || "";
        provincia = addr.state?.name || "";
        codigoPostal = addr.zip_code || null;
        referenciaEntrega = addr.comment || null;
        costoEnvioML = shipment.lead_time?.cost || 0;
        trackingNumber = shipment.tracking_number;
        trackingMethod = shipment.tracking_method;

        // shipping_option: cost = lo que pagó el comprador, list_cost = bonificación por envío de ML
        const shippingOpt = (shipment as any).shipping_option;
        if (shippingOpt?.cost > 0) {
          costoEnvioCliente = shippingOpt.cost;
        } else if (shippingOpt?.list_cost > 0) {
          costoEnvioCliente = shippingOpt.list_cost;
        }

        // Detectar método de envío temprano para clasificar costos
        const methodStr = (trackingMethod || "").toLowerCase();
        if (methodStr.includes("flex") || methodStr === "self_service") {
          metodoEnvio = "flex";
        } else if (methodStr.includes("urbano") || methodStr === "standard" || methodStr === "normal") {
          metodoEnvio = "urbano";
        }

        // Extraer coordenadas geo de ML para integración con Google Maps
        if (addr.latitude && addr.longitude) {
          coordenadas = { lat: addr.latitude, lng: addr.longitude };
        }
      } catch {
        functions.logger.warn(`No se pudo obtener shipment ${order.shipping.id}`);
      }
    }

    // Fallback: obtener costo de envío del payment si no vino del shipment
    if (costoEnvioCliente === 0 && order.payments?.length > 0) {
      // shipping_cost del payment
      costoEnvioCliente = order.payments[0].shipping_cost || 0;
      // Derivar de total_paid_amount - transaction_amount si aún es 0
      if (costoEnvioCliente === 0) {
        const totalPaid = order.payments[0].total_paid_amount || 0;
        const txAmount = order.payments[0].transaction_amount || 0;
        if (totalPaid > txAmount) {
          costoEnvioCliente = totalPaid - txAmount;
        }
      }
    }
    // Último fallback: usar costo del shipment
    if (costoEnvioCliente === 0 && costoEnvioML > 0) {
      costoEnvioCliente = costoEnvioML;
    }

    // Clasificar costo de envío según método:
    // - Urbano (ML envía): el cargo por envío es una deducción al vendedor, NO ingreso
    // - Flex (vendedor envía): el envío es ingreso (bonificación ML o cliente paga)
    let cargoEnvioML = 0;
    if (metodoEnvio === "urbano" && costoEnvioCliente > 0) {
      cargoEnvioML = costoEnvioCliente; // Deducción que ML cobra al vendedor
      costoEnvioCliente = 0; // No es ingreso para el vendedor
    }

    functions.logger.info(
      `ML Order ${orderId}: Envío → método=${metodoEnvio || "desconocido"}, ` +
      `costoEnvioML=${costoEnvioML}, costoEnvioCliente=${costoEnvioCliente}, cargoEnvioML=${cargoEnvioML}`
    );

    // 3. Calcular comisiones
    const comisionML = calcularComisionTotal(order);

    // 4. Resolver mapeo de productos ML → ERP
    const productosResueltos = await resolverProductosOrden(order);
    const todosVinculados = productosResueltos.every((p) => p.productoId !== null);

    // 5. Crear registro de sync
    const orderSyncData: MLOrderSync = {
      mlOrderId: orderId,
      mlStatus: order.status,
      mlBuyerId: order.buyer.id,
      mlBuyerName: buyerName,
      mlBuyerNickname: buyerNickname,
      ventaId: null,
      numeroVenta: null,
      clienteId: null,
      estado: "pendiente",
      errorDetalle: todosVinculados
        ? null
        : `Productos sin vincular: ${productosResueltos.filter((p) => !p.productoId).map((p) => p.mlTitle).join(", ")}`,
      totalML: order.total_amount,
      comisionML,
      costoEnvioML,
      costoEnvioCliente,
      metodoEnvio,
      cargoEnvioML,
      origen: "webhook",
      fechaOrdenML: admin.firestore.Timestamp.fromDate(new Date(order.date_created)),
      fechaProcesada: null,
      fechaSync: admin.firestore.Timestamp.now(),
    };

    // Guardar datos extendidos para cuando se procese la venta
    const orderDetailData = {
      ...orderSyncData,
      buyerEmail,
      buyerPhone,
      buyerDni,
      buyerDocType,
      razonSocial,
      direccionEntrega,
      distrito,
      provincia,
      codigoPostal,
      referenciaEntrega,
      coordenadas,
      trackingNumber,
      trackingMethod,
      shipmentId,
      shipmentStatus: "pending",
      productos: productosResueltos,
      todosVinculados,
      rawOrder: {
        id: order.id,
        status: order.status,
        total_amount: order.total_amount,
        currency_id: order.currency_id,
        date_created: order.date_created,
        date_closed: order.date_closed,
        items_count: order.order_items.length,
      },
    };

    // syncDocRef ya apunta al doc (claimed o existente)
    await syncDocRef!.set(orderDetailData, { merge: true });

    // 5b. Pilar 1: Incrementar stockPendienteML para productos vinculados
    // Solo si no fue ya contabilizado (protección contra webhooks duplicados)
    const yaContabilizado = existingData?.stockPendienteContabilizado === true;

    if (!yaContabilizado) {
      const productosVinculados = productosResueltos.filter(p => p.productoId);
      if (productosVinculados.length > 0) {
        for (const prod of productosVinculados) {
          try {
            const prodRef = db.collection(COLLECTIONS.PRODUCTOS).doc(prod.productoId!);
            const prodDoc = await prodRef.get();
            const pData = prodDoc.data();
            const newPendiente = (pData?.stockPendienteML || 0) + prod.cantidad;
            const disponiblePeru = pData?.stockDisponiblePeru || 0;
            const newEfectivo = Math.max(0, disponiblePeru - newPendiente);
            await prodRef.update({
              stockPendienteML: newPendiente,
              stockEfectivoML: newEfectivo,
            });
            functions.logger.info(
              `ML Order ${orderId}: stockPendienteML +${prod.cantidad} para ${prod.productoId} → efectivo=${newEfectivo}`
            );
          } catch (err: any) {
            functions.logger.warn(
              `ML Order ${orderId}: no se pudo actualizar stockPendienteML para ${prod.productoId}: ${err.message}`
            );
          }
        }

        await syncDocRef!.update({ stockPendienteContabilizado: true });
      }
    }

    // 6. Si auto-crear ventas está activo Y todos los productos están vinculados
    const settingsDoc = await db.collection(COLLECTIONS.ML_CONFIG).doc("settings").get();
    const settings = settingsDoc.data();

    if (settings?.autoCreateVentas && todosVinculados) {
      // Programar creación de venta con delay de 3 minutos
      // para que los webhooks de payment y shipment enriquezcan el mlOrderSync primero
      const DELAY_MS = 3 * 60 * 1000; // 3 minutos
      const crearDespuesDe = admin.firestore.Timestamp.fromMillis(Date.now() + DELAY_MS);
      await syncDocRef!.update({ crearVentaDespuesDe: crearDespuesDe });
      functions.logger.info(
        `ML Order ${orderId}: venta programada para ${new Date(Date.now() + DELAY_MS).toISOString()} (delay 3min)`
      );
    }

    functions.logger.info(
      `ML Order ${orderId}: sync completado. Vinculados: ${todosVinculados}. Comisión: ${comisionML}`
    );
  } catch (err: any) {
    functions.logger.error(`ML Order ${orderId}: error procesando`, err);

    const errorData: Partial<MLOrderSync> = {
      estado: "error",
      errorDetalle: err.message,
      fechaSync: admin.firestore.Timestamp.now(),
    };

    // syncDocRef ya existe si se reclamó arriba; si no, crear doc de error
    if (syncDocRef) {
      await syncDocRef.update(errorData);
    } else {
      await deterministicRef.set({
        mlOrderId: orderId,
        mlStatus: order.status,
        mlBuyerId: order.buyer.id,
        mlBuyerName: null,
        ventaId: null,
        numeroVenta: null,
        clienteId: null,
        totalML: order.total_amount,
        comisionML: 0,
        costoEnvioML: 0,
        origen: "webhook",
        fechaOrdenML: admin.firestore.Timestamp.fromDate(new Date(order.date_created)),
        fechaProcesada: null,
        ...errorData,
      } as MLOrderSync);
    }
  }
}

// ============================================================
// PROCESAR ENVÍO ML → ACTUALIZAR ENTREGA ERP
// ============================================================

/**
 * Procesa notificación de cambio de envío de ML.
 * Actualiza el registro de sync y, si hay venta vinculada,
 * actualiza la info de entrega.
 */
export async function processShipmentNotification(shipment: MLShipment): Promise<void> {
  functions.logger.info(
    `ML Shipment ${shipment.id}: estado ${shipment.status}/${shipment.substatus}`
  );

  // Buscar la orden asociada a este envío
  const orderSyncQuery = await db
    .collection(COLLECTIONS.ML_ORDER_SYNC)
    .where("shipmentId", "==", shipment.id)
    .limit(1)
    .get();

  if (orderSyncQuery.empty) {
    // Guardar info del shipment para vincular después
    await db.collection(COLLECTIONS.ML_SHIPMENT_LOG).doc(String(shipment.id)).set({
      shipmentId: shipment.id,
      status: shipment.status,
      substatus: shipment.substatus,
      trackingNumber: shipment.tracking_number,
      receiverAddress: shipment.receiver_address,
      cost: shipment.lead_time?.cost || 0,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    return;
  }

  // Actualizar la sync de la orden con info de envío
  const orderSyncDoc = orderSyncQuery.docs[0];
  const orderSync = orderSyncDoc.data() as MLOrderSync;

  // Calcular metodoEnvio desde trackingMethod (misma lógica que processOrderNotification)
  const trackingMethod = shipment.tracking_method || null;
  const methodStr = (trackingMethod || "").toLowerCase();
  let metodoEnvio: string | null = orderSync.metodoEnvio || null;
  if (methodStr) {
    if (methodStr.includes("flex") || methodStr === "self_service") {
      metodoEnvio = "flex";
    } else if (methodStr.includes("urbano") || methodStr === "standard" || methodStr === "normal") {
      metodoEnvio = "urbano";
    }
  }

  const syncUpdate: Record<string, any> = {
    shipmentStatus: shipment.status,
    trackingNumber: shipment.tracking_number,
    trackingMethod: trackingMethod,
    fechaSync: admin.firestore.Timestamp.now(),
  };
  if (metodoEnvio) {
    syncUpdate.metodoEnvio = metodoEnvio;
  }

  // Si se detectó urbano y la venta AÚN NO se creó, reclasificar costos de envío
  // (costoEnvioCliente → cargoEnvioML, igual que en processOrderNotification)
  if (metodoEnvio === "urbano" && !orderSync.ventaId &&
      (orderSync.costoEnvioCliente || 0) > 0 && (orderSync.cargoEnvioML || 0) === 0) {
    syncUpdate.cargoEnvioML = orderSync.costoEnvioCliente;
    syncUpdate.costoEnvioCliente = 0;
    functions.logger.info(
      `ML Shipment ${shipment.id}: reclasificando envío para urbano: costoEnvioCliente=${orderSync.costoEnvioCliente} → cargoEnvioML`
    );
  }

  // Si la comisión está en 0 y la venta aún no se creó, re-fetch la orden para obtener sale_fee
  if ((orderSync.comisionML || 0) === 0 && !orderSync.ventaId && orderSync.mlOrderId) {
    try {
      const freshOrder = await getOrder(orderSync.mlOrderId);
      const freshComision = freshOrder.order_items.reduce(
        (sum, item) => sum + (item.sale_fee || 0) * (item.quantity || 1), 0
      );
      if (freshComision > 0) {
        syncUpdate.comisionML = freshComision;
        functions.logger.info(
          `ML Shipment ${shipment.id}: comisionML actualizada por re-fetch en shipment webhook: 0 → ${freshComision}`
        );
      }
    } catch (err: any) {
      functions.logger.warn(
        `ML Shipment ${shipment.id}: no se pudo re-fetch orden para comisión: ${err.message}`
      );
    }
  }

  await orderSyncDoc.ref.update(syncUpdate);

  // Si se detectó metodoEnvio y hay venta vinculada, actualizar la venta también
  if (metodoEnvio && orderSync.ventaId) {
    try {
      const ventaRef = db.collection(COLLECTIONS.VENTAS).doc(orderSync.ventaId);
      const ventaSnap = await ventaRef.get();
      if (ventaSnap.exists) {
        const ventaData = ventaSnap.data()!;
        // Solo actualizar si la venta no tiene metodoEnvio o está vacío
        if (!ventaData.metodoEnvio) {
          await ventaRef.update({ metodoEnvio });
          functions.logger.info(
            `ML Shipment ${shipment.id}: metodoEnvio="${metodoEnvio}" propagado a venta ${orderSync.ventaId}`
          );
        }
      }
    } catch (err) {
      functions.logger.error(
        `ML Shipment ${shipment.id}: Error actualizando metodoEnvio en venta ${orderSync.ventaId}`,
        err
      );
    }
  }
  if (orderSync.ventaId && shipment.status === "delivered") {
    functions.logger.info(
      `ML Shipment ${shipment.id}: ENTREGADO, marcando venta ${orderSync.ventaId} como entregada`
    );

    try {
      // Obtener la venta
      const ventaDoc = await db.collection(COLLECTIONS.VENTAS).doc(orderSync.ventaId).get();
      if (ventaDoc.exists) {
        const ventaData = ventaDoc.data()!;

        // Solo procesar si está en estado despachada o asignada
        if (["despachada", "asignada"].includes(ventaData.estado)) {
          const batch = db.batch();

          // Marcar todas las unidades asignadas como 'vendida'
          for (const prod of (ventaData.productos || [])) {
            for (const unidadId of (prod.unidadesAsignadas || [])) {
              const unidadRef = db.collection(COLLECTIONS.UNIDADES).doc(unidadId);
              batch.update(unidadRef, {
                estado: "vendida",
                fechaVenta: Timestamp.now(),
                precioVentaPEN: prod.precioUnitario || 0,
              });
            }
          }

          // Actualizar venta
          batch.update(ventaDoc.ref, {
            estado: "entregada",
            fechaEntrega: Timestamp.now(),
          });

          await batch.commit();

          // Sincronizar stock de productos afectados
          const productoIds = [...new Set(
            (ventaData.productos || [])
              .filter((p: any) => p.productoId)
              .map((p: any) => p.productoId)
          )];

          for (const prodId of productoIds) {
            try {
              // Recálculo COMPLETO de stock — misma lógica que inventario.service.ts
              const allUnitsQuery = await db.collection(COLLECTIONS.UNIDADES)
                .where("productoId", "==", prodId)
                .get();

              let sUSA = 0, sPeru = 0, sTransito = 0, sReservado = 0, sDisponible = 0, sDisponiblePeru = 0;
              for (const uDoc of allUnitsQuery.docs) {
                const u = uDoc.data();
                switch (u.estado) {
                  case "recibida_origen": case "recibida_usa": sUSA++; sDisponible++; break;
                  case "disponible_peru": sPeru++; sDisponible++; sDisponiblePeru++; break;
                  case "en_transito_origen": case "en_transito_usa": case "en_transito_peru": sTransito++; break;
                  case "reservada": case "asignada_pedido":
                    sReservado++;
                    if (u.pais === "USA") sUSA++; else sPeru++;
                    break;
                }
              }

              // Leer stockPendienteML para recalcular stockEfectivoML
              const prodDocSnap = await db.collection(COLLECTIONS.PRODUCTOS).doc(prodId as string).get();
              const sPendienteML = prodDocSnap.data()?.stockPendienteML || 0;
              const sEfectivoML = Math.max(0, sDisponiblePeru - sPendienteML);

              await db.collection(COLLECTIONS.PRODUCTOS).doc(prodId as string).update({
                stockUSA: sUSA,
                stockPeru: sPeru,
                stockTransito: sTransito,
                stockReservado: sReservado,
                stockDisponible: sDisponible,
                stockDisponiblePeru: sDisponiblePeru,
                stockEfectivoML: sEfectivoML,
                ultimaActualizacionStock: Timestamp.now(),
              });
            } catch {
              // Non-critical
            }
          }

          functions.logger.info(
            `ML Shipment ${shipment.id}: Venta ${orderSync.ventaId} marcada como entregada, ` +
            `unidades actualizadas a 'vendida'`
          );

          // Auto-crear gasto de distribución (GD) si no existe
          await registrarGastoDistribucionAuto(
            orderSync,
            ventaData,
            shipment
          );
        }
      }
    } catch (err: any) {
      functions.logger.error(
        `ML Shipment ${shipment.id}: Error marcando entrega para venta ${orderSync.ventaId}`,
        err
      );
    }
  }
}

// ============================================================
// AUTO GASTO DISTRIBUCIÓN (GD) AL ENTREGAR
// ============================================================

/**
 * Configuración de transportistas ML.
 * Flex → GK Express (costo fijo S/10)
 * Urbano → Urbano (costo = costoEnvioML de la orden)
 * Los IDs se buscan dinámicamente por nombre en Firestore.
 */
const ML_TRANSPORTISTAS_CONFIG = {
  flex: {
    nombreBusqueda: "GK Express",
    costoFijo: 10,
  },
  urbano: {
    nombreBusqueda: "Urbano",
    costoFijo: null, // usa costoEnvioML de la orden
  },
} as const;

/**
 * Detecta si el envío es Flex o Urbano a partir del tracking_method del shipment.
 * ML usa valores como "self_service" (flex), "standard" (urbano), etc.
 * También revisa el orderSync.trackingMethod por si ya fue guardado.
 */
function detectarMetodoEnvio(
  shipment: MLShipment,
  orderSync: MLOrderSync
): "flex" | "urbano" | null {
  const method = (
    shipment.tracking_method ||
    orderSync.trackingMethod ||
    ""
  ).toLowerCase();

  // ML Flex: tracking_method suele ser "self_service" o contener "flex"
  if (method.includes("flex") || method === "self_service") {
    return "flex";
  }
  // Urbano: suele ser "standard", "normal" o contener "urbano"
  if (
    method.includes("urbano") ||
    method === "standard" ||
    method === "normal"
  ) {
    return "urbano";
  }

  // Fallback: si no se detecta, no crear gasto automático
  return null;
}

/**
 * Busca un transportista por nombre (búsqueda parcial case-insensitive).
 * Retorna { id, nombre } o null si no existe.
 */
async function buscarTransportistaPorNombre(
  nombreBusqueda: string
): Promise<{ id: string; nombre: string } | null> {
  const snap = await db.collection(COLLECTIONS.TRANSPORTISTAS).get();

  const busqueda = nombreBusqueda.toLowerCase();
  for (const doc of snap.docs) {
    const data = doc.data();
    const nombre = (data.nombre || "").toLowerCase();
    if (nombre.includes(busqueda)) {
      return { id: doc.id, nombre: data.nombre };
    }
  }
  return null;
}

/**
 * Registra automáticamente un gasto de distribución (GD) cuando ML
 * marca el envío como "delivered" y el usuario no registró uno manualmente.
 *
 * Reglas:
 * - Flex → Transportista: GK Express, costo fijo S/10
 * - Urbano → Transportista: Urbano, costo = costoEnvioML (anulación de cargo ML)
 */
async function registrarGastoDistribucionAuto(
  orderSync: MLOrderSync,
  ventaData: any,
  shipment: MLShipment
): Promise<void> {
  const ventaId = orderSync.ventaId;
  const numeroVenta = orderSync.numeroVenta || ventaData.numeroVenta || "";

  if (!ventaId) return;

  // Verificar si ya existe un gasto GD para esta venta
  const existingGD = await db.collection(COLLECTIONS.GASTOS)
    .where("ventaId", "==", ventaId)
    .where("categoria", "==", "GD")
    .limit(1)
    .get();

  if (!existingGD.empty) {
    functions.logger.info(
      `ML GD Auto: Venta ${ventaId} ya tiene gasto GD (${existingGD.docs[0].id}), skip`
    );
    return;
  }

  // Detectar método de envío
  const metodo = detectarMetodoEnvio(shipment, orderSync);
  if (!metodo) {
    functions.logger.warn(
      `ML GD Auto: No se pudo detectar método de envío para shipment ${shipment.id} ` +
      `(tracking_method=${shipment.tracking_method}). No se crea gasto GD automático.`
    );
    return;
  }

  const config = ML_TRANSPORTISTAS_CONFIG[metodo];
  const costoDistribucion = config.costoFijo ?? (orderSync.costoEnvioML || 0);

  if (costoDistribucion <= 0) {
    functions.logger.info(
      `ML GD Auto: Costo distribución es 0 para ${metodo}, no se crea gasto`
    );
    return;
  }

  // Buscar transportista por nombre en Firestore
  const transportista = await buscarTransportistaPorNombre(config.nombreBusqueda);
  if (!transportista) {
    functions.logger.warn(
      `ML GD Auto: No se encontró transportista "${config.nombreBusqueda}" en Firestore. ` +
      `No se crea gasto GD automático.`
    );
    return;
  }

  const now = Timestamp.now();
  const fecha = now.toDate();
  const mes = fecha.getMonth() + 1;
  const anio = fecha.getFullYear();

  // Generar número de gasto
  const gastoPrefix = "GAS-";
  const lastGasto = await db.collection(COLLECTIONS.GASTOS)
    .where("numeroGasto", ">=", gastoPrefix)
    .where("numeroGasto", "<=", gastoPrefix + "\uf8ff")
    .orderBy("numeroGasto", "desc")
    .limit(1)
    .get();

  let nextGastoNum = 1;
  if (!lastGasto.empty) {
    const lastNum = lastGasto.docs[0].data().numeroGasto as string;
    const parsed = parseInt(lastNum.replace(gastoPrefix, ""), 10);
    if (!isNaN(parsed)) nextGastoNum = parsed + 1;
  }
  const numeroGasto = `${gastoPrefix}${String(nextGastoNum).padStart(4, "0")}`;

  // Buscar cuenta MercadoPago para el egreso
  let cuentaMPId: string | null = null;
  const mpQuery = await db.collection(COLLECTIONS.CUENTAS_CAJA)
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("activa", "==", true)
    .limit(1)
    .get();
  if (!mpQuery.empty) cuentaMPId = mpQuery.docs[0].id;

  // Obtener tipo de cambio centralizado
  const tc = await resolverTCVenta();

  // Crear PagoGasto (pagado automáticamente desde cuenta MP)
  const pagoGastoId = `PAG-GAS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const pagoGasto = cuentaMPId ? {
    id: pagoGastoId,
    fecha: now,
    monedaPago: "PEN",
    montoOriginal: costoDistribucion,
    montoPEN: costoDistribucion,
    tipoCambio: tc,
    metodoPago: "mercado_pago",
    cuentaOrigenId: cuentaMPId,
    registradoPor: "ml-auto-delivery",
  } : null;

  // Crear gasto GD
  const metodoLabel = metodo === "flex" ? "Flex (GK Express)" : "Urbano";
  const gastoData: Record<string, any> = {
    numeroGasto,
    tipo: "delivery",
    categoria: "GD",
    claseGasto: "GVD",
    descripcion: `Distribución ML ${metodoLabel} - Orden #${orderSync.mlOrderId} - ${numeroVenta}`,
    moneda: "PEN",
    montoOriginal: costoDistribucion,
    montoPEN: costoDistribucion,
    tipoCambio: tc,
    esProrrateable: false,
    ventaId,
    ventaNumero: numeroVenta,
    transportistaId: transportista.id,
    transportistaNombre: transportista.nombre,
    mes,
    anio,
    fecha: now,
    esRecurrente: false,
    frecuencia: "unico",
    estado: pagoGasto ? "pagado" : "pendiente",
    impactaCTRU: false,
    ctruRecalculado: true,
    pagos: pagoGasto ? [pagoGasto] : [],
    montoPagado: pagoGasto ? costoDistribucion : 0,
    montoPendiente: pagoGasto ? 0 : costoDistribucion,
    proveedor: transportista.nombre,
    creadoPor: "ml-auto-delivery",
    fechaCreacion: now,
  };

  const gastoRef = await db.collection(COLLECTIONS.GASTOS).add(gastoData);

  // Crear movimiento tesorería (egreso) si hay cuenta MP
  if (cuentaMPId) {
    const movimientoEgreso: Record<string, any> = {
      numeroMovimiento: `MOV-mlgd-${Date.now()}`,
      tipo: "gasto_operativo",
      estado: "ejecutado",
      moneda: "PEN",
      monto: costoDistribucion,
      tipoCambio: tc,
      metodo: "mercado_pago",
      concepto: `Distribución ML ${metodoLabel} - ${numeroVenta} - Orden #${orderSync.mlOrderId}`,
      gastoId: gastoRef.id,
      gastoNumero: numeroGasto,
      ventaId,
      ventaNumero: numeroVenta,
      cuentaOrigen: cuentaMPId,
      fecha: now,
      creadoPor: "ml-auto-delivery",
      fechaCreacion: now,
    };
    await db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA).add(movimientoEgreso);

    // Actualizar saldo cuenta MP
    await db.collection(COLLECTIONS.CUENTAS_CAJA).doc(cuentaMPId).update({
      saldoActual: admin.firestore.FieldValue.increment(-costoDistribucion),
    });
  }

  // Actualizar venta: agregar costoEnvioNegocio y recalcular márgenes
  const costoEnvioNegocio = costoDistribucion;
  const comisionML = ventaData.comisionML || 0;
  const gastosVentaPEN = comisionML + costoEnvioNegocio + (ventaData.otrosGastosVenta || 0);
  const totalPEN = ventaData.totalPEN || 0;
  const costoTotalPEN = ventaData.costoTotalPEN || 0;
  const utilidadBrutaPEN = totalPEN - costoTotalPEN;
  const utilidadNetaPEN = utilidadBrutaPEN - gastosVentaPEN;

  const ventaUpdate: Record<string, any> = {
    costoEnvioNegocio,
    gastosVentaPEN,
    utilidadNetaPEN,
    margenNeto: totalPEN > 0 ? (utilidadNetaPEN / totalPEN) * 100 : 0,
    transportistaId: transportista.id,
    transportistaNombre: transportista.nombre,
  };

  await db.collection(COLLECTIONS.VENTAS).doc(ventaId).update(ventaUpdate);

  functions.logger.info(
    `ML GD Auto: ${numeroGasto} | ${metodoLabel} S/ ${costoDistribucion.toFixed(2)} → ` +
    `Venta ${numeroVenta} | gastosVentaPEN: S/ ${gastosVentaPEN.toFixed(2)} | ` +
    `margenNeto: ${ventaUpdate.margenNeto.toFixed(1)}%`
  );
}

// ============================================================
// IMPORTAR HISTORIAL DE ÓRDENES ML
// ============================================================

/**
 * Importa órdenes históricas desde la API de ML al sistema.
 *
 * Diseño:
 * - Busca órdenes paginadas del seller (más recientes primero)
 * - Omite órdenes que ya existen en mlOrderSync
 * - Enriquece cada orden con datos del buyer, envío y mapeo de productos
 * - NO auto-procesa ventas (el usuario decide manualmente qué procesar)
 * - Marca cada registro con origen: "importacion_historica"
 * - Órdenes canceladas se marcan como "ignorada"
 *
 * Esto permite al usuario tener visibilidad completa de su historial ML
 * sin confundir datos históricos con operaciones en tiempo real.
 */
export async function importHistoricalOrders(
  sellerId: number,
  maxOrders: number = 100
): Promise<{
  importadas: number;
  omitidas: number;
  errores: number;
  totalEnML: number;
}> {
  let offset = 0;
  const pageSize = 50;
  let importadas = 0;
  let omitidas = 0;
  let errores = 0;
  let totalEnML = 0;

  functions.logger.info(
    `ML Import: Importando hasta ${maxOrders} órdenes históricas para seller ${sellerId}`
  );

  while (offset < maxOrders) {
    const batchLimit = Math.min(pageSize, maxOrders - offset);
    const searchResult = await searchOrders(sellerId, {
      offset,
      limit: batchLimit,
    });
    totalEnML = searchResult.paging.total;

    if (searchResult.results.length === 0) break;

    for (const order of searchResult.results) {
      try {
        // Verificar si ya existe en el sistema
        const existingQuery = await db
          .collection(COLLECTIONS.ML_ORDER_SYNC)
          .where("mlOrderId", "==", order.id)
          .limit(1)
          .get();

        if (!existingQuery.empty) {
          // Re-sync: agregar metodoEnvio/cargoEnvioML si faltan
          const existingDoc = existingQuery.docs[0];
          const existingData = existingDoc.data();
          if (!existingData.metodoEnvio || (!existingData.costoEnvioCliente && !existingData.cargoEnvioML)) {
            try {
              let updatedEnvioCliente = 0;
              let updatedMetodoEnvio: "flex" | "urbano" | null = null;
              let updatedTrackingMethod: string | null = existingData.trackingMethod || null;

              if (order.shipping?.id) {
                const shipment = await getShipment(order.shipping.id);
                const shOpt = (shipment as any).shipping_option;
                if (shOpt?.cost > 0) {
                  updatedEnvioCliente = shOpt.cost;
                } else if (shOpt?.list_cost > 0) {
                  updatedEnvioCliente = shOpt.list_cost;
                } else if (shipment.lead_time?.cost) {
                  updatedEnvioCliente = shipment.lead_time.cost;
                }
                updatedTrackingMethod = shipment.tracking_method || updatedTrackingMethod;
              }
              if (updatedEnvioCliente === 0 && order.payments?.length > 0) {
                updatedEnvioCliente = order.payments[0].shipping_cost || 0;
                if (updatedEnvioCliente === 0) {
                  const totalPaid = order.payments[0].total_paid_amount || 0;
                  const txAmount = order.payments[0].transaction_amount || 0;
                  if (totalPaid > txAmount) {
                    updatedEnvioCliente = totalPaid - txAmount;
                  }
                }
              }

              // Detectar método de envío
              const m = (updatedTrackingMethod || "").toLowerCase();
              if (m.includes("flex") || m === "self_service") {
                updatedMetodoEnvio = "flex";
              } else if (updatedTrackingMethod) {
                updatedMetodoEnvio = "urbano";
              }

              // Clasificar: Urbano = deducción, Flex = ingreso
              const updateFields: Record<string, any> = {};
              if (updatedMetodoEnvio) updateFields.metodoEnvio = updatedMetodoEnvio;
              if (updatedMetodoEnvio === "urbano" && updatedEnvioCliente > 0) {
                updateFields.cargoEnvioML = updatedEnvioCliente;
                updateFields.costoEnvioCliente = 0;
              } else if (updatedEnvioCliente > 0) {
                updateFields.costoEnvioCliente = updatedEnvioCliente;
                updateFields.costoEnvioML = existingData.costoEnvioML || updatedEnvioCliente;
              }

              if (Object.keys(updateFields).length > 0) {
                await existingDoc.ref.update(updateFields);
                functions.logger.info(
                  `ML Import: Orden ${order.id} → re-sync envío: ${JSON.stringify(updateFields)}`
                );
              }
            } catch {
              // Non-critical
            }
          }
          omitidas++;
          continue;
        }

        // ---- Enriquecer con datos del buyer ----
        // /orders/search devuelve datos limitados del buyer (solo id y nickname).
        // Para obtener first_name/last_name necesitamos /orders/{id} individual.
        let buyerName = "Cliente ML";
        let buyerNickname: string | null = order.buyer.nickname || null;
        let buyerEmail: string | null = null;
        let buyerPhone: string | null = null;
        let buyerDni: string | null = null;
        let buyerDocType: string | null = null;
        let razonSocial: string | null = null;

        // Datos directos del objeto order del search (fallback)
        if (order.buyer.first_name) {
          buyerName = `${order.buyer.first_name} ${order.buyer.last_name || ""}`.trim();
        }
        if (order.buyer.billing_info?.doc_number) {
          buyerDni = order.buyer.billing_info.doc_number;
          buyerDocType = order.buyer.billing_info.doc_type || null;
        }
        if (order.buyer.phone?.number) {
          buyerPhone = `${order.buyer.phone.area_code || ""}${order.buyer.phone.number}`.trim();
        }
        if (order.buyer.email) {
          buyerEmail = order.buyer.email;
        }

        // Si no vino first_name del search, obtener orden individual
        if (buyerName === "Cliente ML") {
          try {
            const fullOrder = await getOrder(order.id);
            if (fullOrder.buyer.first_name) {
              buyerName = `${fullOrder.buyer.first_name} ${fullOrder.buyer.last_name || ""}`.trim();
            }
            if (!buyerPhone && fullOrder.buyer.phone?.number) {
              buyerPhone = `${fullOrder.buyer.phone.area_code || ""}${fullOrder.buyer.phone.number}`.trim();
            }
            if (!buyerEmail && fullOrder.buyer.email) {
              buyerEmail = fullOrder.buyer.email;
            }
            if (!buyerNickname && fullOrder.buyer.nickname) {
              buyerNickname = fullOrder.buyer.nickname;
            }
          } catch {
            // Non-critical
          }
        }

        // /users/{id} para datos adicionales
        try {
          const buyer = await getUser(order.buyer.id);
          if (!buyerEmail && buyer.email) buyerEmail = buyer.email;
          if (!buyerPhone && buyer.phone?.number) {
            buyerPhone = `${buyer.phone.area_code || ""}${buyer.phone.number}`.trim();
          }
          if (!buyerDni && buyer.identification?.number) {
            buyerDni = buyer.identification.number;
            if (!buyerDocType && buyer.identification.type) {
              buyerDocType = buyer.identification.type;
            }
          }
          if (!buyerNickname && buyer.nickname) {
            buyerNickname = buyer.nickname;
          }
        } catch {
          // Non-critical
        }

        // billing_info = FUENTE PRIMARIA de nombre, DNI y razón social
        try {
          const billingInfo = await getOrderBillingInfo(order.id);
          if (billingInfo) {
            if (billingInfo.doc_number) buyerDni = billingInfo.doc_number;
            if (billingInfo.doc_type) buyerDocType = billingInfo.doc_type;

            if (billingInfo.additional_info) {
              const firstName = billingInfo.additional_info.find((i) => i.type === "FIRST_NAME")?.value?.trim();
              const lastName = billingInfo.additional_info.find((i) => i.type === "LAST_NAME")?.value?.trim();
              if (firstName || lastName) {
                buyerName = `${firstName || ""} ${lastName || ""}`.trim();
              }

              const businessName = billingInfo.additional_info.find(
                (i) => i.type === "TAXPAYER_NAME" || i.type === "BUSINESS_NAME"
              );
              if (businessName?.value) {
                razonSocial = businessName.value;
              }
            }
          }
        } catch {
          // Non-critical
        }

        // ---- Enriquecer con datos de envío ----
        let direccionEntrega = "";
        let distrito = "";
        let provincia = "";
        let codigoPostal: string | null = null;
        let referenciaEntrega: string | null = null;
        let costoEnvioML = 0;
        let costoEnvioCliente = 0;
        let trackingNumber: string | null = null;
        let trackingMethod: string | null = null;
        let coordenadas: { lat: number; lng: number } | null = null;
        let shipmentId: number | null = null;
        let shipmentStatus = "unknown";

        if (order.shipping?.id) {
          shipmentId = order.shipping.id;
          try {
            const shipment = await getShipment(order.shipping.id);
            const addr = shipment.receiver_address;
            direccionEntrega =
              addr.address_line ||
              `${addr.street_name} ${addr.street_number}`.trim();
            distrito = addr.city?.name || "";
            provincia = addr.state?.name || "";
            codigoPostal = addr.zip_code || null;
            referenciaEntrega = addr.comment || null;
            costoEnvioML = shipment.lead_time?.cost || 0;
            trackingNumber = shipment.tracking_number;
            trackingMethod = shipment.tracking_method;
            shipmentStatus = shipment.status;

            // shipping_option: cost = pagó comprador, list_cost = bonificación ML
            const shOpt2 = (shipment as any).shipping_option;
            if (shOpt2?.cost > 0) {
              costoEnvioCliente = shOpt2.cost;
            } else if (shOpt2?.list_cost > 0) {
              costoEnvioCliente = shOpt2.list_cost;
            }

            if (addr.latitude && addr.longitude) {
              coordenadas = { lat: addr.latitude, lng: addr.longitude };
            }
          } catch {
            // Non-critical: envío puede no ser accesible para órdenes antiguas
          }
        }

        // Fallback: obtener costo de envío del payment si no vino del shipment
        if (costoEnvioCliente === 0 && order.payments?.length > 0) {
          costoEnvioCliente = order.payments[0].shipping_cost || 0;
          if (costoEnvioCliente === 0) {
            const totalPaid = order.payments[0].total_paid_amount || 0;
            const txAmount = order.payments[0].transaction_amount || 0;
            if (totalPaid > txAmount) {
              costoEnvioCliente = totalPaid - txAmount;
            }
          }
        }
        if (costoEnvioCliente === 0 && costoEnvioML > 0) {
          costoEnvioCliente = costoEnvioML;
        }

        // ---- Detectar método de envío y clasificar costos ----
        let metodoEnvio: "flex" | "urbano" | null = null;
        const methodStr2 = (trackingMethod || "").toLowerCase();
        if (methodStr2.includes("flex") || methodStr2 === "self_service") {
          metodoEnvio = "flex";
        } else if (trackingMethod) {
          metodoEnvio = "urbano";
        }

        // Clasificar costo de envío según método:
        // - Urbano (ML envía): cargo por envío es deducción al vendedor, NO ingreso
        // - Flex (vendedor envía): envío es ingreso (bonificación ML o cliente paga)
        let cargoEnvioML = 0;
        if (metodoEnvio === "urbano" && costoEnvioCliente > 0) {
          cargoEnvioML = costoEnvioCliente;
          costoEnvioCliente = 0; // No es ingreso para el vendedor
        }

        // ---- Calcular comisiones ----
        const comisionML = calcularComisionTotal(order);

        // ---- Resolver mapeo de productos ML → ERP ----
        const productosResueltos = await resolverProductosOrden(order);
        const todosVinculados = productosResueltos.every(
          (p) => p.productoId !== null
        );

        // ---- Determinar estado según estado de la orden en ML ----
        let estado: "pendiente" | "ignorada" = "pendiente";
        let errorDetalle: string | null = null;

        if (order.status === "cancelled") {
          estado = "ignorada";
          errorDetalle = `Orden cancelada en ML (${
            order.cancel_detail?.reason || "sin razón"
          })`;
        } else if (order.status !== "paid") {
          errorDetalle = `Estado en ML: ${order.status}`;
        } else if (!todosVinculados) {
          errorDetalle = `Productos sin vincular: ${productosResueltos
            .filter((p) => !p.productoId)
            .map((p) => p.mlTitle)
            .join(", ")}`;
        }

        // ---- Crear registro completo en mlOrderSync ----
        await db.collection(COLLECTIONS.ML_ORDER_SYNC).add({
          mlOrderId: order.id,
          mlStatus: order.status,
          mlBuyerId: order.buyer.id,
          mlBuyerName: buyerName,
          mlBuyerNickname: buyerNickname,
          buyerEmail,
          buyerPhone,
          buyerDni,
          buyerDocType,
          razonSocial,
          ventaId: null,
          numeroVenta: null,
          clienteId: null,
          estado,
          errorDetalle,
          totalML: order.total_amount,
          comisionML,
          costoEnvioML,
          costoEnvioCliente,
          metodoEnvio,
          cargoEnvioML,
          direccionEntrega,
          distrito,
          provincia,
          codigoPostal,
          referenciaEntrega,
          coordenadas,
          trackingNumber,
          trackingMethod,
          shipmentId,
          shipmentStatus,
          productos: productosResueltos,
          todosVinculados,
          origen: "importacion_historica",
          fechaOrdenML: Timestamp.fromDate(new Date(order.date_created)),
          fechaProcesada: null,
          fechaSync: Timestamp.now(),
          fechaImportacion: Timestamp.now(),
          rawOrder: {
            id: order.id,
            status: order.status,
            total_amount: order.total_amount,
            currency_id: order.currency_id,
            date_created: order.date_created,
            date_closed: order.date_closed,
            items_count: order.order_items.length,
          },
        });

        importadas++;

        functions.logger.info(
          `ML Import: Orden ${order.id} (${order.status}) importada. Vinculados: ${todosVinculados}`
        );
      } catch (err: any) {
        errores++;
        functions.logger.error(
          `ML Import: Error importando orden ${order.id}:`,
          err.message
        );
      }

      // Rate limit: 300ms entre órdenes (cada una puede requerir 2-3 llamadas API)
      await new Promise((r) => setTimeout(r, 300));
    }

    offset += searchResult.results.length;
    if (offset >= totalEnML) break;
  }

  // Actualizar última sync
  await db.collection(COLLECTIONS.ML_CONFIG).doc("settings").update({
    lastHistoricalImport: Timestamp.now(),
  });

  functions.logger.info(
    `ML Import completado: ${importadas} importadas, ${omitidas} omitidas (ya existían), ` +
      `${errores} errores (total en ML: ${totalEnML})`
  );

  return { importadas, omitidas, errores, totalEnML };
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Calcula la comisión total de ML para una orden
 */
function calcularComisionTotal(order: MLOrder): number {
  return order.order_items.reduce((total, item) => {
    return total + (item.sale_fee || 0) * (item.quantity || 1);
  }, 0);
}

/**
 * Resuelve el mapeo de productos de una orden ML a productos del ERP.
 * Busca en mlProductMap por mlItemId.
 * Retorna los datos necesarios para crear la Venta.
 */
async function resolverProductosOrden(order: MLOrder): Promise<Array<{
  mlItemId: string;
  mlTitle: string;
  mlVariationId: number | null;
  cantidad: number;
  precioUnitario: number;
  saleFee: number;
  productoId: string | null;
  productoSku: string | null;
  productoNombre: string | null;
  vinculado: boolean;
}>> {
  const productos = [];

  for (const orderItem of order.order_items) {
    const itemId = orderItem.item.id;

    // Buscar en el mapeo
    const mapQuery = await db
      .collection("mlProductMap")
      .where("mlItemId", "==", itemId)
      .limit(1)
      .get();

    let productoId: string | null = null;
    let productoSku: string | null = null;
    let productoNombre: string | null = null;
    let vinculado = false;

    if (!mapQuery.empty) {
      const map = mapQuery.docs[0].data() as MLProductMap;
      productoId = map.productoId;
      productoSku = map.productoSku;
      productoNombre = map.productoNombre;
      vinculado = map.vinculado;
    }

    productos.push({
      mlItemId: itemId,
      mlTitle: orderItem.item.title,
      mlVariationId: orderItem.item.variation_id,
      cantidad: orderItem.quantity,
      precioUnitario: orderItem.unit_price,
      saleFee: orderItem.sale_fee || 0,
      productoId,
      productoSku,
      productoNombre,
      vinculado,
    });
  }

  return productos;
}

// ============================================================
// RE-ENRIQUECER DATOS DE BUYERS EN ÓRDENES EXISTENTES
// ============================================================

/**
 * Re-obtiene datos reales del buyer (nombre, DNI, teléfono, email) desde la API de ML
 * para todas las órdenes en mlOrderSync. También actualiza el cliente ERP si ya fue creado.
 */
export async function reenrichBuyerData(): Promise<{
  actualizadas: number;
  clientesActualizados: number;
  errores: number;
  total: number;
}> {
  const snapshot = await db.collection(COLLECTIONS.ML_ORDER_SYNC).get();
  let actualizadas = 0;
  let clientesActualizados = 0;
  let errores = 0;
  const total = snapshot.size;

  functions.logger.info(`ML Re-enrich: Procesando ${total} órdenes...`);

  for (const doc of snapshot.docs) {
    const data = doc.data() as MLOrderSync & {
      buyerEmail?: string | null;
      buyerPhone?: string | null;
      buyerDni?: string | null;
      clienteId?: string | null;
    };

    try {
      // Obtener la orden fresca desde ML API
      const order = await getOrder(data.mlOrderId);

      let buyerName = "Cliente ML";
      let buyerNickname: string | null = order.buyer.nickname || null;
      let buyerEmail: string | null = null;
      let buyerPhone: string | null = null;
      let buyerDni: string | null = null;
      let buyerDocType: string | null = null;
      let razonSocial: string | null = null;

      // Datos directos del objeto order (fallback inicial)
      if (order.buyer.first_name) {
        buyerName = `${order.buyer.first_name} ${order.buyer.last_name || ""}`.trim();
      }
      if (order.buyer.billing_info?.doc_number) {
        buyerDni = order.buyer.billing_info.doc_number;
        buyerDocType = order.buyer.billing_info.doc_type || null;
      }
      if (order.buyer.phone?.number) {
        buyerPhone = `${order.buyer.phone.area_code || ""}${order.buyer.phone.number}`.trim();
      }
      if (order.buyer.email) {
        buyerEmail = order.buyer.email;
      }

      // Enriquecer con /users/{id} si faltan datos
      try {
        const buyer = await getUser(order.buyer.id);
        if (!buyerEmail && buyer.email) buyerEmail = buyer.email;
        if (!buyerPhone && buyer.phone?.number) {
          buyerPhone = `${buyer.phone.area_code || ""}${buyer.phone.number}`.trim();
        }
        if (!buyerDni && buyer.identification?.number) {
          buyerDni = buyer.identification.number;
          if (!buyerDocType && buyer.identification.type) {
            buyerDocType = buyer.identification.type;
          }
        }
        if (!buyerNickname && buyer.nickname) {
          buyerNickname = buyer.nickname;
        }
      } catch {
        // Non-critical
      }

      // billing_info = FUENTE PRIMARIA de nombre, DNI y razón social
      try {
        const billingInfo = await getOrderBillingInfo(data.mlOrderId);
        if (billingInfo) {
          // DNI/RUC
          if (billingInfo.doc_number) buyerDni = billingInfo.doc_number;
          if (billingInfo.doc_type) buyerDocType = billingInfo.doc_type;

          if (billingInfo.additional_info) {
            // Nombre legal del comprador (fuente primaria)
            const firstName = billingInfo.additional_info.find((i) => i.type === "FIRST_NAME")?.value?.trim();
            const lastName = billingInfo.additional_info.find((i) => i.type === "LAST_NAME")?.value?.trim();
            if (firstName || lastName) {
              buyerName = `${firstName || ""} ${lastName || ""}`.trim();
            }

            // Razón social para RUC/empresas
            const businessName = billingInfo.additional_info.find(
              (i) => i.type === "TAXPAYER_NAME" || i.type === "BUSINESS_NAME"
            );
            if (businessName?.value) {
              razonSocial = businessName.value;
            }
          }
        }
      } catch {
        // Non-critical
      }

      // Recalcular comisión (sale_fee × quantity por cada item)
      const comisionML = calcularComisionTotal(order);

      // Re-fetch shipment para obtener metodoEnvio actualizado
      let metodoEnvio: string | null = data.metodoEnvio || null;
      let cargoEnvioML = data.cargoEnvioML || 0;
      let costoEnvioCliente = data.costoEnvioCliente || 0;
      if (!metodoEnvio && order.shipping?.id) {
        try {
          const shipment = await getShipment(order.shipping.id);
          const method = (shipment.tracking_method || "").toLowerCase();
          if (method.includes("flex") || method === "self_service") {
            metodoEnvio = "flex";
          } else if (method.includes("urbano") || method === "standard" || method === "normal") {
            metodoEnvio = "urbano";
          }
          // Reclasificar envío si urbano y no fue hecho antes
          if (metodoEnvio === "urbano" && costoEnvioCliente > 0 && cargoEnvioML === 0) {
            cargoEnvioML = costoEnvioCliente;
            costoEnvioCliente = 0;
          }
        } catch {
          // Non-critical
        }
      }

      // Actualizar mlOrderSync
      const syncUpdateData: Record<string, any> = {
        mlBuyerName: buyerName,
        mlBuyerNickname: buyerNickname,
        buyerEmail,
        buyerPhone,
        buyerDni,
        buyerDocType,
        razonSocial,
        comisionML,
      };
      if (metodoEnvio) {
        syncUpdateData.metodoEnvio = metodoEnvio;
        syncUpdateData.cargoEnvioML = cargoEnvioML;
        syncUpdateData.costoEnvioCliente = costoEnvioCliente;
      }
      await doc.ref.update(syncUpdateData);
      actualizadas++;

      // Si ya tiene un cliente ERP vinculado, actualizarlo con datos completos
      if (data.clienteId) {
        try {
          const clienteRef = db.collection(COLLECTIONS.CLIENTES).doc(data.clienteId);
          const clienteDoc = await clienteRef.get();
          if (clienteDoc.exists) {
            const esEmpresa = buyerDocType === "RUC" || (buyerDni && buyerDni.length === 11);
            const nombreCliente = (esEmpresa && razonSocial) ? razonSocial : (buyerName !== "Cliente ML" ? buyerName : null);

            const updateData: Record<string, any> = {};
            if (nombreCliente) {
              updateData.nombre = nombreCliente;
              updateData.nombreLowercase = nombreCliente.toLowerCase().trim();
            }
            if (buyerDni) updateData.dniRuc = buyerDni;
            if (buyerDocType) updateData.tipoDocumento = buyerDocType;
            if (esEmpresa !== undefined) updateData.tipoCliente = esEmpresa ? "empresa" : "persona";
            if (buyerPhone) updateData.telefono = buyerPhone.replace(/\D/g, "");
            if (buyerEmail) updateData.email = buyerEmail;

            if (Object.keys(updateData).length > 0) {
              await clienteRef.update(updateData);
              clientesActualizados++;
              functions.logger.info(`ML Re-enrich: Cliente ${data.clienteId} actualizado → ${nombreCliente || buyerName} (${buyerDocType || "DOC"}: ${buyerDni || "N/A"})`);
            }
          }
        } catch (err: any) {
          functions.logger.warn(`ML Re-enrich: Error actualizando cliente ${data.clienteId}:`, err.message);
        }
      }

      // Si la orden ya fue procesada, corregir datos de la venta (nombre, comisión)
      if (data.ventaId) {
        try {
          // Corregir nombre del cliente en la venta si difiere
          const ventaRef = db.collection(COLLECTIONS.VENTAS).doc(data.ventaId);
          const ventaDoc = await ventaRef.get();
          if (ventaDoc.exists) {
            const ventaData = ventaDoc.data()!;
            if (buyerName !== "Cliente ML" && ventaData.nombreCliente !== buyerName) {
              await ventaRef.update({ nombreCliente: buyerName });
              functions.logger.info(`ML Re-enrich: Venta ${data.ventaId} nombreCliente → ${buyerName}`);
            }
          }

          // Corregir comisión (crea gasto si no existe, o lo actualiza)
          if (comisionML > 0 && data.numeroVenta) {
            await corregirComisionML(
              data.ventaId,
              data.numeroVenta,
              data.mlOrderId,
              comisionML,
              doc.ref
            );
          }

          // Propagar metodoEnvio a la venta si falta
          if (ventaDoc.exists && metodoEnvio) {
            const vData = ventaDoc.data()!;
            if (!vData.metodoEnvio) {
              const ventaMetodoUpdate: Record<string, any> = { metodoEnvio };
              // Si es urbano y la venta tiene costoEnvio inflado, reclasificar
              if (metodoEnvio === "urbano" && (vData.costoEnvio || 0) > 0 && !(vData.cargoEnvioML || 0)) {
                ventaMetodoUpdate.cargoEnvioML = vData.costoEnvio;
                ventaMetodoUpdate.costoEnvio = 0;
                ventaMetodoUpdate.totalPEN = (vData.subtotalPEN || 0);
              }
              await ventaRef.update(ventaMetodoUpdate);
              functions.logger.info(
                `ML Re-enrich: Venta ${data.ventaId} metodoEnvio → ${metodoEnvio}`
              );
            }
          }
        } catch (err: any) {
          functions.logger.warn(`ML Re-enrich: Error corrigiendo datos para venta ${data.ventaId}:`, err.message);
        }
      }

      functions.logger.info(
        `ML Re-enrich: Orden ${data.mlOrderId} → name=${buyerName}, dni=${buyerDni || "N/A"}, comision=${comisionML}`
      );
    } catch (err: any) {
      errores++;
      functions.logger.error(`ML Re-enrich: Error en orden ${data.mlOrderId}:`, err.message);
    }

    // Rate limit: 400ms entre órdenes (2 API calls each)
    await new Promise((r) => setTimeout(r, 400));
  }

  functions.logger.info(
    `ML Re-enrich completado: ${actualizadas}/${total} actualizadas, ${clientesActualizados} clientes, ${errores} errores`
  );

  return { actualizadas, clientesActualizados, errores, total };
}

// ============================================================
// REPARAR VENTAS URBANO CON ENVÍO INFLADO
// ============================================================

/**
 * Repara ventas creadas desde órdenes Urbano importadas que tenían
 * costoEnvioCliente > 0 (debería ser 0, ya que Urbano no es ingreso).
 *
 * Corrige: mlOrderSync, venta (total, costoEnvio, márgenes),
 * pago, tesorería (movimiento + saldo cuenta), y recalcula rentabilidad.
 */
export async function repararVentasUrbano(): Promise<{
  reparadas: number;
  omitidas: number;
  errores: number;
  total: number;
  detalles: string[];
}> {
  const detalles: string[] = [];
  let reparadas = 0;
  let omitidas = 0;
  let errores = 0;

  // 1. Buscar todas las órdenes procesadas que tienen ventaId
  const snapshot = await db.collection(COLLECTIONS.ML_ORDER_SYNC)
    .where("estado", "==", "procesada")
    .get();

  const total = snapshot.size;
  functions.logger.info(`ML Repair: Analizando ${total} órdenes procesadas...`);

  for (const doc of snapshot.docs) {
    const data = doc.data();

    try {
      // Detectar si es Urbano: por metodoEnvio, o por trackingMethod
      let esUrbano = data.metodoEnvio === "urbano";
      if (!esUrbano && data.trackingMethod) {
        const m = (data.trackingMethod || "").toLowerCase();
        esUrbano = !m.includes("flex") && m !== "self_service";
      }

      if (!esUrbano) {
        omitidas++;
        continue;
      }

      // Verificar si la venta tiene costoEnvio > 0 (error a reparar)
      const ventaId = data.ventaId;
      if (!ventaId) {
        omitidas++;
        continue;
      }

      const ventaDoc = await db.collection(COLLECTIONS.VENTAS).doc(ventaId).get();
      if (!ventaDoc.exists) {
        omitidas++;
        continue;
      }

      const venta = ventaDoc.data()!;
      const costoEnvioActual = venta.costoEnvio || 0;
      const syncCostoEnvioCliente = data.costoEnvioCliente || 0;

      // Verificar si hay algo que reparar (venta O mlOrderSync)
      const ventaNecesitaReparo = costoEnvioActual > 0;
      const syncNecesitaReparo = syncCostoEnvioCliente > 0 || data.metodoEnvio !== "urbano";

      if (!ventaNecesitaReparo && !syncNecesitaReparo) {
        omitidas++;
        continue;
      }

      // ---- REPARAR ----
      const envioInflado = costoEnvioActual || syncCostoEnvioCliente;
      const subtotalPEN = venta.subtotalPEN || 0;
      const nuevoTotalPEN = subtotalPEN; // Sin envío para Urbano
      const comisionML = venta.comisionML || 0;
      const nuevaComisionPorcentaje = nuevoTotalPEN > 0 ? (comisionML / nuevoTotalPEN) * 100 : 0;
      const costoTotalPEN = venta.costoTotalPEN || 0;
      const gastosVentaPEN = venta.gastosVentaPEN || 0;
      const utilidadBrutaPEN = nuevoTotalPEN - costoTotalPEN;
      const utilidadNetaPEN = utilidadBrutaPEN - gastosVentaPEN;
      const margenBruto = nuevoTotalPEN > 0 ? (utilidadBrutaPEN / nuevoTotalPEN) * 100 : 0;
      const margenNeto = nuevoTotalPEN > 0 ? (utilidadNetaPEN / nuevoTotalPEN) * 100 : 0;

      const numeroVenta = venta.numeroVenta || ventaId;

      // A) Actualizar la venta (solo si tiene costoEnvio inflado)
      if (ventaNecesitaReparo) {
        await ventaDoc.ref.update({
          costoEnvio: 0,
          totalPEN: nuevoTotalPEN,
          comisionMLPorcentaje: nuevaComisionPorcentaje,
          cargoEnvioML: envioInflado,
          metodoEnvio: "urbano",
          montoPagado: nuevoTotalPEN,
          montoPendiente: 0,
          utilidadBrutaPEN,
          utilidadNetaPEN,
          margenBruto,
          margenNeto,
        });

        // B) Actualizar el pago dentro de la venta (array pagos)
        const pagos = venta.pagos || [];
        if (pagos.length > 0) {
          const pagosActualizados = pagos.map((p: any) => ({
            ...p,
            monto: nuevoTotalPEN,
          }));
          await ventaDoc.ref.update({ pagos: pagosActualizados });
        }

        // C) Corregir movimiento de tesorería (ingreso_venta)
        const movIngresoQuery = await db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA)
          .where("ventaId", "==", ventaId)
          .where("tipo", "==", "ingreso_venta")
          .limit(1)
          .get();

        if (!movIngresoQuery.empty) {
          const movDoc = movIngresoQuery.docs[0];
          const movData = movDoc.data();
          const montoAnterior = movData.monto || 0;
          const diferencia = montoAnterior - nuevoTotalPEN;
          const cuentaMPId = movData.cuentaDestino || null;

          await movDoc.ref.update({
            monto: nuevoTotalPEN,
            concepto: `Pago venta ${numeroVenta} - ML #${data.mlOrderId} (reparado)`,
          });

          if (cuentaMPId && diferencia > 0) {
            await db.collection(COLLECTIONS.CUENTAS_CAJA).doc(cuentaMPId).update({
              saldoActual: admin.firestore.FieldValue.increment(-diferencia),
            });
            detalles.push(
              `${numeroVenta}: Saldo cuenta MP ajustado -S/ ${diferencia.toFixed(2)}`
            );
          }
        }
      }

      // D) Actualizar mlOrderSync (siempre para Urbano)
      await doc.ref.update({
        metodoEnvio: "urbano",
        cargoEnvioML: envioInflado || (data.cargoEnvioML || 0),
        costoEnvioCliente: 0,
      });

      reparadas++;
      if (ventaNecesitaReparo) {
        detalles.push(
          `${numeroVenta} (ML-${data.mlOrderId}): totalPEN ${(subtotalPEN + envioInflado).toFixed(2)} → ${nuevoTotalPEN.toFixed(2)} (-S/ ${envioInflado.toFixed(2)} envío)`
        );
      } else {
        detalles.push(
          `${numeroVenta} (ML-${data.mlOrderId}): mlOrderSync corregido (costoEnvioCliente → 0)`
        );
      }

      functions.logger.info(
        `ML Repair: ${numeroVenta} reparada — envío inflado S/ ${envioInflado.toFixed(2)} removido`
      );
    } catch (err: any) {
      errores++;
      functions.logger.error(`ML Repair: Error en orden ${data.mlOrderId}:`, err.message);
      detalles.push(`ERROR ML-${data.mlOrderId}: ${err.message}`);
    }
  }

  functions.logger.info(
    `ML Repair completado: ${reparadas} reparadas, ${omitidas} sin cambios, ${errores} errores (de ${total} total)`
  );

  return { reparadas, omitidas, errores, total, detalles };
}

// ============================================================
// REPARAR NOMBRES Y DNI EN VENTAS ML
// ============================================================

/**
 * Convierte texto a Title Case: "ROBERTO CLEMENTE" → "Roberto Clemente"
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

/**
 * Repara ventas ML existentes:
 * 1. Nombres en MAYÚSCULAS → Title Case
 * 2. dniRuc faltante → backfill desde mlOrderSync
 * También actualiza los clientes vinculados.
 */
export async function repararNombresDniVentas(): Promise<{
  reparadas: number;
  omitidas: number;
  errores: number;
  total: number;
  detalles: string[];
}> {
  const db = admin.firestore();

  // Buscar todas las mlOrderSync procesadas
  const syncSnap = await db.collection(COLLECTIONS.ML_ORDER_SYNC)
    .where("estado", "==", "procesada")
    .get();

  const total = syncSnap.size;
  let reparadas = 0;
  let omitidas = 0;
  let errores = 0;
  const detalles: string[] = [];

  for (const syncDoc of syncSnap.docs) {
    const data = syncDoc.data();

    try {
      const ventaId = data.ventaId;
      if (!ventaId) {
        omitidas++;
        continue;
      }

      const ventaDoc = await db.collection(COLLECTIONS.VENTAS).doc(ventaId).get();
      if (!ventaDoc.exists) {
        omitidas++;
        continue;
      }

      const venta = ventaDoc.data()!;
      const ventaUpdates: Record<string, any> = {};
      const changes: string[] = [];

      // --- Fix 1: Title Case del nombre ---
      const nombreActual = venta.nombreCliente || "";
      if (nombreActual && nombreActual !== "Cliente ML") {
        const nombreTitleCase = toTitleCase(nombreActual);
        if (nombreTitleCase !== nombreActual) {
          ventaUpdates.nombreCliente = nombreTitleCase;
          changes.push(`nombre: "${nombreActual}" → "${nombreTitleCase}"`);
        }
      }

      // --- Fix 2: DNI faltante → backfill desde mlOrderSync ---
      if (!venta.dniRuc && data.buyerDni) {
        ventaUpdates.dniRuc = data.buyerDni;
        changes.push(`dniRuc: vacío → ${data.buyerDni}`);
      }

      if (Object.keys(ventaUpdates).length === 0) {
        omitidas++;
        continue;
      }

      // Actualizar venta
      await db.collection(COLLECTIONS.VENTAS).doc(ventaId).update(ventaUpdates);

      // Actualizar cliente vinculado si existe
      if (venta.clienteId) {
        const clienteUpdates: Record<string, any> = {};
        if (ventaUpdates.nombreCliente) {
          clienteUpdates.nombre = ventaUpdates.nombreCliente;
          clienteUpdates.nombreLowercase = ventaUpdates.nombreCliente.toLowerCase().trim();
        }
        if (ventaUpdates.dniRuc) {
          clienteUpdates.dniRuc = ventaUpdates.dniRuc;
          if (data.buyerDocType) {
            clienteUpdates.tipoDocumento = data.buyerDocType;
          }
        }
        if (Object.keys(clienteUpdates).length > 0) {
          try {
            await db.collection(COLLECTIONS.CLIENTES).doc(venta.clienteId).update(clienteUpdates);
            changes.push("+ cliente actualizado");
          } catch {
            // Cliente puede no existir
          }
        }
      }

      // Actualizar mlOrderSync con nombre corregido
      if (ventaUpdates.nombreCliente && data.mlBuyerName) {
        await syncDoc.ref.update({ mlBuyerName: ventaUpdates.nombreCliente });
      }

      reparadas++;
      const numVenta = venta.numeroVenta || ventaId;
      detalles.push(`${numVenta}: ${changes.join(", ")}`);
      functions.logger.info(`ML Fix Nombres: ${numVenta} — ${changes.join(", ")}`);
    } catch (err: any) {
      errores++;
      functions.logger.error(`ML Fix Nombres: Error en orden ${data.mlOrderId}:`, err.message);
      detalles.push(`ERROR ML-${data.mlOrderId}: ${err.message}`);
    }
  }

  functions.logger.info(
    `ML Fix Nombres completado: ${reparadas} reparadas, ${omitidas} sin cambios, ${errores} errores (de ${total} total)`
  );

  return { reparadas, omitidas, errores, total, detalles };
}

// ============================================================
// SYNC BUY BOX STATUS (Competencia de catálogo)
// ============================================================

/**
 * Consulta el estado de competencia (Buy Box) para todas las
 * publicaciones de catálogo y actualiza mlProductMap en Firestore.
 */
export async function syncBuyBoxStatus(): Promise<{
  checked: number;
  winning: number;
  competing: number;
  sharing: number;
  listed: number;
  errors: number;
}> {
  const catalogQuery = await db
    .collection("mlProductMap")
    .where("mlListingType", "==", "catalogo")
    .get();

  let checked = 0;
  let winning = 0;
  let competing = 0;
  let sharing = 0;
  let listed = 0;
  let errors = 0;

  functions.logger.info(`ML BuyBox Sync: ${catalogQuery.size} publicaciones de catálogo encontradas`);

  for (const docSnap of catalogQuery.docs) {
    const data = docSnap.data() as MLProductMap;

    try {
      const result = await getItemPriceToWin(data.mlItemId);

      if (!result) {
        await docSnap.ref.update({
          buyBoxStatus: null,
          buyBoxPriceToWin: null,
          buyBoxWinnerPrice: null,
          buyBoxVisitShare: null,
          buyBoxBoosts: admin.firestore.FieldValue.delete(),
          buyBoxLastCheck: Timestamp.now(),
        });
        errors++;
        continue;
      }

      await docSnap.ref.update({
        buyBoxStatus: result.status,
        buyBoxPriceToWin: result.price_to_win ?? null,
        buyBoxWinnerPrice: result.winner?.price ?? null,
        buyBoxVisitShare: result.visit_share,
        buyBoxBoosts: result.boosts?.map((b) => ({ id: b.id, status: b.status })) || [],
        buyBoxLastCheck: Timestamp.now(),
      });

      checked++;
      switch (result.status) {
      case "winning":
        winning++;
        break;
      case "competing":
        competing++;
        break;
      case "sharing_first_place":
        sharing++;
        break;
      case "listed":
        listed++;
        break;
      }
    } catch (err: any) {
      errors++;
      functions.logger.error(`ML BuyBox Sync: Error para ${data.mlItemId}:`, err.message);
    }
  }

  functions.logger.info(
    `ML BuyBox Sync completado: ${checked} revisadas — ${winning} ganando, ${competing} perdiendo, ${sharing} compartiendo, ${listed} listadas, ${errors} errores`
  );

  return { checked, winning, competing, sharing, listed, errors };
}
