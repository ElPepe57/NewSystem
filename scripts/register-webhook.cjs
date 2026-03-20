const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

(async () => {
  // Primero verificar el estado actual
  const configDoc = await db.collection('mlConfig').doc('settings').get();
  const config = configDoc.data();
  console.log('=== ESTADO ACTUAL ===');
  console.log('connected:', config.connected);
  console.log('webhookRegistered:', config.webhookRegistered || false);
  console.log('webhookUrl:', config.webhookUrl || 'NO REGISTRADO');
  console.log('userId:', config.userId);
  
  // Verificar que hay tokens válidos
  const tokensDoc = await db.collection('mlConfig').doc('tokens').get();
  if (!tokensDoc.exists) {
    console.log('\nERROR: No hay tokens guardados. Necesitas reconectar ML.');
    process.exit(1);
  }
  const tokens = tokensDoc.data();
  const expiresAt = tokens.expiresAt ? tokens.expiresAt.toDate() : null;
  console.log('\n=== TOKENS ===');
  console.log('accessToken:', tokens.accessToken ? tokens.accessToken.substring(0, 20) + '...' : 'N/A');
  console.log('expiresAt:', expiresAt ? expiresAt.toISOString() : 'N/A');
  console.log('expired:', expiresAt ? expiresAt < new Date() : 'unknown');
  
  process.exit(0);
})();
