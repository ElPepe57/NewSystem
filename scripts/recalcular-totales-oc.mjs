/**
 * Recalcula totalUSD de cada OC sumando cargosOC/descuentosOC/impuestosOC + legacy fields.
 * Arregla OCs creadas antes del fix S38-008.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const apply = process.argv.includes('--apply');
const snap = await db.collection('ordenesCompra').get();
console.log(`Revisando ${snap.size} OCs...\n`);

const batch = db.batch();
let fixCount = 0;
for (const d of snap.docs) {
  const oc = d.data();
  const subtotalUSD = oc.subtotalUSD ?? (oc.productos || []).reduce((s, p) => s + (p.subtotal || 0), 0);

  const cargosV2 = (oc.cargosOC || []).reduce((s, c) => s + (c.montoUSD || 0), 0);
  const descuentosV2 = (oc.descuentosOC || []).reduce((s, c) => s + (c.montoUSD || 0), 0);
  const impuestosV2 = (oc.impuestosOC || []).reduce((s, c) => s + (c.montoUSD || 0), 0);

  const impuestoLegacy = cargosV2 === 0 && impuestosV2 === 0
    ? (oc.impuestoCompraUSD ?? oc.impuestoUSD ?? 0) : 0;
  const gastosEnvioLegacy = cargosV2 === 0
    ? (oc.costoEnvioProveedorUSD ?? oc.gastosEnvioUSD ?? 0) : 0;
  const otrosGastosLegacy = cargosV2 === 0
    ? (oc.otrosGastosCompraUSD ?? oc.otrosGastosUSD ?? 0) : 0;
  const descuentoLegacy = descuentosV2 === 0 ? (oc.descuentoUSD || 0) : 0;

  const totalUSDcalc =
    subtotalUSD
    + (impuestoLegacy + impuestosV2)
    + (gastosEnvioLegacy + cargosV2)
    + otrosGastosLegacy
    - (descuentoLegacy + descuentosV2);

  const diff = Math.abs((oc.totalUSD || 0) - totalUSDcalc);
  if (diff > 0.01) {
    console.log(`  ${oc.numeroOrden}: totalUSD ${oc.totalUSD} → ${totalUSDcalc.toFixed(2)}  (subtotal=${subtotalUSD}, cargosV2=${cargosV2}, impuestosV2=${impuestosV2}, descV2=${descuentosV2})`);
    if (apply) batch.update(d.ref, { totalUSD: totalUSDcalc });
    fixCount++;
  } else {
    console.log(`  ✓ ${oc.numeroOrden}: totalUSD $${(oc.totalUSD || 0).toFixed(2)}`);
  }
}

if (apply && fixCount > 0) {
  await batch.commit();
  console.log(`\n✅ ${fixCount} OCs recalculadas.`);
} else if (fixCount > 0) {
  console.log(`\n🔍 ${fixCount} OCs tienen totalUSD incorrecto. Ejecuta con --apply para corregir.`);
}
process.exit(0);
