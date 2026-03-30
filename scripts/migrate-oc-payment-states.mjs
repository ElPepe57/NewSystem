/**
 * Migración: Normalizar estados de pago de OC en Firestore
 *
 * Cambia:
 *   pagada → pagado
 *   pago_parcial → parcial
 *   pendiente_pago → pendiente
 *
 * Ejecutar: node scripts/migrate-oc-payment-states.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const MAPPING = {
  'pagada': 'pagado',
  'pago_parcial': 'parcial',
  'pendiente_pago': 'pendiente',
};

async function migrate() {
  console.log('=== Migración de estados de pago OC ===\n');

  const snapshot = await db.collection('ordenesCompra').get();
  console.log(`Total OC en Firestore: ${snapshot.size}\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const estadoActual = data.estadoPago;
    const nuevoEstado = MAPPING[estadoActual];

    if (!nuevoEstado) {
      skipped++;
      continue;
    }

    try {
      await db.collection('ordenesCompra').doc(doc.id).update({
        estadoPago: nuevoEstado,
      });
      console.log(`  ✅ ${data.numeroOrden || doc.id}: ${estadoActual} → ${nuevoEstado}`);
      migrated++;
    } catch (err) {
      console.error(`  ❌ ${data.numeroOrden || doc.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== Resultado ===`);
  console.log(`Migrados: ${migrated}`);
  console.log(`Sin cambios: ${skipped}`);
  console.log(`Errores: ${errors}`);
  console.log(`Total: ${snapshot.size}`);
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
