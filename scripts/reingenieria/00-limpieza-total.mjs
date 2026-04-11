/**
 * ===============================================
 * FASE 0 — REINGENIERÍA: Limpieza total de BD transaccional
 * ===============================================
 *
 * Prerequisito absoluto antes de cualquier cambio de código.
 * Basado en los 53 acuerdos de reingeniería (2026-04-10).
 *
 * CONSERVA (maestros — no toca):
 *   productos, clientes, proveedores, marcas, categorias,
 *   etiquetas, tiposProducto, lineasNegocio, paisesOrigen, canalesVenta,
 *   competidores, transportistas, users, configuracion,
 *   mlConfig, mlProductMap, cuentasCaja (se resetean saldos)
 *
 * ELIMINA completamente:
 *   ordenesCompra, transferencias, unidades, gastos, ventas,
 *   cotizaciones, requerimientos, entregas, entregas_parciales,
 *   movimientosTesoreria, conversionesCambiarias, registrosTCTransaccion,
 *   poolUSDMovimientos, poolUSDSnapshots,
 *   mlOrderSync, mlShipmentLog,
 *   devoluciones, lotePagos, boletas, adelantosNomina,
 *   conteosInventario, scanHistory, historialRecalculoCTRU,
 *   cierresContables, aportesCapital, retirosCapital,
 *   notificaciones, audit_logs, _errorLog,
 *   actividad, presencia,
 *   estadisticas
 *
 * RESETEA:
 *   - Stock de productos a 0
 *   - Saldos de cuentasCaja a 0
 *   - Contadores transaccionales a 0 (conserva contadores de maestros)
 *   - Métricas en proveedores, marcas, categorías, tiposProducto, clientes a {}
 *
 * ELIMINA almacén específico:
 *   - ALM-CN-001 (Asian Beauty virtual — ya no aplica en nuevo modelo)
 *
 * Uso:
 *   DRY RUN:  node scripts/reingenieria/00-limpieza-total.mjs --dry-run
 *   EJECUTAR: node scripts/reingenieria/00-limpieza-total.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const BATCH_LIMIT = 450;

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m',
  dim: '\x1b[2m',
};

// =============================================
// COLECCIONES A BORRAR COMPLETAMENTE
// =============================================
const COLLECTIONS_TO_DELETE = [
  // Flujo compras/inventario
  'ordenesCompra',
  'transferencias',
  'unidades',

  // Flujo ventas
  'ventas',
  'cotizaciones',
  'requerimientos',
  'entregas',
  'entregas_parciales',
  'devoluciones',

  // Finanzas/Tesorería
  'gastos',
  'movimientosTesoreria',
  'conversionesCambiarias',
  'registrosTCTransaccion',
  'aportesCapital',
  'retirosCapital',
  'cierresContables',

  // Pool USD (se fusionará con Tesorería)
  'poolUSDMovimientos',
  'poolUSDSnapshots',

  // Pagos masivos / Planilla
  'lotePagos',
  'boletas',
  'adelantosNomina',

  // MercadoLibre transaccional
  'mlOrderSync',
  'mlShipmentLog',

  // Escáner / Inventario
  'conteosInventario',
  'scanHistory',
  'historialRecalculoCTRU',

  // Sistema / Logs
  'notificaciones',
  'audit_logs',
  '_errorLog',
  'actividad',
  'presencia',
  'estadisticas',

  // Movimientos transportista
  'movimientos_transportista',
];

// =============================================
// COLECCIONES QUE SE CONSERVAN
// =============================================
const COLLECTIONS_TO_KEEP = [
  'productos',          // se conserva pero se resetean stocks y métricas
  'almacenes',          // se conserva (se migrará a casillas en Fase 1)
  'clientes',           // se conserva pero se resetean métricas
  'proveedores',        // se conserva pero se resetean métricas
  'marcas',             // se conserva pero se resetean métricas
  'categorias',         // se conserva pero se resetean métricas
  'tiposProducto',      // se conserva pero se resetean métricas
  'etiquetas',
  'lineasNegocio',
  'paisesOrigen',
  'canalesVenta',
  'competidores',
  'transportistas',
  'tiposCambio',
  'users',
  'mlConfig',
  'mlProductMap',
  'cuentasCaja',        // se conserva pero se resetean saldos
  'configuracion',
  'contadores',         // se conserva pero se resetean contadores transaccionales
];

// =============================================
// CAMPOS DE STOCK A RESETEAR EN PRODUCTOS
// =============================================
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

// =============================================
// CONTADORES TRANSACCIONALES A RESETEAR
// (los de maestros como MRC, CAT, PRV, etc. se conservan)
// =============================================
const CONTADORES_TRANSACCIONALES = [
  // Prefijos con año — usar patrón para encontrarlos
  'OC-',     // OC-2026, OC-2025, etc.
  'VT-',     // VT-2026
  'TRF-',    // TRF-2026 (transferencias)
  'ENV-',    // ENV-2026 (envíos)
  'COT-',    // COT-2026
  'REQ-',    // REQ-2026
  'ENT-',    // ENT-2026
  'DEV-',    // DEV-2026
  'MOV-',    // MOV-2026
  'CONV-',   // CONV-2026
  'LOTE-',   // LOTE-2026
  'ADL-',    // ADL-2026
  'GAS',     // GAS (sin año)
];

// =============================================
// FUNCIONES
// =============================================

async function deleteCollection(collName) {
  const snap = await db.collection(collName).get();
  if (snap.empty) {
    console.log(`  ⏭️  ${collName.padEnd(30)} 0 docs (ya vacía)`);
    return 0;
  }

  if (DRY_RUN) {
    console.log(`  ${C.yellow}[DRY] ${collName.padEnd(30)} ${snap.size} docs serían eliminados${C.reset}`);
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

  console.log(`  ${C.red}🗑️  ${collName.padEnd(30)} ${total} docs eliminados${C.reset}`);
  return total;
}

async function deleteSpecificDoc(collName, docId, label) {
  const ref = db.collection(collName).doc(docId);
  const doc = await ref.get();

  if (!doc.exists) {
    console.log(`  ⏭️  ${label.padEnd(30)} no existe (ya eliminado)`);
    return 0;
  }

  if (DRY_RUN) {
    console.log(`  ${C.yellow}[DRY] ${label.padEnd(30)} sería eliminado${C.reset}`);
    return 1;
  }

  await ref.delete();
  console.log(`  ${C.red}🗑️  ${label.padEnd(30)} eliminado${C.reset}`);
  return 1;
}

async function resetProductStock() {
  const snap = await db.collection('productos').get();
  if (snap.empty) return 0;

  if (DRY_RUN) {
    console.log(`  ${C.yellow}[DRY] productos${' '.repeat(19)} ${snap.size} docs → resetear stock a 0${C.reset}`);
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

  console.log(`  ${C.green}🔄 productos${' '.repeat(19)} ${snap.size} docs → stock reseteado a 0${C.reset}`);
  return snap.size;
}

async function resetCuentasCaja() {
  const snap = await db.collection('cuentasCaja').get();
  if (snap.empty) return 0;

  if (DRY_RUN) {
    console.log(`  ${C.yellow}[DRY] cuentasCaja${' '.repeat(15)} ${snap.size} docs → resetear saldos a 0${C.reset}`);
    return snap.size;
  }

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { saldo: 0, totalIngresos: 0, totalEgresos: 0 });
  }
  await batch.commit();
  console.log(`  ${C.green}🔄 cuentasCaja${' '.repeat(15)} ${snap.size} docs → saldos reseteados a 0${C.reset}`);
  return snap.size;
}

async function resetMetricasMaestros() {
  const maestrosConMetricas = [
    { coll: 'proveedores', label: 'proveedores' },
    { coll: 'marcas', label: 'marcas' },
    { coll: 'categorias', label: 'categorías' },
    { coll: 'tiposProducto', label: 'tiposProducto' },
    { coll: 'clientes', label: 'clientes' },
  ];

  let totalReset = 0;

  for (const { coll, label } of maestrosConMetricas) {
    const snap = await db.collection(coll).get();
    if (snap.empty) {
      console.log(`  ⏭️  ${label.padEnd(30)} 0 docs`);
      continue;
    }

    // Verificar si algún doc tiene métricas
    const docsConMetricas = snap.docs.filter(d => d.data().metricas && Object.keys(d.data().metricas).length > 0);

    if (docsConMetricas.length === 0) {
      console.log(`  ⏭️  ${label.padEnd(30)} ${snap.size} docs (sin métricas que resetear)`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ${C.yellow}[DRY] ${label.padEnd(30)} ${docsConMetricas.length}/${snap.size} docs → resetear métricas${C.reset}`);
      totalReset += docsConMetricas.length;
      continue;
    }

    let batch = db.batch();
    let count = 0;

    for (const doc of docsConMetricas) {
      batch.update(doc.ref, { metricas: {} });
      count++;
      totalReset++;

      if (count >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    console.log(`  ${C.green}🔄 ${label.padEnd(30)} ${docsConMetricas.length}/${snap.size} docs → métricas reseteadas${C.reset}`);
  }

  return totalReset;
}

async function resetContadoresTransaccionales() {
  const snap = await db.collection('contadores').get();
  if (snap.empty) {
    console.log(`  ⏭️  contadores${' '.repeat(18)} 0 docs`);
    return 0;
  }

  const docsToDelete = [];
  const docsToKeep = [];

  for (const doc of snap.docs) {
    const id = doc.id;
    const isTransaccional = CONTADORES_TRANSACCIONALES.some(prefix => id.startsWith(prefix));

    if (isTransaccional) {
      docsToDelete.push(doc);
    } else {
      docsToKeep.push(doc);
    }
  }

  if (docsToDelete.length === 0) {
    console.log(`  ⏭️  contadores${' '.repeat(18)} ${snap.size} docs (todos de maestros, se conservan)`);
    return 0;
  }

  if (DRY_RUN) {
    console.log(`  ${C.yellow}[DRY] contadores transaccionales:${C.reset}`);
    for (const doc of docsToDelete) {
      console.log(`    ${C.yellow}  🗑️ ${doc.id} (current: ${doc.data().current})${C.reset}`);
    }
    console.log(`  ${C.green}  conservar: ${docsToKeep.map(d => d.id).join(', ')}${C.reset}`);
    return docsToDelete.length;
  }

  let batch = db.batch();
  let count = 0;

  for (const doc of docsToDelete) {
    batch.delete(doc.ref);
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

  console.log(`  ${C.red}🗑️  contadores transaccionales${' '.repeat(3)} ${docsToDelete.length} eliminados${C.reset}`);
  console.log(`  ${C.green}✅ contadores maestros${' '.repeat(11)} ${docsToKeep.length} conservados: ${docsToKeep.map(d => d.id).join(', ')}${C.reset}`);
  return docsToDelete.length;
}

async function deleteAlmacenVirtual() {
  // Buscar ALM-CN-001 (Asian Beauty) por código
  const snap = await db.collection('almacenes')
    .where('codigo', '==', 'ALM-CN-001')
    .get();

  if (snap.empty) {
    console.log(`  ⏭️  ALM-CN-001${' '.repeat(18)} no encontrado (ya eliminado)`);
    return 0;
  }

  if (DRY_RUN) {
    const doc = snap.docs[0];
    console.log(`  ${C.yellow}[DRY] ALM-CN-001${' '.repeat(18)} "${doc.data().nombre || 'sin nombre'}" sería eliminado${C.reset}`);
    return 1;
  }

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  console.log(`  ${C.red}🗑️  ALM-CN-001${' '.repeat(18)} eliminado${C.reset}`);
  return 1;
}

// =============================================
// MAIN
// =============================================
async function main() {
  console.log(`\n${C.bold}╔════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}║   FASE 0 — REINGENIERÍA: Limpieza Total BD Transaccional  ║${C.reset}`);
  console.log(`${C.bold}╚════════════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`\nModo: ${DRY_RUN ? `${C.yellow}DRY-RUN (no hace cambios)${C.reset}` : `${C.red}⚠️  EJECUTAR (IRREVERSIBLE)${C.reset}`}`);
  console.log(`${C.dim}Basado en 53 acuerdos de reingeniería — 2026-04-10${C.reset}\n`);

  if (!DRY_RUN) {
    console.log(`${C.red}⚠️  ADVERTENCIA: Esto BORRARÁ datos transaccionales de Firestore.${C.reset}`);
    console.log(`${C.red}   PITR activo (7 días) + Backups diario/semanal confirmados.${C.reset}\n`);
    for (let i = 10; i > 0; i--) {
      process.stdout.write(`\r   Ejecutando en ${i}...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log('\n');
  }

  // ── PASO 1: Mostrar lo que se conserva ──
  console.log(`${C.bold}═══ PASO 1: CONSERVAR (maestros intactos) ═══${C.reset}\n`);
  for (const coll of COLLECTIONS_TO_KEEP) {
    try {
      const snap = await db.collection(coll).get();
      console.log(`  ${C.green}✅ ${coll.padEnd(30)} ${snap.size} docs${C.reset}`);
    } catch {
      console.log(`  ${C.dim}⏭️  ${coll.padEnd(30)} (no existe)${C.reset}`);
    }
  }

  // ── PASO 2: Eliminar colecciones transaccionales ──
  console.log(`\n${C.bold}═══ PASO 2: ELIMINAR colecciones transaccionales ═══${C.reset}\n`);
  let totalDeleted = 0;
  for (const coll of COLLECTIONS_TO_DELETE) {
    try {
      totalDeleted += await deleteCollection(coll);
    } catch (err) {
      console.log(`  ${C.red}❌ ${coll.padEnd(30)} ERROR: ${err.message}${C.reset}`);
    }
  }

  // ── PASO 3: Eliminar almacén virtual ──
  console.log(`\n${C.bold}═══ PASO 3: ELIMINAR almacén virtual ALM-CN-001 ═══${C.reset}\n`);
  totalDeleted += await deleteAlmacenVirtual();

  // ── PASO 4: Resetear stocks en productos ──
  console.log(`\n${C.bold}═══ PASO 4: RESETEAR stocks y saldos ═══${C.reset}\n`);
  await resetProductStock();
  await resetCuentasCaja();

  // ── PASO 5: Resetear métricas en maestros ──
  console.log(`\n${C.bold}═══ PASO 5: RESETEAR métricas en maestros ═══${C.reset}\n`);
  await resetMetricasMaestros();

  // ── PASO 6: Resetear contadores transaccionales ──
  console.log(`\n${C.bold}═══ PASO 6: RESETEAR contadores transaccionales ═══${C.reset}\n`);
  await resetContadoresTransaccionales();

  // ── RESUMEN ──
  console.log(`\n${C.bold}═══════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  RESUMEN${C.reset}`);
  console.log(`${C.bold}═══════════════════════════════════════${C.reset}\n`);
  console.log(`  Documentos eliminados:     ${totalDeleted}`);
  console.log(`  Stocks productos:          → 0`);
  console.log(`  Saldos cuentas caja:       → 0`);
  console.log(`  Métricas maestros:         → {}`);
  console.log(`  Contadores transaccionales:→ eliminados`);
  console.log(`  ALM-CN-001:                → eliminado`);
  console.log(`  Auth/Hosting/Functions:     intactos`);
  console.log(`  Maestros:                  intactos`);

  if (DRY_RUN) {
    console.log(`\n${C.yellow}[DRY-RUN] Para ejecutar:${C.reset}`);
    console.log(`${C.yellow}  node scripts/reingenieria/00-limpieza-total.mjs --execute${C.reset}\n`);
  } else {
    console.log(`\n${C.green}✅ Fase 0 completada. BD limpia — lista para reingeniería.${C.reset}`);
    console.log(`${C.dim}   Próximo paso: Fase 1 — Modelo de datos (tipos + colecciones + rules)${C.reset}\n`);
  }
}

main().catch(err => {
  console.error(`\n${C.red}Error fatal:${C.reset}`, err);
  process.exit(1);
});
