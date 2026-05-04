import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const cols = await db.listCollections();
console.log(`Colecciones en BD: ${cols.length}`);
const stats = [];
for (const c of cols) {
  const s = await c.count().get();
  stats.push({ name: c.id, count: s.data().count });
}
stats.sort((a, b) => b.count - a.count);
stats.forEach(s => console.log(`  ${s.name}: ${s.count}`));
process.exit(0);
