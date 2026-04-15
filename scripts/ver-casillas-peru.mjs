import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const snap = await db.collection('casillas').where('pais', '==', 'Peru').get();
console.log(`Casillas Peru: ${snap.size}\n`);
snap.forEach(d => {
  const c = d.data();
  console.log(`  ${d.id}  ${c.nombre}`);
  console.log(`    tipo=${c.tipo}  esPrincipal=${c.esPrincipal}  estado=${c.estado}`);
});
process.exit(0);
