/**
 * ===============================================
 * DEDUP: pares con/sin tilde en categoriasCostos
 * ===============================================
 *
 * chk5.C-FIX-D2 (2026-05-15) · resuelve DEUDA-CATEGORIAS-DUPLICADOS
 *
 * Contexto:
 *   - El seed canon usa nombres SIN tilde (legacy histórico):
 *     "Distribucion" · "Tecnologia" · "Capacitacion" · etc.
 *   - Algunos docs custom creados via UI inline usan nombres CON tilde:
 *     "Distribución" · "Tecnología" · etc.
 *   - Resultado · pares duplicados en `categoriasCostos`
 *
 * Estrategia:
 *   1. Encontrar pares (mismo bloque + mismo nivel + nombre normalizado igual)
 *   2. Elegir SOBREVIVIENTE: el doc CON tilde (canon español correcto)
 *   3. Si no hay con-tilde · elegir el más antiguo (fechaCreacion menor)
 *   4. Re-vincular gastos · hijos · sub-categorías que apunten al duplicado
 *   5. Borrar duplicados
 *
 * Idempotente · re-ejecutable.
 *
 * Uso:
 *   DRY RUN:  node scripts/dedup-categorias-costos-tildes.mjs
 *   EJECUTAR: node scripts/dedup-categorias-costos-tildes.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'businessmn-269c9';
initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();
const DRY_RUN = !process.argv.includes('--execute');

const C = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', gray: '\x1b[90m' };

/**
 * Normaliza nombre · sin tildes · lower · sin espacios extras
 * "Distribución" → "distribucion"
 * "Tecnología"  → "tecnologia"
 */
