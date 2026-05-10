/**
 * ===============================================
 * MIGRACIÓN BD: gastos legacy → categoriaCostoId
 * ===============================================
 *
 * Migra gastos con `categoria` legacy ('GV' | 'GD' | 'GA' | 'GO') al modelo
 * canónico de 3 niveles · campo `categoriaCostoId` apuntando a categoriasCosto.
 *
 * Parte del refactor S3.6 M1.bis chk5.A4 · Cost Intelligence System.
 *
 * Reglas de mapeo · tipo + categoria → bloque + categoriaCostoId:
 *
 *   Por TIPO (prioritario · más específico):
 *     flete_internacional    → bloque 'producto' · categoría "Transporte" → "Flete viajero/courier"
 *     flete_usa_peru         → bloque 'producto' · categoría "Transporte" → "Flete viajero"
 *     recojo_local           → bloque 'producto' · categoría "Manipuleo" → "Recojo local"
 *     almacenaje             → bloque 'producto' · categoría "Manipuleo" → "Almacenaje temporal"
 *     internacion            → bloque 'producto' · categoría "Aranceles" → "Impuesto importacion"
 *     merma_transferencia    → bloque 'producto' · categoría "Pérdidas"  → "Merma transferencia"   (chk5.A10)
 *     merma_vencimiento      → bloque 'producto' · categoría "Pérdidas"  → "Merma vencimiento"     (chk5.A10)
 *     desmedro               → bloque 'producto' · categoría "Pérdidas"  → "Desmedro"              (chk5.A10)
 *     comision_ml            → bloque 'venta' · categoría "Comisiones" → "Comision ML"
 *     comision_pasarela      → bloque 'venta' · categoría "Comisiones" → "Comision pasarela"
 *     comision_vendedor      → bloque 'venta' · categoría "Comisiones" → "Comision vendedor"
 *     delivery               → bloque 'venta' · categoría "Distribucion" → "Delivery local"
 *     empaque                → bloque 'venta' · categoría "Empaque" → "Kit de empaque"
 *     marketing              → bloque 'venta' · categoría "Marketing directo" → "Promocion"
 *     nomina                 → bloque 'periodo' · categoría "Personal" → "Sueldos"
 *     administrativo         → bloque 'periodo' · categoría "Profesionales" → "Consultorias" (default)
 *     operativo              → bloque 'periodo' · categoría "Operativos" → "Suministros oficina" (default)
 *     otros                  → bloque 'periodo' · categoría "Operativos" → "Suministros oficina" (fallback)
 *
 *   Por CATEGORIA legacy (fallback si tipo no mapea):
 *     'GA' → bloque 'periodo' · primera categoría disponible
 *     'GO' → bloque 'periodo' · primera categoría disponible
 *     'GV' → bloque 'venta'   · primera categoría disponible
 *     'GD' → bloque 'venta'   · primera categoría disponible
 *
 * Es IDEMPOTENTE:
 *   - Salta gastos que ya tienen categoriaCostoId
 *   - Reporta antes/después
 *   - Safe re-run
 *
 * Uso:
 *   DRY RUN (default · solo simula):
 *     node scripts/migrate-gastos-legacy-a-categoriaCostoId.mjs
 *
 *   EJECUTAR:
 *     node scripts/migrate-gastos-legacy-a-categoriaCostoId.mjs --execute
 *
 * Pre-requisitos:
 *   - categoriasCosto/* deben existir en BD (ejecutar seed antes si no)
 *   - GOOGLE_APPLICATION_CREDENTIALS configurado o ambiente con default creds
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m',
};

// ────────────────────────────────────────────────────────────────────────
// Mapeo TipoGasto → { bloque, categoriaPadreNombre, subcategoriaNombre? }
// ────────────────────────────────────────────────────────────────────────
const TIPO_MAPPING = {
  // PRODUCTO (afecta CTRU)
  flete_internacional:  { bloque: 'producto', padre: 'Transporte',  sub: 'Flete viajero' },
  flete_usa_peru:       { bloque: 'producto', padre: 'Transporte',  sub: 'Flete viajero' },
  recojo_local:         { bloque: 'producto', padre: 'Manipuleo',   sub: 'Recojo local' },
  almacenaje:           { bloque: 'producto', padre: 'Manipuleo',   sub: 'Almacenaje temporal' },
  internacion:          { bloque: 'producto', padre: 'Aranceles',   sub: 'Impuesto importacion' },
  // PRODUCTO · pérdidas (chk5.A10 · ahora apuntan a la categoría dedicada "Pérdidas")
  merma_transferencia:  { bloque: 'producto', padre: 'Pérdidas',    sub: 'Merma transferencia' },
  merma_vencimiento:    { bloque: 'producto', padre: 'Pérdidas',    sub: 'Merma vencimiento' },
  desmedro:             { bloque: 'producto', padre: 'Pérdidas',    sub: 'Desmedro' },

  // VENTA (afecta margen contribución)
  comision_ml:          { bloque: 'venta', padre: 'Comisiones',         sub: 'Comision ML' },
  comision_pasarela:    { bloque: 'venta', padre: 'Comisiones',         sub: 'Comision pasarela' },
  comision_vendedor:    { bloque: 'venta', padre: 'Comisiones',         sub: 'Comision vendedor' },
  delivery:             { bloque: 'venta', padre: 'Distribucion',       sub: 'Delivery local' },
  empaque:              { bloque: 'venta', padre: 'Empaque',            sub: 'Kit de empaque' },
  marketing:            { bloque: 'venta', padre: 'Marketing directo',  sub: 'Promocion' },

  // PERIODO (afecta margen operativo)
  nomina:               { bloque: 'periodo', padre: 'Personal',         sub: 'Sueldos' },
  administrativo:       { bloque: 'periodo', padre: 'Profesionales',    sub: 'Consultorias' },
  operativo:            { bloque: 'periodo', padre: 'Operativos',       sub: 'Suministros oficina' },
  otros:                { bloque: 'periodo', padre: 'Operativos',       sub: 'Suministros oficina' },
};

// Fallback por CategoriaGasto legacy (si tipo no está mapeado)
const CATEGORIA_LEGACY_BLOQUE = {
  GA: 'periodo',
  GO: 'periodo',
  GV: 'venta',
  GD: 'venta',
};

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${C.bold}  MIGRACIÓN: gastos legacy → categoriaCostoId (canon 3 niveles)${C.reset}`);
  console.log(`  Modo: ${DRY_RUN ? `${C.yellow}DRY RUN${C.reset}` : `${C.red}${C.bold}EJECUCIÓN REAL${C.reset}`}`);
  console.log(`${'='.repeat(70)}\n`);

  // ─── Fase 1 · Cargar arbol de categorías ──────────────────────────────
  console.log(`${C.cyan}▸ Fase 1 · Cargar categoriasCosto/* en memoria${C.reset}`);
  const categoriasSnap = await db.collection('categoriasCosto').get();

  if (categoriasSnap.empty) {
    console.log(`  ${C.red}✗ No hay categorías cargadas en categoriasCosto/*${C.reset}`);
    console.log(`  ${C.yellow}Ejecuta primero el seed:${C.reset}`);
    console.log(`  ${C.bold}node scripts/reingenieria/03-seed-categorias-costos.mjs --execute${C.reset}\n`);
    process.exit(1);
  }

  const categorias = categoriasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Index: { bloque: { padreNombre: { id, hijos: { hijoNombre: id } } } }
  const arbol = {};
  for (const cat of categorias) {
    const bloque = cat.bloque;
    if (!arbol[bloque]) arbol[bloque] = {};
    if (cat.nivel === 0) {
      // Categoría padre
      arbol[bloque][cat.nombre] = arbol[bloque][cat.nombre] || { hijos: {} };
      arbol[bloque][cat.nombre].id = cat.id;
    } else if (cat.categoriaPadreNombre) {
      // Subcategoría
      const padreNombre = cat.categoriaPadreNombre;
      arbol[bloque][padreNombre] = arbol[bloque][padreNombre] || { hijos: {} };
      arbol[bloque][padreNombre].hijos[cat.nombre] = cat.id;
    }
  }

  const totalCategorias = categorias.length;
  console.log(`  ${C.green}✓${C.reset} ${totalCategorias} categorías cargadas`);
  for (const bloque of ['producto', 'venta', 'periodo']) {
    const padresEnBloque = arbol[bloque] ? Object.keys(arbol[bloque]) : [];
    console.log(`  ${C.gray}  · ${bloque}: ${padresEnBloque.length} padres${C.reset}`);
  }

  // ─── Fase 2 · Cargar gastos para migrar ───────────────────────────────
  console.log(`\n${C.cyan}▸ Fase 2 · Identificar gastos legacy${C.reset}`);
  const gastosSnap = await db.collection('gastos').get();
  const totalGastos = gastosSnap.size;

  let yaMigrados = 0;
  let porMigrar = 0;
  let conTipoMapeado = 0;
  let conFallbackLegacy = 0;
  let sinClasificar = 0;
  const updates = [];

  for (const doc of gastosSnap.docs) {
    const g = doc.data();

    // Saltar si ya tiene categoriaCostoId
    if (g.categoriaCostoId) {
      yaMigrados++;
      continue;
    }

    porMigrar++;

    let bloque = null;
    let padreNombre = null;
    let subNombre = null;

    // Estrategia 1: mapeo por tipo (prioritario)
    if (g.tipo && TIPO_MAPPING[g.tipo]) {
      const m = TIPO_MAPPING[g.tipo];
      bloque = m.bloque;
      padreNombre = m.padre;
      subNombre = m.sub;
      conTipoMapeado++;
    }
    // Estrategia 2: fallback por categoria legacy
    else if (g.categoria && CATEGORIA_LEGACY_BLOQUE[g.categoria]) {
      bloque = CATEGORIA_LEGACY_BLOQUE[g.categoria];
      // Tomar primera categoría padre disponible del bloque
      const padresDelBloque = arbol[bloque] ? Object.keys(arbol[bloque]) : [];
      padreNombre = padresDelBloque[0] || null;
      conFallbackLegacy++;
    }

    // Resolver categoriaCostoId
    let categoriaCostoId = null;
    if (bloque && padreNombre && arbol[bloque]?.[padreNombre]) {
      const padreData = arbol[bloque][padreNombre];
      // Preferir subcategoría si está mapeada y existe
      if (subNombre && padreData.hijos?.[subNombre]) {
        categoriaCostoId = padreData.hijos[subNombre];
      } else {
        // Fallback al padre
        categoriaCostoId = padreData.id;
      }
    }

    if (categoriaCostoId) {
      updates.push({
        id: doc.id,
        ref: doc.ref,
        descripcion: g.descripcion || g.tipo,
        tipo: g.tipo,
        categoriaLegacy: g.categoria,
        bloqueDestino: bloque,
        padreDestino: padreNombre,
        subDestino: subNombre,
        categoriaCostoId,
      });
    } else {
      sinClasificar++;
      console.log(`  ${C.red}✗${C.reset} ${doc.id} sin clasificar · tipo=${g.tipo} · categoria=${g.categoria}`);
    }
  }

  console.log(`  ${C.gray}Total gastos en BD: ${totalGastos}${C.reset}`);
  console.log(`  ${C.green}✓${C.reset} Ya migrados: ${yaMigrados}`);
  console.log(`  ${C.yellow}▸${C.reset} Por migrar: ${porMigrar}`);
  console.log(`    ${C.gray}- Mapeo por tipo:    ${conTipoMapeado}${C.reset}`);
  console.log(`    ${C.gray}- Fallback legacy:   ${conFallbackLegacy}${C.reset}`);
  console.log(`    ${C.red}- Sin clasificar:    ${sinClasificar}${C.reset}`);

  if (updates.length === 0) {
    console.log(`\n  ${C.green}${C.bold}✓ Sistema ya migrado · nada que hacer${C.reset}\n`);
    return;
  }

  // ─── Fase 3 · Ejecutar batch updates ──────────────────────────────────
  console.log(`\n${C.cyan}▸ Fase 3 · ${DRY_RUN ? 'Simular' : 'Ejecutar'} batch updates${C.reset}`);

  if (DRY_RUN) {
    // Imprimir solo los primeros 20 + summary
    console.log(`  ${C.gray}Mostrando primeros 20 cambios planeados:${C.reset}`);
    updates.slice(0, 20).forEach(u => {
      console.log(`  ${C.yellow}[dry]${C.reset} ${u.id.slice(0, 8)}... · "${(u.descripcion || '').slice(0, 30)}" · ${C.gray}tipo=${u.tipo}${C.reset}`);
      console.log(`         ${C.cyan}→${C.reset} bloque=${u.bloqueDestino} · padre=${u.padreDestino}${u.subDestino ? ` · sub=${u.subDestino}` : ''}`);
    });
    if (updates.length > 20) console.log(`  ${C.gray}... y ${updates.length - 20} más${C.reset}`);
  } else {
    // Batch writes max 450 ops/batch
    const batchSize = 450;
    let opsInBatch = 0;
    let batch = db.batch();
    let batchNum = 1;
    let committed = 0;

    for (const u of updates) {
      batch.update(u.ref, { categoriaCostoId: u.categoriaCostoId });
      opsInBatch++;

      if (opsInBatch >= batchSize) {
        await batch.commit();
        committed += opsInBatch;
        console.log(`  ${C.green}✓${C.reset} Batch ${batchNum} commiteado (${opsInBatch} updates · acumulado ${committed}/${updates.length})`);
        batch = db.batch();
        opsInBatch = 0;
        batchNum++;
      }
    }

    if (opsInBatch > 0) {
      await batch.commit();
      committed += opsInBatch;
      console.log(`  ${C.green}✓${C.reset} Batch ${batchNum} commiteado (${opsInBatch} updates · final ${committed}/${updates.length})`);
    }
  }

  // ─── Fase 4 · Resumen ─────────────────────────────────────────────────
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${C.bold}  RESUMEN${C.reset}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`  Gastos en BD:                 ${C.bold}${totalGastos}${C.reset}`);
  console.log(`  Ya migrados (saltados):       ${C.green}${yaMigrados}${C.reset}`);
  console.log(`  ${DRY_RUN ? 'Simulados' : 'Migrados'}:                    ${C.cyan}${updates.length}${C.reset}`);
  console.log(`     · Por tipo específico:     ${conTipoMapeado}`);
  console.log(`     · Por categoría legacy:    ${conFallbackLegacy}`);
  console.log(`  Sin clasificar (revisar):     ${sinClasificar > 0 ? C.red : C.gray}${sinClasificar}${C.reset}`);

  if (DRY_RUN && updates.length > 0) {
    console.log(`\n  ${C.yellow}Para ejecutar realmente:${C.reset}`);
    console.log(`  ${C.bold}node scripts/migrate-gastos-legacy-a-categoriaCostoId.mjs --execute${C.reset}\n`);
  } else if (!DRY_RUN) {
    console.log(`\n  ${C.green}${C.bold}✓ Migración completada${C.reset}`);
    console.log(`  ${C.gray}Verifica el livehost · los gastos deberían mostrar bloque/categoría${C.reset}`);
    if (sinClasificar > 0) {
      console.log(`  ${C.yellow}⚠ ${sinClasificar} gastos sin clasificar · revisar manualmente desde el form${C.reset}`);
    }
    console.log('');
  }
}

main().catch(err => {
  console.error(`\n${C.red}ERROR:${C.reset}`, err);
  process.exit(1);
});
