import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const snap = await db.collection('ordenesCompra').orderBy('fechaCreacion', 'desc').limit(1).get();
snap.forEach(d => {
  const data = d.data();
  console.log('ID doc:', d.id);
  console.log(JSON.stringify(data, (k, v) => {
    if (v && typeof v === 'object' && typeof v._seconds === 'number') {
      return new Date(v._seconds * 1000).toISOString();
    }
    return v;
  }, 2));
});
process.exit(0);
