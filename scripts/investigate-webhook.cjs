const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

(async () => {
  console.log('=== 1. ESTADO DEL WEBHOOK ===');
  const configDoc = await db.collection('mlConfig').doc('settings').get();
  const config = configDoc.data();
  console.log({
    connected: config.connected,
    webhookRegistered: config.webhookRegistered || false,
    webhookUrl: config.webhookUrl || 'NO REGISTRADO',
    autoCreateVentas: config.autoCreateVentas,
    userId: config.userId,
  });

  console.log('\n=== 2. ORDEN DE HUBBER EN ML ===');
  console.log('mlOrderId: 2000015432846842');
  console.log('fechaOrdenML: 2026-03-06T23:00:30 (11pm)');
  console.log('fechaSync (importación): 2026-03-07T00:50:32 (12:50am +1 día)');

  console.log('\n=== 3. ÚLTIMAS ÓRDENES POR FECHA DE SYNC (¿hay gap?) ===');
  const recentOrders = await db.collection('mlOrderSync')
    .orderBy('fechaOrdenML', 'desc')
    .limit(15)
    .get();

  for (const doc of recentOrders.docs) {
    const d = doc.data();
    const fechaML = d.fechaOrdenML ? d.fechaOrdenML.toDate().toISOString() : 'N/A';
    const fechaSync = d.fechaSync ? d.fechaSync.toDate().toISOString() : 'N/A';
    const fechaProc = d.fechaProcesada ? d.fechaProcesada.toDate().toISOString() : 'pendiente';
    console.log(
      `${d.mlOrderId} | ${d.origen || '???'} | ${d.estado} | ML: ${fechaML.substring(0,19)} | Sync: ${fechaSync.substring(0,19)} | Proc: ${fechaProc.substring(0,19)} | ${(d.mlBuyerName || 'N/A').substring(0,20)}`
    );
  }

  console.log('\n=== 4. ¿HAY WEBHOOKS DUPLICADOS O PERDIDOS? ===');
  // Buscar si hay alguna otra orden del mismo día que SÍ llegó por webhook
  const mar6 = new Date('2026-03-06T00:00:00Z');
  const mar7 = new Date('2026-03-07T23:59:59Z');

  const ordenesDia = await db.collection('mlOrderSync')
    .where('fechaOrdenML', '>=', admin.firestore.Timestamp.fromDate(mar6))
    .where('fechaOrdenML', '<=', admin.firestore.Timestamp.fromDate(mar7))
    .get();

  let webhookCount = 0;
  let importCount = 0;
  let manualCount = 0;
  let unknownCount = 0;

  for (const doc of ordenesDia.docs) {
    const d = doc.data();
    switch (d.origen) {
      case 'webhook': webhookCount++; break;
      case 'importacion_historica': importCount++; break;
      case 'manual': manualCount++; break;
      default: unknownCount++;
    }
  }

  console.log(`Órdenes del 6-7 de marzo: ${ordenesDia.size} total`);
  console.log(`  webhook: ${webhookCount}`);
  console.log(`  importacion_historica: ${importCount}`);
  console.log(`  manual: ${manualCount}`);
  console.log(`  sin origen: ${unknownCount}`);

  console.log('\n=== 5. LOGS DE CLOUD FUNCTIONS (últimas invocaciones webhook) ===');
  console.log('(Para ver logs del webhook, ejecuta: firebase functions:log --only mlwebhook)');

  process.exit(0);
})();
