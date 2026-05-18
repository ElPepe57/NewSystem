/**
 * ===============================================
 * CLEANUP: borrar colección huérfana categoriasCosto (sin S · legacy)
 * ===============================================
 *
 * chk5.C-FIX-B7 cierre (2026-05-15) · resuelve DEUDA-CATEGORIAS-LEGACY-CLEANUP
 *
 * Contexto:
 *   - La colección canon es `categoriasCostos` (CON S · accesible desde frontend)
 *   - La colección huérfana es `categoriasCosto` (SIN S · sin firestore.rules)
 *   - Los 64 docs en la huérfana ya fueron MIGRADOS a la canon en chk5.C-FIX-B7
 *     vía `scripts/migrate-categorias-costos-naming.mjs`
 *   - Pre-requisito · verificar que NINGÚN gasto en BD apunte a un docId que
 *     SÓLO exista en la legacy (es decir · que no esté ya migrado)
 *
 * Fases:
 *   1. Indexar IDs de docs en ambas colecciones
 *   2. Identificar docs legacy SIN match en canon (por bloque+nombre+nivel) ·
 *      esos NO se deben borrar (gastos pueden seguir apuntando)
 *   3. Verificar gastos · si algún gasto.categoriaCostoId apunta a la legacy ·
 *      reporta y aborta
 *   4. Si todo OK · borrar los 64 docs de la legacy
 *
 * Idempotente · re-ejecutable.
 *
 * Uso:
 *   DRY RUN:  node scripts/cleanup-categorias-costos-legacy.mjs
 *   EJECUTAR: node scripts/cleanup-categorias-costos-legacy.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'businessmn-269c9';
initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();
const DRY_RUN = !process.argv.includes('--execute');

const C = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', gray: '\x1b[90m' };

const LEGACY_COLL = 'categoriasCosto';
const CANON_COLL = 'categoriasCostos';

function buildKey(doc) {
  return `${doc.bloque}::${(doc.nombre || '').toLowerCase()}::${doc.nivel ?? 0}`;
}

async function main() {
  console.log(`\n${C.bold}═══ CLEANUP categoriasCosto (legacy) ═══${C.reset}`);
  console.log(`${C.gray}Proyecto: ${PROJECT_ID} · Modo: ${DRY_RUN ? 'DRY RUN' : 'EJECUCIÓN REAL'}${C.reset}\n`);

  // ── Fase 1 · Indexar ambas colecciones ──────────────────────────────
  const [legacySnap, canonSnap, gastosSnap] = await Promise.all([
    db.collection(LEGACY_COLL).get(),
    db.collection(CANON_COLL).get(),
    db.collection('gastos').get(),
  ]);

  console.log(`${C.cyan}▸ Fase 1 · Estado actual${C.reset}`);
  console.log(`  Legacy  "${LEGACY_COLL}":  ${legacySnap.size} docs`);
  console.log(`  Canon   "${CANON_COLL}":   ${canonSnap.size} docs`);
  console.log(`  Gastos  "gastos":        ${gastosSnap.size} docs\n`);

  if (legacySnap.size === 0) {
    console.log(`${C.green}✓ Colección legacy ya está vacía. Nada que limpiar.${C.reset}\n`);
    return;
  }

  // ── Fase 2 · Indexar canon por key (bloque+nombre+nivel) ────────────
  const canonByKey = new Map();
  for (const d of canonSnap.docs) {
    canonByKey.set(buildKey(d.data()), { id: d.id });
  }

  // Identificar docs legacy SIN match en canon
  const legacySinMatchCanon = [];
  for (const d of legacySnap.docs) {
    if (!canonByKey.has(buildKey(d.data()))) {
      legacySinMatchCanon.push({ id: d.id, ...d.data() });
    }
  }

  if (legacySinMatchCanon.length > 0) {
    console.log(`${C.red}${C.bold}⚠ ${legacySinMatchCanon.length} docs legacy NO tienen match en canon:${C.reset}`);
    legacySinMatchCanon.slice(0, 10).forEach(d => {
      console.log(`  ${C.red}· ${d.id} → ${d.bloque}/${d.nombre} (nivel ${d.nivel})${C.reset}`);
    });
    console.log(`${C.yellow}\nDebería ejecutarse migrate-categorias-costos-naming.mjs --execute primero.${C.reset}\n`);
    process.exit(1);
  }

  console.log(`${C.green}✓ Todos los ${legacySnap.size} docs legacy tienen match en canon${C.reset}\n`);

  // ── Fase 3 · Verificar que ningún gasto apunte a docId legacy ───────
  console.log(`${C.cyan}▸ Fase 3 · Verificar referencias desde gastos${C.reset}`);
  const legacyIds = new Set(legacySnap.docs.map(d => d.id));
  const gastosHuerfanos = [];

  for (const g of gastosSnap.docs) {
    const data = g.data();
    if (data.categoriaCostoId && legacyIds.has(data.categoriaCostoId)) {
      gastosHuerfanos.push({ id: g.id, numero: data.numeroGasto, categoriaCostoId: data.categoriaCostoId });
    }
  }

  if (gastosHuerfanos.length > 0) {
    console.log(`${C.red}${C.bold}⚠ ${gastosHuerfanos.length} gastos apuntan a docs legacy:${C.reset}`);
    gastosHuerfanos.slice(0, 10).forEach(g => {
      console.log(`  ${C.red}· gasto ${g.numero || g.id} → categoriaCostoId=${g.categoriaCostoId}${C.reset}`);
    });
    console.log(`${C.yellow}\nDeberían re-vincularse a docs canon antes de borrar la legacy.${C.reset}\n`);
    process.exit(1);
  }

  console.log(`${C.green}✓ Ningún gasto apunta a docId legacy${C.reset}\n`);

  // ── Fase 4 · Borrar docs legacy ─────────────────────────────────────
  console.log(`${C.cyan}▸ Fase 4 · ${DRY_RUN ? 'Simular' : 'Ejecutar'} borrado${C.reset}`);

  let borrados = 0;
  for (const d of legacySnap.docs) {
    if (DRY_RUN) {
      console.log(`  ${C.gray}[DRY] borraría: ${d.id} → ${d.data().bloque}/${d.data().nombre}${C.reset}`);
    } else {
      await d.ref.delete();
      console.log(`  ${C.green}✓ borrado: ${d.id}${C.reset}`);
    }
    borrados++;
  }

  console.log(`\n${C.bold}${C.green}${borrados} docs ${DRY_RUN ? 'a borrar' : 'borrados'}${C.reset}`);

  if (!DRY_RUN) {
    // Verificación post-borrado
    const finalSnap = await db.collection(LEGACY_COLL).get();
    if (finalSnap.size === 0) {
      console.log(`${C.green}${C.bold}✓ Colección ${LEGACY_COLL} eliminada completamente.${C.reset}\n`);
    } else {
      console.log(`${C.yellow}⚠ Quedan ${finalSnap.size} docs en ${LEGACY_COLL} (raro · revisar).${C.reset}\n`);
    }
  } else {
    console.log(`${C.yellow}Re-ejecutá con --execute para aplicar.${C.reset}\n`);
  }
}

main().catch(err => { console.error(`${C.red}Error:${C.reset}`, err); process.exit(1); });
