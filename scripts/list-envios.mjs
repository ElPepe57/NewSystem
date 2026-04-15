import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const snap = await db.collection('envios').orderBy('fechaCreacion', 'desc').get();
console.log(`Total envios: ${snap.size}\n`);
snap.forEach(d => {
  const e = d.data();
  const fecha = e.fechaCreacion?.toDate?.().toISOString?.().slice(0, 16) || '-';
  console.log(`  ${(e.numeroEnvio || d.id).padEnd(18)} tipo=${(e.tipoEnvio || '-').padEnd(20)} estado=${(e.estado || '-').padEnd(15)} OC=${e.ordenCompraId || '-'} ${fecha}`);
});
process.exit(0);
