/**
 * Verificación de la CF registrarRetiroCashTesoreria contra el emulador Firestore (F3c · gate pre-deploy).
 * Ejerce el core REAL (registrarRetiroCashCore) con datos sembrados. Corre vía `npm run test:egresos`.
 *
 * El retiro vive en el dominio TESORERÍA: escribe movimientosTesoreria + resta saldo de cuentasCaja.
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-rules";

const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();
const { registrarRetiroCashCore } = require("../lib/egresos/registrarRetiroCashTesoreria.js");

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

const seedCuenta = (id, over) => db.collection("cuentasCaja").doc(id).set({ moneda: "USD", esBiMoneda: false, saldoActual: 10000, activa: true, ...over });
const seedRetiro = (id, over) => db.collection("retirosCapital").doc(id).set({
  monto: 5000, moneda: "USD", tipoCambio: 3.7, cuentaOrigenId: "caja", concepto: "retiro de prueba",
  socioNombre: "Socio A", socioId: "A", tipoRetiro: "capital", creadoPor: "A", estado: "pendiente",
  autorizacion: { estado: "aprobado", firmas: [] }, ...over,
});
const saldoCuenta = async (id) => (await db.collection("cuentasCaja").doc(id).get()).data().saldoActual;
const getRetiro = async (id) => (await db.collection("retirosCapital").doc(id).get()).data();

async function main() {
  console.log("\n=== F3c · registrarRetiroCashTesoreria (dominio tesorería) ===");
  await seedCuenta("caja"); // saldo 10000 USD

  await seedRetiro("ret-aprob", { autorizacion: { estado: "aprobado", firmas: [] } });
  const r1 = await registrarRetiroCashCore(db, { retiroId: "ret-aprob" }, "fin-1");
  ok("retiro >$1k APROBADO → desembolsa (movimiento creado)", !!r1.movimientoId);
  ok("saldo de la cuenta bajó 5000 (10000→5000)", (await saldoCuenta("caja")) === 5000);
  const mov = (await db.collection("movimientosTesoreria").doc(r1.movimientoId).get()).data();
  ok("el movimiento es tipo retiro_socio + ejecutado + esRetiroCapital", mov.tipo === "retiro_socio" && mov.estado === "ejecutado" && mov.esRetiroCapital === true);
  ok("el retiro quedó estado='ejecutado' con movimientoId espejo", (await getRetiro("ret-aprob")).estado === "ejecutado");

  // idempotencia: reinvocar el mismo retiro no vuelve a desembolsar
  const r1b = await registrarRetiroCashCore(db, { retiroId: "ret-aprob" }, "fin-1");
  ok("idempotencia: 2ª invocación → idempotente, mismo movimiento", r1b.idempotente === true && r1b.movimientoId === r1.movimientoId);
  ok("idempotencia: saldo NO baja dos veces (sigue 5000)", (await saldoCuenta("caja")) === 5000);

  // >$1k no aprobado → bloqueado (el gate de F3c)
  await seedRetiro("ret-pend", { autorizacion: { estado: "pendiente", firmas: [] } });
  await expectThrow("retiro >$1k NO aprobado → bloqueado (permission-denied)", () => registrarRetiroCashCore(db, { retiroId: "ret-pend" }, "f"), "no está autorizado");
  ok("saldo NO cambió tras el bloqueo (sigue 5000)", (await saldoCuenta("caja")) === 5000);

  // ≤$1k → directo (no requiere socio) aunque autorizacion no esté aprobada
  await seedRetiro("ret-chico", { monto: 500, autorizacion: { estado: "pendiente", firmas: [] } });
  const r3 = await registrarRetiroCashCore(db, { retiroId: "ret-chico" }, "f");
  ok("retiro ≤$1k → directo sin firma de socio", !!r3.movimientoId);
  ok("saldo bajó 500 (5000→4500)", (await saldoCuenta("caja")) === 4500);

  // moneda mono-moneda mismatch → DENY
  await seedCuenta("caja-pen", { moneda: "PEN" });
  await seedRetiro("ret-mon", { cuentaOrigenId: "caja-pen", moneda: "USD" });
  await expectThrow("moneda del retiro ≠ cuenta (mono) → DENY", () => registrarRetiroCashCore(db, { retiroId: "ret-mon" }, "f"), "no coincide");

  // saldo insuficiente (releído en la tx) → DENY
  await seedCuenta("caja-baja", { saldoActual: 100 });
  await seedRetiro("ret-grande", { cuentaOrigenId: "caja-baja", monto: 5000 });
  await expectThrow("saldo insuficiente → DENY", () => registrarRetiroCashCore(db, { retiroId: "ret-grande" }, "f"), "insuficiente");

  // retiro cancelado/rechazado → DENY
  await seedRetiro("ret-canc", { estado: "cancelado" });
  await expectThrow("retiro cancelado → DENY", () => registrarRetiroCashCore(db, { retiroId: "ret-canc" }, "f"), "cancelado");

  // bi-moneda: retiro USD desde cuenta bi-moneda → muta saldoUSD
  await seedCuenta("caja-bi", { esBiMoneda: true, saldoUSD: 8000, saldoPEN: 20000 });
  await seedRetiro("ret-bi", { cuentaOrigenId: "caja-bi", monto: 3000, moneda: "USD" });
  const r4 = await registrarRetiroCashCore(db, { retiroId: "ret-bi" }, "f");
  const cb = (await db.collection("cuentasCaja").doc("caja-bi").get()).data();
  ok("bi-moneda: muta saldoUSD (8000→5000), saldoPEN intacto", !!r4.movimientoId && cb.saldoUSD === 5000 && cb.saldoPEN === 20000);

  console.log(`\n=== RESULTADO F3c-retiro-cash: ${pass} pass · ${fail} fail ===\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
