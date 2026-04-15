import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const snap = await db.collection('movimientosTesoreria').get();
snap.forEach(d => {
  console.log(`\n=== ${d.id} ===`);
  const data = d.data();
  for (const [k, v] of Object.entries(data)) {
    const val = v?._seconds ? new Date(v._seconds*1000).toISOString() : JSON.stringify(v);
    console.log(`  ${k}: ${val}`);
  }
});
process.exit(0);
