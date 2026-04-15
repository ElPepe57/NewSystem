import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const apply = process.argv.includes('--apply');
const snap = await db.collection('envios').get();

for (const d of snap.docs) {
  const env = d.data();
  const summary = env.productosSummary || [];
  if (summary.length === 0) continue;

  // Si todos ya tienen marca y nombre real, skip
  if (summary.every(s => s.marca && s.nombre && s.nombre !== s.sku)) continue;

  const newSummary = [];
  for (const item of summary) {
    const pDoc = await db.collection('productos').doc(item.productoId).get();
    if (!pDoc.exists) {
      newSummary.push(item);
      continue;
    }
    const p = pDoc.data();
    const enriched = {
      productoId: item.productoId,
      sku: p.sku || item.sku,
      nombre: p.nombreComercial || item.nombre,
      cantidad: item.cantidad,
    };
    if (p.marca) enriched.marca = p.marca;
    if (p.presentacion) enriched.presentacion = p.presentacion;
    if (p.contenido) enriched.contenido = String(p.contenido);
    if (p.dosaje) enriched.dosaje = p.dosaje;
    if (p.sabor) enriched.sabor = p.sabor;
    if (p.pesoLibras) enriched.pesoLibras = p.pesoLibras;
    if (p.atributosSkincare) enriched.atributosSkincare = p.atributosSkincare;
    if (p.lineaNegocioId) enriched.lineaNegocioId = p.lineaNegocioId;
    newSummary.push(enriched);
  }

  console.log(`  ${env.numeroEnvio}:`);
  newSummary.forEach(s => console.log(`    ${s.sku} ${s.nombre} (${s.marca || 'sin marca'}) ${s.atributosSkincare ? 'SKC' : 'SUP'}`));

  if (apply) await d.ref.update({ productosSummary: newSummary });
}

console.log(apply ? '\n✅ Backfilled' : '\n🔍 DRY RUN — agrega --apply');
process.exit(0);
