import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const mpId = 'geEs98tz955mVjYNct8M';

function serialize(data) {
  return JSON.stringify(data, (key, val) => {
    if (val && typeof val === 'object' && val._seconds !== undefined && val._nanoseconds !== undefined) {
      return new Date(val._seconds * 1000).toISOString();
    }
    return val;
  }, 2);
}

function printDocs(snap) {
  if (snap.empty) { console.log('  (no documents found)'); return; }
  snap.forEach(doc => {
    console.log(`  Doc ID: ${doc.id}`);
    console.log(serialize(doc.data()));
  });
}

// QUERY 1
console.log('\n=== QUERY 1: Venta VT-2026-037 ===');
const ventaSnap = await db.collection('ventas').where('numeroVenta', '==', 'VT-2026-037').get();
printDocs(ventaSnap);
const ventaId = ventaSnap.empty ? null : ventaSnap.docs[0].id;

// QUERY 2
console.log('\n=== QUERY 2: Cotizacion COT-2026-014 ===');
const cotSnap = await db.collection('cotizaciones').where('numeroCotizacion', '==', 'COT-2026-014').get();
printDocs(cotSnap);
const cotId = cotSnap.empty ? null : cotSnap.docs[0].id;

// QUERY 3
console.log(`\n=== QUERY 3: movimientosTesoreria where ventaId = ${ventaId} ===`);
if (ventaId) {
  const q3 = await db.collection('movimientosTesoreria').where('ventaId', '==', ventaId).get();
  printDocs(q3);
} else { console.log('  (skipped - no ventaId)'); }

// QUERY 4
console.log(`\n=== QUERY 4: movimientosTesoreria where cotizacionId = ${cotId} ===`);
if (cotId) {
  const q4 = await db.collection('movimientosTesoreria').where('cotizacionId', '==', cotId).get();
  printDocs(q4);
} else { console.log('  (skipped - no cotId)'); }

// QUERY 5
console.log('\n=== QUERY 5: MOV-2026-0102 ===');
const q5 = await db.collection('movimientosTesoreria').where('numeroMovimiento', '==', 'MOV-2026-0102').get();
printDocs(q5);

// QUERY 6
console.log('\n=== QUERY 6: MOV-2026-0128 ===');
const q6 = await db.collection('movimientosTesoreria').where('numeroMovimiento', '==', 'MOV-2026-0128').get();
printDocs(q6);

// QUERY 7
console.log(`\n=== QUERY 7: movimientosTesoreria monto=7.25 cuentaDestino=${mpId} ===`);
const q7 = await db.collection('movimientosTesoreria').where('monto', '==', 7.25).where('cuentaDestino', '==', mpId).get();
printDocs(q7);

// QUERY 8
console.log(`\n=== QUERY 8: movimientosTesoreria monto=158 cuentaDestino=${mpId} ===`);
const q8 = await db.collection('movimientosTesoreria').where('monto', '==', 158).where('cuentaDestino', '==', mpId).get();
printDocs(q8);

// QUERY 9
console.log(`\n=== QUERY 9: movimientosTesoreria monto=165.25 cuentaDestino=${mpId} ===`);
const q9 = await db.collection('movimientosTesoreria').where('monto', '==', 165.25).where('cuentaDestino', '==', mpId).get();
printDocs(q9);

console.log('\n=== DONE ===');
process.exit(0);
