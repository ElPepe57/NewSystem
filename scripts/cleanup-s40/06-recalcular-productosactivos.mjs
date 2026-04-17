/**
 * ========================================================================
 * CLEANUP S40 — FASE 6: RECALCULAR productosActivos / productosTotal
 * ========================================================================
 *
 * Recalcula los contadores de productos en tipos, categorías y marcas a
 * partir del catálogo de productos real.
 *
 * Esto corrige la deuda técnica pre-existente donde los contadores
 * `productosActivos` / `productosTotal` quedaron desincronizados porque
 * los triggers de métricas no siempre se ejecutaron.
 *
 * Lógica:
 *   - marcas.productosTotal       = count(productos donde marcaId=X)
 *   - marcas.productosActivos     = count(productos donde marcaId=X AND estado='activo')
 *   - tiposProducto.metricas.productosActivos = count(productos donde tipoProductoId=X AND estado='activo')
 *   - categorias.productosActivos = count(productos donde categoriaPrincipalId=X
 *                                         OR categoriaIds incluye X,
 *                                         AND estado='activo')
 *
 * Uso:
 *   DRY RUN:  node scripts/cleanup-s40/06-recalcular-productosactivos.mjs
 *   EJECUTAR: node scripts/cleanup-s40/06-recalcular-productosactivos.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const BATCH_LIMIT = 450;

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};

async function main() {
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  CLEANUP S40 — FASE 6: RECALCULAR productosActivos${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(DRY_RUN
    ? `${C.yellow}${C.bold}MODO DRY-RUN${C.reset}\n`
    : `${C.red}${C.bold}⚠️  MODO EJECUCIÓN REAL${C.reset}\n`);

  const start = Date.now();

  // 1. Cargar productos + índices
  console.log(`${C.cyan}1. Cargando productos...${C.reset}`);
  const prodsSnap = await db.collection('productos').get();
  const productos = prodsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const activos = productos.filter(p => p.estado === 'activo');
  console.log(`   ${productos.length} productos totales · ${activos.length} activos\n`);

  // 2. Construir conteos reales
  const tipoActivos = new Map();
  const marcaTotal = new Map();
  const marcaActivos = new Map();
  const categoriaActivos = new Map();

  for (const p of productos) {
    // Marca (total)
    if (p.marcaId) {
      marcaTotal.set(p.marcaId, (marcaTotal.get(p.marcaId) || 0) + 1);
    }
    // Activos
    if (p.estado === 'activo') {
      if (p.tipoProductoId) {
        tipoActivos.set(p.tipoProductoId, (tipoActivos.get(p.tipoProductoId) || 0) + 1);
      }
      if (p.marcaId) {
        marcaActivos.set(p.marcaId, (marcaActivos.get(p.marcaId) || 0) + 1);
      }
      // Categorías: un producto puede estar en múltiples. Contar en cada una.
      const catIds = new Set();
      if (p.categoriaPrincipalId) catIds.add(p.categoriaPrincipalId);
      if (Array.isArray(p.categoriaIds)) p.categoriaIds.forEach(c => catIds.add(c));
      if (Array.isArray(p.categorias)) p.categorias.forEach(c => c.id && catIds.add(c.id));
      catIds.forEach(cid => categoriaActivos.set(cid, (categoriaActivos.get(cid) || 0) + 1));
    }
  }

  console.log(`${C.cyan}2. Agregados:${C.reset}`);
  console.log(`   Tipos con productos activos: ${tipoActivos.size}`);
  console.log(`   Marcas con productos: ${marcaTotal.size}`);
  console.log(`   Categorías con productos activos: ${categoriaActivos.size}\n`);

  // 3. Detectar discrepancias y construir updates

  // --- TIPOS PRODUCTO ---
  const tiposSnap = await db.collection('tiposProducto').get();
  const updatesTipos = [];
  for (const doc of tiposSnap.docs) {
    const d = doc.data();
    const real = tipoActivos.get(doc.id) || 0;
    const reportado = d.metricas?.productosActivos ?? 0;
    if (real !== reportado) {
      updatesTipos.push({ id: doc.id, codigo: d.codigo, nombre: d.nombre, real, reportado });
    }
  }

  // --- MARCAS ---
  const marcasSnap = await db.collection('marcas').get();
  const updatesMarcas = [];
  for (const doc of marcasSnap.docs) {
    const d = doc.data();
    const realActivos = marcaActivos.get(doc.id) || 0;
    const realTotal = marcaTotal.get(doc.id) || 0;
    const reportadoActivos = d.productosActivos ?? 0;
    const reportadoTotal = d.productosTotal ?? 0;
    if (realActivos !== reportadoActivos || realTotal !== reportadoTotal) {
      updatesMarcas.push({
        id: doc.id, codigo: d.codigo, nombre: d.nombre,
        realActivos, realTotal, reportadoActivos, reportadoTotal,
      });
    }
  }

  // --- CATEGORIAS ---
  const catsSnap = await db.collection('categorias').get();
  const updatesCats = [];
  for (const doc of catsSnap.docs) {
    const d = doc.data();
    const real = categoriaActivos.get(doc.id) || 0;
    const reportado = d.productosActivos ?? 0;
    if (real !== reportado) {
      updatesCats.push({ id: doc.id, codigo: d.codigo, nombre: d.nombre, real, reportado });
    }
  }

  console.log(`${C.cyan}3. Discrepancias detectadas:${C.reset}`);
  console.log(`   Tipos Producto: ${C.yellow}${updatesTipos.length}${C.reset} a actualizar`);
  console.log(`   Marcas        : ${C.yellow}${updatesMarcas.length}${C.reset} a actualizar`);
  console.log(`   Categorías    : ${C.yellow}${updatesCats.length}${C.reset} a actualizar\n`);

  // Preview top 10 de cada
  if (updatesTipos.length > 0) {
    console.log(`${C.bold}Tipos (top 10):${C.reset}`);
    updatesTipos.slice(0, 10).forEach(u => console.log(`  ${(u.codigo || '—').padEnd(10)} ${(u.nombre || '').padEnd(30)} ${u.reportado} → ${C.green}${u.real}${C.reset}`));
    if (updatesTipos.length > 10) console.log(`  ${C.dim}  +${updatesTipos.length - 10} más…${C.reset}`);
  }
  if (updatesMarcas.length > 0) {
    console.log(`\n${C.bold}Marcas (top 10):${C.reset}`);
    updatesMarcas.slice(0, 10).forEach(u => console.log(`  ${(u.codigo || '—').padEnd(10)} ${(u.nombre || '').padEnd(30)} activos: ${u.reportadoActivos}→${C.green}${u.realActivos}${C.reset} total: ${u.reportadoTotal}→${C.green}${u.realTotal}${C.reset}`));
    if (updatesMarcas.length > 10) console.log(`  ${C.dim}  +${updatesMarcas.length - 10} más…${C.reset}`);
  }
  if (updatesCats.length > 0) {
    console.log(`\n${C.bold}Categorías (top 10):${C.reset}`);
    updatesCats.slice(0, 10).forEach(u => console.log(`  ${(u.codigo || '—').padEnd(10)} ${(u.nombre || '').padEnd(30)} ${u.reportado} → ${C.green}${u.real}${C.reset}`));
    if (updatesCats.length > 10) console.log(`  ${C.dim}  +${updatesCats.length - 10} más…${C.reset}`);
  }

  if (DRY_RUN) {
    console.log(`\n${C.yellow}${C.bold}Para ejecutar:${C.reset}`);
    console.log(`  node scripts/cleanup-s40/06-recalcular-productosactivos.mjs --execute\n`);
    process.exit(0);
  }

  // 4. Aplicar en batches
  console.log(`\n${C.red}Aplicando cambios en 3 segundos...${C.reset}`);
  await new Promise(r => setTimeout(r, 3000));
  console.log('');

  // Tipos
  if (updatesTipos.length > 0) {
    for (let i = 0; i < updatesTipos.length; i += BATCH_LIMIT) {
      const chunk = updatesTipos.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const u of chunk) {
        batch.set(
          db.collection('tiposProducto').doc(u.id),
          { metricas: { productosActivos: u.real } },
          { merge: true }
        );
      }
      await batch.commit();
    }
    console.log(`${C.green}✓ ${updatesTipos.length} tipos actualizados${C.reset}`);
  }

  // Marcas — actualiza AMBOS top-level Y metricas.* (la UI lee de metricas.*)
  if (updatesMarcas.length > 0) {
    for (let i = 0; i < updatesMarcas.length; i += BATCH_LIMIT) {
      const chunk = updatesMarcas.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const u of chunk) {
        batch.set(db.collection('marcas').doc(u.id), {
          productosActivos: u.realActivos,  // top-level (compat)
          productosTotal: u.realTotal,
          metricas: {
            productosActivos: u.realActivos,  // donde la UI (MarcasAnalytics) lee
            productosTotal: u.realTotal,
          },
        }, { merge: true });
      }
      await batch.commit();
    }
    console.log(`${C.green}✓ ${updatesMarcas.length} marcas actualizadas (top-level + metricas.*)${C.reset}`);
  }

  // Categorías — idem
  if (updatesCats.length > 0) {
    for (let i = 0; i < updatesCats.length; i += BATCH_LIMIT) {
      const chunk = updatesCats.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const u of chunk) {
        batch.set(db.collection('categorias').doc(u.id), {
          productosActivos: u.real,  // top-level (compat)
          metricas: {
            productosActivos: u.real,  // donde la UI (CategoriaList) lee
          },
        }, { merge: true });
      }
      await batch.commit();
    }
    console.log(`${C.green}✓ ${updatesCats.length} categorías actualizadas (top-level + metricas.*)${C.reset}`);
  }

  console.log(`\n${C.green}${C.bold}✓ Recálculo completo en ${((Date.now() - start) / 1000).toFixed(1)}s${C.reset}\n`);
  process.exit(0);
}

main().catch(err => {
  console.error(`${C.red}❌ Error:${C.reset}`, err);
  process.exit(1);
});
