/**
 * Script: Reconectar competidorId en productos con los nuevos IDs del maestro
 *
 * Lee productos.investigacion.competidoresPeru[], busca el competidor por nombre
 * en la colección maestra y actualiza el competidorId al nuevo ID.
 *
 * Uso: node scripts/reconectar-competidores-productos.mjs [--dry-run]
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

async function main() {
  console.log('=== Reconexión de competidorId en productos ===\n');
  if (DRY_RUN) console.log('🔍 MODO DRY-RUN: no se escribirá nada\n');

  // 1. Cargar maestro de competidores → mapa nombre_normalizado → id
  const compSnap = await db.collection('competidores').get();
  const maestro = new Map();
  // También mapa por nombre exacto para "On Shop" → "OnShop"
  const maestroExacto = new Map();

  compSnap.docs.forEach(doc => {
    const data = doc.data();
    maestro.set(data.nombreNormalizado, doc.id);
    maestroExacto.set(data.nombre, doc.id);
  });

  // Alias manual para unificados
  const aliases = {
    'on shop': normalizarTexto('OnShop'),
  };

  console.log(`📋 Competidores en maestro: ${maestro.size}\n`);

  // 2. Recorrer productos
  const prodSnap = await db.collection('productos').get();
  let productosActualizados = 0;
  let compsReconectados = 0;
  let compsSinMatch = [];

  const BATCH_LIMIT = 450;
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of prodSnap.docs) {
    const data = docSnap.data();
    const inv = data.investigacion;
    if (!inv || !inv.competidoresPeru || inv.competidoresPeru.length === 0) continue;

    let changed = false;
    const updatedComps = inv.competidoresPeru.map(c => {
      if (!c.nombre) return c;

      const nombreNorm = normalizarTexto(c.nombre);
      // Buscar en maestro por nombre normalizado, luego por alias
      let nuevoId = maestro.get(nombreNorm);
      if (!nuevoId && aliases[nombreNorm]) {
        nuevoId = maestro.get(aliases[nombreNorm]);
      }

      if (nuevoId && c.competidorId !== nuevoId) {
        changed = true;
        compsReconectados++;
        return { ...c, competidorId: nuevoId };
      }

      if (!nuevoId) {
        compsSinMatch.push(c.nombre);
      }

      return c;
    });

    if (changed) {
      productosActualizados++;
      if (!DRY_RUN) {
        const ref = db.collection('productos').doc(docSnap.id);
        batch.update(ref, { 'investigacion.competidoresPeru': updatedComps });
        batchCount++;

        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`   Batch commiteado: ${batchCount} productos`);
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
  }

  // Commit remaining
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    console.log(`   Batch final commiteado: ${batchCount} productos`);
  }

  // Resumen
  console.log(`\n✅ Productos actualizados: ${productosActualizados}`);
  console.log(`🔗 Competidores reconectados: ${compsReconectados}`);

  const sinMatch = [...new Set(compsSinMatch)];
  if (sinMatch.length > 0) {
    console.log(`\n⚠️  Competidores sin match en maestro (${sinMatch.length}):`);
    sinMatch.forEach(n => console.log(`   - "${n}"`));
  } else {
    console.log(`\n✨ Todos los competidores reconectados correctamente`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
