/**
 * Mercado Libre — Procesamiento de órdenes y ventas
 *
 * Funciones:
 * - mlimporthistoricalorders: Importa historial de órdenes desde ML API
 * - mlprocesarorden: Procesa una orden individual → venta ERP
 * - mlprocesarpendientes: Procesa todas las órdenes pendientes vinculadas
 * - mlautocreateventas: Scheduled — auto-crea ventas cuando datos completos
 * - mlconsolidatepackorders: Consolida pack orders duplicados
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { requireAdminRole } from "./ml.auth";
import { procesarOrdenCompleta } from "./ml.orderProcessor";
import { MLOrderSync } from "./ml.types";

const db = admin.firestore();

// ============================================================
// FUNCIÓN: Importar historial de órdenes ML
// ============================================================

/**
 * Importa órdenes históricas desde ML al sistema.
 * Busca las últimas N órdenes del seller en la API de ML y crea
 * registros en mlOrderSync para cada una (omitiendo las que ya existen).
 *
 * NO auto-procesa ventas — el usuario revisa y decide manualmente.
 * Las órdenes importadas se marcan con origen: "importacion_historica"
 * para distinguirlas de las que llegan por webhook en tiempo real.
 */
export const mlimporthistoricalorders = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (data, context) => {
    await requireAdminRole(context); // SEC-008

    const settingsDoc = await db.collection("mlConfig").doc("settings").get();
    if (!settingsDoc.exists || !settingsDoc.data()?.connected) {
      throw new functions.https.HttpsError("failed-precondition", "ML no está conectado");
    }

    const { userId } = settingsDoc.data()!;
    const maxOrders = Math.min(data?.maxOrders || 100, 200); // Límite máximo: 200

    try {
      const { importHistoricalOrders } = await import("./ml.sync");
      const result = await importHistoricalOrders(userId, maxOrders);
      return result;
    } catch (err: any) {
      functions.logger.error("ML import historical orders error:", err);
      throw new functions.https.HttpsError("internal", err.message);
    }
  });

// ============================================================
// FUNCIONES: Procesamiento de órdenes ML → Ventas ERP
// ============================================================

/**
 * Procesa una orden ML individual → crea venta, pago, inventario, gastos
 * Usado para retry manual desde la UI
 */
export const mlprocesarorden = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const { orderSyncId } = data;
  if (!orderSyncId) {
    throw new functions.https.HttpsError("invalid-argument", "orderSyncId es requerido");
  }

  const orderSyncRef = db.collection("mlOrderSync").doc(orderSyncId);

  // Claim transaccional: solo procesar si estado es "pendiente" o "error"
  // Esto previene race conditions si un webhook está procesando simultáneamente
  const claimResult = await db.runTransaction(async (tx) => {
    const doc = await tx.get(orderSyncRef);
    if (!doc.exists) {
      return { success: false as const, reason: "not_found" as const };
    }
    const data = doc.data()!;
    if (data.estado === "procesada") {
      return { success: false as const, reason: "already_done" as const, ventaId: data.ventaId, numeroVenta: data.numeroVenta };
    }
    if (data.estado === "procesando") {
      return { success: false as const, reason: "in_progress" as const };
    }
    // Claim: marcar como "procesando" atómicamente
    tx.update(orderSyncRef, { estado: "procesando" });
    return { success: true as const, orderSync: { id: doc.id, ...data } };
  });

  if (!claimResult.success) {
    if (claimResult.reason === "not_found") {
      throw new functions.https.HttpsError("not-found", "Orden ML no encontrada");
    }
    if (claimResult.reason === "already_done") {
      return { already: true, ventaId: (claimResult as any).ventaId, numeroVenta: (claimResult as any).numeroVenta };
    }
    if (claimResult.reason === "in_progress") {
      throw new functions.https.HttpsError("already-exists", "Esta orden ya está siendo procesada por otro proceso. Espera unos segundos e intenta de nuevo.");
    }
  }

  try {
    const result = await procesarOrdenCompleta(
      (claimResult as any).orderSync as any,
      orderSyncRef
    );
    return result;
  } catch (err: any) {
    // Si falla, revertir a "error" para permitir retry
    await orderSyncRef.update({ estado: "error", errorDetalle: err.message });
    throw new functions.https.HttpsError("internal", `Error procesando orden: ${err.message}`);
  }
});

/**
 * Procesa todas las órdenes pendientes que tienen todos los productos vinculados
 */
