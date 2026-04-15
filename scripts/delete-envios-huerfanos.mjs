import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const snap = await db.collection('envios').get();
console.log(`Revisando ${snap.size} envíos...\n`);

const huerfanos = [];
for (const d of snap.docs) {
  const e = d.data();
  if (!e.ordenCompraId) continue;
  const ocDoc = await db.collection('ordenesCompra').doc(e.ordenCompraId).get();
  if (!ocDoc.exists) {
    huerfanos.push({ id: d.id, numero: e.numeroEnvio, ocId: e.ordenCompraId });
  }
}

console.log(`Envíos huérfanos (OC no existe): ${huerfanos.length}`);
huerfanos.forEach(h => console.log(`  ${h.numero || h.id}  (OC huérfana: ${h.ocId})`));

if (huerfanos.length === 0) {
  console.log('\nNada que eliminar.');
  process.exit(0);
}

// Unidades vinculadas a esos envíos (por si acaso)
const envioIds = huerfanos.map(h => h.id);
let unidadesHuerfanas = 0;
for (const envioId of envioIds) {
  const unSnap = await db.collection('unidades').where('envioId', '==', envioId).get();
  unidadesHuerfanas += unSnap.size;
}
console.log(`\nUnidades vinculadas a esos envíos: ${unidadesHuerfanas}`);

console.log('\n✍️  Eliminando...');
const batch = db.batch();
for (const h of huerfanos) {
  batch.delete(db.collection('envios').doc(h.id));
}
await batch.commit();
console.log(`✅ ${huerfanos.length} envíos huérfanos eliminados.`);

if (unidadesHuerfanas > 0) {
  console.log(`\n⚠️  Hay ${unidadesHuerfanas} unidades huérfanas. Ejecuta resync-counters.mjs después.`);
}
process.exit(0);
