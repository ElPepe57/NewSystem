/**
 * Mercado Libre — Funciones de diagnóstico y reparación de datos
 *
 * Funciones:
 * - mlreenrichbuyers: Re-obtiene datos de buyers desde ML API
 * - mlrepararventasurbano: Repara ventas Urbano con costoEnvio inflado
 * - mlrepararnamesdni: Repara nombres y DNI en ventas ML
 * - mlpatchenvio: Parchea metodoEnvio y cargoEnvioML en órdenes
 * - mlfixventashistoricas: Corrige ventas históricas ML procesadas
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
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
