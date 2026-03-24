/**
 * Mercado Libre — Gestión de stock, precios y catálogo
 *
 * Funciones:
 * - mlsyncitems: Sincroniza items de ML con mapeo local
 * - mlvinculateproduct: Vincula producto ERP con publicación ML
 * - mldesvincularproduct: Desvincula producto ERP de publicación ML
 * - mlsyncstock: Sincroniza stock ERP → ML
 * - mlupdateprice: Actualiza precio de una publicación ML
 * - mlsyncbuybox: Sincroniza estado de competencia (Buy Box)
 * - mlmigratestockpendiente: Recalcula stockPendienteML desde cero
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { requireAdminRole } from "./ml.auth";
import { COLLECTIONS } from "../collections";

const db = admin.firestore();

/**
 * Sincroniza items de ML con el mapeo local
 */
export const mlsyncitems = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }
  await requireAdminRole(context);

  const settingsDoc = await db.collection(COLLECTIONS.ML_CONFIG).doc("settings").get();
  if (!settingsDoc.exists || !settingsDoc.data()?.connected) {
    throw new functions.https.HttpsError("failed-precondition", "ML no está conectado");
  }

  const { userId } = settingsDoc.data()!;

  try {
    // Importar dinámicamente para evitar dependencia circular
    const { syncAllItems } = await import("./ml.sync");
    const result = await syncAllItems(userId);
    return result;
  } catch (err: any) {
    functions.logger.error("ML sync items error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

/**
 * Vincula un producto de ML con un producto del ERP.
 * Cascade: si el item tiene SKU, vincula automaticamente todas las
 * publicaciones hermanas (clasica/catalogo) con el mismo productoId.
 */
export const mlvinculateproduct = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }
  await requireAdminRole(context);

  const { mlProductMapId, productoId, productoSku, productoNombre } = data;
  if (!mlProductMapId || !productoId) {
    throw new functions.https.HttpsError("invalid-argument", "mlProductMapId y productoId son requeridos");
  }

  const now = admin.firestore.Timestamp.now();
  const updatePayload = {
    productoId,
    productoSku: productoSku || null,
    productoNombre: productoNombre || null,
    vinculado: true,
    fechaVinculacion: now,
  };

  // Actualizar el doc target
  const targetRef = db.collection(COLLECTIONS.ML_PRODUCT_MAP).doc(mlProductMapId);
  await targetRef.update(updatePayload);

  // Cascade: vincular hermanos con mismo skuGroupKey (SKU o catalog_product_id)
  let cascadeCount = 0;
  const targetDoc = await targetRef.get();
  const targetData = targetDoc.data();
  const groupKey = targetData?.skuGroupKey || targetData?.mlSku || targetData?.mlCatalogProductId;

  if (groupKey) {
    const siblingsQuery = await db
      .collection(COLLECTIONS.ML_PRODUCT_MAP)
      .where("skuGroupKey", "==", groupKey)
      .get();

    for (const sibDoc of siblingsQuery.docs) {
      if (sibDoc.id === mlProductMapId) continue;
      await sibDoc.ref.update(updatePayload);
      cascadeCount++;
    }

    // Fallback: si skuGroupKey no matchea, buscar por mlSku o mlCatalogProductId
    if (cascadeCount === 0) {
      const fallbackField = targetData?.mlSku ? "mlSku" : "mlCatalogProductId";
      const fallbackValue = targetData?.mlSku || targetData?.mlCatalogProductId;
      if (fallbackValue) {
        const fallbackQuery = await db
          .collection(COLLECTIONS.ML_PRODUCT_MAP)
          .where(fallbackField, "==", fallbackValue)
          .get();

        for (const sibDoc of fallbackQuery.docs) {
          if (sibDoc.id === mlProductMapId) continue;
          await sibDoc.ref.update(updatePayload);
          cascadeCount++;
        }
      }
    }

    if (cascadeCount > 0) {
      functions.logger.info(
        `ML Vincular: Cascade ${cascadeCount} publicaciones con groupKey ${groupKey} → ${productoSku}`
      );
    }
  }

  return { success: true, cascadeCount };
});

/**
 * Desvincula un producto ML del ERP.
 * Cascade: desvincula todas las publicaciones hermanas con el mismo SKU.
 */
