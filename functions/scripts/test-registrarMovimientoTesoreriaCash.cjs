/**
 * Verificación de la CF registrarMovimientoTesoreriaCash contra el emulador (F3.5 Fase B · cuentasCaja).
 * Ejerce el core REAL. Corre vía `npm run test:egresos`.
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-rules";

const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();
const { registrarMovimientoTesoreriaCashCore, eliminarMovimientoTesoreriaCashCore } = require("../lib/egresos/registrarMovimientoTesoreriaCash.js");

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log("  ✅", name); } else { fail++; console.error("  ❌", name); } }
async function expectThrow(name, fn, matcher) {
  try { await fn(); fail++; console.error("  ❌", name, "(no lanzó)"); }
  catch (e) { const tag = `${e.code || ""} ${e.message || ""}`.toLowerCase();
    if (!matcher || tag.includes(matcher.toLowerCase())) { pass++; console.log("  ✅", name, "→", e.code || e.message); }
    else { fail++; console.error("  ❌", name, "lanzó algo inesperado →", tag); } }
}
const seedCuenta = (id, over) => db.collection("cuentasCaja").doc(id).set({ moneda: "USD", esBiMoneda: false, saldoActual: 10000, activa: true, ...over });
const saldo = async (id) => (await db.collection("cuentasCaja").doc(id).get()).data().saldoActual;
const base = (over) => ({ tipo: "ingreso_venta", moneda: "USD", monto: 1000, tipoCambio: 3.7, metodo: "transferencia", concepto: "mov", fechaMs: 1700000000000, ...over });

async function main() {
  console.log("\n=== F3.5 Fase B · registrarMovimientoTesoreriaCash ===");

  await seedCuenta("c-in");
  const r1 = await registrarMovimientoTesoreriaCashCore(db, base({ tipo: "ingreso_venta", cuentaDestino: "c-in", monto: 2000 }), "fin");
  ok("ingreso → crea movimiento", !!r1.movimientoId);
  ok("ingreso suma al saldo destino (10000→12000)", (await saldo("c-in")) === 12000);

  await seedCuenta("c-out");
  await registrarMovimientoTesoreriaCashCore(db, base({ tipo: "gasto_operativo", cuentaOrigen: "c-out", monto: 1500 }), "fin");
  ok("egreso de caja resta del origen (10000→8500)", (await saldo("c-out")) === 8500);

  await seedCuenta("c-a", { saldoActual: 5000 });
  await seedCuenta("c-b", { saldoActual: 5000 });
  await registrarMovimientoTesoreriaCashCore(db, base({ tipo: "transferencia_interna", cuentaOrigen: "c-a", cuentaDestino: "c-b", monto: 1000 }), "fin");
  ok("transfer: origen resta (5000→4000)", (await saldo("c-a")) === 4000);
  ok("transfer: destino suma (5000→6000)", (await saldo("c-b")) === 6000);

  await db.collection("cuentasCaja").doc("c-bi").set({ esBiMoneda: true, saldoUSD: 3000, saldoPEN: 9000, activa: true });
  await registrarMovimientoTesoreriaCashCore(db, base({ tipo: "ingreso_venta", cuentaDestino: "c-bi", moneda: "USD", monto: 1000 }), "fin");
  const bi = (await db.collection("cuentasCaja").doc("c-bi").get()).data();
  ok("bi-moneda: ingreso USD suma saldoUSD (3000→4000), saldoPEN intacto", bi.saldoUSD === 4000 && bi.saldoPEN === 9000);

  await seedCuenta("c-pen", { moneda: "PEN" });
  await expectThrow("mono · moneda ≠ cuenta → DENY", () => registrarMovimientoTesoreriaCashCore(db, base({ tipo: "ingreso_venta", cuentaDestino: "c-pen", moneda: "USD" }), "fin"), "no coincide");

  await expectThrow("tipo retiro_socio por esta CF → DENY (va por su CF gateada)", () => registrarMovimientoTesoreriaCashCore(db, base({ tipo: "retiro_socio", cuentaOrigen: "c-out", monto: 500 }), "fin"), "retiro de socio");

  await seedCuenta("c-idem");
  const ri1 = await registrarMovimientoTesoreriaCashCore(db, base({ tipo: "ingreso_venta", cuentaDestino: "c-idem", monto: 500, idempotencyKey: "k-t" }), "fin");
  const sIdem = await saldo("c-idem");
  const ri2 = await registrarMovimientoTesoreriaCashCore(db, base({ tipo: "ingreso_venta", cuentaDestino: "c-idem", monto: 500, idempotencyKey: "k-t" }), "fin");
  ok("idempotencia: misma key+par → mismo id, idempotente", ri1.movimientoId === ri2.movimientoId && ri2.idempotente === true);
  ok("idempotencia: saldo NO se aplica dos veces", (await saldo("c-idem")) === sIdem);

  await expectThrow("sin cuenta origen ni destino → DENY", () => registrarMovimientoTesoreriaCashCore(db, base({ tipo: "ingreso_venta" }), "fin"), "cuenta");

  // ELIMINAR · revierte el saldo (incondicional · undo del create) + archiva + borra · idempotente
  await seedCuenta("c-del");
  const rd = await registrarMovimientoTesoreriaCashCore(db, base({ tipo: "gasto_operativo", cuentaOrigen: "c-del", monto: 2000 }), "fin");
  ok("egreso para eliminar resta (10000→8000)", (await saldo("c-del")) === 8000);
  await eliminarMovimientoTesoreriaCashCore(db, { movimientoId: rd.movimientoId }, "fin");
  ok("eliminar REVIERTE el saldo del origen (8000→10000)", (await saldo("c-del")) === 10000);
  ok("el movimiento activo fue borrado", !(await db.collection("movimientosTesoreria").doc(rd.movimientoId).get()).exists);
  ok("se archivó en movimientosAnulados", !(await db.collection("movimientosAnulados").where("movimientoOriginalId", "==", rd.movimientoId).limit(1).get()).empty);
  const rd2 = await eliminarMovimientoTesoreriaCashCore(db, { movimientoId: rd.movimientoId }, "fin");
  ok("eliminar idempotente (ya no existe) · saldo no cambia", rd2.idempotente === true && (await saldo("c-del")) === 10000);

  console.log(`\n=== RESULTADO F3.5-tesoreria-cash: ${pass} pass · ${fail} fail ===\n`);
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
