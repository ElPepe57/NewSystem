/**
 * ===============================================
 * AUDIT: Verificar TODAS las transferencias internacionales completadas
 * ===============================================
 *
 * Busca unidades con estado/pais incorrecto en todas las transferencias
 * USA→Perú que están completadas (recibida_completa o recibida_parcial).
 *
 * Uso:
 *   DRY RUN (solo ver):
 *     node scripts/audit-all-transfers.mjs --dry-run
 *
 *   EJECUTAR corrección:
 *     node scripts/audit-all-transfers.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const BATCH_LIMIT = 450;

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

async function main() {
  console.log(`\n${C.bold}=== Audit ALL International Transfers ===${C.reset}`);
  console.log(`Modo: ${DRY_RUN ? `${C.yellow}DRY-RUN${C.reset}` : `${C.red}EJECUTAR${C.reset}`}\n`);

  // 1. Get all international transfers that are completed
  const tiposInternacional = ['usa_peru', 'internacional_peru'];
  const estadosCompletados = ['recibida_completa', 'recibida_parcial'];

  console.log('🔍 Buscando transferencias internacionales completadas...');
  const allTransfers = [];

  for (const tipo of tiposInternacional) {
    for (const estado of estadosCompletados) {
      const snap = await db.collection('transferencias')
        .where('tipo', '==', tipo)
        .where('estado', '==', estado)
        .get();
      snap.docs.forEach(d => allTransfers.push({ id: d.id, ...d.data() }));
    }
  }

  console.log(`✅ Encontradas: ${allTransfers.length} transferencias\n`);

  if (allTransfers.length === 0) {
    console.log('No hay transferencias internacionales completadas.');
    process.exit(0);
  }

  // 2. Build almacen cache
  const almacenCache = new Map();
  const almacenesSnap = await db.collection('almacenes').get();
  almacenesSnap.docs.forEach(d => {
    almacenCache.set(d.id, { id: d.id, ...d.data() });
  });

  // 3. Check each transfer's units
  let totalUnidades = 0;
  let totalCorrectas = 0;
  let totalIncorrectas = 0;
  let totalNoEncontradas = 0;
  const productosAfectados = new Set();
  const problemasPorTransferencia = [];

  let batch = db.batch();
  let batchCount = 0;

  for (const transferencia of allTransfers) {
    const unidades = transferencia.unidades || [];
    const recibidas = unidades.filter(u => u.estadoTransferencia === 'recibida');

    if (recibidas.length === 0) continue;

    // Get correct almacen destino
    const almacenDestino = almacenCache.get(transferencia.almacenDestinoId);
    const correctAlmacenId = almacenDestino?.id || transferencia.almacenDestinoId;
    const correctAlmacenNombre = almacenDestino?.nombre || transferencia.almacenDestinoNombre;

    let transferProblems = 0;

    for (const u of recibidas) {
      totalUnidades++;

      const unidadRef = db.collection('unidades').doc(u.unidadId);
      const unidadSnap = await unidadRef.get();

      if (!unidadSnap.exists) {
        totalNoEncontradas++;
        continue;
      }

      const data = unidadSnap.data();
      const problemas = [];

      // Check almacenId
      if (data.almacenId !== correctAlmacenId) {
        problemas.push(`almacenId`);
      }

      // Check pais
      if (data.pais !== 'Peru') {
        problemas.push(`pais: "${data.pais}"`);
      }

      // Check estado - should be disponible_peru, reservada, vendida, or danada
      const estadosValidos = ['disponible_peru', 'reservada', 'vendida', 'danada'];
      if (!estadosValidos.includes(data.estado)) {
        problemas.push(`estado: "${data.estado}"`);
      }

      if (problemas.length === 0) {
        totalCorrectas++;
        continue;
      }

      totalIncorrectas++;
      transferProblems++;
      productosAfectados.add(u.productoId);

      if (!DRY_RUN) {
        const estabaReservada = data.reservadaPara || data.reservadoPara;
        const updateData = {
          almacenId: correctAlmacenId,
          almacenNombre: correctAlmacenNombre,
          pais: 'Peru',
        };
        // Fix estado only if it's wrong
        if (!estadosValidos.includes(data.estado)) {
          updateData.estado = estabaReservada ? 'reservada' : 'disponible_peru';
        }
        batch.update(unidadRef, updateData);
        batchCount++;

        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    if (transferProblems > 0) {
      problemasPorTransferencia.push({
        numero: transferencia.numeroTransferencia,
        estado: transferencia.estado,
        totalUnidades: recibidas.length,
        problemas: transferProblems,
      });
    }
  }

  // Commit remaining
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  // 4. Report
  console.log(`${C.bold}=== Resultados por Transferencia ===${C.reset}\n`);

  if (problemasPorTransferencia.length === 0) {
    console.log(`${C.green}✅ Todas las unidades están correctas!${C.reset}\n`);
  } else {
    for (const t of problemasPorTransferencia) {
      console.log(`  ${C.cyan}${t.numero}${C.reset} (${t.estado}) — ${C.red}${t.problemas}/${t.totalUnidades}${C.reset} unidades con problemas`);
    }
  }

  console.log(`\n${C.bold}=== Resumen Global ===${C.reset}`);
  console.log(`  Transferencias analizadas: ${allTransfers.length}`);
  console.log(`  Transferencias con problemas: ${problemasPorTransferencia.length}`);
  console.log(`  Total unidades revisadas: ${totalUnidades}`);
  console.log(`  ${C.green}Correctas: ${totalCorrectas}${C.reset}`);
  console.log(`  ${C.red}Incorrectas: ${totalIncorrectas}${C.reset}`);
  console.log(`  No encontradas: ${totalNoEncontradas}`);
  console.log(`  Productos afectados: ${productosAfectados.size}`);

  if (DRY_RUN) {
    console.log(`\n${C.yellow}[DRY-RUN] Para corregir: node scripts/audit-all-transfers.mjs --execute${C.reset}\n`);
  } else if (totalIncorrectas > 0) {
    console.log(`\n${C.green}✅ ${totalIncorrectas} unidades corregidas${C.reset}`);
    console.log(`\n${C.cyan}Productos afectados (sincronizar stock):${C.reset}`);
    console.log([...productosAfectados].join(', '));
    console.log();
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
