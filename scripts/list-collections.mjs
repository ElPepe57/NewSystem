import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const cols = await db.listCollections();
console.log('TOTAL COLECCIONES RAÍZ: ' + cols.length + '\n');

// Filtrar y contar las más relevantes
const relevantes = cols.filter(c =>
  /venta|ml|merca|archiv|orden|sync|pedido|order/i.test(c.id)
);

console.log('--- COLECCIONES RELEVANTES (venta/ml/archivo/pedido) ---');
for (const c of relevantes) {
  try {
    const s = await c.count().get();
    console.log('  ' + c.id.padEnd(35) + ' : ' + s.data().count + ' docs');
  } catch (e) {
    console.log('  ' + c.id.padEnd(35) + ' : ERROR ' + e.message);
  }
}

console.log('\n--- TODAS LAS COLECCIONES ---');
for (const c of cols) {
  try {
    const s = await c.count().get();
    console.log('  ' + c.id.padEnd(35) + ' : ' + s.data().count + ' docs');
  } catch (e) {
    console.log('  ' + c.id.padEnd(35) + ' : ERROR');
  }
}

process.exit(0);
