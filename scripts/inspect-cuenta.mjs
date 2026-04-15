import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const snap = await db.collection('cuentasCaja').get();
console.log(`Cuentas: ${snap.size}\n`);
snap.forEach(d => {
  const c = d.data();
  console.log(`  ${d.id}  ${c.nombre || '-'}`);
  console.log(`    saldoUSD=${c.saldoUSD}  saldoPEN=${c.saldoPEN}  moneda=${c.moneda}`);
});
process.exit(0);
