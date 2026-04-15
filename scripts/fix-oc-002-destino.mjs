import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const snap = await db.collection('ordenesCompra').where('numeroOrden', '==', 'OC-2026-002').get();
if (snap.empty) { console.log('OC no encontrada'); process.exit(0); }
const d = snap.docs[0];

const casillasPeru = await db.collection('casillas')
  .where('pais', '==', 'Peru').where('estado', '==', 'activa').get();
const principal = casillasPeru.docs.find(c => c.data().esPrincipal) || casillasPeru.docs[0];

await d.ref.update({
  almacenDestino: principal.id,
  nombreAlmacenDestino: principal.data().nombre,
  modoEntregaDetallado: 'ddp_directo',
});
console.log(`✓ OC-2026-002: almacenDestino → ${principal.id} (${principal.data().nombre}), modoEntregaDetallado → ddp_directo`);
process.exit(0);
