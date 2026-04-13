/**
 * Limpieza: Eliminar envíos T1 huérfanos (totalUnidades=0, datos de prueba legacy)
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

async function main() {
  const snap = await db.collection('envios')
    .where('origenTipo', '==', 'proveedor')
    .where('totalUnidades', '==', 0)
    .get();

  console.log(`\nEnvíos T1 huérfanos encontrados: ${snap.size}\n`);

  if (snap.size === 0) {
    console.log('Nada que limpiar.');
    return;
  }

  for (const doc of snap.docs) {
    const d = doc.data();
    console.log(`  Eliminando: ${d.numeroEnvio} | estado: ${d.estado} | OC: ${d.ordenCompraId || '—'} | fecha: ${d.fechaCreacion?.toDate?.()?.toISOString?.()?.slice(0, 10)}`);
    await doc.ref.delete();
  }

  console.log(`\n✅ ${snap.size} envíos huérfanos eliminados.`);
}

main().catch(console.error);
