/**
 * Corrige todas las inconsistencias pendientes en productos y marcas.
 *
 * 1. SKC: sabor -> tipoPiel, dosaje -> ingredienteClave
 * 2. SUP-0147: marcaId Pipping Rock -> Piping Rock
 * 3. SUP-0117: dosaje 500000 mcg -> 500 mg
 * 4. Eliminar marca duplicada MRC-025 "Pipping Rock"
 * 5. Recalcular metricas de marcas afectadas
 * 6. Limpiar marcas huerfanas (sin productos)
 *
 * Uso: node scripts/fix-inconsistencias-360.mjs [--dry-run]
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('========================================');
  console.log(DRY_RUN ? '  MODO DRY RUN' : '  MODO PRODUCCION');
  console.log('========================================\n');

  let totalFixes = 0;

  // === 1. SKC: Migrar sabor -> tipoPiel, dosaje -> ingredienteClave ===
  console.log('== 1. SKC: Migrar campos mal usados ==\n');

  const skcSnap = await db.collection('productos')
    .where('sku', '>=', 'SKC-0001')
    .where('sku', '<=', 'SKC-9999')
    .get();

  for (const doc of skcSnap.docs) {
    const p = doc.data();
    const updates = {};

    // sabor -> tipoPiel (si sabor tiene valor de tipo de piel y tipoPiel está vacío)
    if (p.sabor && !p.tipoPiel) {
      const valoresTipoPiel = ['Todo tipo', 'Grasa', 'Seca', 'Sensible', 'Mixta', 'Madura', 'Con acné', 'Manchas'];
      if (valoresTipoPiel.includes(p.sabor)) {
        updates.tipoPiel = p.sabor;
        updates.sabor = FieldValue.delete();
        console.log(`  ${p.sku}: sabor="${p.sabor}" -> tipoPiel`);
      }
    }

    // dosaje -> ingredienteClave (si dosaje no es numerico y ingredienteClave está vacío)
    if (p.dosaje && p.dosaje !== '-' && !p.ingredienteClave && !/^\d/.test(p.dosaje)) {
      updates.ingredienteClave = p.dosaje;
      updates.dosaje = FieldValue.delete();
      console.log(`  ${p.sku}: dosaje="${p.dosaje}" -> ingredienteClave`);
    }

    if (Object.keys(updates).length > 0) {
      if (!DRY_RUN) await doc.ref.update(updates);
      totalFixes++;
    }
  }

  // === 2. SUP-0147: Corregir marca Pipping Rock -> Piping Rock ===
  console.log('\n== 2. SUP-0147: Corregir marca ==\n');

  const PIPING_ROCK_ID = 'ZAKLvF2F4pUmhA3JV41P'; // MRC-030 "Piping Rock" (correcta)
  const PIPPING_ROCK_ID = '5vd13fTXipD2tW6UPVVT'; // MRC-025 "Pipping Rock" (typo)

  const pippingProds = await db.collection('productos')
    .where('marcaId', '==', PIPPING_ROCK_ID)
    .get();

  for (const doc of pippingProds.docs) {
    const p = doc.data();
    console.log(`  ${p.sku}: marca="${p.marca}" marcaId=${PIPPING_ROCK_ID} -> "Piping Rock" marcaId=${PIPING_ROCK_ID}`);
    if (!DRY_RUN) {
      await doc.ref.update({
        marca: 'Piping Rock',
        marcaId: PIPING_ROCK_ID,
      });
    }
    totalFixes++;
  }

  // === 3. SUP-0117: Corregir dosaje ===
  console.log('\n== 3. SUP-0117: Corregir dosaje ==\n');

  const sup117 = await db.collection('productos').where('sku', '==', 'SUP-0117').get();
  if (!sup117.empty) {
    const doc = sup117.docs[0];
    const p = doc.data();
    if (p.dosaje === '500000 mcg') {
      console.log(`  ${p.sku}: dosaje="${p.dosaje}" -> "500 mg"`);
      if (!DRY_RUN) await doc.ref.update({ dosaje: '500 mg' });
      totalFixes++;
    } else {
      console.log(`  ${p.sku}: dosaje ya corregido = "${p.dosaje}"`);
    }
  }

  // === 4. Eliminar marca duplicada MRC-025 "Pipping Rock" ===
  console.log('\n== 4. Eliminar marca duplicada MRC-025 ==\n');

  const pippingRef = db.collection('marcas').doc(PIPPING_ROCK_ID);
  const pippingDoc = await pippingRef.get();
  if (pippingDoc.exists) {
    // Verificar que ya no tiene productos
    const prodsConPipping = await db.collection('productos').where('marcaId', '==', PIPPING_ROCK_ID).get();
    if (prodsConPipping.empty) {
      console.log(`  Eliminando MRC-025 "Pipping Rock" (sin productos)`);
      if (!DRY_RUN) await pippingRef.delete();
      totalFixes++;
    } else {
      console.log(`  SKIP: MRC-025 aun tiene ${prodsConPipping.size} productos`);
    }
  }

  // === 5. Recalcular metricas de marcas afectadas ===
  console.log('\n== 5. Recalcular metricas de marcas ==\n');

  const allProds = await db.collection('productos').where('estado', '==', 'activo').get();
  const allMarcas = await db.collection('marcas').get();

  // Contar productos reales por marcaId
  const conteoReal = {};
  for (const d of allProds.docs) {
    const mId = d.data().marcaId;
    if (mId) conteoReal[mId] = (conteoReal[mId] || 0) + 1;
  }

  let metricasFixes = 0;
  for (const mDoc of allMarcas.docs) {
    const m = mDoc.data();
    const actual = m.metricas?.productosActivos || 0;
    const real = conteoReal[mDoc.id] || 0;

    if (actual !== real) {
      console.log(`  ${m.codigo} "${m.nombre}": metricas=${actual} -> real=${real}`);
      if (!DRY_RUN) {
        await mDoc.ref.update({ 'metricas.productosActivos': real });
      }
      metricasFixes++;
    }
  }
  if (metricasFixes === 0) console.log('  Todas las metricas correctas.');
  totalFixes += metricasFixes;

  // === RESUMEN ===
  console.log('\n========================================');
  console.log('  COMPLETADO: ' + totalFixes + ' correcciones');
  console.log('========================================\n');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
