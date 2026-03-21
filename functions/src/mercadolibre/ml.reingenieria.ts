/**
 * Mercado Libre — Reingeniería de datos financieros
 *
 * Reconstruye todos los registros financieros (movimientos, gastos, saldo MP)
 * desde mlOrderSync como fuente de verdad.
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { resolverTCVenta } from "../tipoCambio.util";
import { requireAdminRole } from "./ml.auth";

const db = admin.firestore();

export const mlreingenieria = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data, context) => {
  await requireAdminRole(context); // SEC-008

  const dryRun = data?.dryRun !== false;
  const saldoRealMP: number | null = data?.saldoRealMP ?? null;
  const log: string[] = [];
  const stats = {
    ordenesLeidas: 0, ventasEncontradas: 0, ventasSkipped: 0,
    movsAnulados: 0, movsCreados: 0,
    gastosEliminados: 0, gastosCreados: 0,
    gdUrbanoCorregidos: 0, gdUrbanoCreados: 0,
    ventasActualizadas: 0, adelantosRespetados: 0,
    canalCorregido: 0,
  };

  try {
    log.push(`=== REINGENIERÍA ML ${dryRun ? "(DRY RUN)" : "(APLICANDO)"} ===`);
    log.push("");

    // ---- FASE 1: CARGA MASIVA ----
    log.push("--- Fase 1: Carga masiva ---");

    const mpQuery = await db.collection("cuentasCaja")
      .where("metodoPagoAsociado", "==", "mercado_pago")
      .where("activa", "==", true)
      .limit(1).get();
    if (mpQuery.empty) {
      return { success: false, message: "No se encontró cuenta MercadoPago activa", log };
    }
    const cuentaMPId = mpQuery.docs[0].id;
    const saldoAnterior = mpQuery.docs[0].data().saldoActual || 0;
    log.push(`Cuenta MP: ${mpQuery.docs[0].data().nombre} (${cuentaMPId}) — Saldo: S/ ${saldoAnterior.toFixed(2)}`);

    const syncProcesadasSnap = await db.collection("mlOrderSync").where("estado", "==", "procesada").get();
    const syncPendientesSnap = await db.collection("mlOrderSync").where("estado", "==", "pendiente").get();
    const syncByVentaId = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    const syncByMlOrderId = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    const allSyncDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

    for (const doc of syncProcesadasSnap.docs) {
      const d = doc.data();
      if (d.ventaId) syncByVentaId.set(d.ventaId, doc);
      if (d.mlOrderId) syncByMlOrderId.set(String(d.mlOrderId), doc);
      allSyncDocs.push(doc);
    }
    let pendientesVinculadas = 0;
    for (const doc of syncPendientesSnap.docs) {
      const d = doc.data();
      if (d.mlOrderId) syncByMlOrderId.set(String(d.mlOrderId), doc);
      if (d.ventaId) {
        syncByVentaId.set(d.ventaId, doc);
        allSyncDocs.push(doc);
        pendientesVinculadas++;
      }
    }
    stats.ordenesLeidas = allSyncDocs.length;
    log.push(`mlOrderSync procesadas: ${syncProcesadasSnap.size}, pendientes: ${syncPendientesSnap.size} (${pendientesVinculadas} vinculadas)`);
    log.push(`Total órdenes a procesar: ${allSyncDocs.length}`);

    const ventasSnap = await db.collection("ventas").where("canalNombre", "==", "Mercado Libre").get();
    const ventasMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of ventasSnap.docs) ventasMap.set(doc.id, doc);
    log.push(`Ventas ML: ${ventasSnap.size}`);

    const gastosGVSnap = await db.collection("gastos")
      .where("tipo", "in", ["comision_ml", "cargo_envio_ml"]).get();
    const gastosGVByVenta = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    for (const doc of gastosGVSnap.docs) {
      const vid = doc.data().ventaId;
      if (vid) {
        if (!gastosGVByVenta.has(vid)) gastosGVByVenta.set(vid, []);
        gastosGVByVenta.get(vid)!.push(doc);
      }
    }

    const gastosGDSnap = await db.collection("gastos").where("tipo", "==", "delivery").get();
    const gastosGDByVenta = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    const gastoDeliveryIds = new Set<string>();
    for (const doc of gastosGDSnap.docs) {
      gastoDeliveryIds.add(doc.id);
      const vid = doc.data().ventaId;
      if (vid) {
        if (!gastosGDByVenta.has(vid)) gastosGDByVenta.set(vid, []);
        gastosGDByVenta.get(vid)!.push(doc);
      }
    }

    const movsSnap = await db.collection("movimientosTesoreria").where("estado", "==", "ejecutado").get();
    const movsByVenta = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    const movsByGastoId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    for (const doc of movsSnap.docs) {
      const d = doc.data();
      const vid = d.ventaId;
      if (vid) {
        if (!movsByVenta.has(vid)) movsByVenta.set(vid, []);
        movsByVenta.get(vid)!.push(doc);
      }
      const gid = d.gastoId;
      if (gid) {
        if (!movsByGastoId.has(gid)) movsByGastoId.set(gid, []);
        movsByGastoId.get(gid)!.push(doc);
      }
    }

    const transportistaUrbanoQ = await db.collection("transportistas")
      .where("nombre", ">=", "Urbano").where("nombre", "<=", "Urbano\uf8ff").limit(1).get();
    const transportistaUrbanoId = transportistaUrbanoQ.empty ? null : transportistaUrbanoQ.docs[0].id;
    const transportistaUrbanoNombre = transportistaUrbanoQ.empty ? "Urbano" : transportistaUrbanoQ.docs[0].data().nombre;

    log.push(`Gastos GV: ${gastosGVSnap.size}, GD: ${gastosGDSnap.size}, Movimientos: ${movsSnap.size}`);
    log.push(`Transportista Urbano: ${transportistaUrbanoId ? transportistaUrbanoNombre : "NO ENCONTRADO"}`);
    log.push("");

    const tc = await resolverTCVenta();

    let gastoCounter = 0;
    const lastGasto = await db.collection("gastos")
      .where("numeroGasto", ">=", "GAS-").where("numeroGasto", "<=", "GAS-\uf8ff")
      .orderBy("numeroGasto", "desc").limit(1).get();
    if (!lastGasto.empty) {
      const num = parseInt(lastGasto.docs[0].data().numeroGasto.replace("GAS-", ""), 10);
      if (!isNaN(num)) gastoCounter = num;
    }
    const nextGastoNum = () => `GAS-${String(++gastoCounter).padStart(4, "0")}`;

    const simAnulados = new Set<string>();
    const simNuevos: Array<{ monto: number; cuentaDestino?: string; cuentaOrigen?: string; concepto: string }> = [];
    const adelantosReclamados = new Set<string>();

    // ---- FASE 2-PRE: ANULAR AJUSTES MANUALES EN CUENTA MP ----
    log.push("--- Fase 2-pre: Anular ajustes manuales MP ---");
    let ajustesAnulados = 0;
    for (const m of movsSnap.docs) {
      const md = m.data();
      if (md.estado === "anulado") continue;
      const touchesMP = md.cuentaDestino === cuentaMPId || md.cuentaOrigen === cuentaMPId;
      if (!touchesMP) continue;
      const concepto = (md.concepto || md.descripcion || "").toLowerCase();
      if (!concepto.includes("ajuste")) continue;
      if (!dryRun) {
        await m.ref.update({ estado: "anulado", anuladoPor: "ml-reingenieria", fechaAnulacion: admin.firestore.Timestamp.now() });
      }
      simAnulados.add(m.id);
      stats.movsAnulados++;
      ajustesAnulados++;
      const monto = md.monto || 0;
      const dir = md.cuentaDestino === cuentaMPId ? "+" : "-";
      log.push(`  Ajuste anulado: "${md.concepto || md.descripcion || "sin concepto"}" ${dir}S/ ${monto.toFixed(2)}`);
    }
    if (ajustesAnulados === 0) log.push("  (ningún ajuste manual encontrado)");
    log.push("");

    // ---- FASE 2 & 3: LIMPIEZA + RECONSTRUCCIÓN POR ORDEN ----
    log.push("--- Fase 2-3: Limpieza y reconstrucción ---");

    for (const syncDoc of allSyncDocs) {
      const sync = syncDoc.data();
      const ventaId = sync.ventaId;
      if (!ventaId) { stats.ventasSkipped++; continue; }
      const ventaDoc = ventasMap.get(ventaId);
      if (!ventaDoc) { stats.ventasSkipped++; continue; }

      const venta = ventaDoc.data();
      const numVenta = venta.numeroVenta || ventaId;
      const metodoEnvio = sync.metodoEnvio || venta.metodoEnvio || null;
      const comisionML = sync.comisionML || 0;
      const costoEnvioCliente = sync.costoEnvioCliente || 0;
      const cargoEnvioML = sync.cargoEnvioML || 0;
      const subtotalPEN = sync.totalML || venta.subtotalPEN || 0;
      const fechaOrden = sync.fechaOrdenML || venta.fechaCreacion || admin.firestore.Timestamp.now();
      stats.ventasEncontradas++;

      let totalPENCorrecto: number;
      let costoEnvioCorrecto: number;
      if (metodoEnvio === "flex") {
        costoEnvioCorrecto = costoEnvioCliente;
        totalPENCorrecto = subtotalPEN + costoEnvioCorrecto;
      } else {
        costoEnvioCorrecto = 0;
        totalPENCorrecto = subtotalPEN;
      }

      const cotOrigenId = venta.cotizacionOrigenId || null;
      const ventaMovs = movsByVenta.get(ventaId) || [];

      const netMPBruto = totalPENCorrecto - comisionML - (metodoEnvio === "urbano" ? cargoEnvioML : 0);
      let oldNetMP = 0;
      let oldMovsCount = 0;
      const oldMovsDetail: string[] = [];
      for (const m of ventaMovs) {
        const md = m.data();
        if (md.estado === "anulado") continue;
        oldMovsCount++;
        const isIngMP = md.cuentaDestino === cuentaMPId;
        const isEgrMP = md.cuentaOrigen === cuentaMPId;
        if (isIngMP) oldNetMP += md.monto || 0;
        if (isEgrMP) oldNetMP -= md.monto || 0;
        oldMovsDetail.push(`${md.tipo}:${isIngMP ? "+" : isEgrMP ? "-" : "~"}${(md.monto || 0).toFixed(2)}`);
      }
      const diffNetMP = netMPBruto - oldNetMP;
      log.push(`[${numVenta}] ML#${sync.mlOrderId} | ${metodoEnvio || "?"} | total:${totalPENCorrecto.toFixed(2)} | com:${comisionML.toFixed(2)} | neto MP: ${netMPBruto.toFixed(2)}`);
      log.push(`  Movs viejos: ${oldMovsCount} (net: S/${oldNetMP.toFixed(2)}) diff: ${diffNetMP > 0 ? "+" : ""}${diffNetMP.toFixed(2)} | ${oldMovsDetail.join(", ") || "NINGUNO"}`);

      let tieneAdelanto = false;
      let adelantoMonto = 0;
      let adelantoMovId: string | null = null;
      let adelantoFoundBy: "ventaId" | "cotizacionId" | null = null;

      for (const m of ventaMovs) {
        const md = m.data();
        if (md.tipo === "ingreso_anticipo" && md.estado === "ejecutado" && !adelantosReclamados.has(m.id)) {
          tieneAdelanto = true; adelantoMonto = md.monto || 0; adelantoMovId = m.id; adelantoFoundBy = "ventaId"; break;
        }
      }
      if (!tieneAdelanto && cotOrigenId) {
        const movsCot = movsByVenta.get(cotOrigenId) || [];
        for (const m of movsCot) {
          const md = m.data();
          if (md.tipo === "ingreso_anticipo" && md.estado === "ejecutado" && !adelantosReclamados.has(m.id)) {
            tieneAdelanto = true; adelantoMonto = md.monto || 0; adelantoMovId = m.id; adelantoFoundBy = "cotizacionId"; break;
          }
        }
        if (!tieneAdelanto) {
          for (const m of movsSnap.docs) {
            const md = m.data();
            if (md.cotizacionId === cotOrigenId && md.tipo === "ingreso_anticipo" && md.estado === "ejecutado" && !adelantosReclamados.has(m.id)) {
              tieneAdelanto = true; adelantoMonto = md.monto || 0; adelantoMovId = m.id; adelantoFoundBy = "cotizacionId"; break;
            }
          }
        }
      }
      if (!tieneAdelanto) {
        const clienteNombre = (venta.nombreCliente || "").toLowerCase().trim();
        const clienteApellido = clienteNombre.split(" ").pop() || "";
        if (clienteApellido.length >= 3) {
          for (const m of movsSnap.docs) {
            const md = m.data();
            if (md.estado !== "ejecutado" || adelantosReclamados.has(m.id) || md.cuentaDestino !== cuentaMPId) continue;
            const concepto = (md.concepto || md.descripcion || "").toLowerCase();
            const esAdelantoPorTipo = md.tipo === "ingreso_anticipo";
            const esAdelantoPorConcepto = (md.tipo === "ingreso_venta") && (concepto.includes("adelanto") || concepto.includes("cotizaci"));
            if (!esAdelantoPorTipo && !esAdelantoPorConcepto) continue;
            if (!concepto.includes(clienteApellido)) continue;
            const montoMov = md.monto || 0;
            const ratio = totalPENCorrecto > 0 ? Math.abs(montoMov - totalPENCorrecto) / totalPENCorrecto : 1;
            if (ratio < 0.3 || Math.abs(montoMov - totalPENCorrecto) < 1) {
              tieneAdelanto = true; adelantoMonto = montoMov; adelantoMovId = m.id; adelantoFoundBy = "cotizacionId";
              log.push(`  ${numVenta}: Adelanto por nombre "${clienteApellido}": S/ ${montoMov.toFixed(2)}`);
              break;
            }
          }
        }
      }

      if (tieneAdelanto && adelantoMovId) {
        adelantosReclamados.add(adelantoMovId);
        stats.adelantosRespetados++;
        log.push(`  ${numVenta}: Adelanto (por ${adelantoFoundBy}): S/ ${adelantoMonto.toFixed(2)} [${adelantoMovId}]`);
      }

      // --- FASE 2: LIMPIEZA ---
      for (const m of ventaMovs) {
        const md = m.data();
        if (md.estado === "anulado") continue;
        if (md.tipo === "ingreso_anticipo") continue;
        if (m.id === adelantoMovId) continue;
        if ((md.tipo === "ingreso_venta") && md.cuentaDestino && md.cuentaDestino !== cuentaMPId) continue;
        if (md.gastoId && gastoDeliveryIds.has(md.gastoId)) {
          const gdDoc = gastosGDByVenta.get(ventaId)?.find(g => g.id === md.gastoId);
          if (gdDoc && !((gdDoc.data().transportistaNombre || "").toLowerCase()).includes("urbano")) continue;
        }
        if (!dryRun) {
          await m.ref.update({ estado: "anulado", anuladoPor: "ml-reingenieria", fechaAnulacion: admin.firestore.Timestamp.now() });
        }
        simAnulados.add(m.id);
        stats.movsAnulados++;
      }

      const gastosVenta = gastosGVByVenta.get(ventaId) || [];
      for (const g of gastosVenta) {
        const gastoMovs = movsByGastoId.get(g.id) || [];
        for (const gm of gastoMovs) {
          if (gm.data().estado === "anulado" || simAnulados.has(gm.id)) continue;
          simAnulados.add(gm.id);
          if (!dryRun) {
            await gm.ref.update({ estado: "anulado", anuladoPor: "ml-reingenieria", motivoAnulacion: "Gasto eliminado por reingeniería", fechaAnulacion: admin.firestore.Timestamp.now() });
          }
          stats.movsAnulados++;
          log.push(`  ${numVenta}: Mov. huérfano de gasto anulado (S/${(gm.data().monto || 0).toFixed(2)})`);
        }
        if (!dryRun) await g.ref.delete();
        stats.gastosEliminados++;
      }

      // GD Urbano
      if (metodoEnvio === "urbano" && cargoEnvioML > 0) {
        const gdsVenta = gastosGDByVenta.get(ventaId) || [];
        const gdUrbano = gdsVenta.find(g => (g.data().transportistaNombre || "").toLowerCase().includes("urbano"));
        if (gdUrbano) {
          const gdData = gdUrbano.data();
          const montoActual = gdData.montoPEN || gdData.montoOriginal || 0;
          const gdMovs = movsByGastoId.get(gdUrbano.id) || [];
          for (const gm of gdMovs) {
            if (gm.data().estado === "anulado" || simAnulados.has(gm.id)) continue;
            simAnulados.add(gm.id);
            if (!dryRun) {
              await gm.ref.update({ estado: "anulado", anuladoPor: "ml-reingenieria", motivoAnulacion: "GD Urbano reconstruido", fechaAnulacion: admin.firestore.Timestamp.now() });
            }
            stats.movsAnulados++;
            log.push(`  ${numVenta}: Mov. GD Urbano anulado (S/${(gm.data().monto || 0).toFixed(2)})`);
          }
          if (Math.abs(montoActual - cargoEnvioML) > 0.01) {
            if (!dryRun) {
              const pagosUpdated = (gdData.pagos || []).map((p: any, i: number) =>
                i === 0 ? { ...p, montoOriginal: cargoEnvioML, montoPEN: cargoEnvioML } : p
              );
              await gdUrbano.ref.update({ montoOriginal: cargoEnvioML, montoPEN: cargoEnvioML, montoPagado: cargoEnvioML, montoPendiente: 0, pagos: pagosUpdated });
            }
            stats.gdUrbanoCorregidos++;
            log.push(`  ${numVenta}: GD Urbano corregido S/ ${montoActual.toFixed(2)} → S/ ${cargoEnvioML.toFixed(2)}`);
          }
        } else if (transportistaUrbanoId) {
          if (!dryRun) {
            const gdNumero = nextGastoNum();
            const gdPagoId = `PAG-GAS-reeng-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            await db.collection("gastos").add({
              numeroGasto: gdNumero, tipo: "delivery", categoria: "GD", claseGasto: "GVD",
              descripcion: `Distribución ML Urbano - ${numVenta} - Orden #${sync.mlOrderId}`,
              moneda: "PEN", montoOriginal: cargoEnvioML, montoPEN: cargoEnvioML, tipoCambio: tc,
              esProrrateable: false, ventaId, ventaNumero: numVenta,
              transportistaId: transportistaUrbanoId, transportistaNombre: transportistaUrbanoNombre,
              mes: fechaOrden.toDate().getMonth() + 1, anio: fechaOrden.toDate().getFullYear(),
              fecha: fechaOrden, esRecurrente: false, frecuencia: "unico", estado: "pagado",
              impactaCTRU: false, ctruRecalculado: true,
              pagos: [{ id: gdPagoId, fecha: fechaOrden, monedaPago: "PEN", montoOriginal: cargoEnvioML, montoPEN: cargoEnvioML, tipoCambio: tc, metodoPago: "mercado_pago", cuentaOrigenId: cuentaMPId, registradoPor: "ml-reingenieria" }],
              montoPagado: cargoEnvioML, montoPendiente: 0, creadoPor: "ml-reingenieria", fechaCreacion: admin.firestore.Timestamp.now(),
            });
          }
          stats.gdUrbanoCreados++;
          log.push(`  ${numVenta}: GD Urbano creado S/ ${cargoEnvioML.toFixed(2)}`);
        }
      }

      // --- FASE 3: RECONSTRUCCIÓN ---
      const costoTotalPEN = venta.costoTotalPEN || 0;
      const gastosVentaPEN = comisionML + (metodoEnvio === "urbano" ? cargoEnvioML : 0);
      const costoEnvioNegocio = venta.costoEnvioNegocio || 0;
      const totalGastosVenta = gastosVentaPEN + costoEnvioNegocio;
      const utilidadBrutaPEN = totalPENCorrecto - costoTotalPEN;
      const utilidadNetaPEN = utilidadBrutaPEN - totalGastosVenta;

      if (!dryRun) {
        await ventaDoc.ref.update({
          costoEnvio: costoEnvioCorrecto, totalPEN: totalPENCorrecto, comisionML,
          comisionMLPorcentaje: totalPENCorrecto > 0 ? (comisionML / totalPENCorrecto) * 100 : 0,
          cargoEnvioML: metodoEnvio === "urbano" ? cargoEnvioML : 0, metodoEnvio: metodoEnvio || null,
          gastosVentaPEN: totalGastosVenta, utilidadBrutaPEN, utilidadNetaPEN,
          margenBruto: totalPENCorrecto > 0 ? (utilidadBrutaPEN / totalPENCorrecto) * 100 : 0,
          margenNeto: totalPENCorrecto > 0 ? (utilidadNetaPEN / totalPENCorrecto) * 100 : 0,
          montoPagado: totalPENCorrecto, montoPendiente: 0, estadoPago: "pagado",
        });
      }
      stats.ventasActualizadas++;

      let montoNoMP = 0;
      for (const m of ventaMovs) {
        const md = m.data();
        if (md.estado === "anulado" || simAnulados.has(m.id)) continue;
        if (md.tipo === "ingreso_venta" && md.cuentaDestino && md.cuentaDestino !== cuentaMPId) {
          montoNoMP += md.monto || 0;
        }
      }
      const montoIngresoMP = Math.max(0, Math.round((totalPENCorrecto - montoNoMP) * 100) / 100);
      const esPagoDividido = montoNoMP > 0.01;
      if (esPagoDividido) log.push(`  ${numVenta}: PAGO DIVIDIDO — S/ ${montoNoMP.toFixed(2)} otra cuenta, S/ ${montoIngresoMP.toFixed(2)} a MP`);

      if (tieneAdelanto) {
        const montoAdelantoCorrecto = esPagoDividido ? montoIngresoMP : totalPENCorrecto;
        const necesitaAjusteMonto = Math.abs(adelantoMonto - montoAdelantoCorrecto) > 0.01;
        const necesitaVincular = adelantoFoundBy === "cotizacionId";
        if ((necesitaAjusteMonto || necesitaVincular) && adelantoMovId) {
          const updateData: Record<string, any> = {};
          if (necesitaAjusteMonto) {
            updateData.monto = montoAdelantoCorrecto;
            updateData.montoEquivalentePEN = montoAdelantoCorrecto;
            updateData.montoEquivalenteUSD = montoAdelantoCorrecto / tc;
            const diff = montoAdelantoCorrecto - adelantoMonto;
            log.push(`  ${numVenta}: Adelanto ajustado S/ ${adelantoMonto.toFixed(2)} → S/ ${montoAdelantoCorrecto.toFixed(2)}`);
            if (diff > 0) simNuevos.push({ monto: diff, cuentaDestino: cuentaMPId, concepto: `ajuste_adelanto ${numVenta}` });
            else if (diff < 0) simNuevos.push({ monto: Math.abs(diff), cuentaOrigen: cuentaMPId, concepto: `ajuste_adelanto ${numVenta}` });
          }
          if (necesitaVincular) { updateData.ventaId = ventaId; updateData.ventaNumero = numVenta; }
          if (!dryRun && Object.keys(updateData).length > 0) {
            await db.collection("movimientosTesoreria").doc(adelantoMovId).update(updateData);
          }
        }
      } else {
        if (montoIngresoMP > 0.01) {
          if (!dryRun) {
            await db.collection("movimientosTesoreria").add({
              numeroMovimiento: `MOV-reeng-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
              tipo: "ingreso_venta", estado: "ejecutado", moneda: "PEN", monto: montoIngresoMP,
              tipoCambio: tc, montoEquivalentePEN: montoIngresoMP, montoEquivalenteUSD: montoIngresoMP / tc,
              metodo: "mercado_pago",
              concepto: `Pago venta ${numVenta} - ML #${sync.mlOrderId}${esPagoDividido ? " (porción MP)" : ""}`,
              ventaId, ventaNumero: numVenta, cuentaDestino: cuentaMPId, fecha: fechaOrden,
              creadoPor: "ml-reingenieria", fechaCreacion: admin.firestore.Timestamp.now(),
            });
          }
          simNuevos.push({ monto: montoIngresoMP, cuentaDestino: cuentaMPId, concepto: `ingreso ${numVenta}` });
          stats.movsCreados++;
        } else {
          log.push(`  ${numVenta}: Sin ingreso a MP (todo pagado por otra vía)`);
        }
      }

      if (comisionML > 0) {
        const numGasto = nextGastoNum();
        const pagoId = `PAG-GAS-reeng-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (!dryRun) {
          const gastoRef = await db.collection("gastos").add({
            numeroGasto: numGasto, tipo: "comision_ml", categoria: "GV", claseGasto: "GVD",
            descripcion: `Comisión ML - Orden #${sync.mlOrderId} - ${numVenta}`,
            moneda: "PEN", montoOriginal: comisionML, montoPEN: comisionML, tipoCambio: tc,
            esProrrateable: false, ventaId, ventaNumero: numVenta,
            mes: fechaOrden.toDate().getMonth() + 1, anio: fechaOrden.toDate().getFullYear(),
            fecha: fechaOrden, esRecurrente: false, frecuencia: "unico", estado: "pagado",
            impactaCTRU: false, ctruRecalculado: true,
            pagos: [{ id: pagoId, fecha: fechaOrden, monedaPago: "PEN", montoOriginal: comisionML, montoPEN: comisionML, tipoCambio: tc, metodoPago: "mercado_pago", cuentaOrigenId: cuentaMPId, registradoPor: "ml-reingenieria" }],
            montoPagado: comisionML, montoPendiente: 0, creadoPor: "ml-reingenieria", fechaCreacion: admin.firestore.Timestamp.now(),
          });
          await db.collection("movimientosTesoreria").add({
            numeroMovimiento: `MOV-reeng-com-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
            tipo: "gasto_operativo", estado: "ejecutado", moneda: "PEN", monto: comisionML,
            tipoCambio: tc, montoEquivalentePEN: comisionML, montoEquivalenteUSD: comisionML / tc,
            metodo: "mercado_pago", concepto: `Comisión ML - ${numVenta} - Orden #${sync.mlOrderId}`,
            gastoId: gastoRef.id, gastoNumero: numGasto, ventaId, ventaNumero: numVenta,
            cuentaOrigen: cuentaMPId, fecha: fechaOrden, creadoPor: "ml-reingenieria", fechaCreacion: admin.firestore.Timestamp.now(),
          });
        }
        simNuevos.push({ monto: comisionML, cuentaOrigen: cuentaMPId, concepto: `comision ${numVenta}` });
        stats.gastosCreados++;
        stats.movsCreados++;
      }

      if (metodoEnvio === "urbano" && cargoEnvioML > 0) {
        const numGastoEnvio = nextGastoNum();
        const pagoEnvioId = `PAG-GAS-reeng-env-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        if (!dryRun) {
          const gastoEnvioRef = await db.collection("gastos").add({
            numeroGasto: numGastoEnvio, tipo: "cargo_envio_ml", categoria: "GV", claseGasto: "GVD",
            descripcion: `Cargo envío ML (Urbano) - Orden #${sync.mlOrderId} - ${numVenta}`,
            moneda: "PEN", montoOriginal: cargoEnvioML, montoPEN: cargoEnvioML, tipoCambio: tc,
            esProrrateable: false, ventaId, ventaNumero: numVenta,
            mes: fechaOrden.toDate().getMonth() + 1, anio: fechaOrden.toDate().getFullYear(),
            fecha: fechaOrden, esRecurrente: false, frecuencia: "unico", estado: "pagado",
            impactaCTRU: false, ctruRecalculado: true,
            pagos: [{ id: pagoEnvioId, fecha: fechaOrden, monedaPago: "PEN", montoOriginal: cargoEnvioML, montoPEN: cargoEnvioML, tipoCambio: tc, metodoPago: "mercado_pago", cuentaOrigenId: cuentaMPId, registradoPor: "ml-reingenieria" }],
            montoPagado: cargoEnvioML, montoPendiente: 0, creadoPor: "ml-reingenieria", fechaCreacion: admin.firestore.Timestamp.now(),
          });
          await db.collection("movimientosTesoreria").add({
            numeroMovimiento: `MOV-reeng-env-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
            tipo: "gasto_operativo", estado: "ejecutado", moneda: "PEN", monto: cargoEnvioML,
            tipoCambio: tc, montoEquivalentePEN: cargoEnvioML, montoEquivalenteUSD: cargoEnvioML / tc,
            metodo: "mercado_pago", concepto: `Cargo envío ML (Urbano) - ${numVenta} - Orden #${sync.mlOrderId}`,
            gastoId: gastoEnvioRef.id, gastoNumero: numGastoEnvio, ventaId, ventaNumero: numVenta,
            cuentaOrigen: cuentaMPId, fecha: fechaOrden, creadoPor: "ml-reingenieria", fechaCreacion: admin.firestore.Timestamp.now(),
          });
        }
        simNuevos.push({ monto: cargoEnvioML, cuentaOrigen: cuentaMPId, concepto: `cargo_envio ${numVenta}` });
        stats.gastosCreados++;
        stats.movsCreados++;
      }
    }

    // Ventas ML sin mlOrderSync vinculado
    log.push("");
    log.push("--- Ventas ML sin mlOrderSync vinculado ---");
    let ventasSinSync = 0;
    for (const [vid, vDoc] of ventasMap) {
      if (syncByVentaId.has(vid)) continue;
      const vData = vDoc.data();
      const mlId = vData.mercadoLibreId || vData.mlOrderId;
      if (mlId && syncByMlOrderId.has(String(mlId))) continue;
      ventasSinSync++;
      log.push(`  ${vData.numeroVenta || vid}: "${vData.nombreCliente || "?"}" S/${(vData.totalPEN || 0).toFixed(2)} — sin mlOrderSync`);
    }
    if (ventasSinSync === 0) log.push("  (todas las ventas ML tienen mlOrderSync vinculado)");
    else log.push(`  → ${ventasSinSync} ventas sin vincular.`);

    // ---- FASE 4: RECÁLCULO BALANCE MP ----
    log.push("");
    log.push("--- Fase 4: Recálculo balance MP ---");

    const allMovsFinal = await db.collection("movimientosTesoreria").where("estado", "==", "ejecutado").get();

    let saldoCalculado = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;
    for (const m of allMovsFinal.docs) {
      if (simAnulados.has(m.id)) continue;
      const d = m.data();
      const isIngreso = d.cuentaDestino === cuentaMPId;
      const isEgreso = d.cuentaOrigen === cuentaMPId;
      if (isIngreso) { saldoCalculado += d.monto || 0; totalIngresos += d.monto || 0; }
      if (isEgreso) { saldoCalculado -= d.monto || 0; totalEgresos += d.monto || 0; }
    }
    for (const vm of simNuevos) {
      if (vm.cuentaDestino === cuentaMPId) { saldoCalculado += vm.monto; totalIngresos += vm.monto; }
      if (vm.cuentaOrigen === cuentaMPId) { saldoCalculado -= vm.monto; totalEgresos += vm.monto; }
    }
    saldoCalculado = Math.round(saldoCalculado * 100) / 100;

    log.push(`Saldo registrado ERP: S/ ${saldoAnterior.toFixed(2)}`);
    log.push(`Saldo calculado: S/ ${saldoCalculado.toFixed(2)}`);
    log.push(`Total ingresos MP: S/ ${totalIngresos.toFixed(2)}`);
    log.push(`Total egresos MP: S/ ${totalEgresos.toFixed(2)}`);
    log.push(`Movs: ${simAnulados.size} anulados, ${simNuevos.length} nuevos`);

    // Reconciliación
    let saldoFinal = saldoCalculado;
    let ajusteReconciliacion = 0;
    if (saldoRealMP !== null && saldoRealMP !== undefined) {
      ajusteReconciliacion = Math.round((saldoRealMP - saldoCalculado) * 100) / 100;
      log.push("");
      log.push("--- Reconciliación con saldo real ---");
      log.push(`Saldo real MP: S/ ${saldoRealMP.toFixed(2)}`);
      log.push(`Saldo calculado: S/ ${saldoCalculado.toFixed(2)}`);
      log.push(`Ajuste necesario: S/ ${ajusteReconciliacion > 0 ? "+" : ""}${ajusteReconciliacion.toFixed(2)}`);
      if (Math.abs(ajusteReconciliacion) > 0.01) {
        if (!dryRun) {
          const ajusteData: any = {
            numeroMovimiento: `MOV-reeng-ajuste-${Date.now()}`,
            tipo: ajusteReconciliacion > 0 ? "ingreso_venta" : "gasto_operativo",
            estado: "ejecutado", moneda: "PEN", monto: Math.abs(ajusteReconciliacion),
            tipoCambio: tc, montoEquivalentePEN: Math.abs(ajusteReconciliacion),
            montoEquivalenteUSD: Math.abs(ajusteReconciliacion) / tc, metodo: "mercado_pago",
            concepto: `Ajuste reconciliación reingeniería ML (${ajusteReconciliacion > 0 ? "+" : ""}${ajusteReconciliacion.toFixed(2)})`,
            creadoPor: "ml-reingenieria", fechaCreacion: admin.firestore.Timestamp.now(), fecha: admin.firestore.Timestamp.now(),
          };
          if (ajusteReconciliacion > 0) ajusteData.cuentaDestino = cuentaMPId;
          else ajusteData.cuentaOrigen = cuentaMPId;
          await db.collection("movimientosTesoreria").add(ajusteData);
          stats.movsCreados++;
        }
        log.push(`→ ${dryRun ? "[DRY RUN] Se crearía" : "Creado"} ajuste: ${ajusteReconciliacion > 0 ? "ingreso" : "egreso"} S/ ${Math.abs(ajusteReconciliacion).toFixed(2)}`);
        saldoFinal = saldoRealMP;
      } else {
        log.push(`→ Balance ya cuadra!`);
      }
    } else {
      log.push(`(No se proporcionó saldoRealMP — sin reconciliación)`);
    }

    if (!dryRun) {
      await db.collection("cuentasCaja").doc(cuentaMPId).update({ saldoActual: saldoFinal });
      log.push(`Saldo MP actualizado a S/ ${saldoFinal.toFixed(2)}`);
    } else {
      log.push(`[DRY RUN] Saldo pasaría de S/ ${saldoAnterior.toFixed(2)} → S/ ${saldoFinal.toFixed(2)}`);
    }

    log.push("");
    log.push("--- Resumen ---");
    log.push(`Órdenes leídas: ${stats.ordenesLeidas}`);
    log.push(`Ventas encontradas: ${stats.ventasEncontradas} (${stats.ventasSkipped} skipped)`);
    log.push(`Adelantos respetados: ${stats.adelantosRespetados}`);
    log.push(`Movimientos anulados: ${stats.movsAnulados} (incl. ${ajustesAnulados} ajustes MP)`);
    log.push(`Movimientos creados: ${stats.movsCreados}`);
    log.push(`Gastos GV eliminados: ${stats.gastosEliminados}`);
    log.push(`Gastos GV creados: ${stats.gastosCreados}`);
    log.push(`GD Urbano corregidos/creados: ${stats.gdUrbanoCorregidos}/${stats.gdUrbanoCreados}`);
    log.push(`Ventas actualizadas: ${stats.ventasActualizadas}`);
    log.push(`Ventas ML sin vincular: ${ventasSinSync}`);

    functions.logger.info(`ML Reingeniería ${dryRun ? "(DRY RUN)" : "(APLICADO)"}: ${stats.ventasEncontradas} ventas, ${stats.movsAnulados} anulados, ${stats.movsCreados} creados`);

    return {
      success: true, dryRun,
      ordenesAnalizadas: stats.ordenesLeidas,
      ventasActualizadas: stats.ventasActualizadas,
      movimientosAnulados: stats.movsAnulados,
      movimientosCreados: stats.movsCreados,
      gastosEliminados: stats.gastosEliminados,
      gastosCreados: stats.gastosCreados,
      gdUrbanoCreadosCorregidos: stats.gdUrbanoCorregidos + stats.gdUrbanoCreados,
      adelantosRespetados: stats.adelantosRespetados,
      ventasSinVincular: ventasSinSync,
      balanceMP: { anterior: saldoAnterior, calculado: saldoCalculado, ajusteReconciliacion, final: saldoFinal, saldoRealMP },
      log,
    };

  } catch (err: any) {
    functions.logger.error("Error en reingeniería ML:", err);
    throw new functions.https.HttpsError("internal", `Error: ${err.message}`);
  }
});

