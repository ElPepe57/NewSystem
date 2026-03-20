/**
 * ===============================================
 * FIX: Reparar unidades de transferencia ENV-2026-011
 * ===============================================
 *
 * Esta transferencia (USA→Perú, completada) tiene 28 unidades que
 * posiblemente tienen un almacenId stale post-migración.
 *
 * El script:
 *   1. Busca la transferencia ENV-2026-011
 *   2. Obtiene el almacén destino correcto (ALM-PE-001)
 *   3. Verifica cada unidad y corrige almacenId/almacenNombre si no coinciden
 *   4. Sincroniza stock de productos afectados
 *
 * Uso:
 *   DRY RUN (solo ver qué haría):
 *     node scripts/fix-env2026-011-units.mjs --dry-run
 *
 *   EJECUTAR:
 *     node scripts/fix-env2026-011-units.mjs --execute
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: applicationDefault(), projectId: 'businessmn-269c9' });
const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(emoji, msg) { console.log(`${emoji} ${msg}`); }

async function main() {
  console.log(`\n${C.bold}=== Fix ENV-2026-011 Units ===${C.reset}`);
  console.log(`Modo: ${DRY_RUN ? `${C.yellow}DRY-RUN${C.reset}` : `${C.red}EJECUTAR${C.reset}`}\n`);

  // 1. Buscar la transferencia
  log('🔍', 'Buscando transferencia ENV-2026-011...');
  const transferenciasSnap = await db.collection('transferencias')
    .where('numeroTransferencia', '==', 'ENV-2026-011')
    .get();

  if (transferenciasSnap.empty) {
    log('❌', 'Transferencia ENV-2026-011 no encontrada');
    process.exit(1);
  }

  const transferenciaDoc = transferenciasSnap.docs[0];
  const transferencia = transferenciaDoc.data();
  log('✅', `Transferencia encontrada: ${transferenciaDoc.id}`);
  log('📋', `Estado: ${transferencia.estado}, Tipo: ${transferencia.tipo}`);
  log('📋', `Almacén destino guardado: ${transferencia.almacenDestinoId} (${transferencia.almacenDestinoNombre})`);
  log('📋', `Total unidades: ${transferencia.totalUnidades}`);

  // 2. Buscar el almacén destino correcto (ALM-PE-001)
  log('\n🔍', 'Buscando almacén destino correcto (código ALM-PE-001)...');
  const almacenesSnap = await db.collection('almacenes')
    .where('codigo', '==', 'ALM-PE-001')
    .get();

  let almacenDestinoCorrectId;
  let almacenDestinoCorrectNombre;

  if (almacenesSnap.empty) {
    log('⚠️', 'No se encontró almacén con código ALM-PE-001, intentando por nombre...');
    // Fallback: buscar por el nombre que tiene la transferencia
    const almacenSnap = await db.collection('almacenes').doc(transferencia.almacenDestinoId).get();
    if (almacenSnap.exists) {
      almacenDestinoCorrectId = almacenSnap.id;
      almacenDestinoCorrectNombre = almacenSnap.data().nombre;
      log('✅', `Almacén destino encontrado por ID directo: ${almacenDestinoCorrectId} → ${almacenDestinoCorrectNombre}`);
    } else {
      log('❌', `El almacenDestinoId de la transferencia (${transferencia.almacenDestinoId}) NO existe en Firestore`);
      log('🔎', 'Buscando todos los almacenes para encontrar el correcto...');
      const todosAlmacenes = await db.collection('almacenes').get();
      todosAlmacenes.docs.forEach(d => {
        const a = d.data();
        console.log(`   ${d.id} → ${a.codigo} → ${a.nombre} (${a.pais || 'sin pais'})`);
      });
      log('❌', 'Especifica manualmente el ID correcto en el script');
      process.exit(1);
    }
  } else {
    const almacenDoc = almacenesSnap.docs[0];
    almacenDestinoCorrectId = almacenDoc.id;
    almacenDestinoCorrectNombre = almacenDoc.data().nombre;
    log('✅', `Almacén correcto: ${almacenDestinoCorrectId} → ${almacenDestinoCorrectNombre}`);
  }

  // Comparar
  const idCambio = transferencia.almacenDestinoId !== almacenDestinoCorrectId;
  const nombreCambio = transferencia.almacenDestinoNombre !== almacenDestinoCorrectNombre;
  if (!idCambio && !nombreCambio) {
    log('ℹ️', 'El almacenDestinoId de la transferencia coincide con el actual — verificando unidades igualmente...');
  } else {
    log('🔄', `ID cambió: ${transferencia.almacenDestinoId} → ${almacenDestinoCorrectId}`);
    if (nombreCambio) {
      log('🔄', `Nombre cambió: ${transferencia.almacenDestinoNombre} → ${almacenDestinoCorrectNombre}`);
    }
  }

  // 3. Verificar y corregir cada unidad
  log('\n🔍', 'Verificando unidades...');
  const unidades = transferencia.unidades || [];
  let corregidas = 0;
  let yaCorrectas = 0;
  let noEncontradas = 0;
  let estadoIncorrecto = 0;
  const productosAfectados = new Set();
  const batch = db.batch();

  for (const u of unidades) {
    if (u.estadoTransferencia !== 'recibida') {
      log('⏭️', `  ${u.sku} (${u.lote}) — estado transferencia: ${u.estadoTransferencia}, skip`);
      continue;
    }

    const unidadRef = db.collection('unidades').doc(u.unidadId);
    const unidadSnap = await unidadRef.get();

    if (!unidadSnap.exists) {
      log('❌', `  ${u.sku} (${u.lote}) — unidad ${u.unidadId.slice(0, 8)}... NO EXISTE`);
      noEncontradas++;
      continue;
    }

    const unidadData = unidadSnap.data();
    const problemas = [];

    if (unidadData.almacenId !== almacenDestinoCorrectId) {
      problemas.push(`almacenId: ${unidadData.almacenId?.slice(0, 12)}... → ${almacenDestinoCorrectId.slice(0, 12)}...`);
    }
    if (unidadData.almacenNombre !== almacenDestinoCorrectNombre) {
      problemas.push(`almacenNombre: "${unidadData.almacenNombre}" → "${almacenDestinoCorrectNombre}"`);
    }
    if (unidadData.pais !== 'Peru') {
      problemas.push(`pais: "${unidadData.pais}" → "Peru"`);
    }

    // Verificar estado coherente — transferencia internacional completada debe ser disponible_peru (o reservada/vendida/danada)
    const estadosEsperados = ['disponible_peru', 'reservada', 'vendida', 'danada'];
    const estadoIncorrectoUnit = !estadosEsperados.includes(unidadData.estado);
    if (estadoIncorrectoUnit) {
      // Determinar estado correcto basado en si tiene reserva
      const estabaReservada = unidadData.reservadaPara || unidadData.reservadoPara;
      const estadoCorrecto = estabaReservada ? 'reservada' : 'disponible_peru';
      problemas.push(`estado: "${unidadData.estado}" → "${estadoCorrecto}"`);
      estadoIncorrecto++;
    }

    if (problemas.length === 0) {
      yaCorrectas++;
      continue;
    }

    log('🔧', `  ${C.cyan}${u.sku}${C.reset} (${u.lote}) — ${problemas.join(', ')}`);
    productosAfectados.add(u.productoId);

    if (!DRY_RUN) {
      const estabaReservada = unidadData.reservadaPara || unidadData.reservadoPara;
      const updateData = {
        almacenId: almacenDestinoCorrectId,
        almacenNombre: almacenDestinoCorrectNombre,
        pais: 'Peru',
      };
      // Solo corregir estado si está mal
      if (estadoIncorrectoUnit) {
        updateData.estado = estabaReservada ? 'reservada' : 'disponible_peru';
      }
      batch.update(unidadRef, updateData);
    }
    corregidas++;
  }

  // 4. Actualizar transferencia si el almacenDestinoId cambió
  if (idCambio && !DRY_RUN) {
    log('\n🔧', 'Actualizando almacenDestinoId en la transferencia...');
    batch.update(transferenciaDoc.ref, {
      almacenDestinoId: almacenDestinoCorrectId,
      almacenDestinoNombre: almacenDestinoCorrectNombre,
    });
  }

  // Commit
  if (!DRY_RUN && corregidas > 0) {
    log('\n💾', 'Escribiendo cambios...');
    await batch.commit();
    log('✅', 'Batch commit exitoso');
  }

  // 5. Resumen
  console.log(`\n${C.bold}=== Resumen ===${C.reset}`);
  console.log(`  Total unidades en transferencia: ${unidades.length}`);
  console.log(`  ${C.green}Ya correctas: ${yaCorrectas}${C.reset}`);
  console.log(`  ${C.yellow}Corregidas: ${corregidas}${C.reset}`);
  console.log(`  ${C.red}No encontradas: ${noEncontradas}${C.reset}`);
  if (estadoIncorrecto > 0) {
    console.log(`  ${C.red}Estado inesperado: ${estadoIncorrecto}${C.reset}`);
  }
  console.log(`  Productos afectados: ${productosAfectados.size}`);

  if (DRY_RUN) {
    console.log(`\n${C.yellow}[DRY-RUN] Para ejecutar: node scripts/fix-env2026-011-units.mjs --execute${C.reset}\n`);
  } else if (corregidas > 0) {
    console.log(`\n${C.green}✅ ${corregidas} unidades reparadas${C.reset}\n`);

    // Nota: sincronizar stock requeriría importar inventarioService del frontend
    // Se recomienda ejecutar sincronización desde la app después
    console.log(`${C.cyan}IMPORTANTE: Ejecuta sincronización de stock desde la app para los productos afectados${C.reset}`);
    console.log(`Productos: ${[...productosAfectados].join(', ')}\n`);
  } else {
    console.log(`\n${C.green}✅ Todas las unidades ya estaban correctas, no se necesitó reparación${C.reset}\n`);
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
