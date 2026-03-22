/**
 * Mercado Libre — Funciones de diagnóstico y reparación de datos
 *
 * Funciones:
 * - mlreenrichbuyers: Re-obtiene datos de buyers desde ML API
 * - mlrepararventasurbano: Repara ventas Urbano con costoEnvio inflado
 * - mlrepararnamesdni: Repara nombres y DNI en ventas ML
 * - mldiagshipping: Diagnóstico de datos crudos de envío
 * - mlpatchenvio: Parchea metodoEnvio y cargoEnvioML en órdenes
 * - mlfixventashistoricas: Corrige ventas históricas ML procesadas
 * - mlrepairgastosml: Repara gastos GV faltantes
 * - mlrepairmetodoenvio: Repara metodoEnvio faltante en ventas ML
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { resolverTCVenta } from "../tipoCambio.util";
import { requireAdminRole } from "./ml.auth";
import { COLLECTIONS } from "../collections";

const db = admin.firestore();

/** Helper: buscar cuenta MercadoPago */
async function buscarCuentaMercadoPago(firestoreDb: FirebaseFirestore.Firestore): Promise<string | null> {
  const defaultQuery = await firestoreDb.collection(COLLECTIONS.CUENTAS_CAJA)
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("esCuentaPorDefecto", "==", true)
    .where("activa", "==", true)
    .limit(1)
    .get();

  if (!defaultQuery.empty) return defaultQuery.docs[0].id;

  const mpQuery = await firestoreDb.collection(COLLECTIONS.CUENTAS_CAJA)
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("activa", "==", true)
    .limit(1)
    .get();

  return mpQuery.empty ? null : mpQuery.docs[0].id;
}

async function repairMetodoEnvioFromSync(
  ventaDoc: admin.firestore.QueryDocumentSnapshot,
  _venta: admin.firestore.DocumentData,
  syncDoc: admin.firestore.QueryDocumentSnapshot,
  syncData: admin.firestore.DocumentData
): Promise<string> {
  const trackingMethod = syncData.trackingMethod || null;
  if (!trackingMethod) return "sin_tracking";

  const methodStr = (trackingMethod as string).toLowerCase();
  let metodoEnvio: string | null = null;
  if (methodStr.includes("flex") || methodStr === "self_service") {
    metodoEnvio = "flex";
  } else if (methodStr.includes("urbano") || methodStr === "standard" || methodStr === "normal") {
    metodoEnvio = "urbano";
  }

  if (!metodoEnvio) return "no_match";

  // Actualizar venta y sync
  await ventaDoc.ref.update({ metodoEnvio });
  if (!syncData.metodoEnvio) {
    await syncDoc.ref.update({ metodoEnvio });
  }

  functions.logger.info(
    `ML Repair metodoEnvio: ${_venta.numeroVenta} → ${metodoEnvio} (trackingMethod: ${trackingMethod})`
  );
  return "reparada";
}

/**
 * Re-obtiene datos reales del buyer (nombre, DNI, teléfono, email) desde la API de ML
 * para todas las órdenes existentes en mlOrderSync.
 * También actualiza los clientes ERP ya creados.
 */
export const mlreenrichbuyers = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    try {
      const { reenrichBuyerData } = await import("./ml.sync");
      const result = await reenrichBuyerData();
      return result;
    } catch (err: any) {
      functions.logger.error("ML re-enrich buyers error:", err);
      throw new functions.https.HttpsError("internal", err.message);
    }
  });

/**
 * Repara ventas Urbano que se procesaron con costoEnvioCliente inflado.
 */
export const mlrepararventasurbano = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    try {
      const { repararVentasUrbano } = await import("./ml.sync");
      const result = await repararVentasUrbano();
      return result;
    } catch (err: any) {
      functions.logger.error("ML repair Urbano ventas error:", err);
      throw new functions.https.HttpsError("internal", err.message);
    }
  });

/**
 * Repara nombres (Title Case) y DNI faltante en ventas ML existentes.
 */
export const mlrepararnamesdni = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    try {
      const { repararNombresDniVentas } = await import("./ml.sync");
      const result = await repararNombresDniVentas();
      return result;
    } catch (err: any) {
      functions.logger.error("ML repair nombres/DNI error:", err);
      throw new functions.https.HttpsError("internal", err.message);
    }
  });

