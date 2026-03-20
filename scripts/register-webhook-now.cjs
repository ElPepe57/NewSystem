const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const https = require('https');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

function mlRequest(method, path, accessToken, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'api.mercadolibre.com',
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            console.error('ML API error:', res.statusCode, JSON.stringify(parsed, null, 2));
            reject(new Error('ML API error ' + res.statusCode + ': ' + (parsed.message || JSON.stringify(parsed))));
          }
        } catch (e) {
          console.error('Raw response:', responseBody.substring(0, 500));
          reject(new Error('Failed to parse: ' + responseBody.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const CLIENT_ID = '6805464699623168';
  const WEBHOOK_URL = 'https://us-central1-businessmn-269c9.cloudfunctions.net/mlwebhook';
  
  // 1. Obtener token
  const tokensDoc = await db.collection('mlConfig').doc('tokens').get();
  const accessToken = tokensDoc.data().accessToken;
  
  // 2. Verificar config actual
  console.log('=== 1. CONFIG ACTUAL EN ML ===');
  try {
    const currentConfig = await mlRequest('GET', '/applications/' + CLIENT_ID, accessToken);
    console.log('notification_callback_url:', currentConfig.notification_callback_url || 'NO CONFIGURADA');
    console.log('notification_topics:', JSON.stringify(currentConfig.notification_topics || []));
  } catch (e) {
    console.log('Error leyendo config:', e.message);
  }
  
  // 3. Registrar webhook
  console.log('\n=== 2. REGISTRANDO WEBHOOK ===');
  try {
    const result = await mlRequest('PUT', '/applications/' + CLIENT_ID, accessToken, {
      notification_callback_url: WEBHOOK_URL,
      notification_topics: ['orders_v2', 'items', 'shipments', 'questions'],
    });
    console.log('Resultado:', JSON.stringify(result, null, 2).substring(0, 500));
  } catch (e) {
    console.log('Error registrando:', e.message);
    process.exit(1);
  }
  
  // 4. Verificar
  console.log('\n=== 3. VERIFICANDO ===');
  try {
    const verifyConfig = await mlRequest('GET', '/applications/' + CLIENT_ID, accessToken);
    console.log('notification_callback_url:', verifyConfig.notification_callback_url);
    console.log('notification_topics:', JSON.stringify(verifyConfig.notification_topics));
  } catch (e) {
    console.log('Error verificando:', e.message);
  }
  
  // 5. Actualizar Firestore
  await db.collection('mlConfig').doc('settings').update({
    webhookUrl: WEBHOOK_URL,
    webhookRegistered: true,
    webhookRegisteredAt: admin.firestore.Timestamp.now(),
  });
  console.log('\nFirestore: webhookRegistered = true');
  console.log('\nWEBHOOK REGISTRADO EXITOSAMENTE');
  process.exit(0);
})();
