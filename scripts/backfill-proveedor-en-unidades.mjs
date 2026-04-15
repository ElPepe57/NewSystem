/**
 * Backfill: rellena proveedorId / proveedorNombre / proveedorPais en todas las
 * unidades que tienen ordenCompraId pero les falta info del proveedor.
 *
 * Cambio: S38-010
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const apply = process.argv.includes('--apply');

const snap = await db.collection('unidades').get();
console.log(`Revisando ${snap.size} unidades...\n`);

if (snap.size === 0) {
  console.log('No hay unidades. Nada que hacer.');
  process.exit(0);
}

// Pre-cargar OCs en cache (más rápido que N lookups)
const ocCache = {};
const fixes = [];

for (const u of snap.docs) {
  const data = u.data();
  if (!data.ordenCompraId) continue;
  if (data.proveedorId && data.proveedorNombre && data.proveedorPais) continue; // ya completo

  if (!ocCache[data.ordenCompraId]) {
    const ocDoc = await db.collection('ordenesCompra').doc(data.ordenCompraId).get();
    ocCache[data.ordenCompraId] = ocDoc.exists ? ocDoc.data() : null;
  }
  const oc = ocCache[data.ordenCompraId];
  if (!oc) {
    console.log(`  ⚠ Unidad ${u.id} apunta a OC ${data.ordenCompraId} INEXISTENTE — saltando`);
    continue;
  }

  const updates = {};
  if (!data.proveedorId && oc.proveedorId) updates.proveedorId = oc.proveedorId;
  if (!data.proveedorNombre && oc.nombreProveedor) updates.proveedorNombre = oc.nombreProveedor;
  if (!data.proveedorPais && oc.paisOrigen) updates.proveedorPais = oc.paisOrigen;

  if (Object.keys(updates).length > 0) {
    fixes.push({ id: u.id, sku: data.productoSKU, updates });
  }
}

console.log(`Unidades a actualizar: ${fixes.length}\n`);
fixes.slice(0, 20).forEach(f => {
  console.log(`  ${f.id} (${f.sku}): ${JSON.stringify(f.updates)}`);
});
if (fixes.length > 20) console.log(`  ... y ${fixes.length - 20} más`);

if (!apply) {
  console.log('\n🔍 DRY RUN — agrega --apply para aplicar.');
  process.exit(0);
}

if (fixes.length === 0) { console.log('\nNada que actualizar.'); process.exit(0); }

// Apply en batches de 450
console.log('\n✍️  Aplicando...');
let applied = 0;
while (applied < fixes.length) {
  const chunk = fixes.slice(applied, applied + 450);
  const batch = db.batch();
  chunk.forEach(f => batch.update(db.collection('unidades').doc(f.id), f.updates));
  await batch.commit();
  applied += chunk.length;
  console.log(`  ${applied}/${fixes.length}`);
}
console.log(`✅ ${applied} unidades actualizadas.`);
process.exit(0);