export const mlprocesarpendientes = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Debe iniciar sesión");
  }

  const pendientesQuery = await db.collection("mlOrderSync")
    .where("estado", "in", ["pendiente", "error"])
    .where("todosVinculados", "==", true)
    .get();

  if (pendientesQuery.empty) {
    return { procesadas: 0, errores: 0, detalles: [] };
  }

  let procesadas = 0;
  let errores = 0;
  const detalles: Array<{ mlOrderId: number; resultado: string; ventaId?: string; error?: string }> = [];

  for (const docSnap of pendientesQuery.docs) {
    const orderSync = docSnap.data() as MLOrderSync & Record<string, any>;

    // Claim transaccional antes de procesar
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(docSnap.ref);
      if (!fresh.exists) return false;
      const estado = fresh.data()!.estado;
      if (estado !== "pendiente" && estado !== "error") return false;
      tx.update(docSnap.ref, { estado: "procesando" });
      return true;
    });

    if (!claimed) {
      detalles.push({
        mlOrderId: orderSync.mlOrderId,
        resultado: "skipped",
        error: "Ya siendo procesada o estado cambió",
      });
      continue;
    }

    try {
      const result = await procesarOrdenCompleta(
        { id: docSnap.id, ...orderSync } as any,
        docSnap.ref
      );
      procesadas++;
      detalles.push({
        mlOrderId: orderSync.mlOrderId,
        resultado: "procesada",
        ventaId: result.ventaId,
      });
    } catch (err: any) {
      errores++;
      await docSnap.ref.update({ estado: "error", errorDetalle: err.message });
      detalles.push({
        mlOrderId: orderSync.mlOrderId,
        resultado: "error",
        error: err.message,
      });
    }
  }

  functions.logger.info(
    `ML Batch: ${procesadas} procesadas, ${errores} errores de ${pendientesQuery.size} pendientes`
  );

  return { procesadas, errores, detalles };
});

// ============================================================
// FUNCIÓN: Auto-crear ventas ML cuando datos están completos (scheduled cada 2 min)
// ============================================================

const ML_AUTOCREATE_MIN_DELAY_MS = 3 * 60 * 1000; // 3 min mínimo para dar tiempo a webhooks
const ML_AUTOCREATE_MAX_WAIT_MS = 30 * 60 * 1000;  // 30 min máximo — después crear con re-fetch

/**
 * Procesa órdenes ML que tienen datos completos (comisión + método de envío).
 * Requiere:
 *  1. Timer mínimo expirado (3 min desde webhook)
 *  2. comisionML > 0 Y metodoEnvio definido (datos completos)
 *  OR timeout máximo de 30 min (safety net — crea con re-fetch de ML API)
 */
export const mlautocreateventas = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .pubsub.schedule("every 2 minutes")
  .onRun(async () => {
    const ahora = admin.firestore.Timestamp.now();
    const ahoraMs = ahora.toMillis();

    // Query por estado solamente — filtrar en memoria
    const queryPendientes = await db.collection("mlOrderSync")
      .where("estado", "==", "pendiente")
      .get();

    const queryError = await db.collection("mlOrderSync")
      .where("estado", "==", "error")
      .get();

    // Filtrar en memoria: timer expirado + productos vinculados + datos completos (o timeout)
    const allDocs = [...queryPendientes.docs, ...queryError.docs]
      .filter(doc => {
        const data = doc.data();
        if (data.todosVinculados !== true) return false;
        if (!data.crearVentaDespuesDe) return false;

        // Delay mínimo de 3 min siempre debe cumplirse
        const delayExpirado = data.crearVentaDespuesDe.toMillis() <= ahoraMs;
        if (!delayExpirado) return false;

        const datosCompletos = (data.comisionML || 0) > 0 && !!data.metodoEnvio;

        // Si datos completos → listo para procesar
        if (datosCompletos) return true;

        // Si datos incompletos pero timeout máximo alcanzado → procesar con re-fetch
        const tiempoEspera = ahoraMs - data.crearVentaDespuesDe.toMillis() + ML_AUTOCREATE_MIN_DELAY_MS;
        if (tiempoEspera >= ML_AUTOCREATE_MAX_WAIT_MS) {
          functions.logger.warn(
            `ML AutoCreate: orden ${data.mlOrderId} esperó ${Math.round(tiempoEspera / 60000)}min sin datos completos ` +
            `(comision=${data.comisionML || 0}, metodo=${data.metodoEnvio || "null"}). Procesando con re-fetch.`
          );
          return true;
        }

        return false;
      });

    if (allDocs.length === 0) return null;

    functions.logger.info(
      `ML AutoCreate: ${allDocs.length} órdenes listas para crear venta`
    );

    let procesadas = 0;
    let errores = 0;

    for (const docSnap of allDocs) {
      const orderSync = docSnap.data();

      // Claim transaccional — mismo patrón que mlprocesarpendientes
      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(docSnap.ref);
        if (!fresh.exists) return false;
        const estado = fresh.data()!.estado;
        if (estado !== "pendiente" && estado !== "error") return false;
        tx.update(docSnap.ref, { estado: "procesando" });
        return true;
      });

      if (!claimed) continue;

      try {
        const result = await procesarOrdenCompleta(
          { id: docSnap.id, ...orderSync } as any,
          docSnap.ref
        );
        procesadas++;
        functions.logger.info(
          `ML AutoCreate: ${orderSync.mlOrderId || docSnap.id} → venta ${result.ventaId} creada`
        );
      } catch (err: any) {
        errores++;
        await docSnap.ref.update({
          estado: "error",
          errorDetalle: `AutoCreate error: ${err.message}`,
        });
        functions.logger.error(
          `ML AutoCreate: error procesando ${orderSync.mlOrderId || docSnap.id}`,
          err
        );
      }
    }

    functions.logger.info(
      `ML AutoCreate: ${procesadas} procesadas, ${errores} errores de ${allDocs.length} listas`
    );
    return null;
  });

