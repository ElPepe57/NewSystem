import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const ref = db.collection('cuentasCaja').doc('K5K0fesic1czXoFHJISa');
await ref.update({ saldoActual: 1000, saldoUSD: 1000 });
console.log('✓ Cuenta Personal USD: saldoActual=1000, saldoUSD=1000');
process.exit(0);