/**
 * Diagnóstico: inspecciona los datos crudos de envío de una orden ML
 */
export const mldiagshipping = functions.https.onCall(async (data, context) => {
  await requireAdminRole(context); // SEC-008

  const { orderId } = data;
  if (!orderId) {
    throw new functions.https.HttpsError("invalid-argument", "orderId requerido");
  }

  try {
    const { getOrder, getShipment } = await import("./ml.api");
    const order = await getOrder(orderId);

    const result: Record<string, any> = {
      orderId: order.id,
      total_amount: order.total_amount,
      currency: order.currency_id,
      payments: order.payments?.map((p: any) => ({
        id: p.id,
        transaction_amount: p.transaction_amount,
        shipping_cost: p.shipping_cost,
        total_paid_amount: p.total_paid_amount,
        status: p.status,
      })),
      shipping_id: order.shipping?.id,
      shipment: null as any,
    };

    if (order.shipping?.id) {
      try {
        const shipment = await getShipment(order.shipping.id);
        result.shipment = {
          id: shipment.id,
          status: shipment.status,
          shipping_mode: shipment.shipping_mode,
          lead_time: shipment.lead_time,
          shipping_option: (shipment as any).shipping_option || null,
          cost: (shipment as any).cost ?? null,
          base_cost: (shipment as any).base_cost ?? null,
        };
      } catch (err: any) {
        result.shipment_error = err.message;
      }
    }

    functions.logger.info(`ML Diag Shipping for order ${orderId}:`, JSON.stringify(result));
    return result;
  } catch (err: any) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});

/**
 * Migración: Parchea órdenes existentes con metodoEnvio y cargoEnvioML.
 */
export const mlpatchenvio = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    const { getShipment } = await import("./ml.api");
    const snapshot = await db.collection(COLLECTIONS.ML_ORDER_SYNC).get();

    let parchadas = 0;
    let sinCambio = 0;
    let sinMetodo = 0;
    let refetched = 0;
    const detalles: Array<{ orderId: number; metodo: string; rawMethod: string; costoEnvioCliente: number; cargoEnvioML: number }> = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      if (data.metodoEnvio) {
        sinCambio++;
        continue;
      }

      let rawMethod = (data.trackingMethod || "").toLowerCase();
      let metodoEnvio: "flex" | "urbano" | null = null;

      if (rawMethod) {
        if (rawMethod.includes("flex") || rawMethod === "self_service") {
          metodoEnvio = "flex";
        } else if (rawMethod.includes("urbano") || rawMethod === "standard" || rawMethod === "normal") {
          metodoEnvio = "urbano";
        }
      }

      if (!metodoEnvio && data.shipmentId) {
        try {
          const shipment = await getShipment(data.shipmentId);
          rawMethod = (shipment.tracking_method || "").toLowerCase();

          if (shipment.tracking_method) {
            await doc.ref.update({ trackingMethod: shipment.tracking_method });
          }

          if (rawMethod.includes("flex") || rawMethod === "self_service") {
            metodoEnvio = "flex";
          } else if (rawMethod.includes("urbano") || rawMethod === "standard" || rawMethod === "normal") {
            metodoEnvio = "urbano";
          }

          if (!metodoEnvio) {
            const logType = ((shipment as any).logistic_type || "").toLowerCase();
            const shippingMode = (shipment.shipping_mode || "").toLowerCase();
            if (logType === "self_service" || logType.includes("flex")) {
              metodoEnvio = "flex";
            } else if (logType === "xd_drop_off" || logType === "cross_docking" || logType === "drop_off" || logType === "fulfillment") {
              metodoEnvio = "urbano";
            } else if (shippingMode === "me1" || shippingMode === "me2") {
              metodoEnvio = shippingMode === "me1" ? "urbano" : "flex";
            }
            rawMethod = rawMethod || logType || shippingMode || "unknown";
          }

          refetched++;
          await new Promise((r) => setTimeout(r, 200));
        } catch (err: any) {
          functions.logger.warn(`Patch: no se pudo re-fetch shipment ${data.shipmentId}: ${err.message}`);
        }
      }

      if (!metodoEnvio) {
        sinMetodo++;
        functions.logger.info(`Patch skip: order ${data.mlOrderId}, trackingMethod="${data.trackingMethod}", shipmentId=${data.shipmentId || "null"}`);
        continue;
      }

      const update: Record<string, any> = { metodoEnvio };

      if (metodoEnvio === "urbano" && (data.costoEnvioCliente || 0) > 0) {
        update.cargoEnvioML = data.costoEnvioCliente;
        update.costoEnvioCliente = 0;
      } else {
        update.cargoEnvioML = 0;
      }

      await doc.ref.update(update);
      parchadas++;

      detalles.push({
        orderId: data.mlOrderId,
        metodo: metodoEnvio,
        rawMethod,
        costoEnvioCliente: update.costoEnvioCliente ?? data.costoEnvioCliente ?? 0,
        cargoEnvioML: update.cargoEnvioML ?? 0,
      });
    }

    functions.logger.info(
      `ML Patch Envío: ${parchadas} parchadas, ${sinCambio} ya tenían método, ${sinMetodo} sin método, ${refetched} re-fetched desde API`
    );

    return { parchadas, sinCambio, sinMetodo, refetched, total: snapshot.size, detalles };
  });