// ============================================================
// FUNCIÓN: Consolidar pack orders duplicados + fix data
// ============================================================

/**
 * Helper: buscar cuenta MercadoPago directamente
 */
async function buscarCuentaMPDirecta(): Promise<string | null> {
  const q = await db.collection("cuentasCaja")
    .where("nombre", ">=", "Mercado")
    .where("nombre", "<=", "Mercado\uf8ff")
    .limit(1)
    .get();
  if (!q.empty) return q.docs[0].id;
  const q2 = await db.collection("cuentasCaja")
    .where("tipo", "==", "mercado_pago")
    .limit(1)
    .get();
  return q2.empty ? null : q2.docs[0].id;
}

/**
 * Detecta y corrige pack orders duplicados:
 * 1. Detecta mlOrderSync docs que comparten shipmentId (= pack orders pre-fix)
 * 2. Merge las ventas duplicadas en una sola (combina productos, corrige totales)
 * 3. Elimina la venta duplicada y sus gastos/movimientos de tesorería duplicados
 * 4. Corrige el saldo de la cuenta MercadoPago
 * 5. Consolida los mlOrderSync docs en un solo pack doc
 */
export const mlconsolidatepackorders = functions
  .runWith({ timeoutSeconds: 300, memory: "256MB" })
  .https.onCall(async (data, context) => {
    await requireAdminRole(context); // SEC-008

    const dryRun = data?.dryRun !== false; // Default: solo diagnosticar
    const log: string[] = [];

    // 1. Detectar duplicados por shipmentId
    const allSyncs = await db.collection("mlOrderSync").get();
    const byShipment = new Map<number, FirebaseFirestore.QueryDocumentSnapshot[]>();

    for (const doc of allSyncs.docs) {
      const d = doc.data();
      if (d.shipmentId && typeof d.shipmentId === "number") {
        if (!byShipment.has(d.shipmentId)) byShipment.set(d.shipmentId, []);
        byShipment.get(d.shipmentId)!.push(doc);
      }
    }

    const duplicateGroups: Array<{
      shipmentId: number;
      syncDocs: FirebaseFirestore.QueryDocumentSnapshot[];
      ventaIds: string[];
    }> = [];

    for (const [shipId, docs] of byShipment.entries()) {
      const nonPack = docs.filter(d => !d.id.startsWith("ml-pack-"));
      if (nonPack.length < 2) continue;
      const ventaIds = nonPack.map(d => d.data().ventaId).filter(Boolean) as string[];
      duplicateGroups.push({ shipmentId: shipId, syncDocs: nonPack, ventaIds });
    }

    if (duplicateGroups.length === 0) {
      return { fixed: 0, log: ["No se encontraron pack orders duplicados."] };
    }

    log.push(`Encontrados ${duplicateGroups.length} grupo(s) de pack orders duplicados`);
    let fixed = 0;

    for (const group of duplicateGroups) {
      const { shipmentId, syncDocs, ventaIds } = group;
      const orderIds = syncDocs.map(d => d.data().mlOrderId);
      log.push(`--- Shipment ${shipmentId}: órdenes ${orderIds.join(", ")} ---`);

      if (ventaIds.length < 2) {
        log.push(`  Solo ${ventaIds.length} venta(s) vinculada(s), skip merge`);
        continue;
      }

      // Leer las ventas
      const ventaDocs = await Promise.all(
        ventaIds.map(id => db.collection("ventas").doc(id).get())
      );
      const ventasExistentes = ventaDocs.filter(d => d.exists);
      if (ventasExistentes.length < 2) {
        log.push(`  Solo ${ventasExistentes.length} venta(s) existen en Firestore, skip`);
        continue;
      }

      // Elegir la venta principal (la primera) y la(s) duplicada(s)
      const ventaPrincipal = ventasExistentes[0];
      const ventasDuplicadas = ventasExistentes.slice(1);
      const vpData = ventaPrincipal.data()!;

      log.push(`  Venta principal: ${vpData.numeroVenta} (${ventaPrincipal.id})`);
      for (const vd of ventasDuplicadas) {
        log.push(`  Venta duplicada: ${vd.data()!.numeroVenta} (${vd.id})`);
      }

      if (dryRun) {
        log.push(`  [DRY RUN] Se haría merge y limpieza`);
        // Calcular qué se eliminaría
        for (const vd of ventasDuplicadas) {
          const vdData = vd.data()!;
          // Gastos vinculados a la venta duplicada
          const gastosQ = await db.collection("gastos").where("ventaId", "==", vd.id).get();
          log.push(`  [DRY RUN] Eliminar ${gastosQ.size} gasto(s) de venta ${vdData.numeroVenta}`);
          // Movimientos de tesorería
          const movsQ = await db.collection("movimientosTesoreria").where("ventaId", "==", vd.id).get();
          log.push(`  [DRY RUN] Eliminar ${movsQ.size} movimiento(s) de tesorería`);
          // Envío duplicado
          log.push(`  [DRY RUN] Envío duplicado: costoEnvio=${vdData.costoEnvio || 0}, cargoEnvioML=${vdData.cargoEnvioML || 0}`);
        }
        continue;
      }

      // === EJECUTAR FIX ===
      try {
        // 2a. Merge productos de ventas duplicadas en la venta principal
        const productosMain = vpData.productos || [];
        let mergedProductos = [...productosMain];
        let subtotalMerge = vpData.subtotalPEN || 0;
        let comisionMerge = vpData.comisionML || 0;

        for (const vd of ventasDuplicadas) {
          const vdData = vd.data()!;
          const prodsDup = vdData.productos || [];
          mergedProductos = [...mergedProductos, ...prodsDup];
          subtotalMerge += vdData.subtotalPEN || 0;
          comisionMerge += vdData.comisionML || 0;
        }

        // Recalcular totales (envío solo de la venta principal)
        const costoEnvio = vpData.costoEnvio || 0;
        const cargoEnvioML = vpData.cargoEnvioML || 0;
        const totalMerge = subtotalMerge + costoEnvio;
        const comisionPct = totalMerge > 0 ? (comisionMerge / totalMerge) * 100 : 0;

        // Recalcular costos de unidades asignadas
        let costoTotalPEN = 0;
        for (const prod of mergedProductos) {
          costoTotalPEN += prod.costoTotalUnidades || 0;
        }
        const gastosVentaPEN = comisionMerge + (cargoEnvioML > 0 ? cargoEnvioML : 0);
        const utilidadBruta = totalMerge - costoTotalPEN;
        const utilidadNeta = utilidadBruta - gastosVentaPEN;
        const margenBruto = totalMerge > 0 ? (utilidadBruta / totalMerge) * 100 : 0;
        const margenNeto = totalMerge > 0 ? (utilidadNeta / totalMerge) * 100 : 0;

        // 2b. Actualizar venta principal con datos mergeados
        const subOrderIds = orderIds;
        const packId = shipmentId; // Usar shipmentId como packId de referencia
        await db.collection("ventas").doc(ventaPrincipal.id).update({
          productos: mergedProductos,
          subtotalPEN: subtotalMerge,
          totalPEN: totalMerge,
          comisionML: comisionMerge,
          comisionMLPorcentaje: comisionPct,
          gastosVentaPEN,
          costoTotalPEN,
          utilidadBrutaPEN: utilidadBruta,
          utilidadNetaPEN: utilidadNeta,
          margenBruto,
          margenNeto,
          montoPagado: totalMerge,
          montoPendiente: 0,
          packId,
          subOrderIds,
          observaciones: `Pack ML (shipment ${shipmentId}, sub-órdenes: ${orderIds.join(", ")}) - Consolidado automáticamente`,
        });
        log.push(`  Venta ${vpData.numeroVenta} actualizada con ${mergedProductos.length} productos, total S/ ${totalMerge.toFixed(2)}`);

        // 2c. Actualizar pago de la venta principal (monto correcto)
        const pagosMain = vpData.pagos || [];
        if (pagosMain.length > 0) {
          pagosMain[0].monto = totalMerge;
          await db.collection("ventas").doc(ventaPrincipal.id).update({
            pagos: pagosMain,
          });
        }

        // 3. Eliminar datos de ventas duplicadas
        let saldoCorrection = 0; // Monto a devolver al saldo MP

        for (const vd of ventasDuplicadas) {
          const vdData = vd.data()!;
          const vdId = vd.id;

          // 3a. Liberar unidades reservadas por la venta duplicada
          const unitsQ = await db.collection("unidades")
            .where("reservadaPara", "==", vdId)
            .get();
          for (const unitDoc of unitsQ.docs) {
            // Reasignar a la venta principal
            await unitDoc.ref.update({
              reservadaPara: ventaPrincipal.id,
            });
          }
          log.push(`  ${unitsQ.size} unidad(es) reasignadas de ${vdData.numeroVenta} → ${vpData.numeroVenta}`);

          // 3b. Eliminar gastos vinculados a la venta duplicada
          const gastosQ = await db.collection("gastos").where("ventaId", "==", vdId).get();
          for (const gastoDoc of gastosQ.docs) {
            const gData = gastoDoc.data();
            saldoCorrection += gData.montoPEN || 0; // Estos egresos se eliminan → devolver al saldo
            await gastoDoc.ref.delete();
          }
          log.push(`  ${gastosQ.size} gasto(s) eliminados (S/ ${saldoCorrection.toFixed(2)} a devolver al saldo MP)`);

          // 3c. Eliminar movimientos de tesorería de la venta duplicada
          const movsQ = await db.collection("movimientosTesoreria").where("ventaId", "==", vdId).get();
          let ingresosDup = 0;
          let egresosDup = 0;
          for (const movDoc of movsQ.docs) {
            const mData = movDoc.data();
            if (mData.tipo === "ingreso_venta") {
              ingresosDup += mData.monto || 0;
            } else {
              egresosDup += mData.monto || 0;
            }
            await movDoc.ref.delete();
          }
          log.push(`  ${movsQ.size} movimiento(s) tesorería eliminados (ingresos: S/ ${ingresosDup.toFixed(2)}, egresos: S/ ${egresosDup.toFixed(2)})`);

          // 3d. Corregir saldo cuenta MP:
          //     - Se eliminó un ingreso_venta duplicado → restar del saldo
          //     - Se eliminaron egresos duplicados (gastos) → sumar al saldo
          //     Neto = -ingresos + egresos (porque el saldo original se incrementó/decrementó por ambos)
          const netBalanceAdjust = -ingresosDup + egresosDup;

          // 3e. Eliminar la venta duplicada
          await db.collection("ventas").doc(vdId).delete();
          log.push(`  Venta duplicada ${vdData.numeroVenta} (${vdId}) eliminada`);

          // Aplicar corrección de saldo
          if (netBalanceAdjust !== 0) {
            const cuentaMP = await buscarCuentaMPDirecta();
            if (cuentaMP) {
              await db.collection("cuentasCaja").doc(cuentaMP).update({
                saldoActual: admin.firestore.FieldValue.increment(netBalanceAdjust),
              });
              log.push(`  Saldo MP ajustado: ${netBalanceAdjust > 0 ? "+" : ""}S/ ${netBalanceAdjust.toFixed(2)}`);
            }
          }
        }

        // 4. Actualizar movimiento de tesorería de la venta principal (monto correcto)
        const movsMainQ = await db.collection("movimientosTesoreria")
          .where("ventaId", "==", ventaPrincipal.id)
          .where("tipo", "==", "ingreso_venta")
          .limit(1)
          .get();
        if (!movsMainQ.empty) {
          const oldMonto = movsMainQ.docs[0].data().monto || 0;
          if (Math.abs(oldMonto - totalMerge) > 0.01) {
            const diff = totalMerge - oldMonto;
            await movsMainQ.docs[0].ref.update({
              monto: totalMerge,
              concepto: `Pago venta ${vpData.numeroVenta} - Pack ML (shipment ${shipmentId})`,
            });
            // Corregir saldo MP por la diferencia del ingreso
            const cuentaMP = await buscarCuentaMPDirecta();
            if (cuentaMP) {
              await db.collection("cuentasCaja").doc(cuentaMP).update({
                saldoActual: admin.firestore.FieldValue.increment(diff),
              });
              log.push(`  Ingreso principal ajustado: S/ ${oldMonto.toFixed(2)} → S/ ${totalMerge.toFixed(2)} (diff: ${diff > 0 ? "+" : ""}${diff.toFixed(2)})`);
            }
          }
        }

        // 5. Actualizar gastos de comisión de la venta principal (monto consolidado)
        const gastosMainQ = await db.collection("gastos")
          .where("ventaId", "==", ventaPrincipal.id)
          .where("tipo", "==", "comision_ml")
          .limit(1)
          .get();
        if (!gastosMainQ.empty) {
          const oldComision = gastosMainQ.docs[0].data().montoPEN || 0;
          if (Math.abs(oldComision - comisionMerge) > 0.01) {
            const diff = comisionMerge - oldComision;
            await gastosMainQ.docs[0].ref.update({
              montoOriginal: comisionMerge,
              montoPEN: comisionMerge,
              montoPagado: comisionMerge,
              descripcion: `Comisión ML - Pack (shipment ${shipmentId}) - ${vpData.numeroVenta}`,
              pagos: [{
                ...gastosMainQ.docs[0].data().pagos?.[0],
                montoOriginal: comisionMerge,
                montoPEN: comisionMerge,
              }],
            });
            // Ajustar saldo MP y movimiento de tesorería por la diferencia
            const movGastoQ = await db.collection("movimientosTesoreria")
              .where("gastoId", "==", gastosMainQ.docs[0].id)
              .limit(1)
              .get();
            if (!movGastoQ.empty) {
              await movGastoQ.docs[0].ref.update({
                monto: comisionMerge,
              });
            }
            const cuentaMP = await buscarCuentaMPDirecta();
            if (cuentaMP) {
              await db.collection("cuentasCaja").doc(cuentaMP).update({
                saldoActual: admin.firestore.FieldValue.increment(-diff),
              });
              log.push(`  Comisión principal ajustada: S/ ${oldComision.toFixed(2)} → S/ ${comisionMerge.toFixed(2)}`);
            }
          }
        }

        // 6. Consolidar mlOrderSync docs
        const primarySync = syncDocs[0];
        // Merge productos de todos los sync docs
        let allProductos: any[] = [];
        let totalMLMerge = 0;
        let comisionMLMerge = 0;
        for (const sd of syncDocs) {
          const sdData = sd.data();
          allProductos = [...allProductos, ...(sdData.productos || [])];
          totalMLMerge += sdData.totalML || 0;
          comisionMLMerge += sdData.comisionML || 0;
        }

        // Actualizar el sync doc principal
        await primarySync.ref.update({
          packId,
          subOrderIds: orderIds,
          subOrdersRecibidas: orderIds.length,
          productos: allProductos,
          totalML: totalMLMerge,
          comisionML: comisionMLMerge,
          ventaId: ventaPrincipal.id,
          numeroVenta: vpData.numeroVenta,
        });

        // Marcar los otros sync docs como "ignorada" con referencia al pack
        for (let i = 1; i < syncDocs.length; i++) {
          await syncDocs[i].ref.update({
            estado: "ignorada",
            errorDetalle: `Consolidado en pack (shipment ${shipmentId}) → ${primarySync.id}`,
            ventaId: ventaPrincipal.id,
            numeroVenta: vpData.numeroVenta,
          });
        }
        log.push(`  mlOrderSync consolidados: ${primarySync.id} es principal, ${syncDocs.length - 1} marcados como ignorada`);

        fixed++;
        log.push(`  === PACK CORREGIDO EXITOSAMENTE ===`);
      } catch (err: any) {
        log.push(`  ERROR: ${err.message}`);
        functions.logger.error(`Error consolidando pack shipment ${shipmentId}`, err);
      }
    }

    return {
      dryRun,
      found: duplicateGroups.length,
      fixed,
      log,
    };
  });
