/**
 * Fix: Corregir estadoTransferencia de 'en_transito' a 'enviada' en transferencia seed
 * El flujo real usa: pendiente → enviada → recibida
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(readFileSync(resolve(__dirname, '../serviceAccountKey.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function fix() {
  // Fix transferencia document: update unidades array
  const trfRef = db.collection('transferencias').doc('trf-seed-001');
  const trfSnap = await trfRef.get();

  if (!trfSnap.exists) {
    console.log('Transferencia trf-seed-001 no encontrada');
    process.exit(1);
  }

  const trf = trfSnap.data();
  const unidadesFixed = trf.unidades.map(u => ({
    ...u,
    estadoTransferencia: u.estadoTransferencia === 'en_transito' ? 'enviada' : u.estadoTransferencia
  }));

  await trfRef.update({ unidades: unidadesFixed });
  console.log(`Transferencia: ${unidadesFixed.length} unidades corregidas a 'enviada'`);

  process.exit(0);
}

fix().catch(err => { console.error(err); process.exit(1); });
