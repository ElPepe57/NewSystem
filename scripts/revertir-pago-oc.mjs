/**
 * Revierte un pago de OC completo: elimina el movimiento de tesoreria,
 * devuelve el saldo a la cuenta, quita el pago de la OC y resetea sub-ordenes.
 *
 * Uso:
 *   node scripts/revertir-pago-oc.mjs --oc=OC-2026-001           # dry run
 *   node scripts/revertir-pago-oc.mjs --oc=OC-2026-001 --apply   # aplicar
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const ocNum = (args.find(a => a.startsWith('--oc=')) || '').split('=')[1];
if (!ocNum) { console.error('Usa --oc=OC-2026-XXX'); process.exit(1); }

const snap = await db.collection('ordenesCompra').where('numeroOrden', '==', ocNum).get();
if (snap.empty) { console.error(`OC ${ocNum} no encontrada`); process.exit(1); }
const ocDoc = snap.docs[0];
const oc = ocDoc.data();
const historial = oc.historialPagos || [];

console.log(`\n=== ${ocNum} (${ocDoc.id}) ===`);
console.log(`historialPagos.length = ${historial.length}`);
console.log(`estadoPago = ${oc.estadoPago}`);

if (historial.length === 0) {
  console.log('Sin pagos que revertir.');
  process.exit(0);
}

// Buscar movimientos de tesoreria vinculados
const movSnap = await db.collection('movimientosTesoreria')
  .where('ordenCompraId', '==', ocDoc.id)
  .where('tipo', '==', 'pago_orden_compra')
  .get();
console.log(`movimientosTesoreria = ${movSnap.size}`);

// Agregar saldos por cuenta
const deltaPorCuenta = {}; // cuentaId → { USD: 0, PEN: 0 }
for (const m of movSnap.docs) {
  const data = m.data();
  const cid = data.cuentaId || data.cuentaOrigenId || data.cuentaOrigen;
  const moneda = data.moneda;
  const monto = data.monto || 0;
  if (!cid) continue;
  if (!deltaPorCuenta[cid]) deltaPorCuenta[cid] = { USD: 0, PEN: 0 };
  // El movimiento fue salida (monto negativo en tesoreria), al revertir sumamos
  deltaPorCuenta[cid][moneda] = (deltaPorCuenta[cid][moneda] || 0) + Math.abs(monto);
  console.log(`  mov ${m.id}: cuenta=${cid} ${moneda} ${monto}`);
}

console.log('\nDeltas a aplicar a cuentas:');
for (const [cid, d] of Object.entries(deltaPorCuenta)) {
  const cDoc = await db.collection('cuentasCaja').doc(cid).get();
  const nombre = cDoc.exists ? cDoc.data().nombre : '?';
  console.log(`  ${cid} (${nombre}): +USD ${d.USD} / +PEN ${d.PEN}`);
}

if (!apply) {
  console.log('\n🔍 DRY RUN — agrega --apply para ejecutar.');
  process.exit(0);
}

console.log('\n✍️  Aplicando reversión...');

// 1. Borrar movimientos
const batch = db.batch();
movSnap.docs.forEach(d => batch.delete(d.ref));

// 2. Devolver saldo a cuentas
for (const [cid, d] of Object.entries(deltaPorCuenta)) {
  const cDoc = await db.collection('cuentasCaja').doc(cid).get();
  if (!cDoc.exists) continue;
  const cData = cDoc.data();
  const updates = {};
  if (d.USD !== 0) updates.saldoUSD = (cData.saldoUSD || 0) + d.USD;
  if (d.PEN !== 0) updates.saldoPEN = (cData.saldoPEN || 0) + d.PEN;
  batch.update(cDoc.ref, updates);
}

// 3. Resetear historialPagos + estadoPago de la OC
const subOrdenes = oc.subOrdenes || [];
const nuevasSubs = subOrdenes.map(s => {
  const copy = { ...s, estadoPago: 'pendiente' };
  delete copy.fechaPago;
  return copy;
});
const ocUpdates = {
  historialPagos: [],
  estadoPago: 'pendiente',
  montoPendiente: oc.totalUSD * (oc.tcPago || oc.tcCompra || 1),
};
if (subOrdenes.length > 0) ocUpdates.subOrdenes = nuevasSubs;
batch.update(ocDoc.ref, ocUpdates);

await batch.commit();
console.log(`✅ Reversión completa:`);
console.log(`   - ${movSnap.size} movimientos eliminados`);
console.log(`   - Saldos de cuentas devueltos`);
console.log(`   - OC ${ocNum} estadoPago=pendiente, historialPagos=[]`);
if (subOrdenes.length > 0) console.log(`   - ${nuevasSubs.length} sub-órdenes reseteadas`);
process.exit(0);
