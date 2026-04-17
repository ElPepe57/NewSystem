/**
 * ========================================================================
 * CLEANUP S40 — FASE 2: BORRAR TRANSACCIONALES
 * ========================================================================
 *
 * Borra TODOS los documentos de las colecciones marcadas como "transaccional"
 * según la decisión de alcance S40 (testing/staging → reset limpio).
 *
 * Conserva:
 *   - Maestros (productos, marcas, clientes, proveedores, casillas, colaboradores, etc.)
 *   - Config del sistema (users, configuracion, categoriasCostos, cuentasCaja, etc.)
 *
 * Borra:
 *   - Ventas, compras, inventario transaccional, logística, finanzas transaccionales
 *   - Logs, auditoría, cache, pool USD deprecated, ML transaccional, colaboración
 *   - Subcolecciones de archivo detectadas automáticamente por patrón
 *
 * Uso:
 *   DRY RUN:  node scripts/cleanup-s40/02-borrar-transaccionales.mjs
 *   EJECUTAR: node scripts/cleanup-s40/02-borrar-transaccionales.mjs --execute
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

// ─── Colecciones a BORRAR (alineado con 01-inventario.mjs) ─────────────

const COLLECTIONS_TO_DELETE = [
  // Ventas
  'ventas', 'cotizaciones', 'entregas', 'entregas_parciales',
  // Compras
  'requerimientos', 'ordenesCompra',
  // Inventario
  'unidades',
  // S40: 'almacenes' legacy — consolidado a 'casillas' en Fase 0B
  'almacenes',
  // Logística
  'envios', 'transferencias', 'reclamos',
  // Finanzas
  'gastos', 'movimientosTesoreria', 'conversionesCambiarias', 'registrosTCTransaccion',
  'aportesCapital', 'retirosCapital',
  // Planilla
  'boletas', 'adelantosNomina',
  // Otros transaccionales
  'lotePagos', 'cierresContables', 'devoluciones',
  // Logs
  'actividad', 'audit_logs', 'movimientos_transportista', 'historialRecalculoCTRU',
  'scanHistory', 'conteosInventario', '_errorLog', 'notificaciones',
  // Pool USD deprecated
  'poolUSDMovimientos', 'poolUSDSnapshots',
  // ML transaccional
  'mlOrderSync', 'mlQuestions', 'mlWebhookLog', 'mlShipmentLog',
  // Colaboración
  'chat_mensajes', 'chat_meta', 'llamadas', 'llamadasIntel', 'presencia',
  // Cacheadas
  'estadisticas',
];

// Patrones para detectar archivos automáticamente
const ARCHIVE_PATTERNS = [
  /Anulados$/i, /Archivo$/i, /_archivo$/i, /_historico$/i, /Backup$/i,
];

// Colecciones que NUNCA se deben borrar aunque aparezcan
const SAFETY_GUARD = new Set([
  'productos', 'marcas', 'categorias', 'tiposProducto', 'canalesVenta',
  'etiquetas', 'competidores', 'lineasNegocio', 'paisesOrigen',
  'casillas', 'colaboradores', 'clientes', 'proveedores',
  'cuentasCaja', 'categoriasCostos', 'insumos', 'kitsEmpaque', 'tarjetasCredito',
  'tiposCambio', 'configuracion', 'users', 'mlProductMap', 'mlConfig',
  'contadores', // se resetea en 03, no se borra
]);

// ─── Borrado en batches ────────────────────────────────────────────────

async function deleteCollection(colName, isDryRun) {
  // Guard de seguridad — nunca borrar maestros ni config
  if (SAFETY_GUARD.has(colName)) {
    console.log(`  ${C.red}✗ BLOQUEADO por safety guard: ${colName}${C.reset}`);
    return { deleted: 0, errors: 0, blocked: true };
  }

  const colRef = db.collection(colName);
  const countSnap = await colRef.count().get();
  const total = countSnap.data().count;

  if (total === 0) {
    console.log(`  ${C.dim}○ vacía${C.reset}`);
    return { deleted: 0, errors: 0, blocked: false };
  }

  if (isDryRun) {
    console.log(`  ${C.yellow}→ borraría ${total} docs${C.reset}`);
    return { deleted: total, errors: 0, blocked: false, dryRun: true };
  }

  let deleted = 0;
  let errors = 0;
  let lastDoc = null;
  let iteration = 0;

  while (true) {
    iteration++;
    let q = colRef.limit(BATCH_LIMIT);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);

    try {
      await batch.commit();
      deleted += snap.size;
      process.stdout.write(`\r  ${C.green}✓ ${deleted}/${total} docs borrados (iter ${iteration})${C.reset}     `);
    } catch (err) {
      errors++;
      console.log(`\n  ${C.red}✗ Batch ${iteration} falló: ${err.message}${C.reset}`);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_LIMIT) break;
  }
  process.stdout.write(`\n`);
  return { deleted, errors, blocked: false, total };
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}${C.cyan}  CLEANUP S40 — FASE 2: BORRADO TRANSACCIONAL${C.reset}`);
  console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(DRY_RUN
    ? `${C.yellow}${C.bold}MODO DRY-RUN (no se borrará nada). Usa --execute para ejecutar.${C.reset}\n`
    : `${C.red}${C.bold}⚠️  MODO EJECUCIÓN REAL — SE BORRARÁN DATOS DE FIRESTORE${C.reset}\n`);

  const start = Date.now();

  // Detectar colecciones archivo automáticamente
  console.log(`${C.cyan}Detectando colecciones archivo...${C.reset}`);
  const cols = await db.listCollections();
  const archiveCols = cols
    .map(c => c.id)
    .filter(id => ARCHIVE_PATTERNS.some(p => p.test(id)));

  if (archiveCols.length > 0) {
    console.log(`  Detectadas ${archiveCols.length} colecciones archivo:`);
    archiveCols.forEach(id => console.log(`    ${C.dim}• ${id}${C.reset}`));
  } else {
    console.log(`  ${C.dim}Ninguna detectada${C.reset}`);
  }

  const allToDelete = [...COLLECTIONS_TO_DELETE, ...archiveCols];
  const uniqueToDelete = [...new Set(allToDelete)];

  console.log(`\n${C.bold}Total colecciones a procesar: ${uniqueToDelete.length}${C.reset}\n`);

  // Confirmación adicional en modo execute
  if (!DRY_RUN) {
    console.log(`${C.red}${C.bold}Última oportunidad para cancelar — 5 segundos...${C.reset}`);
    await new Promise(r => setTimeout(r, 5000));
    console.log(`${C.red}${C.bold}Procediendo con el borrado.${C.reset}\n`);
  }

  const resultados = [];
  for (const colId of uniqueToDelete) {
    console.log(`${C.bold}${colId}${C.reset}`);
    const r = await deleteCollection(colId, DRY_RUN);
    resultados.push({ id: colId, ...r });
  }

  // Resumen final
  const totalBorrado = resultados.reduce((s, r) => s + (r.deleted || 0), 0);
  const totalErrores = resultados.reduce((s, r) => s + (r.errors || 0), 0);
  const bloqueados = resultados.filter(r => r.blocked);

  console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}RESUMEN${C.reset}`);
  console.log(`  Colecciones procesadas : ${resultados.length}`);
  console.log(`  Docs ${DRY_RUN ? 'QUE SE BORRARÍAN' : 'borrados'}        : ${C.green}${totalBorrado}${C.reset}`);
  console.log(`  Errores                : ${totalErrores > 0 ? C.red : C.dim}${totalErrores}${C.reset}`);
  if (bloqueados.length > 0) {
    console.log(`  ${C.red}Bloqueadas por safety guard: ${bloqueados.length}${C.reset}`);
    bloqueados.forEach(b => console.log(`    ${C.red}• ${b.id}${C.reset}`));
  }
  console.log(`  Duración               : ${((Date.now() - start) / 1000).toFixed(1)}s`);

  if (DRY_RUN) {
    console.log(`\n${C.yellow}${C.bold}DRY-RUN completo. Para ejecutar de verdad:${C.reset}`);
    console.log(`  node scripts/cleanup-s40/02-borrar-transaccionales.mjs --execute\n`);
  } else {
    console.log(`\n${C.green}${C.bold}✓ Borrado completado. Continuar con:${C.reset}`);
    console.log(`  node scripts/cleanup-s40/03-reset-contadores.mjs --execute\n`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(`\n${C.red}❌ Error fatal:${C.reset}`, err);
  process.exit(1);
});
