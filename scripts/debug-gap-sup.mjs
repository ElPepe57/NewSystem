import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const snap = await db.collection('productos').get();
const numerosSUP = [];
const productosSUP = [];
for (const d of snap.docs) {
  const sku = (d.data().sku || '');
  const m = sku.match(/^SUP-(\d+)$/);
  if (m) {
    numerosSUP.push(parseInt(m[1]));
    productosSUP.push({ id: d.id, sku, marca: d.data().marca, nombre: d.data().nombreComercial });
  }
}
numerosSUP.sort((a, b) => a - b);

const max = numerosSUP[numerosSUP.length - 1];
const min = numerosSUP[0];
console.log(`SUP: ${numerosSUP.length} productos · rango ${min} a ${max}`);

// Encontrar gaps (números faltantes entre min y max)
const gaps = [];
for (let i = min; i <= max; i++) {
  if (!numerosSUP.includes(i)) gaps.push(i);
}
console.log(`Números faltantes (gaps): ${gaps.length}`);
if (gaps.length > 0) {
  console.log(`  → SKUs faltantes: ${gaps.map(n => `SUP-${String(n).padStart(4, '0')}`).join(', ')}`);
}

// Detectar duplicados
const counts = {};
numerosSUP.forEach(n => counts[n] = (counts[n] || 0) + 1);
const duplicados = Object.entries(counts).filter(([_, c]) => c > 1);
if (duplicados.length > 0) {
  console.log(`Duplicados: ${duplicados.length}`);
  duplicados.forEach(([n, c]) => console.log(`  SUP-${String(n).padStart(4, '0')}: ${c} productos`));
}

process.exit(0);
