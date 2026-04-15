/**
 * Sincroniza Envíos en borrador cuya OC ya está en estado de despacho.
 * Útil para limpiar inconsistencias generadas antes del fix S38-011.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const ESTADOS_DESPACHO = ['en_proceso', 'en_transito', 'enviada', 'despachada'];
const apply = process.argv.includes('--apply');

const enviosSnap = await db.collection('envios').where('estado', '==', 'borrador').get();
console.log(`Envíos en borrador: ${enviosSnap.size}\n`);

const fixes = [];
for (const e of enviosSnap.docs) {
  const env = e.data();
  if (!env.ordenCompraId) continue;
  const ocDoc = await db.collection('ordenesCompra').doc(env.ordenCompraId).get();
  if (!ocDoc.exists) continue;
  const oc = ocDoc.data();
  if (ESTADOS_DESPACHO.includes(oc.estado)) {
    fixes.push({ envId: e.id, envNum: env.numeroEnvio, ocNum: oc.numeroOrden, ocEstado: oc.estado });
    console.log(`  ${env.numeroEnvio} (borrador) ← OC ${oc.numeroOrden} (${oc.estado}) — necesita activar`);
  }
}

if (fixes.length === 0) { console.log('\nTodo sincronizado.'); process.exit(0); }
if (!apply) { console.log('\n🔍 DRY RUN — agrega --apply'); process.exit(0); }

console.log('\n✍️  Activando envíos...');
const batch = db.batch();
fixes.forEach(f => {
  batch.update(db.collection('envios').doc(f.envId), {
    estado: 'en_transito',
    fechaSalida: Timestamp.now(),
  });
});
await batch.commit();
console.log(`✅ ${fixes.length} envíos activados (sin courier/tracking — completar desde UI cuando llegue info)`);
process.exit(0);