export const mldesvincularproduct = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }
  await requireAdminRole(context);

  const { mlProductMapId } = data;
  if (!mlProductMapId) {
    throw new functions.https.HttpsError("invalid-argument", "mlProductMapId es requerido");
  }

  const unlinkPayload = {
    productoId: null,
    productoSku: null,
    productoNombre: null,
    vinculado: false,
    fechaVinculacion: null,
  };

  const targetRef = db.collection(COLLECTIONS.ML_PRODUCT_MAP).doc(mlProductMapId);
  const targetDoc = await targetRef.get();

  if (!targetDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Producto ML no encontrado");
  }

  await targetRef.update(unlinkPayload);

  // Cascade: desvincular hermanos con mismo skuGroupKey (SKU o catalog_product_id)
  let cascadeCount = 0;
  const targetData = targetDoc.data();
  const groupKey = targetData?.skuGroupKey || targetData?.mlSku || targetData?.mlCatalogProductId;

  if (groupKey) {
    const siblingsQuery = await db
      .collection(COLLECTIONS.ML_PRODUCT_MAP)
      .where("skuGroupKey", "==", groupKey)
      .get();

    for (const sibDoc of siblingsQuery.docs) {
      if (sibDoc.id === mlProductMapId) continue;
      if (sibDoc.data().vinculado) {
        await sibDoc.ref.update(unlinkPayload);
        cascadeCount++;
      }
    }

    // Fallback para docs pre-backfill
    if (cascadeCount === 0) {
      const fallbackField = targetData?.mlSku ? "mlSku" : "mlCatalogProductId";
      const fallbackValue = targetData?.mlSku || targetData?.mlCatalogProductId;
      if (fallbackValue) {
        const fallbackQuery = await db
          .collection(COLLECTIONS.ML_PRODUCT_MAP)
          .where(fallbackField, "==", fallbackValue)
          .get();

        for (const sibDoc of fallbackQuery.docs) {
          if (sibDoc.id === mlProductMapId) continue;
          if (sibDoc.data().vinculado) {
            await sibDoc.ref.update(unlinkPayload);
            cascadeCount++;
          }
        }
      }
    }
  }

  return { success: true, cascadeCount };
});

/**
 * Sincroniza stock del ERP hacia ML.
 * Para cada producto vinculado, pushea stockDisponible a todas sus publicaciones ML.
 */
export const mlsyncstock = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }
  await requireAdminRole(context);

  const { productoId } = data || {};

  // Obtener mlProductMap docs vinculados
  let mapQuery;
  if (productoId) {
    mapQuery = await db
      .collection(COLLECTIONS.ML_PRODUCT_MAP)
      .where("productoId", "==", productoId)
      .where("vinculado", "==", true)
      .get();
  } else {
    mapQuery = await db
      .collection(COLLECTIONS.ML_PRODUCT_MAP)
      .where("vinculado", "==", true)
      .get();
  }

  if (mapQuery.empty) {
    return { synced: 0, errors: 0, details: [] };
  }

  // Calcular stock real para cada productoId (solo disponible_peru — ML vende desde Perú)
  const productoIds = [...new Set(mapQuery.docs.map((d) => d.data().productoId as string))];
  const stockMap = new Map<string, number>();

  for (const pid of productoIds) {
    const disponiblesSnap = await db.collection(COLLECTIONS.UNIDADES)
      .where("productoId", "==", pid)
      .where("estado", "==", "disponible_peru")
      .get();
    const stockDisponiblePeru = disponiblesSnap.size;

    // Leer stockPendienteML para calcular stockEfectivoML
    const productoDoc = await db.collection(COLLECTIONS.PRODUCTOS).doc(pid).get();
    const stockPendienteML = productoDoc.data()?.stockPendienteML || 0;
    const stockEfectivoML = Math.max(0, stockDisponiblePeru - stockPendienteML);

    // Usar stockEfectivoML para el push a ML (evita overselling)
    stockMap.set(pid, stockEfectivoML);

    // Actualizar producto con stockDisponiblePeru y stockEfectivoML
    await db.collection(COLLECTIONS.PRODUCTOS).doc(pid).update({
      stockDisponiblePeru,
      stockEfectivoML,
      ultimaActualizacionStock: admin.firestore.Timestamp.now(),
    });
  }

  const { updateItemStock } = await import("./ml.api");
  let synced = 0;
  let errors = 0;
  const details: Array<{ mlItemId: string; stock: number; success: boolean; error?: string }> = [];

  for (const mapDoc of mapQuery.docs) {
    const map = mapDoc.data();
    const erpStock = stockMap.get(map.productoId) ?? 0;

    try {
      await updateItemStock(map.mlItemId, erpStock);
      await mapDoc.ref.update({
        mlAvailableQuantity: erpStock,
        fechaSync: admin.firestore.Timestamp.now(),
      });
      synced++;
      details.push({ mlItemId: map.mlItemId, stock: erpStock, success: true });
    } catch (err: any) {
      errors++;
      details.push({ mlItemId: map.mlItemId, stock: erpStock, success: false, error: err.message });
      functions.logger.error(`Stock sync failed for ${map.mlItemId}:`, err.message);
    }

    // Rate limit: 200ms entre llamadas
    await new Promise((r) => setTimeout(r, 200));
  }

  return { synced, errors, details };
});

/**
 * Actualiza el precio de una publicacion ML individual.
 * El precio es por publicacion (clasica y catalogo pueden tener precios distintos).
 */
