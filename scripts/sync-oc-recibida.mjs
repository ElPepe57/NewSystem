/**
 * Sincroniza OCs cuyos envíos ya están todos recibidos pero la OC sigue en otro estado.
 * Útil para corregir OCs que recibieron antes del fix S38-014 (sync envío→OC).
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const apply = process.argv.includes('--apply');
const ocsSnap = await db.collection('ordenesCompra').get();

for (const d of ocsSnap.docs) {
  const oc = d.data();
  if (oc.estado === 'completada' || oc.estado === 'recibida' || oc.estado === 'cancelada') continue;

  const enviosSnap = await db.collection('envios').where('ordenCompraId', '==', d.id).get();
  if (enviosSnap.empty) continue;

  const envios = enviosSnap.docs.map(e => e.data());
  const todosCompletos = envios.every(e => e.estado === 'recibida_completa' || e.estado === 'cancelada');
  const algunoConRecepcion = envios.some(e => e.estado === 'recibida_completa' || e.estado === 'recibida_parcial');

  let nuevo = null;
  if (todosCompletos) nuevo = 'completada';
  else if (algunoConRecepcion) nuevo = 'recibida_parcial';
  if (!nuevo) continue;

  console.log(`  ${oc.numeroOrden} (${oc.estado}) → ${nuevo}  [${envios.length} envíos]`);

  if (apply) {
    const updates = { estado: nuevo, ultimaEdicion: Timestamp.now() };
    if (nuevo === 'completada') updates.fechaRecibida = Timestamp.now();
    if (nuevo === 'recibida_parcial' && !oc.fechaPrimeraRecepcion) updates.fechaPrimeraRecepcion = Timestamp.now();
    await d.ref.update(updates);
  }
}

console.log(apply ? '\n✅ Aplicado' : '\n🔍 DRY RUN — agrega --apply');
process.exit(0);
