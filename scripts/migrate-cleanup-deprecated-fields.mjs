/**
 * ===============================================
 * MIGRACIÓN: Limpieza de campos deprecados en productos
 * ===============================================
 *
 * Este script elimina campos que ya no se usan a nivel de producto:
 *   - habilitadoML (ya no se gestiona por producto)
 *   - restriccionML (ya no se gestiona por producto)
 *   - precioSugerido (reemplazado por pricing dinámico en CTRU)
 *   - margenMinimo (ahora vive en Categoría)
 *   - margenObjetivo (ahora vive en Categoría)
 *   - costoFleteUSAPeru (legacy, reemplazado por costoFleteInternacional)
 *   - costoFleteInternacional (eliminado del nivel de producto)
 *   - enlaceProveedor (ya no se usa)
 *
 * Uso:
 *   DRY RUN (solo ver qué haría):
 *     node scripts/migrate-cleanup-deprecated-fields.mjs --dry-run
 *
 *   EJECUTAR MIGRACIÓN:
 *     node scripts/migrate-cleanup-deprecated-fields.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const BATCH_SIZE = 400; // Margen bajo el límite de 500

// Colores para console
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(emoji, msg) { console.log(`${emoji} ${msg}`); }
function logDry(msg) { if (DRY_RUN) console.log(`  ${C.yellow}[DRY-RUN]${C.reset} ${msg}`); }
function logOk(msg) { console.log(`  ${C.green}OK${C.reset} ${msg}`); }
function logWarn(msg) { console.log(`  ${C.yellow}WARN${C.reset} ${msg}`); }

// Campos a eliminar
const FIELDS_TO_DELETE = [
  'habilitadoML',
  'restriccionML',
  'precioSugerido',
  'margenMinimo',
  'margenObjetivo',
  'costoFleteUSAPeru',
  'costoFleteInternacional',
  'enlaceProveedor',
];

// ============================================================
// UTILIDAD: Batch commit seguro
// ============================================================
async function batchCommit(updates) {
  if (DRY_RUN) {
    logDry(`Se actualizarían ${updates.length} docs en 'productos'`);
    return;
  }

  let committed = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const { ref, data } of chunk) {
      batch.update(ref, data);
    }
    await batch.commit();
    committed += chunk.length;
    log('  ', `  Committed ${committed}/${updates.length} docs`);
  }
  logOk(`${committed} documentos actualizados en 'productos'`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  MIGRACIÓN: Limpieza de campos deprecados en productos`);
  console.log(`  Modo: ${DRY_RUN ? `${C.yellow}DRY RUN (sin cambios)${C.reset}` : `${C.red}EJECUCIÓN REAL${C.reset}`}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!DRY_RUN) {
    log('!!', `${C.red}ATENCIÓN: Este script MODIFICARÁ datos en Firestore.${C.reset}`);
    log('!!', 'Asegúrate de tener un backup antes de continuar.');
    log('!!', 'Presiona Ctrl+C en los próximos 5 segundos para cancelar...\n');
    await new Promise(r => setTimeout(r, 5000));
  }

  try {
    // 1. Leer todos los productos
    console.log(`${C.cyan}--- Leyendo productos ---${C.reset}`);
    const snap = await db.collection('productos').get();
    log('  ', `Total documentos en 'productos': ${snap.size}`);

    // 2. Identificar cuáles tienen campos a eliminar
    const updates = [];
    const fieldCounts = {};
    FIELDS_TO_DELETE.forEach(f => { fieldCounts[f] = 0; });

    for (const doc of snap.docs) {
      const data = doc.data();
      const deleteData = {};
      let hasFieldsToDelete = false;

      for (const field of FIELDS_TO_DELETE) {
        if (data[field] !== undefined) {
          deleteData[field] = FieldValue.delete();
          fieldCounts[field]++;
          hasFieldsToDelete = true;
        }
      }

      if (hasFieldsToDelete) {
        updates.push({ ref: doc.ref, data: deleteData });
      }
    }

    // 3. Mostrar resumen por campo
    console.log(`\n${C.cyan}--- Campos encontrados ---${C.reset}`);
    for (const field of FIELDS_TO_DELETE) {
      const count = fieldCounts[field];
      const status = count > 0 ? `${count} docs` : `${C.dim}no encontrado${C.reset}`;
      console.log(`  ${field}: ${status}`);
    }

    console.log(`\n  Total documentos a actualizar: ${updates.length} de ${snap.size}`);

    // 4. Ejecutar (o simular)
    if (updates.length === 0) {
      logOk('No hay campos deprecados que eliminar. La colección ya está limpia.');
    } else {
      console.log(`\n${C.cyan}--- Eliminando campos ---${C.reset}`);
      await batchCommit(updates);
    }

    // 5. Verificación post-migración
    if (!DRY_RUN && updates.length > 0) {
      console.log(`\n${C.cyan}--- VERIFICACIÓN POST-MIGRACIÓN ---${C.reset}`);
      const verifySnap = await db.collection('productos').get();
      let remainingFields = 0;

      for (const doc of verifySnap.docs) {
        const data = doc.data();
        for (const field of FIELDS_TO_DELETE) {
          if (data[field] !== undefined) {
            remainingFields++;
            logWarn(`Doc ${doc.id} aún tiene campo '${field}'`);
          }
        }
      }

      if (remainingFields === 0) {
        logOk('VERIFICACIÓN: Todos los campos deprecados fueron eliminados correctamente.');
      } else {
        logWarn(`VERIFICACIÓN: Aún quedan ${remainingFields} campos sin eliminar.`);
      }
    }

    // Resumen final
    console.log(`\n${C.cyan}--- RESUMEN FINAL ---${C.reset}`);
    console.log(`  Documentos revisados:    ${snap.size}`);
    console.log(`  Documentos actualizados: ${updates.length}`);
    console.log(`  Campos eliminados:       ${FIELDS_TO_DELETE.join(', ')}`);
    console.log();

    if (DRY_RUN) {
      log('  ', `${C.yellow}Esto fue un DRY RUN. Para ejecutar realmente:${C.reset}`);
      log('  ', `   node scripts/migrate-cleanup-deprecated-fields.mjs --execute`);
    } else {
      log('  ', `${C.green}Migración completada exitosamente.${C.reset}`);
    }

  } catch (error) {
    console.error(`\n${C.red}ERROR EN MIGRACIÓN:${C.reset}`, error);
    process.exit(1);
  }
}

main();
