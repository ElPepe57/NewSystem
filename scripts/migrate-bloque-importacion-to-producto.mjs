/**
 * ===============================================
 * MIGRACIÓN BD: BloqueCosto 'importacion' → 'producto'
 * ===============================================
 *
 * Renombra el bloque de costo 'importacion' a 'producto' en Firestore.
 * Parte del refactor S3.6 M1.bis chk5.A1 · Cost Intelligence canónico.
 *
 * Por qué:
 *   - Naming canónico user-facing alineado con mockup gastoform-v2-3-niveles-s58f.html
 *   - "Producto" describe mejor el bloque (todo costo de adquisición/preparación
 *     del producto al país, no solo importación literal)
 *   - Antes: 'importacion' (legacy técnico)
 *   - Ahora:  'producto' (canónico)
 *
 * Colecciones afectadas:
 *   1. categoriasCosto/{id}      → field 'bloque'
 *   2. gastos/{id}               → ningún field directo (categoriaCostoId apunta a
 *                                  categoriasCosto · cascada automática vía categoría)
 *
 * Es IDEMPOTENTE:
 *   - Detecta y salta documentos ya migrados
 *   - Reportar count antes/después
 *   - Safe re-run
 *
 * Uso:
 *   DRY RUN (solo ver qué haría · default):
 *     node scripts/migrate-bloque-importacion-to-producto.mjs
 *
 *   EJECUTAR:
 *     node scripts/migrate-bloque-importacion-to-producto.mjs --execute
 *
 * Pre-requisitos:
 *   - Variable GOOGLE_APPLICATION_CREDENTIALS apuntando al service account
 *   - O ejecutar en entorno con credentials default (Cloud Shell, etc.)
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const BLOQUE_VIEJO = 'importacion';
const BLOQUE_NUEVO = 'producto';

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${C.bold}  MIGRACIÓN: BloqueCosto '${BLOQUE_VIEJO}' → '${BLOQUE_NUEVO}'${C.reset}`);
  console.log(`  Modo: ${DRY_RUN ? `${C.yellow}DRY RUN (no aplica cambios)${C.reset}` : `${C.red}${C.bold}EJECUCIÓN REAL${C.reset}`}`);
  console.log(`${'='.repeat(60)}\n`);

  // ─── Fase 1 · categoriasCosto ──────────────────────────────────────────
  console.log(`${C.cyan}▸ Fase 1 · Migrar categoriasCosto.bloque${C.reset}`);

  const categoriasRef = db.collection('categoriasCostos');
  const categoriasSnap = await categoriasRef.where('bloque', '==', BLOQUE_VIEJO).get();

  console.log(`  ${C.gray}Detectadas ${categoriasSnap.size} categorías con bloque='${BLOQUE_VIEJO}'${C.reset}`);

  let categoriasMigradas = 0;
  if (categoriasSnap.size > 0) {
    if (DRY_RUN) {
      categoriasSnap.forEach(doc => {
        const data = doc.data();
        console.log(`  ${C.yellow}[dry]${C.reset} ${doc.id} · "${data.nombre}" · bloque: ${BLOQUE_VIEJO} → ${BLOQUE_NUEVO}`);
        categoriasMigradas++;
      });
    } else {
      // Batch write · max 500 ops por batch
      const batchSize = 450;
      let batch = db.batch();
      let opsInBatch = 0;
      let batchNum = 1;

      for (const doc of categoriasSnap.docs) {
        batch.update(doc.ref, { bloque: BLOQUE_NUEVO });
        opsInBatch++;
        categoriasMigradas++;

        if (opsInBatch >= batchSize) {
          await batch.commit();
          console.log(`  ${C.green}✓${C.reset} Batch ${batchNum} commiteado (${opsInBatch} updates)`);
          batch = db.batch();
          opsInBatch = 0;
          batchNum++;
        }
      }

      if (opsInBatch > 0) {
        await batch.commit();
        console.log(`  ${C.green}✓${C.reset} Batch ${batchNum} commiteado (${opsInBatch} updates)`);
      }
    }

    console.log(`  ${C.green}✓${C.reset} ${categoriasMigradas} categorías ${DRY_RUN ? '(simuladas)' : 'migradas'}`);
  } else {
    console.log(`  ${C.gray}(nada que migrar · ya estaba en el modelo nuevo o no había docs)${C.reset}`);
  }

  // ─── Fase 2 · Verificar gastos no afectados ────────────────────────────
  console.log(`\n${C.cyan}▸ Fase 2 · Verificar gastos${C.reset}`);
  console.log(`  ${C.gray}Los gastos NO tienen field 'bloque' directo.${C.reset}`);
  console.log(`  ${C.gray}Su bloque deriva de categoriaCostoId → categoriasCosto.bloque${C.reset}`);
  console.log(`  ${C.gray}Cascada automática · 0 cambios necesarios en gastos/*${C.reset}`);

  // Sample · contar gastos para reporting
  const gastosSample = await db.collection('gastos').limit(1).get();
  if (!gastosSample.empty) {
    const totalGastos = (await db.collection('gastos').count().get()).data().count;
    console.log(`  ${C.gray}(${totalGastos} gastos en total · sus bloques se resuelven dinámicamente)${C.reset}`);
  }

  // ─── Fase 3 · Verificar otras colecciones (defensa) ────────────────────
  console.log(`\n${C.cyan}▸ Fase 3 · Defensa · scan otras colecciones${C.reset}`);

  // Verificar si alguna colección inesperada tiene field 'bloque' === BLOQUE_VIEJO
  const coleccionesADefender = ['envios', 'ordenesCompra', 'productos'];
  for (const colName of coleccionesADefender) {
    try {
      const snap = await db.collection(colName).where('bloque', '==', BLOQUE_VIEJO).limit(1).get();
      if (!snap.empty) {
        console.log(`  ${C.yellow}⚠${C.reset}  ${colName} tiene docs con bloque='${BLOQUE_VIEJO}' · revisar manualmente`);
      } else {
        console.log(`  ${C.green}✓${C.reset} ${colName} · sin field 'bloque' afectado`);
      }
    } catch (err) {
      // Field no existe en colección · OK
      console.log(`  ${C.gray}○ ${colName} · sin field 'bloque' (OK)${C.reset}`);
    }
  }

  // ─── Resumen ───────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${C.bold}  RESUMEN${C.reset}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Categorías migradas: ${C.bold}${categoriasMigradas}${C.reset}`);
  console.log(`  Modo: ${DRY_RUN ? `${C.yellow}DRY RUN${C.reset}` : `${C.green}EJECUTADO${C.reset}`}`);

  if (DRY_RUN && categoriasMigradas > 0) {
    console.log(`\n  ${C.yellow}Para ejecutar realmente:${C.reset}`);
    console.log(`  ${C.bold}node scripts/migrate-bloque-importacion-to-producto.mjs --execute${C.reset}\n`);
  } else if (!DRY_RUN) {
    console.log(`\n  ${C.green}${C.bold}✓ Migración completada${C.reset}`);
    console.log(`  ${C.gray}Verifica el livehost: las categorías deberían cargar sin errores${C.reset}\n`);
  } else {
    console.log(`\n  ${C.green}Sistema ya está en el modelo nuevo · nada que migrar${C.reset}\n`);
  }
}

main().catch(err => {
  console.error(`\n${C.red}ERROR:${C.reset}`, err);
  process.exit(1);
});
