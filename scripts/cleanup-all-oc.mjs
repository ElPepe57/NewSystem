/**
 * Limpia TODAS las OCs y sus dependencias (unidades, envíos, movimientos).
 * Resyncea contadores transaccionales al final.
 *
 * SOLO PARA TESTING.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const apply = process.argv.includes('--apply');

console.log('═══════════════════════════════════════════');
console.log('  LIMPIEZA TOTAL DE OCs (TESTING)');
console.log('═══════════════════════════════════════════');

const ocSnap = await db.collection('ordenesCompra').get();
console.log(`📋 OCs encontradas: ${ocSnap.size}`);
ocSnap.forEach(d => {
  const oc = d.data();
  console.log(`  ${oc.numeroOrden} (${oc.estado}) — ${oc.nombreProveedor} — $${oc.totalUSD?.toFixed(2)}`);
});

const ocIds = ocSnap.docs.map(d => d.id);

// Buscar dependencias
const allUnidades = [];
const allEnvios = [];
const allMovs = [];
for (const ocId of ocIds) {
  const u = await db.collection('unidades').where('ordenCompraId', '==', ocId).get();
  const e = await db.collection('envios').where('ordenCompraId', '==', ocId).get();
  const m = await db.collection('movimientosTesoreria').where('ordenCompraId', '==', ocId).get();
  u.forEach(d => allUnidades.push(d));
  e.forEach(d => allEnvios.push(d));
  m.forEach(d => allMovs.push(d));
}
// También unidades sin OC (por si quedan huérfanas)
const orfanasU = await db.collection('unidades').get();
const ufaltantes = orfanasU.docs.filter(d => !ocIds.includes(d.data().ordenCompraId) && !allUnidades.find(u => u.id === d.id));

console.log(`\n🔍 Dependencias:`);
console.log(`  Unidades: ${allUnidades.length}`);
console.log(`  Envíos: ${allEnvios.length}`);
console.log(`  Movimientos tesorería: ${allMovs.length}`);
if (ufaltantes.length > 0) console.log(`  ⚠ Unidades huérfanas detectadas: ${ufaltantes.length}`);

const total = ocSnap.size + allUnidades.length + allEnvios.length + allMovs.length;
console.log(`\n📊 Total docs a eliminar: ${total}`);

if (!apply) { console.log('\n🔍 DRY RUN — agrega --apply'); process.exit(0); }

// Eliminar en chunks
async function deleteChunks(docs, label) {
  if (docs.length === 0) return;
  const chunks = [];
  for (let i = 0; i < docs.length; i += 450) chunks.push(docs.slice(i, i + 450));
  for (const c of chunks) {
    const b = db.batch();
    c.forEach(d => b.delete(d.ref));
    await b.commit();
  }
  console.log(`  ✓ ${label}: ${docs.length}`);
}

console.log('\n🗑️  Eliminando...');
await deleteChunks(allMovs, 'Movimientos tesorería');
await deleteChunks(allUnidades, 'Unidades');
await deleteChunks(allEnvios, 'Envíos');
await deleteChunks(ocSnap.docs, 'OCs');

// Devolver saldos a cuentas (los pagos fueron eliminados con movs)
console.log('\n🔄 Reseteando contadores transaccionales...');
const TX = [
  { re: /^OC-\d{4}$/,    col: 'ordenesCompra' },
  { re: /^ENV-\d{4}$/,   col: 'envios' },
  { re: /^MOV-\d{4}$/,   col: 'movimientosTesoreria' },
];
const cs = await db.collection('contadores').get();
const cb = db.batch();
let resetCount = 0;
for (const c of cs.docs) {
  const m = TX.find(t => t.re.test(c.id));
  if (!m) continue;
  const cs2 = await db.collection(m.col).get();
  if (cs2.size === 0 && (c.data().current || 0) !== 0) {
    cb.set(c.ref, { current: 0, updatedAt: new Date() }, { merge: true });
    console.log(`  ${c.id}: ${c.data().current} → 0`);
    resetCount++;
  }
}
if (resetCount > 0) await cb.commit();
console.log(`✅ Limpieza completa: ${total} docs eliminados, ${resetCount} contadores reseteados.`);
process.exit(0);
