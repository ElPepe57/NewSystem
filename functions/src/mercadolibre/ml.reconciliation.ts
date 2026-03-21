/**
 * Mercado Libre — Diagnóstico y reconciliación financiera
 *
 * Funciones:
 * - mldiagnosticosistema: Escaneo integral de inconsistencias
 * - mlrecalcularbalancemp: Recalcula saldo cuenta MercadoPago
 * - mlreingenieria: Reconstruye registros financieros desde mlOrderSync
 * - mlmatchsuggestions: Sugerencias de matching histórico ↔ ventas manuales
 * - mlconfirmmatch: Confirma vinculación manual ML ↔ Venta
 * - mldiaginconsistencias: Diagnóstico de inconsistencias financieras
 * - mlresolverinconsistencias: Resolver inconsistencias financieras
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { requireAdminRole } from "./ml.auth";
import { MLOrderSync } from "./ml.types";

const db = admin.firestore();

// ============================================================
// FUNCIÓN: Diagnóstico integral del sistema ML
// ============================================================

export const mldiagnosticosistema = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (_data, context) => {
  await requireAdminRole(context); // SEC-008

  const log: string[] = [];
  const issues: Array<{
    tipo: string;
    severidad: "critica" | "alta" | "media" | "baja";
    descripcion: string;
    ids: string[];
  }> = [];

  try {
    // ── 1. VENTAS DUPLICADAS por mercadoLibreId ──
    log.push("=== 1. Escaneando ventas ML duplicadas por mercadoLibreId ===");
    const ventasMLSnap = await db.collection("ventas")
      .where("canalNombre", "==", "Mercado Libre")
      .get();

    const ventasByMLId = new Map<string, Array<{ id: string; numero: string; total: number }>>();
    const ventasByNumero = new Map<string, string[]>();
    const allMLVentaIds = new Set<string>();

    for (const doc of ventasMLSnap.docs) {
      const data = doc.data();
      allMLVentaIds.add(doc.id);

      const mlId = data.mercadoLibreId;
      if (mlId) {
        if (!ventasByMLId.has(mlId)) ventasByMLId.set(mlId, []);
        ventasByMLId.get(mlId)!.push({
          id: doc.id,
          numero: data.numeroVenta || "SIN-NUMERO",
          total: data.totalPEN || 0,
        });
      }

      const num = data.numeroVenta;
      if (num) {
        if (!ventasByNumero.has(num)) ventasByNumero.set(num, []);
        ventasByNumero.get(num)!.push(doc.id);
      }
    }

    let dupVentaCount = 0;
    for (const [mlId, ventas] of ventasByMLId.entries()) {
      if (ventas.length > 1) {
        dupVentaCount++;
        const desc = ventas.map(v => `${v.numero} (${v.id}) S/${v.total.toFixed(2)}`).join(" | ");
        issues.push({
          tipo: "venta_duplicada_mlId",
          severidad: "critica",
          descripcion: `ML Order ${mlId}: ${ventas.length} ventas → ${desc}`,
          ids: ventas.map(v => v.id),
        });
        log.push(`ML Order ${mlId}: ${ventas.length} ventas duplicadas`);
      }
    }
    log.push(`  Ventas ML: ${ventasMLSnap.size}. Duplicados por mlId: ${dupVentaCount}`);

    let dupNumCount = 0;
    for (const [num, ids] of ventasByNumero.entries()) {
      if (ids.length > 1) {
        dupNumCount++;
        issues.push({
          tipo: "numero_venta_duplicado",
          severidad: "alta",
          descripcion: `${num} usado ${ids.length} veces: ${ids.join(", ")}`,
          ids,
        });
        log.push(`Número ${num} duplicado en ${ids.length} ventas`);
      }
    }
    log.push(`  Números duplicados: ${dupNumCount}`);

    // ── 2. GASTOS HUÉRFANOS ──
    log.push("\n=== 2. Escaneando gastos ML huérfanos ===");
    const gastosMLSnap = await db.collection("gastos")
      .where("tipo", "in", ["comision_ml", "cargo_envio_ml"])
      .get();

    let gastosHuerfanos = 0;
    let gastosDupVenta = 0;
    const gastosByVentaId = new Map<string, Array<{ id: string; tipo: string; monto: number; numero: string }>>();

    for (const doc of gastosMLSnap.docs) {
      const data = doc.data();
      const ventaId = data.ventaId;

      if (ventaId) {
        const ventaDoc = await db.collection("ventas").doc(ventaId).get();
        if (!ventaDoc.exists) {
          gastosHuerfanos++;
          issues.push({
            tipo: "gasto_huerfano",
            severidad: "critica",
            descripcion: `Gasto ${data.numeroGasto || doc.id} (${data.tipo}, S/${(data.montoPEN || 0).toFixed(2)}) → ventaId ${ventaId} NO EXISTE`,
            ids: [doc.id],
          });
          log.push(`Gasto ${data.numeroGasto} apunta a venta inexistente ${ventaId}`);
        }

        if (!gastosByVentaId.has(ventaId)) gastosByVentaId.set(ventaId, []);
        gastosByVentaId.get(ventaId)!.push({
          id: doc.id,
          tipo: data.tipo,
          monto: data.montoPEN || 0,
          numero: data.numeroGasto || doc.id,
        });
      } else {
        issues.push({
          tipo: "gasto_sin_venta",
          severidad: "media",
          descripcion: `Gasto ${data.numeroGasto || doc.id} (${data.tipo}) no tiene ventaId`,
          ids: [doc.id],
        });
      }
    }

    for (const [ventaId, gastos] of gastosByVentaId.entries()) {
      const comisiones = gastos.filter(g => g.tipo === "comision_ml");
      const envios = gastos.filter(g => g.tipo === "cargo_envio_ml");
      if (comisiones.length > 1) {
        gastosDupVenta++;
        issues.push({
          tipo: "gasto_comision_duplicado",
          severidad: "critica",
          descripcion: `Venta ${ventaId}: ${comisiones.length} gastos comision_ml → ${comisiones.map(g => `${g.numero} S/${g.monto.toFixed(2)}`).join(" | ")}`,
          ids: comisiones.map(g => g.id),
        });
      }
      if (envios.length > 1) {
        gastosDupVenta++;
        issues.push({
          tipo: "gasto_envio_duplicado",
          severidad: "critica",
          descripcion: `Venta ${ventaId}: ${envios.length} gastos cargo_envio_ml → ${envios.map(g => `${g.numero} S/${g.monto.toFixed(2)}`).join(" | ")}`,
          ids: envios.map(g => g.id),
        });
      }
    }
    log.push(`  Gastos ML: ${gastosMLSnap.size}. Huérfanos: ${gastosHuerfanos}. Duplicados: ${gastosDupVenta}`);

    // ── 3. MOVIMIENTOS TESORERÍA HUÉRFANOS ──
    log.push("\n=== 3. Escaneando movimientos tesorería ML huérfanos ===");
    const movsMLSnap = await db.collection("movimientosTesoreria")
      .where("creadoPor", "==", "ml-auto-processor")
      .get();

    let movsHuerfanosVenta = 0;
    let movsHuerfanosGasto = 0;
    const movsByVentaId = new Map<string, Array<{ id: string; tipo: string; monto: number; concepto: string }>>();

    for (const doc of movsMLSnap.docs) {
      const data = doc.data();

      if (data.ventaId) {
        const ventaDoc = await db.collection("ventas").doc(data.ventaId).get();
        if (!ventaDoc.exists) {
          movsHuerfanosVenta++;
          issues.push({
            tipo: "mov_tesoreria_venta_inexistente",
            severidad: "critica",
            descripcion: `Mov ${data.numeroMovimiento || doc.id} (${data.tipo}, S/${(data.monto || 0).toFixed(2)}) → ventaId ${data.ventaId} NO EXISTE`,
            ids: [doc.id],
          });
        }

        if (!movsByVentaId.has(data.ventaId)) movsByVentaId.set(data.ventaId, []);
        movsByVentaId.get(data.ventaId)!.push({
          id: doc.id,
          tipo: data.tipo,
          monto: data.monto || 0,
          concepto: data.concepto || "",
        });
      }

      if (data.gastoId) {
        const gastoDoc = await db.collection("gastos").doc(data.gastoId).get();
        if (!gastoDoc.exists) {
          movsHuerfanosGasto++;
          issues.push({
            tipo: "mov_tesoreria_gasto_inexistente",
            severidad: "alta",
            descripcion: `Mov ${data.numeroMovimiento || doc.id} (${data.tipo}) → gastoId ${data.gastoId} NO EXISTE`,
            ids: [doc.id],
          });
        }
      }
    }

    let dupIngresosCount = 0;
    for (const [ventaId, movs] of movsByVentaId.entries()) {
      const ingresos = movs.filter(m => m.tipo === "ingreso_venta");
      if (ingresos.length > 1) {
        dupIngresosCount++;
        const totalIngresos = ingresos.reduce((s, m) => s + m.monto, 0);
        issues.push({
          tipo: "ingreso_venta_duplicado",
          severidad: "critica",
          descripcion: `Venta ${ventaId}: ${ingresos.length} ingresos (total S/${totalIngresos.toFixed(2)}) → ${ingresos.map(m => `${m.id} S/${m.monto.toFixed(2)}`).join(" | ")}`,
          ids: ingresos.map(m => m.id),
        });
      }
    }
    log.push(`  Movimientos ML: ${movsMLSnap.size}. Venta inexistente: ${movsHuerfanosVenta}. Gasto inexistente: ${movsHuerfanosGasto}. Ingresos duplicados: ${dupIngresosCount}`);

    // ── 4. mlOrderSync INCONSISTENCIAS ──
    log.push("\n=== 4. Escaneando mlOrderSync inconsistencias ===");
    const syncSnap = await db.collection("mlOrderSync").get();

    let stuckProcesando = 0;
    let ventaIdInvalido = 0;

    for (const doc of syncSnap.docs) {
      const data = doc.data();

      if (data.estado === "procesando") {
        const fechaSync = data.fechaSync?.toDate?.() || null;
        const minAgo = fechaSync ? (Date.now() - fechaSync.getTime()) / 60000 : 999;
        if (minAgo > 5) {
          stuckProcesando++;
          issues.push({
            tipo: "sync_stuck_procesando",
            severidad: "alta",
            descripcion: `${doc.id} (ML #${data.mlOrderId}) stuck en "procesando" hace ${Math.round(minAgo)} min`,
            ids: [doc.id],
          });
        }
      }

      if (data.estado === "procesada" && data.ventaId) {
        const ventaDoc = await db.collection("ventas").doc(data.ventaId).get();
        if (!ventaDoc.exists) {
          ventaIdInvalido++;
          issues.push({
            tipo: "sync_venta_inexistente",
            severidad: "alta",
            descripcion: `${doc.id} marcada como procesada → ventaId ${data.ventaId} NO EXISTE`,
            ids: [doc.id],
          });
        }
      }
    }
    log.push(`  mlOrderSync: ${syncSnap.size}. Stuck procesando: ${stuckProcesando}. VentaId inválido: ${ventaIdInvalido}`);

    // ── 5. BALANCE CUENTA MP ──
    log.push("\n=== 5. Verificando balance cuenta MercadoPago ===");
    const cuentasSnap = await db.collection("cuentasCaja")
      .where("nombre", ">=", "MercadoPago")
      .where("nombre", "<=", "MercadoPago\uf8ff")
      .limit(1)
      .get();

    if (!cuentasSnap.empty) {
      const cuentaMP = cuentasSnap.docs[0];
      const saldoRegistrado = cuentaMP.data().saldoActual || 0;

      const allMovsMP = await db.collection("movimientosTesoreria")
        .where("estado", "==", "ejecutado")
        .get();

      let saldoCalculado = 0;
      for (const mov of allMovsMP.docs) {
        const data = mov.data();
        if (data.cuentaDestino === cuentaMP.id) saldoCalculado += data.monto || 0;
        if (data.cuentaOrigen === cuentaMP.id) saldoCalculado -= data.monto || 0;
      }

      const diff = Math.abs(saldoRegistrado - saldoCalculado);
      if (diff > 0.01) {
        issues.push({
          tipo: "balance_mp_descuadrado",
          severidad: "alta",
          descripcion: `Saldo registrado: S/${saldoRegistrado.toFixed(2)} vs Calculado: S/${saldoCalculado.toFixed(2)} (diff: S/${diff.toFixed(2)})`,
          ids: [cuentaMP.id],
        });
        log.push(`Balance MP descuadrado: registrado S/${saldoRegistrado.toFixed(2)} vs calculado S/${saldoCalculado.toFixed(2)} (diff S/${diff.toFixed(2)})`);
      } else {
        log.push(`  Balance MP cuadrado: S/${saldoRegistrado.toFixed(2)}`);
      }
    } else {
      log.push("  No se encontró cuenta MercadoPago");
    }

    const criticas = issues.filter(i => i.severidad === "critica").length;
    const altas = issues.filter(i => i.severidad === "alta").length;
    const medias = issues.filter(i => i.severidad === "media").length;

    log.push("\n=== RESUMEN ===");
    log.push(`Total issues: ${issues.length} (${criticas} críticas, ${altas} altas, ${medias} medias)`);
    if (issues.length === 0) {
      log.push("Sistema limpio — no se encontraron registros fantasma ni inconsistencias");
    }

    return { totalIssues: issues.length, criticas, altas, medias, issues, log };

  } catch (err: any) {
    functions.logger.error("Error en diagnóstico del sistema ML:", err);
    throw new functions.https.HttpsError("internal", `Error en diagnóstico: ${err.message}`);
  }
});

// ============================================================
// FUNCIÓN: Recalcular balance de cuenta MercadoPago
// ============================================================

export const mlrecalcularbalancemp = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (data, context) => {
  await requireAdminRole(context); // SEC-008

  const dryRun = data?.dryRun !== false;

  try {
    const cuentasSnap = await db.collection("cuentasCaja").get();
    let cuentaMP: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    for (const doc of cuentasSnap.docs) {
      const nombre = (doc.data().nombre || "").toLowerCase();
      if (nombre.includes("mercadopago") || nombre.includes("mercado pago")) {
        cuentaMP = doc;
        break;
      }
    }

    if (!cuentaMP) {
      return { success: false, message: "No se encontró cuenta MercadoPago", log: [] };
    }

    const cuentaId = cuentaMP.id;
    const saldoAnterior = cuentaMP.data().saldoActual || 0;
    const log: string[] = [];

    log.push(`Cuenta: ${cuentaMP.data().nombre} (${cuentaId})`);
    log.push(`Saldo registrado: S/ ${saldoAnterior.toFixed(2)}`);

    const allMovs = await db.collection("movimientosTesoreria")
      .where("estado", "==", "ejecutado")
      .get();

    let saldoCalculado = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;
    let countIngresos = 0;
    let countEgresos = 0;

    const porTipo = new Map<string, { count: number; ingreso: number; egreso: number }>();

    const movimientosMP: Array<{
      id: string; tipo: string; concepto: string; monto: number;
      direccion: "ingreso" | "egreso"; ventaId: string | null;
      ventaNumero: string | null; cotizacionId: string | null;
      gastoId: string | null; fecha: string;
    }> = [];

    for (const mov of allMovs.docs) {
      const d = mov.data();
      const isIngreso = d.cuentaDestino === cuentaId;
      const isEgreso = d.cuentaOrigen === cuentaId;

      if (!isIngreso && !isEgreso) continue;

      const monto = d.monto || 0;
      const tipo = d.tipo || "desconocido";
      const fecha = d.fecha?.toDate?.()?.toISOString?.()?.slice(0, 10) || "sin-fecha";

      if (isIngreso) { saldoCalculado += monto; totalIngresos += monto; countIngresos++; }
      if (isEgreso) { saldoCalculado -= monto; totalEgresos += monto; countEgresos++; }

      if (!porTipo.has(tipo)) porTipo.set(tipo, { count: 0, ingreso: 0, egreso: 0 });
      const t = porTipo.get(tipo)!;
      t.count++;
      if (isIngreso) t.ingreso += monto;
      if (isEgreso) t.egreso += monto;

      movimientosMP.push({
        id: mov.id, tipo, concepto: d.concepto || "", monto,
        direccion: isIngreso ? "ingreso" : "egreso",
        ventaId: d.ventaId || null, ventaNumero: d.ventaNumero || null,
        cotizacionId: d.cotizacionId || null, gastoId: d.gastoId || null, fecha,
      });
    }

    const diferencia = saldoAnterior - saldoCalculado;

    log.push(`\nSaldo calculado: S/ ${saldoCalculado.toFixed(2)}`);
    log.push(`Diferencia: S/ ${diferencia.toFixed(2)} (${diferencia > 0 ? "exceso" : "faltante"} en saldo registrado)`);
    log.push(`\n--- Resumen movimientos cuenta MP ---`);
    log.push(`Ingresos: ${countIngresos} movimientos → S/ ${totalIngresos.toFixed(2)}`);
    log.push(`Egresos: ${countEgresos} movimientos → S/ ${totalEgresos.toFixed(2)}`);
    log.push(`Neto: S/ ${(totalIngresos - totalEgresos).toFixed(2)}`);

    log.push(`\n--- Desglose por tipo ---`);
    for (const [tipo, stats] of [...porTipo.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const parts = [];
      if (stats.ingreso > 0) parts.push(`+S/ ${stats.ingreso.toFixed(2)}`);
      if (stats.egreso > 0) parts.push(`-S/ ${stats.egreso.toFixed(2)}`);
      log.push(`  ${tipo} (${stats.count}): ${parts.join(", ")}`);
    }

    // Análisis forense
    log.push(`\n--- Análisis forense ---`);

    const gastosMLSnap2 = await db.collection("gastos")
      .where("tipo", "in", ["comision_ml", "cargo_envio_ml"])
      .get();

    let gastosConPagoSinMov = 0;
    let montoGastosSinMov = 0;
    for (const gDoc of gastosMLSnap2.docs) {
      const gData = gDoc.data();
      const pagos = Array.isArray(gData.pagos) ? gData.pagos : [];
      for (const pago of pagos) {
        if (pago.cuentaOrigenId === cuentaId) {
          const movParaGasto = movimientosMP.find(m => m.gastoId === gDoc.id && m.direccion === "egreso");
          if (!movParaGasto) {
            gastosConPagoSinMov++;
            montoGastosSinMov += pago.montoPEN || pago.montoOriginal || 0;
            log.push(`  Gasto ${gData.numeroGasto} (${gData.tipo}, S/ ${(pago.montoPEN || pago.montoOriginal || 0).toFixed(2)}) descuenta de MP pero NO tiene movimiento de tesorería`);
          }
        }
      }
    }
    if (gastosConPagoSinMov > 0) {
      log.push(`  → ${gastosConPagoSinMov} gasto(s) descuentan S/ ${montoGastosSinMov.toFixed(2)} de MP sin movimiento de tesorería`);
    }

    const ventasMLSnap2 = await db.collection("ventas")
      .where("canalNombre", "==", "Mercado Libre")
      .where("estadoPago", "==", "pagado")
      .get();

    const allIngresosSnap = await db.collection("movimientosTesoreria")
      .where("estado", "==", "ejecutado")
      .get();

    const todosLosIngresos = allIngresosSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((m: any) => m.tipo === "ingreso_venta" || m.tipo === "ingreso_anticipo");

    let ventasSinIngreso = 0;
    let montoVentasSinIngreso = 0;
    let ventasConAdelanto = 0;
    let ventasCanalIncorrecto = 0;
    const ventasCanalIncorrectoIds: string[] = [];

    for (const vDoc of ventasMLSnap2.docs) {
      const vData = vDoc.data();
      const cotOrigenId = vData.cotizacionOrigenId || null;

      const movIngresoMP = movimientosMP.find(m => {
        if (m.direccion !== "ingreso") return false;
        if (m.ventaId === vDoc.id) return true;
        if (cotOrigenId && m.ventaId === cotOrigenId) return true;
        if (cotOrigenId && m.cotizacionId === cotOrigenId) return true;
        return false;
      });

      if (movIngresoMP) {
        if (movIngresoMP.tipo === "ingreso_anticipo") ventasConAdelanto++;
        continue;
      }

      const movIngresoOtraCuenta = todosLosIngresos.find((m: any) => {
        if (m.ventaId === vDoc.id) return true;
        if (cotOrigenId && m.ventaId === cotOrigenId) return true;
        if (cotOrigenId && m.cotizacionId === cotOrigenId) return true;
        return false;
      });

      if (movIngresoOtraCuenta) {
        ventasCanalIncorrecto++;
        ventasCanalIncorrectoIds.push(vDoc.id);
        log.push(`  Venta ${vData.numeroVenta} (S/ ${(vData.totalPEN || 0).toFixed(2)}) etiquetada como ML pero pagada a otra cuenta`);
      } else {
        ventasSinIngreso++;
        montoVentasSinIngreso += vData.totalPEN || 0;
        log.push(`  Venta ${vData.numeroVenta} (S/ ${(vData.totalPEN || 0).toFixed(2)}) pagada pero NO tiene movimiento ingreso`);
      }
    }

    if (ventasSinIngreso > 0) {
      log.push(`  → ${ventasSinIngreso} venta(s) pagadas (S/ ${montoVentasSinIngreso.toFixed(2)}) sin ingreso en tesorería`);
    }
    if (ventasCanalIncorrecto > 0) {
      log.push(`  → ${ventasCanalIncorrecto} venta(s) con canal "Mercado Libre" incorrecto`);
    }

    if (!dryRun && ventasCanalIncorrectoIds.length > 0) {
      for (const ventaId of ventasCanalIncorrectoIds) {
        try {
          await db.collection("ventas").doc(ventaId).update({
            canalNombre: "Venta Directa",
            canal: "directo",
          });
          log.push(`  ${ventaId}: canal corregido "Mercado Libre" → "Venta Directa"`);
        } catch (err: any) {
          log.push(`  Error corrigiendo ${ventaId}: ${err.message}`);
        }
      }
    } else if (dryRun && ventasCanalIncorrectoIds.length > 0) {
      log.push(`  [DRY RUN] Corregería ${ventasCanalIncorrectoIds.length} venta(s)`);
    }

    let movsOrfanos = 0;
    let montoOrfanos = 0;
    for (const m of movimientosMP) {
      if (m.ventaId) {
        const vDoc = await db.collection("ventas").doc(m.ventaId).get();
        if (!vDoc.exists) {
          movsOrfanos++;
          montoOrfanos += m.monto;
          log.push(`  Mov ${m.id} (${m.direccion} S/ ${m.monto.toFixed(2)}) → ventaId ${m.ventaId} NO EXISTE`);
        }
      }
    }
    if (movsOrfanos > 0) {
      log.push(`  → ${movsOrfanos} movimiento(s) huérfano(s) (S/ ${montoOrfanos.toFixed(2)})`);
    }

    const ajustesManuales: Array<{ id: string; concepto: string; monto: number; direccion: string; fecha: string }> = [];
    for (const m of movimientosMP) {
      const conceptoLower = m.concepto.toLowerCase();
      if (conceptoLower.includes("ajuste") || conceptoLower.includes("correc") || conceptoLower.includes("manual")) {
        ajustesManuales.push(m);
      }
    }

    if (Math.abs(diferencia) < 0.01) {
      log.push(`\nBalance ya está correcto.`);
      return { success: true, message: "Balance ya está correcto", saldo: saldoAnterior, diferencia: 0, log };
    }

    if (!dryRun) {
      await db.collection("cuentasCaja").doc(cuentaId).update({
        saldoActual: Math.round(saldoCalculado * 100) / 100,
      });
      log.push(`\nBalance corregido: S/ ${saldoAnterior.toFixed(2)} → S/ ${saldoCalculado.toFixed(2)}`);
      functions.logger.info(
        `Balance MP recalculado: S/${saldoAnterior.toFixed(2)} → S/${saldoCalculado.toFixed(2)} (diff: S/${diferencia.toFixed(2)})`
      );
    } else {
      log.push(`\n[DRY RUN] Ajustaría balance de S/ ${saldoAnterior.toFixed(2)} → S/ ${saldoCalculado.toFixed(2)}`);
    }

    return {
      success: true, dryRun,
      message: dryRun
        ? `[DRY RUN] Ajustaría balance de S/${saldoAnterior.toFixed(2)} → S/${saldoCalculado.toFixed(2)} (diff: S/${diferencia.toFixed(2)})`
        : `Balance corregido: S/${saldoAnterior.toFixed(2)} → S/${saldoCalculado.toFixed(2)} (diff: S/${diferencia.toFixed(2)})`,
      saldoAnterior,
      saldoNuevo: Math.round(saldoCalculado * 100) / 100,
      diferencia: Math.round(diferencia * 100) / 100,
      movimientos: { ingresos: countIngresos, egresos: countEgresos, total: allMovs.size },
      log,
    };

  } catch (err: any) {
    functions.logger.error("Error recalculando balance MP:", err);
    throw new functions.https.HttpsError("internal", `Error: ${err.message}`);
  }
});

// ============================================================
// FUNCIÓN: Match suggestions
// ============================================================

export const mlmatchsuggestions = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  }

  const normalize = (s: string | null | undefined): string =>
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const similarity = (a: string, b: string): number => {
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 1;
    if (na.length < 2 || nb.length < 2) return 0;
    const bigrams = (str: string) => {
      const set = new Map<string, number>();
      for (let i = 0; i < str.length - 1; i++) {
        const bi = str.slice(i, i + 2);
        set.set(bi, (set.get(bi) || 0) + 1);
      }
      return set;
    };
    const aBi = bigrams(na);
    const bBi = bigrams(nb);
    let intersection = 0;
    for (const [bi, count] of aBi) {
      intersection += Math.min(count, bBi.get(bi) || 0);
    }
    return (2 * intersection) / (na.length - 1 + nb.length - 1);
  };

  try {
    const pendientesSnap = await db.collection("mlOrderSync").where("estado", "==", "pendiente").get();
    const pendientesSinVenta = pendientesSnap.docs.filter(d => !d.data().ventaId);

    const ventasSnap = await db.collection("ventas").where("canalNombre", "==", "Mercado Libre").get();

    const procesadasSnap = await db.collection("mlOrderSync").where("estado", "==", "procesada").get();
    const ventaIdsVinculadas = new Set<string>();
    for (const d of procesadasSnap.docs) {
      const vid = d.data().ventaId;
      if (vid) ventaIdsVinculadas.add(vid);
    }
    for (const d of pendientesSnap.docs) {
      const vid = d.data().ventaId;
      if (vid) ventaIdsVinculadas.add(vid);
    }

    const ventasSinVincular = ventasSnap.docs.filter(d => {
      if (ventaIdsVinculadas.has(d.id)) return false;
      const vData = d.data();
      const mlId = vData.mercadoLibreId || vData.mlOrderId;
      if (mlId) {
        for (const s of procesadasSnap.docs) {
          if (String(s.data().mlOrderId) === String(mlId)) return false;
        }
      }
      return true;
    });

    const suggestions: Array<{
      syncId: string; mlOrderId: number; syncBuyerName: string; syncBuyerDni: string;
      syncTotal: number; syncFecha: string; syncProductos: string; syncMetodoEnvio: string;
      matches: Array<{
        ventaId: string; numeroVenta: string; nombreCliente: string; dniRuc: string;
        totalPEN: number; fechaCreacion: string; productos: string; score: number; matchDetails: string[];
      }>;
    }> = [];

    for (const syncDoc of pendientesSinVenta) {
      const sync = syncDoc.data();
      const syncName = sync.mlBuyerName || sync.buyerName || "";
      const syncDni = (sync.buyerDni || "").replace(/\D/g, "");
      const syncTotal = sync.totalML || 0;
      const syncFecha = sync.fechaOrdenML ? sync.fechaOrdenML.toDate() : null;
      const syncProds = (sync.productos || []).map((p: any) => p.mlTitle || p.productoNombre || "").join(", ");
      const syncMetodo = sync.metodoEnvio || "?";
      const syncCostoEnvio = sync.costoEnvioCliente || 0;

      const matchCandidates: Array<{
        ventaId: string; numeroVenta: string; nombreCliente: string; dniRuc: string;
        totalPEN: number; fechaCreacion: string; productos: string; score: number; matchDetails: string[];
      }> = [];

      for (const ventaDoc of ventasSinVincular) {
        const v = ventaDoc.data();
        let score = 0;
        const details: string[] = [];

        const ventaDni = (v.dniRuc || "").replace(/\D/g, "");
        if (syncDni && ventaDni && syncDni === ventaDni) {
          score += 50;
          details.push(`DNI exacto (${syncDni})`);
        }

        const nameSim = similarity(syncName, v.nombreCliente || "");
        if (nameSim >= 0.8) {
          score += 30;
          details.push(`Nombre ${Math.round(nameSim * 100)}%`);
        } else if (nameSim >= 0.5) {
          score += 15;
          details.push(`Nombre parcial ${Math.round(nameSim * 100)}%`);
        }

        const ventaTotal = v.totalPEN || 0;
        const ventaSubtotal = v.subtotalPEN || ventaTotal;
        if (syncTotal > 0) {
          if (Math.abs(syncTotal - ventaSubtotal) < 0.50) {
            score += 25;
            details.push(`Monto exacto S/${syncTotal.toFixed(2)}`);
          } else if (Math.abs(syncTotal + syncCostoEnvio - ventaTotal) < 0.50) {
            score += 20;
            details.push(`Monto+envío ≈ total`);
          } else if (Math.abs(syncTotal - ventaTotal) < 0.50) {
            score += 20;
            details.push(`Total ≈ ${ventaTotal.toFixed(2)}`);
          } else if (Math.abs(syncTotal - ventaTotal) < 5) {
            score += 10;
            details.push(`Monto cercano (diff ${Math.abs(syncTotal - ventaTotal).toFixed(2)})`);
          }
        }

        if (syncFecha) {
          const ventaFecha = v.fechaCreacion ? v.fechaCreacion.toDate() : null;
          if (ventaFecha) {
            const diffDays = Math.abs(syncFecha.getTime() - ventaFecha.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays <= 1) { score += 10; details.push("Fecha ≤1 día"); }
            else if (diffDays <= 3) { score += 5; details.push("Fecha ≤3 días"); }
            else if (diffDays <= 7) { score += 2; details.push("Fecha ≤7 días"); }
          }
        }

        if (score >= 15) {
          const ventaProds = (v.productos || []).map((p: any) => p.nombreComercial || p.sku || "").join(", ");
          const ventaFechaStr = v.fechaCreacion ? v.fechaCreacion.toDate().toISOString().slice(0, 10) : "?";
          matchCandidates.push({
            ventaId: ventaDoc.id, numeroVenta: v.numeroVenta || ventaDoc.id,
            nombreCliente: v.nombreCliente || "", dniRuc: v.dniRuc || "",
            totalPEN: ventaTotal, fechaCreacion: ventaFechaStr,
            productos: ventaProds, score, matchDetails: details,
          });
        }
      }

      matchCandidates.sort((a, b) => b.score - a.score);

      suggestions.push({
        syncId: syncDoc.id, mlOrderId: sync.mlOrderId || 0,
        syncBuyerName: syncName, syncBuyerDni: syncDni,
        syncTotal, syncFecha: syncFecha ? syncFecha.toISOString().slice(0, 10) : "?",
        syncProductos: syncProds, syncMetodoEnvio: syncMetodo,
        matches: matchCandidates.slice(0, 3),
      });
    }

    suggestions.sort((a, b) => {
      const aScore = a.matches[0]?.score || 0;
      const bScore = b.matches[0]?.score || 0;
      return bScore - aScore;
    });

    return {
      success: true,
      totalSyncPendientes: pendientesSinVenta.length,
      totalVentasSinVincular: ventasSinVincular.length,
      suggestions,
    };
  } catch (err: any) {
    functions.logger.error("Error en mlmatchsuggestions:", err);
    throw new functions.https.HttpsError("internal", `Error: ${err.message}`);
  }
});

// ============================================================
// FUNCIÓN: Confirmar vinculación manual ML ↔ Venta
// ============================================================

export const mlconfirmmatch = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "No autenticado");
  }

  const { matches } = data as { matches: Array<{ syncId: string; ventaId: string }> };
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere un array de matches [{syncId, ventaId}]");
  }

  const results: Array<{ syncId: string; ventaId: string; status: string }> = [];

  for (const { syncId, ventaId } of matches) {
    try {
      const syncRef = db.collection("mlOrderSync").doc(syncId);
      const ventaRef = db.collection("ventas").doc(ventaId);

      const [syncDoc, ventaDoc] = await Promise.all([syncRef.get(), ventaRef.get()]);
      if (!syncDoc.exists) {
        results.push({ syncId, ventaId, status: "error: mlOrderSync no encontrado" });
        continue;
      }
      if (!ventaDoc.exists) {
        results.push({ syncId, ventaId, status: "error: venta no encontrada" });
        continue;
      }

      const syncData = syncDoc.data()!;
      const mlOrderId = syncData.mlOrderId;

      await syncRef.update({
        ventaId,
        vinculadoManualmente: true,
        fechaVinculacion: admin.firestore.Timestamp.now(),
        vinculadoPor: context.auth!.uid,
      });

      const ventaData = ventaDoc.data()!;
      if (!ventaData.mercadoLibreId && mlOrderId) {
        await ventaRef.update({ mercadoLibreId: String(mlOrderId) });
      }

      results.push({ syncId, ventaId, status: "vinculado" });
      functions.logger.info(`ML Match: mlOrderSync ${syncId} (ML#${mlOrderId}) → venta ${ventaId}`);
    } catch (err: any) {
      results.push({ syncId, ventaId, status: `error: ${err.message}` });
    }
  }

  const exitosos = results.filter(r => r.status === "vinculado").length;
  return { success: true, total: matches.length, vinculados: exitosos, errores: matches.length - exitosos, results };
});

// ============================================================
// FUNCIÓN: Diagnóstico de inconsistencias financieras ML
// ============================================================

export const mldiaginconsistencias = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (_data, context) => {
  await requireAdminRole(context); // SEC-008

  const cuentaMPQ = await db.collection("cuentasCaja")
    .where("metodoPagoAsociado", "==", "mercado_pago")
    .where("activa", "==", true).limit(1).get();
  if (cuentaMPQ.empty) {
    return { success: false, message: "No se encontró cuenta MercadoPago activa" };
  }
  const cuentaMPId = cuentaMPQ.docs[0].id;

  const syncProc = await db.collection("mlOrderSync").where("estado", "==", "procesada").get();
  const syncPend = await db.collection("mlOrderSync").where("estado", "==", "pendiente").get();
  const syncByVentaId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const allSyncDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  for (const doc of syncProc.docs) {
    if (doc.data().ventaId) syncByVentaId.set(doc.data().ventaId, doc);
    allSyncDocs.push(doc);
  }
  for (const doc of syncPend.docs) {
    if (doc.data().ventaId) {
      syncByVentaId.set(doc.data().ventaId, doc);
      allSyncDocs.push(doc);
    }
  }

  const ventasSnap = await db.collection("ventas").where("canalNombre", "==", "Mercado Libre").get();
  const ventasMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const doc of ventasSnap.docs) ventasMap.set(doc.id, doc);

  const movsSnap = await db.collection("movimientosTesoreria").where("estado", "==", "ejecutado").get();
  const movsByVenta = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  for (const doc of movsSnap.docs) {
    const vid = doc.data().ventaId;
    if (vid) {
      if (!movsByVenta.has(vid)) movsByVenta.set(vid, []);
      movsByVenta.get(vid)!.push(doc);
    }
  }

  const huerfanos: Array<{
    movId: string; monto: number; tipo: string; concepto: string; fecha: string; metodo: string;
  }> = [];
  for (const doc of movsSnap.docs) {
    const d = doc.data();
    if (d.ventaId) continue;
    if (d.cuentaDestino !== cuentaMPId) continue;
    if (d.tipo !== "ingreso_venta" && d.tipo !== "ingreso_anticipo") continue;
    huerfanos.push({
      movId: doc.id, monto: d.monto || 0, tipo: d.tipo,
      concepto: d.concepto || d.descripcion || "",
      fecha: d.fecha?.toDate?.()?.toISOString?.() || "", metodo: d.metodo || "",
    });
  }

  const inconsistencias: any[] = [];

  for (const syncDoc of allSyncDocs) {
    const sync = syncDoc.data() as MLOrderSync;
    const ventaId = sync.ventaId;
    if (!ventaId) continue;
    const ventaDoc = ventasMap.get(ventaId);
    if (!ventaDoc) continue;
    const venta = ventaDoc.data();
    const numVenta = venta.numeroVenta || ventaId;

    const metodoEnvio = sync.metodoEnvio || venta.metodoEnvio || null;
    const costoEnvioCliente = sync.costoEnvioCliente || 0;
    const cargoEnvioML = sync.cargoEnvioML || 0;
    const subtotalPEN = sync.totalML || venta.subtotalPEN || 0;

    const totalPENCorrecto = metodoEnvio === "flex" ? subtotalPEN + costoEnvioCliente : subtotalPEN;

    const ventaMovs = movsByVenta.get(ventaId) || [];
    const activeMovs = ventaMovs.filter(m => m.data().estado !== "anulado");
    const ingresoMovs = activeMovs.filter(m => m.data().cuentaDestino === cuentaMPId);
    const ventaFechaMs = (sync.fechaOrdenML || venta.fechaCreacion)?.toDate?.()?.getTime?.() || 0;

    if (ingresoMovs.length === 0) {
      const candidatos = huerfanos.map(orph => {
        let score = 0;
        const detail: string[] = [];

        if (Math.abs(orph.monto - totalPENCorrecto) < 0.02) { score += 50; detail.push("monto exacto"); }
        else if (Math.abs(orph.monto - subtotalPEN) < 0.02) { score += 40; detail.push("monto=subtotal"); }
        else if (totalPENCorrecto > 0 && Math.abs(orph.monto - totalPENCorrecto) / totalPENCorrecto < 0.1) { score += 15; detail.push("monto ±10%"); }

        const movFechaMs = new Date(orph.fecha).getTime() || 0;
        const daysDiff = Math.abs(ventaFechaMs - movFechaMs) / (86400000);
        if (daysDiff < 2) { score += 30; detail.push("fecha ±2d"); }
        else if (daysDiff < 7) { score += 20; detail.push("fecha ±7d"); }
        else if (daysDiff < 30) { score += 10; detail.push("fecha ±30d"); }

        const cLower = orph.concepto.toLowerCase();
        const nLower = numVenta.toLowerCase();
        if (nLower && cLower.includes(nLower)) { score += 40; detail.push("concepto=numVenta"); }
        else if (cLower.includes("ml") || cLower.includes("mercado")) { score += 5; detail.push("concepto~ML"); }

        return { ...orph, score, matchDetail: detail.join(", ") };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

      inconsistencias.push({
        tipo: "sin_movimientos", ventaId, ventaNumero: numVenta,
        clienteNombre: venta.nombreCliente || "?", totalPENCorrecto, subtotalPEN,
        metodoEnvio: metodoEnvio || "?", comisionML: sync.comisionML || 0, cargoEnvioML,
        fechaVenta: ventaFechaMs ? new Date(ventaFechaMs).toISOString() : "", candidatos,
      });
    } else {
      const ingresoTotal = ingresoMovs.reduce((s, m) => s + (m.data().monto || 0), 0);
      if (Math.abs(ingresoTotal - totalPENCorrecto) > 1) {
        inconsistencias.push({
          tipo: "monto_incorrecto", ventaId, ventaNumero: numVenta,
          clienteNombre: venta.nombreCliente || "?", totalPENCorrecto, subtotalPEN,
          metodoEnvio: metodoEnvio || "?", comisionML: sync.comisionML || 0, cargoEnvioML,
          fechaVenta: ventaFechaMs ? new Date(ventaFechaMs).toISOString() : "",
          movimientoActual: {
            movId: ingresoMovs[0].id, monto: ingresoTotal,
            tipo: ingresoMovs[0].data().tipo, concepto: ingresoMovs[0].data().concepto || "",
          },
          diferencia: totalPENCorrecto - ingresoTotal,
          candidatos: [],
        });
      }
    }
  }

  inconsistencias.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === "sin_movimientos" ? -1 : 1;
    return (a.ventaNumero || "").localeCompare(b.ventaNumero || "");
  });

  return {
    success: true,
    totalInconsistencias: inconsistencias.length,
    totalHuerfanos: huerfanos.length,
    inconsistencias,
    huerfanos: huerfanos.sort((a, b) => b.monto - a.monto),
  };
});

// ============================================================
// FUNCIÓN: Resolver inconsistencias
// ============================================================

export const mlresolverinconsistencias = functions.https.onCall(async (data, context) => {
  await requireAdminRole(context); // SEC-008

  const acciones: Array<{
    movimientoId?: string; ventaId?: string; ventaNumero?: string;
    accion: "vincular" | "anular" | "patch_sync";
    syncId?: string; patchData?: Record<string, any>;
  }> = data?.acciones || [];

  if (acciones.length === 0) {
    return { success: false, message: "No se proporcionaron acciones" };
  }

  const results: Array<{ id: string; ok: boolean; accion?: string; error?: string }> = [];

  for (const acc of acciones) {
    try {
      if (acc.accion === "patch_sync" && acc.syncId && acc.patchData) {
        const syncRef = db.collection("mlOrderSync").doc(acc.syncId);
        const syncDoc = await syncRef.get();
        if (!syncDoc.exists) {
          results.push({ id: acc.syncId, ok: false, error: "mlOrderSync no existe" });
          continue;
        }
        const allowed = ["metodoEnvio", "costoEnvioCliente", "cargoEnvioML", "comisionML", "totalML"];
        const safePatch: Record<string, any> = {};
        for (const [k, v] of Object.entries(acc.patchData)) {
          if (allowed.includes(k)) safePatch[k] = v;
        }
        if (Object.keys(safePatch).length === 0) {
          results.push({ id: acc.syncId, ok: false, error: "No hay campos válidos para parchar" });
          continue;
        }
        safePatch.parchadoPor = "ml-resolver-manual";
        safePatch.fechaParche = admin.firestore.Timestamp.now();
        await syncRef.update(safePatch);
        results.push({ id: acc.syncId, ok: true, accion: `patch_sync: ${Object.keys(safePatch).join(",")}` });
        continue;
      }

      if (!acc.movimientoId) {
        results.push({ id: "?", ok: false, error: "Falta movimientoId" });
        continue;
      }

      const movRef = db.collection("movimientosTesoreria").doc(acc.movimientoId);
      const movDoc = await movRef.get();
      if (!movDoc.exists) {
        results.push({ id: acc.movimientoId, ok: false, error: "Movimiento no existe" });
        continue;
      }

      if (acc.accion === "vincular" && acc.ventaId) {
        await movRef.update({
          ventaId: acc.ventaId,
          ventaNumero: acc.ventaNumero || null,
          vinculadoPor: "ml-resolver-manual",
          fechaVinculacion: admin.firestore.Timestamp.now(),
        });
        results.push({ id: acc.movimientoId, ok: true, accion: "vinculado" });
      } else if (acc.accion === "anular") {
        await movRef.update({
          estado: "anulado",
          anuladoPor: "ml-resolver-manual",
          fechaAnulacion: admin.firestore.Timestamp.now(),
        });
        results.push({ id: acc.movimientoId, ok: true, accion: "anulado" });
      } else {
        results.push({ id: acc.movimientoId, ok: false, error: "Acción inválida o falta ventaId" });
      }
    } catch (err: any) {
      results.push({ id: acc.movimientoId || acc.syncId || "?", ok: false, error: err.message });
    }
  }

  return {
    success: true,
    total: acciones.length,
    exitosos: results.filter(r => r.ok).length,
    errores: results.filter(r => !r.ok).length,
    results,
  };
});
