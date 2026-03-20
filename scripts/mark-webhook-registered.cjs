const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

(async () => {
  const WEBHOOK_URL = 'https://us-central1-businessmn-269c9.cloudfunctions.net/mlwebhook';
  
  await db.collection('mlConfig').doc('settings').update({
    webhookUrl: WEBHOOK_URL,
    webhookRegistered: true,
    webhookRegisteredAt: admin.firestore.Timestamp.now(),
  });
  
  console.log('Firestore actualizado:');
  console.log('  webhookUrl:', WEBHOOK_URL);
  console.log('  webhookRegistered: true');
  console.log('\nAhora ve a ML DevCenter y configura la URL de notificaciones.');
  process.exit(0);
})();
