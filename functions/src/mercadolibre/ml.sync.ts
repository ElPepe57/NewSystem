/**
 * ML Sync Service - Traductor de datos ML → ERP
 *
 * Este módulo traduce la información de Mercado Libre
 * al formato que el sistema ERP (BusinessMN) ya espera.
 * El ERP es el sistema maestro — ML solo alimenta datos.
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
  getSellerItems,
  getItems,
  getUser,
  getShipment,
} from "./ml.api";
import {
  MLOrder,
  MLShipment,
  MLOrderSync,
  MLProductMap,
} from "./ml.types";
import { procesarOrdenCompleta } from "./ml.orderProcessor";

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
        .collection("mlProductMap")
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
            .collection("productos")
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

        await db.collection("mlProductMap").add({
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
              .collection("mlProductMap")
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
  await db.collection("mlConfig").doc("settings").update({
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
 * Procesa una notificación de orden de ML.
 * Traduce la orden al formato de tu ERP y la guarda como registro
 * en mlOrderSync. Opcionalmente crea la Venta automáticamente.
 */
export async function processOrderNotification(order: MLOrder): Promise<void> {
  const orderId = order.id;

  // Verificar si ya procesamos esta orden
  const existingQuery = await db
    .collection("mlOrderSync")
    .where("mlOrderId", "==", orderId)
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    const existing = existingQuery.docs[0].data() as MLOrderSync;
    // Si ya fue procesada exitosamente, solo actualizar estado ML
    if (existing.estado === "procesada") {
      await existingQuery.docs[0].ref.update({
        mlStatus: order.status,
        fechaSync: admin.firestore.Timestamp.now(),
      });
      return;
    }
  }

  // Solo procesar órdenes pagadas
  if (order.status !== "paid") {
    functions.logger.info(`ML Order ${orderId}: estado ${order.status}, esperando pago...`);

    if (existingQuery.empty) {
      await db.collection("mlOrderSync").add({
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
        fechaOrdenML: admin.firestore.Timestamp.fromDate(new Date(order.date_created)),
        fechaProcesada: null,
        fechaSync: admin.firestore.Timestamp.now(),
      } as MLOrderSync);
    }
    return;
  }

  functions.logger.info(`ML Order ${orderId}: PAGADA, procesando...`);

  try {
    // 1. Obtener info completa del buyer
    let buyerName = "Cliente ML";
    let buyerEmail: string | null = null;
    let buyerPhone: string | null = null;
    let buyerDni: string | null = null;

    try {
      const buyer = await getUser(order.buyer.id);
      buyerName = `${buyer.first_name || ""} ${buyer.last_name || ""}`.trim() || buyer.nickname;
      buyerEmail = buyer.email || null;
      buyerPhone = buyer.phone
        ? `${buyer.phone.area_code || ""}${buyer.phone.number}`.trim()
        : null;
      buyerDni = buyer.identification?.number || null;
    } catch {
      functions.logger.warn(`No se pudo obtener info del buyer ${order.buyer.id}`);
      // Usar lo que tengamos del objeto order
      if (order.buyer.first_name) {
        buyerName = `${order.buyer.first_name} ${order.buyer.last_name || ""}`.trim();
      }
    }

    // 2. Obtener info de envío
    let direccionEntrega = "";
    let distrito = "";
    let provincia = "";
    let costoEnvioML = 0;
    let costoEnvioCliente = 0;
    let trackingNumber: string | null = null;
    let trackingMethod: string | null = null;
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
        costoEnvioML = shipment.lead_time?.cost || 0;
        trackingNumber = shipment.tracking_number;
        trackingMethod = shipment.tracking_method;

        // Extraer coordenadas geo de ML para integración con Google Maps
        if (addr.latitude && addr.longitude) {
          coordenadas = { lat: addr.latitude, lng: addr.longitude };
        }
      } catch {
        functions.logger.warn(`No se pudo obtener shipment ${order.shipping.id}`);
      }
    }

    // Obtener costo de envío que pagó el cliente (del payment)
    if (order.payments?.length > 0) {
      costoEnvioCliente = order.payments[0].shipping_cost || 0;
    }
    // Fallback: si no hay shipping_cost en payment, usar el del shipment
    if (costoEnvioCliente === 0 && costoEnvioML > 0) {
      costoEnvioCliente = costoEnvioML;
    }

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
      direccionEntrega,
      distrito,
      provincia,
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

    if (existingQuery.empty) {
      await db.collection("mlOrderSync").add(orderDetailData);
    } else {
      await existingQuery.docs[0].ref.update(orderDetailData);
    }

    // 6. Si auto-crear ventas está activo Y todos los productos están vinculados
    const settingsDoc = await db.collection("mlConfig").doc("settings").get();
    const settings = settingsDoc.data();

    if (settings?.autoCreateVentas && todosVinculados) {
      functions.logger.info(`ML Order ${orderId}: auto-creando venta en ERP...`);

      // Obtener referencia del doc de mlOrderSync para pasarla al procesador
      const orderSyncDocRef = existingQuery.empty
        ? (await db.collection("mlOrderSync").where("mlOrderId", "==", orderId).limit(1).get()).docs[0]?.ref
        : existingQuery.docs[0].ref;

      if (orderSyncDocRef) {
        try {
          await procesarOrdenCompleta(orderDetailData as any, orderSyncDocRef);
        } catch (err: any) {
          // Error ya logueado y mlOrderSync marcado como 'error' internamente
          functions.logger.error(`ML Order ${orderId}: error en auto-procesamiento`, err);
        }
      }
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

    if (existingQuery.empty) {
      await db.collection("mlOrderSync").add({
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
        fechaOrdenML: admin.firestore.Timestamp.fromDate(new Date(order.date_created)),
        fechaProcesada: null,
        ...errorData,
      } as MLOrderSync);
    } else {
      await existingQuery.docs[0].ref.update(errorData);
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
    .collection("mlOrderSync")
    .where("shipmentId", "==", shipment.id)
    .limit(1)
    .get();

  if (orderSyncQuery.empty) {
    // Guardar info del shipment para vincular después
    await db.collection("mlShipmentLog").doc(String(shipment.id)).set({
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
  await orderSyncDoc.ref.update({
    shipmentStatus: shipment.status,
    trackingNumber: shipment.tracking_number,
    trackingMethod: shipment.tracking_method || null,
    fechaSync: admin.firestore.Timestamp.now(),
  });

  // Si hay una venta vinculada en el ERP y el envío fue entregado
  const orderSync = orderSyncDoc.data() as MLOrderSync;
  if (orderSync.ventaId && shipment.status === "delivered") {
    functions.logger.info(
      `ML Shipment ${shipment.id}: ENTREGADO, marcando venta ${orderSync.ventaId} como entregada`
    );

    try {
      // Obtener la venta
      const ventaDoc = await db.collection("ventas").doc(orderSync.ventaId).get();
      if (ventaDoc.exists) {
        const ventaData = ventaDoc.data()!;

        // Solo procesar si está en estado despachada o asignada
        if (["despachada", "asignada"].includes(ventaData.estado)) {
          const batch = db.batch();

          // Marcar todas las unidades asignadas como 'vendida'
          for (const prod of (ventaData.productos || [])) {
            for (const unidadId of (prod.unidadesAsignadas || [])) {
              const unidadRef = db.collection("unidades").doc(unidadId);
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
              const disponiblesQuery = await db.collection("unidades")
                .where("productoId", "==", prodId)
                .where("estado", "==", "disponible_peru")
                .get();

              await db.collection("productos").doc(prodId as string).update({
                stockDisponible: disponiblesQuery.size,
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
  const snap = await db.collection("transportistas").get();

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
  const existingGD = await db.collection("gastos")
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
  const lastGasto = await db.collection("gastos")
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
  const mpQuery = await db.collection("cuentasCaja")
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("activa", "==", true)
    .limit(1)
    .get();
  if (!mpQuery.empty) cuentaMPId = mpQuery.docs[0].id;

  // Obtener tipo de cambio
  let tc = 3.70;
  try {
    const today = fecha.toISOString().split("T")[0];
    const tcQuery = await db.collection("tiposCambio")
      .where("fecha", "==", today)
      .limit(1)
      .get();
    if (!tcQuery.empty) tc = tcQuery.docs[0].data().venta || 3.70;
  } catch {
    // fallback
  }

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

  const gastoRef = await db.collection("gastos").add(gastoData);

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
    await db.collection("movimientosTesoreria").add(movimientoEgreso);

    // Actualizar saldo cuenta MP
    await db.collection("cuentasCaja").doc(cuentaMPId).update({
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

  await db.collection("ventas").doc(ventaId).update(ventaUpdate);

  functions.logger.info(
    `ML GD Auto: ${numeroGasto} | ${metodoLabel} S/ ${costoDistribucion.toFixed(2)} → ` +
    `Venta ${numeroVenta} | gastosVentaPEN: S/ ${gastosVentaPEN.toFixed(2)} | ` +
    `margenNeto: ${ventaUpdate.margenNeto.toFixed(1)}%`
  );
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Calcula la comisión total de ML para una orden
 */
function calcularComisionTotal(order: MLOrder): number {
  return order.order_items.reduce((total, item) => {
    return total + (item.sale_fee || 0);
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
