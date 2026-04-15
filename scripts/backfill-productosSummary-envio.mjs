/**
 * Reconstruye productosSummary y pesoTotalLibras de envíos existentes
 * que se crearon antes del fix.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const apply = process.argv.includes('--apply');
const snap = await db.collection('envios').get();
console.log(`Revisando ${snap.size} envíos...\n`);

const fixes = [];
for (const d of snap.docs) {
  const env = d.data();
  const unidades = env.unidades || [];
  const summaryCurrent = env.productosSummary || [];
  if (summaryCurrent.length > 0 || unidades.length === 0) continue;

  const summaryMap = new Map();
  let pesoTotal = 0;
  for (const u of unidades) {
    const key = u.productoId;
    if (!key) continue;
    const ex = summaryMap.get(key);
    if (ex) ex.cantidad += 1;
    else summaryMap.set(key, { productoId: key, sku: u.sku || '', nombre: u.nombre || '', cantidad: 1 });
    if (u.pesoLibras) pesoTotal += u.pesoLibras;
  }
  const newSummary = Array.from(summaryMap.values());
  fixes.push({ id: d.id, num: env.numeroEnvio, count: newSummary.length, peso: pesoTotal, summary: newSummary });
  console.log(`  ${env.numeroEnvio}: ${newSummary.length} productos summary, ${pesoTotal.toFixed(2)} lb`);
}

if (fixes.length === 0) { console.log('Nada que backfillear.'); process.exit(0); }
if (!apply) { console.log('\n🔍 DRY RUN — agrega --apply'); process.exit(0); }

const batch = db.batch();
for (const f of fixes) {
  const updates = { productosSummary: f.summary };
  if (f.peso > 0) updates.pesoTotalLibras = Math.round(f.peso * 100) / 100;
  batch.update(db.collection('envios').doc(f.id), updates);
}
await batch.commit();
console.log(`✅ ${fixes.length} envíos backfilled.`);
process.exit(0);
