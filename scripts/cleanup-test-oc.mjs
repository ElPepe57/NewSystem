/**
 * Limpieza de OC de prueba y datos derivados.
 *
 * Elimina:
 * - Órdenes de Compra creadas hoy (o en rango de fechas)
 * - Unidades creadas por esas OC (estado 'pedida')
 * - Envíos T1 generados automáticamente al confirmar
 * - Movimientos de tesorería vinculados
 * - Pagos registrados en esas OC
 *
 * Uso:
 *   node scripts/cleanup-test-oc.mjs                    # Elimina OC creadas hoy
 *   node scripts/cleanup-test-oc.mjs --days=3            # Últimos 3 días
 *   node scripts/cleanup-test-oc.mjs --oc=OC-2026-XXX    # Una OC específica
 *   node scripts/cleanup-test-oc.mjs --dry-run            # Solo muestra qué eliminaría
 *   node scripts/cleanup-test-oc.mjs --all-borrador       # Todas las OC en borrador
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const allBorrador = args.includes('--all-borrador');
const daysArg = args.find(a => a.startsWith('--days='));
const ocArg = args.find(a => a.startsWith('--oc='));
const days = daysArg ? parseInt(daysArg.split('=')[1]) : 1;
const specificOC = ocArg ? ocArg.split('=')[1] : null;

function formatDate(ts) {
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function findOCsToDelete() {
  const ocRef = db.collection('ordenesCompra');

  if (specificOC) {
    // Buscar OC específica por número
    const snap = await ocRef.where('numeroOrden', '==', specificOC).get();
    if (snap.empty) {
      console.log(`❌ No se encontró OC con número ${specificOC}`);
      return [];
    }
    return snap.docs;
  }

  if (allBorrador) {
    const snap = await ocRef.where('estado', '==', 'borrador').get();
    return snap.docs;
  }

  // Por fecha: OC creadas en los últimos N días
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  const sinceTs = Timestamp.fromDate(since);

  const snap = await ocRef.where('fechaCreacion', '>=', sinceTs).get();
  return snap.docs;
}

async function findRelatedData(ocIds) {
  const related = {
    unidades: [],
    envios: [],
    movimientos: [],
  };

  if (ocIds.length === 0) return related;

  // Buscar unidades vinculadas a estas OC
  for (const ocId of ocIds) {
    const unidadesSnap = await db.collection('unidades')
      .where('ordenCompraId', '==', ocId)
      .get();
    related.unidades.push(...unidadesSnap.docs);

    // Buscar envíos vinculados
    const enviosSnap = await db.collection('transferencias')
      .where('ordenCompraId', '==', ocId)
      .get();
    related.envios.push(...enviosSnap.docs);
  }

  // Buscar movimientos de tesorería vinculados
  for (const ocId of ocIds) {
    const movsSnap = await db.collection('movimientosTesoreria')
      .where('ordenCompraId', '==', ocId)
      .get();
    related.movimientos.push(...movsSnap.docs);
  }

  return related;
}

async function deleteInBatches(docs, label) {
  if (docs.length === 0) return;

  const BATCH_SIZE = 450;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);
    chunk.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`  ✓ ${label}: eliminados ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}`);
  }
}

async function updateCounters(ocDocs) {
  // Decrementar contadores de secuencia si las OC son recientes
  // (solo si queremos reutilizar los números — opcional)
  console.log('  ℹ Contadores de secuencia NO se modifican (los números se consideran usados)');
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  LIMPIEZA DE OC DE PRUEBA');
  console.log('═══════════════════════════════════════════');
  console.log(`Modo: ${dryRun ? '🔍 DRY RUN (no elimina nada)' : '🗑️  ELIMINACIÓN REAL'}`);

  if (specificOC) {
    console.log(`Filtro: OC específica ${specificOC}`);
  } else if (allBorrador) {
    console.log('Filtro: Todas las OC en estado borrador');
  } else {
    console.log(`Filtro: OC creadas en los últimos ${days} día(s)`);
  }
  console.log('');

  // 1. Encontrar OC a eliminar
  const ocDocs = await findOCsToDelete();

  if (ocDocs.length === 0) {
    console.log('✅ No se encontraron OC que coincidan con el filtro.');
    process.exit(0);
  }

  // 2. Mostrar resumen
  console.log(`📋 OC encontradas: ${ocDocs.length}\n`);
  console.log('  #   | Número         | Proveedor                | Estado      | Total USD  | Fecha');
  console.log('  ----|----------------|--------------------------|-------------|------------|------------------');

  ocDocs.forEach((doc, i) => {
    const d = doc.data();
    const num = (d.numeroOrden || '-').padEnd(14);
    const prov = (d.nombreProveedor || '-').substring(0, 24).padEnd(24);
    const estado = (d.estado || '-').padEnd(11);
    const total = ('$' + (d.totalUSD || 0).toFixed(2)).padStart(10);
    const fecha = formatDate(d.fechaCreacion);
    console.log(`  ${String(i + 1).padStart(3)} | ${num} | ${prov} | ${estado} | ${total} | ${fecha}`);
  });

  // 3. Buscar datos relacionados
  const ocIds = ocDocs.map(d => d.id);
  console.log('\n🔍 Buscando datos relacionados...');
  const related = await findRelatedData(ocIds);

  console.log(`  Unidades vinculadas: ${related.unidades.length}`);
  console.log(`  Envíos vinculados: ${related.envios.length}`);
  console.log(`  Movimientos tesorería: ${related.movimientos.length}`);

  const totalDocs = ocDocs.length + related.unidades.length + related.envios.length + related.movimientos.length;
  console.log(`\n📊 Total documentos a eliminar: ${totalDocs}`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN — no se eliminó nada. Ejecuta sin --dry-run para eliminar.');
    process.exit(0);
  }

  // 4. Eliminar en orden (dependencias primero)
  console.log('\n🗑️  Eliminando...\n');

  await deleteInBatches(related.movimientos, 'Movimientos tesorería');
  await deleteInBatches(related.unidades, 'Unidades');
  await deleteInBatches(related.envios, 'Envíos');
  await deleteInBatches(ocDocs, 'Órdenes de Compra');

  await updateCounters(ocDocs);

  console.log(`\n✅ Limpieza completada: ${totalDocs} documentos eliminados.`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
