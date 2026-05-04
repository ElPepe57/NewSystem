/**
 * Migración una sola vez · Asignar costoFleteInternacional a productos por línea
 *
 * Solicitado por usuario · 2026-05-03
 *   - Suplementos (lineaNegocioNombre matching /sup|vita/i) → $5 USD
 *   - Skincare    (lineaNegocioNombre matching /skin/i)     → $3 USD
 *
 * Modo: SOBREESCRIBE el flete actual de cada producto (incluyendo los que ya tienen).
 * Razón: el usuario pidió "a TODOS" sin condicional.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const FLETE_SUP = 5;
const FLETE_SKC = 3;

console.log('═══════════════════════════════════════════════════════════');
console.log('Migración fletes por línea · Productos');
console.log(`  Suplementos → $${FLETE_SUP} USD`);
console.log(`  Skincare    → $${FLETE_SKC} USD`);
console.log('═══════════════════════════════════════════════════════════\n');

const productosSnap = await db.collection('productos').get();
console.log(`Total productos en la colección: ${productosSnap.size}\n`);

const updates = [];
let countSUP = 0;
let countSKC = 0;
let countOtros = 0;
let countSinLinea = 0;

for (const doc of productosSnap.docs) {
  const data = doc.data();
  const lineaNombre = (data.lineaNegocioNombre ?? '').toLowerCase();
  const fleteActual = data.costoFleteInternacional ?? null;

  let nuevoFlete = null;
  let bucket = '';

  if (/sup|vita/.test(lineaNombre)) {
    nuevoFlete = FLETE_SUP;
    bucket = 'SUP';
  } else if (/skin/.test(lineaNombre)) {
    nuevoFlete = FLETE_SKC;
    bucket = 'SKC';
  } else if (!lineaNombre) {
    countSinLinea++;
    continue;
  } else {
    countOtros++;
    continue;
  }

  updates.push({
    id: doc.id,
    sku: data.sku,
    nombre: data.nombreComercial,
    lineaNombre: data.lineaNegocioNombre,
    bucket,
    fleteActual,
    nuevoFlete,
  });

  if (bucket === 'SUP') countSUP++;
  else if (bucket === 'SKC') countSKC++;
}

console.log(`Productos a actualizar:`);
console.log(`  Suplementos: ${countSUP}`);
console.log(`  Skincare:    ${countSKC}`);
console.log(`  ──────────────────`);
console.log(`  Total:       ${updates.length}`);
console.log(`  Otras líneas (no se tocan): ${countOtros}`);
console.log(`  Sin línea (no se tocan):    ${countSinLinea}\n`);

if (updates.length === 0) {
  console.log('Nada que actualizar. Saliendo.');
  process.exit(0);
}

console.log('Sample (primeros 3 SUP y primeros 3 SKC):');
const sample = [
  ...updates.filter(u => u.bucket === 'SUP').slice(0, 3),
  ...updates.filter(u => u.bucket === 'SKC').slice(0, 3),
];
for (const s of sample) {
  console.log(`  [${s.bucket}] ${s.sku} · ${s.nombre} · ${s.fleteActual === null ? 'sin flete' : `$${s.fleteActual}`} → $${s.nuevoFlete}`);
}

console.log('\nEjecutando updates en lotes de 100 (transacciones batch)...\n');

const BATCH_SIZE = 100;
let actualizados = 0;
let errores = 0;

for (let i = 0; i < updates.length; i += BATCH_SIZE) {
  const lote = updates.slice(i, i + BATCH_SIZE);
  const batch = db.batch();
  for (const u of lote) {
    const ref = db.collection('productos').doc(u.id);
    batch.update(ref, { costoFleteInternacional: u.nuevoFlete });
  }
  try {
    await batch.commit();
    actualizados += lote.length;
    console.log(`  ✓ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${lote.length} actualizados (acumulado ${actualizados}/${updates.length})`);
  } catch (err) {
    errores += lote.length;
    console.error(`  ✗ Lote ${Math.floor(i / BATCH_SIZE) + 1} falló:`, err.message);
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('Resumen final:');
console.log(`  ✓ Actualizados: ${actualizados}`);
if (errores > 0) console.log(`  ✗ Errores:      ${errores}`);
console.log('═══════════════════════════════════════════════════════════');
process.exit(errores > 0 ? 1 : 0);