export const mlupdateprice = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }
  await requireAdminRole(context);

  const { mlProductMapId, newPrice } = data;
  if (!mlProductMapId || !newPrice || newPrice <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "mlProductMapId y newPrice (>0) son requeridos");
  }

  const mapDoc = await db.collection(COLLECTIONS.ML_PRODUCT_MAP).doc(mlProductMapId).get();
  if (!mapDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Producto ML no encontrado");
  }

  const map = mapDoc.data()!;
  const { updateItemPrice } = await import("./ml.api");

  try {
    await updateItemPrice(map.mlItemId, newPrice);
    await mapDoc.ref.update({
      mlPrice: newPrice,
      fechaSync: admin.firestore.Timestamp.now(),
    });
    return { success: true, mlItemId: map.mlItemId, oldPrice: map.mlPrice, newPrice };
  } catch (err: any) {
    functions.logger.error(`Price update failed for ${map.mlItemId}:`, err.message);
    throw new functions.https.HttpsError("internal", `Error actualizando precio en ML: ${err.message}`);
  }
});

/**
 * Consulta el estado de competencia (GANANDO/PERDIENDO) para
 * todas las publicaciones de catálogo en ML.
 */
export const mlsyncbuybox = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }
  await requireAdminRole(context);

  try {
    const { syncBuyBoxStatus } = await import("./ml.sync");
    const result = await syncBuyBoxStatus();
    return result;
  } catch (error: any) {
    functions.logger.error("Error syncing buy box status:", error);
    throw new functions.https.HttpsError("internal", error.message || "Error al sincronizar competencia");
  }
});

/**
 * Recalcula stockPendienteML desde cero para todos los productos,
 * contando las órdenes mlOrderSync en estado "pendiente".
 * También recalcula stockEfectivoML.
 * Sirve como migración inicial y como herramienta de reconciliación.
 */
export const mlmigratestockpendiente = functions.https.onCall(async (_data, context) => {
  await requireAdminRole(context); // SEC-008

  // 1. Leer todas las órdenes pendientes
  const pendientesSnap = await db.collection(COLLECTIONS.ML_ORDER_SYNC)
    .where("estado", "==", "pendiente")
    .get();

  // 2. Acumular cantidades por productoId
  const pendienteMap = new Map<string, number>();
  let ordenesMigradas = 0;

  for (const doc of pendientesSnap.docs) {
    const order = doc.data();

    // Excluir importaciones históricas sin venta vinculada:
    // ya fueron despachadas físicamente, no deben reservar stock
    if (order.origen === "importacion_historica" && !order.ventaId) {
      continue;
    }

    const productos = order.productos || [];
    let tieneProductosVinculados = false;

    for (const prod of productos) {
      if (prod.productoId && prod.cantidad > 0) {
        const current = pendienteMap.get(prod.productoId) || 0;
        pendienteMap.set(prod.productoId, current + prod.cantidad);
        tieneProductosVinculados = true;
      }
    }

    // Marcar como contabilizado si tiene productos vinculados
    if (tieneProductosVinculados && order.stockPendienteContabilizado !== true) {
      await doc.ref.update({ stockPendienteContabilizado: true });
      ordenesMigradas++;
    }
  }

  // 3. Recalcular stockPendienteML y stockEfectivoML para TODOS los productos vinculados a ML
  // Esto cubre tanto productos con stockPendienteML > 0 como aquellos con stockEfectivoML desactualizado
  const allVinculados = await db.collection(COLLECTIONS.ML_PRODUCT_MAP)
    .where("vinculado", "==", true)
    .get();
  const allProductoIds = [...new Set(allVinculados.docs.map((d) => d.data().productoId as string))];

  let productosActualizados = 0;
  let productosReseteados = 0;

  for (const productoId of allProductoIds) {
    try {
      const prodDoc = await db.collection(COLLECTIONS.PRODUCTOS).doc(productoId).get();
      if (!prodDoc.exists) continue;

      const pData = prodDoc.data()!;
      const pendienteCorrecto = pendienteMap.get(productoId) || 0;
      const currentPendiente = pData.stockPendienteML || 0;

      // Contar unidades disponible_peru reales (fuente de verdad)
      const unidadesSnap = await db.collection(COLLECTIONS.UNIDADES)
        .where("productoId", "==", productoId)
        .where("estado", "==", "disponible_peru")
        .get();
      const disponiblePeru = unidadesSnap.size;
      const stockEfectivoML = Math.max(0, disponiblePeru - pendienteCorrecto);

      // Solo actualizar si algo cambió
      if (currentPendiente !== pendienteCorrecto || pData.stockEfectivoML !== stockEfectivoML || pData.stockDisponiblePeru !== disponiblePeru) {
        await prodDoc.ref.update({
          stockPendienteML: pendienteCorrecto,
          stockDisponiblePeru: disponiblePeru,
          stockEfectivoML,
        });

        if (pendienteCorrecto > 0) {
          productosActualizados++;
        } else {
          productosReseteados++;
        }

        functions.logger.info(
          `Migration: ${productoId} → pendiente=${pendienteCorrecto}, disponiblePeru=${disponiblePeru}, efectivo=${stockEfectivoML}`
        );
      }
    } catch (err: any) {
      functions.logger.warn(`Migration error for ${productoId}: ${err.message}`);
    }
  }

  functions.logger.info(
    `Migration complete: ${ordenesMigradas} órdenes migradas, ${productosActualizados} productos actualizados, ${productosReseteados} reseteados`
  );

  return {
    ordenesPendientes: pendientesSnap.size,
    ordenesMigradas,
    productosActualizados,
    productosReseteados,
  };
});
