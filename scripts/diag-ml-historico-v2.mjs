import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

console.log('=========================================');
console.log('DIAGNÓSTICO v2 — Histórico real de ML');
console.log('=========================================\n');

// 1. mlWebhookLog — rango de fechas y tipo de evento
console.log('1. mlWebhookLog — rango histórico de eventos');
const wMin = await db.collection('mlWebhookLog').orderBy('recibido', 'asc').limit(1).get();
const wMax = await db.collection('mlWebhookLog').orderBy('recibido', 'desc').limit(1).get();
if (wMin.size > 0) console.log('   Primer evento:  ' + wMin.docs[0].data().recibido?.toDate?.().toISOString());
if (wMax.size > 0) console.log('   Último evento:  ' + wMax.docs[0].data().recibido?.toDate?.().toISOString());

// Por topic
console.log('\n2. mlWebhookLog — distribución por topic (muestra 500)');
const wSample = await db.collection('mlWebhookLog').limit(500).get();
const porTopic = {};
for (const d of wSample.docs) {
  const t = d.data().topic || '(sin-topic)';
  porTopic[t] = (porTopic[t] || 0) + 1;
}
for (const [k, v] of Object.entries(porTopic).sort((a, b) => b[1] - a[1])) {
  console.log('   ' + k.padEnd(25) + ' : ' + v);
}

// 3. Conteo de orders vs questions en webhook (por topic)
console.log('\n3. mlWebhookLog — topic "orders_v2" (órdenes reales)');
try {
  const ordersSnap = await db.collection('mlWebhookLog').where('topic', '==', 'orders_v2').get();
  console.log('   Total webhooks de órdenes: ' + ordersSnap.size);
  // Ids únicos de orden
  const uniqueOrders = new Set();
  for (const d of ordersSnap.docs) {
    const resource = d.data().resource || '';
    const match = resource.match(/\/orders\/(\d+)/);
    if (match) uniqueOrders.add(match[1]);
  }
  console.log('   IDs de orden únicos (resource): ' + uniqueOrders.size);
} catch (e) {
  console.log('   Error: ' + e.message);
}

// 4. mlOrderSync exacto (sin count aproximado)
console.log('\n4. mlOrderSync — conteo exacto');
const syncAll = await db.collection('mlOrderSync').get();
console.log('   Docs totales (get real): ' + syncAll.size);

// Distribución por fecha
const porMes = {};
for (const d of syncAll.docs) {
  const f = d.data().fechaOrdenML?.toDate?.();
  if (f) {
    const k = f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0');
    porMes[k] = (porMes[k] || 0) + 1;
  }
}
console.log('   Distribución por mes:');
for (const [k, v] of Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log('      ' + k + ' : ' + v);
}

// 5. mlProductMap — ¿qué tiene dentro?
console.log('\n5. mlProductMap — muestra de 5 docs');
const mapSample = await db.collection('mlProductMap').limit(5).get();
for (const d of mapSample.docs) {
  const data = d.data();
  const keys = Object.keys(data).join(', ');
  console.log('   [' + d.id + '] keys: ' + keys);
}

// 6. Conteo exacto mlProductMap + campo de "vecesVendido" o similar
const mapAll = await db.collection('mlProductMap').get();
console.log('\n   Docs totales mlProductMap: ' + mapAll.size);
let conVinculoERP = 0, sinVinculoERP = 0;
for (const d of mapAll.docs) {
  const data = d.data();
  if (data.productoId) conVinculoERP++;
  else sinVinculoERP++;
}
console.log('   Con productoId (vinculados al ERP): ' + conVinculoERP);
console.log('   Sin productoId: ' + sinVinculoERP);

process.exit(0);
