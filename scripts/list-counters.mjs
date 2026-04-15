import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const snap = await db.collection('contadores').get();
console.log(`Total contadores: ${snap.size}\n`);
snap.forEach(d => console.log(`  ${d.id.padEnd(35)} current=${d.data().current}`));
process.exit(0);
