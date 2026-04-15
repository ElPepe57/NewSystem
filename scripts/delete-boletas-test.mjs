import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const dryRun = process.argv.includes('--dry-run');

const snap = await db.collection('boletas').get();
console.log(`Boletas encontradas: ${snap.size}\n`);
snap.forEach(d => {
  const b = d.data();
  console.log(`  ${d.id}  numero=${b.numero || '-'}  empleadoId=${b.empleadoId || '-'}  mes=${b.mes || '-'}  total=${b.totalNetoPEN || b.totalNeto || b.total || '-'}`);
});

if (snap.size === 0) { console.log('\nNada que eliminar.'); process.exit(0); }

// Buscar adelantos vinculados (por si acaso)
const adelantosSnap = await db.collection('adelantosNomina').get();
console.log(`\nAdelantos en BD: ${adelantosSnap.size}`);

if (dryRun) { console.log('\n🔍 DRY RUN'); process.exit(0); }

console.log('\n✍️  Eliminando boletas...');
const batch = db.batch();
snap.forEach(d => batch.delete(d.ref));
await batch.commit();
console.log(`✅ ${snap.size} boletas eliminadas.`);

// Resync contador BOL-YYYY-MM al MAX real (que ahora es 0)
console.log('\n🔄 Resyncando contadores de boletas...');
const contSnap = await db.collection('contadores').get();
const batch2 = db.batch();
let updates = 0;
contSnap.forEach(c => {
  if (/^BOL-\d{4}-\d{2}$/.test(c.id) && (c.data().current || 0) !== 0) {
    console.log(`  ${c.id}: ${c.data().current} → 0`);
    batch2.set(c.ref, { current: 0, updatedAt: new Date() }, { merge: true });
    updates++;
  }
});
if (updates > 0) await batch2.commit();
console.log(`✅ ${updates} contadores de boletas reseteados.`);
process.exit(0);
