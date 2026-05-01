/**
 * TAREA-GASTOFORM-V2 F5 · Backfill de categoriaCostoId en gastos legacy
 *
 * Recorre todos los gastos sin `categoriaCostoId` y los vincula a una
 * categoria del nuevo modelo de 3 niveles, derivando del campo `categoria`
 * legacy:
 *   GA → bloque "importacion" · categoria padre "Manipuleo" (genérica)
 *   GD → bloque "venta"        · categoria padre "Distribución" (genérica)
 *   GV → bloque "venta"        · categoria padre "Comisiones" (genérica)
 *   GO → bloque "periodo"      · categoria padre "Operativos" (genérica)
 *
 * El operador puede luego re-categorizar manualmente desde el form.
 * El script es idempotente · gastos ya migrados se omiten.
 *
 * Uso:
 *   DRY RUN:  node scripts/reingenieria/04-backfill-gastos-categoriaCostoId.mjs --dry-run
 *   EJECUTAR: node scripts/reingenieria/04-backfill-gastos-categoriaCostoId.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const NOW = Timestamp.now();
const ADMIN_UID = 'admin-backfill';

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m',
};

// Mapeo legacy → categoria padre por defecto (nombres tal como se crean en el seed 03)
const MAPEO_LEGACY = {
  GA: { bloque: 'importacion', categoriaPadreNombre: 'Manipuleo' },
  GD: { bloque: 'venta', categoriaPadreNombre: 'Distribución' },
  GV: { bloque: 'venta', categoriaPadreNombre: 'Comisiones' },
  GO: { bloque: 'periodo', categoriaPadreNombre: 'Operativos' },
};

async function main() {
  console.log(`\n${C.bold}=== TAREA-GASTOFORM-V2 F5 · Backfill categoriaCostoId ===${C.reset}`);
  console.log(`Modo: ${DRY_RUN ? `${C.yellow}DRY-RUN${C.reset}` : `${C.red}EJECUTAR${C.reset}`}\n`);

  // 1. Cargar el árbol de categorías (de la colección categoriasCostos)
  console.log(`${C.cyan}Cargando categorías...${C.reset}`);
  const catSnap = await db.collection('categoriasCostos').get();
  const categorias = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`  ${categorias.length} categorías encontradas`);

  if (categorias.length === 0) {
    console.error(`${C.red}✗ No hay categorías en Firestore. Ejecuta primero el seed 03.${C.reset}`);
    process.exit(1);
  }

  // Construir mapa de bloque+nombre → id (solo categorías padre · nivel 0)
  const padreMap = {};
  for (const cat of categorias) {
    if (cat.nivel !== 0) continue;
    const key = `${cat.bloque}::${cat.nombre}`;
    padreMap[key] = cat.id;
  }
  console.log(`  ${Object.keys(padreMap).length} categorías padre indexadas\n`);

  // Verificar que las categorías padre objetivo existan
  for (const [legacy, mapeo] of Object.entries(MAPEO_LEGACY)) {
    const key = `${mapeo.bloque}::${mapeo.categoriaPadreNombre}`;
    if (!padreMap[key]) {
      console.warn(`${C.yellow}⚠ Categoría padre no encontrada para ${legacy}: ${key}${C.reset}`);
    }
  }

  // 2. Cargar todos los gastos
  console.log(`${C.cyan}Cargando gastos...${C.reset}`);
  const gastosSnap = await db.collection('gastos').get();
  const gastos = gastosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`  ${gastos.length} gastos en Firestore`);

  // 3. Filtrar los que necesitan backfill
  const aMigrar = gastos.filter(g => !g.categoriaCostoId && g.categoria);
  const yaMigrados = gastos.filter(g => g.categoriaCostoId);
  const sinCategoria = gastos.filter(g => !g.categoria && !g.categoriaCostoId);

  console.log(`  ${C.green}✓${C.reset} Ya migrados:    ${yaMigrados.length}`);
  console.log(`  ${C.yellow}→${C.reset} Por migrar:     ${aMigrar.length}`);
  console.log(`  ${C.red}✗${C.reset} Sin categoría:  ${sinCategoria.length} (se omiten)\n`);

  if (aMigrar.length === 0) {
    console.log(`${C.green}✓ No hay gastos para migrar. Backfill completo.${C.reset}\n`);
    return;
  }

  // 4. Procesar en batch
  const stats = { GA: 0, GD: 0, GV: 0, GO: 0, omitido: 0 };
  let batch = db.batch();
  let pending = 0;
  const BATCH_SIZE = 400;

  for (const gasto of aMigrar) {
    const mapeo = MAPEO_LEGACY[gasto.categoria];
    if (!mapeo) {
      stats.omitido++;
      continue;
    }
    const key = `${mapeo.bloque}::${mapeo.categoriaPadreNombre}`;
    const padreId = padreMap[key];
    if (!padreId) {
      stats.omitido++;
      continue;
    }

    const prefix = DRY_RUN ? `${C.yellow}[DRY]` : `${C.green}  ✔`;
    console.log(`${prefix}${C.reset} ${gasto.id.slice(0, 8)} ${gasto.categoria} → ${mapeo.categoriaPadreNombre} (${mapeo.bloque})`);

    if (!DRY_RUN) {
      const ref = db.collection('gastos').doc(gasto.id);
      batch.update(ref, {
        categoriaCostoId: padreId,
        // Marcar el evento de migración en auditoría
        ultimaEdicion: NOW,
        editadoPor: ADMIN_UID,
      });
      pending++;
      if (pending >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
    stats[gasto.categoria]++;
  }

  if (!DRY_RUN && pending > 0) {
    await batch.commit();
  }

  // 5. Resumen
  console.log(`\n${C.bold}=== Resumen ===${C.reset}`);
  console.log(`  GA → Manipuleo (importación): ${stats.GA}`);
  console.log(`  GD → Distribución (venta):    ${stats.GD}`);
  console.log(`  GV → Comisiones (venta):      ${stats.GV}`);
  console.log(`  GO → Operativos (período):    ${stats.GO}`);
  if (stats.omitido > 0) {
    console.log(`  ${C.yellow}Omitidos (sin mapeo):       ${stats.omitido}${C.reset}`);
  }
  const total = stats.GA + stats.GD + stats.GV + stats.GO;
  console.log(`\n${C.bold}Total migrado: ${total}${C.reset}`);

  if (DRY_RUN) {
    console.log(`\n${C.yellow}⓵ Modo DRY-RUN · no se persistió nada.${C.reset}`);
    console.log(`   Para ejecutar: node scripts/reingenieria/04-backfill-gastos-categoriaCostoId.mjs --execute\n`);
  } else {
    console.log(`\n${C.green}✓ Backfill completado.${C.reset}\n`);
  }
}

main().catch(err => {
  console.error(`${C.red}✗ Error:${C.reset}`, err);
  process.exit(1);
});