/**
 * Migración: Corrige ventas históricas ML ya procesadas.
 */
export const mlfixventashistoricas = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    const ventasSnap = await db.collection(COLLECTIONS.VENTAS)
      .where("creadoPor", "==", "ml-auto-processor")
      .get();

    if (ventasSnap.empty) {
      return { corregidas: 0, sinCambio: 0, gastosEliminados: 0, total: 0, detalles: [] };
    }

    const orderSyncSnap = await db.collection(COLLECTIONS.ML_ORDER_SYNC).get();
    const orderSyncByMLId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of orderSyncSnap.docs) {
      const data = doc.data();
      if (data.mlOrderId) {
        orderSyncByMLId.set(String(data.mlOrderId), doc);
      }
    }

    let corregidas = 0;
    let sinCambio = 0;
    let gastosEliminados = 0;
    const detalles: Array<{
      numeroVenta: string;
      mlOrderId: string;
      metodoEnvio: string | null;
      cargoEnvioML: number;
      gastosVentaPENAntes: number;
      gastosVentaPENDespues: number;
      utilidadNetaAntes: number;
      utilidadNetaDespues: number;
      gastoCargoEliminado: boolean;
      costoEnvioAjustado: boolean;
    }> = [];

    for (const ventaDoc of ventasSnap.docs) {
      const venta = ventaDoc.data();
      const mlOrderId = venta.mercadoLibreId;

      if (!mlOrderId) continue;

      const orderSyncDoc = orderSyncByMLId.get(mlOrderId);
      if (!orderSyncDoc) {
        functions.logger.warn(`Fix: Venta ${venta.numeroVenta} sin mlOrderSync para order ${mlOrderId}`);
        sinCambio++;
        continue;
      }

      const orderSync = orderSyncDoc.data();
      const metodoEnvio = orderSync.metodoEnvio || null;
      const cargoEnvioML = orderSync.cargoEnvioML || 0;
      const comisionML = venta.comisionML || orderSync.comisionML || 0;

      const gastosVentaPENAntes = venta.gastosVentaPEN || 0;
      const gastosVentaPENCorrect = comisionML;

      const costoEnvioAntes = venta.costoEnvio || 0;
      const costoEnvioCorrect = metodoEnvio === "urbano" ? 0 : costoEnvioAntes;
      const totalPENCorrect = (venta.subtotalPEN || 0) + costoEnvioCorrect;

      const costoTotalPEN = venta.costoTotalPEN || 0;
      const utilidadBrutaPEN = totalPENCorrect - costoTotalPEN;
      const utilidadNetaPEN = utilidadBrutaPEN - gastosVentaPENCorrect;
      const margenBruto = totalPENCorrect > 0 ? (utilidadBrutaPEN / totalPENCorrect) * 100 : 0;
      const margenNeto = totalPENCorrect > 0 ? (utilidadNetaPEN / totalPENCorrect) * 100 : 0;

      const cambios =
        venta.metodoEnvio !== metodoEnvio ||
        (venta.cargoEnvioML || 0) !== cargoEnvioML ||
        gastosVentaPENAntes !== gastosVentaPENCorrect ||
        costoEnvioAntes !== costoEnvioCorrect;

      if (!cambios) {
        sinCambio++;
        continue;
      }

      const ventaUpdate: Record<string, any> = {
        metodoEnvio,
        cargoEnvioML,
        costoEnvio: costoEnvioCorrect,
        totalPEN: totalPENCorrect,
        gastosVentaPEN: gastosVentaPENCorrect,
        comisionML,
        comisionMLPorcentaje: totalPENCorrect > 0 ? (comisionML / totalPENCorrect) * 100 : 0,
        utilidadBrutaPEN,
        utilidadNetaPEN,
        margenBruto,
        margenNeto,
        montoPagado: totalPENCorrect,
        montoPendiente: 0,
      };

      await ventaDoc.ref.update(ventaUpdate);

      let gastoCargoEliminado = false;
      const gastosCargoSnap = await db.collection(COLLECTIONS.GASTOS)
        .where("ventaId", "==", ventaDoc.id)
        .where("tipo", "==", "cargo_envio_ml")
        .get();

      for (const gastoDoc of gastosCargoSnap.docs) {
        const gasto = gastoDoc.data();

        const movSnap = await db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA)
          .where("gastoId", "==", gastoDoc.id)
          .get();

        for (const movDoc of movSnap.docs) {
          await movDoc.ref.delete();
        }

        if (gasto.pagos && gasto.pagos.length > 0) {
          const cuentaId = gasto.pagos[0].cuentaOrigenId;
          if (cuentaId) {
            await db.collection(COLLECTIONS.CUENTAS_CAJA).doc(cuentaId).update({
              saldoActual: admin.firestore.FieldValue.increment(gasto.montoPEN || 0),
            });
          }
        }

        await gastoDoc.ref.delete();
        gastosEliminados++;
        gastoCargoEliminado = true;
      }

      if (costoEnvioAntes !== costoEnvioCorrect) {
        const diferencia = costoEnvioAntes - costoEnvioCorrect;

        const ingresoSnap = await db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA)
          .where("ventaId", "==", ventaDoc.id)
          .where("tipo", "==", "ingreso_venta")
          .limit(1)
          .get();

        if (!ingresoSnap.empty) {
          await ingresoSnap.docs[0].ref.update({
            monto: totalPENCorrect,
            concepto: `Pago venta ${venta.numeroVenta} - ML #${mlOrderId} (corregido)`,
          });
        }

        if (diferencia > 0) {
          const cuentaMPId = await buscarCuentaMercadoPago(db);
          if (cuentaMPId) {
            await db.collection(COLLECTIONS.CUENTAS_CAJA).doc(cuentaMPId).update({
              saldoActual: admin.firestore.FieldValue.increment(-diferencia),
            });
          }
        }
      }

      corregidas++;
      detalles.push({
        numeroVenta: venta.numeroVenta,
        mlOrderId,
        metodoEnvio,
        cargoEnvioML,
        gastosVentaPENAntes,
        gastosVentaPENDespues: gastosVentaPENCorrect,
        utilidadNetaAntes: venta.utilidadNetaPEN || 0,
        utilidadNetaDespues: utilidadNetaPEN,
        gastoCargoEliminado,
        costoEnvioAjustado: costoEnvioAntes !== costoEnvioCorrect,
      });

      functions.logger.info(
        `Fix venta ${venta.numeroVenta}: método=${metodoEnvio}, ` +
        `gastosVenta ${gastosVentaPENAntes.toFixed(2)} → ${gastosVentaPENCorrect.toFixed(2)}, ` +
        `utilidadNeta ${(venta.utilidadNetaPEN || 0).toFixed(2)} → ${utilidadNetaPEN.toFixed(2)}`
      );
    }

    functions.logger.info(
      `ML Fix Ventas: ${corregidas} corregidas, ${sinCambio} sin cambio, ` +
      `${gastosEliminados} gastos cargo eliminados, total ${ventasSnap.size}`
    );

    return { corregidas, sinCambio, gastosEliminados, total: ventasSnap.size, detalles };
  });

