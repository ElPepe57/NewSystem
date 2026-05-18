/**
 * ===============================================
 * MIGRACIÓN: categoriasCosto (sin S · legacy) → categoriasCostos (con S · canon)
 * ===============================================
 *
 * chk5.C-FIX (2026-05-11) · resuelve bug estructural de naming descubierto
 * durante UAT de Gastos rework v3.
 *
 * Contexto del bug:
 *   - app (src/config/collections.ts:78) y firestore.rules:151 leen de `categoriasCostos`
 *   - 5 scripts legacy escribieron en `categoriasCosto` (SIN S al final)
 *   - Resultado: 64 docs canónicos quedaron en la colección huérfana inaccesible
 *     desde el frontend (security rules sólo cubren `categoriasCostos`)
 *
 * Esta migración:
 *   1. Lee todos los docs de `categoriasCosto` (sin S)
 *   2. Para cada doc, verifica si existe match en `categoriasCostos` (con S)
 *      por (bloque + nombre + nivel)
 *   3. Si NO existe el match → copia el doc preservando los datos
 *   4. Si SÍ existe → skip (evita duplicados)
 *   5. Reporta totales · NO borra la colección legacy (manual cleanup después)
 *
 * Idempotente: re-ejecutable sin generar duplicados.
 *
 * Uso:
 *   DRY RUN (default · sólo simula):
 *     node scripts/migrate-categorias-costos-naming.mjs
 *
 *   EJECUTAR:
 *     node scripts/migrate-categorias-costos-naming.mjs --execute
 *
 * Pre-requisitos:
 *   - GOOGLE_APPLICATION_CREDENTIALS configurado o gcloud auth default
 *   - Permisos de read+write en ambas colecciones del proyecto activo
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'businessmn-269c9';
initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', gray: '\x1b[90m',
};

const LEGACY_COLL = 'categoriasCosto';   // sin S · huérfana
const CANON_COLL  = 'categoriasCostos';  // con S · canon app

function buildKey(doc) {
  return `${doc.bloque}::${(doc.nombre || '').toLowerCase()}::${doc.nivel ?? 0}`;
}

async function main() {
  console.log(`\n${C.bold}═══ MIGRACIÓN categoriasCosto → categoriasCostos ═══${C.reset}`);
  console.log(`${C.gray}Proyecto: ${PROJECT_ID}${C.reset}`);
  console.log(`${C.gray}Modo: ${DRY_RUN ? 'DRY RUN (simulación)' : 'EJECUCIÓN REAL'}${C.reset}\n`);

  // Fase 1 · Leer ambas colecciones
  const [legacySnap, canonSnap] = await Promise.all([
    db.collection(LEGACY_COLL).get(),
    db.collection(CANON_COLL).get(),
  ]);

  console.log(`${C.cyan}▸ Fase 1 · Estado actual${C.reset}`);
  console.log(`  Legacy "${LEGACY_COLL}": ${legacySnap.size} docs`);
  console.log(`  Canon  "${CANON_COLL}":  ${canonSnap.size} docs\n`);

  if (legacySnap.size === 0) {
    console.log(`${C.green}✓ No hay nada que migrar.${C.reset}\n`);
    return;
  }

  // Fase 2 · Indexar canon por key (bloque + nombre + nivel) → docId
  // Usado para detectar duplicados y mantener el mapeo padre legacy → padre canon
  // (necesario para que los hijos apunten al ID correcto del padre canon)
  const canonByKey = new Map();
  const canonById = new Map();
  for (const d of canonSnap.docs) {
    const data = d.data();
    canonByKey.set(buildKey(data), { id: d.id, data });
    canonById.set(d.id, { id: d.id, data });
  }

  console.log(`${C.cyan}▸ Fase 2 · Construir mapeo legacy → canon${C.reset}`);

  // Para cada doc legacy, determinar si ya tiene match en canon
  const legacyDocs = legacySnap.docs.map(d => ({ legacyId: d.id, ...d.data() }));

  // Mapeo legacy padre ID → canon padre ID (para re-vincular hijos)
  const padreLegacyToCanon = new Map();

  // Primero indexar todos los padres legacy y sus matches canon
  for (const doc of legacyDocs) {
    if (doc.nivel !== 0) continue;
    const key = buildKey(doc);
    const match = canonByKey.get(key);
    if (match) padreLegacyToCanon.set(doc.legacyId, match.id);
  }

  console.log(`  Padres legacy con match canon: ${padreLegacyToCanon.size}`);

  // Fase 3 · Migrar (padres primero, luego hijos)
  console.log(`\n${C.cyan}▸ Fase 3 · Migrar documentos${C.reset}`);
  let creados = 0;
  let saltadosDup = 0;
  let saltadosSinPadre = 0;

  // Pasar 2 veces: primero padres, después hijos (para que padreLegacyToCanon se complete)
  for (const fase of [0, 1]) {
    for (const doc of legacyDocs) {
      if (doc.nivel !== fase) continue;
      const key = buildKey(doc);

      if (canonByKey.has(key)) {
        saltadosDup++;
        continue;
      }

      // Si es hijo (nivel=1), necesita re-vincular su categoriaPadreId
      let nuevoPadreId = doc.categoriaPadreId;
      if (doc.nivel === 1 && doc.categoriaPadreId) {
        const padreCanon = padreLegacyToCanon.get(doc.categoriaPadreId);
        if (!padreCanon) {
          // Intentar resolver vía padre canon mismo nombre/bloque
          const padreLegacy = legacyDocs.find(p => p.legacyId === doc.categoriaPadreId);
          if (padreLegacy) {
            const padreCanonByName = canonByKey.get(buildKey(padreLegacy));
            if (padreCanonByName) nuevoPadreId = padreCanonByName.id;
            else {
              console.log(`  ${C.yellow}⚠ Hijo "${doc.nombre}" no encontró padre en canon · skip${C.reset}`);
              saltadosSinPadre++;
              continue;
            }
          }
        } else {
          nuevoPadreId = padreCanon;
        }
      }

      // Construir el nuevo doc · preservar todos los campos
      const { legacyId: _legacyId, ...payload } = doc;
      if (nuevoPadreId !== doc.categoriaPadreId) {
        payload.categoriaPadreId = nuevoPadreId;
      }
      // Marcar metadata de migración
      payload.migradoDesde = 'categoriasCosto';
      payload.fechaMigracion = Timestamp.now();

      if (DRY_RUN) {
        console.log(`  ${C.gray}[DRY] crearía: ${doc.bloque}/${doc.nombre} (nivel ${doc.nivel})${C.reset}`);
      } else {
        const ref = await db.collection(CANON_COLL).add(payload);
        // Si era padre, registrar el nuevo ID para hijos posteriores
        if (doc.nivel === 0) {
          padreLegacyToCanon.set(doc.legacyId, ref.id);
        }
        console.log(`  ${C.green}✓ creado: ${doc.bloque}/${doc.nombre} → ${ref.id}${C.reset}`);
      }
      creados++;
    }
  }

  // Fase 4 · Reporte final
  console.log(`\n${C.cyan}▸ Fase 4 · Resumen${C.reset}`);
  console.log(`  ${C.green}${creados} docs ${DRY_RUN ? 'a crear' : 'creados'}${C.reset}`);
  console.log(`  ${C.gray}${saltadosDup} skipped (duplicado ya en canon)${C.reset}`);
  if (saltadosSinPadre > 0) {
    console.log(`  ${C.red}${saltadosSinPadre} hijos sin padre canon (revisar manual)${C.reset}`);
  }

  if (!DRY_RUN) {
    const finalSnap = await db.collection(CANON_COLL).get();
    const padres = finalSnap.docs.filter(d => d.data().nivel === 0).length;
    const hijos = finalSnap.docs.filter(d => d.data().nivel === 1).length;
    console.log(`\n${C.bold}Estado final ${CANON_COLL}: ${finalSnap.size} docs (${padres} padres + ${hijos} hijos)${C.reset}`);
  } else {
    console.log(`\n${C.yellow}Re-ejecutá con --execute para aplicar.${C.reset}`);
  }
  console.log();
}

main().catch(err => {
  console.error(`${C.red}${C.bold}Error de migración:${C.reset}`, err);
  process.exit(1);
});
