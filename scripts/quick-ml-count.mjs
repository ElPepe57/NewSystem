import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();
const snap = await db.collection('mlOrderSync').get();
const porOrigen = {};
const porMes = {};
let min = null, max = null;
for (const d of snap.docs) {
  const data = d.data();
  porOrigen[data.origen || '?'] = (porOrigen[data.origen || '?'] || 0) + 1;
  const f = data.fechaOrdenML?.toDate?.();
  if (f) {
    const k = f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0');
    porMes[k] = (porMes[k] || 0) + 1;
    if (!min || f < min) min = f;
    if (!max || f > max) max = f;
  }
}
console.log('mlOrderSync ahora: ' + snap.size + ' docs');
console.log('Por origen:', porOrigen);
console.log('Por mes:');
for (const [k, v] of Object.entries(porMes).sort()) console.log('   ' + k + ' : ' + v);
console.log('Fecha más antigua: ' + (min?.toISOString().split('T')[0]));
console.log('Fecha más reciente: ' + (max?.toISOString().split('T')[0]));
process.exit(0);
