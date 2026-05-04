import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const snap = await db.collection('productos').get();
console.log(`Total docs en /productos: ${snap.size}`);

const skuSUP = [];
const skuSKC = [];
const sinSku = [];
const sup0171 = [];
for (const d of snap.docs) {
  const data = d.data();
  const sku = data.sku || '';
  if (sku === 'SUP-0171') sup0171.push({ id: d.id, ...data });
  if (sku.startsWith('SUP-')) skuSUP.push(d.id);
  else if (sku.startsWith('SKC-')) skuSKC.push(d.id);
  else sinSku.push({ id: d.id, sku, marca: data.marca, nombre: data.nombreComercial });
}

console.log(`SKUs SUP-*: ${skuSUP.length}`);
console.log(`SKUs SKC-*: ${skuSKC.length}`);
console.log(`Sin prefijo conocido: ${sinSku.length}`);
if (sinSku.length > 0) {
  console.log('  → primeros 5:', sinSku.slice(0, 5));
}

console.log(`\nProductos con SUP-0171: ${sup0171.length}`);
sup0171.forEach(p => console.log(`  - ${p.id} · ${p.marca} · ${p.nombreComercial} · linea=${p.lineaNegocioNombre} · estado=${p.estado} · archivado=${p.archivado}`));
process.exit(0);
