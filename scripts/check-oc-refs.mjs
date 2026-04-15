import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const snap = await db.collection('ordenesCompra').orderBy('fechaCreacion', 'desc').limit(1).get();
const oc = snap.docs[0].data();
const id = snap.docs[0].id;

console.log(`\nRevisando refs de ${oc.numeroOrden} (doc ${id})\n`);

// Campos clave
console.log('estado           :', oc.estado);
console.log('estadoPago       :', oc.estadoPago);
console.log('lineaNegocioId   :', oc.lineaNegocioId || '⚠ FALTA');
console.log('modoEntrega      :', oc.modoEntrega);
console.log('modoEntregaDet.  :', oc.modoEntregaDetallado);
console.log('colabTransporteId:', oc.colaboradorTransporteId);
console.log('almacenDestino   :', oc.almacenDestino || '⚠ VACÍO');
console.log('casillaDestinoId :', oc.casillaDestinoId || '—');
console.log('proveedorId      :', oc.proveedorId);
console.log('# subOrdenes     :', (oc.subOrdenes || []).length);

async function checkDoc(col, id, label) {
  if (!id) return console.log(`  ${label.padEnd(20)} (sin id)`);
  const d = await db.collection(col).doc(id).get();
  console.log(`  ${label.padEnd(20)} ${col}/${id} → ${d.exists ? '✓ existe' : '❌ NO EXISTE'}`);
}

console.log('\nValidando referencias:');
await checkDoc('proveedores', oc.proveedorId, 'proveedorId');
await checkDoc('lineasNegocio', oc.lineaNegocioId, 'lineaNegocioId');
await checkDoc('colaboradores', oc.colaboradorTransporteId, 'colabTransporteId');
if (oc.almacenDestino) {
  const casillaDoc = await db.collection('casillas').doc(oc.almacenDestino).get();
  const almacenDoc = await db.collection('almacenes').doc(oc.almacenDestino).get();
  const colabDoc = await db.collection('colaboradores').doc(oc.almacenDestino).get();
  console.log(`  almacenDestino       id=${oc.almacenDestino}`);
  console.log(`    en casillas     → ${casillaDoc.exists ? '✓' : '✗'}`);
  console.log(`    en almacenes    → ${almacenDoc.exists ? '✓' : '✗'}`);
  console.log(`    en colaboradores→ ${colabDoc.exists ? '✓' : '✗'}`);
  if (!casillaDoc.exists && !almacenDoc.exists && !colabDoc.exists) {
    console.log(`    ⚠ HUÉRFANO — ningún doc coincide`);
  }
}

console.log('\nSub-órdenes:');
(oc.subOrdenes || []).forEach((s, i) => {
  console.log(`  [${i}] ${s.id} estado=${s.estado} envioId=${s.envioId || '—'} envioNumero=${s.envioNumero || '—'}`);
});

// Validar envíos
console.log('\nEnvíos referenciados:');
for (const sub of (oc.subOrdenes || [])) {
  if (!sub.envioId) continue;
  const envioDoc = await db.collection('envios').doc(sub.envioId).get();
  console.log(`  ${sub.envioNumero || sub.envioId} → ${envioDoc.exists ? '✓ existe' : '❌ NO EXISTE'}`);
}

console.log('\n');
process.exit(0);
