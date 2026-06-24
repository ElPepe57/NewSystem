/**
 * Verificación de la CF registrarMovimientoCash contra el emulador (F3.5 Fase A · saldo blindaje).
 * Ejerce el core REAL (registrarMovimientoCashCore). Corre vía `npm run test:egresos`.
 *
 * Cubre ingresos (suman saldo), conversiones/transferencias (origen resta + destino suma) y egresos sin-ref.
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-rules";

const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();
const { registrarMovimientoCashCore, anularMovimientoCashCore } = require("../lib/egresos/registrarMovimientoCash.js");

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  ✅", name); }
  else { fail++; console.error("  ❌", name); }
}
async function expectThrow(name, fn, matcher) {
  try { await fn(); fail++; console.error("  ❌", name, "(no lanzó)"); }
  catch (e) {
    const tag = `${e.code || ""} ${e.message || ""}`.toLowerCase();
    if (!matcher || tag.includes(matcher.toLowerCase())) { pass++; console.log("  ✅", name, "→", e.code || e.message); }
    else { fail++; console.error("  ❌", name, "lanzó algo inesperado →", tag); }
  }
}

const seedProd = (id, over) => db.collection("productosFinancieros").doc(id).set({ moneda: "USD", esBiMoneda: false, saldoActual: 10000, ...over });
const saldo = async (id) => (await db.collection("productosFinancieros").doc(id).get()).data().saldoActual;
const base = (over) => ({ categoria: "ingreso_venta", moneda: "USD", monto: 1000, tipoCambio: 3.7, concepto: "mov", fechaMs: 1700000000000, ...over });

async function main() {
  console.log("\n=== F3.5 Fase A · registrarMovimientoCash ===");

  // INGRESO · suma al saldo del producto destino
  await seedProd("caja-in");
  const r1 = await registrarMovimientoCashCore(db, base({ categoria: "ingreso_venta", productoDestinoId: "caja-in", monto: 2000 }), "fin");
  ok("ingreso → crea movimiento", !!r1.movimientoId);
  ok("ingreso suma al saldo destino (10000→12000)", (await saldo("caja-in")) === 12000);

  // EGRESO sin-ref · resta del saldo del producto origen
  await seedProd("caja-out");
  const r2 = await registrarMovimientoCashCore(db, base({ categoria: "reembolso_cliente", productoOrigenId: "caja-out", monto: 500 }), "fin");
  ok("egreso sin-ref ≤$1k → crea movimiento (directo)", !!r2.movimientoId);
  ok("egreso resta del saldo origen (10000→9500)", (await saldo("caja-out")) === 9500);

  // TRANSFERENCIA interna · origen resta + destino suma (net-zero)
  await seedProd("caja-a", { saldoActual: 5000 });
  await seedProd("caja-b", { saldoActual: 5000 });
  await registrarMovimientoCashCore(db, base({ categoria: "transferencia_interna", productoOrigenId: "caja-a", productoDestinoId: "caja-b", monto: 1000 }), "fin");
  ok("transfer: origen resta (5000→4000)", (await saldo("caja-a")) === 4000);
  ok("transfer: destino suma (5000→6000)", (await saldo("caja-b")) === 6000);

  // BI-MONEDA · ingreso USD muta saldoUSD
  await db.collection("productosFinancieros").doc("bi").set({ esBiMoneda: true, saldoUSD: 3000, saldoPEN: 9000 });
  await registrarMovimientoCashCore(db, base({ categoria: "ingreso_venta", productoDestinoId: "bi", moneda: "USD", monto: 1000 }), "fin");
  const bi = (await db.collection("productosFinancieros").doc("bi").get()).data();
  ok("bi-moneda: ingreso USD suma saldoUSD (3000→4000), saldoPEN intacto", bi.saldoUSD === 4000 && bi.saldoPEN === 9000);

  // MONO mismatch de moneda → DENY
  await seedProd("caja-pen", { moneda: "PEN" });
  await expectThrow("mono · moneda del movimiento ≠ producto → DENY", () => registrarMovimientoCashCore(db, base({ categoria: "ingreso_venta", productoDestinoId: "caja-pen", moneda: "USD" }), "fin"), "no coincide");

  // IDEMPOTENCIA · misma key + mismo par → no re-aplica
  await seedProd("caja-idem");
  const ri1 = await registrarMovimientoCashCore(db, base({ categoria: "ingreso_venta", productoDestinoId: "caja-idem", monto: 500, idempotencyKey: "k-mc" }), "fin");
  const sIdem = await saldo("caja-idem");
  const ri2 = await registrarMovimientoCashCore(db, base({ categoria: "ingreso_venta", productoDestinoId: "caja-idem", monto: 500, idempotencyKey: "k-mc" }), "fin");
  ok("idempotencia: misma key+par → mismo id, idempotente", ri1.movimientoId === ri2.movimientoId && ri2.idempotente === true);
  ok("idempotencia: saldo NO se aplica dos veces", (await saldo("caja-idem")) === sIdem);

  // sin producto → DENY
  await expectThrow("sin producto origen ni destino → DENY", () => registrarMovimientoCashCore(db, base({ categoria: "ingreso_venta" }), "fin"), "producto");

  // ANULAR · revierte el saldo (origen recibe · destino devuelve) + marca anulado · idempotente
  await seedProd("caja-anul");
  const ra = await registrarMovimientoCashCore(db, base({ categoria: "reembolso_cliente", productoOrigenId: "caja-anul", monto: 500 }), "fin");
  ok("egreso para anular resta (10000→9500)", (await saldo("caja-anul")) === 9500);
  await anularMovimientoCashCore(db, { movimientoId: ra.movimientoId, motivo: "error de carga" }, "fin");
  ok("anular REVIERTE el saldo del origen (9500→10000)", (await saldo("caja-anul")) === 10000);
  ok("el movimiento quedó estado='anulado'", (await db.collection("movimientosFinancieros").doc(ra.movimientoId).get()).data().estado === "anulado");
  const ra2 = await anularMovimientoCashCore(db, { movimientoId: ra.movimientoId, motivo: "otra vez" }, "fin");
  ok("anular idempotente (ya anulado) · saldo NO cambia", ra2.idempotente === true && (await saldo("caja-anul")) === 10000);
  await expectThrow("anular sin motivo → DENY", () => anularMovimientoCashCore(db, { movimientoId: ra.movimientoId, motivo: "" }, "fin"), "motivo");

  // A.2 · gate de reembolso_cliente / ajuste_negativo >$1k (referenciado al doc padre)
  console.log("\n=== A.2 · gate de reembolso/ajuste >$1k ===");
  await seedProd("caja-a2");
  // reembolso >$1k SIN devolución aprobada → bloqueado
  await db.collection("devoluciones").doc("dev-pend").set({ autorizacion: { estado: "pendiente", firmas: [] } });
  await expectThrow("reembolso >$1k · devolución NO aprobada → bloqueado", () => registrarMovimientoCashCore(db, base({ categoria: "reembolso_cliente", productoOrigenId: "caja-a2", monto: 2000, refDocumentoTipo: "devolucion", refDocumentoId: "dev-pend" }), "fin"), "no está autorizado");
  ok("saldo NO cambió tras el bloqueo", (await saldo("caja-a2")) === 10000);
  // reembolso >$1k CON devolución aprobada → desembolsa
  await db.collection("devoluciones").doc("dev-ok").set({ autorizacion: { estado: "aprobado", firmas: [] } });
  const rgate1 = await registrarMovimientoCashCore(db, base({ categoria: "reembolso_cliente", productoOrigenId: "caja-a2", monto: 2000, refDocumentoTipo: "devolucion", refDocumentoId: "dev-ok" }), "fin");
  ok("reembolso >$1k · devolución APROBADA → desembolsa", !!rgate1.movimientoId && (await saldo("caja-a2")) === 8000);
  // reembolso ≤$1k → directo (sin gate)
  await seedProd("caja-a2b");
  const rgate2 = await registrarMovimientoCashCore(db, base({ categoria: "reembolso_cliente", productoOrigenId: "caja-a2b", monto: 500, refDocumentoTipo: "devolucion", refDocumentoId: "dev-pend" }), "fin");
  ok("reembolso ≤$1k → directo (sin firma)", !!rgate2.movimientoId);
  // reembolso >$1k SIN ref → fail-closed
  await expectThrow("reembolso >$1k sin doc de autorización → fail-closed", () => registrarMovimientoCashCore(db, base({ categoria: "reembolso_cliente", productoOrigenId: "caja-a2", monto: 2000 }), "fin"), "sin doc de autorización");
  // ingreso/otra categoría >$1k → NO se gatea
  await seedProd("caja-a2c");
  const rgate3 = await registrarMovimientoCashCore(db, base({ categoria: "ingreso_venta", productoDestinoId: "caja-a2c", monto: 5000 }), "fin");
  ok("ingreso >$1k → NO se gatea (no es egreso sin-ref)", !!rgate3.movimientoId);
  // ajuste_negativo >$1k · standalone · sin aprobar → bloqueado · aprobado → desembolsa
  await seedProd("caja-aju");
  await db.collection("ajustesConciliacion").doc("aju-pend").set({ autorizacion: { estado: "pendiente", firmas: [] } });
  await expectThrow("ajuste_negativo >$1k · NO aprobado → bloqueado", () => registrarMovimientoCashCore(db, base({ categoria: "ajuste_negativo", productoOrigenId: "caja-aju", monto: 3000, refDocumentoTipo: "ajuste", refDocumentoId: "aju-pend" }), "fin"), "no está autorizado");
  await db.collection("ajustesConciliacion").doc("aju-ok").set({ autorizacion: { estado: "aprobado", firmas: [] } });
  const rgate4 = await registrarMovimientoCashCore(db, base({ categoria: "ajuste_negativo", productoOrigenId: "caja-aju", monto: 3000, refDocumentoTipo: "ajuste", refDocumentoId: "aju-ok" }), "fin");
  ok("ajuste_negativo >$1k · APROBADO → desembolsa", !!rgate4.movimientoId && (await saldo("caja-aju")) === 7000);

  console.log(`\n=== RESULTADO F3.5-mov-cash: ${pass} pass · ${fail} fail ===\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
