/**
 * MIGRACIÓN FINAL: categoriasCostos.bloque "importacion" → "producto"
 *
 * chk5.C-FIX-B7 (2026-05-11) · cleanup residual del rename de bloque legacy
 * declarado en chk5.A8 (2026-04). 12 docs sobrevivieron con bloque="importacion"
 * en la colección canon `categoriasCostos`, causando crash en `getArbol()`
 * del service ("Cannot read properties of undefined reading 'hijos'").
 *
 * Idempotente · DRY RUN default.
 *
 * Uso:
 *   node scripts/migrate-bloque-importacion-final.mjs          # DRY RUN
 *   node scripts/migrate-bloque-importacion-final.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'businessmn-269c9';
initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();
const DRY_RUN = !process.argv.includes('--execute');

const C = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', gray: '\x1b[90m' };

async function main() {
  console.log(`\n${C.bold}═══ MIGRACIÓN bloque "importacion" → "producto" ═══${C.reset}`);
  console.log(`${C.gray}Proyecto: ${PROJECT_ID} · Modo: ${DRY_RUN ? 'DRY RUN' : 'EJECUCIÓN'}${C.reset}\n`);

  const snap = await db.collection('categoriasCostos')
    .where('bloque', '==', 'importacion')
    .get();

  console.log(`Encontrados ${snap.size} docs con bloque="importacion"\n`);

  if (snap.size === 0) {
    console.log(`${C.green}✓ Nada que migrar.${C.reset}\n`);
    return;
  }

  let migrados = 0;
  for (const d of snap.docs) {
    const data = d.data();
    console.log(`  ${data.nombre} (nivel ${data.nivel}) · ${d.id}`);
    if (!DRY_RUN) {
      await d.ref.update({
        bloque: 'producto',
        bloqueLegacyMigrado: 'importacion',
        fechaMigracionBloque: Timestamp.now(),
      });
      console.log(`    ${C.green}✓ actualizado${C.reset}`);
    } else {
      console.log(`    ${C.gray}[DRY] actualizaría a bloque="producto"${C.reset}`);
    }
    migrados++;
  }

  console.log(`\n${C.bold}${C.green}${migrados} docs ${DRY_RUN ? 'a migrar' : 'migrados'}${C.reset}`);
  if (DRY_RUN) console.log(`${C.yellow}Re-ejecutá con --execute para aplicar.${C.reset}\n`);
}

main().catch(err => { console.error(`${C.red}Error:${C.reset}`, err); process.exit(1); });
