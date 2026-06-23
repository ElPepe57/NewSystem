/**
 * Verificación de la CF de autorización de egresos contra el emulador Firestore (F2 · gate pre-deploy).
 *
 * Ejerce los cores REALES (autorizarEgresoCore / rechazarEgresoCore) con datos sembrados.
 * Correr: `npm --prefix functions run test:egresos` (arranca el emulador y ejecuta este script).
 * functions/ no tiene runner de tests · este script es la verificación de integración del callable.
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-rules";

const admin = require("firebase-admin");
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();
const { autorizarEgresoCore, rechazarEgresoCore } = require("../lib/egresos/autorizarEgreso.js");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  ✅", name); }
  else { fail++; console.error("  ❌", name); }
}
async function expectThrow(name, fn, matcher) {
  try { await fn(); fail++; console.error("  ❌", name, "(no lanzó)"); }
  catch (e) {
    const tag = `${e.code || ""} ${e.message || ""}`;
    if (!matcher || tag.toLowerCase().includes(matcher.toLowerCase())) { pass++; console.log("  ✅", name, "→", e.code || e.message); }
    else { fail++; console.error("  ❌", name, "lanzó algo inesperado →", tag); }
  }
}

async function seedUser(uid, roles, participacion) {
  await db.collection("users").doc(uid).set({ roles, activo: true, estado: "activo" });
  if (participacion != null) {
    await db.collection("users").doc(uid).collection("private").doc("datosSocio").set({ porcentajeParticipacion: participacion });
  }
}
const gastoBase = (over) => ({ moneda: "USD", montoOriginal: 5000, montoPEN: 18500, creadoPor: "vend", estado: "pendiente", autorizacion: { estado: "pendiente", firmas: [] }, ...over });
async function seedGasto(id, over) { await db.collection("gastos").doc(id).set(gastoBase(over)); }
async function getGasto(id) { return (await db.collection("gastos").doc(id).get()).data(); }

async function main() {
  console.log("\n=== Seeding ===");
  await seedUser("A", ["socio"], 50);
  await seedUser("B", ["socio"], 30);
  await seedUser("C", ["socio"], 20);
  await seedUser("vend", ["vendedor"], null);     // creador (no socio)
  await seedUser("empleado", ["comprador"], null); // no socio · no creador
  await seedUser("adm", ["admin"], null);
  await seedUser("deleg", ["gerente"], null);      // delegado de B (más abajo)

  const auth = (docId, uid, col = "gastos") => autorizarEgresoCore(db, { coleccion: col, docId, uid });

  console.log("\n=== Segregación + autoridad ===");
  await seedGasto("g_seg", { creadoPor: "A" });
  await expectThrow("creador socio no firma su propio egreso", () => auth("g_seg", "A"), "propio egreso");
  await seedGasto("g_nos");
  await expectThrow("no-socio no-delegado bloqueado", () => auth("g_nos", "empleado"), "socios");

  console.log("\n=== Quórum por equity (3 socios 50/30/20 · creador vend) ===");
  await seedGasto("g_q");
  const r1 = await auth("g_q", "A");
  ok("A(50%) solo NO completa (>50 estricto)", r1.completa === false && r1.equityFirmado === 50 && r1.equityElegible === 100);
  const r2 = await auth("g_q", "B");
  ok("A+B(80%) completa", r2.completa === true && r2.equityFirmado === 80);
  ok("gasto quedó 'aprobado' con 2 firmas", (await getGasto("g_q")).autorizacion.estado === "aprobado");

  console.log("\n=== Doble firma + ya aprobado ===");
  await expectThrow("no se re-aprueba un aprobado", () => auth("g_q", "C"), "ya está autorizado");
  await seedGasto("g_dup");
  await auth("g_dup", "A");
  await expectThrow("el mismo socio no firma dos veces", () => auth("g_dup", "A"), "ya firmaste");

  console.log("\n=== Admin override + tramos ===");
  await seedGasto("g_adm");
  const ra = await auth("g_adm", "adm");
  ok("admin aprueba solo (override root)", ra.completa === true);
  await seedGasto("g_low", { montoOriginal: 500 });
  await expectThrow("≤ umbral → no requiere socio", () => auth("g_low", "A"), "no requiere");
  await seedGasto("g_fc", { moneda: "PEN", montoOriginal: 50000, montoPEN: 50000 }); // sin tipoCambio → USD no resoluble
  await expectThrow("monto no resoluble → fail-closed", () => auth("g_fc", "A"), "no resoluble");

  console.log("\n=== Delegación (carga el equity del socio) ===");
  await db.collection("delegacionesAutorizacion").doc("d1").set({ delegadoPor: "B", delegadoAUsuario: "deleg", activa: true });
  await seedGasto("g_del");
  const rd = await auth("g_del", "deleg");
  ok("delegado de B carga el 30% de B", rd.equityFirmado === 30 && rd.completa === false);

  console.log("\n=== Rechazo ===");
  await seedGasto("g_rej");
  await rechazarEgresoCore(db, { coleccion: "gastos", docId: "g_rej", uid: "A", motivo: "fuera de presupuesto" });
  ok("socio rechaza → autorizacion.estado='rechazado'", (await getGasto("g_rej")).autorizacion.estado === "rechazado");
  await expectThrow("no-socio no puede rechazar", () => rechazarEgresoCore(db, { coleccion: "gastos", docId: "g_rej", uid: "empleado" }), "socios");

  // Requerimiento NO pasa por la CF (autoridad de cargo · enforzado por firestore.rules) · ver rules test.
  console.log("\n=== OC (otra colección · mismo quórum de equity) ===");
  await db.collection("ordenesCompra").doc("oc1").set({ totalUSD: 5000, creadoPor: "vend", autorizacion: { estado: "pendiente", firmas: [] } });
  const roc = await autorizarEgresoCore(db, { coleccion: "ordenesCompra", docId: "oc1", uid: "A" });
  ok("OC: A(50%) parcial", roc.completa === false && roc.equityElegible === 100);
  const roc2 = await autorizarEgresoCore(db, { coleccion: "ordenesCompra", docId: "oc1", uid: "B" });
  ok("OC: A+B(80%) completa → autorizacion aprobada", roc2.completa === true && (await db.collection("ordenesCompra").doc("oc1").get()).data().autorizacion.estado === "aprobado");

  console.log(`\n=== RESULTADO: ${pass} pass · ${fail} fail ===\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
