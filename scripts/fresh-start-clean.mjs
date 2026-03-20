/**
 * ===============================================
 * FRESH START: Limpiar colecciones transaccionales, conservar maestros
 * ===============================================
 *
 * CONSERVA (no toca):
 *   productos, almacenes, clientes, proveedores, marcas, categorias,
 *   etiquetas, tiposProducto, lineasNegocio, paisesOrigen, canalesVenta,
 *   mlConfig, mlProductMap, cuentasCaja, configuracion
 *
 * LIMPIA (borra todos los docs):
 *   unidades, ventas, ordenesCompra, transferencias, cotizaciones,
 *   requerimientos, gastos, movimientosTesoreria, entregas,
 *   mlOrderSync, conteosInventario, actividades
 *
 * RESETEA en productos:
 *   stockUSA, stockPeru, stockTransito, stockReservado, stockDisponible,
 *   stockDisponiblePeru, stockPendienteML, stockEfectivoML → todo a 0
 *
 * Uso:
 *   DRY RUN:  node scripts/fresh-start-clean.mjs --dry-run
 *   EJECUTAR: node scripts/fresh-start-clean.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const BATCH_LIMIT = 450;

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m',
};

// Colecciones a BORRAR completamente
const COLLECTIONS_TO_DELETE = [
  'unidades',
  'ventas',
  'ordenesCompra',
  'transferencias',
  'cotizaciones',
  'requerimientos',
  'gastos',
  'movimientosTesoreria',
  'entregas',
  'mlOrderSync',
  'conteosInventario',
  'actividades',
];

// Colecciones que se CONSERVAN intactas
const COLLECTIONS_TO_KEEP = [
  'productos',        // se conserva pero se resetean contadores
  'almacenes',
  'clientes',
  'proveedores',
  'marcas',
  'categorias',
  'etiquetas',
  'tiposProducto',
  'lineasNegocio',
  'paisesOrigen',
  'canalesVenta',
  'mlConfig',
  'mlProductMap',
  'cuentasCaja',
  'configuracion',
];

// Campos de stock a resetear en productos
const STOCK_FIELDS_RESET = {
  stockUSA: 0,
  stockPeru: 0,
  stockTransito: 0,
  stockReservado: 0,
  stockDisponible: 0,
  stockDisponiblePeru: 0,
  stockPendienteML: 0,
  stockEfectivoML: 0,
};

async function deleteCollection(collName) {
  const snap = await db.collection(collName).get();
  if (snap.empty) {
    console.log(`  ⏭️  ${collName.padEnd(25)} 0 docs (ya vacía)`);
    return 0;
  }

  if (DRY_RUN) {
    console.log(`  ${C.yellow}[DRY] ${collName.padEnd(25)} ${snap.size} docs serían eliminados${C.reset}`);
    return snap.size;
  }

  let batch = db.batch();
  let count = 0;
  let total = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    total++;

    if (count >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`  ${C.red}🗑️  ${collName.padEnd(25)} ${total} docs eliminados${C.reset}`);
  return total;
}

async function resetProductStock() {
  const snap = await db.collection('productos').get();
  if (snap.empty) return 0;

  if (DRY_RUN) {
    console.log(`  ${C.yellow}[DRY] productos${' '.repeat(14)} ${snap.size} docs → resetear stock a 0${C.reset}`);
    return snap.size;
  }

  let batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    batch.update(doc.ref, STOCK_FIELDS_RESET);
    count++;

    if (count >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`  ${C.green}🔄 productos${' '.repeat(14)} ${snap.size} docs → stock reseteado a 0${C.reset}`);
  return snap.size;
}

async function resetCuentasCaja() {
  const snap = await db.collection('cuentasCaja').get();
  if (snap.empty) return;

  if (DRY_RUN) {
    console.log(`  ${C.yellow}[DRY] cuentasCaja${' '.repeat(10)} ${snap.size} docs → resetear saldos a 0${C.reset}`);
    return;
  }

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { saldo: 0, totalIngresos: 0, totalEgresos: 0 });
  }
  await batch.commit();
  console.log(`  ${C.green}🔄 cuentasCaja${' '.repeat(10)} ${snap.size} docs → saldos reseteados a 0${C.reset}`);
}

async function main() {
  console.log(`\n${C.bold}╔══════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}║         FRESH START — BD Limpia               ║${C.reset}`);
  console.log(`${C.bold}╚══════════════════════════════════════════════╝${C.reset}`);
  console.log(`\nModo: ${DRY_RUN ? `${C.yellow}DRY-RUN (no hace cambios)${C.reset}` : `${C.red}⚠️  EJECUTAR (IRREVERSIBLE)${C.reset}`}\n`);

  if (!DRY_RUN) {
    console.log(`${C.red}⚠️  ADVERTENCIA: Esto BORRARÁ datos de Firestore permanentemente.${C.reset}`);
    console.log(`${C.red}   Asegúrate de tener el backup en backup/firestore-2026-03-18/${C.reset}\n`);
    // 5 second countdown
    for (let i = 5; i > 0; i--) {
      process.stdout.write(`\r   Ejecutando en ${i}...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log('\n');
  }

  // 1. Show what will be KEPT
  console.log(`${C.bold}═══ CONSERVAR (no se tocan) ═══${C.reset}\n`);
  for (const coll of COLLECTIONS_TO_KEEP) {
    const snap = await db.collection(coll).get();
    console.log(`  ${C.green}✅ ${coll.padEnd(25)} ${snap.size} docs${C.reset}`);
  }

  // 2. Delete transactional collections
  console.log(`\n${C.bold}═══ LIMPIAR (borrar todos los docs) ═══${C.reset}\n`);
  let totalDeleted = 0;
  for (const coll of COLLECTIONS_TO_DELETE) {
    totalDeleted += await deleteCollection(coll);
  }

  // 3. Reset product stock counters
  console.log(`\n${C.bold}═══ RESETEAR CONTADORES ═══${C.reset}\n`);
  await resetProductStock();
  await resetCuentasCaja();

  // 4. Summary
  console.log(`\n${C.bold}═══ RESUMEN ═══${C.reset}\n`);
  console.log(`  Documentos eliminados: ${totalDeleted}`);
  console.log(`  Productos reseteados (stock → 0): sí`);
  console.log(`  Cuentas caja reseteadas (saldo → 0): sí`);
  console.log(`  Auth/Hosting/Functions: intactos`);

  if (DRY_RUN) {
    console.log(`\n${C.yellow}[DRY-RUN] Para ejecutar: node scripts/fresh-start-clean.mjs --execute${C.reset}\n`);
  } else {
    console.log(`\n${C.green}✅ Fresh start completado. BD lista para empezar desde 0.${C.reset}\n`);
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
