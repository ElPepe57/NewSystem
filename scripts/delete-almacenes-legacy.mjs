import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const dryRun = process.argv.includes('--dry-run');

const snap = await db.collection('almacenes').get();
console.log(`Almacenes a eliminar: ${snap.size}`);
if (snap.size === 0) { console.log('Nada que hacer.'); process.exit(0); }

if (dryRun) { console.log('🔍 DRY RUN'); process.exit(0); }

console.log('\n✍️  Eliminando docs de almacenes...');
// Firestore batch limit 500
const batch = db.batch();
snap.forEach(d => batch.delete(d.ref));
await batch.commit();
console.log(`✅ ${snap.size} almacenes eliminados.`);

// Resetear contador ALM (ya no se usará, pero por consistencia)
const contRef = db.collection('contadores').doc('ALM');
const contDoc = await contRef.get();
if (contDoc.exists && (contDoc.data().current || 0) !== 0) {
  console.log(`\n🔄 Reseteando contador ALM: ${contDoc.data().current} → 0`);
  await contRef.set({ current: 0, updatedAt: new Date() }, { merge: true });
  console.log('✅ Contador ALM reseteado');
}

process.exit(0);