function normalizar(nombre) {
  return (nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * ¿Este nombre tiene tildes? (preferir el con-tilde como canon español)
 */
function tieneTildes(nombre) {
  return /[áéíóúñ]/i.test(nombre || '');
}

async function main() {
  console.log(`\n${C.bold}═══ DEDUP categoriasCostos · pares con/sin tilde ═══${C.reset}`);
  console.log(`${C.gray}Proyecto: ${PROJECT_ID} · Modo: ${DRY_RUN ? 'DRY RUN' : 'EJECUCIÓN REAL'}${C.reset}\n`);

  // ── Fase 1 · Indexar categoriasCostos ───────────────────────────────
  const snap = await db.collection('categoriasCostos').get();
  console.log(`${C.cyan}▸ Fase 1 · Estado actual${C.reset}`);
  console.log(`  ${snap.size} docs en categoriasCostos\n`);

  // ── Fase 2 · Detectar grupos · misma key normalizada ────────────────
  // key = `${bloque}::${nombreNormalizado}::${nivel}`
  const grupos = new Map();
  for (const d of snap.docs) {
    const data = d.data();
    const key = `${data.bloque}::${normalizar(data.nombre)}::${data.nivel ?? 0}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push({ id: d.id, ...data });
  }

  // Filtrar solo grupos con ≥2 docs
  const duplicados = Array.from(grupos.entries()).filter(([, docs]) => docs.length >= 2);

  console.log(`${C.cyan}▸ Fase 2 · Pares duplicados detectados${C.reset}`);
  console.log(`  ${duplicados.length} grupos con duplicados\n`);

  if (duplicados.length === 0) {
    console.log(`${C.green}✓ No hay duplicados. Nada que mergear.${C.reset}\n`);
    return;
  }

  // ── Fase 3 · Para cada grupo · elegir SOBREVIVIENTE + plan de merge ─
  console.log(`${C.cyan}▸ Fase 3 · Plan de merge${C.reset}`);
  const planMerge = []; // { sobreviviente, descartados[] }

  for (const [, docs] of duplicados) {
    // Elegir sobreviviente: prefiero el que tiene tildes (canon español)
    const conTildes = docs.filter(d => tieneTildes(d.nombre));
    let sobreviviente;
    if (conTildes.length > 0) {
      sobreviviente = conTildes[0];
    } else {
      // Si ninguno tiene tildes · elegir el más antiguo
      sobreviviente = docs.sort((a, b) => {
        const fa = a.fechaCreacion?.toMillis?.() ?? 0;
        const fb = b.fechaCreacion?.toMillis?.() ?? 0;
        return fa - fb;
      })[0];
    }
    const descartados = docs.filter(d => d.id !== sobreviviente.id);
    planMerge.push({ sobreviviente, descartados });

    console.log(`  ${C.bold}${sobreviviente.bloque}/${sobreviviente.nombre}${C.reset} (sobrevive ${C.green}${sobreviviente.id}${C.reset})`);
    descartados.forEach(d => {
      console.log(`    ${C.red}✗ descartar ${d.id} · "${d.nombre}"${C.reset}`);
    });
  }

  // ── Fase 4 · Verificar referencias desde gastos y subcategorías ─────
  console.log(`\n${C.cyan}▸ Fase 4 · Verificar referencias a descartar${C.reset}`);
  const idsDescartados = new Set(planMerge.flatMap(p => p.descartados.map(d => d.id)));
  const mapDescartadoToSobreviviente = new Map();
  for (const p of planMerge) {
    for (const d of p.descartados) {
      mapDescartadoToSobreviviente.set(d.id, p.sobreviviente.id);
    }
  }

  const [gastosSnap] = await Promise.all([
    db.collection('gastos').get(),
  ]);

  // Gastos que apuntan a docs descartados
  const gastosARevincular = [];
  for (const g of gastosSnap.docs) {
    const data = g.data();
    if (data.categoriaCostoId && idsDescartados.has(data.categoriaCostoId)) {
      gastosARevincular.push({
        id: g.id,
        numero: data.numeroGasto,
        deCategoriaId: data.categoriaCostoId,
        aCategoriaId: mapDescartadoToSobreviviente.get(data.categoriaCostoId),
      });
    }
  }

  // Subcategorías (nivel=1) que apuntan como padre a un descartado
  const subcategoriasARevincular = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (data.nivel === 1 && data.categoriaPadreId && idsDescartados.has(data.categoriaPadreId)) {
      subcategoriasARevincular.push({
        id: d.id,
        nombre: data.nombre,
        dePadreId: data.categoriaPadreId,
        aPadreId: mapDescartadoToSobreviviente.get(data.categoriaPadreId),
      });
    }
  }

  console.log(`  ${gastosARevincular.length} gastos a re-vincular`);
  console.log(`  ${subcategoriasARevincular.length} subcategorías a re-vincular`);

  // ── Fase 5 · Ejecutar merge ─────────────────────────────────────────
  console.log(`\n${C.cyan}▸ Fase 5 · ${DRY_RUN ? 'Simular' : 'Ejecutar'} merge${C.reset}`);

  // 5a · Re-vincular gastos
  for (const g of gastosARevincular) {
    if (DRY_RUN) {
      console.log(`  ${C.gray}[DRY] gasto ${g.numero || g.id}: categoriaCostoId ${g.deCategoriaId} → ${g.aCategoriaId}${C.reset}`);
    } else {
      await db.collection('gastos').doc(g.id).update({ categoriaCostoId: g.aCategoriaId });
      console.log(`  ${C.green}✓ gasto ${g.numero || g.id} re-vinculado${C.reset}`);
    }
  }

  // 5b · Re-vincular subcategorías
  for (const s of subcategoriasARevincular) {
    if (DRY_RUN) {
      console.log(`  ${C.gray}[DRY] sub "${s.nombre}": categoriaPadreId ${s.dePadreId} → ${s.aPadreId}${C.reset}`);
    } else {
      await db.collection('categoriasCostos').doc(s.id).update({ categoriaPadreId: s.aPadreId });
      console.log(`  ${C.green}✓ sub "${s.nombre}" re-vinculada${C.reset}`);
    }
  }

  // 5c · Borrar duplicados
  let borrados = 0;
  for (const id of idsDescartados) {
    if (DRY_RUN) {
      console.log(`  ${C.gray}[DRY] borrar duplicado ${id}${C.reset}`);
    } else {
      await db.collection('categoriasCostos').doc(id).delete();
      console.log(`  ${C.green}✓ borrado duplicado ${id}${C.reset}`);
    }
    borrados++;
  }

  // ── Resumen ─────────────────────────────────────────────────────────
  console.log(`\n${C.bold}Resumen${C.reset}`);
  console.log(`  ${planMerge.length} grupos con duplicados resueltos`);
  console.log(`  ${gastosARevincular.length} gastos ${DRY_RUN ? 'a re-vincular' : 're-vinculados'}`);
  console.log(`  ${subcategoriasARevincular.length} subcategorías ${DRY_RUN ? 'a re-vincular' : 're-vinculadas'}`);
  console.log(`  ${borrados} docs duplicados ${DRY_RUN ? 'a borrar' : 'borrados'}`);

  if (!DRY_RUN) {
    const finalSnap = await db.collection('categoriasCostos').get();
    console.log(`\n${C.green}${C.bold}Estado final categoriasCostos: ${finalSnap.size} docs${C.reset}\n`);
  } else {
    console.log(`\n${C.yellow}Re-ejecutá con --execute para aplicar.${C.reset}\n`);
  }
}

main().catch(err => { console.error(`${C.red}Error:${C.reset}`, err); process.exit(1); });
