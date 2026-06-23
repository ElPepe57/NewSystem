/**
 * Verificación de la CF registrarEgresoCash contra el emulador Firestore (F3a · gate pre-deploy).
 * Ejerce el core REAL (registrarEgresoCashCore) con datos sembrados. Corre vía `npm run test:egresos`.
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-rules";

const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();
const { registrarEgresoCashCore } = require("../lib/egresos/registrarEgresoCash.js");

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

const seedProducto = (id, over) => db.collection("productosFinancieros").doc(id).set({ moneda: "USD", esBiMoneda: false, saldoActual: 10000, ...over });
const seedGasto = (id, over) => db.collection("gastos").doc(id).set({ moneda: "USD", montoOriginal: 5000, montoPEN: 18500, estado: "pendiente", autorizacion: { estado: "aprobado", firmas: [] }, ...over });
const seedOC = (id, over) => db.collection("ordenesCompra").doc(id).set({ totalUSD: 3000, autorizacion: { estado: "aprobado", firmas: [] }, ...over });
const saldo = async (id) => (await db.collection("productosFinancieros").doc(id).get()).data().saldoActual;

const input = (over) => ({
  refDocumentoTipo: "gasto", refDocumentoId: "g", categoria: "gasto_operativo", productoOrigenId: "caja",
  moneda: "USD", monto: 1000, tipoCambio: 3.7, concepto: "pago", fechaMs: 1700000000000, idempotencyKey: "k", ...over,
});

async function main() {
  console.log("\n=== F3a · registrarEgresoCash ===");
  await seedProducto("caja"); // saldo 10000 USD

  await seedGasto("g-aprob", { autorizacion: { estado: "aprobado", firmas: [] } });
  const r1 = await registrarEgresoCashCore(db, input({ refDocumentoId: "g-aprob", monto: 1000, idempotencyKey: "k-aprob" }), "fin-1");
  ok("gasto >umbral APROBADO → desembolsa", !!r1.movimientoId);
  ok("saldo bajó 1000 (10000→9000)", (await saldo("caja")) === 9000);

  await seedGasto("g-pend", { autorizacion: { estado: "pendiente", firmas: [] } });
  await expectThrow("gasto >umbral NO aprobado → bloqueado (fail-closed)", () => registrarEgresoCashCore(db, input({ refDocumentoId: "g-pend", idempotencyKey: "k-pend" }), "f"), "no está autorizado");
  ok("saldo NO cambió tras el bloqueo", (await saldo("caja")) === 9000);

  await seedGasto("g-chico", { montoOriginal: 500, autorizacion: { estado: "pendiente", firmas: [] } });
  const r3 = await registrarEgresoCashCore(db, input({ refDocumentoId: "g-chico", monto: 500, idempotencyKey: "k-chico" }), "f");
  ok("gasto ≤umbral → directo sin firma", !!r3.movimientoId);

  const r4a = await registrarEgresoCashCore(db, input({ refDocumentoId: "g-aprob", monto: 500, idempotencyKey: "k-idem" }), "f");
  const saldo4a = await saldo("caja");
  const r4b = await registrarEgresoCashCore(db, input({ refDocumentoId: "g-aprob", monto: 500, idempotencyKey: "k-idem" }), "f");
  ok("idempotencia: misma key → mismo id", r4a.movimientoId === r4b.movimientoId && r4b.idempotente === true);
  ok("idempotencia: saldo NO baja dos veces", (await saldo("caja")) === saldo4a);

  await expectThrow("pago que excede el monto aprobado → DENY", () => registrarEgresoCashCore(db, input({ refDocumentoId: "g-aprob", monto: 99999, idempotencyKey: "k-exc" }), "f"), "excede");

  await seedGasto("g-canc", { estado: "cancelado", autorizacion: { estado: "aprobado", firmas: [] } });
  await expectThrow("egreso cancelado → DENY", () => registrarEgresoCashCore(db, input({ refDocumentoId: "g-canc", idempotencyKey: "k-canc" }), "f"), "cancelado");

  await seedOC("oc-aprob");
  const r7 = await registrarEgresoCashCore(db, input({ refDocumentoTipo: "oc", refDocumentoId: "oc-aprob", categoria: "pago_orden_compra", monto: 1000, idempotencyKey: "k-oc" }), "f");
  ok("OC aprobada → desembolsa (otra colección)", !!r7.movimientoId);

  await seedProducto("caja-pen", { moneda: "PEN" });
  await expectThrow("moneda del pago ≠ cuenta (mono) → DENY", () => registrarEgresoCashCore(db, input({ refDocumentoId: "g-aprob", productoOrigenId: "caja-pen", moneda: "USD", idempotencyKey: "k-mon" }), "f"), "no coincide");

  console.log(`\n=== RESULTADO F3a: ${pass} pass · ${fail} fail ===\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
