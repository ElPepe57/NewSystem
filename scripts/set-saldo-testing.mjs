import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const ref = db.collection('cuentasCaja').doc('K5K0fesic1czXoFHJISa');
await ref.update({ saldoUSD: 1000 });
const d = await ref.get();
console.log(`Cuenta Personal USD → saldoUSD=${d.data().saldoUSD}`);
process.exit(0);