/**
 * Busca ventas ML procesadas que tienen comisionML > 0 pero no tienen
 * un gasto GV tipo "comision_ml". Crea el gasto faltante para cada una.
 * Idempotente: verifica existencia antes de crear.
 */
export const mlrepairgastosml = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context); // SEC-008

    const Timestamp = admin.firestore.Timestamp;

    const ventasSnap = await db.collection(COLLECTIONS.VENTAS)
      .where("comisionML", ">", 0)
      .get();

    let reparadas = 0;
    let yaExistentes = 0;
    let sinComision = 0;
    let errores = 0;
    const detalles: Array<{ venta: string; comision: number; accion: string }> = [];

    let cuentaMPId: string | null = null;
    const mpQuery = await db.collection(COLLECTIONS.CUENTAS_CAJA)
      .where("metodoPagoAsociado", "==", "mercado_pago")
      .where("activa", "==", true)
      .limit(1)
      .get();
    if (!mpQuery.empty) {
      cuentaMPId = mpQuery.docs[0].id;
    } else {
      const anyQuery = await db.collection(COLLECTIONS.CUENTAS_CAJA)
        .where("activa", "==", true)
        .limit(1)
        .get();
      if (!anyQuery.empty) cuentaMPId = anyQuery.docs[0].id;
    }

    const tc = await resolverTCVenta();

    for (const ventaDoc of ventasSnap.docs) {
      const venta = ventaDoc.data();
      const comisionML = venta.comisionML || 0;
      const numeroVenta = venta.numeroVenta || ventaDoc.id;

      if (comisionML <= 0) {
        sinComision++;
        continue;
      }

      try {
        const existingGV = await db.collection(COLLECTIONS.GASTOS)
          .where("ventaId", "==", ventaDoc.id)
          .where("tipo", "==", "comision_ml")
          .limit(1)
          .get();

        if (!existingGV.empty) {
          yaExistentes++;
          continue;
        }

        const now = Timestamp.now();
        const fecha = venta.fechaCreacion || now;
        const fechaDate = fecha.toDate ? fecha.toDate() : new Date();
        const hasCuenta = !!cuentaMPId;

        const prefix = `GAS-${fechaDate.getFullYear()}-`;
        const lastGasto = await db.collection(COLLECTIONS.GASTOS)
          .where("numeroGasto", ">=", prefix)
          .where("numeroGasto", "<", prefix + "\uf8ff")
          .orderBy("numeroGasto", "desc")
          .limit(1)
          .get();
        let nextNum = 1;
        if (!lastGasto.empty) {
          const lastNumero = lastGasto.docs[0].data().numeroGasto as string;
          const numPart = parseInt(lastNumero.replace(prefix, ""), 10);
          if (!isNaN(numPart)) nextNum = numPart + 1;
        }
        const numeroGasto = `${prefix}${String(nextNum).padStart(4, "0")}`;

        const gastoData: Record<string, any> = {
          numeroGasto,
          tipo: "comision_ml",
          categoria: "GV",
          claseGasto: "GVD",
          descripcion: `Comisión ML - ${numeroVenta} (reparación)`,
          moneda: "PEN",
          montoOriginal: comisionML,
          montoPEN: comisionML,
          tipoCambio: tc,
          esProrrateable: false,
          ventaId: ventaDoc.id,
          ventaNumero: numeroVenta,
          mes: fechaDate.getMonth() + 1,
          anio: fechaDate.getFullYear(),
          fecha,
          esRecurrente: false,
          frecuencia: "unico",
          estado: hasCuenta ? "pagado" : "pendiente",
          impactaCTRU: false,
          ctruRecalculado: true,
          montoPagado: hasCuenta ? comisionML : 0,
          montoPendiente: hasCuenta ? 0 : comisionML,
          creadoPor: "ml-repair-gastos",
          fechaCreacion: now,
        };

        if (hasCuenta) {
          const pagoId = `PAG-GAS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          gastoData.pagos = [{
            id: pagoId,
            fecha: now,
            monedaPago: "PEN",
            montoOriginal: comisionML,
            montoPEN: comisionML,
            tipoCambio: tc,
            metodoPago: "mercado_pago",
            cuentaOrigenId: cuentaMPId,
            registradoPor: "ml-repair-gastos",
          }];
        }

        const gastoRef = await db.collection(COLLECTIONS.GASTOS).add(gastoData);

        if (hasCuenta) {
          await db.collection(COLLECTIONS.MOVIMIENTOS_TESORERIA).add({
            numeroMovimiento: `MOV-repair-${Date.now()}`,
            tipo: "gasto_operativo",
            estado: "ejecutado",
            moneda: "PEN",
            monto: comisionML,
            tipoCambio: tc,
            metodo: "mercado_pago",
            concepto: `Comisión ML - ${numeroVenta} (reparación GV faltante)`,
            gastoId: gastoRef.id,
            gastoNumero: numeroGasto,
            ventaId: ventaDoc.id,
            ventaNumero: numeroVenta,
            cuentaOrigen: cuentaMPId,
            fecha: now,
            creadoPor: "ml-repair-gastos",
            fechaCreacion: now,
          });

          await db.collection(COLLECTIONS.CUENTAS_CAJA).doc(cuentaMPId!).update({
            saldoActual: admin.firestore.FieldValue.increment(-comisionML),
          });
        }

        reparadas++;
        detalles.push({ venta: numeroVenta, comision: comisionML, accion: "gasto_creado" });
        functions.logger.info(`ML Repair: GV creado para ${numeroVenta} - S/${comisionML.toFixed(2)}`);
      } catch (err: any) {
        errores++;
        detalles.push({ venta: numeroVenta, comision: comisionML, accion: `error: ${err.message}` });
        functions.logger.error(`ML Repair: Error en ${numeroVenta}:`, err);
      }
    }

    return {
      success: true,
      totalVentasML: ventasSnap.size,
      sinComision,
      yaExistentes,
      reparadas,
      errores,
      cuentaMPId: cuentaMPId || "NO ENCONTRADA",
      detalles,
    };
  });

/**
 * Repara metodoEnvio faltante en ventas ML.
 */
export const mlrepairmetodoenvio = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .https.onCall(async (_data, context) => {
    await requireAdminRole(context);
    const ventasSnap = await db.collection(COLLECTIONS.VENTAS)
      .where("mercadoLibreId", "!=", null)
      .get();

    let sinMetodo = 0;
    let reparadas = 0;
    let noSync = 0;
    let sinTrackingMethod = 0;
    const detalles: any[] = [];

    for (const ventaDoc of ventasSnap.docs) {
      const venta = ventaDoc.data();
      if (venta.metodoEnvio) continue;
      sinMetodo++;

      const mlId = venta.mercadoLibreId;
      const syncQuery = await db.collection(COLLECTIONS.ML_ORDER_SYNC)
        .where("mercadoLibreId", "==", Number(mlId))
        .limit(1)
        .get();

      if (syncQuery.empty) {
        const syncQuery2 = await db.collection(COLLECTIONS.ML_ORDER_SYNC)
          .where("mercadoLibreId", "==", String(mlId))
          .limit(1)
          .get();

        if (syncQuery2.empty) {
          if (venta.packId) {
            const packSyncDoc = await db.collection(COLLECTIONS.ML_ORDER_SYNC).doc(`ml-pack-${venta.packId}`).get();
            if (packSyncDoc.exists) {
              const syncData = packSyncDoc.data()!;
              const result = await repairMetodoEnvioFromSync(
                ventaDoc, venta,
                packSyncDoc as unknown as admin.firestore.QueryDocumentSnapshot,
                syncData
              );
              if (result === "reparada") reparadas++;
              else if (result === "sin_tracking") sinTrackingMethod++;
              detalles.push({ venta: venta.numeroVenta, mlId, packId: venta.packId, trackingMethod: syncData.trackingMethod || null, accion: result });
              continue;
            }
          }
          noSync++;
          detalles.push({ venta: venta.numeroVenta, mlId, accion: "sin_sync" });
          continue;
        }

        const syncData = syncQuery2.docs[0].data();
        const result = await repairMetodoEnvioFromSync(ventaDoc, venta, syncQuery2.docs[0], syncData);
        if (result === "reparada") reparadas++;
        else if (result === "sin_tracking") sinTrackingMethod++;
        detalles.push({ venta: venta.numeroVenta, mlId, trackingMethod: syncData.trackingMethod || null, accion: result });
        continue;
      }

      const syncDoc = syncQuery.docs[0];
      const syncData = syncDoc.data();
      const result = await repairMetodoEnvioFromSync(ventaDoc, venta, syncDoc, syncData);
      if (result === "reparada") reparadas++;
      else if (result === "sin_tracking") sinTrackingMethod++;
      detalles.push({ venta: venta.numeroVenta, mlId, trackingMethod: syncData.trackingMethod || null, accion: result });
    }

    return {
      success: true,
      totalVentasML: ventasSnap.size,
      sinMetodo,
      reparadas,
      noSync,
      sinTrackingMethod,
      detalles,
    };
  });
