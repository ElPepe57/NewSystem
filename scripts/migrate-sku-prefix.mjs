#!/usr/bin/env node
/**
 * ===============================================
 * MIGRACIÓN: Renombrar SKUs BMN-XXXX → SUP-XXXX
 * ===============================================
 *
 * Todos los productos pertenecen a la línea "Suplementos y Vitaminas" (code: SUP).
 * Los SKUs actuales usan prefijo BMN- y deben migrar a SUP-.
 *
 * Actualiza el campo `sku` en productos y TODAS las referencias desnormalizadas:
 *   1. productos        → campo `sku`
 *   2. unidades          → campo `productoSKU`
 *   3. ventas            → array `productos[].sku`
 *   4. cotizaciones      → array `productos[].sku`
 *   5. requerimientos    → array `productos[].sku`
 *   6. transferencias    → array `unidades[].sku`
 *   7. ordenesCompra     → array `productos[].sku`
 *
 * Uso:
 *   DRY RUN (solo ver qué haría):
 *     node scripts/migrate-sku-prefix.mjs --dry-run
 *
 *   EJECUTAR MIGRACIÓN:
 *     node scripts/migrate-sku-prefix.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

if (!DRY_RUN && !EXECUTE) {
  console.log('Usage: node scripts/migrate-sku-prefix.mjs --dry-run|--execute');
  process.exit(1);
}

const BATCH_SIZE = 400;

// Colores para console
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
};

function log(emoji, msg) { console.log(`${emoji} ${msg}`); }
function logStep(step, msg) { console.log(`\n${C.cyan}━━━ PASO ${step} ━━━${C.reset} ${msg}`); }
function logDry(msg) { if (DRY_RUN) console.log(`  ${C.yellow}[DRY-RUN]${C.reset} ${msg}`); }
function logOk(msg) { console.log(`  ${C.green}✓${C.reset} ${msg}`); }
function logWarn(msg) { console.log(`  ${C.yellow}⚠${C.reset} ${msg}`); }
function logErr(msg) { console.log(`  ${C.red}✗${C.reset} ${msg}`); }

// ============================================================
// UTILIDAD: Batch commit seguro
// ============================================================
async function batchCommit(updates, collectionName) {
  if (DRY_RUN) {
    logDry(`Se actualizarían ${updates.length} docs en '${collectionName}'`);
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
    log('📦', `  Committed ${committed}/${updates.length} docs`);
  }
  logOk(`${committed} documentos actualizados en '${collectionName}'`);
}

// ============================================================
// CONTADORES para resumen final
// ============================================================
const stats = {
  productos: 0,
  unidades: 0,
  ventas: 0,
  cotizaciones: 0,
  requerimientos: 0,
  transferencias: 0,
  ordenesCompra: 0,
};

// ============================================================
// Función para reemplazar SKUs en arrays anidados
// ============================================================
function replaceSkusInArray(items, skuMap, skuField = 'sku') {
  let changed = false;
  const updated = (items || []).map(item => {
    if (item[skuField] && skuMap.has(item[skuField])) {
      changed = true;
      return { ...item, [skuField]: skuMap.get(item[skuField]) };
    }
    return item;
  });
  return { updated, changed };
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log(`\n${C.bold}${C.magenta}╔══════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.magenta}║   MIGRACIÓN: SKU BMN-XXXX → SUP-XXXX            ║${C.reset}`);
  console.log(`${C.bold}${C.magenta}╚══════════════════════════════════════════════════╝${C.reset}`);
  console.log(`\n  Modo: ${DRY_RUN ? `${C.yellow}DRY-RUN (sin escrituras)${C.reset}` : `${C.red}EXECUTE (escrituras reales)${C.reset}`}`);

  // 5-second warning for execute mode
  if (EXECUTE) {
    console.log(`\n${C.red}${C.bold}  ⚠ ATENCIÓN: Se ejecutarán escrituras reales en Firestore.${C.reset}`);
    console.log(`${C.red}  Cancelar con Ctrl+C en los próximos 5 segundos...${C.reset}`);
    for (let i = 5; i > 0; i--) {
      process.stdout.write(`\r  ${C.red}${i}...${C.reset}  `);
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`\r  ${C.green}Iniciando migración...${C.reset}     `);
  }

  // ─────────────────────────────────────────────
  // PASO 1: Build SKU mapping
  // ─────────────────────────────────────────────
  logStep(1, 'Construir mapa de SKUs BMN → SUP');

  const productosSnap = await db.collection('productos').get();
  const skuMap = new Map(); // oldSKU → newSKU
  const productUpdates = [];

  for (const doc of productosSnap.docs) {
    const data = doc.data();
    const oldSku = data.sku;
    if (oldSku && oldSku.startsWith('BMN-')) {
      const newSku = oldSku.replace('BMN-', 'SUP-');
      skuMap.set(oldSku, newSku);
      productUpdates.push({ ref: doc.ref, data: { sku: newSku } });
    }
  }

  logOk(`${skuMap.size} SKUs encontrados con prefijo BMN-`);
  // Show first 5 mappings as example
  let shown = 0;
  for (const [old, nu] of skuMap) {
    if (shown >= 5) {
      log('  ', `  ${C.dim}... y ${skuMap.size - 5} más${C.reset}`);
      break;
    }
    log('  ', `  ${C.dim}${old}${C.reset} → ${C.green}${nu}${C.reset}`);
    shown++;
  }

  if (skuMap.size === 0) {
    logWarn('No se encontraron productos con prefijo BMN-. Nada que migrar.');
    return;
  }

  // ─────────────────────────────────────────────
  // PASO 2: Update productos
  // ─────────────────────────────────────────────
  logStep(2, `Actualizar campo 'sku' en productos (${productUpdates.length} docs)`);
  stats.productos = productUpdates.length;
  await batchCommit(productUpdates, 'productos');

  // ─────────────────────────────────────────────
  // PASO 3: Update unidades (productoSKU)
  // ─────────────────────────────────────────────
  logStep(3, 'Actualizar campo productoSKU en unidades');

  const unidadesSnap = await db.collection('unidades').get();
  const unidadUpdates = [];

  for (const doc of unidadesSnap.docs) {
    const data = doc.data();
    if (data.productoSKU && skuMap.has(data.productoSKU)) {
      unidadUpdates.push({
        ref: doc.ref,
        data: { productoSKU: skuMap.get(data.productoSKU) },
      });
    }
  }

  stats.unidades = unidadUpdates.length;
  logOk(`${unidadUpdates.length} unidades con BMN- encontradas`);
  await batchCommit(unidadUpdates, 'unidades');

  // ─────────────────────────────────────────────
  // PASO 4: Update ventas (productos[].sku)
  // ─────────────────────────────────────────────
  logStep(4, 'Actualizar productos[].sku en ventas');

  const ventasSnap = await db.collection('ventas').get();
  const ventaUpdates = [];

  for (const doc of ventasSnap.docs) {
    const data = doc.data();
    const { updated, changed } = replaceSkusInArray(data.productos, skuMap);
    if (changed) {
      ventaUpdates.push({ ref: doc.ref, data: { productos: updated } });
    }
  }

  stats.ventas = ventaUpdates.length;
  logOk(`${ventaUpdates.length} ventas con BMN- SKUs encontradas`);
  await batchCommit(ventaUpdates, 'ventas');

  // ─────────────────────────────────────────────
  // PASO 5: Update cotizaciones (productos[].sku)
  // ─────────────────────────────────────────────
  logStep(5, 'Actualizar productos[].sku en cotizaciones');

  const cotizSnap = await db.collection('cotizaciones').get();
  const cotizUpdates = [];

  for (const doc of cotizSnap.docs) {
    const data = doc.data();
    const { updated, changed } = replaceSkusInArray(data.productos, skuMap);
    if (changed) {
      cotizUpdates.push({ ref: doc.ref, data: { productos: updated } });
    }
  }

  stats.cotizaciones = cotizUpdates.length;
  logOk(`${cotizUpdates.length} cotizaciones con BMN- SKUs encontradas`);
  await batchCommit(cotizUpdates, 'cotizaciones');

  // ─────────────────────────────────────────────
  // PASO 6: Update requerimientos (productos[].sku)
  // ─────────────────────────────────────────────
  logStep(6, 'Actualizar productos[].sku en requerimientos');

  const reqSnap = await db.collection('requerimientos').get();
  const reqUpdates = [];

  for (const doc of reqSnap.docs) {
    const data = doc.data();
    const { updated, changed } = replaceSkusInArray(data.productos, skuMap);
    if (changed) {
      reqUpdates.push({ ref: doc.ref, data: { productos: updated } });
    }
  }

  stats.requerimientos = reqUpdates.length;
  logOk(`${reqUpdates.length} requerimientos con BMN- SKUs encontrados`);
  await batchCommit(reqUpdates, 'requerimientos');

  // ─────────────────────────────────────────────
  // PASO 7: Update transferencias (unidades[].sku)
  // ─────────────────────────────────────────────
  logStep(7, 'Actualizar unidades[].sku en transferencias');

  const transSnap = await db.collection('transferencias').get();
  const transUpdates = [];

  for (const doc of transSnap.docs) {
    const data = doc.data();
    const { updated, changed } = replaceSkusInArray(data.unidades, skuMap);
    if (changed) {
      transUpdates.push({ ref: doc.ref, data: { unidades: updated } });
    }
  }

  stats.transferencias = transUpdates.length;
  logOk(`${transUpdates.length} transferencias con BMN- SKUs encontradas`);
  await batchCommit(transUpdates, 'transferencias');

  // ─────────────────────────────────────────────
  // PASO 8: Update ordenesCompra (productos[].sku)
  // ─────────────────────────────────────────────
  logStep(8, 'Actualizar productos[].sku en ordenesCompra');

  const ocSnap = await db.collection('ordenesCompra').get();
  const ocUpdates = [];

  for (const doc of ocSnap.docs) {
    const data = doc.data();
    const { updated, changed } = replaceSkusInArray(data.productos, skuMap);
    if (changed) {
      ocUpdates.push({ ref: doc.ref, data: { productos: updated } });
    }
  }

  stats.ordenesCompra = ocUpdates.length;
  logOk(`${ocUpdates.length} órdenes de compra con BMN- SKUs encontradas`);
  await batchCommit(ocUpdates, 'ordenesCompra');

  // ─────────────────────────────────────────────
  // VERIFICACIÓN
  // ─────────────────────────────────────────────
  if (EXECUTE) {
    console.log(`\n${C.cyan}━━━ VERIFICACIÓN POST-MIGRACIÓN ━━━${C.reset}`);

    // Check productos
    const prodCheck = await db.collection('productos').get();
    const remainingProds = prodCheck.docs.filter(d => {
      const sku = d.data().sku;
      return sku && sku.startsWith('BMN-');
    });

    // Check unidades
    const uniCheck = await db.collection('unidades').get();
    const remainingUnis = uniCheck.docs.filter(d => {
      const sku = d.data().productoSKU;
      return sku && sku.startsWith('BMN-');
    });

    if (remainingProds.length === 0 && remainingUnis.length === 0) {
      logOk(`${C.green}Verificación exitosa: 0 productos y 0 unidades con BMN- restantes${C.reset}`);
    } else {
      logErr(`Productos con BMN- restantes: ${remainingProds.length}`);
      logErr(`Unidades con BMN- restantes: ${remainingUnis.length}`);
    }
  }

  // ─────────────────────────────────────────────
  // RESUMEN FINAL
  // ─────────────────────────────────────────────
  console.log(`\n${C.bold}${C.magenta}╔══════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.magenta}║   RESUMEN DE MIGRACIÓN                           ║${C.reset}`);
  console.log(`${C.bold}${C.magenta}╚══════════════════════════════════════════════════╝${C.reset}`);
  console.log(`  Modo: ${DRY_RUN ? `${C.yellow}DRY-RUN${C.reset}` : `${C.green}EJECUTADO${C.reset}`}`);
  console.log(`  SKUs mapeados: ${C.bold}${skuMap.size}${C.reset}`);
  console.log('');
  console.log(`  ${'Colección'.padEnd(22)} ${'Docs actualizados'.padStart(18)}`);
  console.log(`  ${C.dim}${'─'.repeat(42)}${C.reset}`);
  console.log(`  ${'productos'.padEnd(22)} ${C.green}${String(stats.productos).padStart(18)}${C.reset}`);
  console.log(`  ${'unidades'.padEnd(22)} ${C.green}${String(stats.unidades).padStart(18)}${C.reset}`);
  console.log(`  ${'ventas'.padEnd(22)} ${C.green}${String(stats.ventas).padStart(18)}${C.reset}`);
  console.log(`  ${'cotizaciones'.padEnd(22)} ${C.green}${String(stats.cotizaciones).padStart(18)}${C.reset}`);
  console.log(`  ${'requerimientos'.padEnd(22)} ${C.green}${String(stats.requerimientos).padStart(18)}${C.reset}`);
  console.log(`  ${'transferencias'.padEnd(22)} ${C.green}${String(stats.transferencias).padStart(18)}${C.reset}`);
  console.log(`  ${'ordenesCompra'.padEnd(22)} ${C.green}${String(stats.ordenesCompra).padStart(18)}${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(42)}${C.reset}`);

  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  console.log(`  ${'TOTAL'.padEnd(22)} ${C.bold}${String(total).padStart(18)}${C.reset}`);
  console.log('');
}

main().catch(err => {
  console.error(`\n${C.red}ERROR FATAL:${C.reset}`, err);
  process.exit(1);
});
