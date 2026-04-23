/**
 * reset-transactional.ts — Reset completo de datos transaccionales de Firestore.
 *
 * Modos:
 *   - --dry-run: solo cuenta documentos, no borra nada
 *   - (sin flag): borra tras confirmación interactiva
 *
 * Uso:
 *   npx tsx scripts/reset-transactional.ts --dry-run
 *   npx tsx scripts/reset-transactional.ts
 *
 * Alcance:
 *   - 43 collections transaccionales borradas recursivamente
 *   - cuentasCaja preservadas, saldoPEN + saldoUSD → 0
 *   - Maestros (productos/clientes/etc.), ML, chat, users: intactos
 *
 * Autenticación: usa Application Default Credentials (firebase login + gcloud auth).
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import * as readline from 'readline';

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'businessmn-269c9';
const BATCH_SIZE = 500; // Límite Firestore para deletes batch

const COLLECTIONS_A_BORRAR: string[] = [
  // Flujo de ventas y logística (7)
  'ventas',
  'cotizaciones',
  'entregas',
  'entregas_parciales',
  'devoluciones',
  'envios',
  'reclamos',

  // Flujo de compras e inventario (8)
  'requerimientos',
  'ordenesCompra',
  'unidades',
  'transferencias',
  'scanHistory',
  'conteosInventario',
  'insumos',
  'historialRecalculoCTRU',

  // Tesorería y finanzas (14)
  'movimientosTesoreria',
  'conversionesCambiarias',
  'registrosTCTransaccion',
  'aportesCapital',
  'retirosCapital',
  'movimientosAnulados',
  'lotePagos',
  'gastos',
  'movimientos_transportista',
  'poolUSDMovimientos',
  'poolUSDSnapshots',
  'poolUSD_movimientosArchivo',

  // Planilla y contabilidad (3)
  'boletas',
  'adelantosNomina',
  'cierresContables',

  // Archivos (4)
  'ventasCanceladas',
  'cotizacionesArchivo',
  'gastosArchivo',
  'ordenesCompraArchivo',
  'clientesArchivo',

  // Sistema transaccional (6)
  'contadores',
  'estadisticas',
  'borradoresWizard',
  'audit_logs',
  'actividad',
  'notificaciones',
  'whatsapp_sessions',
  '_errorLog',
];

// ────────────────────────────────────────────────────────────────────────────
// Init
// ────────────────────────────────────────────────────────────────────────────

function initFirebase(): Firestore {
  try {
    initializeApp({
      credential: applicationDefault(),
      projectId: PROJECT_ID,
    });
  } catch {
    // ya inicializada
  }
  return getFirestore();
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function countDocs(db: Firestore, colName: string): Promise<number> {
  try {
    const snap = await db.collection(colName).count().get();
    return snap.data().count;
  } catch (err: any) {
    if (err?.code === 5 || /NOT_FOUND/i.test(err?.message || '')) return 0;
    throw err;
  }
}

async function deleteCollection(
  db: Firestore,
  colName: string
): Promise<number> {
  const collectionRef = db.collection(colName);
  let totalDeleted = 0;

  // Loop hasta vaciar
  while (true) {
    const snapshot = await collectionRef.limit(BATCH_SIZE).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snapshot.size;
    process.stdout.write(`   ${totalDeleted} docs...\r`);
  }

  return totalDeleted;
}

async function resetSaldosCuentasCaja(db: Firestore): Promise<number> {
  const snap = await db.collection('cuentasCaja').get();
  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach(doc => {
    batch.update(doc.ref, {
      saldoPEN: 0,
      saldoUSD: 0,
      ultimaActualizacion: FieldValue.serverTimestamp(),
      resetPor: 'S53.1-reset-transactional',
    });
  });
  await batch.commit();
  return snap.size;
}

function prompt(question: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const mode = dryRun ? '🔍 DRY-RUN (solo lectura)' : '🔥 DELETE REAL';

  console.log('═'.repeat(70));
  console.log(`  Reset transaccional Firestore · ${mode}`);
  console.log(`  Proyecto: ${PROJECT_ID}`);
  console.log(`  Collections a procesar: ${COLLECTIONS_A_BORRAR.length}`);
  console.log('═'.repeat(70));

  const db = initFirebase();

  // ─ Fase 1: Contar ─
  console.log('\n📊 Contando documentos en cada collection...\n');
  const conteos: Array<{ col: string; count: number }> = [];
  let totalDocs = 0;

  for (const col of COLLECTIONS_A_BORRAR) {
    const count = await countDocs(db, col);
    conteos.push({ col, count });
    totalDocs += count;
    const marker = count === 0 ? '  ·' : count < 10 ? '  ✓' : count < 100 ? ' ✓✓' : '✓✓✓';
    console.log(`  ${marker}  ${col.padEnd(35)} ${count.toString().padStart(6)} docs`);
  }

  // Contar cuentasCaja
  const cuentasCount = await countDocs(db, 'cuentasCaja');
  console.log(
    `\n  📁  cuentasCaja (preservada, reset saldos): ${cuentasCount} cuentas`
  );

  console.log('\n' + '─'.repeat(70));
  console.log(`  TOTAL a borrar: ${totalDocs.toLocaleString()} documentos`);
  console.log(`  TOTAL a resetear: ${cuentasCount} cuentas`);
  console.log('─'.repeat(70));

  if (dryRun) {
    console.log('\n✅ DRY-RUN completo. No se borró nada.');
    console.log('   Para ejecutar el borrado real: npx tsx scripts/reset-transactional.ts\n');
    process.exit(0);
  }

  // ─ Confirmación interactiva ─
  console.log('\n⚠️  ADVERTENCIA: el borrado es IRREVERSIBLE y NO hay backup.');
  const answer = await prompt('\nEscribí "BORRAR-TODO" para confirmar: ');
  if (answer.trim() !== 'BORRAR-TODO') {
    console.log('\n❌ Cancelado. No se borró nada.\n');
    process.exit(0);
  }

  // ─ Fase 2: Borrar ─
  console.log('\n🔥 Ejecutando borrado...\n');
  const resultados: Array<{ col: string; deleted: number; durMs: number }> = [];
  const startTotal = Date.now();

  for (let i = 0; i < COLLECTIONS_A_BORRAR.length; i++) {
    const col = COLLECTIONS_A_BORRAR[i];
    const start = Date.now();
    process.stdout.write(`  [${i + 1}/${COLLECTIONS_A_BORRAR.length}] ${col}... `);

    const deleted = await deleteCollection(db, col);
    const durMs = Date.now() - start;
    resultados.push({ col, deleted, durMs });

    console.log(
      `${deleted.toString().padStart(6)} docs · ${(durMs / 1000).toFixed(1)}s`
    );
  }

  // ─ Fase 3: Reset saldos cuentasCaja ─
  console.log('\n💰 Reseteando saldos de cuentasCaja...');
  const cuentasReseteadas = await resetSaldosCuentasCaja(db);
  console.log(`   ${cuentasReseteadas} cuentas · saldo → 0`);

  // ─ Resumen final ─
  const totalDeleted = resultados.reduce((sum, r) => sum + r.deleted, 0);
  const totalDurMs = Date.now() - startTotal;

  console.log('\n' + '═'.repeat(70));
  console.log('  ✅ RESET TRANSACCIONAL COMPLETO');
  console.log('═'.repeat(70));
  console.log(`  Collections procesadas: ${COLLECTIONS_A_BORRAR.length}`);
  console.log(`  Documentos borrados:    ${totalDeleted.toLocaleString()}`);
  console.log(`  Cuentas reseteadas:     ${cuentasReseteadas}`);
  console.log(`  Duración total:         ${(totalDurMs / 1000).toFixed(1)}s`);
  console.log('═'.repeat(70));
  console.log('\n  El sistema está listo para UAT limpio.\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ ERROR:', err?.message || err);
  console.error(err?.stack);
  process.exit(1);
});
